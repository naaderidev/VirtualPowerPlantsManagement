import type { ReadingStatus } from "@prisma/client";

export function canTransitionReading(from: ReadingStatus, to: ReadingStatus): boolean {
  if (from === to) return true;
  return (
    (from === "RAW" && ["VALIDATED", "REJECTED"].includes(to)) ||
    (from === "VALIDATED" && ["ACCEPTED", "REJECTED"].includes(to))
  );
}
