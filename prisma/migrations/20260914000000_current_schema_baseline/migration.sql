-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    UNIQUE INDEX `accounts_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `verification_tokens_token_key`(`token`),
    UNIQUE INDEX `verification_tokens_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parties` (
    `id` VARCHAR(191) NOT NULL,
    `systemCode` VARCHAR(191) NULL,
    `type` ENUM('PERSON', 'COMPANY') NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `economicCode` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `registrationNo` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `parties_systemCode_key`(`systemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'STAFF_SUPPLY', 'STAFF_TECHNICAL', 'STAFF_LEGAL', 'STAFF_FINANCIAL', 'MANAGER', 'CUSTOMER', 'CUSTOMER_REPRESENTATIVE') NOT NULL DEFAULT 'CUSTOMER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLogin` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_mobile_key`(`mobile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_relations` (
    `id` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `type` ENUM('SELLER', 'BUYER', 'INSTALLER', 'CONTRACTOR', 'CONSULTANT', 'MAINTAINER') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `relationships` (
    `id` VARCHAR(191) NOT NULL,
    `fromEntityId` VARCHAR(191) NOT NULL,
    `toEntityId` VARCHAR(191) NOT NULL,
    `type` ENUM('REPRESENTATIVE', 'EMPLOYEE', 'PARTNER', 'AUTHORIZED_SIGNATORY') NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `internalCode` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('SOLAR', 'WIND', 'GAS_TURBINE', 'STEAM_TURBINE', 'CHP', 'HYDRO', 'BIOGAS', 'OTHER') NOT NULL,
    `status` ENUM('PLANNING', 'UNDER_CONSTRUCTION', 'ACTIVE', 'INACTIVE', 'DECOMMISSIONED') NOT NULL DEFAULT 'PLANNING',
    `province` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `gridCompany` VARCHAR(191) NULL,
    `connectionPoint` VARCHAR(191) NULL,
    `capacityNominal` DOUBLE NOT NULL,
    `capacitySellable` DOUBLE NOT NULL,
    `ownershipPercent` DOUBLE NOT NULL DEFAULT 100,
    `requesterRole` ENUM('OWNER', 'REPRESENTATIVE') NOT NULL DEFAULT 'OWNER',
    `connectionStatus` ENUM('CONNECTED', 'PENDING', 'NOT_CONNECTED') NULL,
    `technology` VARCHAR(191) NULL,
    `operationalDate` DATETIME(3) NULL,
    `connectionDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_internalCode_key`(`internalCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meters` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `type` ENUM('MAIN', 'BACKUP', 'CHECK') NOT NULL DEFAULT 'MAIN',
    `serialNumber` VARCHAR(191) NOT NULL,
    `manufacturer` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `readInterval` ENUM('HOURLY', 'DAILY', 'MONTHLY') NOT NULL DEFAULT 'DAILY',
    `dataSource` ENUM('SMART_METER', 'API', 'MANUAL', 'SCADA') NOT NULL DEFAULT 'SMART_METER',
    `installDate` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_profiles` (
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
    `version` INTEGER NOT NULL DEFAULT 1,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `generation_profiles_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

    INDEX `generation_profile_versions_assetId_status_createdAt_idx`(`assetId`, `status`, `createdAt`),
    UNIQUE INDEX `generation_profile_versions_assetId_year_version_key`(`assetId`, `year`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_documents` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `type` ENUM('OWNERSHIP', 'REPRESENTATION', 'LICENSE', 'CONNECTION', 'METER', 'TECHNICAL', 'LEGAL', 'FINANCIAL', 'OTHER') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requests` (
    `id` VARCHAR(191) NOT NULL,
    `caseNumber` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `initiatorId` VARCHAR(191) NULL,
    `assetId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'INITIAL_REVIEW', 'NEEDS_INFORMATION', 'INFORMATION_SUBMITTED', 'APPROVED', 'OWNERSHIP_REVIEW', 'PROPOSAL_PENDING', 'PROPOSAL_READY', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DEFERRED') NOT NULL DEFAULT 'DRAFT',
    `plantType` ENUM('SOLAR', 'WIND', 'GAS_TURBINE', 'STEAM_TURBINE', 'CHP', 'HYDRO', 'BIOGAS', 'OTHER') NOT NULL,
    `capacity` DOUBLE NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `operationalStatus` ENUM('ACTIVE', 'UNDER_CONSTRUCTION', 'PLANNING', 'TEMPORARILY_STOPPED') NOT NULL,
    `avgMonthlyGeneration` DOUBLE NULL,
    `hasExistingContract` BOOLEAN NOT NULL DEFAULT false,
    `existingContractEnd` DATETIME(3) NULL,
    `contactMobile` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `deferredUntil` DATETIME(3) NULL,
    `contractId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `requests_caseNumber_key`(`caseNumber`),
    INDEX `requests_initiatorId_idx`(`initiatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `action` ENUM('START_REVIEW', 'APPROVE', 'REJECT', 'NEED_INFO', 'DEFER', 'SUBMIT_INFORMATION', 'START_OWNERSHIP_REVIEW', 'START_PROPOSAL', 'CANCEL', 'ASSIGN', 'ESCALATE', 'NOTE') NOT NULL,
    `fromStatus` ENUM('DRAFT', 'SUBMITTED', 'INITIAL_REVIEW', 'NEEDS_INFORMATION', 'INFORMATION_SUBMITTED', 'APPROVED', 'OWNERSHIP_REVIEW', 'PROPOSAL_PENDING', 'PROPOSAL_READY', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DEFERRED') NOT NULL,
    `toStatus` ENUM('DRAFT', 'SUBMITTED', 'INITIAL_REVIEW', 'NEEDS_INFORMATION', 'INFORMATION_SUBMITTED', 'APPROVED', 'OWNERSHIP_REVIEW', 'PROPOSAL_PENDING', 'PROPOSAL_READY', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'ACTIVE', 'SETTLEMENT_PENDING', 'SETTLED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'DEFERRED') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_documents` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `type` ENUM('OWNERSHIP', 'REPRESENTATION', 'LICENSE', 'CONNECTION', 'METER', 'TECHNICAL', 'LEGAL', 'FINANCIAL', 'OTHER') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposals` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `pricePerKwh` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `minVolume` DOUBLE NULL,
    `maxVolume` DOUBLE NULL,
    `duration` INTEGER NOT NULL,
    `notes` VARCHAR(191) NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `customerNote` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contracts` (
    `id` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('PPA') NOT NULL DEFAULT 'PPA',
    `status` ENUM('DRAFT', 'CONFIGURED', 'INTERNAL_REVIEW', 'NEEDS_CHANGES', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'AMENDMENT_PENDING', 'TERMINATION_PENDING', 'TERMINATED', 'EXPIRED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `effectiveDate` DATETIME(3) NOT NULL,
    `expirationDate` DATETIME(3) NULL,
    `terminationDate` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `volumeType` ENUM('AS_PRODUCED', 'FIXED', 'MIN_MAX') NULL,
    `settlementCycle` ENUM('MONTHLY', 'QUARTERLY') NULL,
    `paymentDueDays` INTEGER NULL,
    `nettingEnabled` BOOLEAN NOT NULL DEFAULT false,
    `nettingGroupId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contracts_contractNumber_key`(`contractNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_parties` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `role` ENUM('BUYER', 'SELLER', 'SIGNATORY', 'GUARANTOR') NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_signatures` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `signedById` VARCHAR(191) NOT NULL,
    `evidenceReference` VARCHAR(191) NOT NULL,
    `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contract_signatures_partyId_idx`(`partyId`),
    INDEX `contract_signatures_signedById_idx`(`signedById`),
    UNIQUE INDEX `contract_signatures_contractId_partyId_key`(`contractId`, `partyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_versions` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contract_versions_contractId_version_key`(`contractId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_assets` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `sharePercent` DOUBLE NULL,
    `volumeMWh` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `contract_assets_contractId_assetId_key`(`contractId`, `assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'CONFIGURED', 'INTERNAL_REVIEW', 'NEEDS_CHANGES', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'AMENDMENT_PENDING', 'TERMINATION_PENDING', 'TERMINATED', 'EXPIRED', 'REJECTED', 'CANCELLED') NULL,
    `toStatus` ENUM('DRAFT', 'CONFIGURED', 'INTERNAL_REVIEW', 'NEEDS_CHANGES', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'AMENDMENT_PENDING', 'TERMINATION_PENDING', 'TERMINATED', 'EXPIRED', 'REJECTED', 'CANCELLED') NULL,
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commercial_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `volumeType` ENUM('AS_PRODUCED', 'FIXED', 'MIN_MAX') NOT NULL DEFAULT 'AS_PRODUCED',
    `minVolume` DOUBLE NULL,
    `maxVolume` DOUBLE NULL,
    `pricingPlanId` VARCHAR(191) NOT NULL,
    `settlementCycle` ENUM('MONTHLY', 'QUARTERLY') NOT NULL DEFAULT 'MONTHLY',
    `paymentDueDays` INTEGER NOT NULL DEFAULT 30,
    `nettingEnabled` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `amendments` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `changes` JSON NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metering_annexes` (
    `id` VARCHAR(191) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `primarySource` VARCHAR(191) NOT NULL,
    `backupSource` VARCHAR(191) NULL,
    `missingDataPolicy` VARCHAR(191) NOT NULL,
    `validationRules` JSON NULL,
    `correctionDeadline` INTEGER NULL,
    `disputeDeadline` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `metering_annexes_contractId_key`(`contractId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricing_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'DEPRECATED') NOT NULL DEFAULT 'DRAFT',
    `model` ENUM('FIXED', 'MARKET_INDEX', 'HYBRID', 'FLOOR') NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `energyUnit` VARCHAR(191) NOT NULL DEFAULT 'kWh',
    `roundingMethod` VARCHAR(191) NOT NULL DEFAULT 'ROUND_HALF_UP',
    `roundingDigits` INTEGER NOT NULL DEFAULT 2,
    `fixedRate` DOUBLE NULL,
    `escalationMethod` VARCHAR(191) NULL,
    `marketName` VARCHAR(191) NULL,
    `indexName` VARCHAR(191) NULL,
    `indexSource` VARCHAR(191) NULL,
    `indexTimeframe` VARCHAR(191) NULL,
    `averagingMethod` VARCHAR(191) NULL,
    `multiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `differential` DOUBLE NOT NULL DEFAULT 0,
    `missingIndexPolicy` VARCHAR(191) NULL,
    `fixedSharePct` DOUBLE NULL,
    `fixedRateHybrid` DOUBLE NULL,
    `marketSharePct` DOUBLE NULL,
    `baseFormula` VARCHAR(191) NULL,
    `basePricingId` VARCHAR(191) NULL,
    `floorValue` DOUBLE NULL,
    `ceilingValue` DOUBLE NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `versionNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pricing_plans_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

    INDEX `market_index_observations_indexName_period_idx`(`indexName`, `period`),
    UNIQUE INDEX `market_index_observations_pricingPlanId_period_key`(`pricingPlanId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
CREATE TABLE `meter_readings` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `meterId` VARCHAR(191) NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `rawEnergy` DOUBLE NOT NULL,
    `rawPeak` DOUBLE NULL,
    `rawOffPeak` DOUBLE NULL,
    `acceptedEnergy` DOUBLE NULL,
    `rejectedEnergy` DOUBLE NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'METER',
    `qualityFlag` VARCHAR(191) NULL,
    `status` ENUM('RAW', 'VALIDATED', 'ACCEPTED', 'REJECTED', 'ADJUSTED') NOT NULL DEFAULT 'RAW',
    `submittedBy` VARCHAR(191) NULL,
    `validatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meter_readings_assetId_periodStart_key`(`assetId`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(191) NOT NULL,
    `settlementNumber` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `contractId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `meterReadingId` VARCHAR(191) NULL,
    `scheduleId` VARCHAR(191) NULL,
    `financialConfigurationId` VARCHAR(191) NULL,
    `supersedesId` VARCHAR(191) NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `energyRegistered` DOUBLE NOT NULL,
    `energyAccepted` DOUBLE NOT NULL,
    `energyRejected` DOUBLE NULL,
    `energyRejectionReason` VARCHAR(191) NULL,
    `pricingPlanId` VARCHAR(191) NOT NULL,
    `pricingVersion` VARCHAR(191) NOT NULL,
    `calculationSnapshot` JSON NULL,
    `formula` TEXT NULL,
    `unitPrice` DOUBLE NOT NULL,
    `baseAmount` DOUBLE NOT NULL,
    `adjustments` JSON NULL,
    `adjustmentTotal` DOUBLE NOT NULL DEFAULT 0,
    `grossAmount` DOUBLE NOT NULL,
    `deductions` DOUBLE NOT NULL DEFAULT 0,
    `taxAmount` DOUBLE NOT NULL DEFAULT 0,
    `netAmount` DOUBLE NOT NULL,
    `status` ENUM('CALCULATED', 'DRAFT', 'UNDER_REVIEW', 'CONFIRMED', 'DISPUTED', 'ADJUSTED', 'INVOICED', 'PAID') NOT NULL DEFAULT 'CALCULATED',
    `calculatedBy` VARCHAR(191) NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `disputeDeadline` DATETIME(3) NULL,
    `disputeReason` VARCHAR(191) NULL,
    `disputeResolvedBy` VARCHAR(191) NULL,
    `disputeResolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settlements_settlementNumber_key`(`settlementNumber`),
    INDEX `settlements_supersedesId_idx`(`supersedesId`),
    INDEX `settlements_scheduleId_idx`(`scheduleId`),
    UNIQUE INDEX `settlements_contractId_assetId_periodStart_periodEnd_version_key`(`contractId`, `assetId`, `periodStart`, `periodEnd`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlement_readings` (
    `settlementId` VARCHAR(191) NOT NULL,
    `meterReadingId` VARCHAR(191) NOT NULL,
    `acceptedEnergySnapshot` DECIMAL(24, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `settlement_readings_meterReadingId_idx`(`meterReadingId`),
    PRIMARY KEY (`settlementId`, `meterReadingId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `settlementId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `amountDecimal` DECIMAL(24, 0) NULL,
    `paidAmount` DECIMAL(24, 0) NOT NULL DEFAULT 0,
    `allocationVersion` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `issueDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoices_settlementId_key`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `paymentNumber` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `amountDecimal` DECIMAL(24, 0) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `paymentDate` DATETIME(3) NOT NULL,
    `method` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `allocationVersion` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NOT NULL,
    `confirmedBy` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `allocated` BOOLEAN NOT NULL DEFAULT false,
    `allocatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payments_paymentNumber_key`(`paymentNumber`),
    UNIQUE INDEX `payments_idempotencyKey_key`(`idempotencyKey`),
    INDEX `payments_status_paymentDate_idx`(`status`, `paymentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `netting_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `partyId` VARCHAR(191) NOT NULL,
    `mode` ENUM('OFF', 'AUTO', 'MANUAL') NOT NULL DEFAULT 'OFF',
    `type` ENUM('FINANCIAL', 'ENERGY') NOT NULL DEFAULT 'FINANCIAL',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IRR',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,
    `legalBasis` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `netting_groups_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `changes` JSON NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `correlationId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    INDEX `audit_logs_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` ENUM('INVOICE', 'PAYMENT', 'METERING', 'REQUEST', 'CONTRACT', 'SETTLEMENT', 'ALERT') NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `link` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_isRead_idx`(`isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_relations` ADD CONSTRAINT `business_relations_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `relationships` ADD CONSTRAINT `relationships_fromEntityId_fkey` FOREIGN KEY (`fromEntityId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `relationships` ADD CONSTRAINT `relationships_toEntityId_fkey` FOREIGN KEY (`toEntityId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meters` ADD CONSTRAINT `meters_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_profiles` ADD CONSTRAINT `generation_profiles_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_profile_versions` ADD CONSTRAINT `generation_profile_versions_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_documents` ADD CONSTRAINT `asset_documents_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_reviews` ADD CONSTRAINT `request_reviews_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_reviews` ADD CONSTRAINT `request_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_documents` ADD CONSTRAINT `request_documents_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_reviews` ADD CONSTRAINT `proposal_reviews_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `proposals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_reviews` ADD CONSTRAINT `proposal_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_nettingGroupId_fkey` FOREIGN KEY (`nettingGroupId`) REFERENCES `netting_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_parties` ADD CONSTRAINT `contract_parties_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_parties` ADD CONSTRAINT `contract_parties_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_signatures` ADD CONSTRAINT `contract_signatures_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_signatures` ADD CONSTRAINT `contract_signatures_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_signatures` ADD CONSTRAINT `contract_signatures_signedById_fkey` FOREIGN KEY (`signedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_versions` ADD CONSTRAINT `contract_versions_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_assets` ADD CONSTRAINT `contract_assets_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_assets` ADD CONSTRAINT `contract_assets_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_reviews` ADD CONSTRAINT `contract_reviews_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contract_reviews` ADD CONSTRAINT `contract_reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commercial_schedules` ADD CONSTRAINT `commercial_schedules_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commercial_schedules` ADD CONSTRAINT `commercial_schedules_pricingPlanId_fkey` FOREIGN KEY (`pricingPlanId`) REFERENCES `pricing_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `amendments` ADD CONSTRAINT `amendments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metering_annexes` ADD CONSTRAINT `metering_annexes_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `market_index_observations` ADD CONSTRAINT `market_index_observations_pricingPlanId_fkey` FOREIGN KEY (`pricingPlanId`) REFERENCES `pricing_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meter_readings` ADD CONSTRAINT `meter_readings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meter_readings` ADD CONSTRAINT `meter_readings_meterId_fkey` FOREIGN KEY (`meterId`) REFERENCES `meters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contracts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_meterReadingId_fkey` FOREIGN KEY (`meterReadingId`) REFERENCES `meter_readings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `commercial_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_financialConfigurationId_fkey` FOREIGN KEY (`financialConfigurationId`) REFERENCES `financial_configurations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_supersedesId_fkey` FOREIGN KEY (`supersedesId`) REFERENCES `settlements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_pricingPlanId_fkey` FOREIGN KEY (`pricingPlanId`) REFERENCES `pricing_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_readings` ADD CONSTRAINT `settlement_readings_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `settlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_readings` ADD CONSTRAINT `settlement_readings_meterReadingId_fkey` FOREIGN KEY (`meterReadingId`) REFERENCES `meter_readings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `settlements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `netting_groups` ADD CONSTRAINT `netting_groups_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
