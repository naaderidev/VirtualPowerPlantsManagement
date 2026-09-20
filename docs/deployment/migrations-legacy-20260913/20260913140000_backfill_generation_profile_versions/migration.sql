-- Preserve pre-phase-6 generation profiles as the first immutable version.
INSERT INTO `generation_profile_versions` (
  `id`, `assetId`, `year`, `method`, `source`, `jan`, `feb`, `mar`, `apr`, `may`, `jun`, `jul`,
  `aug`, `sep`, `oct`, `nov`, `dec`, `annualTotal`, `confidenceLevel`, `version`, `status`,
  `createdBy`, `submittedAt`, `approvedBy`, `approvedAt`, `createdAt`
)
SELECT
  CONCAT('legacy-gpv-', `id`), `assetId`, `year`, `method`, `source`, `jan`, `feb`, `mar`, `apr`, `may`, `jun`, `jul`,
  `aug`, `sep`, `oct`, `nov`, `dec`, `annualTotal`, `confidenceLevel`, `version`,
  IF(`approvedBy` IS NULL, 'DRAFT', 'APPROVED'), COALESCE(`approvedBy`, 'legacy-migration'),
  `createdAt`, `approvedBy`, IF(`approvedBy` IS NULL, NULL, `createdAt`), `createdAt`
FROM `generation_profiles` current_profile
WHERE NOT EXISTS (
  SELECT 1 FROM `generation_profile_versions` versioned
  WHERE versioned.`assetId` = current_profile.`assetId`
    AND versioned.`year` = current_profile.`year`
    AND versioned.`version` = current_profile.`version`
);
