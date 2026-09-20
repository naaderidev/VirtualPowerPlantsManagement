-- Preserve direct traceability from every settlement to the exact pricing-plan version.
ALTER TABLE `settlements`
  ADD CONSTRAINT `settlements_pricingPlanId_fkey`
  FOREIGN KEY (`pricingPlanId`) REFERENCES `pricing_plans`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
