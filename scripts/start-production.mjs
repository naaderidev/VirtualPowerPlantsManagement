import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { validateRuntimeEnvironment } from "./runtime-environment.mjs";

validateRuntimeEnvironment();

const standalone = process.env.STANDALONE_RUNTIME === "true";
const entrypoint = resolve(process.env.SERVER_ENTRYPOINT || (standalone ? "server.js" : ".next/standalone/server.js"));
if (!existsSync(entrypoint)) throw new Error(`Production server entrypoint does not exist: ${entrypoint}`);
const child = spawn(process.execPath, [entrypoint], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
let shutdownRequested = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdownRequested = true;
    child.kill(signal);
  });
}
child.on("error", (error) => {
  console.error(`Production server failed to start: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (shutdownRequested ? 0 : signal ? 1 : 0);
});
