import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { parseAgentText } from './textParsers';

const palette = {
  ink: "FF17202A",
  slate: "FF4B5563",
  line: "FFD7DEE8",
  blue: "FF1E5AA8",
  blueSoft: "FFD9EAFB",
  graySoft: "FFF8FAFC",
  redSoft: "FFFEE2E2",
  red: "FFEF4444",
  amberSoft: "FFFEF3C7",
  amber: "FFF59E0B",
  greenSoft: "FFDCFCE7",
  green: "FF22C55E",
};

function styleTable(sheet, rangeStartRow, rangeEndRow, colCount, headerRow, statusColIndex) {
  // Add Header styling
  for (let i = 1; i <= colCount; i++) {
    const cell = sheet.getCell(headerRow, i);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.blue } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  }

  // Add borders and conditional formatting to rows
  for (let r = rangeStartRow; r <= rangeEndRow; r++) {
    for (let c = 1; c <= colCount; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top: { style: 'thin', color: { argb: palette.line } },
        left: { style: 'thin', color: { argb: palette.line } },
        bottom: { style: 'thin', color: { argb: palette.line } },
        right: { style: 'thin', color: { argb: palette.line } }
      };
      cell.alignment = { wrapText: true };
      
      // Status conditional formatting
      if (c === statusColIndex) {
        const val = cell.value ? String(cell.value).toLowerCase() : "";
        if (val.includes("critical") || val.includes("down") || val.includes("high")) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.redSoft } };
          cell.font = { bold: true, color: { argb: palette.red } };
        } else if (val.includes("low") || val.includes("medium") || val.includes("idle")) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.amberSoft } };
          cell.font = { bold: true, color: { argb: palette.amber } };
        } else if (val.includes("ok") || val.includes("running")) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.greenSoft } };
          cell.font = { bold: true, color: { argb: palette.green } };
        }
      }
    }
  }
}

function writeTitle(sheet, title, subtitle, maxCol) {
  sheet.mergeCells(1, 1, 1, maxCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: palette.ink } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.blueSoft } };

  sheet.mergeCells(2, 1, 2, maxCol);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { color: { argb: palette.slate } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.graySoft } };
}

function writeSummary(sheet, summary) {
  const entries = Object.entries(summary);
  sheet.getCell("A4").value = "Status";
  sheet.getCell("B4").value = "Count";
  ["A4", "B4"].forEach(ref => {
    sheet.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: palette.ink } };
    sheet.getCell(ref).font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  entries.forEach(([key, count], index) => {
    const row = 5 + index;
    sheet.getCell(`A${row}`).value = key;
    sheet.getCell(`B${row}`).value = count;
    ["A", "B"].forEach(col => {
      sheet.getCell(`${col}${row}`).border = {
        top: { style: 'thin', color: { argb: palette.line } },
        left: { style: 'thin', color: { argb: palette.line } },
        bottom: { style: 'thin', color: { argb: palette.line } },
        right: { style: 'thin', color: { argb: palette.line } }
      };
    });
  });
}

async function buildInventoryWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Inventory");
  writeTitle(sheet, "Inventory Status Sheet", "Parsed from plain text.", 6);
  writeSummary(sheet, result.summary);

  const headers = ["Item", "Quantity", "Threshold", "Status", "Notes", "Original Text"];
  sheet.getRow(8).values = headers;
  
  const startRow = 9;
  result.rows.forEach((row, i) => {
    sheet.getRow(startRow + i).values = [row.item, row.quantity, row.threshold, row.status, row.note, row.source];
  });
  
  const endRow = Math.max(9, 8 + result.rows.length);
  styleTable(sheet, startRow, endRow, 6, 8, 4);
  
  sheet.columns = [
    { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 25 }, { width: 50 }
  ];
  sheet.views = [{ state: 'frozen', ySplit: 8 }];
}

async function buildProductionWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Production");
  const photoNote = result.meta?.photoName ? ` Optional photo attached: ${result.meta.photoName}.` : "";
  writeTitle(sheet, "Production Status Sheet", `Parsed from line descriptions.${photoNote}`, 6);
  writeSummary(sheet, result.summary);

  const headers = ["Line", "Status", "Capacity %", "Capacity Basis", "Timing Note", "Original Text"];
  sheet.getRow(8).values = headers;
  
  const startRow = 9;
  result.rows.forEach((row, i) => {
    sheet.getRow(startRow + i).values = [row.line, row.status, row.capacity, row.capacityBasis, row.note, row.source];
  });
  
  const endRow = Math.max(9, 8 + result.rows.length);
  styleTable(sheet, startRow, endRow, 6, 8, 2);
  
  sheet.columns = [
    { width: 20 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 25 }, { width: 50 }
  ];
  sheet.views = [{ state: 'frozen', ySplit: 8 }];
}

async function buildMaintenanceWorkbook(workbook, result) {
  const sheet = workbook.addWorksheet("Maintenance");
  writeTitle(sheet, "Maintenance Priority Sheet", "Risk uses a 90-day default service interval.", 8);
  writeSummary(sheet, result.summary);

  const headers = ["Machine", "Last Service", "Days Since Service", "Risk Score", "Urgency", "Recommended Service Date", "Recommendation", "Original Text"];
  sheet.getRow(8).values = headers;
  
  const startRow = 9;
  result.rows.forEach((row, i) => {
    sheet.getRow(startRow + i).values = [
      row.machine, row.lastService, row.daysSinceService, row.riskScore, row.urgency, row.recommendedServiceDate, row.recommendation, row.source
    ];
  });
  
  const endRow = Math.max(9, 8 + result.rows.length);
  styleTable(sheet, startRow, endRow, 8, 8, 5);
  
  sheet.columns = [
    { width: 20 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 25 }, { width: 30 }, { width: 50 }
  ];
  sheet.views = [{ state: 'frozen', ySplit: 8 }];
}

export async function buildAndDownloadWorkbook(agent, text, context = {}) {
  const result = parseAgentText(agent, text, context);
  const workbook = new ExcelJS.Workbook();
  
  if (agent === "inventory") await buildInventoryWorkbook(workbook, result);
  if (agent === "production") await buildProductionWorkbook(workbook, result);
  if (agent === "maintenance") await buildMaintenanceWorkbook(workbook, result);

  const buffer = await workbook.xlsx.writeBuffer();
  const fileBase = `${agent}-agent-${new Date().toISOString().slice(0, 10)}`;
  saveAs(new Blob([buffer]), `${fileBase}.xlsx`);
}
