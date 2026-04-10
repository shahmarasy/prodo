"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArtifact = generateArtifact;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const i18n_1 = require("../i18n");
const constants_1 = require("./constants");
const artifact_registry_1 = require("./artifact-registry");
const errors_1 = require("./errors");
const normalized_brief_1 = require("./normalized-brief");
const output_index_1 = require("./output-index");
const paths_1 = require("./paths");
const providers_1 = require("../providers");
const template_resolver_1 = require("./template-resolver");
const settings_1 = require("./settings");
const markdown_1 = require("./markdown");
const utils_1 = require("./utils");
const validator_1 = require("./validator");
function defaultFilename(type) {
    return `${type}-${(0, utils_1.artifactFileStamp)()}.md`;
}
function sidecarPath(filePath) {
    const parsed = node_path_1.default.parse(filePath);
    return node_path_1.default.join(parsed.dir, `${parsed.name}.artifact.json`);
}
async function writeSidecar(filePath, doc) {
    const payload = {
        frontmatter: doc.frontmatter,
        body: doc.body
    };
    await promises_1.default.writeFile(sidecarPath(filePath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
async function loadArtifactDoc(filePath) {
    const sidecar = sidecarPath(filePath);
    if (await (0, utils_1.fileExists)(sidecar)) {
        const loaded = await (0, utils_1.readJsonFile)(sidecar);
        return {
            frontmatter: loaded.frontmatter ?? {},
            body: typeof loaded.body === "string" ? loaded.body : ""
        };
    }
    const raw = await promises_1.default.readFile(filePath, "utf8");
    const parsed = (0, gray_matter_1.default)(raw);
    return {
        frontmatter: parsed.data,
        body: parsed.content
    };
}
function languageProbe(body) {
    const stripped = body
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/^\s*#{1,6}\s+.*$/gm, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    return ` ${stripped} `;
}
function hasEnglishLeak(body) {
    const englishMarkers = [" the ", " and ", " with ", " user ", " should ", " must ", " requirement ", " flow ", " error ", " success "];
    const normalized = languageProbe(body);
    return englishMarkers.filter((m) => normalized.includes(m)).length >= 2;
}
function hasTurkishLeak(body) {
    const turkishMarkers = [
        " ve ",
        " ile ",
        " kullanici ",
        " kullanıcı ",
        " akis ",
        " akış ",
        " hata ",
        " basari ",
        " başarı ",
        " ekran ",
        " islem ",
        " işlem ",
        " gerekli "
    ];
    const normalized = languageProbe(body);
    return turkishMarkers.filter((m) => normalized.includes(m)).length >= 2;
}
function enforceLanguage(body, lang, artifactType) {
    const normalized = (lang || "en").toLowerCase();
    if (normalized.startsWith("tr")) {
        if (!hasEnglishLeak(body))
            return;
        throw new errors_1.UserError(`Language enforcement failed for ${artifactType}: output contains English fragments while language is Turkish.`);
    }
    if (normalized.startsWith("en")) {
        if (!hasTurkishLeak(body))
            return;
        throw new errors_1.UserError(`Language enforcement failed for ${artifactType}: output contains Turkish fragments while language is English.`);
    }
}
function toSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "screen";
}
function extractTurkishTitle(featureText) {
    const base = featureText.replace(/^\[[A-Z][0-9]+\]\s*/, "").trim();
    if (!base)
        return "Ekran";
    return base;
}
function replaceTemplateTokens(template, replacements, fallbackFromToken) {
    const context = {};
    for (const [key, value] of Object.entries(replacements)) {
        const nunjucksKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
        context[nunjucksKey] = value;
    }
    let prepared = template;
    for (const [key, value] of Object.entries(replacements)) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        prepared = prepared.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "g"), value);
    }
    return prepared.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, tokenRaw) => {
        const token = String(tokenRaw).trim();
        if (token.includes("|") || token.includes("%"))
            return _match;
        return fallbackFromToken(token);
    });
}
function renderWorkflowMermaidTemplate(templateContent, normalized, coverage, lang) {
    const primaryFeatureId = coverage.core_features[0] ?? normalized.contracts.core_features[0]?.id ?? "F1";
    const primaryFeatureText = normalized.contracts.core_features.find((item) => item.id === primaryFeatureId)?.text ??
        normalized.contracts.core_features[0]?.text ??
        (0, i18n_1.t)("user_action", lang);
    return replaceTemplateTokens(templateContent, {
        "Flow Name": (0, i18n_1.t)("main_flow", lang),
        "Primary Actor": normalized.audience[0] ?? (0, i18n_1.t)("user", lang),
        "Primary Action": `[${primaryFeatureId}] ${primaryFeatureText}`,
        "Success State": (0, i18n_1.t)("success", lang),
        "Error State": (0, i18n_1.t)("error", lang)
    }, (token) => {
        const key = token.toLowerCase();
        if (key.includes("actor") || key.includes("user"))
            return normalized.audience[0] ?? (0, i18n_1.t)("user", lang);
        if (key.includes("action") || key.includes("feature"))
            return `[${primaryFeatureId}] ${primaryFeatureText}`;
        if (key.includes("success"))
            return (0, i18n_1.t)("success", lang);
        if (key.includes("error") || key.includes("fail"))
            return (0, i18n_1.t)("error", lang);
        if (key.includes("flow"))
            return (0, i18n_1.t)("main_flow", lang);
        return token;
    });
}
function normalizeAuthor(author) {
    if (!author)
        return undefined;
    const normalized = author.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function replaceAuthorPlaceholders(body, author) {
    const safeAuthor = normalizeAuthor(author);
    if (!safeAuthor)
        return body;
    return body.replace(/\{\{\s*author\s*\}\}/gi, safeAuthor);
}
function todayYmd() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function headingKey(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function defaultDocumentControlValues(lang, revisionType, version, author) {
    const safeAuthor = normalizeAuthor(author) ?? "Prodo";
    const description = revisionType === "fix"
        ? (0, i18n_1.t)("fix_revision", lang)
        : (0, i18n_1.t)("initial_version", lang);
    return {
        version,
        date: todayYmd(),
        author: safeAuthor,
        description
    };
}
function applyDocumentControlDefaults(body, options) {
    const defaults = defaultDocumentControlValues(options.lang, options.revisionType, options.version, options.author);
    let out = body
        .replace(/\{\{\s*date\s*\}\}/gi, defaults.date)
        .replace(/\{\{\s*description\s*\}\}/gi, defaults.description)
        .replace(/\{\{\s*version\s*\}\}/gi, defaults.version);
    const lines = out.split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => {
        const match = line.match(/^\s*##+\s+(.+?)\s*$/);
        if (!match)
            return false;
        const key = headingKey(match[1]);
        return key.includes("document control") || key.includes("belge kontrol");
    });
    if (headingIndex === -1)
        return out;
    const row = `| ${defaults.version} | ${defaults.date} | ${defaults.author} | ${defaults.description} |`;
    let tableSeparatorIndex = -1;
    let tableDataIndex = -1;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
        if (/^\s*##+\s+/.test(lines[i]))
            break;
        if (tableSeparatorIndex === -1 && /\|/.test(lines[i]) && /-/.test(lines[i])) {
            tableSeparatorIndex = i;
            continue;
        }
        if (tableSeparatorIndex !== -1 && /^\s*\|/.test(lines[i])) {
            tableDataIndex = i;
            break;
        }
    }
    if (tableDataIndex !== -1) {
        lines[tableDataIndex] = row;
    }
    else if (tableSeparatorIndex !== -1) {
        lines.splice(tableSeparatorIndex + 1, 0, row);
    }
    else {
        lines.splice(headingIndex + 1, 0, "", "| Version | Date | Author | Description |", "|--------|------|--------|-------------|", row, "");
    }
    out = lines.join("\n");
    return out;
}
function parseVersionToken(input) {
    const match = input.match(/v?\s*(\d+)(?:\.(\d+))?/i);
    if (!match)
        return null;
    const major = Number(match[1]);
    const minor = Number(match[2] ?? "0");
    if (!Number.isFinite(major) || !Number.isFinite(minor))
        return null;
    return { major, minor };
}
function extractDocumentControlVersion(body) {
    const tableMatch = body.match(/\|\s*(v?\d+(?:\.\d+)?)\s*\|/i);
    if (tableMatch?.[1])
        return tableMatch[1].trim().startsWith("v") ? tableMatch[1].trim() : `v${tableMatch[1].trim()}`;
    const looseMatch = body.match(/\bv?\d+\.\d+\b/i);
    if (looseMatch?.[0])
        return looseMatch[0].startsWith("v") ? looseMatch[0] : `v${looseMatch[0]}`;
    return undefined;
}
async function resolveDocumentControlVersion(cwd, artifactType, revisionType) {
    if (revisionType !== "fix")
        return "v1.0";
    const activePath = await (0, output_index_1.getActiveArtifactPath)(cwd, artifactType);
    const fallbackPath = activePath ?? (await loadLatestArtifactPath(cwd, artifactType));
    if (!fallbackPath || !(await (0, utils_1.fileExists)(fallbackPath))) {
        return "v1.1";
    }
    try {
        const previous = await loadArtifactDoc(fallbackPath);
        const previousVersion = extractDocumentControlVersion(previous.body) ?? String(previous.frontmatter.version ?? "");
        const parsed = parseVersionToken(previousVersion);
        if (!parsed)
            return "v1.1";
        return `v${parsed.major}.${parsed.minor + 1}`;
    }
    catch {
        return "v1.1";
    }
}
function enforceAuthorInControlTables(body, author) {
    const safeAuthor = normalizeAuthor(author);
    if (!safeAuthor)
        return body;
    return body.replace(/(\|\s*v?[0-9.]+\s*\|\s*[^|]*\|\s*)([^|]*)(\|\s*[^|]*\|)/gi, (_match, left, _current, right) => `${left}${safeAuthor} ${right}`);
}
async function resolveUniqueOutputPath(targetDir, fileName) {
    const parsed = node_path_1.default.parse(fileName);
    let candidate = node_path_1.default.join(targetDir, fileName);
    let index = 2;
    while (await (0, utils_1.fileExists)(candidate)) {
        candidate = node_path_1.default.join(targetDir, `${parsed.name}-${String(index).padStart(2, "0")}${parsed.ext}`);
        index += 1;
    }
    return candidate;
}
function workflowFeatureTargets(normalized, coverage) {
    const byId = new Map(normalized.contracts.core_features.map((item) => [item.id, item]));
    const explicit = coverage.core_features
        .map((id) => byId.get(id))
        .filter((item) => Boolean(item));
    if (explicit.length > 1)
        return explicit;
    if (normalized.contracts.core_features.length > 1)
        return normalized.contracts.core_features.slice(0, 6);
    if (explicit.length === 1)
        return explicit;
    return normalized.contracts.core_features.slice(0, 1);
}
function renderWorkflowMarkdownForFeature(markdown, feature, lang) {
    const tr = lang.toLowerCase().startsWith("tr");
    const noteHeading = "## " + (0, i18n_1.t)("flow_focus", lang);
    const noteLine = tr
        ? `- [${feature.id}] Bu akis ${feature.text} ihtiyacina odaklanir.`
        : `- [${feature.id}] This flow focuses on ${feature.text}.`;
    if (markdown.includes(noteHeading))
        return markdown;
    return `${markdown.trim()}\n\n${noteHeading}\n${noteLine}`.trim();
}
async function resolvePrompt(cwd, artifactType, templateContent, requiredHeadings, companionTemplate, outputAuthor, agent) {
    const base = await promises_1.default.readFile((0, paths_1.promptPath)(cwd, artifactType), "utf8");
    const authority = `Template authority (STRICT):
- Treat this template as the single output structure source.
- Keep heading order and names exactly as listed.
- Do not invent new primary sections.

Required headings (from template):
${requiredHeadings.map((heading) => `- ${heading}`).join("\n")}

Resolved template:
\`\`\`md
${templateContent.trim()}
\`\`\``;
    const companionAuthority = companionTemplate
        ? `Native companion template (STRICT reference):
- Path: ${companionTemplate.path}
- Preserve this native format and structure when generating companion artifact.
\`\`\`${artifactType === "workflow" ? "mermaid" : "html"}
${companionTemplate.content.trim()}
\`\`\``
        : "";
    const workflowPairing = artifactType === "workflow"
        ? `
Workflow paired output contract (STRICT):
- Output markdown explanation first (template headings).
- Then append a mermaid block for the same flow:
\`\`\`mermaid
flowchart TD
  ...
\`\`\`
- Mermaid block is mandatory.`
        : "";
    const wireframePairing = artifactType === "wireframe"
        ? `
Wireframe paired output contract (STRICT):
- Output markdown explanation first (template headings).
- Generate companion HTML screens based on native wireframe template.
- HTML must stay low-fidelity and structure-first.`
        : "";
    const authorPolicy = outputAuthor && outputAuthor.trim().length > 0
        ? `
Author policy (STRICT):
- Use this exact author name wherever author is required: ${outputAuthor.trim()}
- Do not invent random author names.`
        : "";
    const withTemplate = `${base}

${authority}
${companionAuthority}
${workflowPairing}
${wireframePairing}
${authorPolicy}`;
    if (!agent)
        return withTemplate;
    return `${withTemplate}

Agent execution profile: ${agent}
- Keep output deterministic and actionable.`;
}
async function loadLatestArtifactPath(cwd, type) {
    const def = await (0, artifact_registry_1.getArtifactDefinition)(cwd, type);
    const active = await (0, output_index_1.getActiveArtifactPath)(cwd, type);
    if (active)
        return active;
    const files = await (0, utils_1.listFilesSortedByMtime)((0, paths_1.outputDirPath)(cwd, type, def.output_dir));
    return files[0];
}
function contextFilePath(cwd, artifactFile) {
    const base = node_path_1.default.parse(artifactFile).name;
    return node_path_1.default.join((0, paths_1.outputContextDirPath)(cwd), `${base}.json`);
}
function toLineItems(value) {
    if (!value)
        return [];
    return value
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-*0-9.]+\s*/, "").trim())
        .filter((line) => line.length > 0);
}
function parseHeadingTitle(fullHeading) {
    return fullHeading.replace(/^##\s+/, "").trim();
}
function deriveStructuredContext(artifactType, body, requiredHeadings) {
    const sections = (0, markdown_1.sectionTextMap)(body);
    const ordered = requiredHeadings
        .map((heading) => ({ heading, items: toLineItems(sections.get(heading)) }))
        .filter((item) => item.items.length > 0);
    const section_map = Object.fromEntries(Array.from(sections.entries()).map(([heading, text]) => [parseHeadingTitle(heading), toLineItems(text)]));
    if (artifactType === "workflow") {
        return {
            section_map,
            actor_map: ordered[0]?.items ?? [],
            step_map: ordered[1]?.items ?? [],
            edge_case_map: ordered[2]?.items ?? []
        };
    }
    if (artifactType === "wireframe") {
        return {
            section_map,
            screen_map: ordered[0]?.items ?? [],
            interaction_map: ordered[1]?.items ?? []
        };
    }
    if (artifactType === "techspec") {
        return {
            section_map,
            architecture_map: ordered[0]?.items ?? [],
            integration_map: ordered[1]?.items ?? []
        };
    }
    if (artifactType === "stories") {
        return {
            section_map,
            story_map: ordered[0]?.items ?? [],
            acceptance_map: ordered[1]?.items ?? []
        };
    }
    return {
        section_map,
        goal_map: ordered[0]?.items ?? [],
        requirement_map: ordered[1]?.items ?? []
    };
}
async function buildUpstreamArtifacts(cwd, artifactType, upstreamTypes) {
    const refs = [];
    for (const type of upstreamTypes) {
        const latest = await loadLatestArtifactPath(cwd, type);
        if (!latest)
            continue;
        const parsed = await loadArtifactDoc(latest);
        const frontmatter = parsed.frontmatter;
        const coverageRaw = frontmatter.contract_coverage;
        const contextPath = contextFilePath(cwd, latest);
        const structuredContext = (await (0, utils_1.fileExists)(contextPath))
            ? await (0, utils_1.readJsonFile)(contextPath)
            : {};
        refs.push({
            type,
            file: latest,
            contractCoverage: {
                goals: Array.isArray(coverageRaw?.goals)
                    ? coverageRaw.goals.filter((item) => typeof item === "string")
                    : [],
                core_features: Array.isArray(coverageRaw?.core_features)
                    ? coverageRaw.core_features.filter((item) => typeof item === "string")
                    : [],
                constraints: Array.isArray(coverageRaw?.constraints)
                    ? coverageRaw.constraints.filter((item) => typeof item === "string")
                    : []
            },
            ...(Object.keys(structuredContext).length > 0 ? { structuredContext } : {})
        });
    }
    return refs;
}
function extractCoverageFromBody(body) {
    const tagged = {
        goals: Array.from(new Set(body.match(/\[(G[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? [])),
        core_features: Array.from(new Set(body.match(/\[(F[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? [])),
        constraints: Array.from(new Set(body.match(/\[(C[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? []))
    };
    return tagged;
}
function missingCoverage(requiredContracts, normalized, coverage) {
    const ids = (0, normalized_brief_1.contractIds)(normalized.contracts);
    const missing = [];
    for (const key of requiredContracts) {
        const expected = ids[key];
        if (expected.length === 0)
            continue;
        const missingIds = expected.filter((id) => !coverage[key].includes(id));
        if (missingIds.length > 0) {
            missing.push({ key, ids: missingIds });
        }
    }
    return missing;
}
async function ensurePipelinePrereqs(cwd, normalizedPath) {
    const prodoRoot = (0, paths_1.prodoPath)(cwd);
    if (!(await (0, utils_1.fileExists)(prodoRoot))) {
        throw new errors_1.UserError("Missing .prodo directory. Run `prodo-init` first.");
    }
    if (!(await (0, utils_1.fileExists)((0, paths_1.briefPath)(cwd)))) {
        throw new errors_1.UserError("Missing brief at `brief.md`. Run `prodo-init` or create the file.");
    }
    if (!(await (0, utils_1.fileExists)(normalizedPath))) {
        throw new errors_1.UserError("Missing normalized brief at `.prodo/briefs/normalized-brief.json`. Create it before generating artifacts.");
    }
}
function splitWorkflowPair(raw) {
    const match = raw.match(/```mermaid\s*([\s\S]*?)```/i);
    if (!match) {
        throw new errors_1.UserError("Workflow output is missing a Mermaid block. Regenerate with template-compliant paired output.");
    }
    const mermaid = match[1].trim();
    const markdown = raw.replace(match[0], "").trim();
    if (!markdown) {
        throw new errors_1.UserError("Workflow markdown explanation is empty.");
    }
    if (!/(^|\n)\s*(flowchart|graph)\s+/i.test(mermaid)) {
        throw new errors_1.UserError("Workflow Mermaid block is invalid.");
    }
    return { markdown, mermaid };
}
async function writeWorkflowFlows(targetDir, baseName, normalized, coverage, lang, markdownBody, mermaidBody, mermaidTemplateContent) {
    const targets = workflowFeatureTargets(normalized, coverage);
    const fallbackFeature = normalized.contracts.core_features[0] ?? { id: "F1", text: "Primary flow" };
    const flows = targets.length > 0 ? targets : [fallbackFeature];
    const summaryBodies = [];
    const renderedArtifacts = [];
    let primaryMdPath = "";
    for (const [index, flowFeature] of flows.entries()) {
        const flowBase = flows.length === 1
            ? baseName
            : (index === 0
                ? baseName
                : `${baseName}-${index + 1}-${toSlug(extractTurkishTitle(flowFeature.text))}`);
        const mdPath = node_path_1.default.join(targetDir, `${flowBase}.md`);
        const mmdPath = node_path_1.default.join(targetDir, `${flowBase}.mmd`);
        const featureCoverage = {
            ...coverage,
            core_features: [flowFeature.id]
        };
        const renderedMarkdown = renderWorkflowMarkdownForFeature(markdownBody, flowFeature, lang);
        const renderedMermaid = (mermaidTemplateContent && mermaidTemplateContent.trim().length > 0)
            ? renderWorkflowMermaidTemplate(mermaidTemplateContent, normalized, featureCoverage, lang).trim()
            : (mermaidBody ?? "").trim();
        if (!/(^|\n)\s*(flowchart|graph)\s+/i.test(renderedMermaid)) {
            throw new errors_1.UserError("Workflow Mermaid output is invalid.");
        }
        enforceLanguage(renderedMarkdown, lang, "workflow");
        enforceLanguage(renderedMermaid, lang, "workflow");
        await promises_1.default.writeFile(mdPath, `${renderedMarkdown}\n`, "utf8");
        await promises_1.default.writeFile(mmdPath, `${renderedMermaid}\n`, "utf8");
        if (!primaryMdPath)
            primaryMdPath = mdPath;
        summaryBodies.push(renderedMarkdown);
        renderedArtifacts.push({ mdPath, body: renderedMarkdown });
    }
    return {
        primaryPath: primaryMdPath,
        summaryBody: summaryBodies.join("\n\n"),
        rendered: renderedArtifacts
    };
}
async function writeWireframeScreens(targetDir, baseName, normalized, coverage, lang, headings, htmlTemplateContent) {
    const tr = lang.toLowerCase().startsWith("tr");
    const explicitScreens = normalized.contracts.core_features
        .filter((item) => coverage.core_features.includes(item.id))
        .slice(0, 6);
    const screens = explicitScreens.length > 1
        ? explicitScreens
        : (normalized.contracts.core_features.length > 1
            ? normalized.contracts.core_features.slice(0, 6)
            : (explicitScreens.length === 1
                ? explicitScreens
                : normalized.contracts.core_features.slice(0, 1)));
    const summaryBodies = [];
    let primaryMdPath = "";
    for (const [index, screen] of screens.entries()) {
        const title = extractTurkishTitle(screen.text);
        const screenBase = `${baseName}-${index + 1}-${toSlug(title)}`;
        const htmlPath = node_path_1.default.join(targetDir, `${screenBase}.html`);
        const mdPath = node_path_1.default.join(targetDir, `${screenBase}.md`);
        const fallbackHtml = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body>
  <!-- [${screen.id}] -->
  <header>
    <h1>${title}</h1>
    <nav><button type="button">${(0, i18n_1.t)("back", lang)}</button><button type="button">${(0, i18n_1.t)("next", lang)}</button></nav>
  </header>
  <main>
    <section>
      <h2>${(0, i18n_1.t)("content", lang)}</h2>
      <ul>
        <li>${(0, i18n_1.t)("primary_info_area", lang)}</li>
        <li>${(0, i18n_1.t)("status_indicator", lang)}</li>
      </ul>
    </section>
    <section>
      <h2>${(0, i18n_1.t)("form", lang)}</h2>
      <form>
        <label>${(0, i18n_1.t)("field", lang)}
          <input type="text" name="field_${index + 1}" />
        </label>
        <button type="submit">${(0, i18n_1.t)("save", lang)}</button>
      </form>
    </section>
  </main>
</body>
</html>`;
        const htmlTemplate = htmlTemplateContent && htmlTemplateContent.trim().length > 0 ? htmlTemplateContent : fallbackHtml;
        const html = replaceTemplateTokens(htmlTemplate, {
            "Screen Title": title,
            "Primary Action": (0, i18n_1.t)("save", lang),
            "Description Label": (0, i18n_1.t)("description", lang),
            "Description Placeholder": `[${screen.id}] ${screen.text}`,
            "Meta Label 1": (0, i18n_1.t)("contract", lang),
            "Meta Value 1": screen.id,
            "Meta Label 2": (0, i18n_1.t)("actor", lang),
            "Meta Value 2": normalized.audience[0] ?? (0, i18n_1.t)("user", lang),
            "Field Label": (0, i18n_1.t)("field", lang),
            "Detailed Input Area": (0, i18n_1.t)("detailed_input_area", lang),
            "Upload / Attachment Area": (0, i18n_1.t)("upload_area", lang),
            "Allowed file types / notes": (0, i18n_1.t)("low_fidelity_wireframe", lang),
            "Consent / confirmation text": (0, i18n_1.t)("confirmation_text", lang)
        }, (token) => {
            const key = token.toLowerCase();
            if (key.includes("screen") || key.includes("title"))
                return title;
            if (key.includes("action") || key.includes("button"))
                return (0, i18n_1.t)("save", lang);
            if (key.includes("field"))
                return (0, i18n_1.t)("field", lang);
            if (key.includes("description") || key.includes("summary"))
                return `[${screen.id}] ${screen.text}`;
            if (key.includes("actor") || key.includes("user"))
                return normalized.audience[0] ?? (0, i18n_1.t)("user", lang);
            if (key.includes("logo"))
                return "[ LOGO ]";
            return token;
        });
        enforceLanguage(html, lang, "wireframe");
        await promises_1.default.writeFile(htmlPath, html, "utf8");
        const defaultMap = {
            purpose: [`- [${screen.id}] ${screen.text}`],
            actor: [`- ${(normalized.audience[0] ?? (0, i18n_1.t)("primary_user", lang))}`],
            sections: [
                `- ${(0, i18n_1.t)("header_and_navigation", lang)}`,
                `- ${(0, i18n_1.t)("content_section", lang)}`,
                `- ${(0, i18n_1.t)("form_section", lang)}`
            ],
            fields: [`- ${(0, i18n_1.t)("text_input", lang)} (field_${index + 1})`],
            actions: [`- ${(0, i18n_1.t)("back", lang)}`, `- ${(0, i18n_1.t)("next", lang)}`, `- ${(0, i18n_1.t)("save", lang)}`],
            states: [`- ${tr ? "Bos durum, yukleniyor, hata, basari" : "Empty, loading, error, success states"}`],
            notes: [`- ${tr ? "Dusuk sadakatli tel kafes taslaktir." : "Low-fidelity black-and-white wireframe mock."}`]
        };
        const fallbackQueue = [
            ...defaultMap.purpose,
            ...defaultMap.actor,
            ...defaultMap.sections,
            ...defaultMap.fields,
            ...defaultMap.actions,
            ...defaultMap.states,
            ...defaultMap.notes
        ];
        const consumeFallback = () => (fallbackQueue.shift() ?? `- ${tr ? "Detay bekleniyor." : "Detail pending."}`);
        const contentForHeading = (heading) => {
            const key = heading.toLowerCase();
            if (/(screen purpose|purpose|amac|hedef)/.test(key))
                return defaultMap.purpose;
            if (/(primary actor|actor|user|kullanici|rol)/.test(key))
                return defaultMap.actor;
            if (/(main section|section|bolum|layout)/.test(key))
                return defaultMap.sections;
            if (/(field|input|form|alan)/.test(key))
                return defaultMap.fields;
            if (/(action|button|cta|aksiyon)/.test(key))
                return defaultMap.actions;
            if (/(state|message|durum|mesaj)/.test(key))
                return defaultMap.states;
            if (/(note|not|aciklama)/.test(key))
                return defaultMap.notes;
            return [consumeFallback()];
        };
        const targetHeadings = headings.length > 0 ? headings : (0, constants_1.defaultRequiredHeadings)("wireframe");
        const mdLines = [`# ${title}`, ""];
        for (const heading of targetHeadings) {
            mdLines.push(heading);
            mdLines.push(...contentForHeading(heading));
            mdLines.push("");
        }
        const mdBody = mdLines.join("\n").trim();
        enforceLanguage(mdBody, lang, "wireframe");
        await promises_1.default.writeFile(mdPath, `${mdBody}\n`, "utf8");
        if (!primaryMdPath)
            primaryMdPath = mdPath;
        summaryBodies.push(mdBody);
    }
    return {
        primaryPath: primaryMdPath,
        summaryBody: summaryBodies.join("\n\n")
    };
}
async function generateArtifact(options) {
    const { cwd, artifactType, outPath, agent } = options;
    const revisionType = options.revisionType ?? "default";
    const def = await (0, artifact_registry_1.getArtifactDefinition)(cwd, artifactType);
    const normalizedPath = options.normalizedBriefOverride ?? (0, paths_1.normalizedBriefPath)(cwd);
    await ensurePipelinePrereqs(cwd, normalizedPath);
    const documentControlVersion = await resolveDocumentControlVersion(cwd, artifactType, revisionType);
    const settings = await (0, settings_1.readSettings)(cwd);
    const normalizedBriefRaw = await (0, utils_1.readJsonFile)(normalizedPath);
    const normalizedBrief = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedBriefRaw);
    const template = await (0, template_resolver_1.resolveTemplate)({ cwd, artifactType });
    const companionTemplate = await (0, template_resolver_1.resolveCompanionTemplate)({ cwd, artifactType });
    if (!template || template.content.trim().length === 0) {
        throw new errors_1.UserError(`Missing ${artifactType} template. Create \`.prodo/templates/${artifactType}.md\` before running \`prodo-${artifactType}\`.`);
    }
    if (artifactType === "workflow" && !companionTemplate) {
        throw new errors_1.UserError("Missing workflow companion template. Create `.prodo/templates/workflow.mmd` before running `prodo-workflow`.");
    }
    if (artifactType === "wireframe" && !companionTemplate) {
        throw new errors_1.UserError("Missing wireframe companion template. Create `.prodo/templates/wireframe.html` before running `prodo-wireframe`.");
    }
    const templateHeadings = template && template.content.trim().length > 0 ? (0, template_resolver_1.extractRequiredHeadingsFromTemplate)(template.content) : [];
    if (templateHeadings.length === 0) {
        throw new errors_1.UserError(`${artifactType} template has no extractable headings. Add markdown headings to \`${template.path}\`.`);
    }
    const computedHeadings = templateHeadings.length > 0
        ? templateHeadings
        : (def.required_headings.length > 0 ? def.required_headings : (0, constants_1.defaultRequiredHeadings)(artifactType));
    const prompt = await resolvePrompt(cwd, artifactType, template?.content ?? "", computedHeadings, companionTemplate, settings.author, agent);
    const provider = (0, providers_1.createProvider)();
    const upstreamArtifacts = await buildUpstreamArtifacts(cwd, artifactType, def.upstream);
    const schemaHint = {
        artifactType,
        requiredHeadings: computedHeadings,
        requiredContracts: def.required_contracts
    };
    const generated = await provider.generate(prompt, {
        normalizedBrief,
        upstreamArtifacts,
        contractCatalog: normalizedBrief.contracts,
        templateContent: template?.content ?? "",
        templatePath: template?.path ?? "",
        companionTemplateContent: companionTemplate?.content ?? "",
        companionTemplatePath: companionTemplate?.path ?? "",
        outputLanguage: settings.lang,
        outputAuthor: settings.author
    }, schemaHint);
    let generatedBody = enforceAuthorInControlTables(replaceAuthorPlaceholders(generated.body.trim(), settings.author), settings.author);
    let workflowMermaidBody = null;
    if (artifactType === "workflow") {
        const paired = splitWorkflowPair(generatedBody);
        generatedBody = enforceAuthorInControlTables(replaceAuthorPlaceholders(paired.markdown, settings.author), settings.author);
        workflowMermaidBody = replaceAuthorPlaceholders(paired.mermaid, settings.author);
    }
    let contractCoverage = extractCoverageFromBody(generatedBody);
    if (artifactType === "workflow") {
        if (contractCoverage.core_features.length === 0) {
            contractCoverage = {
                ...contractCoverage,
                core_features: normalizedBrief.contracts.core_features.map((item) => item.id)
            };
        }
    }
    if (artifactType === "wireframe") {
        if (contractCoverage.core_features.length === 0) {
            contractCoverage = {
                ...contractCoverage,
                core_features: normalizedBrief.contracts.core_features.map((item) => item.id)
            };
        }
    }
    generatedBody = applyDocumentControlDefaults(generatedBody, {
        lang: settings.lang,
        revisionType,
        version: documentControlVersion,
        author: settings.author
    });
    if (artifactType === "workflow" && companionTemplate?.content) {
        workflowMermaidBody = renderWorkflowMermaidTemplate(companionTemplate.content, normalizedBrief, contractCoverage, settings.lang).trim();
        workflowMermaidBody = replaceAuthorPlaceholders(workflowMermaidBody, settings.author);
    }
    enforceLanguage(generatedBody, settings.lang, artifactType);
    if (artifactType === "workflow" && workflowMermaidBody) {
        enforceLanguage(workflowMermaidBody, settings.lang, artifactType);
    }
    const uncovered = missingCoverage(def.required_contracts, normalizedBrief, contractCoverage);
    if (uncovered.length > 0) {
        const lines = uncovered
            .map((item) => `- ${item.key}: missing ${item.ids.join(", ")}`)
            .join("\n");
        throw new errors_1.UserError(`Artifact is missing required contract references. Add ID tags to body:\n${lines}\nExample tags: [G1], [F2], [C1].`);
    }
    const frontmatter = {
        artifact_type: artifactType,
        version: (0, utils_1.timestampSlug)(),
        source_brief: node_path_1.default.resolve(normalizedPath),
        generated_at: new Date().toISOString(),
        status: constants_1.DEFAULT_STATUS,
        upstream_artifacts: upstreamArtifacts.map((item) => item.file),
        contract_coverage: contractCoverage,
        language: settings.lang,
        ...(normalizeAuthor(settings.author) ? { author: normalizeAuthor(settings.author) } : {})
    };
    const mergedFrontmatter = { ...frontmatter, ...(generated.frontmatter ?? {}) };
    if (normalizeAuthor(settings.author)) {
        mergedFrontmatter.author = normalizeAuthor(settings.author);
    }
    let doc = {
        frontmatter: mergedFrontmatter,
        body: generatedBody
    };
    const validation = await (0, validator_1.validateSchema)(cwd, artifactType, doc, schemaHint.requiredHeadings);
    const schemaErrors = validation.issues.filter((issue) => issue.level === "error");
    if (schemaErrors.length > 0) {
        const details = schemaErrors.map((issue) => `- ${issue.message}`).join("\n");
        throw new errors_1.UserError(`Artifact failed schema checks:\n${details}`);
    }
    const targetDir = (0, paths_1.outputDirPath)(cwd, artifactType, def.output_dir);
    const finalPath = outPath
        ? node_path_1.default.resolve(cwd, outPath)
        : await resolveUniqueOutputPath(targetDir, defaultFilename(artifactType));
    if (!(0, utils_1.isPathInside)(node_path_1.default.join(cwd, "product-docs"), finalPath)) {
        throw new errors_1.UserError("Artifact output must be inside `product-docs/`.");
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(finalPath), { recursive: true });
    if (artifactType === "workflow") {
        const basePath = node_path_1.default.join(node_path_1.default.dirname(finalPath), node_path_1.default.parse(finalPath).name);
        const workflow = await writeWorkflowFlows(node_path_1.default.dirname(basePath), node_path_1.default.parse(basePath).name, normalizedBrief, contractCoverage, settings.lang, doc.body, workflowMermaidBody, companionTemplate?.content ?? null);
        await promises_1.default.mkdir((0, paths_1.outputContextDirPath)(cwd), { recursive: true });
        for (const rendered of workflow.rendered) {
            const renderedDoc = {
                frontmatter: doc.frontmatter,
                body: rendered.body
            };
            await promises_1.default.writeFile(rendered.mdPath, gray_matter_1.default.stringify(renderedDoc.body, renderedDoc.frontmatter), "utf8");
            await writeSidecar(rendered.mdPath, renderedDoc);
            const renderedContext = {
                artifact_type: artifactType,
                artifact_file: rendered.mdPath,
                generated_at: new Date().toISOString(),
                contract_coverage: contractCoverage,
                ...deriveStructuredContext(artifactType, renderedDoc.body, schemaHint.requiredHeadings)
            };
            await promises_1.default.writeFile(contextFilePath(cwd, rendered.mdPath), `${JSON.stringify(renderedContext, null, 2)}\n`, "utf8");
        }
        const primaryRendered = workflow.rendered.find((item) => item.mdPath === workflow.primaryPath) ?? workflow.rendered[0];
        doc = {
            frontmatter: doc.frontmatter,
            body: primaryRendered?.body ?? doc.body
        };
        await (0, output_index_1.setActiveArtifact)(cwd, artifactType, workflow.primaryPath);
        return workflow.primaryPath;
    }
    else if (artifactType === "wireframe") {
        const base = node_path_1.default.parse(finalPath).name;
        const wireframe = await writeWireframeScreens(node_path_1.default.dirname(finalPath), base, normalizedBrief, contractCoverage, settings.lang, schemaHint.requiredHeadings, companionTemplate?.content ?? null);
        doc = {
            frontmatter: doc.frontmatter,
            body: wireframe.summaryBody
        };
        await writeSidecar(wireframe.primaryPath, doc);
        const derivedContext = {
            artifact_type: artifactType,
            artifact_file: wireframe.primaryPath,
            generated_at: new Date().toISOString(),
            contract_coverage: contractCoverage,
            ...deriveStructuredContext(artifactType, doc.body, schemaHint.requiredHeadings)
        };
        await promises_1.default.mkdir((0, paths_1.outputContextDirPath)(cwd), { recursive: true });
        await promises_1.default.writeFile(contextFilePath(cwd, wireframe.primaryPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
        await (0, output_index_1.setActiveArtifact)(cwd, artifactType, wireframe.primaryPath);
        return wireframe.primaryPath;
    }
    else {
        const content = gray_matter_1.default.stringify(doc.body, doc.frontmatter);
        await promises_1.default.writeFile(finalPath, content, "utf8");
    }
    await writeSidecar(finalPath, doc);
    const derivedContext = {
        artifact_type: artifactType,
        artifact_file: finalPath,
        generated_at: new Date().toISOString(),
        contract_coverage: contractCoverage,
        ...deriveStructuredContext(artifactType, doc.body, schemaHint.requiredHeadings)
    };
    await promises_1.default.mkdir((0, paths_1.outputContextDirPath)(cwd), { recursive: true });
    await promises_1.default.writeFile(contextFilePath(cwd, finalPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
    await (0, output_index_1.setActiveArtifact)(cwd, artifactType, finalPath);
    return finalPath;
}
