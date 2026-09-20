ALTER TABLE `parties`
  ADD COLUMN `systemCode` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `parties_systemCode_key` ON `parties`(`systemCode`);

INSERT INTO `parties` (
  `id`, `systemCode`, `type`, `displayName`, `status`, `createdAt`, `updatedAt`
) VALUES (
  'system-bartoo-buyer', 'BARTOO_BUYER', 'COMPANY', 'شرکت برقتو', 'ACTIVE', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `systemCode` = VALUES(`systemCode`),
  `displayName` = VALUES(`displayName`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

ALTER TABLE `contracts`
  ADD COLUMN `signedAt` DATETIME(3) NULL,
  ADD COLUMN `activatedAt` DATETIME(3) NULL;

ALTER TABLE `commercial_schedules`
  ADD COLUMN `settlementCycle` ENUM('MONTHLY', 'QUARTERLY') NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN `paymentDueDays` INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN `nettingEnabled` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `contract_signatures` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `partyId` VARCHAR(191) NOT NULL,
  `signedById` VARCHAR(191) NOT NULL,
  `evidenceReference` VARCHAR(191) NOT NULL,
  `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `contract_signatures_contractId_partyId_key`(`contractId`, `partyId`),
  INDEX `contract_signatures_partyId_idx`(`partyId`),
  INDEX `contract_signatures_signedById_idx`(`signedById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `contract_signatures_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `contract_signatures_partyId_fkey`
    FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `contract_signatures_signedById_fkey`
    FOREIGN KEY (`signedById`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contract_versions` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `contract_versions_contractId_version_key`(`contractId`, `version`),
  PRIMARY KEY (`id`),
  CONSTRAINT `contract_versions_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
