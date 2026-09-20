# فاز چهار — موتور قرارداد و امضای دوطرفه

وضعیت: پیاده‌سازی هسته انجام شده و migration روی دیتابیس توسعه اعمال شده است.

## انطباق با سند VPP

این فاز نیازمندی‌های `PR-02`، `PR-06`، `PR-07`، `PR-08`، `PR-16` و بخش قراردادی `PR-17` را اجرا می‌کند:

- Party از Asset مستقل است و یک قرارداد می‌تواند چند دارایی با سهم یا حجم مشخص داشته باشد؛
- قرارداد از سه لایه Master PPA، Commercial Schedule و Metering/Settlement Annex تشکیل می‌شود؛
- موتور lifecycle قرارداد از PricingPlan جداست و schedule فقط به نسخه تأییدشده یا فعال طرح قیمت متصل می‌شود؛
- فروشنده و خریدار اصلی متمایزند و خریدار پایه با `systemCode=BARTOO_BUYER` تعریف می‌شود؛
- امضای فروشنده و خریدار جداگانه، همراه با actor، زمان سرور و مرجع evidence ثبت می‌شود؛
- با تکمیل هر دو امضا قرارداد `SIGNED` و snapshot نسخه امضاشده immutable ذخیره می‌شود؛
- فعال‌سازی پیش از تاریخ مؤثر، پیش از تکمیل پیکربندی یا پیش از دو امضا رد می‌شود؛
- تغییر قرارداد فعال از طریق Amendment انجام می‌شود و متن/نسخه امضاشده مستقیماً تغییر نمی‌کند؛
- نماینده مشتری تنها از طریق Relationship معتبر از نوع `REPRESENTATIVE` و در بازه اعتبار به Party مقصد دسترسی دارد.

## گردش وضعیت قرارداد

مسیر اصلی:

`DRAFT → CONFIGURED → INTERNAL_REVIEW → PENDING_SIGNATURE → SIGNED → ACTIVE`

مسیرهای کنترل‌شده دیگر شامل `NEEDS_CHANGES`، `REJECTED`، `CANCELLED`، `AMENDMENT_PENDING`، `TERMINATION_PENDING` و `TERMINATED` هستند. نقش actor، کامل‌بودن پیکربندی، وجود امضاها، تاریخ مؤثر و درج دلیل در transitionهای حساس کنترل می‌شود. به‌روزرسانی وضعیت با شرط وضعیت قبلی انجام می‌شود تا overwrite هم‌زمان رخ ندهد.

## APIهای فاز

- `POST /api/contracts`: ساخت idempotent قرارداد از درخواست `PROPOSAL_ACCEPTED` یا ساخت دستی draft؛
- `PUT /api/contracts/:id/configuration`: ثبت اتمیک دارایی‌ها، scheduleها و annex؛
- `PATCH /api/contracts` و `PATCH /api/contracts/:id`: transition کنترل‌شده؛
- `POST /api/contracts/:id/signatures`: ثبت idempotent امضای هر طرف و نهایی‌سازی خودکار پس از دو امضا؛
- `POST /api/contracts/:id/amendments`: ایجاد اصلاحیه برای قرارداد فعال بدون تغییر نسخه امضاشده؛
- `GET /api/contracts/:id`: نمایش سه لایه قرارداد، امضاها، نسخه‌ها، reviewها و اصلاحیه‌ها با scope دسترسی.

## یکپارچگی و Audit

ایجاد قرارداد و اتصال Request، ذخیره پیکربندی، transition وضعیت، امضا و ایجاد اصلاحیه در transaction انجام می‌شوند. برای mutationهای اصلی AuditLog دارای correlation ID و ContractReview ثبت می‌شود. پس از امضای دوطرف، Request به `CONTRACT_SIGNED` می‌رود و فقط در فعال‌سازی قرارداد به `ACTIVE` تغییر می‌کند.

## تصمیم محصولی باز

طبق سناریوی پذیرش، فعلاً Party سیستمی «شرکت برقتو» به‌عنوان خریدار اجرا شده است. تصمیم `D-005` درباره مدل حقوقی نهایی Buyer هنوز باید توسط مالک محصول/حقوقی تصویب شود؛ `systemCode` امکان تعویض رکورد پایه را بدون یکی‌کردن خریدار و فروشنده فراهم می‌کند.

## شواهد کنترل کیفیت

- Prisma schema معتبر و migration `20260912174500_phase_four_contract_engine` روی دیتابیس توسعه اعمال شده است؛
- `npm run typecheck`: موفق؛
- `npm run build`: موفق و هر سه endpoint جدید در route map تولیدی ثبت شدند؛
- lint هدفمند هسته فاز چهار: بدون خطا؛
- `test:security`: سه تست موفق؛
- `test:api`: یازده تست موفق؛
- `test:workflow`: یازده تست موفق (شش درخواست و پنج قرارداد)؛
- Next.js runtime compilation: بدون issue و session runtime بدون خطا؛
- endpoint قرارداد در حالت ناشناس پاسخ ثابت `401` همراه correlation ID برگرداند.

بررسی مرورگری سناریوی کامل احراز هویت‌شده به رمز حساب seed یا ورود تعاملی کاربر نیاز دارد؛ در محیط فعلی `SEED_PASSWORD` موجود نبود و داده‌های احراز هویت موجود بازنشانی نشدند.
