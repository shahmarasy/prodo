"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInputs = validateInputs;
exports.validateInputPaths = validateInputPaths;
exports.validateOutputs = validateOutputs;
const utils_1 = require("../core/utils");
function makeError(skillName, phase, message, hints = []) {
    return {
        skillName,
        phase,
        message,
        recoveryHints: hints
    };
}
function checkType(value, expectedType, fieldName) {
    switch (expectedType) {
        case "string":
            if (typeof value !== "string")
                return `"${fieldName}" must be a string, got ${typeof value}`;
            return null;
        case "path":
            if (typeof value !== "string")
                return `"${fieldName}" must be a path (string), got ${typeof value}`;
            return null;
        case "boolean":
            if (typeof value !== "boolean")
                return `"${fieldName}" must be a boolean, got ${typeof value}`;
            return null;
        case "number":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return `"${fieldName}" must be a finite number, got ${typeof value}`;
            }
            return null;
        case "json":
            if (typeof value === "string") {
                try {
                    JSON.parse(value);
                }
                catch {
                    return `"${fieldName}" must be valid JSON string`;
                }
            }
            return null;
        default:
            return null;
    }
}
function validateInputs(manifest, inputs) {
    for (const input of manifest.inputs) {
        const value = inputs[input.name];
        if (input.required && (value === undefined || value === null)) {
            if (input.default !== undefined)
                continue;
            return makeError(manifest.name, "input_validation", `Required input "${input.name}" is missing`, [`Provide "${input.name}" (${input.type}): ${input.description ?? ""}`]);
        }
        if (value === undefined || value === null)
            continue;
        const typeError = checkType(value, input.type, input.name);
        if (typeError) {
            return makeError(manifest.name, "input_validation", typeError, [`Expected type: ${input.type}`]);
        }
    }
    return null;
}
async function validateInputPaths(manifest, inputs) {
    for (const input of manifest.inputs) {
        if (input.type !== "path")
            continue;
        const value = inputs[input.name];
        if (typeof value !== "string")
            continue;
        if (input.required && !(await (0, utils_1.fileExists)(value))) {
            return makeError(manifest.name, "input_validation", `Path "${input.name}" does not exist: ${value}`, [`Ensure the file or directory exists: ${value}`]);
        }
    }
    return null;
}
function validateOutputs(manifest, outputs) {
    for (const output of manifest.outputs) {
        const value = outputs[output.name];
        if (value === undefined || value === null) {
            return makeError(manifest.name, "output_validation", `Expected output "${output.name}" was not produced`, [`Skill "${manifest.name}" should return "${output.name}" (${output.type})`]);
        }
        const typeError = checkType(value, output.type, output.name);
        if (typeError) {
            return makeError(manifest.name, "output_validation", typeError, [`Skill "${manifest.name}" returned wrong type for "${output.name}"`]);
        }
    }
    return null;
}
