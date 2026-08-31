const incident = incidents[0];

document.querySelector("#incident-id").textContent = incident.id;
document.querySelector("#incident-title").textContent = incident.title;
document.querySelector("#incident-status").textContent = incident.status;

const eventList = document.querySelector("#event-list");
const chronologicalEvents = [...incident.events].sort(
  (firstEvent, secondEvent) =>
    new Date(firstEvent.timestamp) - new Date(secondEvent.timestamp),
);

for (const event of chronologicalEvents) {
  const listItem = document.createElement("li");
  const eventArticle = document.createElement("article");
  const eventHeading = document.createElement("h3");
  const details = document.createElement("dl");

  eventHeading.textContent = event.id;

  const displayedFields = [
    ["Timestamp", event.timestamp],
    ["Event type", event.eventType],
    ["IP address", event.ip],
    ["User", event.user],
    ["Message", event.message],
  ];

  for (const [label, value] of displayedFields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value;
    details.append(term, description);
  }

  eventArticle.append(eventHeading, details);
  listItem.append(eventArticle);
  eventList.append(listItem);
}

if (incident.findings.length === 0) {
  const emptyMessage = document.createElement("p");
  emptyMessage.textContent = "No findings yet.";
  document.querySelector("#findings").append(emptyMessage);
}
