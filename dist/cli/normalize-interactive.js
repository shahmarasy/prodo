"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInteractiveNormalize = runInteractiveNormalize;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const normalized_brief_1 = require("../core/normalized-brief");
const normalize_1 = require("../core/normalize");
const paths_1 = require("../core/paths");
const utils_1 = require("../core/utils");
const errors_1 = require("../core/errors");
const CONFIDENCE_FIELDS = [
    "product_name",
    "problem",
    "audience",
    "goals",
    "core_features"
];
const FIELD_QUESTIONS = {
    product_name: (val) => `The product name was detected as "${val ?? "(empty)"}". Can you confirm or provide the exact product name?`,
    problem: (val) => val
        ? `The problem statement seems unclear: "${String(val).slice(0, 80)}...". Can you describe the core problem more precisely?`
        : "What is the core problem this product solves?",
    audience: (val) => Array.isArray(val) && val.length > 0
        ? `The target audience was detected as: ${val.join(", ")}. Is this correct? Add any missing groups.`
        : "Who is the target audience for this product?",
    goals: (val) => Array.isArray(val) && val.length > 0
        ? `The following goals were identified: ${val.join("; ")}. Are these correct? Add any missing goals.`
        : "What are the primary goals of this product?",
    core_features: (val) => Array.isArray(val) && val.length > 0
        ? `These core features were detected: ${val.join("; ")}. Are these correct? Add any missing features.`
        : "What are the core features of this product?"
};
async function loadHistory(cwd) {
    const file = (0, paths_1.normHistoryPath)(cwd);
    if (!(await (0, utils_1.fileExists)(file))) {
        return { version: "1.0", sessions: [] };
    }
    try {
        return await (0, utils_1.readJsonFile)(file);
    }
    catch {
        return { version: "1.0", sessions: [] };
    }
}
async function saveHistory(cwd, history) {
    const file = (0, paths_1.normHistoryPath)(cwd);
    await promises_1.default.mkdir(node_path_1.default.dirname(file), { recursive: true });
    await promises_1.default.writeFile(file, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}
function buildQuestions(brief, confidenceResult) {
    return confidenceResult.lowFields.map(({ field, confidence }) => {
        const current = brief[field];
        const questionFn = FIELD_QUESTIONS[field];
        const question = questionFn ? questionFn(current) : `Please clarify the "${field}" field.`;
        return { field, question, confidence };
    });
}
async function runInteractiveNormalize(options) {
    const { cwd, maxIterations = 3, log = console.log } = options;
    const isTTY = process.stdout.isTTY === true;
    if (!isTTY) {
        log("Non-interactive terminal detected. Running standard normalize instead.");
        return (0, normalize_1.runNormalize)({ cwd, brief: options.brief, out: options.out });
    }
    const clack = await loadClack();
    if (!clack) {
        log("Interactive prompts not available. Running standard normalize.");
        return (0, normalize_1.runNormalize)({ cwd, brief: options.brief, out: options.out });
    }
    const history = await loadHistory(cwd);
    let additionalContext = {};
    let iteration = 0;
    clack.intro("Prodo Interactive Normalize");
    while (iteration < maxIterations) {
        iteration += 1;
        log(`\nNormalize iteration ${iteration}/${maxIterations}...`);
        const outPath = await runNormalizeRelaxed({
            cwd,
            brief: options.brief,
            out: options.out,
            additionalContext
        });
        const normalizedRaw = JSON.parse(await promises_1.default.readFile(outPath, "utf8"));
        const brief = (0, normalized_brief_1.parseNormalizedBriefOrThrow)(normalizedRaw);
        const result = (0, normalized_brief_1.checkConfidence)(brief, [...CONFIDENCE_FIELDS], 0.7);
        if (result.pass) {
            log("All fields have sufficient confidence.");
            clack.outro("Normalization complete!");
            await saveHistory(cwd, history);
            return outPath;
        }
        const questions = buildQuestions(brief, result);
        log(`\n${questions.length} field(s) need clarification:\n`);
        const session = {
            timestamp: new Date().toISOString(),
            iteration,
            questions,
            answers: {}
        };
        for (const q of questions) {
            const answer = await clack.text({
                message: `[${(q.confidence * 100).toFixed(0)}% confidence] ${q.question}`,
                placeholder: "Type your answer or press Enter to skip..."
            });
            if (clack.isCancel(answer)) {
                clack.cancel("Normalize cancelled.");
                await saveHistory(cwd, history);
                return outPath;
            }
            const answerStr = typeof answer === "string" ? answer.trim() : "";
            if (answerStr.length > 0) {
                additionalContext[q.field] = answerStr;
                session.answers[q.field] = answerStr;
            }
        }
        history.sessions.push(session);
        if (Object.keys(session.answers).length === 0) {
            log("No clarifications provided. Keeping current normalization.");
            clack.outro("Normalization complete (as-is).");
            await saveHistory(cwd, history);
            return outPath;
        }
        const shouldContinue = await clack.confirm({
            message: "Continue refining? (No = accept current result)"
        });
        if (clack.isCancel(shouldContinue) || shouldContinue === false) {
            clack.outro("Normalization accepted.");
            await saveHistory(cwd, history);
            return outPath;
        }
    }
    log(`Maximum iterations (${maxIterations}) reached.`);
    clack.outro("Normalization complete.");
    await saveHistory(cwd, history);
    const finalPath = options.out
        ? node_path_1.default.resolve(cwd, options.out)
        : (0, paths_1.normalizedBriefPath)(cwd);
    return finalPath;
}
async function runNormalizeRelaxed(options) {
    try {
        return await (0, normalize_1.runNormalize)(options);
    }
    catch (error) {
        if (error instanceof errors_1.UserError &&
            error.message.includes("Normalization confidence too low")) {
            const outPath = options.out
                ? node_path_1.default.resolve(options.cwd, options.out)
                : (0, paths_1.normalizedBriefPath)(options.cwd);
            if (await (0, utils_1.fileExists)(outPath))
                return outPath;
        }
        throw error;
    }
}
const dynamicImport = new Function("specifier", "return import(specifier)");
async function loadClack() {
    try {
        return (await dynamicImport("@clack/prompts"));
    }
    catch {
        return null;
    }
}
