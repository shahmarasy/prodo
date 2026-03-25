import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import yaml from "js-yaml";
import { sectionTextMap } from "./markdown";
import type { ArtifactDoc, ArtifactType, ValidationIssue } from "./types";
import { schemaPath } from "./paths";

type SchemaWithHeading = Record<string, unknown> & {
  x_required_headings?: unknown;
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

async function resolveSchema(
  cwd: string,
  artifactType: ArtifactType
): Promise<SchemaWithHeading> {
  const raw = await fs.readFile(schemaPath(cwd, artifactType), "utf8");
  return yaml.load(raw) as SchemaWithHeading;
}

function requiredHeadingsFromSchema(schema: SchemaWithHeading): string[] {
  if (!Array.isArray(schema.x_required_headings)) return [];
  return schema.x_required_headings.filter((item): item is string => typeof item === "string");
}

export async function validateSchema(
  cwd: string,
  artifactType: ArtifactType,
  doc: ArtifactDoc,
  requiredHeadingsOverride?: string[]
): Promise<{ issues: ValidationIssue[]; requiredHeadings: string[] }> {
  const schema = await resolveSchema(cwd, artifactType);
  const requiredHeadings =
    requiredHeadingsOverride && requiredHeadingsOverride.length > 0
      ? requiredHeadingsOverride
      : requiredHeadingsFromSchema(schema);
  const workingSchema: Record<string, unknown> = { ...schema };
  delete workingSchema.x_required_headings;

  const validate = ajv.compile(workingSchema);
  const valid = validate(doc);
  const issues: ValidationIssue[] = [];

  if (!valid && validate.errors) {
    for (const err of validate.errors) {
      issues.push({
        level: "error",
        code: "schema_validation_failed",
        check: "schema",
        artifactType,
        field: err.instancePath || err.schemaPath,
        message: `Schema validation error: ${err.message ?? "unknown error"}`,
        suggestion: "Adjust the generated content to satisfy schema requirements."
      });
    }
  }

  const sections = sectionTextMap(doc.body);
  for (const heading of requiredHeadings) {
    if (!doc.body.includes(heading)) {
      issues.push({
        level: "error",
        code: "missing_required_heading",
        check: "schema",
        artifactType,
        field: heading,
        message: `Required section missing: ${heading}`,
        suggestion: "Regenerate or manually edit the artifact to include all required headings."
      });
      continue;
    }

    const content = sections.get(heading) ?? "";
    const isPlaceholder = /(tbd|to be defined|i don't know|unknown|n\/a)/i.test(content);
    if (content.trim().length < 20 || isPlaceholder) {
      issues.push({
        level: "error",
        code: "weak_required_heading_content",
        check: "schema",
        artifactType,
        field: heading,
        message: `Section has weak or placeholder content: ${heading}`,
        suggestion: "Replace placeholders with concrete, actionable details."
      });
    }
  }

  return { issues, requiredHeadings };
}
