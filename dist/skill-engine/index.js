"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInputPaths = exports.validateOutputs = exports.validateInputs = exports.discoverSkills = exports.getExecutionOrder = exports.detectCycles = exports.buildExecutionPlan = exports.hydrateStateFromDisk = exports.createPipelineState = exports.SkillRegistry = exports.SkillPipeline = void 0;
exports.createEngine = createEngine;
exports.createHydratedState = createHydratedState;
const registry_1 = require("./registry");
const pipeline_1 = require("./pipeline");
const discovery_1 = require("./discovery");
const register_core_1 = require("../skills/register-core");
const context_1 = require("./context");
const artifact_registry_1 = require("../core/artifact-registry");
async function createEngine(cwd, log) {
    const registry = new registry_1.SkillRegistry();
    await (0, register_core_1.registerCoreSkills)(registry, cwd);
    const plugins = await (0, discovery_1.discoverSkills)(cwd, log);
    for (const plugin of plugins) {
        try {
            registry.register(plugin);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log?.(`[Skill Engine] Plugin registration failed: ${message}`);
        }
    }
    return new pipeline_1.SkillPipeline(registry);
}
async function createHydratedState(cwd) {
    const state = (0, context_1.createPipelineState)(cwd);
    const artifactTypes = await (0, artifact_registry_1.listArtifactTypes)(cwd);
    await (0, context_1.hydrateStateFromDisk)(cwd, state, artifactTypes);
    return state;
}
var pipeline_2 = require("./pipeline");
Object.defineProperty(exports, "SkillPipeline", { enumerable: true, get: function () { return pipeline_2.SkillPipeline; } });
var registry_2 = require("./registry");
Object.defineProperty(exports, "SkillRegistry", { enumerable: true, get: function () { return registry_2.SkillRegistry; } });
var context_2 = require("./context");
Object.defineProperty(exports, "createPipelineState", { enumerable: true, get: function () { return context_2.createPipelineState; } });
Object.defineProperty(exports, "hydrateStateFromDisk", { enumerable: true, get: function () { return context_2.hydrateStateFromDisk; } });
var graph_1 = require("./graph");
Object.defineProperty(exports, "buildExecutionPlan", { enumerable: true, get: function () { return graph_1.buildExecutionPlan; } });
Object.defineProperty(exports, "detectCycles", { enumerable: true, get: function () { return graph_1.detectCycles; } });
Object.defineProperty(exports, "getExecutionOrder", { enumerable: true, get: function () { return graph_1.getExecutionOrder; } });
var discovery_2 = require("./discovery");
Object.defineProperty(exports, "discoverSkills", { enumerable: true, get: function () { return discovery_2.discoverSkills; } });
var validator_1 = require("./validator");
Object.defineProperty(exports, "validateInputs", { enumerable: true, get: function () { return validator_1.validateInputs; } });
Object.defineProperty(exports, "validateOutputs", { enumerable: true, get: function () { return validator_1.validateOutputs; } });
Object.defineProperty(exports, "validateInputPaths", { enumerable: true, get: function () { return validator_1.validateInputPaths; } });
