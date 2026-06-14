import { z } from "zod";
import { UPDATE_TYPES } from "../domain/types";

const dateString = z.string().datetime({ offset: true });

export const stockUpdateBodySchema = z
  .object({
    updateType: z.enum(UPDATE_TYPES),
    entries: z
      .array(
        z.object({
          materialName: z.string().trim().min(1).max(160),
          quantity: z.number().nonnegative().max(1_000_000_000),
          unit: z.string().trim().min(1).max(20)
        })
      )
      .min(1)
      .max(100),
    effectiveAt: dateString.optional(),
    notes: z.string().trim().min(3).max(1000).optional(),
    actorUserId: z.string().uuid().optional()
  })
  .superRefine((value, context) => {
    if (value.updateType === "ADJUSTMENT" && !value.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Notes are required for adjustments"
      });
    }
  });

export const currentStockQuerySchema = z.object({
  material: z.string().trim().min(1).max(160).optional()
});

export const historyQuerySchema = z
  .object({
    material: z.string().trim().min(1).max(160).optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).default(0)
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      new Date(value.startDate) <= new Date(value.endDate),
    { message: "startDate must be before or equal to endDate" }
  );

export const excelBodySchema = z
  .object({
    startDate: dateString.optional(),
    endDate: dateString.optional()
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      new Date(value.startDate) <= new Date(value.endDate),
    { message: "startDate must be before or equal to endDate" }
  );

export const reportTokenParamsSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/)
});

export const pendingAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const twilioWebhookBodySchema = z.object({
  MessageSid: z.string().min(10).max(64),
  From: z.string().startsWith("whatsapp:+"),
  Body: z.string().trim().min(1).max(4000)
});
