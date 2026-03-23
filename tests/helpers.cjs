const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "prodo-test-"));
}

async function listFilesRecursive(rootDir) {
  const out = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(rootDir);
  return out;
}

module.exports = {
  fs,
  path,
  makeTempDir,
  listFilesRecursive
};

