-- שעות פעילות per-clinic — היו קבועות בקוד (DAY_START_HOUR=8/DAY_END_HOUR=22,
-- lib/calendar.ts) לכל הקליניקות. ר' PROGRESS.md, "מגבלות ידועות".
-- ברמת קליניקה בלבד, לא per-branch (כמו timezone שכבר קיים ברמת קליניקה) —
-- זה כבר שיפור אמיתי על "קבוע בקוד", ופיצול ל-branch הוא הרחבה נפרדת אם
-- תידרש בפועל (היום אין עדיין שום UI/RPC שמבדיל התנהגות בין סניפים חוץ
-- מ-room_id עצמו).
alter table clinics
  add column open_hour smallint not null default 8,
  add column close_hour smallint not null default 22;

alter table clinics
  add constraint clinics_operating_hours_check
  check (open_hour >= 0 and open_hour < 24 and close_hour > open_hour and close_hour <= 24);
