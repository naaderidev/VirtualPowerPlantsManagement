-- Phase 6: immutable generation forecasts and atomic payment allocations.

CREATE TABLE `generation_profile_versions` (
  `id` VARCHAR(191) NOT NULL,
  `assetId` VARCHAR(191) NOT NULL,
  `year` INTEGER NOT NULL,
  `method` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NULL,
  `jan` DOUBLE NOT NULL,
  `feb` DOUBLE NOT NULL,
  `mar` DOUBLE NOT NULL,
  `apr` DOUBLE NOT NULL,
  `may` DOUBLE NOT NULL,
  `jun` DOUBLE NOT NULL,
  `jul` DOUBLE NOT NULL,
  `aug` DOUBLE NOT NULL,
  `sep` DOUBLE NOT NULL,
  `oct` DOUBLE NOT NULL,
  `nov` DOUBLE NOT NULL,
  `dec` DOUBLE NOT NULL,
  `annualTotal` DOUBLE NOT NULL,
  `confidenceLevel` VARCHAR(191) NULL,
  `version` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'REVIEW', 'APPROVED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
  `createdBy` VARCHAR(191) NOT NULL,
  `submittedAt` DATETIME(3) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `generation_profile_versions_assetId_year_version_key`(`assetId`, `year`, `version`),
  INDEX `generation_profile_versions_assetId_status_createdAt_idx`(`assetId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `generation_profile_versions_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `invoices`
  ADD COLUMN `amountDecimal` DECIMAL(24, 0) NULL,
  ADD COLUMN `paidAmount` DECIMAL(24, 0) NOT NULL DEFAULT 0,
  ADD COLUMN `allocationVersion` INTEGER NOT NULL DEFAULT 0;

UPDATE `invoices` SET `amountDecimal` = ROUND(`amount`, 0) WHERE `amountDecimal` IS NULL;

ALTER TABLE `payments`
  MODIFY `invoiceId` VARCHAR(191) NULL,
  ADD COLUMN `amountDecimal` DECIMAL(24, 0) NULL,
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `allocationVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `createdBy` VARCHAR(191) NULL,
  ADD COLUMN `confirmedBy` VARCHAR(191) NULL,
  ADD COLUMN `confirmedAt` DATETIME(3) NULL,
  ADD COLUMN `rejectionReason` VARCHAR(191) NULL;

UPDATE `payments`
SET `amountDecimal` = ROUND(`amount`, 0),
    `idempotencyKey` = CONCAT('legacy-', `id`),
    `createdBy` = 'legacy-migration',
    `status` = IF(`allocated` = 1, 'CONFIRMED', 'PENDING');

ALTER TABLE `payments`
  MODIFY `amountDecimal` DECIMAL(24, 0) NOT NULL,
  MODIFY `idempotencyKey` VARCHAR(191) NOT NULL,
  MODIFY `createdBy` VARCHAR(191) NOT NULL,
  ADD UNIQUE INDEX `payments_idempotencyKey_key`(`idempotencyKey`),
  ADD INDEX `payments_status_paymentDate_idx`(`status`, `paymentDate`);

CREATE TABLE `payment_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(24, 0) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `payment_allocations_idempotencyKey_key`(`idempotencyKey`),
  INDEX `payment_allocations_paymentId_idx`(`paymentId`),
  INDEX `payment_allocations_invoiceId_idx`(`invoiceId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
