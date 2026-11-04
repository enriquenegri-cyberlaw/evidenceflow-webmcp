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

  // Field styles are attached by class rather than by position, so adding or
  // reordering fields cannot move a style to the wrong field.
  const displayedFields = [
    ["Timestamp", event.timestamp, "event-value--identifier"],
    ["Source", event.source, "event-value--identifier"],
    [
      "Event type",
      event.eventType,
      "event-value--identifier event-value--event-type",
    ],
    ["IP address", event.ip, "event-value--identifier"],
    ["User", event.user, "event-value--identifier"],
    ["Message", event.message],
  ];

  for (const [label, value, className] of displayedFields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value;

    if (className) {
      description.className = className;
    }

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
  // Re-rendering replaces every finding control. Remember which one had
  // focus so that it can be restored, instead of focus falling back to the
  // page after a review decision or a new agent proposal.
  const focusedElement = document.activeElement;
  const previousFocus =
    focusedElement && findingsContainer.contains(focusedElement)
      ? {
          findingId: focusedElement.getAttribute("data-finding-id"),
          reviewStatus: focusedElement.getAttribute("data-review-status"),
        }
      : null;
  const focusTargets = new Map();

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
    findingHeading.tabIndex = -1;
    findingHeading.dataset.findingId = finding.id;
    focusTargets.set(`heading:${finding.id}`, findingHeading);
    card.setAttribute("aria-labelledby", findingHeading.id);

    // aria-label is not allowed on a generic <span> and browsers ignore it
    // there, so the "Status:" prefix is visually hidden text instead.
    const statusLabel = document.createElement("span");
    statusLabel.className = "visually-hidden";
    statusLabel.textContent = "Status: ";
    statusBadge.className = `finding-status finding-status--${finding.status}`;
    statusBadge.append(statusLabel, finding.status);
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
        button.dataset.findingId = finding.id;
        button.dataset.reviewStatus = action.status;
        button.addEventListener("click", () => {
          finding.status = action.status;
          renderFindings();
        });
        focusTargets.set(`button:${finding.id}:${action.status}`, button);
        reviewControls.append(button);
      }

      card.append(reviewControls);
    }

    findingsContainer.append(card);
  }

  if (previousFocus?.findingId) {
    // Same review button if the finding is still pending, otherwise the
    // finding's heading (its buttons are gone once a decision is made).
    const focusTarget =
      focusTargets.get(
        `button:${previousFocus.findingId}:${previousFocus.reviewStatus}`,
      ) ?? focusTargets.get(`heading:${previousFocus.findingId}`);
    focusTarget?.focus();
  }
}

document.addEventListener("evidenceflow:findings-changed", (event) => {
  if (event.detail?.incident_id === incident.id) {
    renderFindings();
  }
});

renderFindings();
