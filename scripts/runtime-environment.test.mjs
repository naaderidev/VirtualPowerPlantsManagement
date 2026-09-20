import assert from "node:assert/strict";
import test from "node:test";
import { validateRuntimeEnvironment } from "./runtime-environment.mjs";

const valid = {
  APP_ENV: "production",
  RELEASE_ID: "release-2026.09.13",
  DATABASE_URL: "mysql://app:secret@db.internal:3306/vpp",
  NEXTAUTH_SECRET: "a-secure-runtime-secret-with-32-characters",
  NEXTAUTH_URL: "https://vpp.example.com",
  UPLOAD_DIR: "/var/lib/vpp/uploads",
};

test("accepts a complete production environment", () => {
  assert.deepEqual(validateRuntimeEnvironment(valid), {
    appEnvironment: "production",
    releaseId: "release-2026.09.13",
  });
});

test("rejects missing secrets and insecure production origins", () => {
  assert.throws(
    () => validateRuntimeEnvironment({ ...valid, NEXTAUTH_SECRET: "short", NEXTAUTH_URL: "http://vpp.example.com" }),
    /NEXTAUTH_SECRET[\s\S]*HTTPS/
  );
});

test("rejects public upload storage and non-MySQL databases", () => {
  assert.throws(
    () => validateRuntimeEnvironment({ ...valid, DATABASE_URL: "postgres://db/vpp", UPLOAD_DIR: "./public/uploads" }),
    /DATABASE_URL[\s\S]*UPLOAD_DIR/
  );
  assert.throws(() => validateRuntimeEnvironment({ ...valid, UPLOAD_DIR: "./public" }), /UPLOAD_DIR/);
});
