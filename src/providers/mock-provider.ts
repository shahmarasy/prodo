import type { BriefContractItem } from "../core/normalized-brief";
import type { LLMProvider, ProviderSchemaHint } from "../core/types";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asContracts(value: unknown): BriefContractItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.text !== "string") return null;
      return { id: record.id, text: record.text };
    })
    .filter((item): item is BriefContractItem => item !== null);
}

function extractValue(markdown: string, heading: string): string[] {
  const aliases = heading.split("|").map((item) => item.trim().toLowerCase());
  const lines = markdown.split(/\r?\n/);
  let collect = false;
  const out: string[] = [];
  for (const raw of lines) {
    const headingMatch = raw.match(/^#{1,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      const current = headingMatch[1].trim().toLowerCase();
      if (collect && !aliases.includes(current)) break;
      collect = aliases.includes(current);
      continue;
    }
    if (!collect) continue;
    const cleaned = raw.replace(/^\s*[-*]\s*/, "").trim();
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

function normalizeWithMock(inputContext: Record<string, unknown>): string {
  const brief = typeof inputContext.briefMarkdown === "string" ? inputContext.briefMarkdown : "";
  const product = extractValue(brief, "Product Name|Name")[0] ?? "";
  const problem = extractValue(brief, "Problem|Problem Statement").join(" ");
  const audience = extractValue(brief, "Audience|Users|Persona");
  const goals = extractValue(brief, "Goals|Objectives");
  const features = extractValue(brief, "Core Features|Features|Capabilities");
  const constraints = extractValue(brief, "Constraints|Limitations|Restrictions");
  const assumptions = extractValue(brief, "Assumptions|Open Questions");

  const contracts = {
    goals: goals.map((text, index) => ({ id: `G${index + 1}`, text })),
    core_features: features.map((text, index) => ({ id: `F${index + 1}`, text })),
    constraints: constraints.map((text, index) => ({ id: `C${index + 1}`, text }))
  };

  const confidence = {
    product_name: product ? 0.95 : 0.25,
    problem: problem ? 0.95 : 0.25,
    audience: audience.length > 0 ? 0.95 : 0.25,
    goals: goals.length > 0 ? 0.95 : 0.25,
    core_features: features.length > 0 ? 0.95 : 0.25
  };

  return JSON.stringify(
    {
      schema_version: "1.0",
      product_name: product,
      problem,
      audience,
      goals,
      core_features: features,
      constraints,
      assumptions,
      contracts,
      confidence
    },
    null,
    2
  );
}

function normalizeSectionItems(inputContext: Record<string, unknown>): string[] {
  const normalizedBrief = (inputContext.normalizedBrief ?? {}) as Record<string, unknown>;
  const goals = asStringArray(normalizedBrief.goals);
  const features = asStringArray(normalizedBrief.core_features);
  const constraints = asStringArray(normalizedBrief.constraints);
  return [...goals, ...features, ...constraints];
}

function coverageItems(
  schemaHint: ProviderSchemaHint,
  inputContext: Record<string, unknown>
): Array<{ id: string; text: string }> {
  const catalog = (inputContext.contractCatalog ?? {}) as Record<string, unknown>;
  const values: Array<{ id: string; text: string }> = [];
  if (schemaHint.requiredContracts.includes("goals")) values.push(...asContracts(catalog.goals));
  if (schemaHint.requiredContracts.includes("core_features")) values.push(...asContracts(catalog.core_features));
  if (schemaHint.requiredContracts.includes("constraints")) values.push(...asContracts(catalog.constraints));
  return values;
}

function headingBlock(
  heading: string,
  items: string[],
  fallbackText: string,
  coverage: Array<{ id: string; text: string }>
): string {
  const selected = items.slice(0, 2);
  const contractBullets = coverage.map((item) => `- [${item.id}] ${item.text}`);
  const bullets = [...contractBullets, ...selected.map((item) => `- ${item}`)];
  const finalBullets = bullets.length > 0 ? bullets.join("\n") : `- ${fallbackText}`;
  return `${heading}\n${finalBullets}\n`;
}

function buildArtifactBody(schemaHint: ProviderSchemaHint, inputContext: Record<string, unknown>): string {
  const normalizedBrief = (inputContext.normalizedBrief ?? {}) as Record<string, unknown>;
  const productName =
    typeof normalizedBrief.product_name === "string" ? normalizedBrief.product_name : "Product";
  const lang = typeof inputContext.outputLanguage === "string" ? inputContext.outputLanguage.toLowerCase() : "en";
  const items = normalizeSectionItems(inputContext);
  const coverage = coverageItems(schemaHint, inputContext);
  const localizedItems =
    lang === "tr" ? items.map((_, index) => `Gereksinim maddesi ${index + 1}`) : items;
  const localizedCoverage =
    lang === "tr"
      ? coverage.map((item, index) => ({
          id: item.id,
          text: `Kontrat kapsami ${index + 1}`
        }))
      : coverage;
  const fallback = lang === "tr" ? "Detay daha sonra netlestirilecek." : "To be refined.";
  const sections = schemaHint.requiredHeadings.map((heading) =>
    headingBlock(heading, localizedItems, fallback, localizedCoverage)
  );
  const title =
    lang === "tr"
      ? `# ${productName} icin ${schemaHint.artifactType.toUpperCase()}`
      : `# ${schemaHint.artifactType.toUpperCase()} for ${productName}`;
  if (schemaHint.artifactType === "workflow") {
    return `${title}\n\n${sections.join("\n")}\n\n\`\`\`mermaid
flowchart TD
  A[Start] --> B[[F1] User Action]
  B --> C[System Step]
  C --> D[Done]
\`\`\``.trim();
  }
  return `${title}\n\n${sections.join("\n")}\n\n${lang === "tr" ? "Not" : "Note"}: ${fallback}`.trim();
}

function semanticIssuesWithMock(inputContext: Record<string, unknown>): string {
  const pair = inputContext.pair as Record<string, unknown>;
  const leftBody = typeof pair?.left_body === "string" ? pair.left_body : "";
  const rightBody = typeof pair?.right_body === "string" ? pair.right_body : "";
  const leftFile = typeof pair?.left_file === "string" ? pair.left_file : "";
  const rightFile = typeof pair?.right_file === "string" ? pair.right_file : "";
  const issues: Array<Record<string, unknown>> = [];

  const contradiction =
    /guest checkout/i.test(leftBody) && /(auth required|requires auth|must login)/i.test(rightBody);
  if (contradiction) {
    issues.push({
      level: "error",
      code: "semantic_contradiction",
      check: "semantic_consistency",
      contract_id: "F1",
      file: rightFile || leftFile,
      message: "Workflow allows guest checkout but paired artifact requires authentication.",
      suggestion: "Align auth behavior across both artifacts."
    });
  }

  return JSON.stringify({ issues }, null, 2);
}

function contractRelevanceWithMock(inputContext: Record<string, unknown>): string {
  const contractText = typeof inputContext.contract_text === "string" ? inputContext.contract_text.toLowerCase() : "";
  const contextText = typeof inputContext.context_text === "string" ? inputContext.context_text.toLowerCase() : "";
  const terms = contractText
    .split(/\W+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 3);
  const overlap = terms.filter((term) => contextText.includes(term)).length;
  const relevant = terms.length === 0 ? true : overlap / terms.length >= 0.25;
  return JSON.stringify({ relevant, score: terms.length === 0 ? 1 : overlap / terms.length }, null, 2);
}

export class MockProvider implements LLMProvider {
  async generate(
    _prompt: string,
    inputContext: Record<string, unknown>,
    schemaHint: ProviderSchemaHint
  ): Promise<{ body: string; frontmatter?: Record<string, unknown> }> {
    if (schemaHint.artifactType === "normalize") return { body: normalizeWithMock(inputContext) };
    if (schemaHint.artifactType === "semantic_consistency") return { body: semanticIssuesWithMock(inputContext) };
    if (schemaHint.artifactType === "contract_relevance") return { body: contractRelevanceWithMock(inputContext) };
    return { body: buildArtifactBody(schemaHint, inputContext) };
  }
}
