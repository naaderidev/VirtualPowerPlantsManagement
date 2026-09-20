import nextEnvironment from "@next/env";
import { validateRuntimeEnvironment } from "./runtime-environment.mjs";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());
const result = validateRuntimeEnvironment();
console.log(`Runtime environment is valid for ${result.appEnvironment}/${result.releaseId}.`);
