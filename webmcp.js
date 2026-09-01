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
}
