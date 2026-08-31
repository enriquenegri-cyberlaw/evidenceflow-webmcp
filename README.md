# EvidenceFlow

EvidenceFlow is a WebMCP-powered web application for human-agent cyber incident investigation.

## Goal

The application allows a human investigator and an AI agent to examine structured incident evidence, search events, propose evidence-grounded findings, and review those findings.

## Hackathon

Built for The WebMCP Challenge 2026.

## MVP

The first version will:

- display a fictional cybersecurity incident;
- display its evidence events;
- search and filter events;
- allow an AI agent to propose findings linked to evidence;
- allow a human investigator to review findings;
- expose application capabilities to agents through WebMCP.

## Planned WebMCP tools

- `list_incidents`
- `get_events`
- `search_events`
- `propose_finding`
- `get_findings`

## Architecture

EvidenceFlow intentionally uses a small static architecture:

- HTML
- CSS
- JavaScript
- WebMCP
- fictional local data

No backend, database, authentication, or external AI API is required for the MVP.

## Status

Initial project scaffold.
