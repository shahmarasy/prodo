"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCoreSkills = registerCoreSkills;
const artifact_registry_1 = require("../core/artifact-registry");
const generate_artifact_1 = require("./generate-artifact");
const fix_1 = require("./fix");
const normalize_1 = require("./normalize");
const validate_1 = require("./validate");
async function registerCoreSkills(registry, cwd) {
    registry.register(normalize_1.normalizeSkill);
    const definitions = await (0, artifact_registry_1.listArtifactDefinitions)(cwd);
    const artifactNames = [];
    for (const def of definitions) {
        const skill = (0, generate_artifact_1.createArtifactSkill)(def.name, def.upstream);
        registry.register(skill);
        artifactNames.push(def.name);
    }
    const validateSkill = (0, validate_1.createValidateSkill)(artifactNames);
    registry.register(validateSkill);
    registry.register(fix_1.fixSkill);
}
