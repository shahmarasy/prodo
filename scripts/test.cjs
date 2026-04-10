#!/usr/bin/env node
"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Build first
execSync("node scripts/build.cjs", { stdio: "inherit" });

// Find test files
const testsDir = path.join(__dirname, "..", "tests");
const testFiles = fs.readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.cjs"))
  .map((f) => path.join("tests", f))
  .join(" ");

// Run tests
execSync(`node --test ${testFiles}`, { stdio: "inherit", cwd: path.join(__dirname, "..") });
