import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { INTENT_TYPES, type MaterialRecord, type ParsedInventoryMessage } from "../domain/types";
import { normalizeMaterialName } from "../utils/material-name";
import { normalizeUnit } from "../utils/units";

const parsedMessageSchema = z.object({
  intent: z.enum(INTENT_TYPES),
  confidence: z.number().min(0).max(1),
  entries: z
    .array(
      z.object({
        materialName: z.string().min(1),
        quantity: z.number().nonnegative(),
        unit: z.string().min(1)
      })
    )
    .default([]),
  materialQuery: z.string().min(1).optional(),
  reportStartDate: z.string().date().optional(),
  reportEndDate: z.string().date().optional(),
  responseLanguage: z.enum(["en", "hinglish"]).default("en")
});

export interface InventoryMessageParser {
  parse(message: string, materials: MaterialRecord[]): Promise<ParsedInventoryMessage>;
}

export class ClaudeInventoryParser implements InventoryMessageParser {
  private readonly client: Anthropic;

  constructor(apiKey = env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic({ apiKey });
  }

  async parse(message: string, materials: MaterialRecord[]): Promise<ParsedInventoryMessage> {
    const catalog = materials.map((material) => ({
      name: material.name,
      aliases: material.aliases,
      unit: material.canonicalUnit
    }));

    try {
      const response = await this.client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 1000,
        temperature: 0,
        system: [
          "You extract factory inventory messages into strict JSON.",
          "Understand English, Hinglish, abbreviations, spelling variations, and flexible order.",
          "Use only material names from the supplied catalog and normalize units.",
          "MORNING_UPDATE means an opening/current stock snapshot.",
          "EVENING_UPDATE means quantities consumed/used, not closing balances.",
          "Return only one JSON object with keys: intent, confidence, entries, materialQuery,",
          "reportStartDate, reportEndDate, responseLanguage. Omit optional unknown fields.",
          `Allowed intents: ${INTENT_TYPES.join(", ")}.`,
          "Never invent quantities or materials."
        ].join(" "),
        messages: [
          {
            role: "user",
            content: `Catalog:\n${JSON.stringify(catalog)}\n\nMessage:\n${message}`
          }
        ]
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      const parsed = parsedMessageSchema.parse(JSON.parse(stripCodeFence(text)));
      return normalizeParsedMessage(parsed);
    } catch (error) {
      logger.warn({ err: error }, "Claude parsing failed; using deterministic fallback");
      return heuristicParse(message, materials);
    }
  }
}

function stripCodeFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function normalizeParsedMessage(
  parsed: z.infer<typeof parsedMessageSchema>
): ParsedInventoryMessage {
  return {
    intent: parsed.intent,
    confidence: parsed.confidence,
    entries: parsed.entries.map((entry) => ({
      materialName: entry.materialName.trim(),
      quantity: entry.quantity,
      unit: normalizeUnit(entry.unit)
    })),
    ...(parsed.materialQuery ? { materialQuery: parsed.materialQuery.trim() } : {}),
    ...(parsed.reportStartDate ? { reportStartDate: parsed.reportStartDate } : {}),
    ...(parsed.reportEndDate ? { reportEndDate: parsed.reportEndDate } : {}),
    responseLanguage: parsed.responseLanguage
  };
}

export function heuristicParse(
  message: string,
  materials: MaterialRecord[]
): ParsedInventoryMessage {
  const lower = message.toLowerCase();
  const responseLanguage: "en" | "hinglish" =
    /\b(aaj|kitna|kitni|bacha|hai|ka|ki|subah|shaam|bhejo|chahiye)\b/i.test(message)
      ? "hinglish"
      : "en";

  let intent: ParsedInventoryMessage["intent"] = "UNKNOWN";
  if (/\b(excel|xlsx|spreadsheet|report)\b/i.test(lower)) {
    intent = "EXCEL_REQUEST";
  } else if (/\b(supplier|vendor|purchase|order from|kharid)\b/i.test(lower)) {
    intent = "SUPPLIER_REQUEST";
  } else if (/\b(morning|opening|open stock|snapshot|subah)\b/i.test(lower)) {
    intent = "MORNING_UPDATE";
  } else if (
    /\b(evening|used|usage|consumed|consume|issued|issue|khapat|shaam)\b/i.test(lower)
  ) {
    intent = "EVENING_UPDATE";
  } else if (/\b(stock|balance|remaining|available|kitna|kitni|bacha)\b/i.test(lower)) {
    intent = materials.some((material) => mentionsMaterial(lower, material))
      ? "SPECIFIC_QUERY"
      : "STOCK_QUERY";
  }

  const entries = extractEntries(message, materials);
  const queriedMaterial = materials.find((material) => mentionsMaterial(lower, material));

  return {
    intent,
    confidence: entries.length > 0 || intent !== "UNKNOWN" ? 0.72 : 0.2,
    entries,
    ...(queriedMaterial ? { materialQuery: queriedMaterial.name } : {}),
    responseLanguage
  };
}

function mentionsMaterial(message: string, material: MaterialRecord): boolean {
  const normalizedMessage = normalizeMaterialName(message);
  return [material.normalizedName, ...material.aliases.map(normalizeMaterialName)].some(
    (name) => normalizedMessage.includes(name)
  );
}

function extractEntries(
  message: string,
  materials: MaterialRecord[]
): ParsedInventoryMessage["entries"] {
  const unitPattern =
    "kgs?|kilograms?|kilos?|g|gms?|grams?|l|lt|ltrs?|litres?|liters?|ml|pcs?|pieces?|nos?|m|meters?|metres?|boxes?|bags?|rolls?";
  const entryPattern = new RegExp(
    `([a-zA-Z][a-zA-Z0-9 .()/-]{1,80}?)\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`,
    "gi"
  );
  const entries: ParsedInventoryMessage["entries"] = [];

  for (const match of message.matchAll(entryPattern)) {
    const rawName = (match[1] ?? "")
      .replace(
        /\b(morning|evening|update|opening|stock|used|usage|consumed|today|aaj|subah|shaam|and)\b/gi,
        " "
      )
      .trim()
      .replace(/^[,;:\s-]+|[,;:\s-]+$/g, "");
    const material = bestMention(rawName, materials);
    const quantity = Number(match[2]);
    const unit = match[3];
    if (material && Number.isFinite(quantity) && unit) {
      entries.push({
        materialName: material.name,
        quantity,
        unit: normalizeUnit(unit)
      });
    }
  }
  return entries;
}

function bestMention(rawName: string, materials: MaterialRecord[]): MaterialRecord | undefined {
  const normalized = normalizeMaterialName(rawName);
  return materials.find((material) =>
    [material.normalizedName, ...material.aliases.map(normalizeMaterialName)].some(
      (name) => normalized.includes(name) || name.includes(normalized)
    )
  );
}
