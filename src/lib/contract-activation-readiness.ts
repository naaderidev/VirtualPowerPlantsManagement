import { evaluateContractActivationReadiness } from "@/domain/contracts/activation-readiness";
import { prisma } from "@/lib/prisma";

export async function getStoredContractActivationReadiness(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      assets: {
        select: {
          asset: {
            select: {
              id: true,
              name: true,
              status: true,
              operationalDate: true,
              connectionStatus: true,
              capacityNominal: true,
              capacitySellable: true,
              meters: { select: { type: true, active: true } },
              requests: {
                select: {
                  assetId: true,
                  hasExistingContract: true,
                  existingContractStart: true,
                  existingContractEnd: true,
                  existingContractCommittedCapacity: true,
                  existingContractExclusive: true,
                  existingContractRightToSellConfirmed: true,
                  documents: { select: { type: true, verified: true } },
                },
              },
            },
          },
        },
      },
      schedules: { select: { assetId: true, startDate: true, endDate: true } },
    },
  });
  if (!contract) return null;

  return evaluateContractActivationReadiness(contract.assets.map(({ asset }) => {
    const request = asset.requests.find(({ assetId }) => assetId === asset.id) ?? null;
    return {
      id: asset.id,
      name: asset.name,
      status: asset.status,
      operationalDate: asset.operationalDate,
      connectionStatus: asset.connectionStatus,
      capacityNominal: asset.capacityNominal,
      capacitySellable: asset.capacitySellable,
      hasActiveMainMeter: asset.meters.some(({ type, active }) => type === "MAIN" && active),
      verifiedDocumentTypes: request?.documents.filter(({ verified }) => verified).map(({ type }) => type) ?? [],
      existingContract: request ? {
        hasExistingContract: request.hasExistingContract,
        existingContractStart: request.existingContractStart,
        existingContractEnd: request.existingContractEnd,
        existingContractCommittedCapacity: request.existingContractCommittedCapacity,
        existingContractExclusive: request.existingContractExclusive,
        existingContractRightToSellConfirmed: request.existingContractRightToSellConfirmed,
      } : null,
      schedules: contract.schedules.filter(({ assetId }) => assetId === asset.id),
    };
  }));
}
