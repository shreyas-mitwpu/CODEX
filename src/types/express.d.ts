import type { UserRecord } from "../domain/types";

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: UserRecord;
      rawBody?: Buffer;
    }
  }
}

export {};
