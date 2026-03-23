"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArtifact = generateArtifact;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const constants_1 = require("./constants");
const artifact_registry_1 = require("./artifact-registry");
const errors_1 = require("./errors");
const normalized_brief_1 = require("./normalized-brief");
const output_index_1 = require("./output-index");
const paths_1 = require("./paths");
const providers_1 = require("./providers");
const template_resolver_1 = require("./template-resolver");
const settings_1 = require("./settings");
const markdown_1 = require("./markdown");
const utils_1 = require("./utils");
const validator_1 = require("./validator");
function defaultFilename(type) {
    if (type === "workflow")
        return `${type}-${(0, utils_1.timestampSlug)()}.md`;
    if (type === "wireframe")
        return `${type}-${(0, utils_1.timestampSlug)()}.md`;
    return `${type}-${(0, utils_1.timestampSlug)()}.md`;
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
function hasEnglishLeak(body) {
    const englishMarkers = [" the ", " and ", " with ", " user ", " should ", " must ", " requirement ", " flow "];
    const normalized = ` ${body.toLowerCase().replace(/\s+/g, " ")} `;
    return englishMarkers.filter((m) => normalized.includes(m)).length >= 2;
}
function enforceLanguage(body, lang, artifactType) {
    const normalized = (lang || "en").toLowerCase();
    if (!normalized.startsWith("tr"))
        return;
    if (hasEnglishLeak(body)) {
        throw new errors_1.UserError(`Language enforcement failed for ${artifactType}: output contains English fragments while language is Turkish.`);
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
async function resolvePrompt(cwd, artifactType, templateContent, requiredHeadings, agent) {
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
    const withTemplate = `${base}

${authority}${workflowPairing}`;
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
async function writeWireframeScreens(targetDir, baseName, normalized, coverage, lang, headings) {
    const tr = lang.toLowerCase().startsWith("tr");
    const screenContracts = normalized.contracts.core_features
        .filter((item) => coverage.core_features.includes(item.id))
        .slice(0, 6);
    const screens = screenContracts.length > 0 ? screenContracts : normalized.contracts.core_features.slice(0, 3);
    const summaryBodies = [];
    let primaryMdPath = "";
    for (const [index, screen] of screens.entries()) {
        const title = extractTurkishTitle(screen.text);
        const screenBase = `${baseName}-${index + 1}-${toSlug(title)}`;
        const htmlPath = node_path_1.default.join(targetDir, `${screenBase}.html`);
        const mdPath = node_path_1.default.join(targetDir, `${screenBase}.md`);
        const html = `<!doctype html>
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
    <nav><button type="button">${tr ? "Geri" : "Back"}</button><button type="button">${tr ? "Devam" : "Next"}</button></nav>
  </header>
  <main>
    <section>
      <h2>${tr ? "Icerik" : "Content"}</h2>
      <ul>
        <li>${tr ? "Birincil bilgi alani" : "Primary information area"}</li>
        <li>${tr ? "Durum gostergesi" : "Status indicator"}</li>
      </ul>
    </section>
    <section>
      <h2>${tr ? "Form" : "Form"}</h2>
      <form>
        <label>${tr ? "Alan" : "Field"}
          <input type="text" name="field_${index + 1}" />
        </label>
        <button type="submit">${tr ? "Kaydet" : "Save"}</button>
      </form>
    </section>
  </main>
</body>
</html>
`;
        await promises_1.default.writeFile(htmlPath, html, "utf8");
        const defaultMap = {
            purpose: [`- [${screen.id}] ${screen.text}`],
            actor: [`- ${(normalized.audience[0] ?? (tr ? "Birincil kullanici" : "Primary user"))}`],
            sections: [
                `- ${tr ? "Baslik ve gezinme" : "Header and navigation"}`,
                `- ${tr ? "Icerik bolumu" : "Content section"}`,
                `- ${tr ? "Form bolumu" : "Form section"}`
            ],
            fields: [`- ${tr ? "Metin alani (field_" : "Text input (field_"}${index + 1})`],
            actions: [`- ${tr ? "Geri" : "Back"}`, `- ${tr ? "Devam" : "Next"}`, `- ${tr ? "Kaydet" : "Save"}`],
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
    const def = await (0, artifact_registry_1.getArtifactDefinition)(cwd, artifactType);
    const normalizedPath = options.normalizedBriefOverride ?? (0, paths_1.normalizedBriefPath)(cwd);
    await ensurePipelinePrereqs(cwd, normalizedPath);
    const settings = await (0, settings_1.readSettings)(cwd);
    const normalizedBriefRaw = await (0, utils_1.readJsonFile)(normalizedPath);
    const normalizedBrief = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedBriefRaw);
    const template = await (0, template_resolver_1.resolveTemplate)({ cwd, artifactType });
    if (!template || template.content.trim().length === 0) {
        throw new errors_1.UserError(`Missing ${artifactType} template. Create \`.prodo/templates/${artifactType}.md\` before running \`prodo-${artifactType}\`.`);
    }
    const templateHeadings = template && template.content.trim().length > 0 ? (0, template_resolver_1.extractRequiredHeadingsFromTemplate)(template.content) : [];
    if (templateHeadings.length === 0) {
        throw new errors_1.UserError(`${artifactType} template has no extractable headings. Add markdown headings to \`${template.path}\`.`);
    }
    const computedHeadings = templateHeadings.length > 0
        ? templateHeadings
        : (def.required_headings.length > 0 ? def.required_headings : (0, constants_1.defaultRequiredHeadings)(artifactType));
    const prompt = await resolvePrompt(cwd, artifactType, template?.content ?? "", computedHeadings, agent);
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
        outputLanguage: settings.lang
    }, schemaHint);
    let generatedBody = generated.body.trim();
    let workflowMermaidBody = null;
    if (artifactType === "workflow") {
        const paired = splitWorkflowPair(generatedBody);
        generatedBody = paired.markdown;
        workflowMermaidBody = paired.mermaid;
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
    enforceLanguage(generatedBody, settings.lang, artifactType);
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
        language: settings.lang
    };
    const mergedFrontmatter = { ...frontmatter, ...(generated.frontmatter ?? {}) };
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
    const finalPath = outPath ? node_path_1.default.resolve(cwd, outPath) : node_path_1.default.join(targetDir, defaultFilename(artifactType));
    if (!(0, utils_1.isPathInside)(node_path_1.default.join(cwd, "product-docs"), finalPath)) {
        throw new errors_1.UserError("Artifact output must be inside `product-docs/`.");
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(finalPath), { recursive: true });
    if (artifactType === "workflow") {
        const basePath = node_path_1.default.join(node_path_1.default.dirname(finalPath), node_path_1.default.parse(finalPath).name);
        const mdPath = `${basePath}.md`;
        const mmdPath = `${basePath}.mmd`;
        await promises_1.default.writeFile(mdPath, gray_matter_1.default.stringify(doc.body, doc.frontmatter), "utf8");
        await promises_1.default.writeFile(mmdPath, `${(workflowMermaidBody ?? "").trim()}\n`, "utf8");
        await writeSidecar(mdPath, doc);
        const derivedContext = {
            artifact_type: artifactType,
            artifact_file: mdPath,
            generated_at: new Date().toISOString(),
            contract_coverage: contractCoverage,
            ...deriveStructuredContext(artifactType, doc.body, schemaHint.requiredHeadings)
        };
        await promises_1.default.mkdir((0, paths_1.outputContextDirPath)(cwd), { recursive: true });
        await promises_1.default.writeFile(contextFilePath(cwd, mdPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
        await (0, output_index_1.setActiveArtifact)(cwd, artifactType, mdPath);
        return mdPath;
    }
    else if (artifactType === "wireframe") {
        const base = node_path_1.default.parse(finalPath).name;
        const wireframe = await writeWireframeScreens(node_path_1.default.dirname(finalPath), base, normalizedBrief, contractCoverage, settings.lang, schemaHint.requiredHeadings);
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
