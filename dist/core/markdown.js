"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHeadingKey = normalizeHeadingKey;
exports.parseMarkdownSections = parseMarkdownSections;
exports.extractRequiredHeadings = extractRequiredHeadings;
exports.taggedLinesByContract = taggedLinesByContract;
exports.sectionTextMap = sectionTextMap;
function normalizeText(input) {
    return input.trim().replace(/\s+/g, " ");
}
function normalizeHeadingKey(heading) {
    return normalizeText(heading)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function parseMarkdownSections(markdown) {
    const sections = [];
    let current = null;
    for (const rawLine of markdown.split(/\r?\n/)) {
        const headingMatch = rawLine.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
        if (headingMatch) {
            const title = normalizeText(headingMatch[2]);
            current = {
                heading: title,
                headingKey: normalizeHeadingKey(title),
                level: headingMatch[1].length,
                textLines: [],
                listItems: []
            };
            sections.push(current);
            continue;
        }
        if (!current)
            continue;
        const listMatch = rawLine.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/);
        if (listMatch) {
            const item = normalizeText(listMatch[1]);
            if (item.length > 0 && !current.listItems.includes(item))
                current.listItems.push(item);
            if (item.length > 0)
                current.textLines.push(item);
            continue;
        }
        const text = normalizeText(rawLine);
        if (text.length > 0)
            current.textLines.push(text);
    }
    return sections;
}
function extractRequiredHeadings(content) {
    const sections = parseMarkdownSections(content);
    return sections
        .filter((section) => section.level === 2)
        .map((section) => `## ${section.heading}`)
        .filter((heading) => heading.length > 3);
}
function taggedLinesByContract(body) {
    const lines = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const tagged = [];
    for (const line of lines) {
        const matches = line.match(/\[([GFC][0-9]+)\]/g) ?? [];
        for (const match of matches) {
            tagged.push({ contractId: match.slice(1, -1), line });
        }
    }
    return tagged;
}
function sectionTextMap(content) {
    const sections = parseMarkdownSections(content);
    const mapped = new Map();
    for (const section of sections) {
        const parts = [...section.listItems, ...section.textLines].filter((item) => item.length > 0);
        mapped.set(`## ${section.heading}`, parts.join("\n").trim());
    }
    return mapped;
}
