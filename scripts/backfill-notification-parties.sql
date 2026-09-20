-- Development databases updated with prisma db push need the same safe backfill
-- as the party-scoped-notifications migration.
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
