import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(request: Request, response: Response, next: NextFunction): void {
  request.id = request.header("x-request-id")?.slice(0, 128) || randomUUID();
  response.setHeader("x-request-id", request.id);
  next();
}
