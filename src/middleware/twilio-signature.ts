import type { NextFunction, Request, Response } from "express";
import twilio from "twilio";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors/app-error";

export function verifyTwilioSignature(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const signature = request.header("x-twilio-signature");
  if (!signature) {
    next(new UnauthorizedError("Missing Twilio signature"));
    return;
  }
  const baseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}${request.originalUrl}`;
  const params = Object.fromEntries(
    Object.entries(request.body as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value)
    ])
  );
  if (!twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params)) {
    next(new UnauthorizedError("Invalid Twilio signature"));
    return;
  }
  next();
}
