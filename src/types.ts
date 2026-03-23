export const CORE_ARTIFACT_TYPES = ["prd", "workflow", "wireframe", "stories", "techspec"] as const;
export const ARTIFACT_TYPES = CORE_ARTIFACT_TYPES;

export type CoreArtifactType = (typeof CORE_ARTIFACT_TYPES)[number];
export type ArtifactType = CoreArtifactType | string;

export type ArtifactDoc = {
  frontmatter: Record<string, unknown>;
  body: string;
};

export type ContractCoverage = {
  goals: string[];
  core_features: string[];
  constraints: string[];
};

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  check?: "schema" | "tag_coverage" | "semantic_consistency" | "contract_relevance";
  artifactType?: ArtifactType;
  file?: string;
  field?: string;
  message: string;
  suggestion?: string;
};

export type GenerateResult = {
  body: string;
  frontmatter?: Record<string, unknown>;
};

export type ProviderSchemaHint = {
  artifactType: ArtifactType | "normalize" | "semantic_consistency" | "contract_relevance";
  requiredHeadings: string[];
  requiredContracts: Array<keyof ContractCoverage>;
};

export type LLMProvider = {
  generate: (
    prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ) => Promise<GenerateResult>;
};
