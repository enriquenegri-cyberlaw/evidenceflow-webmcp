"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  findAll,
  findFirst,
  loadEvidenceFlow,
  repoRoot,
} = require("./helpers/load-app.js");

const proposal = Object.freeze({
  incident_id: "SSH-2026-001",
  finding: "Repeated failed root logins from 203.0.113.50.",
  evidence_ids: ["EVT-001", "EVT-002"],
  confidence: "high",
  recommended_action: "Block 203.0.113.50 at the firewall.",
});

function findingsContainer(document) {
  return document.querySelector("#findings");
}

function findingCards(document) {
  return findAll(
    findingsContainer(document),
    (element) => element.className === "finding-card",
  );
}

function findingCard(document, findingId) {
  return findingCards(document).find(
    (element) =>
      element.getAttribute("aria-labelledby") === `finding-${findingId}`,
  );
}

function reviewButton(document, findingId, label) {
  return findFirst(
    findingCard(document, findingId),
    (element) => element.tagName === "BUTTON" && element.textContent === label,
  );
}

function findingHeading(document, findingId) {
  return findFirst(
    findingsContainer(document),
    (element) => element.tagName === "H3" && element.textContent === findingId,
  );
}

// Describes the focused element as text, e.g. 'button "Reject" in
// finding-FND-001', so assertions compare strings rather than DOM objects.
function describeFocus(document) {
  const element = document.activeElement;
  if (element === document.body) {
    return "body";
  }
  let card = element;
  while (card && card.className !== "finding-card") {
    card = card.parentNode;
  }
  const location = card ? ` in ${card.getAttribute("aria-labelledby")}` : "";
  return `${element.tagName.toLowerCase()} "${element.textContent}"${location}`;
}

function statusBadge(document, findingId) {
  return findFirst(findingCard(document, findingId), (element) =>
    element.classList.contains("finding-status"),
  );
}

// The status as displayed, without text that is only for assistive
// technology.
function statusOf(document, findingId) {
  return statusBadge(document, findingId)
    .childNodes.filter(
      (node) =>
        node.nodeType === 3 || !node.classList.contains("visually-hidden"),
    )
    .map((node) => node.textContent)
    .join("");
}

test("renders the incident and its events in chronological order", () => {
  const { document } = loadEvidenceFlow({
    afterData: (run) => run("incidents[0].events.reverse();"),
  });

  assert.equal(
    document.querySelector("#incident-id").textContent,
    "SSH-2026-001",
  );
  assert.equal(
    document.querySelector("#incident-title").textContent,
    "Suspicious SSH authentication activity",
  );
  assert.equal(
    document.querySelector("#incident-status").textContent,
    "Under review",
  );
  assert.deepEqual(
    document
      .querySelector("#event-list")
      .children.map(
        (item) =>
          findFirst(item, (element) => element.tagName === "H3").textContent,
      ),
    ["EVT-001", "EVT-002", "EVT-003", "EVT-004"],
  );
});

test("event fields carry the styling hooks that styles.css defines", () => {
  const { document } = loadEvidenceFlow();
  const details = findFirst(
    document.querySelector("#event-list"),
    (element) => element.tagName === "DL",
  );
  const fields = [];
  for (let index = 0; index < details.children.length; index += 2) {
    fields.push([
      details.children[index].textContent,
      details.children[index + 1].className,
    ]);
  }

  // Regression: field styles used to be attached by position
  // (dd:nth-of-type), so inserting "Source" moved the event-type highlight
  // to the wrong field and dropped the monospace style from "User".
  assert.deepEqual(fields, [
    ["Timestamp", "event-value--identifier"],
    ["Source", "event-value--identifier"],
    ["Event type", "event-value--identifier event-value--event-type"],
    ["IP address", "event-value--identifier"],
    ["User", "event-value--identifier"],
    ["Message", ""],
  ]);

  const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
  for (const className of [
    "event-value--identifier",
    "event-value--event-type",
  ]) {
    assert.match(css, new RegExp(`#event-list dd\\.${className} \\{`));
  }
  assert.doesNotMatch(
    css,
    /#event-list dd:nth-of-type/,
    "event fields should be styled by class, not by position",
  );
});

test("shows an empty state before any finding is proposed", () => {
  const { document } = loadEvidenceFlow();
  const container = findingsContainer(document);

  assert.equal(container.classList.contains("findings-empty"), true);
  assert.equal(container.textContent, "No findings yet.");
});

test("renders an agent proposal with human review controls", async () => {
  const { call, document } = loadEvidenceFlow();

  await call("propose_finding", proposal);

  const [card] = findingCards(document);
  assert.equal(findingCards(document).length, 1);
  assert.equal(
    findingsContainer(document).classList.contains("findings-empty"),
    false,
  );
  assert.equal(card.getAttribute("aria-labelledby"), "finding-FND-001");
  assert.equal(statusOf(document, "FND-001"), "pending-human-review");
  assert.deepEqual(
    findAll(card, (element) => element.tagName === "BUTTON").map(
      (button) => button.textContent,
    ),
    ["Approve", "Reject", "Need more evidence"],
  );
});

test("the status badge is announced with a 'Status:' prefix", async () => {
  const { call, document } = loadEvidenceFlow();

  await call("propose_finding", proposal);

  // Regression: the prefix used to be an aria-label on a generic <span>,
  // which ARIA does not allow and browsers ignore.
  const badge = statusBadge(document, "FND-001");
  assert.equal(badge.getAttribute("aria-label"), null);
  assert.equal(badge.textContent, "Status: pending-human-review");
  const [label] = badge.children;
  assert.equal(label.className, "visually-hidden");
  assert.equal(label.textContent, "Status: ");

  const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
  assert.match(css, /^\.visually-hidden \{/m);
});

test("agent-supplied text is rendered as text only", async () => {
  const { call, document } = loadEvidenceFlow();
  const markup = '<img src="x" onerror="alert(1)">';

  await call("propose_finding", { ...proposal, finding: markup });

  const text = findFirst(
    findingsContainer(document),
    (element) => element.className === "finding-text",
  );
  assert.equal(text.textContent, markup);
  assert.equal(text.children.length, 0);

  const source = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
  assert.doesNotMatch(
    source,
    /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
  );
});

for (const [label, status] of [
  ["Approve", "approved"],
  ["Reject", "rejected"],
  ["Need more evidence", "needs-more-evidence"],
]) {
  test(`"${label}" records the human decision and removes the controls`, async () => {
    const { call, document } = loadEvidenceFlow();
    await call("propose_finding", proposal);

    reviewButton(document, "FND-001", label).click();

    assert.equal(statusOf(document, "FND-001"), status);
    assert.equal(
      findAll(
        findingsContainer(document),
        (element) => element.tagName === "BUTTON",
      ).length,
      0,
    );
  });
}

test("a review decision keeps keyboard focus on the same finding", async () => {
  const { call, document } = loadEvidenceFlow();
  await call("propose_finding", proposal);
  const approve = reviewButton(document, "FND-001", "Approve");

  approve.focus();
  approve.click();

  // Regression: focus used to fall back to <body> because the focused button
  // is removed when the finding is re-rendered.
  assert.equal(describeFocus(document), 'h3 "FND-001" in finding-FND-001');
  assert.equal(findingHeading(document, "FND-001").tabIndex, -1);
});

test("an agent proposal does not move focus away from the reviewer", async () => {
  const { call, document } = loadEvidenceFlow();
  await call("propose_finding", proposal);
  reviewButton(document, "FND-001", "Reject").focus();

  await call("propose_finding", proposal);

  assert.equal(findingCards(document).length, 2);
  assert.equal(describeFocus(document), 'button "Reject" in finding-FND-001');
});

test("re-rendering does not take focus when it was elsewhere", async () => {
  const { call, document } = loadEvidenceFlow();

  await call("propose_finding", proposal);

  assert.equal(describeFocus(document), "body");
});
