import { evaluateOperationalReadiness } from "@/domain/assets/operational-readiness";
import {
  getExistingContractConflicts,
  type ExistingSalesContractInput,
} from "./existing-sales-contract";

export type ContractActivationAsset = {
  id: string;
  name: string;
  status: string;
  operationalDate: Date | null;
  connectionStatus: string | null;
  capacityNominal: number;
  capacitySellable: number;
  hasActiveMainMeter: boolean;
  verifiedDocumentTypes: readonly string[];
  existingContract: ExistingSalesContractInput | null;
  schedules: ReadonlyArray<{ startDate: Date; endDate: Date }>;
};

export type ContractActivationReadiness = {
  ready: boolean;
  blockers: string[];
  awaitingOperation: boolean;
};

export function evaluateContractActivationReadiness(
  assets: readonly ContractActivationAsset[],
): ContractActivationReadiness {
  const blockers: string[] = [];
  let awaitingOperation = false;

  for (const asset of assets) {
    const operational = evaluateOperationalReadiness({
      status: asset.status,
      operationalDate: asset.operationalDate,
      connectionStatus: asset.connectionStatus,
      hasActiveMainMeter: asset.hasActiveMainMeter,
      verifiedDocumentTypes: asset.verifiedDocumentTypes,
    });
    if (!operational.ready) awaitingOperation = true;
    blockers.push(...operational.blockers.map((blocker) => `${asset.name}: ${blocker}`));

    if (asset.existingContract) {
      blockers.push(...getExistingContractConflicts({
        ...asset.existingContract,
        assetId: asset.id,
        assetName: asset.name,
        capacityNominal: asset.capacityNominal,
        capacitySellable: asset.capacitySellable,
        schedules: asset.schedules,
      }));
    }
  }

  return { ready: blockers.length === 0, blockers, awaitingOperation };
}
