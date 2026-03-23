"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const commander_1 = require("commander");
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const agents_1 = require("./agents");
const artifact_registry_1 = require("./artifact-registry");
const artifacts_1 = require("./artifacts");
const doctor_1 = require("./doctor");
const errors_1 = require("./errors");
const hook_executor_1 = require("./hook-executor");
const init_1 = require("./init");
const init_tui_1 = require("./init-tui");
const normalize_1 = require("./normalize");
const paths_1 = require("./paths");
const utils_1 = require("./utils");
const validate_1 = require("./validate");
const version_1 = require("./version");
const dynamicImport = new Function("specifier", "return import(specifier)");
function mapForcedCommand(forcedCommand) {
    if (forcedCommand === "prodo-init")
        return "init";
    if (forcedCommand === "prodo-validate")
        return "validate";
    if (forcedCommand === "prodo-normalize")
        return "normalize";
    if (forcedCommand === "prodo-prd")
        return "prd";
    if (forcedCommand === "prodo-workflow")
        return "workflow";
    if (forcedCommand === "prodo-wireframe")
        return "wireframe";
    if (forcedCommand === "prodo-stories")
        return "stories";
    if (forcedCommand === "prodo-techspec")
        return "techspec";
    return undefined;
}
async function runArtifactCommand(type, opts, cwd, log, options) {
    await (0, hook_executor_1.runHookPhase)(cwd, `before_${type}`, log);
    const agent = (0, agents_1.resolveAgent)(opts.agent);
    const file = await (0, artifacts_1.generateArtifact)({
        artifactType: type,
        cwd,
        normalizedBriefOverride: opts.from,
        outPath: opts.out,
        agent
    });
    const agentMsg = agent ? ` [agent=${agent}]` : "";
    log(`${type.toUpperCase()} generated${agentMsg}: ${file}`);
    if (options?.suggestValidate !== false) {
        log("Tip: run `prodo validate` to check cross-artifact consistency.");
    }
    await (0, hook_executor_1.runHookPhase)(cwd, `after_${type}`, log);
}
async function snapshotBrief(cwd) {
    const file = (0, paths_1.briefPath)(cwd);
    if (!(await (0, utils_1.fileExists)(file)))
        return null;
    const [raw, stat] = await Promise.all([promises_1.default.readFile(file), promises_1.default.stat(file)]);
    return {
        hash: (0, node_crypto_1.createHash)("sha256").update(raw).digest("hex"),
        mtimeMs: stat.mtimeMs,
        size: stat.size
    };
}
async function withBriefReadOnlyGuard(cwd, task) {
    const before = await snapshotBrief(cwd);
    await task();
    const after = await snapshotBrief(cwd);
    if (!before)
        return;
    if (!after) {
        throw new errors_1.UserError("Input file `brief.md` was removed during execution. Input files are read-only.");
    }
    if (before.hash !== after.hash || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        throw new errors_1.UserError("Input file `brief.md` was modified during execution. Input files are read-only.");
    }
}
async function runCli(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const argv = options.argv ?? process.argv;
    const out = options.log ?? console.log;
    const err = options.error ?? console.error;
    const forced = options.forcedCommand ? mapForcedCommand(options.forcedCommand) : undefined;
    const program = new commander_1.Command();
    const version = await (0, version_1.readCliVersion)(cwd);
    program
        .name("prodo")
        .description("CLI-first, prompt-powered product artifact kit")
        .version(`prodo ${version}`, "-v, --version", "Show Prodo version")
        .showHelpAfterError();
    const artifactTypes = await (0, artifact_registry_1.listArtifactTypes)(cwd);
    program
        .command("init [target]")
        .option("--ai <name>", "agent integration: codex | gemini-cli | claude-cli")
        .option("--lang <code>", "document language (e.g. en, tr)")
        .option("--preset <name>", "preset to install during initialization")
        .action(async (target, opts) => {
        const projectRoot = node_path_1.default.resolve(cwd, target ?? ".");
        const selected = await (0, init_tui_1.gatherInitSelections)({
            projectRoot,
            aiInput: opts.ai,
            langInput: opts.lang
        });
        const selectedAi = selected.ai;
        if (selected.interactive) {
            const clack = (await dynamicImport("@clack/prompts"));
            const s = clack.spinner();
            s.start("Scaffolding Prodo workspace...");
            const result = await (0, init_1.runInit)(projectRoot, {
                ai: selectedAi,
                lang: selected.lang,
                preset: opts.preset,
                script: selected.script
            });
            s.stop("Scaffold complete.");
            await (0, init_tui_1.finishInitInteractive)({
                projectRoot,
                settingsPath: result.settingsPath,
                ai: selectedAi,
                script: selected.script,
                lang: selected.lang
            });
            return;
        }
        const result = await (0, init_1.runInit)(projectRoot, {
            ai: selectedAi,
            lang: selected.lang,
            preset: opts.preset,
            script: selected.script
        });
        out(`Initialized Prodo scaffold at ${node_path_1.default.join(projectRoot, ".prodo")}`);
        if (selectedAi) {
            out(`Agent command set installed for ${selectedAi}.`);
            out(`Installed ${result.installedAgentFiles.length} command files.`);
            out("Agent workflow: edit brief.md, then run slash commands in your agent.");
        }
        else {
            out("No agent selected. Use `prodo generate` for end-to-end generation.");
        }
        out(`Settings file: ${result.settingsPath}`);
        out("Next: edit brief.md.");
    });
    program
        .command("generate")
        .description("Run end-to-end pipeline: normalize -> generate artifacts -> validate")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .option("--strict", "treat validation warnings as errors")
        .option("--report <path>", "validation report output path")
        .action(async (opts) => {
        if (opts.agent)
            (0, agents_1.resolveAgent)(opts.agent);
        await withBriefReadOnlyGuard(cwd, async () => {
            await (0, hook_executor_1.runHookPhase)(cwd, "before_normalize", out);
            const normalizedPath = await (0, normalize_1.runNormalize)({ cwd });
            out(`Normalized brief written to: ${normalizedPath}`);
            await (0, hook_executor_1.runHookPhase)(cwd, "after_normalize", out);
            for (const type of artifactTypes) {
                await runArtifactCommand(type, { from: normalizedPath, agent: opts.agent }, cwd, out, {
                    suggestValidate: false
                });
            }
            await (0, hook_executor_1.runHookPhase)(cwd, "before_validate", out);
            const result = await (0, validate_1.runValidate)(cwd, {
                strict: Boolean(opts.strict),
                report: opts.report
            });
            out(`Validation report written to: ${result.reportPath}`);
            if (!result.pass) {
                throw new errors_1.UserError("Validation failed. Review report and fix issues.");
            }
            out("Generation pipeline completed. Validation passed.");
            await (0, hook_executor_1.runHookPhase)(cwd, "after_validate", out);
        });
    });
    program
        .command("normalize", { hidden: true })
        .description("Advanced: normalize brief without full pipeline")
        .option("--brief <path>", "path to start brief markdown")
        .option("--out <path>", "output normalized brief json path")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .action(async (opts) => {
        if (opts.agent)
            (0, agents_1.resolveAgent)(opts.agent);
        await withBriefReadOnlyGuard(cwd, async () => {
            await (0, hook_executor_1.runHookPhase)(cwd, "before_normalize", out);
            const outPath = await (0, normalize_1.runNormalize)({
                cwd,
                brief: opts.brief,
                out: opts.out
            });
            out(`Normalized brief written to: ${outPath}`);
            await (0, hook_executor_1.runHookPhase)(cwd, "after_normalize", out);
        });
    });
    program
        .command("doctor")
        .alias("check")
        .description("Check local environment and toolchain readiness")
        .action(async () => {
        await (0, doctor_1.runDoctor)(cwd, out);
    });
    for (const type of artifactTypes) {
        program
            .command(type, { hidden: true })
            .description(`Advanced: generate only ${type} artifact`)
            .option("--from <path>", "path to normalized-brief.json")
            .option("--out <path>", "output file path")
            .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
            .action(async (opts) => {
            await withBriefReadOnlyGuard(cwd, async () => {
                await runArtifactCommand(type, opts, cwd, out);
            });
        });
    }
    program
        .command("agent-commands", { hidden: true })
        .requiredOption("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .action(async (opts) => {
        const agent = (0, agents_1.resolveAgent)(opts.agent);
        if (!agent)
            throw new errors_1.UserError("Agent is required.");
        const set = await (0, agents_1.loadAgentCommandSet)(cwd, agent);
        out(`Agent: ${set.agent}`);
        if (set.description)
            out(`Description: ${set.description}`);
        out("");
        out("Recommended sequence:");
        for (const item of set.recommended_sequence ?? []) {
            out(`- ${item.command}: ${item.purpose}`);
        }
        if (set.artifact_shortcuts) {
            out("");
            out("Artifact shortcuts:");
            for (const [key, command] of Object.entries(set.artifact_shortcuts)) {
                out(`- ${key}: ${command}`);
            }
        }
    });
    program
        .command("validate", { hidden: true })
        .description("Advanced: run validation only")
        .option("--strict", "treat warnings as errors")
        .option("--report <path>", "report output path")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .action(async (opts) => {
        if (opts.agent)
            (0, agents_1.resolveAgent)(opts.agent);
        await withBriefReadOnlyGuard(cwd, async () => {
            await (0, hook_executor_1.runHookPhase)(cwd, "before_validate", out);
            const result = await (0, validate_1.runValidate)(cwd, {
                strict: Boolean(opts.strict),
                report: opts.report
            });
            out(`Validation report written to: ${result.reportPath}`);
            if (!result.pass) {
                throw new errors_1.UserError("Validation failed. Review report and fix issues.");
            }
            out("Validation passed.");
            await (0, hook_executor_1.runHookPhase)(cwd, "after_validate", out);
        });
    });
    try {
        if (forced) {
            if (forced === "init") {
                await program.parseAsync(["node", "prodo", "init", ...argv.slice(2)]);
            }
            else if (forced === "normalize") {
                await program.parseAsync(["node", "prodo", "normalize", ...argv.slice(2)]);
            }
            else if (forced === "validate") {
                await program.parseAsync(["node", "prodo", "validate", ...argv.slice(2)]);
            }
            else {
                await program.parseAsync(["node", "prodo", forced, ...argv.slice(2)]);
            }
        }
        else {
            await program.parseAsync(argv);
        }
        return 0;
    }
    catch (error) {
        if (error instanceof errors_1.UserError) {
            err(error.message);
            return 1;
        }
        const unknown = error;
        err(unknown.message);
        return 1;
    }
}
if (require.main === module) {
    runCli().then((code) => {
        process.exitCode = code;
    });
}
