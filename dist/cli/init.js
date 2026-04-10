"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInit = runInit;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const js_yaml_1 = __importDefault(require("js-yaml"));
const agent_command_installer_1 = require("./agent-command-installer");
const artifact_registry_1 = require("../core/artifact-registry");
const utils_1 = require("../core/utils");
const paths_1 = require("../core/paths");
const preset_loader_1 = require("./preset-loader");
const registry_1 = require("../core/registry");
const settings_1 = require("../core/settings");
const template_resolver_1 = require("../core/template-resolver");
const workflow_commands_1 = require("../core/workflow-commands");
const templates_1 = require("../core/templates");
function templateFileName(artifactType) {
    if (artifactType === "workflow")
        return `${artifactType}.mmd`;
    if (artifactType === "wireframe")
        return `${artifactType}.html`;
    return `${artifactType}.md`;
}
async function writeFileIfMissing(filePath, content) {
    if (await (0, utils_1.fileExists)(filePath))
        return;
    await promises_1.default.writeFile(filePath, content, "utf8");
}
async function readProdoVersion(cwd) {
    const candidates = [
        node_path_1.default.join(cwd, "package.json"),
        node_path_1.default.resolve(__dirname, "..", "..", "package.json")
    ];
    for (const candidate of candidates) {
        if (!(await (0, utils_1.fileExists)(candidate)))
            continue;
        try {
            const parsed = JSON.parse(await promises_1.default.readFile(candidate, "utf8"));
            if (typeof parsed.version === "string" && parsed.version.trim().length > 0)
                return parsed.version;
        }
        catch {
            // ignore and continue
        }
    }
    return "0.0.0-dev";
}
async function fileSha256(filePath) {
    const content = await promises_1.default.readFile(filePath);
    return (0, node_crypto_1.createHash)("sha256").update(content).digest("hex");
}
async function listFilesRecursive(rootDir) {
    if (!(await (0, utils_1.fileExists)(rootDir)))
        return [];
    const out = [];
    const walk = async (current) => {
        const entries = await promises_1.default.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = node_path_1.default.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            }
            else {
                out.push(full);
            }
        }
    };
    await walk(rootDir);
    return out;
}
async function loadPreviousManifest(root) {
    const manifestPath = node_path_1.default.join(root, "scaffold-manifest.json");
    if (!(await (0, utils_1.fileExists)(manifestPath)))
        return null;
    try {
        const parsed = JSON.parse(await promises_1.default.readFile(manifestPath, "utf8"));
        if (!Array.isArray(parsed.assets))
            return null;
        return {
            schema_version: "1.0",
            generated_at: parsed.generated_at ?? "",
            prodo_version: parsed.prodo_version ?? "0.0.0-dev",
            copied_asset_count: Number(parsed.copied_asset_count ?? 0),
            copied_assets: Array.isArray(parsed.copied_assets) ? parsed.copied_assets : [],
            asset_count: Number(parsed.asset_count ?? 0),
            parity_summary: {
                match_count: Number(parsed.parity_summary?.match_count ?? 0),
                drift_count: Number(parsed.parity_summary?.drift_count ?? 0),
                missing_count: Number(parsed.parity_summary?.missing_count ?? 0),
                protected_count: Number(parsed.parity_summary?.protected_count ?? 0),
                updated_count: Number(parsed.parity_summary?.updated_count ?? 0),
                unmanaged_count: Number(parsed.parity_summary?.unmanaged_count ?? 0)
            },
            assets: parsed.assets
        };
    }
    catch {
        return null;
    }
}
async function copyDirIfMissing(sourceDir, targetDir, copiedAssets) {
    if (!(await (0, utils_1.fileExists)(sourceDir)))
        return;
    await (0, utils_1.ensureDir)(targetDir);
    const entries = await promises_1.default.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const src = node_path_1.default.join(sourceDir, entry.name);
        const dst = node_path_1.default.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            await copyDirIfMissing(src, dst, copiedAssets);
            continue;
        }
        if (await (0, utils_1.fileExists)(dst))
            continue;
        await promises_1.default.copyFile(src, dst);
        copiedAssets.push({
            source: src,
            target: dst,
            sha256: await fileSha256(dst)
        });
    }
}
async function refreshLegacyCommandTemplates(sourceDir, targetDir) {
    if (!(await (0, utils_1.fileExists)(sourceDir)) || !(await (0, utils_1.fileExists)(targetDir)))
        return;
    const entries = await promises_1.default.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        if (!entry.name.startsWith("prodo-") || !entry.name.endsWith(".md"))
            continue;
        const src = node_path_1.default.join(sourceDir, entry.name);
        const dst = node_path_1.default.join(targetDir, entry.name);
        if (!(await (0, utils_1.fileExists)(dst)))
            continue;
        const existing = await promises_1.default.readFile(dst, "utf8");
        const isLegacyRunMode = /run:\s*\n\s*action:\s*[^\n]+/m.test(existing) || /mode:\s*internal-runtime/m.test(existing);
        if (!isLegacyRunMode)
            continue;
        await promises_1.default.copyFile(src, dst);
    }
}
async function buildAssetManifest(pairs, previous, backup) {
    const previousByTarget = new Map();
    for (const item of previous?.assets ?? []) {
        previousByTarget.set(node_path_1.default.resolve(item.target), item);
    }
    const items = [];
    for (const pair of pairs) {
        const sourceFiles = await listFilesRecursive(pair.sourceDir);
        for (const sourceFile of sourceFiles) {
            const relative = node_path_1.default.relative(pair.sourceDir, sourceFile);
            const targetFile = node_path_1.default.join(pair.targetDir, relative);
            const resolvedTarget = node_path_1.default.resolve(targetFile);
            const sourceHash = await fileSha256(sourceFile);
            const targetExists = await (0, utils_1.fileExists)(targetFile);
            if (!targetExists) {
                await (0, utils_1.ensureDir)(node_path_1.default.dirname(targetFile));
                backup.set(resolvedTarget, null);
                await promises_1.default.copyFile(sourceFile, targetFile);
                items.push({
                    source: sourceFile,
                    target: targetFile,
                    source_sha256: sourceHash,
                    target_sha256: await fileSha256(targetFile),
                    status: "missing"
                });
                continue;
            }
            const currentTargetHash = await fileSha256(targetFile);
            const prev = previousByTarget.get(resolvedTarget);
            const prevTargetHash = prev?.target_sha256 ?? null;
            const prevSourceHash = prev?.source_sha256 ?? null;
            if (currentTargetHash === sourceHash) {
                items.push({
                    source: sourceFile,
                    target: targetFile,
                    source_sha256: sourceHash,
                    target_sha256: currentTargetHash,
                    status: "match"
                });
                continue;
            }
            if (prev && prevTargetHash && prevSourceHash && currentTargetHash === prevTargetHash && prevSourceHash !== sourceHash) {
                if (!backup.has(resolvedTarget)) {
                    backup.set(resolvedTarget, await promises_1.default.readFile(targetFile));
                }
                await promises_1.default.copyFile(sourceFile, targetFile);
                items.push({
                    source: sourceFile,
                    target: targetFile,
                    source_sha256: sourceHash,
                    target_sha256: await fileSha256(targetFile),
                    status: "updated"
                });
                continue;
            }
            if (prev) {
                items.push({
                    source: sourceFile,
                    target: targetFile,
                    source_sha256: sourceHash,
                    target_sha256: currentTargetHash,
                    status: "protected"
                });
                continue;
            }
            items.push({
                source: sourceFile,
                target: targetFile,
                source_sha256: sourceHash,
                target_sha256: currentTargetHash,
                status: "unmanaged"
            });
        }
    }
    return items;
}
async function rollbackFiles(backup) {
    for (const [target, content] of backup.entries()) {
        if (content === null) {
            if (await (0, utils_1.fileExists)(target))
                await promises_1.default.rm(target, { force: true });
            continue;
        }
        await (0, utils_1.ensureDir)(node_path_1.default.dirname(target));
        await promises_1.default.writeFile(target, content);
    }
}
function summarizeParity(items) {
    const byStatus = (status) => items.filter((item) => item.status === status).length;
    return {
        match_count: byStatus("match"),
        drift_count: byStatus("drift"),
        missing_count: byStatus("missing"),
        protected_count: byStatus("protected"),
        updated_count: byStatus("updated"),
        unmanaged_count: byStatus("unmanaged")
    };
}
async function runInit(cwd, options) {
    const root = (0, paths_1.prodoPath)(cwd);
    const artifactDefs = await (0, artifact_registry_1.listArtifactDefinitions)(cwd);
    const artifactTypes = artifactDefs.map((item) => item.name);
    const workflowCommands = (0, workflow_commands_1.buildWorkflowCommands)(artifactTypes);
    const prodoVersion = await readProdoVersion(cwd);
    const localRepoTemplates = node_path_1.default.join(cwd, "templates");
    const packagedTemplates = node_path_1.default.resolve(__dirname, "..", "..", "templates");
    const projectScaffoldTemplates = (await (0, utils_1.fileExists)(localRepoTemplates)) ? localRepoTemplates : packagedTemplates;
    const copiedAssets = [];
    const backup = new Map();
    const previousManifest = await loadPreviousManifest(root);
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "briefs"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "schemas"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "prompts"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "commands"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "presets"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "templates"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "templates", "overrides"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "state"));
    await (0, utils_1.ensureDir)(node_path_1.default.join(root, "state", "context"));
    for (const def of artifactDefs) {
        await (0, utils_1.ensureDir)((0, paths_1.outputDirPath)(cwd, def.name, def.output_dir));
    }
    await (0, utils_1.ensureDir)(node_path_1.default.join(cwd, "product-docs", "reports"));
    await writeFileIfMissing((0, paths_1.outputIndexPath)(cwd), `${JSON.stringify({ active: {}, history: {}, updated_at: new Date(0).toISOString() }, null, 2)}\n`);
    await writeFileIfMissing((0, paths_1.briefPath)(cwd), templates_1.START_BRIEF_TEMPLATE);
    await writeFileIfMissing(node_path_1.default.join(root, "briefs", "normalized-brief.json"), `${JSON.stringify(templates_1.NORMALIZED_BRIEF_TEMPLATE, null, 2)}\n`);
    await writeFileIfMissing(node_path_1.default.join(root, "hooks.yml"), templates_1.HOOKS_TEMPLATE);
    await writeFileIfMissing(node_path_1.default.join(root, "prompts", "normalize.md"), `${templates_1.NORMALIZE_PROMPT_TEMPLATE}\n`);
    const scriptType = options?.script ?? (process.platform === "win32" ? "ps" : "sh");
    await promises_1.default.writeFile(node_path_1.default.join(root, "init-options.json"), `${JSON.stringify({ ai: options?.ai ?? null, lang: options?.lang ?? "en", author: options?.author ?? null, preset: options?.preset ?? null, script: scriptType }, null, 2)}\n`, "utf8");
    await copyDirIfMissing(node_path_1.default.join(projectScaffoldTemplates, "artifacts"), node_path_1.default.join(root, "templates"), copiedAssets);
    for (const artifact of artifactDefs) {
        const markdownTemplatePath = node_path_1.default.join(root, "templates", `${artifact.name}.md`);
        const templateHeadings = (await (0, utils_1.fileExists)(markdownTemplatePath))
            ? (0, template_resolver_1.extractRequiredHeadingsFromTemplate)(await promises_1.default.readFile(markdownTemplatePath, "utf8"))
            : [];
        const schema = {
            ...(0, templates_1.schemaTemplate)(artifact.name),
            x_required_headings: templateHeadings.length > 0 ? templateHeadings : artifact.required_headings
        };
        await writeFileIfMissing(node_path_1.default.join(root, "schemas", `${artifact.name}.yaml`), js_yaml_1.default.dump(schema));
        await writeFileIfMissing(node_path_1.default.join(root, "prompts", `${artifact.name}.md`), `${(0, templates_1.promptTemplate)(artifact.name, options?.lang ?? "en")}\n`);
        await writeFileIfMissing(node_path_1.default.join(root, "templates", templateFileName(artifact.name)), `${(0, templates_1.artifactTemplateTemplate)(artifact.name, options?.lang ?? "en")}\n`);
    }
    await copyDirIfMissing(node_path_1.default.join(projectScaffoldTemplates, "commands"), node_path_1.default.join(root, "commands"), copiedAssets);
    await refreshLegacyCommandTemplates(node_path_1.default.join(projectScaffoldTemplates, "commands"), node_path_1.default.join(root, "commands"));
    for (const command of workflowCommands) {
        await writeFileIfMissing(node_path_1.default.join(root, "commands", `${command.name}.md`), `${(0, templates_1.commandTemplate)(command)}\n`);
    }
    await (0, preset_loader_1.applyConfiguredPresets)(cwd, root, prodoVersion, options?.preset);
    const pairs = [
        {
            sourceDir: node_path_1.default.join(projectScaffoldTemplates, "commands"),
            targetDir: node_path_1.default.join(root, "commands")
        },
        {
            sourceDir: node_path_1.default.join(projectScaffoldTemplates, "artifacts"),
            targetDir: node_path_1.default.join(root, "templates")
        }
    ];
    let parity = [];
    try {
        parity = await buildAssetManifest(pairs, previousManifest, backup);
    }
    catch (error) {
        await rollbackFiles(backup);
        throw error;
    }
    const installedAgentFiles = options?.ai ? await (0, agent_command_installer_1.installAgentCommands)(cwd, options.ai) : [];
    const manifest = {
        schema_version: "1.0",
        generated_at: new Date().toISOString(),
        prodo_version: prodoVersion,
        copied_asset_count: copiedAssets.length,
        copied_assets: copiedAssets,
        asset_count: parity.length,
        parity_summary: summarizeParity(parity),
        assets: parity
    };
    await promises_1.default.writeFile(node_path_1.default.join(root, "scaffold-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await (0, registry_1.syncRegistry)(cwd);
    const settingsPath = await (0, settings_1.writeSettings)(cwd, {
        lang: (options?.lang ?? "en").trim() || "en",
        ai: options?.ai,
        author: (options?.author ?? "").trim() || undefined,
        provider: options?.provider
    });
    return { installedAgentFiles, settingsPath };
}
