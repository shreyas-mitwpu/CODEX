import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { AppError } from "./errors/app-error";
import type { WhatsAppClient } from "./integrations/whatsapp.client";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { createRoutes } from "./routes";

export function createApp(whatsappClient: WhatsAppClient): express.Express {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (request) => ({ requestId: request.id }),
      serializers: {
        req(request) {
          return { method: request.method, url: request.url };
        }
      }
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.length === 0 || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError("Origin is not allowed by CORS", 403, "CORS_DENIED"));
      },
      methods: ["GET", "POST"],
      allowedHeaders: [
        "content-type",
        "x-api-key",
        "x-request-id",
        "authorization",
        "x-twilio-signature"
      ],
      maxAge: 86400
    })
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.NODE_ENV === "test" ? 10_000 : 120,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(createRoutes(whatsappClient));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
