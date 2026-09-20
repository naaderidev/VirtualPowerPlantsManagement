import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseSmoke } from "./release-smoke.mjs";

const releaseId = "release-2026.09.13";

function response(body, init) {
  return new Response(body === null ? null : JSON.stringify(body), {
    ...init,
    headers: body === null ? init?.headers : { "content-type": "application/json", ...init?.headers },
  });
}

function healthyFetch(input) {
  const url = new URL(input);
  if (url.pathname === "/api/health/live") return Promise.resolve(response({ status: "ok", release: releaseId }, { status: 200 }));
  if (url.pathname === "/api/health/ready") return Promise.resolve(response({ status: "ready" }, { status: 200 }));
  if (url.pathname === "/api/dashboard") {
    return Promise.resolve(response({ error: { code: "UNAUTHORIZED", correlationId: "smoke-1" } }, { status: 401 }));
  }
  if (url.pathname === "/admin") return Promise.resolve(response(null, { status: 307, headers: { location: "/login?callbackUrl=%2Fadmin" } }));
  return Promise.resolve(response(null, { status: 404 }));
}

test("passes only when runtime identity, dependencies, and public boundaries are healthy", async () => {
  const result = await runReleaseSmoke({
    baseUrl: "https://vpp.example.test",
    expectedReleaseId: releaseId,
    fetchImpl: healthyFetch,
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.checks.length, 5);
  assert.ok(result.checks.every(({ status }) => status === "PASS"));
});

test("fails the candidate when readiness or release identity is invalid", async () => {
  const failingFetch = async (input, options) => {
    const url = new URL(input);
    if (url.pathname === "/api/health/live") return response({ status: "ok", release: "older-release" }, { status: 200 });
    if (url.pathname === "/api/health/ready") return response({ status: "not_ready" }, { status: 503 });
    return healthyFetch(input, options);
  };

  const result = await runReleaseSmoke({
    baseUrl: "https://vpp.example.test",
    expectedReleaseId: releaseId,
    fetchImpl: failingFetch,
  });

  assert.equal(result.status, "FAIL");
  assert.deepEqual(
    result.checks.filter(({ status }) => status === "FAIL").map(({ name }) => name),
    ["liveness", "readiness"]
  );
});
