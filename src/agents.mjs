import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const AGENT_TITLES = {
  inventory: "Inventory Agent",
  production: "Production Agent",
  maintenance: "Maintenance Agent",
};

const palette = {
  ink: "FF17202A",
  slate: "FF4B5563",
  line: "FFD7DEE8",
  blue: "FF1E5AA8",
  blueSoft: "FFD9EAFB",
  green: "FF15803D",
  greenSoft: "FFDFF5E4",
  amber: "FFB7791F",
  amberSoft: "FFFFF2CC",
  red: "FFB91C1C",
  redSoft: "FFFDE2E1",
  graySoft: "FFF3F6FA",
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
    sheet.getColumn(index + 1).width = width / 7;
  });
}

function styleTable(sheet, startRow, endRow, headerAddress, statusCol) {
  sheet.views = [{ showGridLines: false }];
  const headerRow = sheet.getRow(startRow);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: palette.blue }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  for (let r = startRow; r <= endRow; r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: palette.line } },
        left: { style: 'thin', color: { argb: palette.line } },
        bottom: { style: 'thin', color: { argb: palette.line } },
        right: { style: 'thin', color: { argb: palette.line } }
      };
      cell.alignment = { wrapText: true, vertical: 'top' };
    });
  }
}

function writeTitle(sheet, title, subtitle) {
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: palette.ink } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.blueSoft } };
  
  sheet.mergeCells('A2:H2');
  const subCell = sheet.getCell('A2');
  subCell.value = subtitle;
  subCell.font = { color: { argb: palette.slate } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.graySoft } };
}

function writeSummary(sheet, summary) {
  const entries = Object.entries(summary);
  sheet.getCell('A4').value = "Status";
  sheet.getCell('B4').value = "Count";
  ['A4', 'B4'].forEach(c => {
    sheet.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.ink } };
    sheet.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  
  if (entries.length) {
    entries.forEach(([key, count], idx) => {
      const row = sheet.getRow(5 + idx);
      row.getCell(1).value = key;
      row.getCell(2).value = count;
      [1, 2].forEach(col => {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: palette.line } },
          left: { style: 'thin', color: { argb: palette.line } },
          bottom: { style: 'thin', color: { argb: palette.line } },
          right: { style: 'thin', color: { argb: palette.line } }
        };
      });
    });
  }
}

function buildInventoryWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Inventory");
  writeTitle(sheet, "Inventory Status Sheet", "Parsed from plain text. Edit quantities or thresholds, and Excel will keep the status formula current.");
  writeSummary(sheet, result.summary);

  const headers = ["Item", "Quantity", "Threshold", "Status", "Notes", "Original Text"];
  const rows = result.rows.map((row) => [row.item, row.quantity, row.threshold, row.status, row.note, row.source]);
  
  sheet.getRow(8).values = headers;
  rows.forEach((row, idx) => {
    sheet.getRow(9 + idx).values = row;
    const r = 9 + idx;
    sheet.getCell(`D${r}`).value = { formula: `IF(B${r}="","Review",IF(C${r}="", "OK", IF(B${r}<=C${r},"Critical",IF(B${r}<=C${r}*1.5,"Low","OK"))))` };
  });
  
  const endRow = Math.max(9, rows.length + 8);
  styleTable(sheet, 8, endRow, "A8:F8", 4);
  setColumnWidths(sheet, [210, 95, 100, 115, 190, 420]);
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];
}

function buildProductionWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Production");
  const photoNote = result.meta?.photoName ? ` Optional photo attached: ${result.meta.photoName}.` : "";
  writeTitle(sheet, "Production Status Sheet", `Parsed from line descriptions with estimated capacity where explicit capacity was not provided.${photoNote}`);
  writeSummary(sheet, result.summary);

  const headers = ["Line", "Status", "Capacity %", "Capacity Basis", "Timing Note", "Original Text"];
  const rows = result.rows.map((row) => [row.line, row.status, row.capacity, row.capacityBasis, row.note, row.source]);
  
  sheet.getRow(8).values = headers;
  rows.forEach((row, idx) => {
    sheet.getRow(9 + idx).values = row;
    sheet.getCell(`C${9 + idx}`).numFmt = "0";
  });
  
  const endRow = Math.max(9, rows.length + 8);
  styleTable(sheet, 8, endRow, "A8:F8", 2);
  setColumnWidths(sheet, [120, 120, 105, 170, 145, 430]);
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];
}

function buildMaintenanceWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Maintenance");
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
  
  sheet.getRow(8).values = headers;
  rows.forEach((row, idx) => {
    sheet.getRow(9 + idx).values = row;
  });
  
  const endRow = Math.max(9, rows.length + 8);
  styleTable(sheet, 8, endRow, "A8:H8", 5);
  setColumnWidths(sheet, [130, 125, 140, 95, 105, 170, 205, 390]);
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 8 }];
}

export async function buildWorkbook(agent, text, context = {}) {
  const result = parseAgentText(agent, text, context);
  const workbook = new ExcelJS.Workbook();
  
  if (agent === "inventory") buildInventoryWorkbook(workbook, result);
  if (agent === "production") buildProductionWorkbook(workbook, result);
  if (agent === "maintenance") buildMaintenanceWorkbook(workbook, result);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
