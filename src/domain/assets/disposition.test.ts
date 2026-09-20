import assert from "node:assert/strict";
import test from "node:test";
import { getAssetDisposition, type AssetDependencyCounts } from "./disposition";

const noDependencies: AssetDependencyCounts = {
  requests: 0,
  meters: 0,
  documents: 0,
  contracts: 0,
  schedules: 0,
  settlements: 0,
  readings: 0,
  generationProfiles: 0,
};

test("allows physical deletion only when an asset has no dependencies", () => {
  assert.deepEqual(getAssetDisposition(noDependencies), {
    mode: "DELETE",
    totalDependencies: 0,
    dependencies: [],
  });
});

test("selects archival and explains every existing dependency", () => {
  const disposition = getAssetDisposition({ ...noDependencies, requests: 2, meters: 1 });
  assert.equal(disposition.mode, "ARCHIVE");
  assert.equal(disposition.totalDependencies, 3);
  assert.deepEqual(disposition.dependencies, [
    { key: "requests", label: "درخواست", count: 2 },
    { key: "meters", label: "کنتور", count: 1 },
  ]);
});
