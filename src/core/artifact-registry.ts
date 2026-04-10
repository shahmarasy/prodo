import {
  defaultOutputDir,
  defaultRequiredContractsByArtifact,
  defaultRequiredHeadings,
  defaultUpstreamByArtifact
} from "./constants";
import { readProjectConfig } from "./project-config";
import { ARTIFACT_TYPES } from "./types";
import type { ArtifactType, ContractCoverage } from "./types";

export type ArtifactDefinition = {
  name: ArtifactType;
  output_dir: string;
  required_headings: string[];
  upstream: ArtifactType[];
  required_contracts: Array<keyof ContractCoverage>;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function toDefinition(partial: {
  name: string;
  output_dir?: string;
  required_headings?: string[];
  upstream?: string[];
  required_contracts?: Array<keyof ContractCoverage>;
}): ArtifactDefinition {
  const name = normalizeName(partial.name);
  const outputDir = partial.output_dir?.trim() || defaultOutputDir(name);
  const requiredHeadings = partial.required_headings?.length ? partial.required_headings : defaultRequiredHeadings(name);
  const upstream = (partial.upstream?.length ? partial.upstream : defaultUpstreamByArtifact(name)).map(normalizeName);
  const requiredContracts = partial.required_contracts?.length
    ? partial.required_contracts
    : defaultRequiredContractsByArtifact(name);
  return {
    name,
    output_dir: outputDir,
    required_headings: requiredHeadings,
    upstream,
    required_contracts: requiredContracts
  };
}

export async function listArtifactDefinitions(cwd: string): Promise<ArtifactDefinition[]> {
  const config = await readProjectConfig(cwd);
  const base = ARTIFACT_TYPES.map((name) => toDefinition({ name }));
  const byName = new Map<string, ArtifactDefinition>(base.map((item) => [item.name, item]));
  for (const extra of config.artifacts ?? []) {
    const merged = toDefinition(extra);
    byName.set(merged.name, merged);
  }
  return Array.from(byName.values());
}

export async function listArtifactTypes(cwd: string): Promise<ArtifactType[]> {
  const defs = await listArtifactDefinitions(cwd);
  return defs.map((item) => item.name);
}

export async function getArtifactDefinition(cwd: string, artifactType: string): Promise<ArtifactDefinition> {
  const normalized = normalizeName(artifactType);
  const defs = await listArtifactDefinitions(cwd);
  const found = defs.find((item) => item.name === normalized);
  if (found) return found;
  return toDefinition({ name: normalized });
}

