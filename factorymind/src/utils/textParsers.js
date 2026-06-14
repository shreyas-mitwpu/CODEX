const AGENT_TITLES = {
  inventory: "Inventory Agent",
  production: "Production Agent",
  maintenance: "Maintenance Agent",
};

function splitEntries(text) {
  return text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
}

function asNumber(str) {
  if (!str) return null;
  const val = Number(str.replace(/,/g, ""));
  return Number.isNaN(val) ? null : val;
}

function cleanName(str, fallback) {
  const cleaned = str.replace(/^[-*•\s]+/, "").trim();
  return cleaned || fallback;
}

function inventoryStatus(qty, threshold) {
  if (qty == null) return "Review";
  if (threshold == null) return "OK";
  if (qty <= threshold) return "Critical";
  if (qty <= threshold * 1.5) return "Low";
  return "OK";
}

function parseInventory(text) {
  const entries = splitEntries(text);
  const rows = entries.map((entry, index) => {
    const lower = entry.toLowerCase();
    const thresholdMatch =
      lower.match(/(?:threshold|reorder(?: point)?|minimum|min|below|critical below|low below)\D{0,12}(\d+(?:[,.]\d+)?)/i) ||
      lower.match(/(\d+(?:[,.]\d+)?)\s*(?:threshold|reorder|minimum|min)/i);
    const quantityMatch =
      lower.match(/(?:qty|quantity|stock|current|on hand|have|has|is|are)\D{0,12}(\d+(?:[,.]\d+)?)/i) ||
      lower.match(/(\d+(?:[,.]\d+)?)/i);
    const quantity = asNumber(quantityMatch?.[1]);
    const threshold = asNumber(thresholdMatch?.[1]);
    const nameChunk = entry.split(/(?:qty|quantity|stock|current|on hand|threshold|reorder|minimum|min|below|critical|low|has|have|is|are)\b/i)[0];
    const item = cleanName(nameChunk || entry, `Item ${index + 1}`);

    return {
      item,
      quantity,
      threshold,
      status: inventoryStatus(quantity, threshold),
      note: threshold == null ? "No threshold found in text" : "",
      source: entry.replace(/\n/g, " "),
    };
  });
  return {
    agent: "inventory",
    title: AGENT_TITLES.inventory,
    summary: summarize(rows, "status"),
    rows,
  };
}

function inferCapacity(status) {
  switch (status) {
    case "Running": return 100;
    case "Idle": return 0;
    case "Down": return 0;
    default: return 50;
  }
}

function parseProduction(text, context) {
  const entries = splitEntries(text);
  const rows = entries.map((entry, index) => {
    const lower = entry.toLowerCase();
    let status = "Review";
    if (/running|active|operating|normal/.test(lower)) status = "Running";
    else if (/down|broken|stopped|halted|failed|error/.test(lower)) status = "Down";
    else if (/idle|waiting|standby|paused/.test(lower)) status = "Idle";

    const capMatch = lower.match(/(\d+(?:[,.]\d+)?)\s*%/);
    let capacity = asNumber(capMatch?.[1]);
    let capacityBasis = capacity != null ? "Explicit in text" : "Inferred from status";
    if (capacity == null) capacity = inferCapacity(status);

    let note = "";
    if (status === "Down") {
      const hoursMatch = lower.match(/(\d+(?:[,.]\d+)?)\s*(?:hours?|hrs?|mins?|minutes?|days?)/i);
      note = hoursMatch ? `Est. downtime: ${hoursMatch[0]}` : "Requires inspection";
    }

    const nameChunk = entry.split(/(?:running|down|idle|capacity|is|are|status|operating)/i)[0];
    const line = cleanName(nameChunk || entry, `Line ${index + 1}`);

    return {
      line,
      status,
      capacity,
      capacityBasis,
      note,
      source: entry.replace(/\n/g, " "),
    };
  });
  return {
    agent: "production",
    title: AGENT_TITLES.production,
    summary: summarize(rows, "status"),
    rows,
    meta: context,
  };
}

function parseMaintenance(text) {
  const entries = splitEntries(text);
  const rows = entries.map((entry, index) => {
    const lower = entry.toLowerCase();
    const serviceMatch = lower.match(/(?:last service|serviced|maintained|checked)\D{0,15}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|yesterday|today|never)/i);
    let lastService = serviceMatch ? serviceMatch[1] : "Unknown";
    if (lastService.toLowerCase() === "never") lastService = "Never";

    let daysSinceService = 90;
    if (lastService !== "Never" && lastService !== "Unknown" && !Number.isNaN(Date.parse(lastService))) {
      daysSinceService = Math.floor((new Date() - new Date(lastService)) / (1000 * 60 * 60 * 24));
    } else if (lastService === "Never") {
      daysSinceService = 999;
    }

    const riskScore = Math.min(100, Math.floor((daysSinceService / 90) * 100));
    let urgency = "Low";
    if (riskScore >= 90) urgency = "Critical";
    else if (riskScore >= 70) urgency = "High";
    else if (riskScore >= 40) urgency = "Medium";

    let recommendation = "Routine check soon";
    if (urgency === "Critical") recommendation = "Immediate service required";
    else if (urgency === "High") recommendation = "Schedule service this week";

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (urgency === "Critical" ? 1 : urgency === "High" ? 7 : 30));

    const nameChunk = entry.split(/(?:last service|serviced|maintained|checked|risk|urgency|is|are)/i)[0];
    const machine = cleanName(nameChunk || entry, `Machine ${index + 1}`);

    return {
      machine,
      lastService,
      daysSinceService,
      riskScore,
      urgency,
      recommendedServiceDate: nextDate.toISOString().slice(0, 10),
      recommendation,
      source: entry.replace(/\n/g, " "),
    };
  });
  return {
    agent: "maintenance",
    title: AGENT_TITLES.maintenance,
    summary: summarize(rows, "urgency"),
    rows,
  };
}

function summarize(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || "Review";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function parseAgentText(agent, text, context = {}) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return {
      agent,
      title: AGENT_TITLES[agent] || "Agent",
      summary: {},
      rows: [],
      error: "Add a plain-text description to parse.",
    };
  }

  if (agent === "inventory") return parseInventory(normalized);
  if (agent === "production") return parseProduction(normalized, context);
  if (agent === "maintenance") return parseMaintenance(normalized);
  throw new Error(`Unknown agent: ${agent}`);
}
