import path from "node:path";
import { defaultOutputDir, PRODO_DIR } from "./constants";
import type { ArtifactType } from "./types";

export function prodoPath(cwd: string): string {
  return path.join(cwd, PRODO_DIR);
}

export function briefPath(cwd: string): string {
  return path.join(cwd, "brief.md");
}

export function normalizedBriefPath(cwd: string): string {
  return path.join(prodoPath(cwd), "briefs", "normalized-brief.json");
}

export function settingsPath(cwd: string): string {
  return path.join(prodoPath(cwd), "settings.json");
}

export function registryPath(cwd: string): string {
  return path.join(prodoPath(cwd), "registry.json");
}

export function promptPath(cwd: string, artifactType: ArtifactType): string {
  return path.join(prodoPath(cwd), "prompts", `${artifactType}.md`);
}

export function templatePath(cwd: string, artifactType: ArtifactType): string {
  return path.join(prodoPath(cwd), "templates", `${artifactType}.md`);
}

export function overrideTemplatePath(cwd: string, artifactType: ArtifactType): string {
  return path.join(prodoPath(cwd), "templates", "overrides", `${artifactType}.md`);
}

function templateExtensionsForArtifact(artifactType: ArtifactType): string[] {
  if (artifactType === "workflow") return ["md", "mmd"];
  if (artifactType === "wireframe") return ["md", "html"];
  return ["md"];
}

export function templateCandidatePaths(cwd: string, artifactType: ArtifactType): string[] {
  const root = path.join(prodoPath(cwd), "templates");
  return templateExtensionsForArtifact(artifactType).map((ext) => path.join(root, `${artifactType}.${ext}`));
}

export function overrideTemplateCandidatePaths(cwd: string, artifactType: ArtifactType): string[] {
  const root = path.join(prodoPath(cwd), "templates", "overrides");
  return templateExtensionsForArtifact(artifactType).map((ext) => path.join(root, `${artifactType}.${ext}`));
}

export function schemaPath(cwd: string, artifactType: ArtifactType): string {
  return path.join(prodoPath(cwd), "schemas", `${artifactType}.yaml`);
}

export function outputDirPath(cwd: string, artifactType: ArtifactType, outputDirOverride?: string): string {
  return path.join(cwd, "product-docs", outputDirOverride ?? defaultOutputDir(artifactType));
}

export function reportPath(cwd: string): string {
  return path.join(cwd, "product-docs", "reports", "latest-validation.md");
}

export function outputIndexPath(cwd: string): string {
  return path.join(prodoPath(cwd), "state", "index.json");
}

export function outputContextDirPath(cwd: string): string {
  return path.join(prodoPath(cwd), "state", "context");
}

