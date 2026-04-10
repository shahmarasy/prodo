import fs from "node:fs/promises";
import path from "node:path";
import type { ContractCoverage } from "./types";
import { UserError } from "./errors";
import { fileExists } from "./utils";

export type ArtifactConfig = {
  name: string;
  output_dir?: string;
  required_headings?: string[];
  upstream?: string[];
  required_contracts?: Array<keyof ContractCoverage>;
};

export type ProdoProjectConfig = {
  presets?: string[];
  artifacts?: ArtifactConfig[];
  command_packs?: string[];
};

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sanitizeArtifact(raw: unknown): ArtifactConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!name) return null;
  const outputDir = typeof rec.output_dir === "string" ? rec.output_dir.trim() : undefined;
  const requiredHeadings = sanitizeStringArray(rec.required_headings);
  const upstream = sanitizeStringArray(rec.upstream);
  const requiredContracts = sanitizeStringArray(rec.required_contracts)
    .filter((value): value is keyof ContractCoverage =>
      value === "goals" || value === "core_features" || value === "constraints");
  return {
    name,
    ...(outputDir ? { output_dir: outputDir } : {}),
    ...(requiredHeadings.length > 0 ? { required_headings: requiredHeadings } : {}),
    ...(upstream.length > 0 ? { upstream } : {}),
    ...(requiredContracts.length > 0 ? { required_contracts: requiredContracts } : {})
  };
}

function sanitizeConfig(raw: unknown): ProdoProjectConfig {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const artifacts = Array.isArray(rec.artifacts)
    ? rec.artifacts.map(sanitizeArtifact).filter((item): item is ArtifactConfig => item !== null)
    : [];
  return {
    presets: sanitizeStringArray(rec.presets),
    command_packs: sanitizeStringArray(rec.command_packs),
    ...(artifacts.length > 0 ? { artifacts } : {})
  };
}

export async function readProjectConfig(cwd: string): Promise<ProdoProjectConfig> {
  const candidates = [
    path.join(cwd, ".prodo", "config.json"),
    path.join(cwd, "prodo.config.json")
  ];
  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, "utf8")) as unknown;
      return sanitizeConfig(parsed);
    } catch {
      throw new UserError(`Invalid project config JSON: ${candidate}`);
    }
  }
  return {};
}

