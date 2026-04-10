"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSkillEngine = createSkillEngine;
exports.getGlobalSkillEngine = getGlobalSkillEngine;
exports.resetGlobalSkillEngine = resetGlobalSkillEngine;
const errors_1 = require("../core/errors");
function validateInputs(skill, inputs) {
    for (const input of skill.manifest.inputs) {
        if (input.required && !(input.name in inputs)) {
            throw new errors_1.UserError(`Skill "${skill.manifest.name}" requires input "${input.name}" (${input.description})`);
        }
    }
}
function createSkillEngine() {
    const skills = new Map();
    return {
        register(skill) {
            skills.set(skill.manifest.name, skill);
        },
        getSkill(name) {
            return skills.get(name);
        },
        listSkills() {
            return Array.from(skills.values()).map((s) => s.manifest);
        },
        async execute(name, context, inputs) {
            const skill = skills.get(name);
            if (!skill) {
                const available = Array.from(skills.keys()).join(", ");
                throw new errors_1.UserError(`Unknown skill: "${name}". Available: ${available}`);
            }
            validateInputs(skill, inputs);
            return skill.execute(context, inputs);
        }
    };
}
let globalEngine = null;
function getGlobalSkillEngine() {
    if (!globalEngine) {
        globalEngine = createSkillEngine();
        loadBuiltinSkills(globalEngine);
    }
    return globalEngine;
}
function resetGlobalSkillEngine() {
    globalEngine = null;
}
function loadBuiltinSkills(engine) {
    // Lazy-load to avoid circular dependencies
    try {
        const { normalizeSkill } = require("./normalize-skill");
        engine.register(normalizeSkill);
    }
    catch { /* skill not available */ }
    try {
        const { validateSkill } = require("./validate-skill");
        engine.register(validateSkill);
    }
    catch { /* skill not available */ }
    try {
        const { fixSkill } = require("./fix-skill");
        engine.register(fixSkill);
    }
    catch { /* skill not available */ }
    try {
        const { generateArtifactSkill } = require("./generate-artifact-skill");
        engine.register(generateArtifactSkill);
    }
    catch { /* skill not available */ }
    try {
        const { generatePipelineSkill } = require("./generate-pipeline-skill");
        engine.register(generatePipelineSkill);
    }
    catch { /* skill not available */ }
}
