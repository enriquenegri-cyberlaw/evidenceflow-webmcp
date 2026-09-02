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
    ["Source", event.source],
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

const findingsContainer = document.querySelector("#findings");
const findingReviewActions = [
  {
    label: "Approve",
    status: "approved",
    className: "review-button--approve",
  },
  {
    label: "Reject",
    status: "rejected",
    className: "review-button--reject",
  },
  {
    label: "Need more evidence",
    status: "needs-more-evidence",
    className: "review-button--more-evidence",
  },
];

function appendFindingDetail(details, label, value, className) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.append(value);

  if (className) {
    description.classList.add(className);
  }

  details.append(term, description);
}

function renderFindings() {
  findingsContainer.replaceChildren();
  findingsContainer.classList.toggle(
    "findings-empty",
    incident.findings.length === 0,
  );

  if (incident.findings.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No findings yet.";
    findingsContainer.append(emptyMessage);
    return;
  }

  for (const finding of incident.findings) {
    const card = document.createElement("article");
    const cardHeader = document.createElement("header");
    const findingHeading = document.createElement("h3");
    const statusBadge = document.createElement("span");
    const findingText = document.createElement("p");
    const details = document.createElement("dl");
    const evidenceList = document.createElement("ul");
    const confidenceBadge = document.createElement("span");

    card.className = "finding-card";
    findingHeading.id = `finding-${finding.id}`;
    findingHeading.textContent = finding.id;
    card.setAttribute("aria-labelledby", findingHeading.id);

    statusBadge.className = `finding-status finding-status--${finding.status}`;
    statusBadge.textContent = finding.status;
    statusBadge.setAttribute("aria-label", `Status: ${finding.status}`);
    cardHeader.append(findingHeading, statusBadge);

    findingText.className = "finding-text";
    findingText.textContent = finding.finding;

    details.className = "finding-details";
    evidenceList.className = "finding-evidence-list";

    for (const evidenceId of finding.evidence_ids) {
      const evidenceItem = document.createElement("li");
      const evidenceCode = document.createElement("code");
      evidenceCode.textContent = evidenceId;
      evidenceItem.append(evidenceCode);
      evidenceList.append(evidenceItem);
    }

    confidenceBadge.className =
      `finding-confidence finding-confidence--${finding.confidence}`;
    confidenceBadge.textContent = finding.confidence;

    appendFindingDetail(
      details,
      "Evidence IDs",
      evidenceList,
      "finding-evidence",
    );
    appendFindingDetail(
      details,
      "Confidence",
      confidenceBadge,
      "finding-confidence-value",
    );
    appendFindingDetail(
      details,
      "Recommended action",
      finding.recommended_action,
      "finding-recommended-action",
    );

    card.append(cardHeader, findingText, details);

    if (finding.status === "pending-human-review") {
      const reviewControls = document.createElement("div");
      reviewControls.className = "review-controls";
      reviewControls.setAttribute("role", "group");
      reviewControls.setAttribute(
        "aria-label",
        `Human review decisions for ${finding.id}`,
      );

      for (const action of findingReviewActions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `review-button ${action.className}`;
        button.textContent = action.label;
        button.addEventListener("click", () => {
          finding.status = action.status;
          renderFindings();
        });
        reviewControls.append(button);
      }

      card.append(reviewControls);
    }

    findingsContainer.append(card);
  }
}

document.addEventListener("evidenceflow:findings-changed", (event) => {
  if (event.detail?.incident_id === incident.id) {
    renderFindings();
  }
});

renderFindings();
