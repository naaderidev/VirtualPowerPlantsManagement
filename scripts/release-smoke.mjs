import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 5_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  requireCondition(["http:", "https:"].includes(url.protocol), "BASE_URL must use HTTP or HTTPS.");
  requireCondition(!url.username && !url.password, "BASE_URL must not contain credentials.");
  return url.origin;
}

async function fetchJson(fetchImpl, url, timeoutMs, options = {}) {
  const response = await fetchImpl(url, {
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    ...options,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  return { response, body };
}

async function executeCheck(name, check) {
  try {
    await check();
    return { name, status: "PASS" };
  } catch (error) {
    return {
      name,
      status: "FAIL",
      message: error instanceof Error ? error.message : "Unknown smoke-check failure.",
    };
  }
}

export async function runReleaseSmoke({
  baseUrl,
  expectedReleaseId,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const origin = normalizeBaseUrl(baseUrl);
  requireCondition(expectedReleaseId, "EXPECTED_RELEASE_ID is required.");

  const checks = await Promise.all([
    executeCheck("liveness", async () => {
      const { response, body } = await fetchJson(fetchImpl, `${origin}/api/health/live`, timeoutMs);
      requireCondition(response.status === 200, `Liveness returned HTTP ${response.status}.`);
      requireCondition(body?.status === "ok", "Liveness response is not healthy.");
      requireCondition(body?.release === expectedReleaseId, "Running release does not match EXPECTED_RELEASE_ID.");
      requireCondition(!response.headers.has("x-powered-by"), "Technology disclosure header is enabled.");
    }),
    executeCheck("readiness", async () => {
      const { response, body } = await fetchJson(fetchImpl, `${origin}/api/health/ready`, timeoutMs);
      requireCondition(response.status === 200, `Readiness returned HTTP ${response.status}.`);
      requireCondition(body?.status === "ready", "Application dependencies are not ready.");
    }),
    executeCheck("anonymous-api-boundary", async () => {
      const { response, body } = await fetchJson(fetchImpl, `${origin}/api/dashboard`, timeoutMs);
      requireCondition(response.status === 401, `Anonymous API request returned HTTP ${response.status}.`);
      requireCondition(body?.error?.code === "UNAUTHORIZED", "Anonymous API error contract is invalid.");
      requireCondition(Boolean(body?.error?.correlationId), "Anonymous API response has no correlation ID.");
    }),
    executeCheck("protected-page-redirect", async () => {
      const { response } = await fetchJson(fetchImpl, `${origin}/admin`, timeoutMs);
      requireCondition(REDIRECT_STATUSES.has(response.status), `Protected page returned HTTP ${response.status}.`);
      const location = response.headers.get("location");
      requireCondition(Boolean(location), "Protected page response has no redirect location.");
      requireCondition(new URL(location, origin).pathname === "/login", "Protected page did not redirect to login.");
    }),
    executeCheck("private-upload-boundary", async () => {
      const { response } = await fetchJson(fetchImpl, `${origin}/uploads/release-smoke-probe.txt`, timeoutMs);
      requireCondition(response.status === 404, `Public upload probe returned HTTP ${response.status}.`);
    }),
  ]);

  return {
    status: checks.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    release: expectedReleaseId,
    checks,
  };
}

async function main() {
  const result = await runReleaseSmoke({
    baseUrl: process.env.BASE_URL,
    expectedReleaseId: process.env.EXPECTED_RELEASE_ID,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Release smoke check failed unexpectedly.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
