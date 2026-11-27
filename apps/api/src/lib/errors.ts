import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(status, { message });
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new ApiError(400, code, message, details);
export const unauthorized = (message = "authentication required") => new ApiError(401, "unauthorized", message);
export const forbidden = (code: string, message: string) => new ApiError(403, code, message);
export const notFound = (what = "resource") => new ApiError(404, "not_found", `${what} not found`);
export const conflict = (code: string, message: string, details?: unknown) => new ApiError(409, code, message, details);
export const tooMany = (retryAfterSec: number) => new ApiError(429, "rate_limited", `too many requests, retry in ${retryAfterSec}s`, { retryAfterSec });
