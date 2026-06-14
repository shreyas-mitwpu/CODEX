const agents = {
  inventory: {
    kicker: "Inventory Agent",
    title: "Describe your inventory",
    label: "Plain-text inventory notes",
    sample:
      "Steel rods quantity 8 threshold 12\nCopper wire has 120 units, reorder at 40\nSafety gloves stock 18 minimum 25\nMachine oil qty 55 threshold 30",
    columns: [
      ["item", "Item"],
      ["quantity", "Quantity"],
      ["threshold", "Threshold"],
      ["status", "Status"],
      ["note", "Notes"],
    ],
    statusKey: "status",
  },
  production: {
    kicker: "Production Agent",
    title: "Describe your production lines",
    label: "Plain-text production notes",
    sample:
      "Line 1 is running at 95% capacity\nLine 2 broke down yesterday\nLine 3 is idle\nLine 4 is under maintenance but can run at 30%",
    columns: [
      ["line", "Line"],
      ["status", "Status"],
      ["capacity", "Capacity %"],
      ["capacityBasis", "Capacity Basis"],
      ["note", "Timing"],
    ],
    statusKey: "status",
  },
  maintenance: {
    kicker: "Maintenance Agent",
    title: "Describe maintenance history",
    label: "Plain-text maintenance notes",
    sample:
      "Machine 1 was last serviced 60 days ago\nMachine 2 was serviced last week\nMachine 3 has never been serviced\nPump 4 was last serviced 120 days ago",
    columns: [
      ["machine", "Machine"],
      ["lastService", "Last Service"],
      ["daysSinceService", "Days Since"],
      ["riskScore", "Risk Score"],
      ["urgency", "Urgency"],
      ["recommendedServiceDate", "Service Date"],
    ],
    statusKey: "urgency",
  },
};

let activeAgent = "inventory";
let previewRows = [];

const agentKicker = document.querySelector("#agentKicker");
const agentTitle = document.querySelector("#agentTitle");
const inputLabel = document.querySelector("#inputLabel");
const textarea = document.querySelector("#agentText");
const sampleBtn = document.querySelector("#sampleBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const rowCount = document.querySelector("#rowCount");
const summaryStrip = document.querySelector("#summaryStrip");
const table = document.querySelector("#previewTable");
const resultBox = document.querySelector(".result-box");
const photoField = document.querySelector("#photoField");
const photoInput = document.querySelector("#photoInput");
const photoStatus = document.querySelector("#photoStatus");
const notice = document.querySelector("#notice");

function setAgent(agent) {
  activeAgent = agent;
  const config = agents[agent];
  agentKicker.textContent = config.kicker;
  agentTitle.textContent = config.title;
  inputLabel.textContent = config.label;
  textarea.value = "";
  photoInput.value = "";
  photoStatus.textContent = "No photo selected";
  photoField.hidden = agent !== "production";
  setNotice("");
  previewRows = [];
  document.querySelectorAll(".tab").forEach((tab) => {
    const isActive = tab.dataset.agent === agent;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  renderPreview({ rows: [], summary: {} });
}

function renderSummary(summary) {
  summaryStrip.innerHTML = "";
  Object.entries(summary || {}).forEach(([label, count]) => {
    const pill = document.createElement("span");
    pill.className = `pill ${label}`;
    pill.textContent = `${label}: ${count}`;
    summaryStrip.appendChild(pill);
  });
}

function setNotice(message, type = "") {
  notice.textContent = message;
  notice.className = `notice ${type}`.trim();
}

function formatCell(key, value, row) {
  if (value == null || value === "") return "";
  const statusKey = agents[activeAgent].statusKey;
  if (key === statusKey || key === "status" || key === "urgency") {
    return `<span class="status ${value}">${value}</span>`;
  }
  if (key === "capacity" && typeof value === "number") return `${value}%`;
  return String(value);
}

function renderPreview(result) {
  const config = agents[activeAgent];
  previewRows = result.rows || [];
  const hasData = previewRows.length > 0;
  rowCount.textContent = `${previewRows.length} ${previewRows.length === 1 ? "row" : "rows"}`;
  downloadBtn.disabled = !hasData;
  resultBox.classList.toggle("has-data", hasData);
  renderSummary(result.summary || {});

  table.querySelector("thead").innerHTML = `<tr>${config.columns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  table.querySelector("tbody").innerHTML = previewRows
    .map(
      (row) =>
        `<tr>${config.columns
          .map(([key]) => `<td>${formatCell(key, row[key], row)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
}

async function refreshPreview() {
  const text = textarea.value.trim();
  setNotice("");
  if (!text) {
    renderPreview({ rows: [], summary: {} });
    return;
  }

  const response = await fetch(`/api/${activeAgent}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, photoName: photoInput.files[0]?.name || "" }),
  });
  renderPreview(await response.json());
}

async function downloadWorkbook() {
  const text = textarea.value.trim();
  if (!text) return;

  downloadBtn.disabled = true;
  downloadBtn.textContent = "Building...";
  try {
    const response = await fetch(`/api/${activeAgent}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, photoName: photoInput.files[0]?.name || "" }),
    });
    if (!response.ok) {
      const message = await response.json().catch(() => ({ error: "Unable to build workbook." }));
      throw new Error(message.error || "Unable to build workbook.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeAgent}-agent.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Excel workbook built. Check your downloads folder.");
  } catch (error) {
    setNotice(error.message || "Unable to build workbook.", "error");
  } finally {
    downloadBtn.textContent = "Download Excel";
    downloadBtn.disabled = previewRows.length === 0;
  }
}

let previewTimer = 0;
textarea.addEventListener("input", () => {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 180);
});

sampleBtn.addEventListener("click", () => {
  textarea.value = agents[activeAgent].sample;
  refreshPreview();
});

downloadBtn.addEventListener("click", downloadWorkbook);

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  photoStatus.textContent = file ? `Selected: ${file.name}` : "No photo selected";
  if (activeAgent === "production" && textarea.value.trim()) refreshPreview();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setAgent(tab.dataset.agent));
});

setAgent(activeAgent);
