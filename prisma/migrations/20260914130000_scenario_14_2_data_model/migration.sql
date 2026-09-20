-- Phase 1 of scenario 14.2: representation authority and operational netting.
-- The migration is additive and preserves existing domain data.

-- AlterTable
ALTER TABLE `relationships`
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `authorityReference` VARCHAR(191) NULL,
    ADD COLUMN `notes` VARCHAR(500) NULL,
    ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `revokedAt` DATETIME(3) NULL,
    ADD COLUMN `revokedById` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- Backfill before making the audit timestamp required.
UPDATE `relationships`
SET `updatedAt` = `createdAt`
WHERE `updatedAt` IS NULL;

ALTER TABLE `relationships`
    MODIFY `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `netting_batches` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `status` ENUM('DRAFT', 'FINANCIAL_REVIEW', 'LEGAL_REVIEW', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalReceivable` DECIMAL(24, 0) NOT NULL DEFAULT 0,
    `totalPayable` DECIMAL(24, 0) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(24, 0) NOT NULL DEFAULT 0,
    `calculationSnapshot` JSON NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `postedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `netting_batches_batchNumber_key`(`batchNumber`),
    UNIQUE INDEX `netting_batches_idempotencyKey_key`(`idempotencyKey`),
    INDEX `netting_batches_groupId_status_periodStart_periodEnd_idx`(`groupId`, `status`, `periodStart`, `periodEnd`),
    INDEX `netting_batches_createdById_idx`(`createdById`),
    CONSTRAINT `netting_batches_period_chk` CHECK (`periodEnd` >= `periodStart`),
    CONSTRAINT `netting_batches_totals_chk` CHECK (`totalReceivable` >= 0 AND `totalPayable` >= 0),
    CONSTRAINT `netting_batches_net_amount_chk` CHECK (`netAmount` = `totalReceivable` - `totalPayable`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `netting_items` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `settlementId` VARCHAR(191) NOT NULL,
    `direction` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL,
    `amount` DECIMAL(24, 0) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `settlementSnapshot` JSON NOT NULL,
    `eligibilityLockKey` VARCHAR(191) NULL,
    `releasedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `netting_items_eligibilityLockKey_key`(`eligibilityLockKey`),
    INDEX `netting_items_settlementId_idx`(`settlementId`),
    UNIQUE INDEX `netting_items_batchId_settlementId_key`(`batchId`, `settlementId`),
    CONSTRAINT `netting_items_amount_chk` CHECK (`amount` >= 0),
    CONSTRAINT `netting_items_lock_chk` CHECK (
        (`eligibilityLockKey` IS NOT NULL AND `releasedAt` IS NULL)
        OR (`eligibilityLockKey` IS NULL AND `releasedAt` IS NOT NULL)
    ),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `netting_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `type` ENUM('FINANCIAL', 'LEGAL') NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `netting_approvals_reviewerId_idx`(`reviewerId`),
    UNIQUE INDEX `netting_approvals_batchId_type_key`(`batchId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `commercial_schedules_assetId_idx` ON `commercial_schedules`(`assetId`);

-- CreateIndex
CREATE INDEX `relationships_fromEntityId_type_active_validFrom_validTo_idx`
    ON `relationships`(`fromEntityId`, `type`, `active`, `validFrom`, `validTo`);

-- CreateIndex
CREATE INDEX `relationships_toEntityId_type_active_idx`
    ON `relationships`(`toEntityId`, `type`, `active`);

-- CreateIndex
CREATE INDEX `relationships_createdById_idx` ON `relationships`(`createdById`);

-- CreateIndex
CREATE INDEX `relationships_revokedById_idx` ON `relationships`(`revokedById`);

-- CreateIndex
CREATE UNIQUE INDEX `relationships_fromEntityId_toEntityId_type_validFrom_key`
    ON `relationships`(`fromEntityId`, `toEntityId`, `type`, `validFrom`);

-- AddCheckConstraint
ALTER TABLE `relationships`
    ADD CONSTRAINT `relationships_valid_period_chk` CHECK (`validTo` IS NULL OR `validTo` >= `validFrom`),
    ADD CONSTRAINT `relationships_revocation_chk` CHECK (
        (`active` = true AND `revokedAt` IS NULL)
        OR (`active` = false AND `revokedAt` IS NOT NULL)
    );

-- AddForeignKey
ALTER TABLE `relationships`
    ADD CONSTRAINT `relationships_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `relationships`
    ADD CONSTRAINT `relationships_revokedById_fkey`
    FOREIGN KEY (`revokedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commercial_schedules`
    ADD CONSTRAINT `commercial_schedules_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_batches`
    ADD CONSTRAINT `netting_batches_groupId_fkey`
    FOREIGN KEY (`groupId`) REFERENCES `netting_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_batches`
    ADD CONSTRAINT `netting_batches_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_items`
    ADD CONSTRAINT `netting_items_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `netting_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_items`
    ADD CONSTRAINT `netting_items_settlementId_fkey`
    FOREIGN KEY (`settlementId`) REFERENCES `settlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_approvals`
    ADD CONSTRAINT `netting_approvals_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `netting_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_approvals`
    ADD CONSTRAINT `netting_approvals_reviewerId_fkey`
    FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
