-- Phase 6 of scenario 14.2: support complete monthly reading coverage lookups per asset.
CREATE INDEX `meter_readings_assetId_status_periodStart_periodEnd_idx`
  ON `meter_readings`(`assetId`, `status`, `periodStart`, `periodEnd`);
