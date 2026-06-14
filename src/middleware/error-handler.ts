import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../errors/app-error";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(`Route not found: ${request.method} ${request.path}`, 404, "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  const appError =
    error instanceof AppError
      ? error
      : new AppError("An unexpected error occurred", 500, "INTERNAL_ERROR");
  const details =
    appError.details instanceof ZodError
      ? appError.details.flatten()
      : appError.details;

  logger[appError.statusCode >= 500 ? "error" : "warn"](
    { err: error, requestId: request.id, code: appError.code },
    appError.message
  );
  response.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: request.id,
      ...(details && env.NODE_ENV !== "production" ? { details } : {})
    }
  });
};
