"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listArtifactDefinitions = listArtifactDefinitions;
exports.listArtifactTypes = listArtifactTypes;
exports.getArtifactDefinition = getArtifactDefinition;
const constants_1 = require("./constants");
const project_config_1 = require("./project-config");
const types_1 = require("./types");
function normalizeName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}
function toDefinition(partial) {
    const name = normalizeName(partial.name);
    const outputDir = partial.output_dir?.trim() || (0, constants_1.defaultOutputDir)(name);
    const requiredHeadings = partial.required_headings?.length ? partial.required_headings : (0, constants_1.defaultRequiredHeadings)(name);
    const upstream = (partial.upstream?.length ? partial.upstream : (0, constants_1.defaultUpstreamByArtifact)(name)).map(normalizeName);
    const requiredContracts = partial.required_contracts?.length
        ? partial.required_contracts
        : (0, constants_1.defaultRequiredContractsByArtifact)(name);
    return {
        name,
        output_dir: outputDir,
        required_headings: requiredHeadings,
        upstream,
        required_contracts: requiredContracts
    };
}
async function listArtifactDefinitions(cwd) {
    const config = await (0, project_config_1.readProjectConfig)(cwd);
    const base = types_1.ARTIFACT_TYPES.map((name) => toDefinition({ name }));
    const byName = new Map(base.map((item) => [item.name, item]));
    for (const extra of config.artifacts ?? []) {
        const merged = toDefinition(extra);
        byName.set(merged.name, merged);
    }
    return Array.from(byName.values());
}
async function listArtifactTypes(cwd) {
    const defs = await listArtifactDefinitions(cwd);
    return defs.map((item) => item.name);
}
async function getArtifactDefinition(cwd, artifactType) {
    const normalized = normalizeName(artifactType);
    const defs = await listArtifactDefinitions(cwd);
    const found = defs.find((item) => item.name === normalized);
    if (found)
        return found;
    return toDefinition({ name: normalized });
}
