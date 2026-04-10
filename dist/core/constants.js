"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STATUS = exports.PRODO_DIR = void 0;
exports.defaultOutputDir = defaultOutputDir;
exports.defaultRequiredHeadings = defaultRequiredHeadings;
exports.defaultUpstreamByArtifact = defaultUpstreamByArtifact;
exports.defaultRequiredContractsByArtifact = defaultRequiredContractsByArtifact;
exports.PRODO_DIR = ".prodo";
exports.DEFAULT_STATUS = "draft";
const CORE_OUTPUT_DIR_BY_ARTIFACT = {
    prd: "prd",
    workflow: "workflows",
    wireframe: "wireframes",
    stories: "stories",
    techspec: "techspec"
};
const CORE_REQUIRED_HEADINGS = {
    prd: ["## Problem", "## Goals", "## Scope", "## Requirements"],
    workflow: [
        "## Flow Purpose",
        "## Actors",
        "## Preconditions",
        "## Main Flow",
        "## Edge Cases",
        "## Postconditions"
    ],
    wireframe: [
        "## Screen Purpose",
        "## Primary Actor",
        "## Main Sections",
        "## Fields/Inputs",
        "## Actions/Buttons",
        "## States/Messages",
        "## Notes"
    ],
    stories: ["## User Stories", "## Acceptance Criteria"],
    techspec: ["## Architecture", "## Data Model", "## APIs", "## Risks"]
};
const CORE_UPSTREAM_BY_ARTIFACT = {
    prd: [],
    workflow: ["prd"],
    wireframe: ["prd", "workflow"],
    stories: ["prd"],
    techspec: ["prd", "stories"]
};
const CORE_REQUIRED_CONTRACTS_BY_ARTIFACT = {
    prd: ["goals", "core_features"],
    workflow: ["core_features"],
    wireframe: ["core_features"],
    stories: ["core_features"],
    techspec: ["core_features", "constraints"]
};
function defaultOutputDir(artifactType) {
    return CORE_OUTPUT_DIR_BY_ARTIFACT[artifactType] ?? `${artifactType}s`;
}
function defaultRequiredHeadings(artifactType) {
    return CORE_REQUIRED_HEADINGS[artifactType] ?? ["## Summary", "## Details"];
}
function defaultUpstreamByArtifact(artifactType) {
    return CORE_UPSTREAM_BY_ARTIFACT[artifactType] ?? [];
}
function defaultRequiredContractsByArtifact(artifactType) {
    return CORE_REQUIRED_CONTRACTS_BY_ARTIFACT[artifactType] ?? ["core_features"];
}
