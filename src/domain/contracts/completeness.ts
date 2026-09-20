type ContractConfiguration = {
  parties: Array<{ partyId: string; role: string; isPrimary: boolean }>;
  assets: Array<{ assetId: string }>;
  schedules: Array<{ assetId: string }>;
  meteringAnnex: unknown | null;
};

export function isContractConfigurationComplete(contract: ContractConfiguration): boolean {
  const primaryBuyers = contract.parties.filter(({ role, isPrimary }) => role === "BUYER" && isPrimary);
  const primarySellers = contract.parties.filter(({ role, isPrimary }) => role === "SELLER" && isPrimary);
  const assetIds = new Set(contract.assets.map(({ assetId }) => assetId));
  const scheduleCountByAsset = new Map<string, number>();
  for (const schedule of contract.schedules) {
    scheduleCountByAsset.set(
      schedule.assetId,
      (scheduleCountByAsset.get(schedule.assetId) ?? 0) + 1
    );
  }

  return (
    primaryBuyers.length === 1 &&
    primarySellers.length === 1 &&
    primaryBuyers[0].partyId !== primarySellers[0].partyId &&
    assetIds.size > 0 &&
    contract.schedules.length === assetIds.size &&
    [...assetIds].every((assetId) => scheduleCountByAsset.get(assetId) === 1) &&
    contract.meteringAnnex !== null
  );
}
