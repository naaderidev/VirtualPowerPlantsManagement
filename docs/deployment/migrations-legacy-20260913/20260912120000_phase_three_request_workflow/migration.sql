ALTER TABLE `assets`
  ADD COLUMN `ownershipPercent` DOUBLE NOT NULL DEFAULT 100,
  ADD COLUMN `requesterRole` ENUM('OWNER', 'REPRESENTATIVE') NOT NULL DEFAULT 'OWNER',
  ADD COLUMN `connectionStatus` ENUM('CONNECTED', 'PENDING', 'NOT_CONNECTED') NULL;

ALTER TABLE `requests`
  ADD COLUMN `initiatorId` VARCHAR(191) NULL,
  ADD COLUMN `deferredUntil` DATETIME(3) NULL,
  ADD CONSTRAINT `requests_initiatorId_fkey`
    FOREIGN KEY (`initiatorId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `request_reviews`
  MODIFY COLUMN `action` ENUM(
    'START_REVIEW',
    'APPROVE',
    'REJECT',
    'NEED_INFO',
    'DEFER',
    'SUBMIT_INFORMATION',
    'START_OWNERSHIP_REVIEW',
    'START_PROPOSAL',
    'CANCEL',
    'ASSIGN',
    'ESCALATE',
    'NOTE'
  ) NOT NULL;

ALTER TABLE `audit_logs`
  ADD COLUMN `correlationId` VARCHAR(191) NULL;

CREATE INDEX `requests_initiatorId_idx` ON `requests`(`initiatorId`);
CREATE INDEX `audit_logs_correlationId_idx` ON `audit_logs`(`correlationId`);
