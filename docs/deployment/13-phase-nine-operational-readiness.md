# گزارش اجرای فاز نه: آمادگی عملیاتی و بسته استقرار

## دامنه و نتیجه

فاز نه بخش قابل اجرای repository از `OPS-04` تا `OPS-08` را برای یک استقرار مستقل از ارائه‌دهنده آماده می‌کند. خروجی این فاز یک artifact استاندارد Next.js، قرارداد صریح متغیرهای runtime، health checkهای تفکیک‌شده، log ساخت‌یافته و pipeline ساخت container است. استقرار واقعی production تا تعیین تصمیم‌های زیرساختی باز انجام نشده است.

## بسته استقرار

- Next.js با `output: standalone` ساخته می‌شود و فایل‌های `public` و `.next/static` در پایان build داخل artifact قرار می‌گیرند.
- پوشه قدیمی `public/uploads` وارد artifact نمی‌شود؛ درخواست مستقیم به `/uploads` نیز در proxy با 404 پاسخ داده می‌شود.
- Dockerfile چندمرحله‌ای روی Node.js 20 ساخته شده، برنامه را با کاربر non-root اجرا می‌کند و liveness را برای container health check می‌سنجد.
- `RELEASE_ID` هم به build و هم به runtime داده می‌شود تا هر پاسخ سلامت و هر log به نسخه قابل ردیابی متصل باشد.
- image نهایی secret یا فایل `.env` را کپی نمی‌کند. secretها باید توسط محیط اجرا تزریق شوند.

## قرارداد startup

`scripts/start-production.mjs` پیش از اجرای server تمام موارد زیر را fail-fast بررسی می‌کند:

- `APP_ENV` یکی از محیط‌های مجاز باشد؛
- `RELEASE_ID` شناسه امن و محدود داشته باشد؛
- `DATABASE_URL` یک URL معتبر MySQL باشد؛
- `NEXTAUTH_SECRET` حداقل ۳۲ نویسه و غیرنمونه‌ای باشد؛
- `NEXTAUTH_URL` معتبر و در production مبتنی بر HTTPS باشد؛
- `UPLOAD_DIR` تنظیم شده و در هیچ مسیر `public` قرار نگرفته باشد.

در production نباید به بارگذاری خودکار `.env` تکیه کرد. متغیرها باید صریحاً توسط secret manager یا orchestrator به process تزریق شوند. `runtime:validate` همین قرارداد را مستقل از start در CI کنترل می‌کند.

## health و observability

- `GET /api/health/live`: عمومی، بدون وابستگی دیتابیس، با پاسخ ۲۰۰ و metadata نسخه؛ برای تشخیص زنده‌بودن process.
- `GET /api/health/ready`: عمومی، با query واقعی و timeout دوثانیه‌ای دیتابیس؛ پاسخ ۲۰۰ در حالت آماده و 503 همراه `Retry-After` در اختلال.
- هر خطای readiness یک `correlationId` دارد و همان شناسه در پاسخ و log ساخت‌یافته JSON ثبت می‌شود.
- متن exception و جزئیات اتصال دیتابیس در production به client یا log عمومی نشت نمی‌کند؛ فقط نوع خطا، dependency، محیط و release ثبت می‌شوند.
- header معرفی فناوری (`X-Powered-By`) غیرفعال و cache تمام APIها خصوصی و `no-store` است.

## ترتیب پیشنهادی انتشار

1. image تغییرناپذیر با `RELEASE_ID` متناظر commit ساخته و scan شود.
2. backup طبق سازوکار زیرساخت و تصمیم مصوب RPO/RTO گرفته شود.
3. در یک job جدا `npm run db:migrate:status` و سپس `npm run db:migrate:deploy` اجرا شود؛ migration داخل startup برنامه اجرا نمی‌شود.
4. نسخه جدید با متغیرهای runtime معتبر بالا بیاید؛ orchestrator ابتدا liveness و سپس readiness را کنترل کند.
5. پس از آماده‌شدن instance، smoke test ورود، یک API خواندنی و مسیرهای اصلی انجام شود.
6. در خطای application به image قبلی rollback شود. rollback دیتابیس خودکار نیست و فقط بر اساس runbook و backup تأییدشده انجام می‌شود.

## CI و کنترل‌های انتشار

workflow کیفیت اکنون علاوه بر lint، typecheck، تست، Prisma validation و build، قرارداد runtime، dependency audit و ساخت Docker image را اجرا می‌کند. merge protection باید در میزبان repository روی job `Lint, types, tests, schema, build` اجباری شود.

## شواهد اعتبارسنجی محلی

- `npm run verify`: موفق؛ ۴۹ تست از ۴۹ تست، Prisma schema معتبر و build تولیدی موفق.
- lint: صفر error و همان baseline قبلی ۱۸۷ warning؛ بدهی جدیدی افزوده نشد.
- build Next.js 16.3.4: موفق؛ دو endpoint سلامت در route registry و artifact standalone ثبت شدند.
- اجرای artifact با `npm start`: موفق و بدون هشدار ناسازگاری `next start`.
- liveness در runtime production آزمایشی: پاسخ ۲۰۰، محیط و release صحیح، بدون `X-Powered-By`.
- readiness با دیتابیس عمداً ناموجود: پاسخ امن 503 و log JSON متناظر با correlation ID.
- بررسی browser و `/_next/mcp`: liveness و readiness محیط توسعه پاسخ ۲۰۰ و خطای runtime/configuration برابر صفر.
- `npm audit --omit=dev --audit-level=high`: صفر آسیب‌پذیری شناخته‌شده.

Docker CLI روی میزبان فعلی نصب نیست؛ بنابراین خود image محلی اجرا نشد و ساخت image به workflow محیط CI دارای Docker سپرده شده است.

## موارد باز و مرز آمادگی

- `OPS-04` همچنان `PARTIAL` است: زنجیره موجود migration از یک baseline کامل برای دیتابیس خالی شروع نمی‌شود. قبل از staging باید baseline رسمی ساخته و migration روی دیتابیس خالی آزمایش شود.
- `OPS-05` همچنان `PARTIAL` است: اسکریپت‌های backup/restore آماده‌اند، اما MySQL client و دیتابیس restore مستقل برای drill روی میزبان حاضر وجود ندارد.
- `OPS-06` از سمت repository آماده است، ولی branch protection و اجرای hosted workflow به remote نیاز دارد.
- `OPS-07` از سمت برنامه `PARTIAL` است؛ log sink مرکزی، retention، error tracker و alert rule باید در مقصد استقرار متصل و با خطای مصنوعی آزموده شوند.
- `D-018`: storage adapter هنوز filesystem محلی است. برای production باید object storage خصوصی با URL زمان‌دار تکمیل شود.
- `D-020`: ارائه‌دهنده، region، شبکه، TLS termination و orchestrator هنوز انتخاب نشده‌اند.
- `D-021`: RPO/RTO پیشنهادی باید تصویب و با restore drill اندازه‌گیری شود.
- `D-022`: retention داده‌های مالی، حقوقی و audit هنوز تصمیم مصوب ندارد.

بنابراین repository برای ساخت و اجرای artifact قابل استقرار آماده شده است، اما مجوز اعلام «production-ready کامل» تا بسته‌شدن موارد بالا صادر نمی‌شود.
