# בדיקת הסכמה מקומית (בלי פרויקט Supabase)

`local_shim.sql` יוצר את החלקים המינימליים מ-`auth`/`storage`/`vault` שה-migrations
תלויות בהם (auth.users/auth.uid()/auth.role()/**auth.jwt()**, storage.buckets/objects,
publication, **pgcrypto ב-`extensions`** ו-**Vault** עבור הצפנת סודות ה-Woo), כולל
roles `anon`/`authenticated`/`service_role` עם ה-GRANTs שסופאבייס נותנת כברירת
מחדל (RLS, לא GRANT, הוא מה שאמור להגביל).

פקודה אחת מקימה בסיס נקי, מריצה שים + כל המיגרציות + כל בדיקות ה-SQL, ומוחקת:

```bash
supabase/tests/run.sh          # KEEP=1 משאיר את הבסיס לבדיקה ידנית
```

או ידנית:

```bash
createdb cleanasaas_test
psql -d cleanasaas_test -f supabase/tests/local_shim.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d cleanasaas_test -f "$f"; done
psql -d cleanasaas_test -f supabase/tests/isolation_test.sql
```

`isolation_test.sql` מריץ הכל בתוך `begin...rollback` (לא משאיר נתונים),
עם `set role authenticated` כדי שה-RLS *באמת* נאכפת (לא עוקפים אותה בגלל
בעלות טבלה) — בדיוק כמו שהמפרט דורש ("בדיקת קבלה: פרופיל מדומה בקליניקה A
לא יכול, גם עם באג בקוד האפליקציה, לקרוא/לכתוב שורה עם clinic_id של קליניקה
B"). הוא מקים שתי קליניקות ומוודא:

- הזמנת חדר של קליניקה אחרת דרך `create_booking` נחסמת (לא רק RLS — בדיקת
  clinic_id מפורשת בתוך ה-RPC עצמה).
- `public_availability` לא מדליפה הזמנות בין קליניקות.
- RLS על `profiles`/`rooms` לא מדליפה שורות בין קליניקות.
- אותו מספר טלפון מותר בשתי קליניקות שונות (התיקון ל-`unique(phone)` הגלובלי).
- מטפל/עלים/ת לא יכול/ה להעלות לעצמו/ה הרשאה (role) או "לעבור" קליניקה
  (`clinic_id`) דרך UPDATE ישיר על השורה שלו/ה — **הבדיקה הזו תפסה באג
  אמיתי בפיתוח**: ה-trigger המקורי בדק `is_admin()` (שנכון גם על השורה של
  ה-owner עצמו) במקום `id = auth.uid()` (עריכה עצמית), מה שאיפשר ל-owner
  בהרשמה עצמאית להעניק לעצמו הרשאות. תוקן — ר' היסטוריית הקומיטים.

**להריץ שוב אחרי כל שינוי ב-RLS/RPC.** זו לא בדיקת יחידה חד-פעמית —
היקף המערכת (72+ פונקציות במקור, כאן בבנייה מחדש) הופך רגרסיה כזו לזולה
הרבה יותר לתפוס כאן מאשר בפרודקשן.
