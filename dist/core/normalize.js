"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNormalize = runNormalize;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("./errors");
const normalized_brief_1 = require("./normalized-brief");
const paths_1 = require("./paths");
const providers_1 = require("../providers");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
function normalizedKey(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/İ/g, "I")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function extractBriefProductName(rawBrief) {
    const lines = rawBrief.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const headingMatch = lines[index].match(/^\s*#{1,6}\s+(.+?)\s*$/);
        if (!headingMatch)
            continue;
        const headingKey = normalizedKey(headingMatch[1]);
        const isProductHeading = headingKey === "product name" ||
            headingKey === "project name" ||
            headingKey === "urun adi" ||
            headingKey === "urun ismi";
        if (!isProductHeading)
            continue;
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const rawLine = lines[cursor].trim();
            if (!rawLine)
                continue;
            if (/^\s*#{1,6}\s+/.test(rawLine))
                break;
            const cleaned = rawLine.replace(/^\s*[-*]\s*/, "").trim();
            if (cleaned.length > 0)
                return cleaned;
        }
    }
    return undefined;
}
function preserveOriginalProductName(parsed, rawBrief) {
    const briefProductName = extractBriefProductName(rawBrief);
    if (!briefProductName)
        return parsed;
    const generated = typeof parsed.product_name === "string" ? parsed.product_name : "";
    if (!generated.trim())
        return { ...parsed, product_name: briefProductName };
    if (normalizedKey(generated) !== normalizedKey(briefProductName))
        return parsed;
    return { ...parsed, product_name: briefProductName };
}
function extractJsonObject(raw) {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch {
        throw new errors_1.UserError("Normalizer provider did not return valid JSON.");
    }
}
async function runNormalize(options) {
    const { cwd } = options;
    const root = (0, paths_1.prodoPath)(cwd);
    if (!(await (0, utils_1.fileExists)(root))) {
        throw new errors_1.UserError("Missing .prodo directory. Run `prodo init .` first.");
    }
    const inPath = options.brief ? node_path_1.default.resolve(cwd, options.brief) : (0, paths_1.briefPath)(cwd);
    if (!(await (0, utils_1.fileExists)(inPath))) {
        throw new errors_1.UserError(`Brief file not found: ${inPath}`);
    }
    const rawBrief = await promises_1.default.readFile(inPath, "utf8");
    const normalizePromptPath = node_path_1.default.join(root, "prompts", "normalize.md");
    const normalizePrompt = await promises_1.default.readFile(normalizePromptPath, "utf8");
    const settings = await (0, settings_1.readSettings)(cwd);
    const provider = (0, providers_1.createProvider)();
    const inputContext = {
        briefMarkdown: rawBrief,
        sourceBriefPath: inPath,
        outputLanguage: settings.lang
    };
    if (options.additionalContext && Object.keys(options.additionalContext).length > 0) {
        inputContext.userClarifications = options.additionalContext;
    }
    const generated = await provider.generate(normalizePrompt, inputContext, {
        artifactType: "normalize",
        requiredHeadings: [],
        requiredContracts: []
    });
    const parsed = extractJsonObject(generated.body);
    const preserved = preserveOriginalProductName(parsed, rawBrief);
    const withContracts = {
        ...preserved,
        contracts: preserved.contracts ??
            (0, normalized_brief_1.buildContractsFromArrays)({
                goals: Array.isArray(preserved.goals) ? preserved.goals.filter((x) => typeof x === "string") : [],
                core_features: Array.isArray(preserved.core_features)
                    ? preserved.core_features.filter((x) => typeof x === "string")
                    : [],
                constraints: Array.isArray(preserved.constraints)
                    ? preserved.constraints.filter((x) => typeof x === "string")
                    : []
            })
    };
    const normalized = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(withContracts);
    const outPath = options.out ? node_path_1.default.resolve(cwd, options.out) : (0, paths_1.normalizedBriefPath)(cwd);
    if (!(0, utils_1.isPathInside)((0, paths_1.prodoPath)(cwd), outPath)) {
        throw new errors_1.UserError("Normalize output must be inside `.prodo/`.");
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(outPath), { recursive: true });
    await promises_1.default.writeFile(outPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    (0, normalized_brief_1.requireConfidenceOrThrow)(normalized, ["product_name", "problem", "audience", "goals", "core_features"], 0.7);
    return outPath;
}
