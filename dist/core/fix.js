"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFixTargets = resolveFixTargets;
exports.buildFixProposal = buildFixProposal;
exports.createBackup = createBackup;
exports.restoreBackup = restoreBackup;
exports.applyFix = applyFix;
exports.runFix = runFix;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const artifact_registry_1 = require("./artifact-registry");
const artifacts_1 = require("./artifacts");
const errors_1 = require("./errors");
const hook_executor_1 = require("./hook-executor");
const normalize_1 = require("./normalize");
const output_index_1 = require("./output-index");
const paths_1 = require("./paths");
const utils_1 = require("./utils");
const validate_1 = require("./validate");
async function resolveFixTargets(cwd, artifactTypes, issues) {
    const direct = new Set(issues
        .map((issue) => issue.artifactType)
        .filter((artifactType) => typeof artifactType === "string" && artifactTypes.includes(artifactType)));
    if (direct.size === 0)
        return artifactTypes;
    const defs = await (0, artifact_registry_1.listArtifactDefinitions)(cwd);
    let changed = true;
    while (changed) {
        changed = false;
        for (const def of defs) {
            const needsRefresh = def.upstream.some((upstream) => direct.has(upstream));
            if (needsRefresh && !direct.has(def.name)) {
                direct.add(def.name);
                changed = true;
            }
        }
    }
    return artifactTypes.filter((artifactType) => direct.has(artifactType));
}
async function buildFixProposal(options) {
    const { cwd, strict, report } = options;
    const initialReport = await (0, validate_1.runValidate)(cwd, {
        strict: Boolean(strict),
        report
    });
    if (initialReport.pass) {
        return {
            targets: [],
            issues: [],
            issuesByArtifact: new Map(),
            initialReport
        };
    }
    const artifactTypes = await (0, artifact_registry_1.listArtifactTypes)(cwd);
    const targets = await resolveFixTargets(cwd, artifactTypes, initialReport.issues);
    const issuesByArtifact = new Map();
    for (const issue of initialReport.issues) {
        if (issue.artifactType) {
            const existing = issuesByArtifact.get(issue.artifactType) ?? [];
            existing.push(issue);
            issuesByArtifact.set(issue.artifactType, existing);
        }
    }
    return {
        targets,
        issues: initialReport.issues,
        issuesByArtifact,
        initialReport
    };
}
function backupBasePath(cwd) {
    return node_path_1.default.join((0, paths_1.prodoPath)(cwd), "state", "backups");
}
async function createBackup(cwd, targets) {
    const slug = (0, utils_1.timestampSlug)();
    const backupDir = node_path_1.default.join(backupBasePath(cwd), slug);
    await (0, utils_1.ensureDir)(backupDir);
    const manifest = [];
    for (const type of targets) {
        const activePath = await (0, output_index_1.getActiveArtifactPath)(cwd, type);
        if (!activePath || !(await (0, utils_1.fileExists)(activePath)))
            continue;
        const relPath = node_path_1.default.relative(cwd, activePath);
        const destPath = node_path_1.default.join(backupDir, relPath);
        await (0, utils_1.ensureDir)(node_path_1.default.dirname(destPath));
        await promises_1.default.copyFile(activePath, destPath);
        manifest.push({ type, source: activePath, dest: destPath });
        const parsed = node_path_1.default.parse(activePath);
        const sidecar = node_path_1.default.join(parsed.dir, `${parsed.name}.artifact.json`);
        if (await (0, utils_1.fileExists)(sidecar)) {
            const sidecarRel = node_path_1.default.relative(cwd, sidecar);
            const sidecarDest = node_path_1.default.join(backupDir, sidecarRel);
            await promises_1.default.copyFile(sidecar, sidecarDest);
        }
        const companionExtensions = type === "workflow" ? [".mmd"] : type === "wireframe" ? [".html"] : [];
        for (const ext of companionExtensions) {
            const companionPath = node_path_1.default.join(parsed.dir, `${parsed.name}${ext}`);
            if (await (0, utils_1.fileExists)(companionPath)) {
                const companionRel = node_path_1.default.relative(cwd, companionPath);
                const companionDest = node_path_1.default.join(backupDir, companionRel);
                await (0, utils_1.ensureDir)(node_path_1.default.dirname(companionDest));
                await promises_1.default.copyFile(companionPath, companionDest);
            }
        }
    }
    await promises_1.default.writeFile(node_path_1.default.join(backupDir, "_manifest.json"), `${JSON.stringify({ timestamp: slug, targets, files: manifest }, null, 2)}\n`, "utf8");
    return backupDir;
}
async function restoreBackup(cwd, backupDir) {
    const manifestPath = node_path_1.default.join(backupDir, "_manifest.json");
    if (!(await (0, utils_1.fileExists)(manifestPath))) {
        throw new errors_1.UserError("Backup manifest not found. Cannot restore.");
    }
    const manifest = JSON.parse(await promises_1.default.readFile(manifestPath, "utf8"));
    for (const entry of manifest.files) {
        if (await (0, utils_1.fileExists)(entry.dest)) {
            await (0, utils_1.ensureDir)(node_path_1.default.dirname(entry.source));
            await promises_1.default.copyFile(entry.dest, entry.source);
        }
    }
}
async function applyFix(cwd, proposal, options) {
    const { agent, strict, report, log = console.log } = options;
    const backupDir = await createBackup(cwd, proposal.targets);
    await (0, hook_executor_1.runHookPhase)(cwd, "before_normalize", log);
    const normalizedPath = await (0, normalize_1.runNormalize)({ cwd });
    log(`Normalized brief refreshed: ${normalizedPath}`);
    await (0, hook_executor_1.runHookPhase)(cwd, "after_normalize", log);
    for (const type of proposal.targets) {
        await (0, hook_executor_1.runHookPhase)(cwd, `before_${type}`, log);
        const agentResolved = agent ?? undefined;
        const file = await (0, artifacts_1.generateArtifact)({
            artifactType: type,
            cwd,
            normalizedBriefOverride: normalizedPath,
            agent: agentResolved,
            revisionType: "fix"
        });
        log(`${type.toUpperCase()} regenerated (fix): ${file}`);
        await (0, hook_executor_1.runHookPhase)(cwd, `after_${type}`, log);
    }
    await (0, hook_executor_1.runHookPhase)(cwd, "before_validate", log);
    const finalResult = await (0, validate_1.runValidate)(cwd, {
        strict: Boolean(strict),
        report
    });
    await (0, hook_executor_1.runHookPhase)(cwd, "after_validate", log);
    return {
        proposal,
        applied: true,
        finalPass: finalResult.pass,
        reportPath: finalResult.reportPath,
        backupDir
    };
}
async function runFix(options) {
    const { cwd, dryRun, log = console.log } = options;
    const proposal = await buildFixProposal(options);
    if (proposal.targets.length === 0) {
        log("No blocking issues found. Nothing to fix.");
        return {
            proposal,
            applied: false,
            finalPass: true,
            reportPath: proposal.initialReport.reportPath
        };
    }
    if (dryRun) {
        log(`[Dry Run] Would regenerate: ${proposal.targets.join(", ")}`);
        log(`[Dry Run] ${proposal.issues.length} issue(s) identified.`);
        for (const [type, issues] of proposal.issuesByArtifact) {
            log(`  ${type}: ${issues.length} issue(s)`);
            for (const issue of issues) {
                log(`    - [${issue.level}] ${issue.code}: ${issue.message}`);
            }
        }
        return {
            proposal,
            applied: false,
            finalPass: false,
            reportPath: proposal.initialReport.reportPath
        };
    }
    return applyFix(cwd, proposal, options);
}
