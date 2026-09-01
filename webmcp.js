const modelContext = document.modelContext;

if (typeof modelContext?.registerTool === "function") {
  modelContext
    .registerTool({
      name: "list_incidents",
      description:
        "Lists the cybersecurity incidents available in EvidenceFlow.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute() {
        return incidents.map(({ id, title, status }) => ({ id, title, status }));
      },
    })
    .catch((error) => {
      console.warn("Could not register list_incidents WebMCP tool.", error);
    });

  modelContext
    .registerTool({
      name: "get_incident_events",
      description:
        "Returns the evidence events for a specific EvidenceFlow cybersecurity incident.",
      inputSchema: {
        type: "object",
        properties: {
          incident_id: { type: "string" },
        },
        required: ["incident_id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute({ incident_id }) {
        const incident = incidents.find(({ id }) => id === incident_id);

        if (!incident) {
          return {
            incident_id,
            events: [],
            error: "Incident not found.",
          };
        }

        const events = [...incident.events]
          .sort(
            (firstEvent, secondEvent) =>
              new Date(firstEvent.timestamp) - new Date(secondEvent.timestamp),
          )
          .map(({ id, timestamp, source, ip, user, eventType, message }) => ({
            id,
            timestamp,
            source,
            ip,
            user,
            eventType,
            message,
          }));

        return { incident_id, events };
      },
    })
    .catch((error) => {
      console.warn(
        "Could not register get_incident_events WebMCP tool.",
        error,
      );
    });

  modelContext
    .registerTool({
      name: "propose_finding",
      description:
        "Proposes an evidence-derived finding for human review in EvidenceFlow. The recommended action is advisory; the agent cannot approve or reject the finding.",
      inputSchema: {
        type: "object",
        properties: {
          incident_id: { type: "string" },
          finding: { type: "string", minLength: 1 },
          evidence_ids: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            uniqueItems: true,
          },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          recommended_action: { type: "string", minLength: 1 },
        },
        required: [
          "incident_id",
          "finding",
          "evidence_ids",
          "confidence",
          "recommended_action",
        ],
        additionalProperties: false,
      },
      execute({
        incident_id,
        finding,
        evidence_ids,
        confidence,
        recommended_action,
      }) {
        const incident = incidents.find(({ id }) => id === incident_id);

        if (!incident) {
          return {
            incident_id,
            error: "Incident not found.",
          };
        }

        const inputIsValid =
          typeof finding === "string" &&
          finding.trim().length > 0 &&
          Array.isArray(evidence_ids) &&
          evidence_ids.length > 0 &&
          evidence_ids.every((evidenceId) => typeof evidenceId === "string") &&
          new Set(evidence_ids).size === evidence_ids.length &&
          ["low", "medium", "high"].includes(confidence) &&
          typeof recommended_action === "string" &&
          recommended_action.trim().length > 0;

        if (!inputIsValid) {
          return {
            incident_id,
            error: "Invalid finding input.",
          };
        }

        const incidentEvidenceIds = new Set(
          incident.events.map(({ id }) => id),
        );
        const invalidEvidenceIds = evidence_ids.filter(
          (evidenceId) => !incidentEvidenceIds.has(evidenceId),
        );

        if (invalidEvidenceIds.length > 0) {
          return {
            incident_id,
            invalid_evidence_ids: invalidEvidenceIds,
            error: "Evidence IDs do not belong to the incident.",
          };
        }

        const highestFindingNumber = incidents
          .flatMap(({ findings }) => findings)
          .reduce((highestNumber, existingFinding) => {
            const idMatch = /^FND-(\d+)$/.exec(existingFinding.id);
            return idMatch
              ? Math.max(highestNumber, Number(idMatch[1]))
              : highestNumber;
          }, 0);
        const findingId = `FND-${String(highestFindingNumber + 1).padStart(
          3,
          "0",
        )}`;
        const newFinding = {
          id: findingId,
          finding,
          evidence_ids: [...evidence_ids],
          confidence,
          recommended_action,
          status: "pending-human-review",
        };

        incident.findings.push(newFinding);
        document.dispatchEvent(
          new CustomEvent("evidenceflow:findings-changed", {
            detail: { incident_id },
          }),
        );

        return newFinding;
      },
    })
    .catch((error) => {
      console.warn("Could not register propose_finding WebMCP tool.", error);
    });
}
