"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
const promises_1 = __importDefault(require("node:fs/promises"));
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const markdown_1 = require("./markdown");
const paths_1 = require("./paths");
const ajv = new _2020_1.default({ allErrors: true, strict: false });
(0, ajv_formats_1.default)(ajv);
async function resolveSchema(cwd, artifactType) {
    const raw = await promises_1.default.readFile((0, paths_1.schemaPath)(cwd, artifactType), "utf8");
    return js_yaml_1.default.load(raw);
}
function requiredHeadingsFromSchema(schema) {
    if (!Array.isArray(schema.x_required_headings))
        return [];
    return schema.x_required_headings.filter((item) => typeof item === "string");
}
async function validateSchema(cwd, artifactType, doc, requiredHeadingsOverride) {
    const schema = await resolveSchema(cwd, artifactType);
    const requiredHeadings = requiredHeadingsOverride && requiredHeadingsOverride.length > 0
        ? requiredHeadingsOverride
        : requiredHeadingsFromSchema(schema);
    const workingSchema = { ...schema };
    delete workingSchema.x_required_headings;
    const validate = ajv.compile(workingSchema);
    const valid = validate(doc);
    const issues = [];
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
    const sections = (0, markdown_1.sectionTextMap)(doc.body);
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
