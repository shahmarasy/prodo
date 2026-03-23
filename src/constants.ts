import type { ContractCoverage, CoreArtifactType } from "./types";

export const PRODO_DIR = ".prodo";
export const DEFAULT_STATUS = "draft";

const CORE_OUTPUT_DIR_BY_ARTIFACT: Record<CoreArtifactType, string> = {
  prd: "prd",
  workflow: "workflows",
  wireframe: "wireframes",
  stories: "stories",
  techspec: "techspec"
};

const CORE_REQUIRED_HEADINGS: Record<CoreArtifactType, string[]> = {
  prd: ["## Problem", "## Goals", "## Scope", "## Requirements"],
  workflow: [
    "## Flow Purpose",
    "## Actors",
    "## Preconditions",
    "## Main Flow",
    "## Edge Cases",
    "## Postconditions"
  ],
  wireframe: [
    "## Screen Purpose",
    "## Primary Actor",
    "## Main Sections",
    "## Fields/Inputs",
    "## Actions/Buttons",
    "## States/Messages",
    "## Notes"
  ],
  stories: ["## User Stories", "## Acceptance Criteria"],
  techspec: ["## Architecture", "## Data Model", "## APIs", "## Risks"]
};

const CORE_UPSTREAM_BY_ARTIFACT: Record<CoreArtifactType, CoreArtifactType[]> = {
  prd: [],
  workflow: ["prd"],
  wireframe: ["prd", "workflow"],
  stories: ["prd"],
  techspec: ["prd", "stories"]
};

const CORE_REQUIRED_CONTRACTS_BY_ARTIFACT: Record<
  CoreArtifactType,
  Array<keyof ContractCoverage>
> = {
  prd: ["goals", "core_features"],
  workflow: ["core_features"],
  wireframe: ["core_features"],
  stories: ["core_features"],
  techspec: ["core_features", "constraints"]
};

export function defaultOutputDir(artifactType: string): string {
  return CORE_OUTPUT_DIR_BY_ARTIFACT[artifactType as CoreArtifactType] ?? `${artifactType}s`;
}

export function defaultRequiredHeadings(artifactType: string): string[] {
  return CORE_REQUIRED_HEADINGS[artifactType as CoreArtifactType] ?? ["## Summary", "## Details"];
}

export function defaultUpstreamByArtifact(artifactType: string): string[] {
  return CORE_UPSTREAM_BY_ARTIFACT[artifactType as CoreArtifactType] ?? [];
}

export function defaultRequiredContractsByArtifact(
  artifactType: string
): Array<keyof ContractCoverage> {
  return CORE_REQUIRED_CONTRACTS_BY_ARTIFACT[artifactType as CoreArtifactType] ?? ["core_features"];
}
