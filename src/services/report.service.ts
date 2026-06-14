import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { env } from "../config/env";
import { pool } from "../database/pool";
import type { StockStatus } from "../domain/types";
import { NotFoundError } from "../errors/app-error";
import { AlertRepository } from "../repositories/alert.repository";
import { ReportRepository } from "../repositories/report.repository";
import { AnalyticsService } from "./analytics.service";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface GeneratedReport {
  fileName: string;
  content: Buffer;
  token: string;
  downloadUrl: string;
  expiresAt: Date;
}

export class ReportService {
  constructor(
    private readonly analytics = new AnalyticsService(),
    private readonly alerts = new AlertRepository(),
    private readonly reports = new ReportRepository()
  ) {}

  async generate(input: {
    requestedByUserId?: string;
    startDate?: Date;
    endDate?: Date;
    persist?: boolean;
  }): Promise<GeneratedReport> {
    const [inventory, history, alerts] = await Promise.all([
      this.analytics.getCurrent(),
      this.analytics.getHistory({
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.endDate ? { endDate: input.endDate } : {}),
        limit: 10_000
      }),
      this.alerts.listAll(pool)
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FactoryMind";
    workbook.created = new Date();
    workbook.subject = "Factory inventory report";

    const currentSheet = workbook.addWorksheet("Current Inventory", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    currentSheet.columns = [
      { header: "Material", key: "material", width: 28 },
      { header: "Current Stock", key: "stock", width: 16 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Avg Daily Usage", key: "usage", width: 18 },
      { header: "Days Remaining", key: "days", width: 18 },
      { header: "Status", key: "status", width: 12 },
      { header: "Last Updated", key: "updated", width: 22 }
    ];
    for (const item of inventory) {
      const row = currentSheet.addRow({
        material: item.materialName,
        stock: item.currentStock,
        unit: item.unit,
        usage: item.averageDailyUsage,
        days: item.daysRemaining,
        status: item.status,
        updated: item.lastUpdatedAt
      });
      styleStatusCell(row.getCell("status"), item.status);
    }
    formatSheet(currentSheet);

    const historySheet = workbook.addWorksheet("Inventory History", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    historySheet.columns = [
      { header: "Effective At", key: "effective", width: 22 },
      { header: "Material", key: "material", width: 28 },
      { header: "Type", key: "type", width: 16 },
      { header: "Quantity", key: "quantity", width: 14 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Balance Before", key: "before", width: 16 },
      { header: "Balance After", key: "after", width: 16 },
      { header: "Entered By", key: "user", width: 22 },
      { header: "Source", key: "source", width: 14 },
      { header: "Notes", key: "notes", width: 32 }
    ];
    history.forEach((item) =>
      historySheet.addRow({
        effective: item.effectiveAt,
        material: item.materialName,
        type: item.updateType,
        quantity: item.quantity,
        unit: item.unit,
        before: item.balanceBefore,
        after: item.balanceAfter,
        user: item.userName ?? "System",
        source: item.source,
        notes: item.notes
      })
    );
    formatSheet(historySheet);

    const alertsSheet = workbook.addWorksheet("Alerts Log", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    alertsSheet.columns = [
      { header: "Created At", key: "created", width: 22 },
      { header: "Material", key: "material", width: 28 },
      { header: "Status", key: "status", width: 12 },
      { header: "Recipient", key: "recipient", width: 24 },
      { header: "Delivery", key: "delivery", width: 14 },
      { header: "Supplier", key: "supplier", width: 26 },
      { header: "Attempts", key: "attempts", width: 12 },
      { header: "Message", key: "message", width: 70 }
    ];
    alerts.forEach((alert) => {
      const row = alertsSheet.addRow({
        created: alert.createdAt,
        material: alert.materialName,
        status: alert.status,
        recipient: alert.recipientName,
        delivery: alert.deliveryStatus,
        supplier: alert.supplierName,
        attempts: alert.attempts,
        message: alert.message
      });
      styleStatusCell(row.getCell("status"), alert.status);
    });
    formatSheet(alertsSheet);

    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `factorymind-inventory-${stamp}.xlsx`;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + env.REPORT_RETENTION_MINUTES * 60_000);

    if (input.persist !== false) {
      await this.reports.deleteExpired(pool);
      await this.reports.save(pool, {
        ...(input.requestedByUserId
          ? { requestedByUserId: input.requestedByUserId }
          : {}),
        token,
        fileName,
        content,
        expiresAt
      });
    }

    return {
      fileName,
      content,
      token,
      downloadUrl: `${env.PUBLIC_BASE_URL}/api/excel/download/${token}`,
      expiresAt
    };
  }

  async download(token: string): Promise<{
    fileName: string;
    mimeType: string;
    content: Buffer;
  }> {
    const report = await this.reports.findValidByToken(pool, token);
    if (!report) throw new NotFoundError("Report not found or expired");
    return {
      fileName: report.file_name,
      mimeType: report.mime_type || XLSX_MIME,
      content: report.content
    };
  }
}

function formatSheet(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17324D" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "top", wrapText: true };
    }
  });
}

function styleStatusCell(cell: ExcelJS.Cell, status: StockStatus): void {
  const colors: Record<StockStatus, string> = {
    GREEN: "FFC6EFCE",
    YELLOW: "FFFFEB9C",
    RED: "FFFFC7CE",
    BLACK: "FF222222"
  };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors[status] } };
  cell.font = { bold: true, color: { argb: status === "BLACK" ? "FFFFFFFF" : "FF000000" } };
}
