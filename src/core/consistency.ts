import path from "node:path";
import { listArtifactTypes, getArtifactDefinition } from "./artifact-registry";
import { contractIds, parseNormalizedBriefOrThrow } from "./normalized-brief";
import { createProvider } from "../providers";
import type { ArtifactDoc, ArtifactType, ContractCoverage, ValidationIssue } from "./types";

type LoadedArtifact = {
  type: ArtifactType;
  file: string;
  doc: ArtifactDoc;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readCoverage(frontmatter: Record<string, unknown>): ContractCoverage {
  const coverage = frontmatter.contract_coverage as Partial<ContractCoverage> | undefined;
  return {
    goals: asStringArray(coverage?.goals),
    core_features: asStringArray(coverage?.core_features),
    constraints: asStringArray(coverage?.constraints)
  };
}

async function checkMissingArtifacts(cwd: string, loadedArtifacts: LoadedArtifact[]): Promise<ValidationIssue[]> {
  const expectedTypes = await listArtifactTypes(cwd);
  const present = new Set(loadedArtifacts.map((item) => item.type));
  const missing = expectedTypes.filter((type) => !present.has(type));
  if (missing.length === 0) return [];
  return [
    {
      level: "warning",
      code: "missing_artifacts",
      check: "schema",
      message: `Some artifacts are missing from outputs: ${missing.join(", ")}`,
      suggestion: "Run the corresponding prodo-* commands before final validation."
    }
  ];
}

async function checkContractCoverage(
  cwd: string,
  loaded: LoadedArtifact[],
  normalizedBrief: Record<string, unknown>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const normalized = parseNormalizedBriefOrThrow(normalizedBrief);
  const expected = contractIds(normalized.contracts);

  for (const artifact of loaded) {
    const def = await getArtifactDefinition(cwd, artifact.type);
    const coverage = readCoverage(artifact.doc.frontmatter);
    for (const key of def.required_contracts) {
      const missing = expected[key].filter((id) => !coverage[key].includes(id));
      if (missing.length === 0) continue;
      issues.push({
        level: "error",
        code: "missing_contract_coverage",
        check: "tag_coverage",
        artifactType: artifact.type,
        file: artifact.file,
        field: `frontmatter.contract_coverage.${key}`,
        message: `Artifact is missing required contract IDs for ${key}: ${missing.join(", ")}`,
        suggestion: "Regenerate artifact and include explicit contract tags such as [G1], [F2], [C1]."
      });
    }
  }

  return issues;
}

function checkUpstreamReferences(loaded: LoadedArtifact[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const filesByName = new Set(loaded.map((item) => path.normalize(item.file)));

  for (const artifact of loaded) {
    const upstream = artifact.doc.frontmatter.upstream_artifacts;
    if (!Array.isArray(upstream)) continue;

    for (const rawItem of upstream) {
      if (typeof rawItem !== "string") continue;
      const resolved = path.normalize(path.resolve(path.dirname(artifact.file), rawItem));
      if (!filesByName.has(resolved)) {
        issues.push({
          level: "error",
          code: "broken_upstream_reference",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          field: "frontmatter.upstream_artifacts",
          message: `Referenced upstream artifact not found: ${rawItem}`,
          suggestion: "Regenerate this artifact or update upstream_artifacts paths to existing outputs."
        });
      }
    }
  }

  return issues;
}

function taggedLinesByContract(body: string): Array<{ contractId: string; line: string }> {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const tagged: Array<{ contractId: string; line: string }> = [];
  for (const line of lines) {
    const matches = line.match(/\[([GFC][0-9]+)\]/g) ?? [];
    for (const match of matches) {
      tagged.push({ contractId: match.slice(1, -1), line });
    }
  }
  return tagged;
}

function parseJsonObject<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return fallback;
  }
}

function hasEnglishLeak(body: string): boolean {
  const markers = [" the ", " and ", " with ", " user ", " should ", " must "];
  const normalized = ` ${body.toLowerCase().replace(/\s+/g, " ")} `;
  return markers.filter((item) => normalized.includes(item)).length >= 2;
}

function checkLanguageConsistency(loaded: LoadedArtifact[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const languages = new Set<string>();
  for (const artifact of loaded) {
    const lang = String((artifact.doc.frontmatter.language ?? "")).toLowerCase();
    if (lang) languages.add(lang);
    if (lang.startsWith("tr") && hasEnglishLeak(artifact.doc.body)) {
      issues.push({
        level: "error",
        code: "language_mixed_content",
        check: "schema",
        artifactType: artifact.type,
        file: artifact.file,
        message: "Artifact contains mixed language content while target language is Turkish.",
        suggestion: "Regenerate artifact with strict Turkish output."
      });
    }
  }
  if (languages.size > 1) {
    issues.push({
      level: "error",
      code: "language_inconsistent_across_artifacts",
      check: "schema",
      message: "Artifacts have inconsistent language settings.",
      suggestion: "Regenerate artifacts so all frontmatter.language values match."
    });
  }
  return issues;
}

async function checkContractRelevance(
  loaded: LoadedArtifact[],
  normalizedBrief: Record<string, unknown>
): Promise<ValidationIssue[]> {
  const normalized = parseNormalizedBriefOrThrow(normalizedBrief);
  const contractMap = new Map<string, string>();
  for (const item of normalized.contracts.goals) contractMap.set(item.id, item.text);
  for (const item of normalized.contracts.core_features) contractMap.set(item.id, item.text);
  for (const item of normalized.contracts.constraints) contractMap.set(item.id, item.text);

  const provider = createProvider();
  const issues: ValidationIssue[] = [];
  for (const artifact of loaded) {
    const taggedLines = taggedLinesByContract(artifact.doc.body);
    for (const tagged of taggedLines) {
      const contractText = contractMap.get(tagged.contractId);
      if (!contractText) {
        issues.push({
          level: "error",
          code: "unknown_contract_tag",
          check: "contract_relevance",
          artifactType: artifact.type,
          file: artifact.file,
          field: tagged.contractId,
          message: `Unknown contract tag used: ${tagged.contractId}`,
          suggestion: "Use only contract IDs that exist in normalized brief contracts."
        });
        continue;
      }

      const response = await provider.generate(
        "Evaluate if tagged line semantically matches contract text.",
        {
          contract_id: tagged.contractId,
          contract_text: contractText,
          context_text: tagged.line
        },
        {
          artifactType: "contract_relevance",
          requiredHeadings: [],
          requiredContracts: []
        }
      );

      const verdict = parseJsonObject<{ relevant?: boolean; score?: number; reason?: string }>(response.body, {});
      const relevant = Boolean(verdict.relevant);
      if (!relevant) {
        issues.push({
          level: "error",
          code: "irrelevant_contract_tag_usage",
          check: "contract_relevance",
          artifactType: artifact.type,
          file: artifact.file,
          field: tagged.contractId,
          message: `Tag ${tagged.contractId} does not match nearby content semantically.`,
          suggestion: verdict.reason ?? "Rewrite the tagged sentence so it clearly addresses the referenced contract."
        });
      }
    }
  }
  return issues;
}

async function checkSemanticPairs(loaded: LoadedArtifact[]): Promise<ValidationIssue[]> {
  const byType = new Map<ArtifactType, LoadedArtifact>();
  for (const artifact of loaded) byType.set(artifact.type, artifact);

  const pairs: Array<[ArtifactType, ArtifactType]> = [
    ["prd", "stories"],
    ["workflow", "techspec"],
    ["workflow", "wireframe"]
  ];
  const provider = createProvider();
  const issues: ValidationIssue[] = [];

  for (const [leftType, rightType] of pairs) {
    const left = byType.get(leftType);
    const right = byType.get(rightType);
    if (!left || !right) continue;

    const result = await provider.generate(
      "Compare paired artifacts semantically and return contradictions.",
      {
        pair: {
          left_type: leftType,
          left_file: left.file,
          left_coverage: readCoverage(left.doc.frontmatter),
          left_body: left.doc.body,
          right_type: rightType,
          right_file: right.file,
          right_coverage: readCoverage(right.doc.frontmatter),
          right_body: right.doc.body
        }
      },
      {
        artifactType: "semantic_consistency",
        requiredHeadings: [],
        requiredContracts: []
      }
    );

    const parsed = parseJsonObject<{ issues?: Array<Record<string, unknown>> }>(result.body, { issues: [] });
    for (const item of parsed.issues ?? []) {
      issues.push({
        level: (item.level === "warning" ? "warning" : "error") as "error" | "warning",
        code: typeof item.code === "string" ? item.code : "semantic_inconsistency",
        check: "semantic_consistency",
        file: typeof item.file === "string" ? item.file : left.file,
        field: typeof item.contract_id === "string" ? item.contract_id : undefined,
        message:
          typeof item.message === "string"
            ? item.message
            : `Semantic mismatch between ${leftType} and ${rightType}.`,
        suggestion:
          typeof item.suggestion === "string"
            ? item.suggestion
            : `Align ${leftType} and ${rightType} decisions and regenerate.`
      });
    }
  }

  return issues;
}

export async function checkConsistency(
  cwd: string,
  loadedArtifacts: LoadedArtifact[],
  normalizedBrief: Record<string, unknown>
): Promise<ValidationIssue[]> {
  const baseIssues = [
    ...(await checkMissingArtifacts(cwd, loadedArtifacts)),
    ...(await checkContractCoverage(cwd, loadedArtifacts, normalizedBrief)),
    ...checkUpstreamReferences(loadedArtifacts),
    ...checkLanguageConsistency(loadedArtifacts)
  ];
  const relevanceIssues = await checkContractRelevance(loadedArtifacts, normalizedBrief);
  const semanticIssues = await checkSemanticPairs(loadedArtifacts);
  return [...baseIssues, ...relevanceIssues, ...semanticIssues];
}
