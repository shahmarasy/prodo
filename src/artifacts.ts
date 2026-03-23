import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { DEFAULT_STATUS, defaultRequiredHeadings } from "./constants";
import { getArtifactDefinition } from "./artifact-registry";
import { UserError } from "./errors";
import { contractIds, parseNormalizedBriefOrThrow, type NormalizedBrief } from "./normalized-brief";
import { getActiveArtifactPath, setActiveArtifact } from "./output-index";
import {
  briefPath,
  normalizedBriefPath,
  outputContextDirPath,
  outputDirPath,
  promptPath,
  prodoPath
} from "./paths";
import { createProvider } from "./providers";
import { extractRequiredHeadingsFromTemplate, resolveCompanionTemplate, resolveTemplate } from "./template-resolver";
import { readSettings } from "./settings";
import { sectionTextMap } from "./markdown";
import type { ArtifactDoc, ArtifactType, ContractCoverage } from "./types";
import { fileExists, isPathInside, listFilesSortedByMtime, readJsonFile, timestampSlug } from "./utils";
import { validateSchema } from "./validator";

export type GenerateOptions = {
  artifactType: ArtifactType;
  cwd: string;
  normalizedBriefOverride?: string;
  outPath?: string;
  agent?: string;
};

function defaultFilename(type: ArtifactType): string {
  if (type === "workflow") return `${type}-${timestampSlug()}.md`;
  if (type === "wireframe") return `${type}-${timestampSlug()}.md`;
  return `${type}-${timestampSlug()}.md`;
}

function sidecarPath(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.artifact.json`);
}

async function writeSidecar(filePath: string, doc: ArtifactDoc): Promise<void> {
  const payload = {
    frontmatter: doc.frontmatter,
    body: doc.body
  };
  await fs.writeFile(sidecarPath(filePath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function loadArtifactDoc(filePath: string): Promise<ArtifactDoc> {
  const sidecar = sidecarPath(filePath);
  if (await fileExists(sidecar)) {
    const loaded = await readJsonFile<Record<string, unknown>>(sidecar);
    return {
      frontmatter: (loaded.frontmatter as Record<string, unknown>) ?? {},
      body: typeof loaded.body === "string" ? loaded.body : ""
    };
  }
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content
  };
}

function languageProbe(body: string): string {
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

function hasEnglishLeak(body: string): boolean {
  const englishMarkers = [" the ", " and ", " with ", " user ", " should ", " must ", " requirement ", " flow ", " error ", " success "];
  const normalized = languageProbe(body);
  return englishMarkers.filter((m) => normalized.includes(m)).length >= 2;
}

function hasTurkishLeak(body: string): boolean {
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

function enforceLanguage(body: string, lang: string, artifactType: ArtifactType): void {
  const normalized = (lang || "en").toLowerCase();
  if (normalized.startsWith("tr")) {
    if (!hasEnglishLeak(body)) return;
    throw new UserError(
      `Language enforcement failed for ${artifactType}: output contains English fragments while language is Turkish.`
    );
  }
  if (normalized.startsWith("en")) {
    if (!hasTurkishLeak(body)) return;
    throw new UserError(
      `Language enforcement failed for ${artifactType}: output contains Turkish fragments while language is English.`
    );
  }
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "screen";
}

function extractTurkishTitle(featureText: string): string {
  const base = featureText.replace(/^\[[A-Z][0-9]+\]\s*/, "").trim();
  if (!base) return "Ekran";
  return base;
}

function replaceTemplateTokens(
  template: string,
  replacements: Record<string, string>,
  fallbackFromToken: (token: string) => string
): string {
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g"), value);
  }
  return out.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, tokenRaw: string) => {
    const token = String(tokenRaw).trim();
    return fallbackFromToken(token);
  });
}

function renderWorkflowMermaidTemplate(
  templateContent: string,
  normalized: NormalizedBrief,
  coverage: ContractCoverage,
  lang: string
): string {
  const tr = lang.toLowerCase().startsWith("tr");
  const primaryFeatureId = coverage.core_features[0] ?? normalized.contracts.core_features[0]?.id ?? "F1";
  const primaryFeatureText =
    normalized.contracts.core_features.find((item) => item.id === primaryFeatureId)?.text ??
    normalized.contracts.core_features[0]?.text ??
    (tr ? "Kullanici islemi" : "User action");

  return replaceTemplateTokens(
    templateContent,
    {
      "Flow Name": tr ? "Ana Akis" : "Main Flow",
      "Primary Actor": normalized.audience[0] ?? (tr ? "Kullanici" : "User"),
      "Primary Action": `[${primaryFeatureId}] ${primaryFeatureText}`,
      "Success State": tr ? "Basari" : "Success",
      "Error State": tr ? "Hata" : "Error"
    },
    (token) => {
      const key = token.toLowerCase();
      if (key.includes("actor") || key.includes("user")) return normalized.audience[0] ?? (tr ? "Kullanici" : "User");
      if (key.includes("action") || key.includes("feature")) return `[${primaryFeatureId}] ${primaryFeatureText}`;
      if (key.includes("success")) return tr ? "Basari" : "Success";
      if (key.includes("error") || key.includes("fail")) return tr ? "Hata" : "Error";
      if (key.includes("flow")) return tr ? "Ana Akis" : "Main Flow";
      return token;
    }
  );
}

async function resolvePrompt(
  cwd: string,
  artifactType: ArtifactType,
  templateContent: string,
  requiredHeadings: string[],
  companionTemplate: { path: string; content: string } | null,
  agent?: string
): Promise<string> {
  const base = await fs.readFile(promptPath(cwd, artifactType), "utf8");
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
  const workflowPairing =
    artifactType === "workflow"
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
  const wireframePairing =
    artifactType === "wireframe"
      ? `
Wireframe paired output contract (STRICT):
- Output markdown explanation first (template headings).
- Generate companion HTML screens based on native wireframe template.
- HTML must stay low-fidelity and structure-first.`
      : "";
  const withTemplate = `${base}

${authority}
${companionAuthority}
${workflowPairing}
${wireframePairing}`;
  if (!agent) return withTemplate;
  return `${withTemplate}

Agent execution profile: ${agent}
- Keep output deterministic and actionable.`;
}

async function loadLatestArtifactPath(cwd: string, type: ArtifactType): Promise<string | undefined> {
  const def = await getArtifactDefinition(cwd, type);
  const active = await getActiveArtifactPath(cwd, type);
  if (active) return active;
  const files = await listFilesSortedByMtime(outputDirPath(cwd, type, def.output_dir));
  return files[0];
}

function contextFilePath(cwd: string, artifactFile: string): string {
  const base = path.parse(artifactFile).name;
  return path.join(outputContextDirPath(cwd), `${base}.json`);
}

function toLineItems(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*0-9.]+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function parseHeadingTitle(fullHeading: string): string {
  return fullHeading.replace(/^##\s+/, "").trim();
}

function deriveStructuredContext(
  artifactType: ArtifactType,
  body: string,
  requiredHeadings: string[]
): Record<string, unknown> {
  const sections = sectionTextMap(body);
  const ordered = requiredHeadings
    .map((heading) => ({ heading, items: toLineItems(sections.get(heading)) }))
    .filter((item) => item.items.length > 0);
  const section_map = Object.fromEntries(
    Array.from(sections.entries()).map(([heading, text]) => [parseHeadingTitle(heading), toLineItems(text)])
  );

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

async function buildUpstreamArtifacts(
  cwd: string,
  artifactType: ArtifactType,
  upstreamTypes: ArtifactType[]
): Promise<
  Array<{
    type: ArtifactType;
    file: string;
    contractCoverage: ContractCoverage;
    structuredContext?: Record<string, unknown>;
  }>
> {
  const refs: Array<{
    type: ArtifactType;
    file: string;
    contractCoverage: ContractCoverage;
    structuredContext?: Record<string, unknown>;
  }> = [];
  for (const type of upstreamTypes) {
    const latest = await loadLatestArtifactPath(cwd, type);
    if (!latest) continue;
    const parsed = await loadArtifactDoc(latest);
    const frontmatter = parsed.frontmatter;
    const coverageRaw = frontmatter.contract_coverage as Partial<ContractCoverage> | undefined;
    const contextPath = contextFilePath(cwd, latest);
    const structuredContext = (await fileExists(contextPath))
      ? await readJsonFile<Record<string, unknown>>(contextPath)
      : {};
    refs.push({
      type,
      file: latest,
      contractCoverage: {
        goals: Array.isArray(coverageRaw?.goals)
          ? coverageRaw.goals.filter((item): item is string => typeof item === "string")
          : [],
        core_features: Array.isArray(coverageRaw?.core_features)
          ? coverageRaw.core_features.filter((item): item is string => typeof item === "string")
          : [],
        constraints: Array.isArray(coverageRaw?.constraints)
          ? coverageRaw.constraints.filter((item): item is string => typeof item === "string")
          : []
      },
      ...(Object.keys(structuredContext).length > 0 ? { structuredContext } : {})
    });
  }
  return refs;
}

function extractCoverageFromBody(body: string): ContractCoverage {
  const tagged = {
    goals: Array.from(new Set(body.match(/\[(G[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? [])),
    core_features: Array.from(new Set(body.match(/\[(F[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? [])),
    constraints: Array.from(new Set(body.match(/\[(C[0-9]+)\]/g)?.map((item) => item.slice(1, -1)) ?? []))
  };
  return tagged;
}

function missingCoverage(
  requiredContracts: Array<keyof ContractCoverage>,
  normalized: NormalizedBrief,
  coverage: ContractCoverage
): Array<{ key: keyof ContractCoverage; ids: string[] }> {
  const ids = contractIds(normalized.contracts);
  const missing: Array<{ key: keyof ContractCoverage; ids: string[] }> = [];

  for (const key of requiredContracts) {
    const expected = ids[key];
    if (expected.length === 0) continue;
    const missingIds = expected.filter((id) => !coverage[key].includes(id));
    if (missingIds.length > 0) {
      missing.push({ key, ids: missingIds });
    }
  }
  return missing;
}

async function ensurePipelinePrereqs(cwd: string, normalizedPath: string): Promise<void> {
  const prodoRoot = prodoPath(cwd);
  if (!(await fileExists(prodoRoot))) {
    throw new UserError("Missing .prodo directory. Run `prodo-init` first.");
  }

  if (!(await fileExists(briefPath(cwd)))) {
    throw new UserError(
      "Missing brief at `brief.md`. Run `prodo-init` or create the file."
    );
  }

  if (!(await fileExists(normalizedPath))) {
    throw new UserError(
      "Missing normalized brief at `.prodo/briefs/normalized-brief.json`. Create it before generating artifacts."
    );
  }
}

function splitWorkflowPair(raw: string): { markdown: string; mermaid: string } {
  const match = raw.match(/```mermaid\s*([\s\S]*?)```/i);
  if (!match) {
    throw new UserError(
      "Workflow output is missing a Mermaid block. Regenerate with template-compliant paired output."
    );
  }
  const mermaid = match[1].trim();
  const markdown = raw.replace(match[0], "").trim();
  if (!markdown) {
    throw new UserError("Workflow markdown explanation is empty.");
  }
  if (!/(^|\n)\s*(flowchart|graph)\s+/i.test(mermaid)) {
    throw new UserError("Workflow Mermaid block is invalid.");
  }
  return { markdown, mermaid };
}

async function writeWireframeScreens(
  targetDir: string,
  baseName: string,
  normalized: NormalizedBrief,
  coverage: ContractCoverage,
  lang: string,
  headings: string[],
  htmlTemplateContent: string | null
): Promise<{ primaryPath: string; summaryBody: string }> {
  const tr = lang.toLowerCase().startsWith("tr");
  const screenContracts = normalized.contracts.core_features
    .filter((item) => coverage.core_features.includes(item.id))
    .slice(0, 6);
  const screens = screenContracts.length > 0 ? screenContracts : normalized.contracts.core_features.slice(0, 3);
  const summaryBodies: string[] = [];
  let primaryMdPath = "";
  for (const [index, screen] of screens.entries()) {
    const title = extractTurkishTitle(screen.text);
    const screenBase = `${baseName}-${index + 1}-${toSlug(title)}`;
    const htmlPath = path.join(targetDir, `${screenBase}.html`);
    const mdPath = path.join(targetDir, `${screenBase}.md`);
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
</html>`;
    const htmlTemplate = htmlTemplateContent && htmlTemplateContent.trim().length > 0 ? htmlTemplateContent : fallbackHtml;
    const html = replaceTemplateTokens(
      htmlTemplate,
      {
        "Screen Title": title,
        "Primary Action": tr ? "Kaydet" : "Save",
        "Description Label": tr ? "Aciklama" : "Description",
        "Description Placeholder": `[${screen.id}] ${screen.text}`,
        "Meta Label 1": tr ? "Kontrat" : "Contract",
        "Meta Value 1": screen.id,
        "Meta Label 2": tr ? "Aktor" : "Actor",
        "Meta Value 2": normalized.audience[0] ?? (tr ? "Kullanici" : "User"),
        "Field Label": tr ? "Alan" : "Field",
        "Detailed Input Area": tr ? "Detayli Giris Alani" : "Detailed Input Area",
        "Upload / Attachment Area": tr ? "Dosya Alani" : "Upload Area",
        "Allowed file types / notes": tr ? "Dusuk sadakatli wireframe." : "Low-fidelity wireframe.",
        "Consent / confirmation text": tr ? "Onay metni" : "Confirmation text"
      },
      (token) => {
        const key = token.toLowerCase();
        if (key.includes("screen") || key.includes("title")) return title;
        if (key.includes("action") || key.includes("button")) return tr ? "Kaydet" : "Save";
        if (key.includes("field")) return tr ? "Alan" : "Field";
        if (key.includes("description") || key.includes("summary")) return `[${screen.id}] ${screen.text}`;
        if (key.includes("actor") || key.includes("user")) return normalized.audience[0] ?? (tr ? "Kullanici" : "User");
        if (key.includes("logo")) return "[ LOGO ]";
        return token;
      }
    );
    enforceLanguage(html, lang, "wireframe");
    await fs.writeFile(htmlPath, html, "utf8");
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
    const contentForHeading = (heading: string): string[] => {
      const key = heading.toLowerCase();
      if (/(screen purpose|purpose|amac|hedef)/.test(key)) return defaultMap.purpose;
      if (/(primary actor|actor|user|kullanici|rol)/.test(key)) return defaultMap.actor;
      if (/(main section|section|bolum|layout)/.test(key)) return defaultMap.sections;
      if (/(field|input|form|alan)/.test(key)) return defaultMap.fields;
      if (/(action|button|cta|aksiyon)/.test(key)) return defaultMap.actions;
      if (/(state|message|durum|mesaj)/.test(key)) return defaultMap.states;
      if (/(note|not|aciklama)/.test(key)) return defaultMap.notes;
      return [consumeFallback()];
    };
    const targetHeadings = headings.length > 0 ? headings : defaultRequiredHeadings("wireframe");
    const mdLines = [`# ${title}`, ""];
    for (const heading of targetHeadings) {
      mdLines.push(heading);
      mdLines.push(...contentForHeading(heading));
      mdLines.push("");
    }
    const mdBody = mdLines.join("\n").trim();
    enforceLanguage(mdBody, lang, "wireframe");
    await fs.writeFile(mdPath, `${mdBody}\n`, "utf8");
    if (!primaryMdPath) primaryMdPath = mdPath;
    summaryBodies.push(mdBody);
  }
  return {
    primaryPath: primaryMdPath,
    summaryBody: summaryBodies.join("\n\n")
  };
}

export async function generateArtifact(options: GenerateOptions): Promise<string> {
  const { cwd, artifactType, outPath, agent } = options;
  const def = await getArtifactDefinition(cwd, artifactType);
  const normalizedPath = options.normalizedBriefOverride ?? normalizedBriefPath(cwd);
  await ensurePipelinePrereqs(cwd, normalizedPath);

  const settings = await readSettings(cwd);
  const normalizedBriefRaw = await readJsonFile<Record<string, unknown>>(normalizedPath);
  const normalizedBrief = parseNormalizedBriefOrThrow(normalizedBriefRaw);
  const template = await resolveTemplate({ cwd, artifactType });
  const companionTemplate = await resolveCompanionTemplate({ cwd, artifactType });
  if (!template || template.content.trim().length === 0) {
    throw new UserError(
      `Missing ${artifactType} template. Create \`.prodo/templates/${artifactType}.md\` before running \`prodo-${artifactType}\`.`
    );
  }
  if (artifactType === "workflow" && !companionTemplate) {
    throw new UserError(
      "Missing workflow companion template. Create `.prodo/templates/workflow.mmd` before running `prodo-workflow`."
    );
  }
  if (artifactType === "wireframe" && !companionTemplate) {
    throw new UserError(
      "Missing wireframe companion template. Create `.prodo/templates/wireframe.html` before running `prodo-wireframe`."
    );
  }
  const templateHeadings =
    template && template.content.trim().length > 0 ? extractRequiredHeadingsFromTemplate(template.content) : [];
  if (templateHeadings.length === 0) {
    throw new UserError(
      `${artifactType} template has no extractable headings. Add markdown headings to \`${template.path}\`.`
    );
  }
  const computedHeadings = templateHeadings.length > 0
    ? templateHeadings
    : (def.required_headings.length > 0 ? def.required_headings : defaultRequiredHeadings(artifactType));
  const prompt = await resolvePrompt(
    cwd,
    artifactType,
    template?.content ?? "",
    computedHeadings,
    companionTemplate,
    agent
  );
  const provider = createProvider();
  const upstreamArtifacts = await buildUpstreamArtifacts(cwd, artifactType, def.upstream);
  const schemaHint = {
    artifactType,
    requiredHeadings: computedHeadings,
    requiredContracts: def.required_contracts
  };

  const generated = await provider.generate(
    prompt,
    {
      normalizedBrief,
      upstreamArtifacts,
      contractCatalog: normalizedBrief.contracts,
      templateContent: template?.content ?? "",
      templatePath: template?.path ?? "",
      companionTemplateContent: companionTemplate?.content ?? "",
      companionTemplatePath: companionTemplate?.path ?? "",
      outputLanguage: settings.lang
    },
    schemaHint
  );

  let generatedBody = generated.body.trim();
  let workflowMermaidBody: string | null = null;
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

  if (artifactType === "workflow" && companionTemplate?.content) {
    workflowMermaidBody = renderWorkflowMermaidTemplate(
      companionTemplate.content,
      normalizedBrief,
      contractCoverage,
      settings.lang
    ).trim();
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
    throw new UserError(
      `Artifact is missing required contract references. Add ID tags to body:\n${lines}\nExample tags: [G1], [F2], [C1].`
    );
  }

  const frontmatter = {
    artifact_type: artifactType,
    version: timestampSlug(),
    source_brief: path.resolve(normalizedPath),
    generated_at: new Date().toISOString(),
    status: DEFAULT_STATUS,
    upstream_artifacts: upstreamArtifacts.map((item) => item.file),
    contract_coverage: contractCoverage,
    language: settings.lang
  } as Record<string, unknown>;

  const mergedFrontmatter = { ...frontmatter, ...(generated.frontmatter ?? {}) };
  let doc: ArtifactDoc = {
    frontmatter: mergedFrontmatter,
    body: generatedBody
  };

  const validation = await validateSchema(cwd, artifactType, doc, schemaHint.requiredHeadings);
  const schemaErrors = validation.issues.filter((issue) => issue.level === "error");
  if (schemaErrors.length > 0) {
    const details = schemaErrors.map((issue) => `- ${issue.message}`).join("\n");
    throw new UserError(`Artifact failed schema checks:\n${details}`);
  }

  const targetDir = outputDirPath(cwd, artifactType, def.output_dir);
  const finalPath = outPath ? path.resolve(cwd, outPath) : path.join(targetDir, defaultFilename(artifactType));
  if (!isPathInside(path.join(cwd, "product-docs"), finalPath)) {
    throw new UserError("Artifact output must be inside `product-docs/`.");
  }
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  if (artifactType === "workflow") {
    const basePath = path.join(path.dirname(finalPath), path.parse(finalPath).name);
    const mdPath = `${basePath}.md`;
    const mmdPath = `${basePath}.mmd`;
    await fs.writeFile(mdPath, matter.stringify(doc.body, doc.frontmatter), "utf8");
    await fs.writeFile(mmdPath, `${(workflowMermaidBody ?? "").trim()}\n`, "utf8");
    await writeSidecar(mdPath, doc);
    const derivedContext = {
      artifact_type: artifactType,
      artifact_file: mdPath,
      generated_at: new Date().toISOString(),
      contract_coverage: contractCoverage,
      ...deriveStructuredContext(artifactType, doc.body, schemaHint.requiredHeadings)
    };
    await fs.mkdir(outputContextDirPath(cwd), { recursive: true });
    await fs.writeFile(contextFilePath(cwd, mdPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
    await setActiveArtifact(cwd, artifactType, mdPath);
    return mdPath;
  } else if (artifactType === "wireframe") {
    const base = path.parse(finalPath).name;
    const wireframe = await writeWireframeScreens(
      path.dirname(finalPath),
      base,
      normalizedBrief,
      contractCoverage,
      settings.lang,
      schemaHint.requiredHeadings,
      companionTemplate?.content ?? null
    );
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
    await fs.mkdir(outputContextDirPath(cwd), { recursive: true });
    await fs.writeFile(contextFilePath(cwd, wireframe.primaryPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
    await setActiveArtifact(cwd, artifactType, wireframe.primaryPath);
    return wireframe.primaryPath;
  } else {
    const content = matter.stringify(doc.body, doc.frontmatter);
    await fs.writeFile(finalPath, content, "utf8");
  }
  await writeSidecar(finalPath, doc);
  const derivedContext = {
    artifact_type: artifactType,
    artifact_file: finalPath,
    generated_at: new Date().toISOString(),
    contract_coverage: contractCoverage,
    ...deriveStructuredContext(artifactType, doc.body, schemaHint.requiredHeadings)
  };
  await fs.mkdir(outputContextDirPath(cwd), { recursive: true });
  await fs.writeFile(contextFilePath(cwd, finalPath), `${JSON.stringify(derivedContext, null, 2)}\n`, "utf8");
  await setActiveArtifact(cwd, artifactType, finalPath);
  return finalPath;
}
