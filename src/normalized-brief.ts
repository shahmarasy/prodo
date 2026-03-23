import Ajv2020 from "ajv/dist/2020";
import { UserError } from "./errors";
import type { ValidationIssue } from "./types";

export type BriefContractItem = {
  id: string;
  text: string;
};

export type NormalizedBrief = {
  schema_version: string;
  product_name: string;
  problem: string;
  audience: string[];
  goals: string[];
  core_features: string[];
  constraints: string[];
  assumptions: string[];
  contracts: {
    goals: BriefContractItem[];
    core_features: BriefContractItem[];
    constraints: BriefContractItem[];
  };
  confidence?: Record<string, number>;
};

type BriefContracts = NormalizedBrief["contracts"];

const schema: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "schema_version",
    "product_name",
    "problem",
    "audience",
    "goals",
    "core_features",
    "constraints",
    "assumptions",
    "contracts"
  ],
  properties: {
    schema_version: { type: "string", minLength: 1 },
    product_name: { type: "string", minLength: 2 },
    problem: { type: "string", minLength: 10 },
    audience: { type: "array", minItems: 1, items: { type: "string", minLength: 2 } },
    goals: { type: "array", minItems: 1, items: { type: "string", minLength: 2 } },
    core_features: { type: "array", minItems: 1, items: { type: "string", minLength: 2 } },
    constraints: { type: "array", items: { type: "string", minLength: 2 } },
    assumptions: { type: "array", items: { type: "string", minLength: 2 } },
    contracts: {
      type: "object",
      required: ["goals", "core_features", "constraints"],
      properties: {
        goals: { $ref: "#/$defs/contractArray" },
        core_features: { $ref: "#/$defs/contractArray" },
        constraints: { $ref: "#/$defs/contractArray" }
      },
      additionalProperties: false
    },
    confidence: {
      type: "object",
      additionalProperties: { type: "number", minimum: 0, maximum: 1 }
    }
  },
  $defs: {
    contractItem: {
      type: "object",
      required: ["id", "text"],
      properties: {
        id: { type: "string", pattern: "^[A-Z]+[0-9]+$" },
        text: { type: "string", minLength: 2 }
      },
      additionalProperties: false
    },
    contractArray: { type: "array", items: { $ref: "#/$defs/contractItem" } }
  },
  additionalProperties: false
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => typeof item === "string");
}

function asContracts(value: unknown): BriefContractItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = asString(record.id);
      const text = asString(record.text);
      if (!id || !text) return null;
      return { id, text };
    })
    .filter((item): item is BriefContractItem => item !== null);
}

function asConfidence(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || Number.isNaN(raw)) continue;
    result[key] = raw;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeInput(input: Record<string, unknown>): NormalizedBrief {
  const rawContracts = (input.contracts as Record<string, unknown> | undefined) ?? {};
  return {
    schema_version: asString(input.schema_version) ?? "1.0",
    product_name: asString(input.product_name) ?? "",
    problem: asString(input.problem) ?? "",
    audience: asStringArray(input.audience),
    goals: asStringArray(input.goals),
    core_features: asStringArray(input.core_features),
    constraints: asStringArray(input.constraints),
    assumptions: asStringArray(input.assumptions),
    contracts: {
      goals: asContracts(rawContracts.goals),
      core_features: asContracts(rawContracts.core_features),
      constraints: asContracts(rawContracts.constraints)
    },
    confidence: asConfidence(input.confidence)
  };
}

export function buildContractsFromArrays(input: {
  goals: string[];
  core_features: string[];
  constraints: string[];
}): BriefContracts {
  return {
    goals: input.goals.map((text, index) => ({ id: `G${index + 1}`, text })),
    core_features: input.core_features.map((text, index) => ({ id: `F${index + 1}`, text })),
    constraints: input.constraints.map((text, index) => ({ id: `C${index + 1}`, text }))
  };
}

export function parseNormalizedBrief(input: Record<string, unknown>): {
  brief: NormalizedBrief;
  issues: ValidationIssue[];
} {
  const normalized = normalizeInput(input);
  const valid = validateFn(normalized);
  if (valid) return { brief: normalized, issues: [] };
  const errors = validateFn.errors ?? [];
  const issues = errors.map((error) => ({
    level: "error" as const,
    code: "normalized_brief_invalid",
    check: "schema" as const,
    field: error.instancePath || error.schemaPath,
    message: `Normalized brief schema error: ${error.message ?? "unknown error"}`,
    suggestion: "Fix missing content in start brief and rerun `prodo normalize`."
  }));
  return { brief: normalized, issues };
}

export function parseNormalizedBriefOrThrow(input: Record<string, unknown>): NormalizedBrief {
  const { brief, issues } = parseNormalizedBrief(input);
  if (issues.length > 0) {
    const detail = issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new UserError(`Normalized brief is invalid:\n${detail}`);
  }
  return brief;
}

export function requireConfidenceOrThrow(
  brief: NormalizedBrief,
  fields: Array<keyof Pick<NormalizedBrief, "product_name" | "problem" | "audience" | "goals" | "core_features">>,
  threshold = 0.7
): void {
  const confidence = brief.confidence ?? {};
  const missing = fields.filter((field) => (confidence[field] ?? 0) < threshold);
  if (missing.length > 0) {
    throw new UserError(
      `Normalization confidence too low for: ${missing.join(", ")}. Improve brief clarity and rerun \`prodo normalize\`.`
    );
  }
}

export function contractIds(contracts: BriefContracts): {
  goals: string[];
  core_features: string[];
  constraints: string[];
} {
  return {
    goals: contracts.goals.map((item) => item.id),
    core_features: contracts.core_features.map((item) => item.id),
    constraints: contracts.constraints.map((item) => item.id)
  };
}
