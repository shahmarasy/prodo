"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPipelineState = createPipelineState;
exports.hydrateStateFromDisk = hydrateStateFromDisk;
exports.isOutputSatisfied = isOutputSatisfied;
exports.wireInputsFromState = wireInputsFromState;
exports.wireOutputsToState = wireOutputsToState;
const paths_1 = require("../core/paths");
const output_index_1 = require("../core/output-index");
const utils_1 = require("../core/utils");
function createPipelineState(cwd) {
    return {
        cwd,
        normalizedBriefPath: undefined,
        generatedArtifacts: new Map(),
        validationResult: undefined,
        custom: {},
        startedAt: new Date().toISOString(),
        completedSkills: []
    };
}
async function hydrateStateFromDisk(cwd, state, artifactTypes) {
    const nbPath = (0, paths_1.normalizedBriefPath)(cwd);
    if (!state.normalizedBriefPath && (await (0, utils_1.fileExists)(nbPath))) {
        state.normalizedBriefPath = nbPath;
    }
    for (const type of artifactTypes) {
        if (!state.generatedArtifacts.has(type)) {
            const active = await (0, output_index_1.getActiveArtifactPath)(cwd, type);
            if (active) {
                state.generatedArtifacts.set(type, active);
            }
        }
    }
}
function isOutputSatisfied(outputName, state, artifactType) {
    if (outputName === "normalizedBriefPath") {
        return typeof state.normalizedBriefPath === "string" && state.normalizedBriefPath.length > 0;
    }
    if (outputName === "artifactPath" && artifactType) {
        return state.generatedArtifacts.has(artifactType);
    }
    if (outputName === "validationResult") {
        return state.validationResult !== undefined;
    }
    return false;
}
function wireInputsFromState(inputNames, state) {
    const inputs = {};
    for (const name of inputNames) {
        if (name === "cwd")
            inputs.cwd = state.cwd;
        else if (name === "normalizedBriefPath")
            inputs.normalizedBriefPath = state.normalizedBriefPath;
        else if (name in state.custom)
            inputs[name] = state.custom[name];
    }
    return inputs;
}
function wireOutputsToState(outputs, state, skillName) {
    if ("normalizedBriefPath" in outputs && typeof outputs.normalizedBriefPath === "string") {
        state.normalizedBriefPath = outputs.normalizedBriefPath;
    }
    if ("artifactPath" in outputs && typeof outputs.artifactPath === "string") {
        const artifactType = skillName;
        state.generatedArtifacts.set(artifactType, outputs.artifactPath);
    }
    if ("validationResult" in outputs && outputs.validationResult && typeof outputs.validationResult === "object") {
        state.validationResult = outputs.validationResult;
    }
    for (const [key, value] of Object.entries(outputs)) {
        if (!["normalizedBriefPath", "artifactPath", "validationResult"].includes(key)) {
            state.custom[key] = value;
        }
    }
}
