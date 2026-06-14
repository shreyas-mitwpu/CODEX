import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors/app-error";

export function validate(
  schemas: {
    body?: ZodType;
    query?: ZodType;
    params?: ZodType;
  }
) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) request.body = schemas.body.parse(request.body);
      if (schemas.query) request.query = schemas.query.parse(request.query);
      if (schemas.params) request.params = schemas.params.parse(request.params);
      next();
    } catch (error) {
      next(new ValidationError("Request validation failed", error));
    }
  };
}
