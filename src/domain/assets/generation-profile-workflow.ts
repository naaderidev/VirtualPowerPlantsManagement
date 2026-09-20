import type { GenerationProfileStatus, UserRole } from "@prisma/client";

export function canTransitionGenerationProfile(from: GenerationProfileStatus, to: GenerationProfileStatus, role: UserRole): boolean {
  if (from === "DRAFT" && to === "REVIEW") return true;
  if (from === "REVIEW" && to === "APPROVED") return ["ADMIN", "STAFF_TECHNICAL", "MANAGER"].includes(role);
  return false;
}
