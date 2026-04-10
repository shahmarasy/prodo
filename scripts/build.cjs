#!/usr/bin/env node
"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Step 1: TypeScript compilation
console.log("Building TypeScript...");
execSync("npx tsc -p tsconfig.json", { stdio: "inherit" });

// Step 2: Copy i18n JSON files to dist
console.log("Copying i18n files...");
const srcDir = path.join(__dirname, "..", "src", "i18n");
const distDir = path.join(__dirname, "..", "dist", "i18n");

for (const lang of ["en", "tr"]) {
  const src = path.join(srcDir, `${lang}.json`);
  const dest = path.join(distDir, `${lang}.json`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log("Build complete.");
