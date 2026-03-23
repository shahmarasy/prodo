import type { ArtifactType } from "./types";
import type { WorkflowCommand } from "./workflow-commands";
export declare function schemaTemplate(artifactType: ArtifactType): Record<string, unknown>;
export declare function promptTemplate(artifactType: ArtifactType, lang?: string): string;
export declare function artifactTemplateTemplate(artifactType: ArtifactType, lang?: string): string;
export declare const START_BRIEF_TEMPLATE = "# Product Brief\n\n## Product Name\nExample Product\n\n## Problem\nDescribe the user problem.\n\n## Audience\nWho this product is for.\n\n## Core Features\n- Feature A\n- Feature B\n\n## Goals\n- Goal 1\n- Goal 2\n\n## Constraints\n- Budget or timeline constraints\n- Compliance or technical constraints\n";
export declare const NORMALIZED_BRIEF_TEMPLATE: {
    schema_version: string;
    product_name: string;
    problem: string;
    audience: string[];
    goals: string[];
    core_features: string[];
    constraints: string[];
    assumptions: string[];
    contracts: {
        goals: {
            id: string;
            text: string;
        }[];
        core_features: {
            id: string;
            text: string;
        }[];
        constraints: {
            id: string;
            text: string;
        }[];
    };
};
export declare const NORMALIZE_PROMPT_TEMPLATE = "Normalize start-brief content into JSON.\n\nReturn JSON object with keys:\n- schema_version (string)\n- product_name (string)\n- problem (string)\n- audience (string[])\n- goals (string[])\n- core_features (string[])\n- constraints (string[])\n- assumptions (string[])\n- contracts.goals[] ({id,text})\n- contracts.core_features[] ({id,text})\n- contracts.constraints[] ({id,text})\n- confidence.product_name (0..1)\n- confidence.problem (0..1)\n- confidence.audience (0..1)\n- confidence.goals (0..1)\n- confidence.core_features (0..1)\n\nRules:\n- do NOT invent missing critical content\n- keep wording concise and concrete\n- if critical field is missing, return empty and low confidence (<0.7)\n- assign deterministic IDs: goals => G1..Gn, features => F1..Fn, constraints => C1..Cn\n- input files are read-only; never modify, summarize, or rewrite `brief.md` in-place\n- write normalized output as a new JSON object only";
export declare function commandTemplate(command: WorkflowCommand): string;
export declare const HOOKS_TEMPLATE = "# Hook item fields:\n# - command: string (required)\n# - optional: boolean (default false)\n# - enabled: boolean (default true)\n# - condition: shell command; run hook only if condition exits 0\n# - timeout_ms: per-attempt timeout in milliseconds (default 30000)\n# - retry: extra retry count after first attempt (default 0)\n# - retry_delay_ms: delay between retries (default 500)\n#\n# Example:\n# hooks:\n#   before_prd:\n#     - command: \"node -e \\\"console.log('lint ok')\\\"\"\n#       optional: false\n#       enabled: true\n#       condition: \"node -e \\\"process.exit(0)\\\"\"\n#       timeout_ms: 15000\n#       retry: 1\n#       retry_delay_ms: 300\n\nhooks:\n  before_normalize: []\n  after_normalize: []\n  before_prd: []\n  after_prd: []\n  before_workflow: []\n  after_workflow: []\n  before_wireframe: []\n  after_wireframe: []\n  before_stories: []\n  after_stories: []\n  before_techspec: []\n  after_techspec: []\n  before_validate: []\n  after_validate: []\n";
