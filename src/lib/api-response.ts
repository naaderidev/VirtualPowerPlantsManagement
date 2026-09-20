import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { logError } from "@/lib/logger";
import { serializeApiDates } from "@/lib/persian-date";

export type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE_VIOLATION"
  | "INTERNAL_ERROR";

export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiFieldErrors;
    correlationId: string;
  };
};

export function apiJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(serializeApiDates(body), init);
}

type ParseResult<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; response: NextResponse<ApiErrorBody> };

function toFieldErrors(error: z.ZodError): ApiFieldErrors {
  return Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1])
    )
  );
}

export class BusinessRuleError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode = "BUSINESS_RULE_VIOLATION",
    readonly status = 422,
    readonly details?: ApiFieldErrors
  ) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

export function getCorrelationId(request?: Request): string {
  const supplied = request?.headers.get("x-correlation-id");
  return supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
    ? supplied
    : randomUUID();
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options: {
    request?: Request;
    correlationId?: string;
    details?: ApiFieldErrors;
  } = {}
): NextResponse<ApiErrorBody> {
  const correlationId = options.correlationId ?? getCorrelationId(options.request);

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options.details && { details: options.details }),
        correlationId,
      },
    },
    { status, headers: { "x-correlation-id": correlationId } }
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  const correlationId = getCorrelationId(request);
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_JSON", "بدنه درخواست JSON معتبر نیست.", {
        correlationId,
      }),
    };
  }

  return validateInput(input, schema, request, correlationId);
}

export function validateInput<T>(
  input: unknown,
  schema: ZodType<T>,
  request?: Request,
  correlationId = getCorrelationId(request)
): ParseResult<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(422, "VALIDATION_ERROR", "اطلاعات ارسالی معتبر نیست.", {
        correlationId,
        details: toFieldErrors(result.error),
      }),
    };
  }

  return { ok: true, data: result.data, correlationId };
}

export function parseSearchParams<T>(
  request: Request,
  schema: ZodType<T>
): ParseResult<T> {
  const correlationId = getCorrelationId(request);
  const input = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(input);

  if (!result.success) {
    return {
      ok: false,
      response: apiError(422, "VALIDATION_ERROR", "پارامترهای جستجو معتبر نیستند.", {
        correlationId,
        details: toFieldErrors(result.error),
      }),
    };
  }

  return { ok: true, data: result.data, correlationId };
}

export function handleRouteError(
  request: Request,
  error: unknown,
  context: string
): NextResponse<ApiErrorBody> {
  const correlationId = getCorrelationId(request);

  if (error instanceof BusinessRuleError) {
    return apiError(error.status, error.code, error.message, {
      correlationId,
      details: error.details,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError(409, "CONFLICT", "رکوردی با این مشخصات قبلاً ثبت شده است.", {
        correlationId,
      });
    }
    if (error.code === "P2003" || error.code === "P2025") {
      return apiError(404, "NOT_FOUND", "رکورد مرتبط پیدا نشد.", { correlationId });
    }
  }

  logError("api.request.failed", error, { correlationId, context });
  return apiError(500, "INTERNAL_ERROR", "خطای غیرمنتظره‌ای رخ داد.", {
    correlationId,
  });
}

export async function requireExistingRecord<T>(
  recordPromise: Promise<T | null>,
  message: string
): Promise<T> {
  const record = await recordPromise;
  if (!record) throw new BusinessRuleError(message, "NOT_FOUND", 404);
  return record;
}
