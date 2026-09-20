export function isNettingEnabled(): boolean {
  return process.env.NETTING_ENABLED === "true";
}
