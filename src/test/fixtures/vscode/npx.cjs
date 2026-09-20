#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GNOSYS_TEST_INVOCATIONS, `${JSON.stringify(args)}\n`);
if (args.shift() !== "gnosys") throw new Error("Unexpected executable");
const child = spawnSync(process.execPath, [process.env.GNOSYS_TEST_CLI, ...args], { stdio: "inherit" });
process.exit(child.status ?? 1);
