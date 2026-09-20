# گزارش اجرای فاز هشت: دروازه‌های کیفیت و CI

## دامنه

این فاز بخش قابل اجرای `OPS-06` را پوشش می‌دهد: نصب تکرارپذیر dependencyها، lint، typecheck، تست، اعتبارسنجی Prisma، build تولیدی و dependency audit باید در یک مسیر واحد اجرا شوند و شکست هر مرحله pipeline را متوقف کند.

## دروازه محلی

فرمان `npm run verify` مراحل زیر را به‌ترتیب اجرا می‌کند:

1. `npm run lint:ci`
2. `npm run typecheck` (تولید typeهای route با `next typegen` و سپس TypeScript)
3. `npm test`
4. `npm run db:validate`
5. `npm run build`

فرمان `npm test` هر چهار مجموعه امنیت، قرارداد API، گردش‌کار و مالی را اجرا می‌کند. نصب dependency با `npm ci` و lockfile انجام می‌شود و `postinstall` فقط Prisma Client را به‌صورت قطعی تولید می‌کند.

## CI

workflow مستقل `.github/workflows/quality.yml` برای هر push، pull request و اجرای دستی تعریف شد. محیط CI:

- Node.js 20 مطابق حداقل نسخه پشتیبانی‌شده Next.js 16؛
- دسترسی repository فقط به‌صورت read؛
- لغو اجرای قدیمی همان branch با concurrency؛
- cache رسمی npm و `.next/cache`؛
- نصب با `npm ci`؛
- اجرای دروازه کامل کیفیت؛
- رد آسیب‌پذیری production با شدت high یا critical.

مقادیر CI داخل workflow ساختگی و محدود به همان job هستند و secret واقعی repository محسوب نمی‌شوند.

## baseline بدهی lint

پیش از فاز هشت lint کل مخزن ۱۱۱ خطا و ۷۶ هشدار داشت. بخش عمده آن مربوط به صفحه‌های client قدیمی، `any`، الگوی fetch داخل effect و importهای بلااستفاده است. برای جلوگیری از خاموش‌کردن یا پنهان‌شدن این بدهی:

- قواعد همچنان فعال و تمام موارد قابل مشاهده‌اند؛
- خطاهای legacy UI موقتاً به warning تبدیل شده‌اند؛
- سقف CI روی ۱۸۷ warning ثابت شده است؛
- هر lint error یا افزایش تعداد warningها pipeline را شکست می‌دهد؛
- این baseline مجوز افزودن بدهی جدید نیست و باید در فاز پاک‌سازی UI کاهش پیدا کند.

## نتیجه کنترل محلی

- نصب تمیز `npm ci`: موفق، ۷۱۲ package بررسی شد.
- dependency audit: صفر آسیب‌پذیری شناخته‌شده.
- lint: صفر error و ۱۸۷ warning در baseline.
- typecheck: موفق.
- تست‌ها: ۴۵ از ۴۵ موفق.
- `prisma validate`: موفق.
- build تولیدی Next.js 16.3.4: موفق، ۶۴ route.

## محدودیت‌های باقی‌مانده

- اجرای hosted workflow به اتصال repository به GitHub وابسته است؛ remote روی میزبان فعلی تنظیم نشده است.
- جلوگیری قطعی از merge نیازمند فعال‌کردن branch protection و required check با نام `Lint, types, tests, schema, build` است.
- integration test با MySQL پاک و اجرای migrationها پس از تکمیل baseline migration در `OPS-04` اضافه می‌شود؛ این بخش همراه با staging و rollout در فاز عملیاتی بعدی بسته خواهد شد.
- ۱۸۷ warning قدیمی باید به‌تدریج کاهش یابد و سقف `lint:ci` هم‌زمان پایین آورده شود.

## وضعیت خروج

دروازه محلی و تعریف CI آماده و سبز است. `OPS-06` از نظر repository پیاده شده و فعال‌سازی required check در سامانه میزبانی کد، اقدام خارجی باقی‌مانده است.
