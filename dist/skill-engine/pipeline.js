"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillPipeline = void 0;
const errors_1 = require("../core/errors");
const context_1 = require("./context");
const graph_1 = require("./graph");
const validator_1 = require("./validator");
function createSkillError(skillName, phase, error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return {
        skillName,
        phase,
        message,
        stack,
        recoveryHints: [`Skill "${skillName}" failed during ${phase}. Check inputs and retry.`]
    };
}
class SkillPipeline {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async runPipeline(skillNames, state, options = {}) {
        const { log = console.log, progress, agent } = options;
        for (const name of skillNames) {
            if (!this.registry.has(name)) {
                const available = this.registry.list().map((s) => s.manifest.name).join(", ");
                throw new errors_1.UserError(`Unknown skill: "${name}". Available: ${available}`);
            }
        }
        const manifests = new Map(this.registry.list().map((s) => [s.manifest.name, s.manifest]));
        const executionOrder = (0, graph_1.getExecutionOrder)(manifests, skillNames);
        const totalSteps = executionOrder.length;
        for (let i = 0; i < executionOrder.length; i++) {
            const skillName = executionOrder[i];
            if (state.completedSkills.includes(skillName)) {
                log(`[Skip] ${skillName} — already completed`);
                continue;
            }
            const skill = this.registry.get(skillName);
            if (!skill)
                continue;
            progress?.(i + 1, totalSteps, `Running ${skillName}...`);
            log(`[${i + 1}/${totalSteps}] ${skillName}`);
            const inputNames = skill.manifest.inputs.map((inp) => inp.name);
            const wiredInputs = (0, context_1.wireInputsFromState)(inputNames, state);
            const inputError = (0, validator_1.validateInputs)(skill.manifest, wiredInputs);
            if (inputError) {
                throw new errors_1.UserError(`Skill "${skillName}" input validation failed: ${inputError.message}\n` +
                    inputError.recoveryHints.join("\n"));
            }
            let outputs;
            try {
                const context = {
                    state,
                    progress: progress ?? (() => { }),
                    log,
                    agent
                };
                outputs = await skill.execute(context, wiredInputs);
            }
            catch (error) {
                const skillError = createSkillError(skillName, "execution", error);
                throw new errors_1.UserError(`Skill "${skillName}" execution failed: ${skillError.message}\n` +
                    skillError.recoveryHints.join("\n"));
            }
            const outputError = (0, validator_1.validateOutputs)(skill.manifest, outputs);
            if (outputError) {
                log(`[Warning] Skill "${skillName}" output validation: ${outputError.message}`);
            }
            (0, context_1.wireOutputsToState)(outputs, state, skillName);
            state.completedSkills.push(skillName);
        }
        return state;
    }
    async runSkill(name, state, options = {}) {
        return this.runPipeline([name], state, options);
    }
    getRegistry() {
        return this.registry;
    }
}
exports.SkillPipeline = SkillPipeline;
