-- Phase 5 of scenario 14.2: exactly one commercial schedule per contract asset.
ALTER TABLE `commercial_schedules`
  ADD UNIQUE INDEX `commercial_schedules_contractId_assetId_key`(`contractId`, `assetId`);
