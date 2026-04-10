"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCliVersion = readCliVersion;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const utils_1 = require("./utils");
async function readCliVersion(cwd) {
    const candidates = [
        node_path_1.default.join(cwd, "package.json"),
        node_path_1.default.resolve(__dirname, "..", "..", "package.json")
    ];
    for (const candidate of candidates) {
        if (!(await (0, utils_1.fileExists)(candidate)))
            continue;
        try {
            const raw = await promises_1.default.readFile(candidate, "utf8");
            const parsed = JSON.parse(raw);
            if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
                return parsed.version.trim();
            }
        }
        catch {
            // ignore and continue
        }
    }
    return "0.0.0";
}
