# EvidenceFlow

EvidenceFlow is a WebMCP-powered cybersecurity investigation prototype that lets AI agents inspect structured incident evidence and propose evidence-grounded findings while keeping review decisions outside the WebMCP tool surface.

Built for **The WebMCP Challenge 2026**.

## Live Demo

https://enriquenegri-cyberlaw.github.io/evidenceflow-webmcp/

## Why EvidenceFlow

Security teams already work with evidence from systems such as SIEM platforms, EDR tools, authentication logs, firewalls, and cloud services.

AI agents can help investigators examine that evidence, identify relevant patterns, and propose conclusions. But an agent-generated conclusion should not automatically become a validated security finding.

EvidenceFlow explores a workflow where:

1. evidence is presented as structured incident data;
2. an AI agent accesses that evidence through WebMCP;
3. the agent proposes a finding tied to specific evidence IDs;
4. the proposal is created as `pending-human-review`;
5. a human investigator can approve, reject, or request more evidence through the application UI.

This separates observed evidence from agent-generated conclusions and preserves traceability between findings and the events that support them.

## WebMCP Workflow

EvidenceFlow exposes three browser-native WebMCP tools through `document.modelContext`.

### `list_incidents`

Returns the incidents currently available for investigation.

This is the discovery step of the agent workflow.

### `get_incident_events`

Accepts an `incident_id` and returns the corresponding evidence events in chronological order.

Each event exposes:

- event ID
- timestamp
- source
- IP address
- user
- event type
- message

Event fields are treated as untrusted evidence data, not as instructions to the agent.

### `propose_finding`

Allows an agent to propose an evidence-grounded finding.

A proposal includes:

- incident ID
- finding text
- cited evidence IDs
- confidence level
- recommended action

Every new finding is created with:

`pending-human-review`

EvidenceFlow exposes no WebMCP tool for approving or rejecting findings. Review decisions remain outside the WebMCP agent interface and are presented as human review controls in the application.

## Human-in-the-Loop Review

After an agent proposes a finding, the human investigator can:

- Approve
- Reject
- Need more evidence

These actions update the finding status in the browser interface.

The current prototype stores this state only in memory. It does not include authenticated reviewer identities, persistent storage, or backend authorization.

## Demo Incident

The current MVP contains one synthetic SSH authentication incident:

`SSH-2026-001 — Suspicious SSH authentication activity`

The dataset includes:

- two failed password attempts against `root`;
- a subsequent SSH connection closure from the same source;
- a separate successful public-key authentication for another user.

All IP addresses and incident data used by the prototype are synthetic or reserved for documentation purposes.

## Security and Trust Boundaries

EvidenceFlow treats both security evidence and agent-generated proposals as untrusted data.

The current WebMCP implementation includes:

- bounded input lengths;
- bounded evidence ID arrays;
- validation of cited evidence IDs;
- duplicate evidence ID rejection;
- a per-session finding limit;
- constant error responses for oversized invalid identifiers;
- text-only DOM rendering for evidence fields;
- defensive copies of returned finding data.

Agent-generated findings cannot enter an approved state through `propose_finding`; they always begin as `pending-human-review`.

The prototype contains no real credentials, secrets, production logs, or external security-system data.

## Current Architecture

The MVP intentionally uses a small static architecture:

- HTML
- CSS
- JavaScript
- browser-native WebMCP
- synthetic local incident data
- GitHub Pages

There is currently:

- no backend;
- no database;
- no authentication system;
- no external AI API;
- no live SIEM or EDR integration.

## Future Architecture

A production-oriented version could place EvidenceFlow between existing security telemetry systems and AI-assisted investigation workflows:

```text
SIEM / EDR / IDS / Firewall / Authentication / Cloud Logs
                         ↓
              ingestion + normalization
                         ↓
                   EvidenceFlow
                         ↓
                       WebMCP
                         ↓
                     AI agent
                         ↓
            proposed evidence-grounded finding
                         ↓
                 human investigator
```

WebMCP would remain the controlled interface through which an agent interacts with normalized investigation data. It would not replace the systems responsible for collecting security telemetry.

Future versions could add authenticated backends, persistent audit trails, reviewer identity and authorization, incident ingestion pipelines, and integrations with real security platforms.

## Why WebMCP

EvidenceFlow is a strong fit for WebMCP because the agent does not need unrestricted access to the page or an external API designed specifically for AI.

Instead, the application exposes a small set of explicit capabilities:

- discover incidents;
- retrieve structured evidence;
- propose a traceable finding.

The browser becomes the interaction boundary between the application and the agent.

This makes the workflow easier to understand, test, and constrain than giving an agent broad access to application internals.

## Testing

The current MVP has been tested with:

- Chrome WebMCP support enabled;
- the WebMCP Model Context Tool Inspector;
- the public GitHub Pages deployment;
- an agent-driven workflow that successfully used the three registered WebMCP tools.

Validated behaviors include:

- incident discovery;
- chronological evidence retrieval;
- evidence-grounded finding creation;
- mandatory `pending-human-review` status;
- human review controls;
- oversized-input rejection;
- evidence-reference validation.

Some agent clients may differ in how they serialize tool arguments. The EvidenceFlow tools themselves use standard WebMCP registrations and have been validated directly through Chrome and the WebMCP Inspector.

## Design Perspective

My background is in law and digital law rather than software engineering.

That influenced the design of EvidenceFlow: I wanted the system to distinguish observed evidence from agent-generated conclusions, preserve traceability to the underlying events, and keep validation as a distinct human-review step outside the WebMCP tool surface.

The project explores how WebMCP can support not only agent capability, but also accountability and controlled human oversight.

## Tech Stack

- HTML
- CSS
- JavaScript
- WebMCP
- Git
- GitHub
- GitHub Pages

## Repository Status

The current hackathon MVP is feature-frozen.

The application uses only synthetic evidence and is intended as a demonstration of the WebMCP investigation workflow, not as a production security platform.

## License

See the repository license for usage terms.
