import fs from "node:fs/promises";
import {
  overrideTemplateCandidatePaths,
  templateCandidatePaths
} from "./paths";
import { extractRequiredHeadings } from "./markdown";
import type { ArtifactType } from "./types";
import { fileExists } from "./utils";

type ResolveOptions = {
  cwd: string;
  artifactType: ArtifactType;
};

export async function resolveTemplate(options: ResolveOptions): Promise<{ path: string; content: string } | null> {
  const { cwd, artifactType } = options;
  const candidates: string[] = [
    ...overrideTemplateCandidatePaths(cwd, artifactType),
    ...templateCandidatePaths(cwd, artifactType)
  ];

  for (const filePath of candidates) {
    if (await fileExists(filePath)) {
      const content = await fs.readFile(filePath, "utf8");
      return { path: filePath, content };
    }
  }
  return null;
}

export async function resolveCompanionTemplate(
  options: ResolveOptions
): Promise<{ path: string; content: string } | null> {
  const { cwd, artifactType } = options;
  const nativeExt = artifactType === "workflow" ? ".mmd" : artifactType === "wireframe" ? ".html" : null;
  if (!nativeExt) return null;

  const candidates: string[] = [
    ...overrideTemplateCandidatePaths(cwd, artifactType),
    ...templateCandidatePaths(cwd, artifactType)
  ].filter((candidate) => candidate.toLowerCase().endsWith(nativeExt));

  for (const filePath of candidates) {
    if (await fileExists(filePath)) {
      const content = await fs.readFile(filePath, "utf8");
      return { path: filePath, content };
    }
  }
  return null;
}

export function extractRequiredHeadingsFromTemplate(content: string): string[] {
  return extractRequiredHeadings(content);
}
