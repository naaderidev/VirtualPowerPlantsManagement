ALTER TABLE `requests`
  ADD COLUMN `existingContractStart` DATETIME(3) NULL,
  ADD COLUMN `existingContractCounterparty` VARCHAR(191) NULL,
  ADD COLUMN `existingContractCommittedCapacity` DOUBLE NULL,
  ADD COLUMN `existingContractExclusive` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `existingContractRestrictions` VARCHAR(1000) NULL,
  ADD COLUMN `existingContractRightToSellConfirmed` BOOLEAN NOT NULL DEFAULT false;
