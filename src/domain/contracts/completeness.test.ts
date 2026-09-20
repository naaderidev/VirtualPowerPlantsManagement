import assert from "node:assert/strict";
import test from "node:test";
import { isContractConfigurationComplete } from "./completeness";

const valid = {
  parties: [
    { partyId: "buyer", role: "BUYER", isPrimary: true },
    { partyId: "seller", role: "SELLER", isPrimary: true },
  ],
  assets: [{ assetId: "asset-1" }],
  schedules: [{ assetId: "asset-1" }],
  meteringAnnex: { primarySource: "METER" },
};

test("requires distinct primary buyer and seller and all three contract layers", () => {
  assert.equal(isContractConfigurationComplete(valid), true);
  assert.equal(isContractConfigurationComplete({ ...valid, meteringAnnex: null }), false);
  assert.equal(isContractConfigurationComplete({ ...valid, schedules: [] }), false);
  assert.equal(isContractConfigurationComplete({
    ...valid,
    parties: valid.parties.map((party) => ({ ...party, partyId: "same" })),
  }), false);
});

test("requires exactly one commercial schedule for every contract asset", () => {
  const twoAssets = {
    ...valid,
    assets: [{ assetId: "asset-1" }, { assetId: "asset-2" }],
    schedules: [{ assetId: "asset-1" }, { assetId: "asset-2" }],
  };

  assert.equal(isContractConfigurationComplete(twoAssets), true);
  assert.equal(
    isContractConfigurationComplete({
      ...twoAssets,
      schedules: [...twoAssets.schedules, { assetId: "asset-2" }],
    }),
    false
  );
});
