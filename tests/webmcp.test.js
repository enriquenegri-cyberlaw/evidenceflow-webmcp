"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { findAll, loadEvidenceFlow } = require("./helpers/load-app.js");

const validProposal = Object.freeze({
  incident_id: "SSH-2026-001",
  finding:
    "Two failed root logins from 203.0.113.50 were followed by a closed connection.",
  evidence_ids: ["EVT-001", "EVT-002", "EVT-003"],
  confidence: "medium",
  recommended_action:
    "Review sshd logs for further attempts from 203.0.113.50.",
});

const secondIncident = `incidents.push({
  id: "SSH-2026-002",
  title: "Second synthetic incident",
  status: "Open",
  events: [
    {
      id: "EVT-101",
      timestamp: "2026-08-31T00:00:00Z",
      source: "sshd",
      ip: "192.0.2.10",
      user: "alice",
      eventType: "failed-password",
      message: "Failed password for alice from 192.0.2.10 port 40000 ssh2",
    },
  ],
  findings: [],
});`;

test("index.html loads the data, the UI and then the WebMCP tools", () => {
  const { scripts } = loadEvidenceFlow();
  assert.deepEqual(scripts, ["data/incidents.js", "app.js", "webmcp.js"]);
});

test("registers the three documented WebMCP tools", () => {
  const { tools } = loadEvidenceFlow();

  assert.deepEqual(
    [...tools.keys()],
    ["list_incidents", "get_incident_events", "propose_finding"],
  );
  assert.equal(tools.get("list_incidents").annotations?.readOnlyHint, true);
  assert.equal(
    tools.get("get_incident_events").annotations?.readOnlyHint,
    true,
  );
  assert.notEqual(tools.get("propose_finding").annotations?.readOnlyHint, true);
});

test("the page still works without WebMCP support", () => {
  const { document, tools } = loadEvidenceFlow({ withModelContext: false });

  assert.equal(tools.size, 0);
  assert.equal(document.querySelector("#event-list").children.length, 4);
});

test("list_incidents returns only the incident summary", async () => {
  const { call } = loadEvidenceFlow();

  assert.deepEqual(await call("list_incidents", {}), [
    {
      id: "SSH-2026-001",
      title: "Suspicious SSH authentication activity",
      status: "Under review",
    },
  ]);
});

test("get_incident_events returns the events in chronological order", async () => {
  const { call } = loadEvidenceFlow({
    afterData: (run) => run("incidents[0].events.reverse();"),
  });

  const result = await call("get_incident_events", {
    incident_id: "SSH-2026-001",
  });

  assert.equal(result.incident_id, "SSH-2026-001");
  assert.deepEqual(
    result.events.map(({ id }) => id),
    ["EVT-001", "EVT-002", "EVT-003", "EVT-004"],
  );
  assert.deepEqual(Object.keys(result.events[0]), [
    "id",
    "timestamp",
    "source",
    "ip",
    "user",
    "eventType",
    "message",
  ]);
});

test("get_incident_events reports unknown incidents", async () => {
  const { call } = loadEvidenceFlow();

  assert.deepEqual(
    await call("get_incident_events", { incident_id: "SSH-2026-999" }),
    { incident_id: "SSH-2026-999", events: [], error: "Incident not found." },
  );
});

test("get_incident_events rejects invalid IDs without echoing them", async () => {
  const { call } = loadEvidenceFlow();

  for (const input of [
    { incident_id: "x".repeat(65) },
    { incident_id: 42 },
    { incident_id: null },
    { incident_id: ["SSH-2026-001"] },
    {},
  ]) {
    assert.deepEqual(await call("get_incident_events", input), {
      error: "Invalid incident ID.",
    });
  }
});

test("length limits count Unicode code points, like JSON Schema maxLength", async () => {
  const { call } = loadEvidenceFlow();
  const lock = "\u{1F512}"; // one code point, two UTF-16 code units

  const atLimit = await call("get_incident_events", {
    incident_id: lock.repeat(64),
  });
  const overLimit = await call("get_incident_events", {
    incident_id: lock.repeat(65),
  });

  assert.equal(atLimit.error, "Incident not found.");
  assert.deepEqual(overLimit, { error: "Invalid incident ID." });
});

test("propose_finding creates a pending finding and notifies the page", async () => {
  const { call, document, run } = loadEvidenceFlow();
  const notifiedIncidents = [];
  document.addEventListener("evidenceflow:findings-changed", (event) =>
    notifiedIncidents.push(event.detail.incident_id),
  );

  const result = await call("propose_finding", validProposal);

  assert.deepEqual(result, {
    id: "FND-001",
    finding: validProposal.finding,
    evidence_ids: validProposal.evidence_ids,
    confidence: "medium",
    recommended_action: validProposal.recommended_action,
    status: "pending-human-review",
  });
  assert.deepEqual(notifiedIncidents, ["SSH-2026-001"]);
  assert.equal(run("incidents[0].findings.length"), 1);
});

test("propose_finding cannot choose the status or the ID", async () => {
  const { call } = loadEvidenceFlow();

  const result = await call("propose_finding", {
    ...validProposal,
    id: "FND-999",
    status: "approved",
  });

  assert.equal(result.id, "FND-001");
  assert.equal(result.status, "pending-human-review");
});

test("propose_finding keeps its own copy of the evidence IDs", async () => {
  const { tools, run } = loadEvidenceFlow();
  const input = { ...validProposal, evidence_ids: ["EVT-001", "EVT-002"] };

  const result = await tools.get("propose_finding").execute(input, {});
  input.evidence_ids.push("EVT-003");
  result.evidence_ids.push("EVT-004");

  assert.equal(
    run("incidents[0].findings[0].evidence_ids.join()"),
    "EVT-001,EVT-002",
  );
});

test("propose_finding rejects invalid input with a constant error", async () => {
  const { call, run } = loadEvidenceFlow();
  const { finding: _omitted, ...withoutFinding } = validProposal;

  for (const input of [
    withoutFinding,
    { ...validProposal, finding: "   " },
    { ...validProposal, finding: "x".repeat(1501) },
    { ...validProposal, recommended_action: "" },
    { ...validProposal, recommended_action: "x".repeat(1501) },
    { ...validProposal, confidence: "certain" },
    { ...validProposal, evidence_ids: [] },
    { ...validProposal, evidence_ids: "EVT-001" },
    {
      ...validProposal,
      evidence_ids: Array.from({ length: 26 }, (_, index) => `EVT-${index}`),
    },
    { ...validProposal, incident_id: "x".repeat(65) },
  ]) {
    assert.deepEqual(await call("propose_finding", input), {
      error: "Invalid finding input.",
    });
  }
  assert.equal(run("incidents[0].findings.length"), 0);
});

test("propose_finding rejects duplicate or malformed evidence IDs", async () => {
  const { call, run } = loadEvidenceFlow();

  for (const evidence_ids of [
    ["EVT-001", "EVT-001"],
    ["EVT-001", 7],
    ["x".repeat(65)],
  ]) {
    assert.deepEqual(
      await call("propose_finding", { ...validProposal, evidence_ids }),
      { incident_id: "SSH-2026-001", error: "Invalid finding input." },
    );
  }
  assert.equal(run("incidents[0].findings.length"), 0);
});

test("propose_finding only accepts evidence from the same incident", async () => {
  const { call } = loadEvidenceFlow({
    afterData: (run) => run(secondIncident),
  });

  assert.deepEqual(
    await call("propose_finding", {
      ...validProposal,
      evidence_ids: ["EVT-001", "EVT-999", "EVT-101"],
    }),
    {
      incident_id: "SSH-2026-001",
      invalid_evidence_ids: ["EVT-999", "EVT-101"],
      error: "Evidence IDs do not belong to the incident.",
    },
  );
});

test("propose_finding reports unknown incidents", async () => {
  const { call } = loadEvidenceFlow();

  assert.deepEqual(
    await call("propose_finding", {
      ...validProposal,
      incident_id: "SSH-2026-999",
    }),
    { incident_id: "SSH-2026-999", error: "Incident not found." },
  );
});

test("the finding limit applies per incident and IDs keep increasing", async () => {
  const { call, document } = loadEvidenceFlow({
    afterData: (run) => run(secondIncident),
  });

  for (let number = 1; number <= 25; number += 1) {
    const { id } = await call("propose_finding", validProposal);
    assert.equal(id, `FND-${String(number).padStart(3, "0")}`);
  }

  assert.deepEqual(await call("propose_finding", validProposal), {
    incident_id: "SSH-2026-001",
    max_findings: 25,
    error: "Maximum findings per incident reached.",
  });

  const otherIncident = await call("propose_finding", {
    ...validProposal,
    incident_id: "SSH-2026-002",
    evidence_ids: ["EVT-101"],
  });
  assert.equal(otherIncident.id, "FND-026");

  // The page only shows the first incident's findings.
  const cards = findAll(
    document.querySelector("#findings"),
    (element) => element.className === "finding-card",
  );
  assert.equal(cards.length, 25);
});
