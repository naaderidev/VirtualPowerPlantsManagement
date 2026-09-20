CREATE TABLE `market_index_observations` (
  `id` VARCHAR(191) NOT NULL,
  `pricingPlanId` VARCHAR(191) NOT NULL,
  `period` VARCHAR(191) NOT NULL,
  `value` DECIMAL(24, 6) NOT NULL,
  `indexName` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `timezone` VARCHAR(191) NOT NULL,
  `observedAt` DATETIME(3) NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `market_index_observations_pricingPlanId_period_key`(`pricingPlanId`, `period`),
  INDEX `market_index_observations_indexName_period_idx`(`indexName`, `period`),
  PRIMARY KEY (`id`),
  CONSTRAINT `market_index_observations_pricingPlanId_fkey`
    FOREIGN KEY (`pricingPlanId`) REFERENCES `pricing_plans`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `financial_configurations` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `taxRate` DECIMAL(9, 6) NOT NULL,
  `deductionRate` DECIMAL(9, 6) NOT NULL DEFAULT 0,
  `validFrom` DATETIME(3) NOT NULL,
  `validTo` DATETIME(3) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `approvedBy` VARCHAR(191) NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `financial_configurations_active_validFrom_validTo_idx`(`active`, `validFrom`, `validTo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `settlements`
  ADD COLUMN `scheduleId` VARCHAR(191) NULL,
  ADD COLUMN `financialConfigurationId` VARCHAR(191) NULL,
  ADD COLUMN `supersedesId` VARCHAR(191) NULL,
  ADD COLUMN `calculationSnapshot` JSON NULL,
  ADD COLUMN `formula` TEXT NULL;

CREATE UNIQUE INDEX `settlements_contractId_assetId_periodStart_periodEnd_version_key`
  ON `settlements`(`contractId`, `assetId`, `periodStart`, `periodEnd`, `version`);
CREATE INDEX `settlements_supersedesId_idx` ON `settlements`(`supersedesId`);
CREATE INDEX `settlements_scheduleId_idx` ON `settlements`(`scheduleId`);

ALTER TABLE `settlements`
  ADD CONSTRAINT `settlements_scheduleId_fkey`
    FOREIGN KEY (`scheduleId`) REFERENCES `commercial_schedules`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `settlements_financialConfigurationId_fkey`
    FOREIGN KEY (`financialConfigurationId`) REFERENCES `financial_configurations`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `settlements_supersedesId_fkey`
    FOREIGN KEY (`supersedesId`) REFERENCES `settlements`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `settlement_readings` (
  `settlementId` VARCHAR(191) NOT NULL,
  `meterReadingId` VARCHAR(191) NOT NULL,
  `acceptedEnergySnapshot` DECIMAL(24, 6) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `settlement_readings_meterReadingId_idx`(`meterReadingId`),
  PRIMARY KEY (`settlementId`, `meterReadingId`),
  CONSTRAINT `settlement_readings_settlementId_fkey`
    FOREIGN KEY (`settlementId`) REFERENCES `settlements`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `settlement_readings_meterReadingId_fkey`
    FOREIGN KEY (`meterReadingId`) REFERENCES `meter_readings`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
