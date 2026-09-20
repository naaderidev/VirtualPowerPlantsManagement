ALTER TABLE `notifications`
  ADD COLUMN `partyId` VARCHAR(191) NULL;

CREATE INDEX `notifications_userId_partyId_isRead_createdAt_idx`
  ON `notifications`(`userId`, `partyId`, `isRead`, `createdAt`);

ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_partyId_fkey`
  FOREIGN KEY (`partyId`) REFERENCES `parties`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Only backfill notifications whose linked entity identifies the party unambiguously.
-- Other legacy customer notifications stay unscoped and are not exposed to a company.
UPDATE `notifications` AS n
JOIN `requests` AS r ON n.`link` = CONCAT('/customer/requests/', r.`id`)
  OR n.`link` LIKE CONCAT('/customer/requests/', r.`id`, '/%')
SET n.`partyId` = r.`partyId`
WHERE n.`partyId` IS NULL;

UPDATE `notifications` AS n
JOIN `assets` AS a ON n.`link` = CONCAT('/customer/assets/', a.`id`)
SET n.`partyId` = a.`ownerId`
WHERE n.`partyId` IS NULL;

UPDATE `notifications` AS n
JOIN `contract_parties` AS cp ON n.`link` = CONCAT('/customer/contracts/', cp.`contractId`)
SET n.`partyId` = cp.`partyId`
WHERE n.`partyId` IS NULL AND cp.`role` = 'SELLER';

UPDATE `notifications` AS n
JOIN `users` AS u ON u.`id` = n.`userId`
SET n.`partyId` = u.`partyId`
WHERE n.`partyId` IS NULL
  AND n.`link` = '/customer/dashboard'
  AND n.`title` IN (
    'نمایندگی شرکت ثبت شد',
    'دسترسی نمایندگی به‌روزرسانی شد',
    'نمایندگی شرکت لغو شد'
  );
