#!/usr/bin/env node
/** Thin wrapper so `npm run archify -- doctor` hits the global Archify skill. */
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

const bin = path.join(homedir(), ".agents", "skills", "archify", "bin", "archify.mjs");
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);
