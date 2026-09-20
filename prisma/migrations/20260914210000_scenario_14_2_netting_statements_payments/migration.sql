-- Phase 8 of scenario 14.2: one financial statement and payment allocation per approved netting batch.

CREATE TABLE `netting_statements` (
    `id` VARCHAR(191) NOT NULL,
    `statementNumber` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `direction` ENUM('RECEIVABLE', 'PAYABLE') NOT NULL,
    `amount` DECIMAL(24, 0) NOT NULL,
    `paidAmount` DECIMAL(24, 0) NOT NULL DEFAULT 0,
    `allocationVersion` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `status` ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ISSUED',
    `issueDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `snapshot` JSON NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `netting_statements_statementNumber_key`(`statementNumber`),
    UNIQUE INDEX `netting_statements_batchId_key`(`batchId`),
    UNIQUE INDEX `netting_statements_idempotencyKey_key`(`idempotencyKey`),
    INDEX `netting_statements_partyId_status_dueDate_idx`(`partyId`, `status`, `dueDate`),
    INDEX `netting_statements_createdById_idx`(`createdById`),
    CONSTRAINT `netting_statements_amount_chk` CHECK (`amount` >= 0),
    CONSTRAINT `netting_statements_paid_amount_chk` CHECK (`paidAmount` >= 0 AND `paidAmount` <= `amount`),
    CONSTRAINT `netting_statements_dates_chk` CHECK (`dueDate` >= `issueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `netting_payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `statementId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(24, 0) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `netting_payment_allocations_idempotencyKey_key`(`idempotencyKey`),
    INDEX `netting_payment_allocations_paymentId_idx`(`paymentId`),
    INDEX `netting_payment_allocations_statementId_idx`(`statementId`),
    CONSTRAINT `netting_payment_allocations_amount_chk` CHECK (`amount` > 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `netting_statements`
    ADD CONSTRAINT `netting_statements_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `netting_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `netting_statements_partyId_fkey`
    FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `netting_statements_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `netting_payment_allocations`
    ADD CONSTRAINT `netting_payment_allocations_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `netting_payment_allocations_statementId_fkey`
    FOREIGN KEY (`statementId`) REFERENCES `netting_statements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
