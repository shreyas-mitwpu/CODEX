import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors/app-error";

function secureEqual(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function requireApiKey(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  if (!secureEqual(request.header("x-api-key"), env.API_KEY)) {
    next(new UnauthorizedError("Invalid API key"));
    return;
  }
  next();
}

export function requireCronSecret(
  request: Request,
  _response: Response,
  next: NextFunction
): void {
  const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureEqual(bearer, env.CRON_SECRET)) {
    next(new UnauthorizedError("Invalid scheduler secret"));
    return;
  }
  next();
}
