export type ContractConfigurationPresentation = {
  pageWidthClassName: string;
  scheduleGridClassName: string;
  scheduleCardClassNames: string[];
  assetSummary: string;
  actionLabel: string;
};

export function getContractConfigurationPresentation(
  assetCount: number,
): ContractConfigurationPresentation {
  const normalizedCount = Math.max(0, Math.trunc(assetCount));
  const persianCount = normalizedCount.toLocaleString("fa-IR");

  if (normalizedCount === 1) {
    return {
      pageWidthClassName: "max-w-5xl",
      scheduleGridClassName: "grid gap-4",
      scheduleCardClassNames: [""],
      assetSummary: "یک نیروگاه و یک برنامه تجاری مستقل",
      actionLabel: "ذخیره برنامه و تکمیل پیکربندی",
    };
  }

  if (normalizedCount === 2) {
    return {
      pageWidthClassName: "max-w-7xl",
      scheduleGridClassName: "grid gap-4 xl:grid-cols-2",
      scheduleCardClassNames: ["", ""],
      assetSummary: "دو نیروگاه با برنامه‌های تجاری مستقل",
      actionLabel: "ذخیره ۲ برنامه و تکمیل پیکربندی",
    };
  }

  if (normalizedCount === 3) {
    return {
      pageWidthClassName: "max-w-7xl",
      scheduleGridClassName: "grid gap-4 lg:grid-cols-2 2xl:grid-cols-3",
      scheduleCardClassNames: ["", "", "lg:col-span-2 2xl:col-span-1"],
      assetSummary: "سه نیروگاه با برنامه‌های تجاری مستقل",
      actionLabel: "ذخیره ۳ برنامه و تکمیل پیکربندی",
    };
  }

  return {
    pageWidthClassName: "max-w-7xl",
    scheduleGridClassName: "grid gap-4 xl:grid-cols-2",
    scheduleCardClassNames: Array.from({ length: normalizedCount }, () => ""),
    assetSummary: `${persianCount} نیروگاه با برنامه‌های تجاری مستقل`,
    actionLabel: `ذخیره ${persianCount} برنامه و تکمیل پیکربندی`,
  };
}
