import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import nextEnvironment from "@next/env";
import { parseMysqlUrl, mysqlEnvironment } from "./db-connection.mjs";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());
const connection = parseMysqlUrl(process.env.DATABASE_URL, "DATABASE_URL");
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_BACKUP !== "true") {
  throw new Error("Set ALLOW_PRODUCTION_BACKUP=true explicitly for a production backup.");
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = resolve(process.argv[2] || `backups/vpp-${stamp}.sql`);
if (!basename(outputPath).endsWith(".sql")) throw new Error("Backup output must be a .sql file.");
mkdirSync(dirname(outputPath), { recursive: true });

const child = spawn(process.env.MYSQLDUMP_PATH || "mysqldump", [
  "--single-transaction", "--routines", "--triggers", "--events", "--set-gtid-purged=OFF",
  "-h", connection.host, "-P", connection.port, "-u", connection.user, connection.database,
], { env: mysqlEnvironment(connection), stdio: ["ignore", "pipe", "inherit"] });
let failedToStart = false;
let output;
child.on("spawn", () => {
  output = createWriteStream(outputPath, { flags: "wx" });
  output.on("error", (error) => {
    console.error(`Backup output could not be created: ${error.message}`);
    child.kill();
    process.exitCode = 1;
  });
  child.stdout.pipe(output);
});
child.on("error", (error) => {
  failedToStart = true;
  console.error(`Backup client could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on("close", (code) => {
  if (failedToStart) return;
  if (code !== 0) {
    output?.close();
    rmSync(outputPath, { force: true });
    process.exitCode = code || 1;
    return;
  }
  console.log(`Backup created: ${outputPath}`);
});
