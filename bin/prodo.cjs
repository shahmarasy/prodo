#!/usr/bin/env node
"use strict";
require("../dist/cli").runCli().then((code) => {
  process.exitCode = code;
});

