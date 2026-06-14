import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const AGENT_TITLES = {
  inventory: "Inventory Agent",
  production: "Production Agent",
  maintenance: "Maintenance Agent",
};

const palette = {
  ink: "#17202A",
  slate: "#4B5563",
  line: "#D7DEE8",
  blue: "#1E5AA8",
  blueSoft: "#D9EAFB",
  green: "#15803D",
  greenSoft: "#DFF5E4",
  amber: "#B7791F",
  amberSoft: "#FFF2CC",
  red: "#B91C1C",
  redSoft: "#FDE2E1",
  graySoft: "#F3F6FA",
};

function titleCase(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitEntries(text) {
  return text
    .replace(/\r/g, "\n")
    .split(/\n|;|,(?=\s*(?:line|machine|item|\w+\s+(?:has|have|is|was|\d)))/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanName(value, fallback) {
  const cleaned = value
    .replace(/\b(qty|quantity|stock|current|on hand|threshold|reorder|minimum|min|below|critical|low|level|units?|pieces?|pcs?)\b/gi, " ")
    .replace(/\b(is|are|has|have|with|at|of|left|remaining|available|about|around)\b/gi, " ")
    .replace(/\d+[,.]?\d*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(cleaned || fallback);
}

function inventoryStatus(quantity, threshold) {
  if (quantity == null) return "Review";
  if (threshold == null || threshold <= 0) return "OK";
  if (quantity <= threshold) return "Critical";
  if (quantity <= threshold * 1.5) return "Low";
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
      source: entry,
    };
  });

  return {
    agent: "inventory",
    title: AGENT_TITLES.inventory,
    summary: summarize(rows, "status"),
    rows,
  };
}

function parseProductionStatus(entry) {
  const lower = entry.toLowerCase();
  if (/(broke|broken|breakdown|down|failed|fault|stopped|offline)/.test(lower)) return "Down";
  if (/(idle|waiting|standby|paused)/.test(lower)) return "Idle";
  if (/(maintenance|servic|repair)/.test(lower)) return "Maintenance";
  if (/(running|active|operating|online|producing)/.test(lower)) return "Running";
  return "Review";
}

function defaultCapacity(status) {
  return { Running: 100, Idle: 0, Down: 0, Maintenance: 25, Review: null }[status] ?? null;
}

function parseProduction(text, context = {}) {
  const entries = splitEntries(text);
  const rows = entries.map((entry, index) => {
    const lineMatch = entry.match(/\b(line|machine|cell|station)\s*([A-Za-z0-9-]+)/i);
    const status = parseProductionStatus(entry);
    const percentMatch = entry.match(/(\d+(?:[,.]\d+)?)\s*%/);
    const rateMatch = entry.match(/(\d+(?:[,.]\d+)?)\s*(?:units|pcs|pieces|batches)\s*(?:\/|per)?\s*(?:hour|hr|day|shift)?/i);
    const capacity = asNumber(percentMatch?.[1]) ?? defaultCapacity(status);
    const line = lineMatch ? `${titleCase(lineMatch[1])} ${lineMatch[2]}` : `Line ${index + 1}`;
    const capacityBasis = percentMatch ? "Text % capacity" : rateMatch ? `${rateMatch[1]} units noted` : "Estimated from status";

    return {
      line,
      status,
      capacity,
      capacityBasis,
      note: /yesterday|today|last|ago/i.test(entry) ? entry.match(/(?:yesterday|today|last\s+\w+|\d+\s+\w+\s+ago)/i)?.[0] ?? "" : "",
      source: entry,
    };
  });

  return {
    agent: "production",
    title: AGENT_TITLES.production,
    meta: {
      photoName: context.photoName || "",
    },
    summary: summarize(rows, "status"),
    rows,
  };
}

function daysAgoFromText(entry) {
  const lower = entry.toLowerCase();
  if (/\bnever\b/.test(lower)) return null;
  if (/\byesterday\b/.test(lower)) return 1;
  if (/\btoday\b/.test(lower)) return 0;
  if (/\blast week\b/.test(lower)) return 7;
  if (/\blast month\b/.test(lower)) return 30;

  const match = lower.match(/(\d+(?:[,.]\d+)?)\s*(day|days|week|weeks|month|months|year|years)\s+ago/);
  if (!match) return null;
  const amount = asNumber(match[1]) ?? 0;
  const unit = match[2];
  if (unit.startsWith("week")) return amount * 7;
  if (unit.startsWith("month")) return amount * 30;
  if (unit.startsWith("year")) return amount * 365;
  return amount;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDate(date) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function maintenanceRisk(daysAgo) {
  if (daysAgo == null) return { score: 100, urgency: "Critical", recommendation: "Inspect immediately" };
  if (daysAgo >= 90) return { score: 90, urgency: "Critical", recommendation: "Service now" };
  if (daysAgo >= 60) return { score: 75, urgency: "High", recommendation: "Schedule this week" };
  if (daysAgo >= 30) return { score: 50, urgency: "Medium", recommendation: "Schedule within 30 days" };
  return { score: 20, urgency: "Low", recommendation: "No immediate action" };
}

function parseMaintenance(text) {
  const entries = splitEntries(text);
  const rows = entries.map((entry, index) => {
    const machineMatch = entry.match(/\b(machine|line|asset|press|pump|motor)\s*([A-Za-z0-9-]+)/i);
    const machine = machineMatch ? `${titleCase(machineMatch[1])} ${machineMatch[2]}` : `Machine ${index + 1}`;
    const daysAgo = daysAgoFromText(entry);
    const lastServiceDate = daysAgo == null ? null : addDays(TODAY, -daysAgo);
    const dueDate = lastServiceDate ? addDays(lastServiceDate, 90) : TODAY;
    const risk = maintenanceRisk(daysAgo);

    return {
      machine,
      lastService: lastServiceDate ? isoDate(lastServiceDate) : "Never recorded",
      daysSinceService: daysAgo,
      riskScore: risk.score,
      urgency: risk.urgency,
      recommendedServiceDate: isoDate(dueDate < TODAY ? TODAY : dueDate),
      recommendation: risk.recommendation,
      source: entry,
    };
  });

  return {
    agent: "maintenance",
    title: AGENT_TITLES.maintenance,
    summary: summarize(rows, "urgency"),
    rows: rows.sort((a, b) => b.riskScore - a.riskScore),
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

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getCell(0, index).format.columnWidthPx = width;
  });
}

function styleTable(sheet, rangeAddress, headerAddress, statusColumnAddress) {
  sheet.showGridLines = false;
  sheet.getRange(headerAddress).format = {
    fill: palette.blue,
    font: { bold: true, color: "#FFFFFF" },
    alignment: { horizontal: "center" },
  };
  sheet.getRange(rangeAddress).format.borders = { preset: "all", style: "thin", color: palette.line };
  sheet.getRange(rangeAddress).format.wrapText = true;
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Critical",
    format: { fill: palette.redSoft, font: { bold: true, color: palette.red } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "High",
    format: { fill: palette.redSoft, font: { bold: true, color: palette.red } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Low",
    format: { fill: palette.amberSoft, font: { bold: true, color: palette.amber } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Medium",
    format: { fill: palette.amberSoft, font: { bold: true, color: palette.amber } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "OK",
    format: { fill: palette.greenSoft, font: { bold: true, color: palette.green } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Running",
    format: { fill: palette.greenSoft, font: { bold: true, color: palette.green } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Down",
    format: { fill: palette.redSoft, font: { bold: true, color: palette.red } },
  });
  sheet.getRange(statusColumnAddress).conditionalFormats.add("containsText", {
    text: "Idle",
    format: { fill: palette.amberSoft, font: { bold: true, color: palette.amber } },
  });
}

function writeTitle(sheet, title, subtitle) {
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = {
    font: { bold: true, size: 18, color: palette.ink },
    fill: palette.blueSoft,
  };
  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = {
    font: { color: palette.slate },
    fill: palette.graySoft,
  };
}

function writeSummary(sheet, summary) {
  const entries = Object.entries(summary);
  sheet.getRange("A4:B4").values = [["Status", "Count"]];
  sheet.getRange("A4:B4").format = {
    fill: palette.ink,
    font: { bold: true, color: "#FFFFFF" },
  };
  if (entries.length) {
    sheet.getRangeByIndexes(4, 0, entries.length, 2).values = entries.map(([key, count]) => [key, count]);
    sheet.getRangeByIndexes(4, 0, entries.length, 2).format.borders = { preset: "all", style: "thin", color: palette.line };
  }
}

function buildInventoryWorkbook(workbook, result) {
  const sheet = workbook.worksheets.add("Inventory");
  writeTitle(sheet, "Inventory Status Sheet", "Parsed from plain text. Edit quantities or thresholds, and Excel will keep the status formula current.");
  writeSummary(sheet, result.summary);

  const headers = ["Item", "Quantity", "Threshold", "Status", "Notes", "Original Text"];
  const rows = result.rows.map((row) => [row.item, row.quantity, row.threshold, row.status, row.note, row.source]);
  sheet.getRange("A8:F8").values = [headers];
  if (rows.length) sheet.getRangeByIndexes(8, 0, rows.length, headers.length).values = rows;
  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 9;
    sheet.getRange(`D${rowNum}`).formulas = [[`=IF(B${rowNum}="","Review",IF(C${rowNum}="", "OK", IF(B${rowNum}<=C${rowNum},"Critical",IF(B${rowNum}<=C${rowNum}*1.5,"Low","OK"))))`]];
  }
  styleTable(sheet, `A8:F${Math.max(9, rows.length + 8)}`, "A8:F8", `D9:D${Math.max(9, rows.length + 8)}`);
  setColumnWidths(sheet, [210, 95, 100, 115, 190, 420]);
  sheet.freezePanes.freezeRows(8);
}

function buildProductionWorkbook(workbook, result) {
  const sheet = workbook.worksheets.add("Production");
  const photoNote = result.meta?.photoName ? ` Optional photo attached: ${result.meta.photoName}.` : "";
  writeTitle(sheet, "Production Status Sheet", `Parsed from line descriptions with estimated capacity where explicit capacity was not provided.${photoNote}`);
  writeSummary(sheet, result.summary);

  const headers = ["Line", "Status", "Capacity %", "Capacity Basis", "Timing Note", "Original Text"];
  const rows = result.rows.map((row) => [row.line, row.status, row.capacity, row.capacityBasis, row.note, row.source]);
  sheet.getRange("A8:F8").values = [headers];
  if (rows.length) sheet.getRangeByIndexes(8, 0, rows.length, headers.length).values = rows;
  styleTable(sheet, `A8:F${Math.max(9, rows.length + 8)}`, "A8:F8", `B9:B${Math.max(9, rows.length + 8)}`);
  sheet.getRange(`C9:C${Math.max(9, rows.length + 8)}`).format.numberFormat = "0";
  setColumnWidths(sheet, [120, 120, 105, 170, 145, 430]);
  sheet.freezePanes.freezeRows(8);
}

function buildMaintenanceWorkbook(workbook, result) {
  const sheet = workbook.worksheets.add("Maintenance");
  writeTitle(sheet, "Maintenance Priority Sheet", "Risk uses a 90-day default service interval and ranks never-serviced assets first.");
  writeSummary(sheet, result.summary);

  const headers = ["Machine", "Last Service", "Days Since Service", "Risk Score", "Urgency", "Recommended Service Date", "Recommendation", "Original Text"];
  const rows = result.rows.map((row) => [
    row.machine,
    row.lastService,
    row.daysSinceService,
    row.riskScore,
    row.urgency,
    row.recommendedServiceDate,
    row.recommendation,
    row.source,
  ]);
  sheet.getRange("A8:H8").values = [headers];
  if (rows.length) sheet.getRangeByIndexes(8, 0, rows.length, headers.length).values = rows;
  styleTable(sheet, `A8:H${Math.max(9, rows.length + 8)}`, "A8:H8", `E9:E${Math.max(9, rows.length + 8)}`);
  sheet.getRange(`D9:D${Math.max(9, rows.length + 8)}`).conditionalFormats.add("colorScale", {
    thresholds: ["min", "50%", "max"],
    colors: [palette.greenSoft, palette.amberSoft, palette.redSoft],
  });
  setColumnWidths(sheet, [130, 125, 140, 95, 105, 170, 205, 390]);
  sheet.freezePanes.freezeRows(8);
}

export async function buildWorkbook(agent, text, context = {}) {
  const result = parseAgentText(agent, text, context);
  const workbook = Workbook.create();
  if (agent === "inventory") buildInventoryWorkbook(workbook, result);
  if (agent === "production") buildProductionWorkbook(workbook, result);
  if (agent === "maintenance") buildMaintenanceWorkbook(workbook, result);

  const scan = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 20 },
    summary: "formula error scan",
  });
  if (scan.ndjson.includes("#")) {
    throw new Error("Workbook validation found a formula error.");
  }

  const file = await SpreadsheetFile.exportXlsx(workbook);
  const tempPath = path.join(os.tmpdir(), `factory-agent-${agent}-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  await file.save(tempPath);
  const bytes = await fs.readFile(tempPath);
  await fs.unlink(tempPath).catch(() => {});
  return bytes;
}
