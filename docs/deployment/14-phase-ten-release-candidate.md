# گزارش اجرای فاز ده: Release Candidate و تصمیم Go/No-Go

## تعریف فاز نهایی

فاز ده مرحله جمع‌بندی Release Candidate است: شواهد فازهای قبلی به معیارهای پذیرش PRD متصل می‌شوند، یک smoke gate بدون تغییر داده روی artifact مستقر اجرا می‌شود و تصمیم انتشار برای هر سطح به‌صورت صریح `GO` یا `NO-GO` ثبت می‌گردد. این فاز جایگزین تصویب محصول، مالی، حقوقی یا زیرساخت نیست.

## خروجی‌های اجرایی

- `scripts/release-smoke.mjs` پنج کنترل read-only را روی نسخه مستقر اجرا می‌کند.
- `scripts/release-smoke.test.mjs` مسیر قبولی و رد Release Candidate را به‌صورت deterministic پوشش می‌دهد.
- فرمان `npm run release:smoke` برای اجرای یکسان محلی، staging و production اضافه شد.
- workflow دستی `Release Candidate Smoke` فقط مقصد HTTPS و release ID مورد انتظار را می‌پذیرد و می‌تواند به protected environment مربوط به staging یا production متصل شود.
- smoke gate در صورت شکست هر کنترل exit code غیرصفر برمی‌گرداند و بنابراین امکان عبور خاموش از gate وجود ندارد.

## کنترل‌های smoke gate

| کنترل | انتظار | پوشش |
|---|---|---|
| Liveness | پاسخ ۲۰۰، `status=ok`، release ID دقیق و نبود `X-Powered-By` | هویت artifact و زنده‌بودن process |
| Readiness | پاسخ ۲۰۰ و `status=ready` | اتصال dependency ضروری، فعلاً MySQL |
| API ناشناس | پاسخ ۴۰۱ با قرارداد `UNAUTHORIZED` و correlation ID | بخشی از AC-01 و OPS-01 |
| صفحه محافظت‌شده | redirect به `/login` | جلوگیری از مشاهده پنل بدون session |
| مسیر upload عمومی | پاسخ ۴۰۴ | جلوگیری از انتشار مستقیم مدرک محرمانه |

این کنترل‌ها عمداً mutation تجاری انجام نمی‌دهند و برای اجرای مکرر امن هستند. آزمون کامل AC-02 تا AC-07 باید با fixture کنترل‌شده و نقش‌های واقعی در staging انجام شود.

## نتایج اجرای محلی

- smoke gate روی سرور توسعه و سپس روی artifact واقعی standalone در حالت production متصل به MySQL: در هر دو اجرا پنج کنترل از پنج کنترل `PASS`.
- تست‌های خود smoke gate: مسیر سالم و دو شکست مهم readiness/release mismatch هر دو موفق.
- `npm run verify`: موفق؛ ۵۱ تست از ۵۱ تست، typecheck، Prisma validation و standalone build موفق.
- lint: صفر error و baseline موجود ۱۸۷ warning.
- وضعیت دیتابیس توسعه: هر شش migration ثبت‌شده اعمال شده‌اند.

## ماتریس Go/No-Go

| سطح انتشار | تصمیم فعلی | دلیل |
|---|---|---|
| A - توسعه | `GO` | build، تست‌ها، health و smoke gate محلی سبز هستند. |
| B - staging | `NO-GO` | مقصد staging و baseline migration دیتابیس خالی آماده نیست و restore drill انجام نشده است. |
| C - پایلوت محدود | `NO-GO` | علاوه بر موانع staging، object storage خصوصی، alerting مرکزی، UAT مالی/حقوقی و تصمیم‌های D-018 تا D-022 بسته نشده‌اند. |
| D - production عمومی | `NO-GO` | معیارهای توقف انتشار در محدوده، backup/restore، rollback، امنیت و تصویب‌های کسب‌وکار هنوز کامل نیستند. |

## موانع قطعی انتشار

1. اولین migration موجود با `ALTER TABLE` آغاز می‌شود و یک دیتابیس خالی را از صفر ایجاد نمی‌کند؛ `OPS-04` هنوز کامل نیست.
2. `D-020` باز است؛ provider، region، network topology، TLS termination و مقصد MySQL تعیین نشده‌اند.
3. adapter مدارک هنوز filesystem محلی است؛ `D-018` و storage خصوصی دارای URL زمان‌دار تکمیل نشده‌اند.
4. restore واقعی روی دیتابیس مجزا اجرا نشده و RPO/RTO در `D-021` تصویب نشده است.
5. retention داده مالی، حقوقی و audit در `D-022` باز است.
6. نمونه مرجع مالی و تصمیم‌های D-006 تا D-014 به‌طور کامل تصویب نشده‌اند؛ بنابراین برابری مبلغ با مرجع رسمی UAT قابل اعلام نیست.
7. PR-14 در حالت feature flag خاموش باقی مانده و PR-16/PR-17 برای پوشش کامل نمایندگی و audit سراسری هنوز gate نهایی ندارند.
8. Docker image روی میزبان فعلی اجرا نشده، چون Docker CLI نصب نیست؛ workflow ساخت آن تعریف شده ولی اجرای hosted آن به remote نیاز دارد.

## روش اجرای gate روی نسخه مستقر

دو مقدار زیر باید توسط محیط اجرا تزریق شوند:

- `BASE_URL`: origin نسخه مستقر؛ در workflow فقط HTTPS پذیرفته می‌شود.
- `EXPECTED_RELEASE_ID`: همان شناسه تغییرناپذیری که هنگام build و deployment به نسخه داده شده است.

سپس `npm run release:smoke` اجرا می‌شود. تنها نتیجه `PASS` با پنج کنترل موفق اجازه ادامه به UAT را می‌دهد؛ این نتیجه به‌تنهایی مجوز production نیست.

## جمع‌بندی

بخش فنی و قابل اجرای فاز ده تکمیل شده و Release Candidate اکنون gate خودکار و تکرارپذیر دارد. نتیجه رسمی این اجرا برای repository و سطح توسعه `GO`، و برای staging، پایلوت و production تا رفع موانع ثبت‌شده `NO-GO` است. این توقف مطابق معیارهای انتشار پروژه است و نباید با bypass کردن health، migration یا approvalها دور زده شود.
