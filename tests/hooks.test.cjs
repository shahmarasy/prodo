const test = require("node:test");
const assert = require("node:assert/strict");
const { runCli } = require("../dist/cli/index");
const { fs, path, makeTempDir } = require("./helpers.cjs");

test("mandatory hooks execute automatically", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, ".prodo", "hooks.yml"),
    `hooks:
  before_normalize:
    - command: "node -e \\"require('fs').writeFileSync('hook-before.txt','ok')\\""
      optional: false
      enabled: true
  after_normalize: []
`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  await fs.stat(path.join(cwd, "hook-before.txt"));
  assert.match(logs.join("\n"), /Hook:mandatory:before_normalize/);
});

test("optional hooks are suggested but not executed", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, ".prodo", "hooks.yml"),
    `hooks:
  before_normalize:
    - command: "node -e \\"require('fs').writeFileSync('hook-optional.txt','ok')\\""
      optional: true
      enabled: true
  after_normalize: []
`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  await assert.rejects(fs.stat(path.join(cwd, "hook-optional.txt")));
  assert.match(logs.join("\n"), /Hook:optional:before_normalize/);
});

test("mandatory hook retries before failing", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, ".prodo", "hooks.yml"),
    `hooks:
  before_normalize:
    - command: "node -e \\"process.exit(1)\\""
      optional: false
      enabled: true
      retry: 1
      retry_delay_ms: 10
  after_normalize: []
`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /attempt 2\/2/);
});

test("hook condition false skips execution", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, ".prodo", "hooks.yml"),
    `hooks:
  before_normalize:
    - command: "node -e \\"require('fs').writeFileSync('condition-should-not-run.txt','x')\\""
      optional: false
      enabled: true
      condition: "node -e \\"process.exit(1)\\""
  after_normalize: []
`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 0);
  await assert.rejects(fs.stat(path.join(cwd, "condition-should-not-run.txt")));
  assert.match(logs.join("\n"), /Hook:skipped:before_normalize/);
});

test("execution fails if brief.md is modified during command run", async (t) => {
  const cwd = await makeTempDir();
  t.after(async () => fs.rm(cwd, { recursive: true, force: true }));
  await runCli({ cwd, argv: ["node", "prodo", "init"], log: () => {}, error: () => {} });

  await fs.writeFile(
    path.join(cwd, ".prodo", "hooks.yml"),
    `hooks:
  before_normalize:
    - command: "node -e \\"require('fs').appendFileSync('brief.md','\\\\n# mutated')\\""
      optional: false
      enabled: true
  after_normalize: []
`,
    "utf8"
  );

  const logs = [];
  const code = await runCli({ cwd, argv: ["node", "prodo", "normalize"], log: (m) => logs.push(m), error: (m) => logs.push(m) });
  assert.equal(code, 1);
  assert.match(logs.join("\n"), /brief\.md.*modified.*read-only/i);
});
