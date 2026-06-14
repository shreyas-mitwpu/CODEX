import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-api-key",
      "req.headers.x-twilio-signature",
      "*.phoneNumber",
      "*.phone_number"
    ],
    censor: "[REDACTED]"
  },
  base: {
    service: "factorymind",
    environment: env.NODE_ENV
  }
});
