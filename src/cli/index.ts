import { Command } from "commander";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAgentCommandSet, resolveAgent } from "./agent-ids";
import { resolveAi, type SupportedAi } from "./agent-command-installer";
import { listArtifactTypes } from "../core/artifact-registry";
import { generateArtifact } from "../core/artifacts";
import { runDoctor } from "./doctor";
import { UserError } from "../core/errors";
import { runHookPhase } from "../core/hook-executor";
import { runInit } from "./init";
import { finishInitInteractive, gatherInitSelections } from "./init-tui";
import { buildFixProposal, applyFix, runFix } from "../core/fix";
import { runNormalize } from "../core/normalize";
import { runInteractiveNormalize } from "./normalize-interactive";
import { confirmFixExecution, displayFixProposal, displayFixResult } from "./fix-tui";
import { briefPath } from "../core/paths";
import { type ArtifactType } from "../core/types";
import { fileExists } from "../core/utils";
import { runValidate } from "../core/validate";
import { readCliVersion } from "../core/version";

type RunOptions = {
  forcedCommand?: string;
  cwd?: string;
  argv?: string[];
  log?: (message: string) => void;
  error?: (message: string) => void;
};

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

function mapForcedCommand(forcedCommand: string): ArtifactType | "init" | "validate" | "normalize" | "fix" | undefined {
  if (forcedCommand === "prodo-init") return "init";
  if (forcedCommand === "prodo-validate") return "validate";
  if (forcedCommand === "prodo-normalize") return "normalize";
  if (forcedCommand === "prodo-fix") return "fix";
  if (forcedCommand === "prodo-prd") return "prd";
  if (forcedCommand === "prodo-workflow") return "workflow";
  if (forcedCommand === "prodo-wireframe") return "wireframe";
  if (forcedCommand === "prodo-stories") return "stories";
  if (forcedCommand === "prodo-techspec") return "techspec";
  return undefined;
}

async function runArtifactCommand(
  type: ArtifactType,
  opts: { from?: string; out?: string; agent?: string; revisionType?: "default" | "fix" },
  cwd: string,
  log: (message: string) => void,
  options?: { suggestValidate?: boolean }
): Promise<void> {
  await runHookPhase(cwd, `before_${type}`, log);
  const agent = resolveAgent(opts.agent);
  const file = await generateArtifact({
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
  await runHookPhase(cwd, `after_${type}`, log);
}

type BriefSnapshot = {
  hash: string;
  mtimeMs: number;
  size: number;
};

async function snapshotBrief(cwd: string): Promise<BriefSnapshot | null> {
  const file = briefPath(cwd);
  if (!(await fileExists(file))) return null;
  const [raw, stat] = await Promise.all([fs.readFile(file), fs.stat(file)]);
  return {
    hash: createHash("sha256").update(raw).digest("hex"),
    mtimeMs: stat.mtimeMs,
    size: stat.size
  };
}

async function withBriefReadOnlyGuard(cwd: string, task: () => Promise<void>): Promise<void> {
  const before = await snapshotBrief(cwd);
  await task();
  const after = await snapshotBrief(cwd);
  if (!before) return;
  if (!after) {
    throw new UserError("Input file `brief.md` was removed during execution. Input files are read-only.");
  }
  if (before.hash !== after.hash || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new UserError("Input file `brief.md` was modified during execution. Input files are read-only.");
  }
}

export async function runCli(options: RunOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const argv = options.argv ?? process.argv;
  const out = options.log ?? console.log;
  const err = options.error ?? console.error;
  const forced = options.forcedCommand ? mapForcedCommand(options.forcedCommand) : undefined;

  const program = new Command();
  const version = await readCliVersion(cwd);
  program
    .name("prodo")
    .description("CLI-first, prompt-powered product artifact kit")
    .version(`prodo ${version}`, "-v, --version", "Show Prodo version")
    .showHelpAfterError();
  const artifactTypes = await listArtifactTypes(cwd);

  program
    .command("init [target]")
    .option("--ai <name>", "agent integration: codex | gemini-cli | claude-cli")
    .option("--lang <code>", "document language (e.g. en, tr)")
    .option("--author <name>", "document author name")
    .option("--preset <name>", "preset to install during initialization")
    .action(async (target, opts) => {
      const projectRoot = path.resolve(cwd, target ?? ".");
      const selected = await gatherInitSelections({
        projectRoot,
        aiInput: opts.ai,
        langInput: opts.lang,
        authorInput: opts.author
      });
      const selectedAi = selected.ai as SupportedAi | undefined;

      if (selected.interactive) {
        const clack = (await dynamicImport("@clack/prompts")) as typeof import("@clack/prompts");
        const s = clack.spinner();
        s.start("Scaffolding Prodo workspace...");
        const result = await runInit(projectRoot, {
          ai: selectedAi,
          lang: selected.lang,
          author: selected.author,
          preset: opts.preset,
          script: selected.script
        });
        s.stop("Scaffold complete.");
        await finishInitInteractive({
          projectRoot,
          settingsPath: result.settingsPath,
          ai: selectedAi,
          lang: selected.lang,
          author: selected.author
        });
        return;
      }

      const result = await runInit(projectRoot, {
        ai: selectedAi,
        lang: selected.lang,
        author: selected.author,
        preset: opts.preset,
        script: selected.script
      });
      out(`Initialized Prodo scaffold at ${path.join(projectRoot, ".prodo")}`);
      if (selectedAi) {
        out(`Agent command set installed for ${selectedAi}.`);
        out(`Installed ${result.installedAgentFiles.length} command files.`);
        out("Agent workflow: edit brief.md, then run slash commands in your agent.");
      } else {
        out("No agent selected. Use `prodo generate` for end-to-end generation.");
      }
      out(`Settings file: ${result.settingsPath}`);
      out(`Author: ${selected.author}`);
      out("Next: edit brief.md.");
    });

  program
    .command("generate")
    .description("Run end-to-end pipeline: normalize -> generate artifacts -> validate")
    .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
    .option("--strict", "treat validation warnings as errors")
    .option("--report <path>", "validation report output path")
    .action(async (opts) => {
      if (opts.agent) resolveAgent(opts.agent);
      await withBriefReadOnlyGuard(cwd, async () => {
        await runHookPhase(cwd, "before_normalize", out);
        const normalizedPath = await runNormalize({ cwd });
        out(`Normalized brief written to: ${normalizedPath}`);
        await runHookPhase(cwd, "after_normalize", out);

        for (const type of artifactTypes) {
          await runArtifactCommand(type, { from: normalizedPath, agent: opts.agent }, cwd, out, {
            suggestValidate: false
          });
        }

        await runHookPhase(cwd, "before_validate", out);
        const result = await runValidate(cwd, {
          strict: Boolean(opts.strict),
          report: opts.report
        });
        out(`Validation report written to: ${result.reportPath}`);
        if (!result.pass) {
          throw new UserError("Validation failed. Review report and fix issues.");
        }
        out("Generation pipeline completed. Validation passed.");
        await runHookPhase(cwd, "after_validate", out);
      });
    });

  program
    .command("fix", { hidden: true })
    .description("Advanced: auto-regenerate affected artifacts from validation findings")
    .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
    .option("--strict", "treat validation warnings as errors")
    .option("--report <path>", "validation report output path")
    .option("--dry-run", "show fix proposal without applying changes")
    .action(async (opts: { agent?: string; strict?: boolean; report?: string; dryRun?: boolean }) => {
      if (opts.agent) resolveAgent(opts.agent);
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
          const result = await runFix(fixOpts);
          out(`Validation report: ${result.reportPath}`);
          if (result.proposal.targets.length > 0) {
            await displayFixProposal(result.proposal, out);
          }
          return;
        }

        const proposal = await buildFixProposal(fixOpts);
        out(`Validation report: ${proposal.initialReport.reportPath}`);

        if (proposal.targets.length === 0) {
          out("No blocking issues found. Nothing to fix.");
          return;
        }

        await displayFixProposal(proposal, out);

        const confirmed = await confirmFixExecution(proposal);
        if (!confirmed) {
          out("Fix cancelled by user.");
          return;
        }

        out(`Regenerating impacted artifacts: ${proposal.targets.join(", ")}`);
        const result = await applyFix(cwd, proposal, fixOpts);

        await displayFixResult(result, out);

        if (!result.finalPass) {
          throw new UserError("Fix completed but validation is still failing. Review report and retry.");
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
    .action(async (opts: { brief?: string; out?: string; agent?: string; interactive?: boolean }) => {
      if (opts.agent) resolveAgent(opts.agent);
      await withBriefReadOnlyGuard(cwd, async () => {
        await runHookPhase(cwd, "before_normalize", out);
        const outPath = opts.interactive
          ? await runInteractiveNormalize({ cwd, brief: opts.brief, out: opts.out, log: out })
          : await runNormalize({ cwd, brief: opts.brief, out: opts.out });
        out(`Normalized brief written to: ${outPath}`);
        await runHookPhase(cwd, "after_normalize", out);
      });
    });

  program
    .command("doctor")
    .alias("check")
    .description("Check local environment and toolchain readiness")
    .action(async () => {
      await runDoctor(cwd, out);
    });

  for (const type of artifactTypes) {
    program
      .command(type, { hidden: true })
      .description(`Advanced: generate only ${type} artifact`)
      .option("--from <path>", "path to normalized-brief.json")
      .option("--out <path>", "output file path")
      .option("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
      .action(async (opts: { from?: string; out?: string; agent?: string }) => {
        await withBriefReadOnlyGuard(cwd, async () => {
          await runArtifactCommand(type, opts, cwd, out);
        });
      });
  }

  program
    .command("agent-commands", { hidden: true })
    .requiredOption("--agent <name>", "agent profile: codex | gemini-cli | claude-cli")
    .action(async (opts: { agent: string }) => {
      const agent = resolveAgent(opts.agent);
      if (!agent) throw new UserError("Agent is required.");
      const set = await loadAgentCommandSet(cwd, agent);
      out(`Agent: ${set.agent}`);
      if (set.description) out(`Description: ${set.description}`);
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
    .action(async (opts: { strict?: boolean; report?: string; agent?: string }) => {
      if (opts.agent) resolveAgent(opts.agent);
      await withBriefReadOnlyGuard(cwd, async () => {
        await runHookPhase(cwd, "before_validate", out);
        const result = await runValidate(cwd, {
          strict: Boolean(opts.strict),
          report: opts.report
        });
        out(`Validation report written to: ${result.reportPath}`);
        if (!result.pass) {
          throw new UserError("Validation failed. Review report and fix issues.");
        }
        out("Validation passed.");
        await runHookPhase(cwd, "after_validate", out);
      });
    });

  program
    .command("skills", { hidden: true })
    .description("Advanced: manage and run skills")
    .argument("[action]", "list or run", "list")
    .argument("[name]", "skill name (for run)")
    .option("--input <json>", "JSON input for skill execution")
    .action(async (action: string, name: string | undefined, opts: { input?: string }) => {
      const { getGlobalSkillEngine } = await import("../skills/engine");
      const engine = getGlobalSkillEngine();

      if (action === "list") {
        const manifests = engine.listSkills();
        if (manifests.length === 0) {
          out("No skills registered.");
          return;
        }
        out("Available skills:\n");
        for (const m of manifests) {
          out(`  ${m.name.padEnd(25)} [${m.category}] ${m.description}`);
        }
        return;
      }

      if (action === "run") {
        if (!name) throw new UserError("Skill name is required. Usage: prodo skills run <name>");
        const inputs = opts.input ? JSON.parse(opts.input) as Record<string, unknown> : {};
        inputs.cwd = inputs.cwd ?? cwd;
        const result = await engine.execute(name, { cwd, log: out }, inputs);
        out(`\nSkill "${name}" completed.`);
        out(JSON.stringify(result, null, 2));
        return;
      }

      throw new UserError(`Unknown skills action: "${action}". Use: list or run`);
    });

  try {
    if (forced) {
      if (forced === "init") {
        await program.parseAsync(["node", "prodo", "init", ...argv.slice(2)]);
      } else if (forced === "normalize") {
        await program.parseAsync(["node", "prodo", "normalize", ...argv.slice(2)]);
      } else if (forced === "validate") {
        await program.parseAsync(["node", "prodo", "validate", ...argv.slice(2)]);
      } else if (forced === "fix") {
        await program.parseAsync(["node", "prodo", "fix", ...argv.slice(2)]);
      } else {
        await program.parseAsync(["node", "prodo", forced, ...argv.slice(2)]);
      }
    } else {
      await program.parseAsync(argv);
    }
    return 0;
  } catch (error) {
    if (error instanceof UserError) {
      err(error.message);
      return 1;
    }
    const unknown = error as Error;
    err(unknown.message);
    return 1;
  }
}

if (require.main === module) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}

