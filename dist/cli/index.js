"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const commander_1 = require("commander");
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const agent_ids_1 = require("./agent-ids");
const artifact_registry_1 = require("../core/artifact-registry");
const artifacts_1 = require("../core/artifacts");
const doctor_1 = require("./doctor");
const errors_1 = require("../core/errors");
const hook_executor_1 = require("../core/hook-executor");
const init_1 = require("./init");
const init_tui_1 = require("./init-tui");
const clean_1 = require("../core/clean");
const fix_1 = require("../core/fix");
const normalize_1 = require("../core/normalize");
const normalize_interactive_1 = require("./normalize-interactive");
const fix_tui_1 = require("./fix-tui");
const paths_1 = require("../core/paths");
const utils_1 = require("../core/utils");
const validate_1 = require("../core/validate");
const version_1 = require("../core/version");
const dynamicImport = new Function("specifier", "return import(specifier)");
function mapForcedCommand(forcedCommand) {
    if (forcedCommand === "prodo-init")
        return "init";
    if (forcedCommand === "prodo-validate")
        return "validate";
    if (forcedCommand === "prodo-normalize")
        return "normalize";
    if (forcedCommand === "prodo-fix")
        return "fix";
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
    const agent = (0, agent_ids_1.resolveAgent)(opts.agent);
    const file = await (0, artifacts_1.generateArtifact)({
        artifactType: type,
        cwd,
        normalizedBriefOverride: opts.from,
        outPath: opts.out,
        agent,
        revisionType: opts.revisionType
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
        .option("--ai <name>", "agent: codex | gemini-cli | claude-cli")
        .option("--lang <code>", "document language (e.g. en, tr)")
        .option("--author <name>", "document author name")
        .option("--preset <name>", "preset to install during initialization")
        .action(async (target, opts) => {
        const projectRoot = node_path_1.default.resolve(cwd, target ?? ".");
        const selected = await (0, init_tui_1.gatherInitSelections)({
            projectRoot,
            aiInput: opts.ai,
            langInput: opts.lang,
            authorInput: opts.author
        });
        const selectedAi = selected.ai;
        if (selected.interactive) {
            const clack = (await dynamicImport("@clack/prompts"));
            const s = clack.spinner();
            s.start("Scaffolding Prodo workspace...");
            const result = await (0, init_1.runInit)(projectRoot, {
                ai: selectedAi,
                lang: selected.lang,
                author: selected.author,
                preset: opts.preset,
                script: selected.script
            });
            s.stop("Scaffold complete.");
            await (0, init_tui_1.finishInitInteractive)({
                projectRoot,
                settingsPath: result.settingsPath,
                ai: selectedAi,
                lang: selected.lang,
                author: selected.author
            });
            return;
        }
        const result = await (0, init_1.runInit)(projectRoot, {
            ai: selectedAi,
            lang: selected.lang,
            author: selected.author,
            preset: opts.preset,
            script: selected.script
        });
        out(`Initialized Prodo scaffold at ${node_path_1.default.join(projectRoot, ".prodo")}`);
        if (selectedAi) {
            const label = selectedAi === "claude-cli" ? "Claude Code"
                : selectedAi === "codex" ? "Codex" : "Gemini CLI";
            out(`Agent commands installed for ${label}.`);
            out(`Installed ${result.installedAgentFiles.length} command files.`);
            out(`Next: edit brief.md, open in ${label}, run /prodo-normalize`);
        }
        else {
            out("Next: edit brief.md, then run `prodo generate`.");
        }
    });
    program
        .command("generate")
        .description("Run end-to-end pipeline: normalize -> generate artifacts -> validate")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .option("--strict", "treat validation warnings as errors")
        .option("--report <path>", "validation report output path")
        .option("--dry-run", "show what would be generated without writing files")
        .action(async (opts) => {
        if (opts.agent)
            (0, agent_ids_1.resolveAgent)(opts.agent);
        if (opts.dryRun) {
            out("[Dry Run] Pipeline would execute:");
            out(`  1. Normalize brief.md`);
            for (const type of artifactTypes) {
                out(`  2. Generate ${type}`);
            }
            out(`  3. Validate all artifacts`);
            out(`\nArtifact types: ${artifactTypes.join(", ")}`);
            return;
        }
        await withBriefReadOnlyGuard(cwd, async () => {
            const { createEngine, createPipelineState } = await Promise.resolve().then(() => __importStar(require("../skill-engine")));
            const engine = await createEngine(cwd, out);
            const state = createPipelineState(cwd);
            const pipelineSkills = ["normalize", ...artifactTypes, "validate"];
            await (0, hook_executor_1.runHookPhase)(cwd, "before_normalize", out);
            const finalState = await engine.runPipeline(pipelineSkills, state, {
                log: (msg) => {
                    out(msg);
                },
                agent: opts.agent
            });
            await (0, hook_executor_1.runHookPhase)(cwd, "after_validate", out);
            if (finalState.validationResult && !finalState.validationResult.pass) {
                out(`Validation report written to: ${finalState.validationResult.reportPath}`);
                throw new errors_1.UserError("Validation failed. Review report and fix issues.");
            }
            if (finalState.validationResult) {
                out(`Validation report written to: ${finalState.validationResult.reportPath}`);
            }
            out("Generation pipeline completed. Validation passed.");
        });
    });
    program
        .command("fix", { hidden: true })
        .description("Advanced: auto-regenerate affected artifacts from validation findings")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .option("--strict", "treat validation warnings as errors")
        .option("--report <path>", "validation report output path")
        .option("--dry-run", "show fix proposal without applying changes")
        .action(async (opts) => {
        if (opts.agent)
            (0, agent_ids_1.resolveAgent)(opts.agent);
        await withBriefReadOnlyGuard(cwd, async () => {
            const fixOpts = {
                cwd,
                agent: opts.agent,
                strict: Boolean(opts.strict),
                report: opts.report,
                dryRun: Boolean(opts.dryRun),
                log: out
            };
            if (opts.dryRun) {
                const result = await (0, fix_1.runFix)(fixOpts);
                out(`Validation report: ${result.reportPath}`);
                if (result.proposal.targets.length > 0) {
                    await (0, fix_tui_1.displayFixProposal)(result.proposal, out);
                }
                return;
            }
            const proposal = await (0, fix_1.buildFixProposal)(fixOpts);
            out(`Validation report: ${proposal.initialReport.reportPath}`);
            if (proposal.targets.length === 0) {
                out("No blocking issues found. Nothing to fix.");
                return;
            }
            await (0, fix_tui_1.displayFixProposal)(proposal, out);
            const confirmed = await (0, fix_tui_1.confirmFixExecution)(proposal);
            if (!confirmed) {
                out("Fix cancelled by user.");
                return;
            }
            out(`Regenerating impacted artifacts: ${proposal.targets.join(", ")}`);
            const result = await (0, fix_1.applyFix)(cwd, proposal, fixOpts);
            await (0, fix_tui_1.displayFixResult)(result, out);
            if (!result.finalPass) {
                throw new errors_1.UserError("Fix completed but validation is still failing. Review report and retry.");
            }
        });
    });
    program
        .command("normalize", { hidden: true })
        .description("Advanced: normalize brief without full pipeline")
        .option("--brief <path>", "path to start brief markdown")
        .option("--out <path>", "output normalized brief json path")
        .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
        .option("-i, --interactive", "interactively clarify low-confidence fields")
        .option("--dry-run", "show what would be normalized without writing")
        .action(async (opts) => {
        if (opts.agent)
            (0, agent_ids_1.resolveAgent)(opts.agent);
        if (opts.dryRun) {
            const briefFile = opts.brief ?? "brief.md";
            out(`[Dry Run] Would normalize: ${briefFile}`);
            out(`[Dry Run] Output would be written to: .prodo/briefs/normalized-brief.json`);
            return;
        }
        await withBriefReadOnlyGuard(cwd, async () => {
            await (0, hook_executor_1.runHookPhase)(cwd, "before_normalize", out);
            const outPath = opts.interactive
                ? await (0, normalize_interactive_1.runInteractiveNormalize)({ cwd, brief: opts.brief, out: opts.out, log: out })
                : await (0, normalize_1.runNormalize)({ cwd, brief: opts.brief, out: opts.out });
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
    program
        .command("clean")
        .description("Remove all generated artifacts, keep brief.md and config")
        .option("--dry-run", "show what would be removed without deleting")
        .action(async (opts) => {
        const result = await (0, clean_1.runClean)({
            cwd,
            dryRun: Boolean(opts.dryRun),
            log: out
        });
        if (result.removedPaths.length === 0) {
            out("Nothing to clean.");
        }
        else if (!opts.dryRun) {
            out(`Cleaned ${result.removedPaths.length} path(s). Project is ready for a fresh run.`);
        }
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
        const agent = (0, agent_ids_1.resolveAgent)(opts.agent);
        if (!agent)
            throw new errors_1.UserError("Agent is required.");
        const set = await (0, agent_ids_1.loadAgentCommandSet)(cwd, agent);
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
            (0, agent_ids_1.resolveAgent)(opts.agent);
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
    program
        .command("skills")
        .description("Manage and run skills")
        .argument("[action]", "list or run", "list")
        .argument("[name]", "skill name (for run)")
        .option("--input <json>", "JSON input for skill execution")
        .action(async (action, name, opts) => {
        const { createEngine, createHydratedState } = await Promise.resolve().then(() => __importStar(require("../skill-engine")));
        const engine = await createEngine(cwd, out);
        const registry = engine.getRegistry();
        if (action === "list") {
            const manifests = registry.listManifests();
            if (manifests.length === 0) {
                out("No skills registered.");
                return;
            }
            out("Available skills:\n");
            for (const m of manifests) {
                const deps = m.depends_on.length > 0 ? ` (deps: ${m.depends_on.join(", ")})` : "";
                out(`  ${m.name.padEnd(25)} [${m.category}] v${m.version} ${m.description}${deps}`);
            }
            return;
        }
        if (action === "run") {
            if (!name)
                throw new errors_1.UserError("Skill name is required. Usage: prodo skills run <name>");
            const state = await createHydratedState(cwd);
            const inputs = opts.input ? JSON.parse(opts.input) : {};
            inputs.cwd = inputs.cwd ?? cwd;
            const result = await engine.runSkill(name, state, { log: out });
            out(`\nSkill "${name}" completed.`);
            out(`Completed skills: ${result.completedSkills.join(" → ")}`);
            return;
        }
        throw new errors_1.UserError(`Unknown skills action: "${action}". Use: list or run`);
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
            else if (forced === "fix") {
                await program.parseAsync(["node", "prodo", "fix", ...argv.slice(2)]);
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
