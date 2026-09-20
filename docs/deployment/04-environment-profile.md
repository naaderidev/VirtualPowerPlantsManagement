# پروفایل محیط‌ها و استقرار

این سند provider خاصی را تحمیل نمی‌کند. انتخاب نهایی مقصد در تصمیم `D-020` ثبت می‌شود.

## 1. محیط‌ها

| محیط | داده | دسترسی | migration | اعلان بیرونی | هدف |
|---|---|---|---|---|---|
| Development | ساختگی | محلی | آزاد برای توسعه | خاموش یا sandbox | توسعه روزانه |
| Test/CI | fixture کوتاه‌عمر | فقط CI | از صفر در هر run | کاملاً mock | تست خودکار |
| Staging | غیرحساس و شبیه واقعی | تیم و UAT | همان artifact production | sandbox | پذیرش و تمرین انتشار |
| Production | واقعی | least privilege | کنترل‌شده و ثبت‌شده | واقعی | عملیات کسب‌وکار |

نباید یک database، bucket، secret یا حساب سرویس بین staging و production مشترک باشد.

## 2. اجزای حداقلی

- Runtime سازگار با Next.js 16 و Node.js LTS پشتیبانی‌شده توسط نسخه نصب‌شده.
- MySQL مدیریت‌شده یا دارای backup و monitoring معتبر.
- object storage خصوصی برای مدارک و خروجی‌های حساس.
- HTTPS و DNS مدیریت‌شده.
- سرویس ارسال اعلان، در صورت فعال‌بودن کانال بیرونی.
- central logging و error tracking.
- scheduler قابل اتکا برای transitionهای زمانی و یادآوری‌ها.

## 3. پیکربندی و secretها

نام دقیق متغیرها هنگام پیاده‌سازی تثبیت می‌شود، اما دسته‌های زیر الزامی‌اند:

- اتصال دیتابیس.
- secret و URL احراز هویت.
- origin عمومی برنامه.
- اطلاعات object storage.
- تنظیمات ایمیل/SMS در صورت فعال‌بودن.
- feature flagهای netting، import کنتور، امضای بیرونی و درگاه پرداخت.
- environment name و release identifier.
- تنظیمات error tracking و observability.

قواعد:

- secret واقعی در repository، فایل نمونه یا log ذخیره نشود.
- برنامه در startup نبودن یا نامعتبر بودن پیکربندی ضروری را اعلام و متوقف کند.
- مقدار production نباید fallback توسعه داشته باشد.
- فایل `.env.example` فقط نام و توضیح متغیرها را داشته باشد.

## 4. build و artifact

- نصب dependency با lockfile و حالت frozen انجام شود.
- font و asset ضروری self-hosted باشند؛ build نباید برای Google Fonts به شبکه وابسته باشد.
- یک artifact ساخته شود و همان artifact از staging به production ارتقا یابد.
- در artifact کد منبع secret، seed demo یا upload محلی قرار نگیرد.
- نسخه برنامه، commit و زمان build قابل مشاهده باشند.

## 5. ترتیب pipeline پیشنهادی

1. نصب dependency از lockfile.
2. بررسی format در صورت تعریف formatter.
3. lint.
4. typecheck.
5. unit test.
6. integration test با MySQL موقت.
7. production build.
8. بررسی migration و schema drift.
9. security/dependency scan.
10. انتشار artifact در staging.
11. smoke test و UAT gate.
12. تأیید انسانی برای production.
13. اجرای migration کنترل‌شده.
14. rollout تدریجی و health check.

## 6. migration و rollback

- migration باید backward-compatible یا دارای برنامه انتشار چندمرحله‌ای باشد.
- پیش از migration پرریسک backup گرفته شود.
- تغییر نوع مبلغ از Float به Decimal ابتدا روی snapshot staging آزمایش شود.
- rollback برنامه نباید به rollback کور دیتابیس متکی باشد؛ در تغییرات ناسازگار از forward-fix استفاده شود.
- schema drift در production مانع انتشار باشد.

## 7. health و observability

### Health check

- liveness: process پاسخ می‌دهد.
- readiness: dependencyهای ضروری مانند دیتابیس آماده‌اند.
- health response نباید connection string یا اطلاعات حساس را افشا کند.

### Logging

- log ساختاریافته با timestamp، level، environment، release و correlation ID.
- actor و entity برای عملیات حساس.
- عدم ثبت رمز، token، متن کامل مدارک یا داده بانکی حساس.

### متریک‌های اولیه

- نرخ و زمان پاسخ API.
- خطاهای 4xx و 5xx به تفکیک route.
- تعداد login ناموفق.
- jobهای ناموفق و عقب‌افتاده.
- تسویه‌های ناموفق یا تکراری.
- قراردادها و پیشنهادهای نزدیک انقضا.
- ظرفیت اتصال دیتابیس و زمان queryهای کند.

## 8. backup و بازیابی

پیشنهاد پایه تا زمان تصویب D-021:

- backup روزانه دیتابیس.
- point-in-time recovery در صورت پشتیبانی سرویس.
- versioning یا retention مناسب object storage.
- نگهداری backup در failure domain جدا.
- تمرین restore دوره‌ای در staging.
- ثبت زمان واقعی restore و مقایسه با RTO.

## 9. امنیت شبکه و runtime

- MySQL مستقیماً روی اینترنت عمومی نباشد.
- دسترسی دیتابیس با کاربر least-privilege انجام شود.
- TLS برای ارتباطات بیرونی الزامی باشد.
- security headers و محدودیت اندازه request فعال باشند.
- rate limit برای login، upload و عملیات مالی در نظر گرفته شود.
- دسترسی ادمین در صورت نیاز با allowlist یا کنترل دسترسی سازمانی محدود شود.

## 10. شرایط انتخاب مقصد استقرار

مالک زیرساخت باید گزینه انتخابی را بر اساس این معیارها ثبت کند:

- پشتیبانی واقعی از Next.js runtime موردنیاز.
- شبکه خصوصی یا اتصال امن به MySQL.
- object storage خصوصی و signed URL.
- backup و restore قابل آزمون.
- scheduler و job execution قابل اتکا.
- central logs، metrics و alerting.
- هزینه، محل جغرافیایی داده و الزامات قانونی.
- rollback و rollout تدریجی.

