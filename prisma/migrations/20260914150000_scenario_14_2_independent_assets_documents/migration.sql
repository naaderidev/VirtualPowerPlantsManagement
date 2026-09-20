-- Phase 4 of scenario 14.2: one independent asset and document set per request.
ALTER TABLE `requests`
  ADD UNIQUE INDEX `requests_assetId_key`(`assetId`),
  ADD INDEX `requests_partyId_createdAt_idx`(`partyId`, `createdAt`);

ALTER TABLE `request_documents`
  ADD COLUMN `uploadedById` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `request_documents_requestId_type_key`(`requestId`, `type`),
  ADD INDEX `request_documents_uploadedById_idx`(`uploadedById`),
  ADD CONSTRAINT `request_documents_uploadedById_fkey`
    FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
