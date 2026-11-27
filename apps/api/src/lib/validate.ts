import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors";

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest(
      "validation_failed",
      "some fields are invalid",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return r.data;
}

export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw badRequest("invalid_json", "request body must be JSON");
  }
  return parse(schema, json);
}

export function query<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  return parse(schema, c.req.query());
}
