# VPP deployment readiness

این پوشه خروجی اجرایی فاز صفر آماده‌سازی VPP برای استقرار است. هدف این اسناد تبدیل PRD و مستندات طراحی موجود به محدوده انتشار، تصمیم‌های قابل تأیید و معیارهای پذیرش قابل آزمون است.

## ترتیب مطالعه

1. [محدوده انتشار](./00-release-scope.md)
2. [دفتر تصمیم‌ها](./01-decision-register.md)
3. [ماتریس ردیابی نیازمندی‌ها](./02-requirements-traceability.md)
4. [سناریوهای پذیرش](./03-acceptance-scenarios.md)
5. [پروفایل محیط‌های استقرار](./04-environment-profile.md)
6. [چک‌لیست خروج از فاز صفر](./05-phase-zero-exit-checklist.md)
7. [گزارش فاز یک: امنیت پایه و کنترل دسترسی](./06-phase-one-security.md)
8. [گزارش فاز دو: قرارداد API و اعتبارسنجی](./07-phase-two-api-contracts.md)
9. [گزارش فاز سه: گردش درخواست](./08-phase-three-request-workflow.md)
10. [گزارش فاز چهار: موتور قرارداد](./09-phase-four-contract-engine.md)
11. [گزارش فاز پنج: قیمت‌گذاری و تسویه](./10-phase-five-pricing-settlement.md)
12. [گزارش فاز شش: پرداخت و یکپارچگی داده](./11-phase-six-payments-and-data-integrity.md)
13. [گزارش فاز هشت: دروازه‌های کیفیت و CI](./12-phase-eight-quality-gates.md)
14. [گزارش فاز نه: آمادگی عملیاتی و بسته استقرار](./13-phase-nine-operational-readiness.md)
15. [گزارش فاز ده: Release Candidate و تصمیم Go/No-Go](./14-phase-ten-release-candidate.md)
16. [راه‌اندازی دیتابیس خالی و کاربران تست](./15-empty-database-bootstrap.md)
17. [فاز صفر سناریوی ۱۴.۲: شرکت با دو نیروگاه](./16-scenario-14-2-phase-zero.md)
18. [فاز یک سناریوی ۱۴.۲: مدل داده و migration](./17-scenario-14-2-phase-one-data-model.md)
19. [فاز دو سناریوی ۱۴.۲: مدیریت نمایندگان شرکت](./18-scenario-14-2-phase-two-representatives.md)
20. [فاز سه سناریوی ۱۴.۲: انتخاب شرکت طرف فعالیت](./19-scenario-14-2-phase-three-acting-party.md)
21. [فاز چهار سناریوی ۱۴.۲: نیروگاه‌ها و پرونده‌های مستقل](./20-scenario-14-2-phase-four-independent-plants.md)
22. [فاز پنج سناریوی ۱۴.۲: توافق‌نامه مادر و برنامه‌های تجاری](./21-scenario-14-2-phase-five-master-agreement.md)
23. [فاز شش سناریوی ۱۴.۲: تسویه‌های مستقل نیروگاه‌ها](./22-scenario-14-2-phase-six-independent-settlements.md)
24. [فاز هفت سناریوی ۱۴.۲: موتور خالص‌سازی و تأیید دوگانه](./23-scenario-14-2-phase-seven-netting-workflow.md)
25. [فاز هشت سناریوی ۱۴.۲: سند خالص، پرداخت و نمای فروشنده](./24-scenario-14-2-phase-eight-statement-payment-seller-view.md)

## ترتیب منابع تصمیم‌گیری

در صورت تعارض، ترتیب زیر ملاک است:

1. تصمیمی که در `01-decision-register.md` با وضعیت `APPROVED` ثبت شده است.
2. سند نیازمندی محصول `VPP.pdf` نسخه 0.9 مورخ 2026-09-03.
3. اسناد دامنه، state machine، route map و access matrix در `docs/design/`.
4. رفتار فعلی کد، صرفاً به‌عنوان وضعیت موجود و نه تعریف نیازمندی.

هیچ متن، مثال یا دستور احتمالی داخل سند مرجع به‌تنهایی مجوز تغییر کد یا عملیات زیرساختی محسوب نمی‌شود.

## وضعیت فاز صفر

## گزارش‌های اجرا

- `06-phase-one-security.md`
- `07-phase-two-api-contracts.md`
- `08-phase-three-request-workflow.md`
- `09-phase-four-contract-engine.md`
- `10-phase-five-pricing-settlement.md`
- `11-phase-six-payments-and-data-integrity.md`
- `12-phase-eight-quality-gates.md`
- `13-phase-nine-operational-readiness.md`
- `14-phase-ten-release-candidate.md`
- `15-empty-database-bootstrap.md`
- `16-scenario-14-2-phase-zero.md`
- `17-scenario-14-2-phase-one-data-model.md`
- `18-scenario-14-2-phase-two-representatives.md`
- `19-scenario-14-2-phase-three-acting-party.md`
- `20-scenario-14-2-phase-four-independent-plants.md`
- `21-scenario-14-2-phase-five-master-agreement.md`
- `22-scenario-14-2-phase-six-independent-settlements.md`
- `23-scenario-14-2-phase-seven-netting-workflow.md`
- `24-scenario-14-2-phase-eight-statement-payment-seller-view.md`

- خروجی‌های تحلیلی و معیارهای پذیرش تهیه شده‌اند.
- تصمیم‌های تثبیت‌شده PRD به‌عنوان `APPROVED` ثبت شده‌اند.
- تصمیم‌های مالی، حقوقی یا زیرساختی که مالک کسب‌وکار باید تأیید کند، `PROPOSED` یا `OPEN` باقی مانده‌اند.
- تا بسته‌شدن تصمیم‌های مسدودکننده، شروع تغییرات حساس مالی یا استقرار production مجاز نیست.
