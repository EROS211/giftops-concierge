import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const PROMPT_VERSION = "1.0";

/**
 * Run a structured LLM call with strict JSON schema.
 * Uses response_format with json_schema (OpenAI structured outputs).
 * Falls back to parsing raw JSON if zodResponseFormat is unavailable.
 */
export async function runStructured<T>(params: {
  schemaName: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  modelOverride?: string;
}): Promise<{ data: T; raw: string }> {
  const { schemaName, schema, system, user, modelOverride: m } = params;
  const resolvedModel = m ?? model;

  // Build a minimal JSON schema for OpenAI (required fields, no $schema).
  const jsonSchema = zodToOpenAIJsonSchema(schema);

  const response = await openai.chat.completions.create({
    model: resolvedModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema: jsonSchema,
      },
    },
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new Error("Empty response from model");
  }

  const parsed = JSON.parse(raw) as unknown;
  const data = schema.parse(parsed) as T;
  return { data, raw };
}

/**
 * Convert a Zod schema to OpenAI-compatible JSON Schema (subset).
 * Only supports: object, string, number, boolean, array, enum; required; additionalProperties: false.
 */
function zodToOpenAIJsonSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  const def = zodSchema._def;
  const typeName = def.typeName;

  if (typeName === "ZodObject") {
    const shape = def.shape() as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    // OpenAI's structured outputs currently require that `required`
    // contain every key in `properties`, even if we conceptually treat
    // some as optional in Zod. We let Zod handle \"optional\" at parse time.
    const required = Object.keys(shape);
    for (const [key, value] of Object.entries(shape)) {
      const isOptional = value._def.typeName === "ZodOptional";
      const isNullable = value._def.typeName === "ZodNullable";
      const inner = isOptional || isNullable ? (value._def.innerType as z.ZodTypeAny) : value;
      properties[key] = zodToOpenAIJsonSchema(inner);
    }
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodNullable") {
    const inner = def.innerType as z.ZodTypeAny;
    return zodToOpenAIJsonSchema(inner);
  }
  if (typeName === "ZodOptional") {
    const inner = def.innerType as z.ZodTypeAny;
    return zodToOpenAIJsonSchema(inner);
  }
  if (typeName === "ZodEnum") {
    return { type: "string", enum: def.values };
  }
  if (typeName === "ZodArray") {
    const items = zodToOpenAIJsonSchema(def.type as z.ZodTypeAny);
    return { type: "array", items };
  }
  if (typeName === "ZodRecord") {
    return { type: "object", additionalProperties: true };
  }
  if (typeName === "ZodDefault") {
    return zodToOpenAIJsonSchema(def.innerType as z.ZodTypeAny);
  }

  return { type: "string" };
}

export async function runUnstructured(params: {
  system: string;
  user: string;
  modelOverride?: string;
}): Promise<string> {
  const resolvedModel = params.modelOverride ?? model;
  const response = await openai.chat.completions.create({
    model: resolvedModel,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}
