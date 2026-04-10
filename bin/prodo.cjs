#!/usr/bin/env node
"use strict";
require("../dist/cli/index").runCli().then((code) => {
  process.exitCode = code;
});

