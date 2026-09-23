-- פניות מדף הנחיתה. עד עכשיו הדרך היחידה להתעניין במוצר הייתה להירשם
-- ולפתוח קליניקה — מי שרצה לשאול קודם פשוט עזב, ולא נשאר שום זכר לכך.
--
-- ליד אינו שייך לאף קליניקה (הוא קודם לה), ולכן הטבלה היא טבלת פלטפורמה
-- כמו platform_admins — בלי clinic_id ובלי המדיניות הרגילה.
--
-- 🔴 RLS פעילה בלי אף מדיניות = דחייה מוחלטת ל-anon ול-authenticated,
-- בדיוק כמו שאר טבלאות הפלטפורמה. הכתיבה (הטופס הציבורי) והקריאה
-- (דשבורד הבעלים) עוברות דרך service role בלבד, שעוקף RLS. ה-revoke
-- הוא שכבה שנייה: גם אם מישהו יוסיף מדיניות בטעות, אין GRANT.
create table if not exists platform_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  phone         text not null,
  email         text,
  clinic_name   text,
  message       text,
  /** איזה עמוד שלח — 'cleanas' היום, 'cleana-plus' כשגם שם יהיה טופס. */
  source        text not null default 'cleanas',
  /** new → contacted → qualified → won / lost. טקסט ולא enum: זו רשימה שתשתנה. */
  status        text not null default 'new',
  notes         text,
  handled_at    timestamptz,
  handled_by    uuid references profiles(id) on delete set null
);

alter table platform_leads enable row level security;

revoke all on table platform_leads from anon, authenticated;
grant all on table platform_leads to service_role;

-- הדשבורד מציג את החדשים ראשונים.
create index if not exists platform_leads_created_at_idx on platform_leads (created_at desc);
