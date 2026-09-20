// VPP — Asset Domain Types

export type AssetType =
  | "SOLAR"
  | "WIND"
  | "GAS_TURBINE"
  | "STEAM_TURBINE"
  | "CHP"
  | "HYDRO"
  | "BIOGAS"
  | "OTHER";

export type AssetStatus =
  | "PLANNING"
  | "UNDER_CONSTRUCTION"
  | "ACTIVE"
  | "INACTIVE"
  | "DECOMMISSIONED";

export type MeterType = "MAIN" | "BACKUP" | "CHECK";

export type ReadInterval = "HOURLY" | "DAILY" | "MONTHLY";

export type DataSource = "SMART_METER" | "API" | "MANUAL" | "SCADA";

export type DocumentType =
  | "OWNERSHIP"
  | "REPRESENTATION"
  | "LICENSE"
  | "CONNECTION"
  | "METER"
  | "TECHNICAL"
  | "LEGAL"
  | "FINANCIAL"
  | "OTHER";

export interface Asset {
  id: string;
  ownerId: string;
  internalCode?: string | null;
  name: string;
  type: AssetType;
  status: AssetStatus;
  province: string;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gridCompany?: string | null;
  connectionPoint?: string | null;
  capacityNominal: number;
  capacitySellable: number;
  technology?: string | null;
  operationalDate?: Date | null;
  connectionDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meter {
  id: string;
  assetId: string;
  type: MeterType;
  serialNumber: string;
  manufacturer?: string | null;
  model?: string | null;
  readInterval: ReadInterval;
  dataSource: DataSource;
  installDate?: Date | null;
  active: boolean;
  createdAt: Date;
}

export interface GenerationProfile {
  id: string;
  assetId: string;
  year: number;
  method: string;
  source?: string | null;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  annualTotal: number;
  confidenceLevel?: string | null;
  version: number;
  approvedBy?: string | null;
  createdAt: Date;
}

export interface AssetDocument {
  id: string;
  assetId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  notes?: string | null;
  uploadedBy?: string | null;
  createdAt: Date;
}
