ALTER TABLE `assets`
  ADD COLUMN `archivedAt` DATETIME(3) NULL,
  ADD COLUMN `archivedById` VARCHAR(191) NULL,
  ADD COLUMN `archiveReason` VARCHAR(500) NULL;

CREATE INDEX `assets_archivedAt_idx` ON `assets`(`archivedAt`);
