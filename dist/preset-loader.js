"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyConfiguredPresets = applyConfiguredPresets;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const errors_1 = require("./errors");
const project_config_1 = require("./project-config");
const utils_1 = require("./utils");
function parseVersion(version) {
    return version.split(".").map((part) => Number(part.replace(/[^0-9]/g, "")) || 0).slice(0, 3);
}
function cmpVersion(a, b) {
    const left = parseVersion(a);
    const right = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if ((left[i] ?? 0) > (right[i] ?? 0))
            return 1;
        if ((left[i] ?? 0) < (right[i] ?? 0))
            return -1;
    }
    return 0;
}
async function readPresetManifest(presetDir) {
    const candidates = ["preset.yaml", "preset.yml", "preset.json"];
    for (const name of candidates) {
        const file = node_path_1.default.join(presetDir, name);
        if (!(await (0, utils_1.fileExists)(file)))
            continue;
        if (name.endsWith(".json")) {
            const parsed = JSON.parse(await promises_1.default.readFile(file, "utf8"));
            const presetName = typeof parsed.name === "string" ? parsed.name.trim() : node_path_1.default.basename(presetDir);
            return {
                name: presetName,
                version: typeof parsed.version === "string" ? parsed.version : undefined,
                priority: typeof parsed.priority === "number" ? parsed.priority : 0,
                min_prodo_version: typeof parsed.min_prodo_version === "string" ? parsed.min_prodo_version : undefined,
                max_prodo_version: typeof parsed.max_prodo_version === "string" ? parsed.max_prodo_version : undefined,
                command_packs: Array.isArray(parsed.command_packs)
                    ? parsed.command_packs.filter((item) => typeof item === "string")
                    : []
            };
        }
        const parsed = js_yaml_1.default.load(await promises_1.default.readFile(file, "utf8")) ?? {};
        const presetName = typeof parsed.name === "string" ? parsed.name.trim() : node_path_1.default.basename(presetDir);
        return {
            name: presetName,
            version: typeof parsed.version === "string" ? parsed.version : undefined,
            priority: typeof parsed.priority === "number" ? parsed.priority : 0,
            min_prodo_version: typeof parsed.min_prodo_version === "string" ? parsed.min_prodo_version : undefined,
            max_prodo_version: typeof parsed.max_prodo_version === "string" ? parsed.max_prodo_version : undefined,
            command_packs: Array.isArray(parsed.command_packs)
                ? parsed.command_packs.filter((item) => typeof item === "string")
                : []
        };
    }
    throw new errors_1.UserError(`Preset manifest is missing in ${presetDir} (expected preset.yaml or preset.json).`);
}
async function collectFilesRecursive(rootDir) {
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
async function collectPresetOps(presetDir, prodoRoot, priority, order) {
    const lanes = ["prompts", "schemas", "templates", "commands"];
    const ops = [];
    for (const lane of lanes) {
        const sourceBase = node_path_1.default.join(presetDir, lane);
        const files = await collectFilesRecursive(sourceBase);
        for (const source of files) {
            const relative = node_path_1.default.relative(sourceBase, source);
            ops.push({
                source,
                target: node_path_1.default.join(prodoRoot, lane, relative),
                priority,
                order
            });
        }
    }
    return ops;
}
async function resolvePresetDir(projectRoot, presetName) {
    const candidates = [
        node_path_1.default.join(projectRoot, "presets", presetName),
        node_path_1.default.resolve(__dirname, "..", "presets", presetName)
    ];
    for (const candidate of candidates) {
        if (await (0, utils_1.fileExists)(candidate))
            return candidate;
    }
    throw new errors_1.UserError(`Preset not found: ${presetName}. Create presets/${presetName} with a preset manifest.`);
}
async function writeInstalledPresets(prodoRoot, names) {
    const file = node_path_1.default.join(prodoRoot, "presets", "installed.json");
    await (0, utils_1.ensureDir)(node_path_1.default.dirname(file));
    await promises_1.default.writeFile(file, `${JSON.stringify(Array.from(new Set(names)).sort(), null, 2)}\n`, "utf8");
}
async function readInstalledPresets(prodoRoot) {
    const file = node_path_1.default.join(prodoRoot, "presets", "installed.json");
    if (!(await (0, utils_1.fileExists)(file)))
        return [];
    try {
        const parsed = JSON.parse(await promises_1.default.readFile(file, "utf8"));
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }
    catch {
        return [];
    }
}
async function applyCopyOps(ops) {
    const selected = new Map();
    for (const op of ops) {
        const current = selected.get(op.target);
        if (!current) {
            selected.set(op.target, op);
            continue;
        }
        if (op.priority > current.priority || (op.priority === current.priority && op.order > current.order)) {
            selected.set(op.target, op);
        }
    }
    for (const op of selected.values()) {
        await (0, utils_1.ensureDir)(node_path_1.default.dirname(op.target));
        await promises_1.default.copyFile(op.source, op.target);
    }
}
async function collectCommandPackOps(projectRoot, prodoRoot, names) {
    const ops = [];
    for (const [index, name] of names.entries()) {
        const base = node_path_1.default.join(projectRoot, "command-packs", name);
        if (!(await (0, utils_1.fileExists)(base))) {
            throw new errors_1.UserError(`Command pack not found: command-packs/${name}`);
        }
        const laneMap = {
            commands: "commands"
        };
        for (const [sourceLane, targetLane] of Object.entries(laneMap)) {
            const sourceBase = node_path_1.default.join(base, sourceLane);
            const files = await collectFilesRecursive(sourceBase);
            for (const source of files) {
                const relative = node_path_1.default.relative(sourceBase, source);
                ops.push({
                    source,
                    target: node_path_1.default.join(prodoRoot, targetLane, relative),
                    priority: 100,
                    order: index
                });
            }
        }
    }
    return ops;
}
async function applyConfiguredPresets(projectRoot, prodoRoot, prodoVersion, presetOverride) {
    const config = await (0, project_config_1.readProjectConfig)(projectRoot);
    const presets = Array.from(new Set([...(config.presets ?? []), ...(presetOverride ? [presetOverride] : [])]));
    const existingInstalled = await readInstalledPresets(prodoRoot);
    const allOps = [];
    const installedNames = [...existingInstalled];
    const commandPacks = new Set(config.command_packs ?? []);
    for (const [order, presetName] of presets.entries()) {
        const presetDir = await resolvePresetDir(projectRoot, presetName);
        const manifest = await readPresetManifest(presetDir);
        if (manifest.min_prodo_version && cmpVersion(prodoVersion, manifest.min_prodo_version) < 0) {
            throw new errors_1.UserError(`Preset ${presetName} requires prodo >= ${manifest.min_prodo_version}, current is ${prodoVersion}.`);
        }
        if (manifest.max_prodo_version && cmpVersion(prodoVersion, manifest.max_prodo_version) > 0) {
            throw new errors_1.UserError(`Preset ${presetName} supports prodo <= ${manifest.max_prodo_version}, current is ${prodoVersion}.`);
        }
        for (const pack of manifest.command_packs ?? []) {
            if (pack.trim())
                commandPacks.add(pack.trim());
        }
        installedNames.push(manifest.name || presetName);
        allOps.push(...(await collectPresetOps(presetDir, prodoRoot, manifest.priority ?? 0, order)));
    }
    const commandPackList = Array.from(commandPacks);
    if (commandPackList.length > 0) {
        const commandPackOps = await collectCommandPackOps(projectRoot, prodoRoot, commandPackList);
        allOps.push(...commandPackOps);
    }
    if (allOps.length > 0)
        await applyCopyOps(allOps);
    await writeInstalledPresets(prodoRoot, installedNames);
    return {
        installedPresets: Array.from(new Set(installedNames)),
        appliedFiles: Array.from(new Set(allOps.map((item) => item.target)))
    };
}
