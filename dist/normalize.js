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
const providers_1 = require("./providers");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
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
    const generated = await provider.generate(normalizePrompt, {
        briefMarkdown: rawBrief,
        sourceBriefPath: inPath,
        outputLanguage: settings.lang
    }, {
        artifactType: "normalize",
        requiredHeadings: [],
        requiredContracts: []
    });
    const parsed = extractJsonObject(generated.body);
    const withContracts = {
        ...parsed,
        contracts: parsed.contracts ??
            (0, normalized_brief_1.buildContractsFromArrays)({
                goals: Array.isArray(parsed.goals) ? parsed.goals.filter((x) => typeof x === "string") : [],
                core_features: Array.isArray(parsed.core_features)
                    ? parsed.core_features.filter((x) => typeof x === "string")
                    : [],
                constraints: Array.isArray(parsed.constraints)
                    ? parsed.constraints.filter((x) => typeof x === "string")
                    : []
            })
    };
    const normalized = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(withContracts);
    (0, normalized_brief_1.requireConfidenceOrThrow)(normalized, ["product_name", "problem", "audience", "goals", "core_features"], 0.7);
    const outPath = options.out ? node_path_1.default.resolve(cwd, options.out) : (0, paths_1.normalizedBriefPath)(cwd);
    if (!(0, utils_1.isPathInside)((0, paths_1.prodoPath)(cwd), outPath)) {
        throw new errors_1.UserError("Normalize output must be inside `.prodo/`.");
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(outPath), { recursive: true });
    await promises_1.default.writeFile(outPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return outPath;
}
