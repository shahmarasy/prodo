"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCycles = detectCycles;
exports.buildExecutionPlan = buildExecutionPlan;
exports.getExecutionOrder = getExecutionOrder;
const errors_1 = require("../core/errors");
function detectCycles(manifests) {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map();
    const cycles = [];
    for (const name of manifests.keys()) {
        color.set(name, WHITE);
    }
    function dfs(node, path) {
        color.set(node, GRAY);
        path.push(node);
        const manifest = manifests.get(node);
        if (manifest) {
            for (const dep of manifest.depends_on) {
                if (!manifests.has(dep))
                    continue;
                const c = color.get(dep) ?? WHITE;
                if (c === GRAY) {
                    const cycleStart = path.indexOf(dep);
                    cycles.push([...path.slice(cycleStart), dep]);
                }
                else if (c === WHITE) {
                    dfs(dep, path);
                }
            }
        }
        path.pop();
        color.set(node, BLACK);
    }
    for (const name of manifests.keys()) {
        if (color.get(name) === WHITE) {
            dfs(name, []);
        }
    }
    return cycles.length > 0 ? cycles : null;
}
function collectTransitiveDeps(target, manifests, collected) {
    if (collected.has(target))
        return;
    collected.add(target);
    const manifest = manifests.get(target);
    if (!manifest)
        return;
    for (const dep of manifest.depends_on) {
        if (manifests.has(dep)) {
            collectTransitiveDeps(dep, manifests, collected);
        }
    }
}
function buildExecutionPlan(manifests, targetSkills) {
    const needed = new Set();
    for (const target of targetSkills) {
        collectTransitiveDeps(target, manifests, needed);
    }
    const filteredManifests = new Map();
    for (const name of needed) {
        const m = manifests.get(name);
        if (m)
            filteredManifests.set(name, m);
    }
    const cycles = detectCycles(filteredManifests);
    if (cycles) {
        const cycleStr = cycles.map((c) => c.join(" → ")).join("; ");
        throw new errors_1.UserError(`Dependency cycle detected: ${cycleStr}`);
    }
    const inDegree = new Map();
    for (const name of filteredManifests.keys()) {
        inDegree.set(name, 0);
    }
    for (const [, manifest] of filteredManifests) {
        for (const dep of manifest.depends_on) {
            if (filteredManifests.has(dep)) {
                inDegree.set(manifest.name, (inDegree.get(manifest.name) ?? 0) + 1);
            }
        }
    }
    const tiers = [];
    const remaining = new Set(filteredManifests.keys());
    let tierNum = 0;
    while (remaining.size > 0) {
        const ready = [];
        for (const name of remaining) {
            if ((inDegree.get(name) ?? 0) === 0) {
                ready.push(name);
            }
        }
        if (ready.length === 0) {
            throw new errors_1.UserError(`Cannot resolve execution order for: ${Array.from(remaining).join(", ")}`);
        }
        ready.sort();
        tiers.push({ tier: tierNum, skills: ready });
        for (const name of ready) {
            remaining.delete(name);
            for (const [otherName, manifest] of filteredManifests) {
                if (manifest.depends_on.includes(name) && remaining.has(otherName)) {
                    inDegree.set(otherName, (inDegree.get(otherName) ?? 0) - 1);
                }
            }
        }
        tierNum += 1;
    }
    return tiers;
}
function getExecutionOrder(manifests, targetSkills) {
    const tiers = buildExecutionPlan(manifests, targetSkills);
    return tiers.flatMap((t) => t.skills);
}
