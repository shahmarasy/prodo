"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillRegistry = void 0;
const errors_1 = require("../core/errors");
function validateManifest(manifest) {
    if (!manifest.name || typeof manifest.name !== "string")
        return "Skill name is required";
    if (!manifest.version || typeof manifest.version !== "string")
        return "Skill version is required";
    if (!manifest.description || typeof manifest.description !== "string")
        return "Skill description is required";
    const validCategories = ["core", "artifact", "validation", "custom"];
    if (!validCategories.includes(manifest.category)) {
        return `Invalid category "${manifest.category}". Must be: ${validCategories.join(", ")}`;
    }
    if (!Array.isArray(manifest.depends_on))
        return "depends_on must be an array";
    if (!Array.isArray(manifest.inputs))
        return "inputs must be an array";
    if (!Array.isArray(manifest.outputs))
        return "outputs must be an array";
    const validTypes = ["string", "path", "boolean", "json", "number"];
    for (const input of manifest.inputs) {
        if (!input.name || typeof input.name !== "string")
            return "Input name is required";
        if (!validTypes.includes(input.type))
            return `Invalid input type "${input.type}" for "${input.name}"`;
    }
    for (const output of manifest.outputs) {
        if (!output.name || typeof output.name !== "string")
            return "Output name is required";
        if (!validTypes.includes(output.type))
            return `Invalid output type "${output.type}" for "${output.name}"`;
    }
    return null;
}
class SkillRegistry {
    skills = new Map();
    register(skill) {
        const error = validateManifest(skill.manifest);
        if (error) {
            throw new errors_1.UserError(`Invalid skill manifest for "${skill.manifest?.name ?? "unknown"}": ${error}`);
        }
        if (typeof skill.execute !== "function") {
            throw new errors_1.UserError(`Skill "${skill.manifest.name}" must export an execute function`);
        }
        if (this.skills.has(skill.manifest.name)) {
            throw new errors_1.UserError(`Skill "${skill.manifest.name}" is already registered`);
        }
        this.skills.set(skill.manifest.name, skill);
    }
    get(name) {
        return this.skills.get(name);
    }
    has(name) {
        return this.skills.has(name);
    }
    list() {
        return Array.from(this.skills.values());
    }
    listByCategory(category) {
        return this.list().filter((s) => s.manifest.category === category);
    }
    listManifests() {
        return this.list().map((s) => s.manifest);
    }
    unregister(name) {
        return this.skills.delete(name);
    }
    size() {
        return this.skills.size;
    }
}
exports.SkillRegistry = SkillRegistry;
