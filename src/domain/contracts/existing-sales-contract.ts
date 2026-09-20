export type ExistingSalesContractInput = {
  hasExistingContract: boolean;
  existingContractStart: Date | null;
  existingContractEnd: Date | null;
  existingContractCommittedCapacity: number | null;
  existingContractExclusive: boolean;
  existingContractRightToSellConfirmed: boolean;
};

export type ExistingContractAssetInput = ExistingSalesContractInput & {
  assetId: string;
  assetName: string;
  capacityNominal: number;
  capacitySellable: number;
  schedules: ReadonlyArray<{ startDate: Date; endDate: Date }>;
};

function periodsOverlap(
  left: { startDate: Date; endDate: Date },
  right: { startDate: Date; endDate: Date },
): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate;
}

export function getExistingContractConflicts(input: ExistingContractAssetInput): string[] {
  if (!input.hasExistingContract) return [];
  if (!input.existingContractStart || !input.existingContractEnd) {
    return [`بازه قرارداد فروش موجود نیروگاه «${input.assetName}» کامل نیست.`];
  }

  const existingPeriod = {
    startDate: input.existingContractStart,
    endDate: input.existingContractEnd,
  };
  const hasOverlap = input.schedules.some((schedule) => periodsOverlap(schedule, existingPeriod));
  if (!hasOverlap) return [];

  const conflicts: string[] = [];
  if (!input.existingContractRightToSellConfirmed) {
    conflicts.push(`تعهد حق فروش ظرفیت آزاد نیروگاه «${input.assetName}» ثبت نشده است.`);
  }
  if (input.existingContractExclusive) {
    conflicts.push(`قرارداد فروش موجود نیروگاه «${input.assetName}» انحصاری است و با برنامه تجاری جدید هم‌پوشانی دارد.`);
  }
  if (input.existingContractCommittedCapacity == null) {
    conflicts.push(`ظرفیت متعهدشده قرارداد موجود نیروگاه «${input.assetName}» ثبت نشده است.`);
  } else if (input.existingContractCommittedCapacity + input.capacitySellable > input.capacityNominal) {
    conflicts.push(`مجموع ظرفیت متعهدشده و ظرفیت قابل فروش نیروگاه «${input.assetName}» از ظرفیت نامی بیشتر است.`);
  }
  return conflicts;
}
