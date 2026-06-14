import { Router } from "express";
import type { z } from "zod";
import { pool } from "../database/pool";
import type { WhatsAppClient } from "../integrations/whatsapp.client";
import { requireApiKey, requireCronSecret } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { verifyTwilioSignature } from "../middleware/twilio-signature";
import {
  currentStockQuerySchema,
  excelBodySchema,
  historyQuerySchema,
  pendingAlertsQuerySchema,
  reportTokenParamsSchema,
  stockUpdateBodySchema,
  twilioWebhookBodySchema
} from "../schemas/api.schemas";
import { AlertService } from "../services/alert.service";
import { AnalyticsService } from "../services/analytics.service";
import { InventoryService } from "../services/inventory.service";
import { ReminderService } from "../services/reminder.service";
import { ReportService } from "../services/report.service";
import { WhatsAppService } from "../services/whatsapp.service";
import { asyncHandler } from "../utils/async-handler";

export function createRoutes(whatsappClient: WhatsAppClient): Router {
  const router = Router();
  const inventory = new InventoryService();
  const analytics = new AnalyticsService();
  const alerts = new AlertService(whatsappClient);
  const reports = new ReportService();
  const reminders = new ReminderService(whatsappClient);
  const whatsapp = new WhatsAppService(whatsappClient);

  router.get(
    "/health",
    asyncHandler(async (_request, response) => {
      await pool.query("SELECT 1");
      response.json({ status: "ok", service: "factorymind" });
    })
  );

  router.post(
    "/webhook/whatsapp",
    verifyTwilioSignature,
    validate({ body: twilioWebhookBodySchema }),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof twilioWebhookBodySchema>;
      await whatsapp.handleInbound({
        messageSid: body.MessageSid,
        from: body.From,
        body: body.Body
      });
      response.type("text/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>");
    })
  );

  router.get(
    "/api/excel/download/:token",
    validate({ params: reportTokenParamsSchema }),
    asyncHandler(async (request, response) => {
      const params = request.params as z.infer<typeof reportTokenParamsSchema>;
      const report = await reports.download(params.token);
      response
        .setHeader("content-type", report.mimeType)
        .setHeader(
          "content-disposition",
          `attachment; filename="${report.fileName.replace(/"/g, "")}"`
        )
        .setHeader("cache-control", "private, no-store")
        .send(report.content);
    })
  );

  router.post(
    "/api/scheduler/morning-reminder",
    requireCronSecret,
    asyncHandler(async (_request, response) => {
      const remindersResult = await reminders.sendMorningReminder();
      const alertsResult = await alerts.dispatchPending();
      response.json({ reminders: remindersResult, alerts: alertsResult });
    })
  );

  router.use("/api", requireApiKey);

  router.post(
    "/api/stock/update",
    validate({ body: stockUpdateBodySchema }),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof stockUpdateBodySchema>;
      const result = await inventory.recordUpdates({
        updateType: body.updateType,
        entries: body.entries,
        ...(body.effectiveAt ? { effectiveAt: new Date(body.effectiveAt) } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        context: {
          ...(body.actorUserId ? { actorUserId: body.actorUserId } : {}),
          source: "API",
          requestId: String(request.id)
        }
      });
      const delivery = await alerts.dispatchPending();
      response.status(201).json({ ...result, alertDelivery: delivery });
    })
  );

  router.get(
    "/api/stock/current",
    validate({ query: currentStockQuerySchema }),
    asyncHandler(async (request, response) => {
      const query = request.query as z.infer<typeof currentStockQuerySchema>;
      response.json({ data: await analytics.getCurrent(query.material) });
    })
  );

  router.get(
    "/api/stock/history",
    validate({ query: historyQuerySchema }),
    asyncHandler(async (request, response) => {
      const query = request.query as unknown as z.infer<typeof historyQuerySchema>;
      const data = await analytics.getHistory({
        ...(query.material ? { materialQuery: query.material } : {}),
        ...(query.startDate ? { startDate: new Date(query.startDate) } : {}),
        ...(query.endDate ? { endDate: new Date(query.endDate) } : {}),
        limit: query.limit,
        offset: query.offset
      });
      response.json({ data, pagination: { limit: query.limit, offset: query.offset } });
    })
  );

  router.get(
    "/api/alerts/pending",
    validate({ query: pendingAlertsQuerySchema }),
    asyncHandler(async (request, response) => {
      const query = request.query as unknown as z.infer<typeof pendingAlertsQuerySchema>;
      response.json({ data: await alerts.listPending(query.limit) });
    })
  );

  router.post(
    "/api/excel/generate",
    validate({ body: excelBodySchema }),
    asyncHandler(async (request, response) => {
      const body = request.body as z.infer<typeof excelBodySchema>;
      const report = await reports.generate({
        ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
        ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
        persist: false
      });
      response
        .setHeader(
          "content-type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        .setHeader("content-disposition", `attachment; filename="${report.fileName}"`)
        .send(report.content);
    })
  );

  router.get(
    "/api/dashboard",
    asyncHandler(async (_request, response) => {
      response.json({ data: await analytics.getDashboard() });
    })
  );

  return router;
}
