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
}
