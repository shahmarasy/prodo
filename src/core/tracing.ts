import { taggedLinesByContract } from "./markdown";
import { parseNormalizedBriefOrThrow, type NormalizedBrief, type BriefContractItem } from "./normalized-brief";
import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";

type LoadedArtifact = {
  type: ArtifactType;
  file: string;
  doc: ArtifactDoc;
};

export type TraceEntry = {
  contractId: string;
  contractText: string;
  category: "goals" | "core_features" | "constraints";
  references: Array<{
    artifactType: ArtifactType;
    file: string;
    line: string;
  }>;
};

export type TraceMap = Map<string, TraceEntry>;

export function buildTraceMap(
  normalizedBrief: NormalizedBrief,
  loadedArtifacts: LoadedArtifact[]
): TraceMap {
  const traceMap: TraceMap = new Map();

  function registerContracts(
    items: BriefContractItem[],
    category: TraceEntry["category"]
  ): void {
    for (const item of items) {
      traceMap.set(item.id, {
        contractId: item.id,
        contractText: item.text,
        category,
        references: []
      });
    }
  }

  registerContracts(normalizedBrief.contracts.goals, "goals");
  registerContracts(normalizedBrief.contracts.core_features, "core_features");
  registerContracts(normalizedBrief.contracts.constraints, "constraints");

  for (const artifact of loadedArtifacts) {
    const tagged = taggedLinesByContract(artifact.doc.body);
    for (const { contractId, line } of tagged) {
      const entry = traceMap.get(contractId);
      if (entry) {
        entry.references.push({
          artifactType: artifact.type,
          file: artifact.file,
          line
        });
      }
    }
  }

  return traceMap;
}

export function checkRequirementCompleteness(
  traceMap: TraceMap,
  normalizedBrief: NormalizedBrief,
  presentArtifactTypes: ArtifactType[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (presentArtifactTypes.length === 0) return issues;

  for (const [contractId, entry] of traceMap) {
    if (entry.references.length === 0) {
      issues.push({
        level: "warning",
        code: "untraced_requirement",
        check: "tracing",
        message: `Contract ${contractId} ("${truncate(entry.contractText, 60)}") is not referenced in any generated artifact.`,
        suggestion: `Ensure [${contractId}] tag appears in at least one artifact body.`
      });
    }
  }

  const hasPrd = presentArtifactTypes.includes("prd");
  if (hasPrd) {
    for (const [contractId, entry] of traceMap) {
      if (entry.category === "goals") {
        const inPrd = entry.references.some((r) => r.artifactType === "prd");
        if (!inPrd && entry.references.length > 0) {
          issues.push({
            level: "warning",
            code: "goal_missing_in_prd",
            check: "tracing",
            message: `Goal ${contractId} appears in downstream artifacts but is not traced in the PRD.`,
            suggestion: `Add [${contractId}] tag to the PRD to maintain traceability.`
          });
        }
      }
    }
  }

  return issues;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
