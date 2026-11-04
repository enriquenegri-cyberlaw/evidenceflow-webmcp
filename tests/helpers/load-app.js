"use strict";

// Loads EvidenceFlow's classic browser scripts under Node.js, in the order
// used by index.html, with a minimal DOM and a stand-in for the WebMCP
// `document.modelContext` API. Only the DOM features the application uses
// are implemented; this is not a general-purpose DOM.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const INHERENTLY_FOCUSABLE = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
]);

// Links back up the tree are not enumerable, so that a failing assertion that
// inspects a node prints its subtree instead of the whole circular graph.
function defineBackLinks(node, ownerDocument) {
  Object.defineProperty(node, "parentNode", {
    value: null,
    writable: true,
    enumerable: false,
  });
  if (ownerDocument) {
    Object.defineProperty(node, "ownerDocument", {
      value: ownerDocument,
      enumerable: false,
    });
  }
}

// "data-finding-id" -> "findingId"
function datasetKey(attributeName) {
  return attributeName
    .slice("data-".length)
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

class FakeText {
  constructor(data) {
    this.nodeType = 3;
    this.data = String(data);
    defineBackLinks(this);
  }

  get textContent() {
    return this.data;
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    defineBackLinks(this, ownerDocument);
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.id = "";
    this.type = "";
    this.classNames = new Set();
    this.explicitTabIndex = null;

    const element = this;
    this.classList = {
      add(...names) {
        names.forEach((name) => element.classNames.add(name));
      },
      remove(...names) {
        names.forEach((name) => element.classNames.delete(name));
      },
      contains(name) {
        return element.classNames.has(name);
      },
      toggle(name, force) {
        const present =
          force === undefined ? !element.classNames.has(name) : Boolean(force);
        if (present) {
          element.classNames.add(name);
        } else {
          element.classNames.delete(name);
        }
        return present;
      },
    };
  }

  get className() {
    return [...this.classNames].join(" ");
  }

  set className(value) {
    this.classNames = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get tabIndex() {
    if (this.explicitTabIndex !== null) {
      return this.explicitTabIndex;
    }
    return INHERENTLY_FOCUSABLE.has(this.tagName) ? 0 : -1;
  }

  set tabIndex(value) {
    this.explicitTabIndex = Number(value);
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  set textContent(value) {
    this.replaceChildren(String(value));
  }

  get isConnected() {
    return this.ownerDocument.body.contains(this);
  }

  // data-* attributes are kept in `dataset`, as in the DOM.
  setAttribute(name, value) {
    if (name.startsWith("data-")) {
      this.dataset[datasetKey(name)] = String(value);
    } else {
      this.attributes.set(name, String(value));
    }
  }

  getAttribute(name) {
    if (name.startsWith("data-")) {
      const key = datasetKey(name);
      return Object.hasOwn(this.dataset, key) ? this.dataset[key] : null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === "string" ? new FakeText(node) : node;
      if (child.parentNode) {
        const siblings = child.parentNode.childNodes;
        siblings.splice(siblings.indexOf(child), 1);
      }
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes = [];
    this.append(...nodes);
    // As in browsers, removing the focused element returns focus to <body>.
    this.ownerDocument.resetFocusIfDisconnected();
  }

  contains(node) {
    for (let current = node; current; current = current.parentNode) {
      if (current === this) {
        return true;
      }
    }
    return false;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener.call(this, event);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click", target: this });
  }

  focus() {
    const focusable =
      INHERENTLY_FOCUSABLE.has(this.tagName) || this.explicitTabIndex !== null;
    if (focusable && this.isConnected) {
      this.ownerDocument.activeElement = this;
    }
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body", this);
    this.activeElement = this.body;
    this.listeners = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  querySelector(selector) {
    if (!/^#[\w-]+$/.test(selector)) {
      throw new Error(`Unsupported selector in test DOM: ${selector}`);
    }
    return findFirst(this.body, (element) => element.id === selector.slice(1));
  }

  addEventListener(type, listener) {
    FakeElement.prototype.addEventListener.call(this, type, listener);
  }

  dispatchEvent(event) {
    return FakeElement.prototype.dispatchEvent.call(this, event);
  }

  resetFocusIfDisconnected() {
    if (!this.activeElement.isConnected) {
      this.activeElement = this.body;
    }
  }
}

function findAll(root, predicate) {
  const matches = [];
  for (const child of root.children) {
    if (predicate(child)) {
      matches.push(child);
    }
    matches.push(...findAll(child, predicate));
  }
  return matches;
}

function findFirst(root, predicate) {
  return findAll(root, predicate)[0] ?? null;
}

// Mirrors WebMCP: the agent's input reaches the tool after a JSON round trip,
// and the tool's result is serialized to JSON before the agent receives it.
function jsonRoundTrip(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} [options]
 * @param {boolean} [options.withModelContext=true] expose `document.modelContext`
 * @param {(run: (code: string) => unknown) => void} [options.afterData]
 *   called after data/incidents.js runs and before the other scripts
 */
function loadEvidenceFlow({ withModelContext = true, afterData } = {}) {
  const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
  const document = new FakeDocument();

  for (const [, tagName, id] of html.matchAll(
    /<([a-z][a-z0-9]*)\b[^>]*\sid="([^"]+)"/gi,
  )) {
    const element = document.createElement(tagName);
    element.id = id;
    document.body.append(element);
  }

  const tools = new Map();
  if (withModelContext) {
    document.modelContext = {
      registerTool(tool) {
        if (tools.has(tool.name)) {
          return Promise.reject(new Error(`Duplicate tool: ${tool.name}`));
        }
        tools.set(tool.name, tool);
        return Promise.resolve();
      },
    };
  }

  const context = vm.createContext({ document, console, CustomEvent });
  const run = (code) => vm.runInContext(code, context);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(
    ([, src]) => src,
  );

  for (const script of scripts) {
    const source = fs.readFileSync(path.join(repoRoot, script), "utf8");
    vm.runInContext(source, context, { filename: script });
    if (script === "data/incidents.js" && afterData) {
      afterData(run);
    }
  }

  async function call(toolName, input) {
    const tool = tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not registered: ${toolName}`);
    }
    return jsonRoundTrip(await tool.execute(jsonRoundTrip(input), {}));
  }

  return { document, tools, run, call, scripts };
}

module.exports = { findAll, findFirst, loadEvidenceFlow, repoRoot };
