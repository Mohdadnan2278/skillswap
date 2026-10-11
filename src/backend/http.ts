import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteOrigin, isAuthConfigured } from "@/backend/config";
import type { ErrorCode } from "@/shared/contracts";

export class HttpError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string) { super(message); }
}
export function requireConfiguration() {
  if (!isAuthConfigured()) throw new HttpError(503, "CONFIGURATION_REQUIRED", "Sign-in is temporarily unavailable. Please try again later.");
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = getSiteOrigin();
  if (!expected || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "FORBIDDEN", "This request must come from SkillSwap.");
}
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    throw new HttpError(400, "VALIDATION_ERROR", "Send a JSON request.");
  if (!request.body) throw new HttpError(400, "VALIDATION_ERROR", "Request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16 * 1024) { await reader.cancel(); throw new HttpError(400, "VALIDATION_ERROR", "Request is too large."); }
    chunks.push(value);
  }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "VALIDATION_ERROR", "Invalid JSON."); }
  return schema.parse(raw);
}
export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "private, no-store", "Pragma": "no-cache" } });
}
export async function apiHandler(operation: () => Promise<NextResponse>) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const field = String(issue.path[0] ?? "form");
        (fieldErrors[field] ??= []).push(issue.message);
      }
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields.", fieldErrors } }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const failure = error instanceof HttpError ? error : new HttpError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    // Never log request bodies, auth cookies, tokens or provider error details.
    return NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { "Cache-Control": "private, no-store", ...(failure.status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
