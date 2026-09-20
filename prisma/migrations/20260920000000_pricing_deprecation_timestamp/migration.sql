ALTER TABLE `pricing_plans`
  ADD COLUMN `deprecatedAt` DATETIME(3) NULL;

-- Preserve the historical deprecation boundary for plans already deprecated.
-- An audit event is preferred; updatedAt retains the previous behavior if none exists.
UPDATE `pricing_plans` AS plan
LEFT JOIN (
  SELECT `entityId`, MIN(`timestamp`) AS `deprecatedAt`
  FROM `audit_logs`
  WHERE `entityType` = 'PricingPlan'
    AND `action` = 'STATUS_CHANGE'
    AND JSON_UNQUOTE(JSON_EXTRACT(`changes`, '$.after.status')) = 'DEPRECATED'
  GROUP BY `entityId`
) AS history ON history.`entityId` = plan.`id`
SET plan.`deprecatedAt` = COALESCE(history.`deprecatedAt`, plan.`updatedAt`)
WHERE plan.`status` = 'DEPRECATED';
