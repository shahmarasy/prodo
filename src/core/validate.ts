import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { listArtifactDefinitions } from "./artifact-registry";
import { checkConsistency } from "./consistency";
import { UserError } from "./errors";
import { getActiveArtifactPath } from "./output-index";
import { normalizedBriefPath, outputDirPath, reportPath } from "./paths";
import { extractRequiredHeadingsFromTemplate, resolveTemplate } from "./template-resolver";
import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
import { ensureDir, fileExists, isPathInside, listFilesSortedByMtime, readJsonFile } from "./utils";
import { validateSchema } from "./validator";

type LoadedArtifact = {
  type: ArtifactType;
  file: string;
  doc: ArtifactDoc;
};

function sidecarPath(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.artifact.json`);
}

async function loadArtifactDoc(filePath: string): Promise<ArtifactDoc> {
  const sidecar = sidecarPath(filePath);
  if (await fileExists(sidecar)) {
    const payload = await readJsonFile<Record<string, unknown>>(sidecar);
    return {
      frontmatter: (payload.frontmatter as Record<string, unknown>) ?? {},
      body: typeof payload.body === "string" ? payload.body : ""
    };
  }
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content
  };
}

async function loadLatestArtifacts(cwd: string): Promise<LoadedArtifact[]> {
  const defs = await listArtifactDefinitions(cwd);
  const loaded: LoadedArtifact[] = [];
  for (const def of defs) {
    const type = def.name;
    const active = await getActiveArtifactPath(cwd, type);
    const fallback = async (): Promise<string | undefined> => {
      const files = await listFilesSortedByMtime(outputDirPath(cwd, type, def.output_dir));
      return files[0];
    };
    const latest = active ?? (await fallback());
    if (!latest) continue;
    const parsed = await loadArtifactDoc(latest);
    loaded.push({
      type,
      file: latest,
      doc: parsed
    });
  }
  return loaded;
}

async function listHtmlFiles(dir: string): Promise<string[]> {
  if (!(await fileExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => path.join(dir, entry.name));
}

function formatIssue(issue: ValidationIssue): string {
  const location = issue.file ? ` (${issue.file})` : "";
  const field = issue.field ? ` [${issue.field}]` : "";
  const check = issue.check ? ` [${issue.check}]` : "";
  const fix = issue.suggestion ? `\n  Suggestion: ${issue.suggestion}` : "";
  return `- [${issue.level.toUpperCase()}] ${issue.code}${check}${field}: ${issue.message}${location}${fix}`;
}

async function writeReport(targetPath: string, issues: ValidationIssue[]): Promise<void> {
  const status = issues.some((issue) => issue.level === "error") ? "FAIL" : "PASS";
  const schemaIssues = issues.filter((issue) => issue.check === "schema");
  const coverageIssues = issues.filter((issue) => issue.check === "tag_coverage");
  const relevanceIssues = issues.filter((issue) => issue.check === "contract_relevance");
  const semanticIssues = issues.filter((issue) => issue.check === "semantic_consistency");
  const gate = (set: ValidationIssue[]) => (set.some((issue) => issue.level === "error") ? "FAIL" : "PASS");
  const content = [
    "# Prodo Validation Report",
    "",
    `Status: **${status}**`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Gate Results",
    `- Schema pass: ${gate(schemaIssues)}`,
    `- Tag coverage pass: ${gate(coverageIssues)}`,
    `- Contract relevance pass: ${gate(relevanceIssues)}`,
    `- Semantic consistency pass: ${gate(semanticIssues)}`,
    "",
    "## Findings",
    issues.length === 0 ? "- No issues found." : issues.map(formatIssue).join("\n"),
    ""
  ].join("\n");

  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

export type ValidateResult = {
  pass: boolean;
  reportPath: string;
  issues: ValidationIssue[];
};

export async function runValidate(
  cwd: string,
  options: { strict?: boolean; report?: string }
): Promise<ValidateResult> {
  const normalizedPath = normalizedBriefPath(cwd);
  if (!(await fileExists(normalizedPath))) {
    throw new UserError("Missing `.prodo/briefs/normalized-brief.json`. Run `prodo-init` and create it first.");
  }

  const normalizedBrief = await readJsonFile<Record<string, unknown>>(normalizedPath);
  const loaded = await loadLatestArtifacts(cwd);
  const issues: ValidationIssue[] = [];

  for (const artifact of loaded) {
    const template = await resolveTemplate({
      cwd,
      artifactType: artifact.type
    });
    const headings = template ? extractRequiredHeadingsFromTemplate(template.content) : [];
    const schemaCheck = await validateSchema(
      cwd,
      artifact.type,
      artifact.doc,
      headings
    );
    issues.push(...schemaCheck.issues.map((issue) => ({ ...issue, file: artifact.file })));

    if (artifact.type === "workflow") {
      const ext = path.extname(artifact.file).toLowerCase();
      if (ext !== ".md") {
        issues.push({
          level: "error",
          code: "workflow_markdown_missing",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          message: "Workflow explanation artifact must be Markdown (.md).",
          suggestion: "Regenerate workflow so explanation is written to .md."
        });
      }
      const mmdPath = path.join(path.dirname(artifact.file), `${path.parse(artifact.file).name}.mmd`);
      if (!(await fileExists(mmdPath))) {
        issues.push({
          level: "error",
          code: "workflow_mermaid_missing",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          message: "Workflow Mermaid companion file (.mmd) is missing.",
          suggestion: "Regenerate workflow so markdown and .mmd are produced as a pair."
        });
      } else {
        const mmdRaw = await fs.readFile(mmdPath, "utf8");
        const mermaidLike = /(^|\n)\s*flowchart\s+/i.test(mmdRaw) || /(^|\n)\s*graph\s+/i.test(mmdRaw);
        if (!mermaidLike) {
          issues.push({
            level: "error",
            code: "workflow_mermaid_invalid",
            check: "schema",
            artifactType: artifact.type,
            file: mmdPath,
            message: "Workflow Mermaid file is invalid or prose-only.",
            suggestion: "Ensure .mmd file contains valid Mermaid diagram syntax."
          });
        }
      }
    }

    if (artifact.type === "wireframe") {
      const ext = path.extname(artifact.file).toLowerCase();
      if (ext !== ".md") {
        issues.push({
          level: "error",
          code: "wireframe_markdown_missing",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          message: "Wireframe explanation artifact must be Markdown (.md).",
          suggestion: "Regenerate wireframe so explanation is written to .md."
        });
      }

      const htmlPath = path.join(path.dirname(artifact.file), `${path.parse(artifact.file).name}.html`);
      if (!(await fileExists(htmlPath))) {
        issues.push({
          level: "error",
          code: "wireframe_html_missing",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          message: "Wireframe HTML companion file is missing.",
          suggestion: "Regenerate wireframe so markdown and .html are produced as a pair."
        });
      } else {
        const htmlRaw = await fs.readFile(htmlPath, "utf8");
        const htmlLooksValid = /<!doctype html>/i.test(htmlRaw) || /<html[\s>]/i.test(htmlRaw);
        if (!htmlLooksValid) {
          issues.push({
            level: "error",
            code: "wireframe_html_invalid",
            check: "schema",
            artifactType: artifact.type,
            file: htmlPath,
            message: "Wireframe output is not valid HTML content.",
            suggestion: "Ensure wireframe companion HTML contains a valid document structure."
          });
        }
      }

      const htmlFiles = await listHtmlFiles(path.dirname(artifact.file));
      if (htmlFiles.length < 1) {
        issues.push({
          level: "error",
          code: "wireframe_screens_missing",
          check: "schema",
          artifactType: artifact.type,
          file: artifact.file,
          message: "Wireframe must include at least one HTML screen artifact.",
          suggestion: "Regenerate wireframe to create paired .md and .html screen files."
        });
      }
    }
  }

  issues.push(...(await checkConsistency(cwd, loaded, normalizedBrief)));
  if (options.strict) {
    for (const issue of issues) {
      if (issue.level === "warning") issue.level = "error";
    }
  }

  const finalReportPath = options.report ? path.resolve(cwd, options.report) : reportPath(cwd);
  if (!isPathInside(path.join(cwd, "product-docs"), finalReportPath)) {
    throw new UserError("Validation report must be inside `product-docs/`.");
  }
  await writeReport(finalReportPath, issues);
  const pass = !issues.some((issue) => issue.level === "error");
  return { pass, reportPath: finalReportPath, issues };
}
