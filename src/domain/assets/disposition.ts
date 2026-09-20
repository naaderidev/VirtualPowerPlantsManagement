export type AssetDependencyCounts = {
  requests: number;
  meters: number;
  documents: number;
  contracts: number;
  schedules: number;
  settlements: number;
  readings: number;
  generationProfiles: number;
};

export type AssetDependency = {
  key: keyof AssetDependencyCounts;
  label: string;
  count: number;
};

export type AssetDisposition = {
  mode: "DELETE" | "ARCHIVE";
  totalDependencies: number;
  dependencies: AssetDependency[];
};

const dependencyLabels: Record<keyof AssetDependencyCounts, string> = {
  requests: "درخواست",
  meters: "کنتور",
  documents: "مدرک دارایی",
  contracts: "قرارداد",
  schedules: "برنامه تجاری",
  settlements: "تسویه",
  readings: "قرائت کنتور",
  generationProfiles: "پروفایل تولید",
};

export function getAssetDisposition(counts: AssetDependencyCounts): AssetDisposition {
  const dependencies = (Object.entries(counts) as Array<[keyof AssetDependencyCounts, number]>)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, label: dependencyLabels[key], count }));
  const totalDependencies = dependencies.reduce((total, dependency) => total + dependency.count, 0);
  return {
    mode: totalDependencies === 0 ? "DELETE" : "ARCHIVE",
    totalDependencies,
    dependencies,
  };
}
