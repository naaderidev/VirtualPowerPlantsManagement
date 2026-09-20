import {
  AssetStatus,
  AssetType,
  AssetRequesterRole,
  ConnectionStatus,
  ContractRole,
  ContractStatus,
  ContractType,
  DataSource,
  DocumentType,
  InvoiceStatus,
  MeterType,
  OperationalStatus,
  PartyStatus,
  PartyType,
  PlantType,
  PricingModel,
  PricingStatus,
  ProposalStatus,
  ReadingStatus,
  ReadInterval,
  RequestStatus,
  ReviewAction,
  SettlementCycle,
  SettlementStatus,
  VolumeType,
} from "@prisma/client";
import { z } from "zod";
import { isExactUtcCalendarMonth } from "@/domain/settlement/calendar-month";
import { parseApiDate } from "@/lib/persian-date";

const requiredText = (label: string, max = 191) =>
  z.string().trim().min(1, `${label} الزامی است.`).max(max, `${label} بیش از حد طولانی است.`);
const optionalText = (max = 2000) => z.string().trim().max(max).nullable().optional();
const id = requiredText("شناسه", 191);
const positiveNumber = z.coerce.number().finite().positive("مقدار باید بزرگ‌تر از صفر باشد.");
const nonNegativeNumber = z.coerce.number().finite().min(0, "مقدار نمی‌تواند منفی باشد.");
const percentage = z.coerce.number().finite().min(0).max(100);
const date = z.preprocess(
  (value) => parseApiDate(value) ?? value,
  z.date({ error: "تاریخ شمسی معتبر نیست." }),
);
const nullableDate = z.union([date, z.null()]).optional();
const mobile = z
  .string()
  .trim()
  .regex(/^(?:\+98|0098|98|0)?9\d{9}$/, "شماره موبایل معتبر نیست.");

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const assetListQuerySchema = paginationSchema.extend({
  type: z.enum(AssetType).optional(),
  status: z.enum(AssetStatus).optional(),
  ownerId: id.optional(),
  archiveState: z.enum(["CURRENT", "ARCHIVED", "ALL"]).default("CURRENT"),
});

export const disposeAssetSchema = z
  .object({
    reason: requiredText("دلیل حذف یا بایگانی", 500).min(5, "دلیل باید حداقل ۵ نویسه داشته باشد."),
  })
  .strict();

const assetFields = {
  ownerId: id.optional(),
  name: requiredText("نام دارایی"),
  type: z.enum(AssetType),
  province: requiredText("استان"),
  city: requiredText("شهر"),
  address: optionalText(1000),
  latitude: z.coerce.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).nullable().optional(),
  gridCompany: optionalText(),
  connectionPoint: optionalText(),
  connectionStatus: z.enum(ConnectionStatus).nullable().optional(),
  capacityNominal: positiveNumber,
  capacitySellable: positiveNumber.optional(),
  technology: optionalText(),
  operationalDate: nullableDate,
  connectionDate: nullableDate,
};

export const createAssetSchema = z
  .object(assetFields)
  .strict()
  .superRefine((value, context) => {
    if (value.capacitySellable != null && value.capacitySellable > value.capacityNominal) {
      context.addIssue({
        code: "custom",
        path: ["capacitySellable"],
        message: "ظرفیت قابل فروش نمی‌تواند از ظرفیت نامی بیشتر باشد.",
      });
    }
  });
export const updateAssetSchema = z
  .object({ ...assetFields, status: z.enum(AssetStatus).optional() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید ارسال شود.");

export const partyListQuerySchema = paginationSchema.extend({
  type: z.enum(PartyType).optional(),
  status: z.enum(PartyStatus).optional(),
});

const partyFields = {
  displayName: requiredText("نام"),
  economicCode: optionalText(30),
  nationalId: optionalText(20),
  registrationNo: optionalText(30),
  taxId: optionalText(30),
  phone: z.union([mobile, z.literal(""), z.null()]).optional(),
  email: z.union([z.email("ایمیل معتبر نیست."), z.literal(""), z.null()]).optional(),
  address: optionalText(1000),
};

export const createPartySchema = z.object({ type: z.enum(PartyType), ...partyFields }).strict();
export const customerOnboardingSchema = createPartySchema;
export const updatePartySchema = z
  .object({ ...partyFields, status: z.enum(PartyStatus).optional() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید ارسال شود.");

export const representativeListQuerySchema = paginationSchema.extend({
  state: z.enum(["ALL", "CURRENT", "SCHEDULED", "EXPIRED", "REVOKED"]).default("ALL"),
});

const representativeAssignmentFields = {
  validFrom: date,
  validTo: nullableDate,
  canSign: z.boolean().default(false),
  authorityReference: optionalText(191),
  notes: optionalText(500),
};

function validateRepresentativeAssignment(
  value: { validFrom: Date; validTo?: Date | null; canSign: boolean; authorityReference?: string | null },
  context: z.RefinementCtx
) {
  if (value.validTo && value.validTo < value.validFrom) {
    context.addIssue({
      code: "custom",
      path: ["validTo"],
      message: "پایان اعتبار نمی‌تواند قبل از شروع اعتبار باشد.",
    });
  }
  if (value.canSign && !value.authorityReference) {
    context.addIssue({
      code: "custom",
      path: ["authorityReference"],
      message: "مرجع اختیار برای اعطای مجوز امضا الزامی است.",
    });
  }
}

export const createRepresentativeAssignmentSchema = z
  .object({
    representativeUserId: id,
    companyPartyId: id,
    ...representativeAssignmentFields,
  })
  .strict()
  .superRefine(validateRepresentativeAssignment);

export const updateRepresentativeAssignmentSchema = z
  .object(representativeAssignmentFields)
  .strict()
  .superRefine(validateRepresentativeAssignment);

export const selectActingPartySchema = z.object({ actingPartyId: id }).strict();

export const requestListQuerySchema = paginationSchema.extend({
  status: z.enum(RequestStatus).optional(),
});

export const eligibleContractRequestQuerySchema = paginationSchema.extend({
  mode: z.enum(["SINGLE", "MASTER"]).default("SINGLE"),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
  requestId: id.optional(),
});

export const createRequestSchema = z
  .object({
    plantType: z.enum(PlantType),
    capacity: positiveNumber,
    province: requiredText("استان"),
    city: requiredText("شهر"),
    operationalStatus: z.enum(OperationalStatus),
    avgMonthlyGeneration: nonNegativeNumber.nullable().optional(),
    hasExistingContract: z.boolean().default(false),
    existingContractStart: nullableDate,
    existingContractEnd: nullableDate,
    existingContractCounterparty: optionalText(200),
    existingContractCommittedCapacity: positiveNumber.nullable().optional(),
    existingContractExclusive: z.boolean().default(false),
    existingContractRestrictions: optionalText(1000),
    existingContractRightToSellConfirmed: z.boolean().default(false),
    contactMobile: mobile.optional(),
    notes: optionalText(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.hasExistingContract) return;
    const requiredExistingContractFields = [
      ["existingContractStart", value.existingContractStart, "تاریخ شروع قرارداد موجود الزامی است."],
      ["existingContractEnd", value.existingContractEnd, "تاریخ پایان قرارداد موجود الزامی است."],
      ["existingContractCounterparty", value.existingContractCounterparty, "نام طرف قرارداد موجود الزامی است."],
      ["existingContractCommittedCapacity", value.existingContractCommittedCapacity, "ظرفیت متعهدشده قرارداد موجود الزامی است."],
    ] as const;
    for (const [field, fieldValue, message] of requiredExistingContractFields) {
      if (fieldValue == null || fieldValue === "") context.addIssue({ code: "custom", path: [field], message });
    }
    if (value.existingContractStart && value.existingContractEnd && value.existingContractEnd <= value.existingContractStart) {
      context.addIssue({ code: "custom", path: ["existingContractEnd"], message: "تاریخ پایان قرارداد موجود باید بعد از تاریخ شروع باشد." });
    }
    if (value.existingContractCommittedCapacity != null && value.existingContractCommittedCapacity > value.capacity) {
      context.addIssue({ code: "custom", path: ["existingContractCommittedCapacity"], message: "ظرفیت متعهدشده نمی‌تواند از ظرفیت نامی بیشتر باشد." });
    }
    if (!value.existingContractRightToSellConfirmed) {
      context.addIssue({ code: "custom", path: ["existingContractRightToSellConfirmed"], message: "تأیید حق فروش ظرفیت آزاد الزامی است." });
    }
  });

export const updateRequestSchema = z
  .object({
    status: z.enum(RequestStatus).optional(),
    notes: optionalText(500),
    action: z.enum(ReviewAction).optional(),
    assetId: id.optional(),
    deferredUntil: nullableDate,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید ارسال شود.");

const meterCompletionSchema = z
  .object({
    type: z.enum(MeterType),
    serialNumber: requiredText("شماره سریال کنتور"),
    manufacturer: optionalText(),
    model: optionalText(),
    readInterval: z.enum(ReadInterval).default(ReadInterval.DAILY),
    dataSource: z.enum(DataSource).default(DataSource.MANUAL),
    installDate: nullableDate,
  })
  .strict();

const operationalMeterSchema = meterCompletionSchema.extend({
  type: z.enum([MeterType.MAIN, MeterType.BACKUP]),
});

export const operationalReadinessSubmissionSchema = z
  .object({
    mode: z.enum(["SAVE_DRAFT", "SUBMIT"]),
    operationalDate: nullableDate,
    connectionDate: nullableDate,
    gridCompany: optionalText(),
    connectionPoint: optionalText(),
    connectionStatus: z.enum(ConnectionStatus).nullable().optional(),
    meters: z.array(operationalMeterSchema).max(2).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const meterTypes = value.meters.map((meter) => meter.type);
    if (new Set(meterTypes).size !== meterTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["meters"],
        message: "برای هر نوع کنتور فقط یک رکورد قابل ثبت است.",
      });
    }
    if (value.mode !== "SUBMIT") return;
    if (!value.operationalDate) {
      context.addIssue({
        code: "custom",
        path: ["operationalDate"],
        message: "تاریخ بهره‌برداری واقعی الزامی است.",
      });
    }
    if (value.connectionStatus !== ConnectionStatus.CONNECTED) {
      context.addIssue({
        code: "custom",
        path: ["connectionStatus"],
        message: "برای اعلام آمادگی، اتصال نیروگاه باید برقرار شده باشد.",
      });
    }
    if (!value.meters.some(({ type }) => type === MeterType.MAIN)) {
      context.addIssue({
        code: "custom",
        path: ["meters"],
        message: "ثبت کنتور اصلی الزامی است.",
      });
    }
  });

const generationProfileSchema = z
  .object({
    year: z.coerce.number().int().min(1200).max(1599),
    method: requiredText("روش پیش‌بینی"),
    source: optionalText(),
    jan: nonNegativeNumber,
    feb: nonNegativeNumber,
    mar: nonNegativeNumber,
    apr: nonNegativeNumber,
    may: nonNegativeNumber,
    jun: nonNegativeNumber,
    jul: nonNegativeNumber,
    aug: nonNegativeNumber,
    sep: nonNegativeNumber,
    oct: nonNegativeNumber,
    nov: nonNegativeNumber,
    dec: nonNegativeNumber,
    confidenceLevel: optionalText(50),
  })
  .strict();

const existingContractDisclosureSchema = z
  .object({
    startDate: date,
    endDate: date,
    counterparty: requiredText("طرف قرارداد موجود", 200),
    committedCapacity: positiveNumber,
    exclusive: z.boolean().default(false),
    restrictions: optionalText(1000),
    rightToSellConfirmed: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate <= value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "تاریخ پایان قرارداد موجود باید بعد از تاریخ شروع باشد.",
      });
    }
    if (!value.rightToSellConfirmed) {
      context.addIssue({
        code: "custom",
        path: ["rightToSellConfirmed"],
        message: "تأیید حق فروش ظرفیت آزاد الزامی است.",
      });
    }
  });

export const completeRequestSchema = z
  .object({
    mode: z.enum(["SAVE_DRAFT", "SUBMIT"]),
    asset: z
      .object({
        internalCode: optionalText(50),
        name: requiredText("نام نیروگاه"),
        type: z.enum(AssetType),
        ownershipPercent: percentage,
        requesterRole: z.enum(AssetRequesterRole),
        province: requiredText("استان"),
        city: requiredText("شهر"),
        address: optionalText(1000),
        latitude: z.coerce.number().finite().min(-90).max(90).nullable().optional(),
        longitude: z.coerce.number().finite().min(-180).max(180).nullable().optional(),
        gridCompany: optionalText(),
        connectionPoint: optionalText(),
        connectionStatus: z.enum(ConnectionStatus).nullable().optional(),
        capacityNominal: positiveNumber,
        capacitySellable: positiveNumber,
        technology: optionalText(),
        operationalDate: nullableDate,
        connectionDate: nullableDate,
      })
      .strict(),
    meters: z.array(meterCompletionSchema).max(2).default([]),
    generationProfile: generationProfileSchema.nullable().optional(),
    existingContract: existingContractDisclosureSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.asset.capacitySellable > value.asset.capacityNominal) {
      context.addIssue({
        code: "custom",
        path: ["asset", "capacitySellable"],
        message: "ظرفیت قابل فروش نمی‌تواند از ظرفیت نامی بیشتر باشد.",
      });
    }

    if (
      value.existingContract &&
      value.existingContract.committedCapacity > value.asset.capacityNominal
    ) {
      context.addIssue({
        code: "custom",
        path: ["existingContract", "committedCapacity"],
        message: "ظرفیت متعهدشده قرارداد موجود نمی‌تواند از ظرفیت نامی بیشتر باشد.",
      });
    }

    const meterTypes = value.meters.map((meter) => meter.type);
    if (new Set(meterTypes).size !== meterTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["meters"],
        message: "برای هر نوع کنتور فقط یک رکورد قابل ثبت است.",
      });
    }
  });

export const proposalListQuerySchema = paginationSchema.extend({
  status: z.enum(ProposalStatus).optional(),
  requestId: id.optional(),
});

export const createProposalSchema = z
  .object({
    requestId: id,
    pricePerKwh: positiveNumber,
    minVolume: nonNegativeNumber.nullable().optional(),
    maxVolume: positiveNumber.nullable().optional(),
    duration: z.coerce.number().int().min(1).max(600),
    validDays: z.coerce.number().int().min(1).max(365),
    notes: optionalText(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minVolume != null &&
      value.maxVolume != null &&
      value.maxVolume < value.minVolume
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxVolume"],
        message: "حداکثر حجم باید از حداقل حجم بزرگ‌تر یا مساوی باشد.",
      });
    }
  });

export const decideProposalSchema = z
  .object({
    id,
    status: z.enum([ProposalStatus.ACCEPTED, ProposalStatus.REJECTED]),
    customerNote: optionalText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === ProposalStatus.REJECTED && !value.customerNote?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["customerNote"],
        message: "برای رد پیشنهاد، درج دلیل الزامی است.",
      });
    }
  });

export const reviewProposalSchema = z
  .object({ notes: requiredText("یادداشت", 500), action: requiredText("عملیات", 50).default("NOTE") })
  .strict();

const contractDates = <T extends { effectiveDate: Date; expirationDate?: Date | null }>(
  value: T,
  context: z.RefinementCtx
) => {
  if (value.expirationDate && value.expirationDate <= value.effectiveDate) {
    context.addIssue({
      code: "custom",
      path: ["expirationDate"],
      message: "تاریخ پایان باید بعد از تاریخ شروع باشد.",
    });
  }
};

const contractBase = z.object({
  type: z.enum(ContractType).default(ContractType.PPA),
  effectiveDate: date,
  expirationDate: nullableDate,
  notes: optionalText(),
  volumeType: z.enum(VolumeType).optional(),
  settlementCycle: z.enum(SettlementCycle).optional(),
  paymentDueDays: z.coerce.number().int().min(1).max(365).optional(),
  nettingEnabled: z.boolean().optional(),
});

export const createContractSchema = z
  .union([
    contractBase.extend({ requestId: id }).strict(),
    contractBase
      .extend({
        requestIds: z
          .array(id)
          .length(2, "برای قرارداد مادر دقیقاً دو درخواست لازم است.")
          .refine((requestIds) => new Set(requestIds).size === requestIds.length, {
            message: "دو درخواست قرارداد مادر باید متفاوت باشند.",
          }),
      })
      .strict(),
    contractBase
      .extend({
        parties: z
          .array(
            z.object({ partyId: id, role: z.enum(ContractRole), isPrimary: z.boolean().optional() }).strict()
          )
          .min(1)
          .max(20),
        assets: z
          .array(z.object({ assetId: id, sharePercent: percentage.nullable().optional() }).strict())
          .max(100)
          .optional(),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    contractDates(value, context);
    if ("assets" in value && value.assets?.some((asset) => asset.sharePercent != null)) {
      const hasMissingShare = value.assets.some((asset) => asset.sharePercent == null);
      const totalShare = value.assets.reduce((sum, asset) => sum + (asset.sharePercent ?? 0), 0);
      if (hasMissingShare || Math.abs(totalShare - 100) > 0.0001) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message: "در صورت تعیین سهم، سهم همه دارایی‌ها باید درج شود و مجموع آن ۱۰۰ درصد باشد.",
        });
      }
    }
  });

export const updateContractSchema = z.union([
  z.object({ status: z.enum(ContractStatus), notes: optionalText(500) }).strict(),
  z.object({ action: z.literal("NOTE"), notes: requiredText("یادداشت", 500) }).strict(),
]);

export const updateContractStatusSchema = z
  .object({ id, status: z.enum(ContractStatus), notes: optionalText(500) })
  .strict();

const configuredAssetSchema = z
  .object({
    assetId: id,
    sharePercent: percentage.nullable().optional(),
    volumeMWh: positiveNumber.nullable().optional(),
  })
  .strict();

const commercialScheduleSchema = z
  .object({
    assetId: id,
    name: optionalText(),
    startDate: date,
    endDate: date,
    volumeType: z.enum(VolumeType),
    minVolume: nonNegativeNumber.nullable().optional(),
    maxVolume: positiveNumber.nullable().optional(),
    pricingPlanId: id,
    settlementCycle: z.enum(SettlementCycle).default(SettlementCycle.MONTHLY),
    paymentDueDays: z.coerce.number().int().min(1).max(365).default(30),
    nettingEnabled: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endDate <= value.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "پایان برنامه باید بعد از شروع باشد." });
    }
    if (value.minVolume != null && value.maxVolume != null && value.maxVolume < value.minVolume) {
      context.addIssue({ code: "custom", path: ["maxVolume"], message: "حداکثر حجم باید از حداقل حجم بیشتر باشد." });
    }
  });

export const configureContractSchema = contractBase
  .extend({
    assets: z.array(configuredAssetSchema).min(1).max(100),
    schedules: z.array(commercialScheduleSchema).min(1).max(500),
    meteringAnnex: z
      .object({
        primarySource: requiredText("منبع اصلی"),
        backupSource: optionalText(),
        missingDataPolicy: requiredText("سیاست داده مفقود", 1000),
        validationRules: z.record(z.string(), z.unknown()).nullable().optional(),
        correctionDeadline: z.coerce.number().int().min(1).max(365).nullable().optional(),
        disputeDeadline: z.coerce.number().int().min(1).max(365).nullable().optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    contractDates(value, context);
    const assetIds = new Set(value.assets.map(({ assetId }) => assetId));
    if (assetIds.size !== value.assets.length) {
      context.addIssue({ code: "custom", path: ["assets"], message: "هر دارایی فقط یک بار قابل انتخاب است." });
    }
    const suppliedShares = value.assets.filter(({ sharePercent }) => sharePercent != null);
    if (suppliedShares.length > 0) {
      const total = suppliedShares.reduce((sum, asset) => sum + (asset.sharePercent ?? 0), 0);
      if (suppliedShares.length !== value.assets.length || Math.abs(total - 100) > 0.0001) {
        context.addIssue({ code: "custom", path: ["assets"], message: "سهم همه دارایی‌ها باید درج شود و مجموع آن ۱۰۰ درصد باشد." });
      }
    }
    for (const [index, schedule] of value.schedules.entries()) {
      if (!assetIds.has(schedule.assetId)) {
        context.addIssue({ code: "custom", path: ["schedules", index, "assetId"], message: "دارایی برنامه تجاری در قرارداد انتخاب نشده است." });
      }
      if (schedule.startDate < value.effectiveDate || (value.expirationDate && schedule.endDate > value.expirationDate)) {
        context.addIssue({ code: "custom", path: ["schedules", index], message: "بازه برنامه تجاری باید داخل بازه قرارداد باشد." });
      }
    }
    const scheduleAssetIds = value.schedules.map(({ assetId }) => assetId);
    if (new Set(scheduleAssetIds).size !== scheduleAssetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["schedules"],
        message: "برای هر دارایی دقیقاً یک برنامه تجاری قابل ثبت است.",
      });
    }
    for (const assetId of assetIds) {
      if (!value.schedules.some((schedule) => schedule.assetId === assetId)) {
        context.addIssue({ code: "custom", path: ["schedules"], message: `برای دارایی ${assetId} برنامه تجاری تعریف نشده است.` });
      }
    }
  });

export const signContractSchema = z
  .object({ partyId: id, evidenceReference: requiredText("مرجع مدرک امضا", 191) })
  .strict();

export const createAmendmentSchema = z
  .object({
    title: requiredText("عنوان اصلاحیه"),
    description: optionalText(1000),
    changes: z.record(z.string(), z.unknown()),
    effectiveDate: date,
  })
  .strict();

export const createMeterSchema = z
  .object({
    assetId: id,
    type: z.enum(MeterType).default(MeterType.MAIN),
    serialNumber: requiredText("شماره سریال"),
    manufacturer: optionalText(),
    model: optionalText(),
    readInterval: z.enum(ReadInterval).default(ReadInterval.DAILY),
    dataSource: z.enum(DataSource).default(DataSource.SMART_METER),
    installDate: nullableDate,
  })
  .strict();

export const createMeterReadingSchema = z
  .object({
    assetId: id,
    meterId: id.nullable().optional(),
    periodStart: date,
    periodEnd: date,
    rawEnergy: nonNegativeNumber,
    rawPeak: nonNegativeNumber.nullable().optional(),
    rawOffPeak: nonNegativeNumber.nullable().optional(),
    source: requiredText("منبع", 50).default("METER"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.periodEnd <= value.periodStart) {
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "پایان بازه باید بعد از شروع بازه باشد.",
      });
    }
  });

export const updateMeterReadingSchema = z
  .object({
    acceptedEnergy: nonNegativeNumber.optional(),
    rejectedEnergy: nonNegativeNumber.optional(),
    rejectionReason: optionalText(500),
    status: z.enum(ReadingStatus).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید ارسال شود.")
  .superRefine((value, context) => {
    if (value.status === ReadingStatus.REJECTED && !value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "برای رد قرائت، درج دلیل الزامی است.",
      });
    }
  });

const pricingPlanFields = {
  name: requiredText("نام طرح"),
  code: requiredText("کد طرح", 50).regex(/^[A-Za-z0-9_-]+$/, "کد طرح معتبر نیست."),
  model: z.enum(PricingModel),
  fixedRate: nonNegativeNumber.nullable().optional(),
  fixedRateHybrid: nonNegativeNumber.nullable().optional(),
  fixedSharePct: percentage.nullable().optional(),
  marketSharePct: percentage.nullable().optional(),
  multiplier: nonNegativeNumber.default(1),
  differential: z.coerce.number().finite().default(0),
  floorValue: nonNegativeNumber.nullable().optional(),
  ceilingValue: nonNegativeNumber.nullable().optional(),
  marketName: optionalText(),
  indexName: optionalText(),
  indexSource: optionalText(),
  indexTimeframe: optionalText(),
  averagingMethod: optionalText(),
  currency: requiredText("ارز", 10).default("IRR"),
  validFrom: date,
  validTo: nullableDate,
  notes: optionalText(),
};

function validatePricingPlan(
  value: { model?: PricingModel; validFrom?: Date; validTo?: Date | null; fixedSharePct?: number | null; marketSharePct?: number | null; fixedRate?: number | null; fixedRateHybrid?: number | null; floorValue?: number | null; ceilingValue?: number | null; indexName?: string | null; indexSource?: string | null },
  context: z.RefinementCtx
) {
  const indexedModels: PricingModel[] = [PricingModel.MARKET_INDEX, PricingModel.HYBRID, PricingModel.FLOOR];
  if (value.validFrom && value.validTo && value.validTo <= value.validFrom) {
    context.addIssue({ code: "custom", path: ["validTo"], message: "پایان اعتبار باید بعد از شروع باشد." });
  }
  if (value.fixedSharePct != null || value.marketSharePct != null) {
    const total = (value.fixedSharePct ?? 0) + (value.marketSharePct ?? 0);
    if (Math.abs(total - 100) > 0.0001) {
      context.addIssue({
        code: "custom",
        path: ["marketSharePct"],
        message: "مجموع سهم ثابت و بازار باید دقیقاً ۱۰۰ درصد باشد.",
      });
    }
  }
  if (value.floorValue != null && value.ceilingValue != null && value.ceilingValue < value.floorValue) {
    context.addIssue({ code: "custom", path: ["ceilingValue"], message: "سقف قیمت باید از کف قیمت بزرگ‌تر یا مساوی باشد." });
  }
  if (value.model && indexedModels.includes(value.model) && (!value.indexName || !value.indexSource)) {
    context.addIssue({ code: "custom", path: ["indexName"], message: "نام و منبع شاخص برای این مدل قیمت‌گذاری الزامی است." });
  }
  if (value.model === PricingModel.FIXED && value.fixedRate == null) {
    context.addIssue({ code: "custom", path: ["fixedRate"], message: "نرخ ثابت الزامی است." });
  }
  if (value.model === PricingModel.HYBRID && value.fixedRateHybrid == null && value.fixedRate == null) {
    context.addIssue({ code: "custom", path: ["fixedRateHybrid"], message: "نرخ بخش ثابت مدل ترکیبی الزامی است." });
  }
}

export const createPricingPlanSchema = z.object(pricingPlanFields).strict().superRefine(validatePricingPlan);
export const updatePricingPlanSchema = z
  .object(pricingPlanFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "حداقل یک فیلد باید ارسال شود.");

export const transitionPricingPlanSchema = z
  .object({
    status: z.enum([
      PricingStatus.DRAFT,
      PricingStatus.REVIEW,
      PricingStatus.APPROVED,
      PricingStatus.ACTIVE,
      PricingStatus.DEPRECATED,
    ]),
    notes: optionalText(500),
  })
  .strict();

export const createSettlementRevisionSchema = z
  .object({
    reason: requiredText("دلیل اصلاح", 1000),
    acceptedEnergy: positiveNumber.optional(),
    adjustments: z.array(z.object({ type: requiredText("نوع تعدیل", 50), amount: z.coerce.number().finite(), reason: requiredText("دلیل تعدیل", 500) }).strict()).max(100).default([]),
  })
  .strict()
  .refine((value) => value.acceptedEnergy !== undefined || value.adjustments.length > 0, "برای اصلاح، انرژی یا حداقل یک تعدیل لازم است.");

export const calculatePriceSchema = z
  .object({
    energy: positiveNumber,
    period: requiredText("دوره", 20).regex(/^1[2-5]\d{2}-(0[1-9]|1[0-2])$/, "دوره باید به شکل شمسی YYYY-MM باشد."),
    pricingPlanId: id,
  })
  .strict();

export const createMarketIndexSchema = z
  .object({
    pricingPlanId: id,
    period: requiredText("دوره", 7).regex(/^1[2-5]\d{2}-(0[1-9]|1[0-2])$/, "دوره باید به شکل شمسی YYYY-MM باشد."),
    value: positiveNumber,
    indexName: requiredText("نام شاخص"),
    source: requiredText("منبع شاخص"),
    timezone: requiredText("منطقه زمانی").default("Asia/Tehran"),
    observedAt: date,
  })
  .strict();

export const createFinancialConfigurationSchema = z
  .object({
    name: requiredText("عنوان تنظیم مالی"),
    taxRate: z.coerce.number().finite().min(0).max(1),
    deductionRate: z.coerce.number().finite().min(0).max(1).default(0),
    validFrom: date,
    validTo: nullableDate,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.validTo && value.validTo <= value.validFrom) {
      context.addIssue({ code: "custom", path: ["validTo"], message: "پایان اعتبار باید بعد از شروع باشد." });
    }
  });

export const updateFinancialConfigurationPeriodSchema = z
  .object({ validFrom: date, validTo: nullableDate })
  .strict()
  .superRefine((value, context) => {
    if (value.validTo && value.validTo <= value.validFrom) {
      context.addIssue({ code: "custom", path: ["validTo"], message: "پایان اعتبار باید بعد از شروع باشد." });
    }
  });

export const calculateSettlementSchema = z
  .object({
    contractId: id,
    assetId: id,
    periodStart: date,
    periodEnd: date,
    pricingPlanId: id.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.periodEnd <= value.periodStart) {
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "پایان دوره باید بعد از شروع دوره باشد.",
      });
    }
    if (!isExactUtcCalendarMonth(value.periodStart, value.periodEnd)) {
      context.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "دوره تسویه باید دقیقاً یک ماه تقویمی، از روز اول تا روز اول ماه بعد باشد.",
      });
    }
  });

export const updateSettlementSchema = z
  .object({
    status: z.enum(SettlementStatus),
    disputeReason: optionalText(1000),
  })
  .strict();

export const createNettingGroupSchema = z
  .object({
    name: requiredText("نام گروه"),
    code: requiredText("کد گروه", 50).regex(/^[A-Za-z0-9_-]+$/, "کد گروه معتبر نیست."),
    contractId: id,
    legalBasis: requiredText("مبنای حقوقی", 1000),
  })
  .strict();

export const nettingBatchListQuerySchema = paginationSchema.extend({
  groupId: id.optional(),
});

export const createNettingBatchSchema = z
  .object({
    groupId: id,
    settlementIds: z
      .array(id)
      .min(2, "حداقل دو تسویه برای خالص‌سازی لازم است.")
      .max(100)
      .refine((values) => new Set(values).size === values.length, {
        message: "هر تسویه فقط یک بار قابل انتخاب است.",
      }),
    idempotencyKey: requiredText("کلید idempotency", 100).regex(
      /^[A-Za-z0-9._:-]+$/,
      "کلید idempotency معتبر نیست."
    ),
  })
  .strict();

export const updateNettingBatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT") }).strict(),
  z.object({ action: z.literal("APPROVE"), notes: optionalText(500) }).strict(),
  z.object({ action: z.literal("REJECT"), notes: requiredText("دلیل رد", 500) }).strict(),
  z.object({ action: z.literal("CANCEL"), notes: optionalText(500) }).strict(),
]);

export const createInvoiceSchema = z.object({ settlementId: id, notes: optionalText() }).strict();
export const updateInvoiceSchema = z.object({ status: z.enum(InvoiceStatus) }).strict();

const safeIrrAmount = z.coerce.number().int("مبلغ ریالی باید عدد صحیح باشد.").positive().max(Number.MAX_SAFE_INTEGER);
const idempotencyKey = requiredText("کلید idempotency", 100).regex(/^[A-Za-z0-9._:-]+$/, "کلید idempotency معتبر نیست.");

export const createNettingStatementSchema = z.object({ idempotencyKey }).strict();

export const allocateNettingPaymentSchema = z
  .object({ nettingStatementId: id, amount: safeIrrAmount, idempotencyKey })
  .strict();

export const paymentListQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional(),
});

export const createPaymentSchema = z
  .object({
    amount: safeIrrAmount,
    currency: z.literal("IRR").default("IRR"),
    paymentDate: date,
    method: z.enum(["BANK_TRANSFER", "CHECK", "CASH", "OTHER"]),
    bankName: optionalText(191),
    reference: requiredText("مرجع بانکی", 191),
    notes: optionalText(1000),
    idempotencyKey,
  })
  .strict();

export const updatePaymentStatusSchema = z
  .object({
    status: z.enum(["CONFIRMED", "REJECTED"]),
    rejectionReason: optionalText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && !value.rejectionReason) {
      context.addIssue({ code: "custom", path: ["rejectionReason"], message: "دلیل رد پرداخت الزامی است." });
    }
  });

export const allocatePaymentSchema = z
  .object({ invoiceId: id, amount: safeIrrAmount, idempotencyKey })
  .strict();

const generationMonths = {
  jan: nonNegativeNumber,
  feb: nonNegativeNumber,
  mar: nonNegativeNumber,
  apr: nonNegativeNumber,
  may: nonNegativeNumber,
  jun: nonNegativeNumber,
  jul: nonNegativeNumber,
  aug: nonNegativeNumber,
  sep: nonNegativeNumber,
  oct: nonNegativeNumber,
  nov: nonNegativeNumber,
  dec: nonNegativeNumber,
};

export const createGenerationProfileVersionSchema = z
  .object({
    year: z.coerce.number().int().min(1200).max(1599),
    method: requiredText("روش پیش‌بینی"),
    source: requiredText("منبع پیش‌بینی"),
    confidenceLevel: optionalText(50),
    ...generationMonths,
  })
  .strict();

export const updateGenerationProfileStatusSchema = z
  .object({ status: z.enum(["REVIEW", "APPROVED"]) })
  .strict();
export const verifyDocumentSchema = z.object({ verified: z.boolean() }).strict();
export const updateNotificationSchema = z.object({ isRead: z.boolean().default(true) }).strict();
export const documentListQuerySchema = z.object({ requestId: id }).strict();
export const contractListQuerySchema = paginationSchema.extend({ id: id.optional() });

export const documentTypeSchema = z.enum(DocumentType);
export const uploadDocumentSchema = z
  .object({
    requestId: id,
    type: documentTypeSchema,
    file: z
      .instanceof(File)
      .refine((file) => file.size <= 10 * 1024 * 1024, "حداکثر اندازه فایل ۱۰ مگابایت است.")
      .refine((file) => file.size > 0, "فایل خالی است.")
      .refine(
        (file) =>
          [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type),
        "نوع فایل مجاز نیست."
      ),
  })
  .strict();
