import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { relative, resolve } from "node:path";

const standaloneDirectory = resolve(".next/standalone");
if (!existsSync(standaloneDirectory)) {
  throw new Error("Standalone build output is missing. Run next build first.");
}

const copyDirectory = (source, destination, filter) => {
  if (!existsSync(source)) return;
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, filter });
};

const publicDirectory = resolve("public");
copyDirectory(publicDirectory, resolve(standaloneDirectory, "public"), (source) => {
  const relativePath = relative(publicDirectory, source);
  return relativePath !== "uploads" && !relativePath.startsWith(`uploads\\`) && !relativePath.startsWith("uploads/");
});

copyDirectory(resolve(".next/static"), resolve(standaloneDirectory, ".next/static"));

console.log("Standalone runtime assets prepared.");
