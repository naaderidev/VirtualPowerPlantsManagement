import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import nextEnvironment from "@next/env";
import { parseMysqlUrl, mysqlEnvironment } from "./db-connection.mjs";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());
if (process.env.ALLOW_RESTORE !== "true") throw new Error("Set ALLOW_RESTORE=true to confirm the destructive restore into RESTORE_DATABASE_URL.");
const source = parseMysqlUrl(process.env.DATABASE_URL, "DATABASE_URL");
const target = parseMysqlUrl(process.env.RESTORE_DATABASE_URL, "RESTORE_DATABASE_URL");
if (source.host === target.host && source.database === target.database) throw new Error("Restore target must not be the source database.");
if (!process.argv[2]) throw new Error("Pass the backup .sql path as the first argument.");
const backupPath = resolve(process.argv[2]);
if (!existsSync(backupPath)) throw new Error(`Backup file does not exist: ${backupPath}`);
const mysql = process.env.MYSQL_PATH || "mysql";
const args = ["-h", target.host, "-P", target.port, "-u", target.user, target.database];
const restore = spawn(mysql, args, { env: mysqlEnvironment(target), stdio: ["pipe", "inherit", "inherit"] });
let failedToStart = false;
restore.on("spawn", () => createReadStream(backupPath).pipe(restore.stdin));
restore.on("error", (error) => {
  failedToStart = true;
  console.error(`Restore client could not start: ${error.message}`);
  process.exitCode = 1;
});
restore.on("close", (code) => {
  if (failedToStart) return;
  if (code !== 0) { process.exitCode = code || 1; return; }
  const verification = spawnSync(mysql, [...args, "--batch", "--skip-column-names", "-e", "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL; SELECT COUNT(*) FROM parties; SELECT COUNT(*) FROM audit_logs;"], { env: mysqlEnvironment(target), encoding: "utf8" });
  if (verification.status !== 0) { process.stderr.write(verification.stderr); process.exitCode = verification.status || 1; return; }
  console.log(`Restore verified in ${target.host}/${target.database}. Counts (migrations, parties, audit logs):\n${verification.stdout.trim()}`);
});
