-- grant_bonus_hours היה זמין לאדמין/בעלים בלי שום הגבלה — ר' PROGRESS.md,
-- "מסמכי ToS/DPA + admin actions מסוכנות ל-self-serve": צריך להחליט בין
-- (א) הסרת "שעות מתנה" ל-MVP הרב-דיירי, או (ב) cap קשיח + audit בולט +
-- חסימה בזמן trial. נבחרה אופציה (ב) — הפיצ'ר עצמו שימושי (למשל פיצוי
-- מטפל/ת), רק בלי הגבלה הוא וקטור ל-self-dealing: אדמין/ית יכול/ה
-- להעניק לעצמו/ה או למטפל/ת שקשור/ה אליו/ה שעות חדר בלתי מוגבלות בחינם.
--
-- 1. cap קשיח: עד 20 שעות בפעולה בודדת (ולא צבירה חופשית — מי שצריך יותר,
--    יבקש שוב, מה שמייצר יותר שורות audit_log ולא פחות שקיפות).
-- 2. חסימה בזמן trial: קליניקה שעדיין לא שילמה כלום ל-Cleana לא צריכה
--    להיות מסוגלת "לייצר" ערך בחינם למטפלים שלה לפני שהוכיחה תשלום אמיתי.
-- 3. audit בולט: נשאר אותו audit_log (bonus_hours_granted) — "בולט" מטופל
--    בצד ה-UI (app/(admin)/admin/audit/page.tsx, ALERT_ACTIONS).
create or replace function grant_bonus_hours(p_user_id uuid, p_hours numeric, p_note text)
returns table(punch_card_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_target_clinic uuid;
  v_card_id uuid;
  v_plan text;
begin
  select clinic_id into v_clinic_id from profiles where id = app_user_id();
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_hours is null or p_hours <= 0 then
    raise exception 'INVALID_SLOT';
  end if;
  if p_hours > 20 then
    raise exception 'BONUS_HOURS_CAP_EXCEEDED';
  end if;

  select plan into v_plan from platform_subscriptions where clinic_id = v_clinic_id;
  if v_plan = 'trial' then
    raise exception 'BONUS_HOURS_BLOCKED_DURING_TRIAL';
  end if;

  select clinic_id into v_target_clinic from profiles where id = p_user_id;
  if v_target_clinic is null or v_target_clinic <> v_clinic_id then
    raise exception 'FORBIDDEN';
  end if;

  insert into punch_cards (
    clinic_id, user_id, tier_id, hours_purchased, hours_remaining,
    price_per_hour, deposit_amount, deposit_remaining, expires_at, active
  ) values (
    v_clinic_id, p_user_id, null, p_hours, p_hours, 0, 0, 0, now() + interval '24 months', true
  ) returning id into v_card_id;

  insert into audit_log (clinic_id, actor_id, action, entity, entity_id, after)
  values (v_clinic_id, app_user_id(), 'bonus_hours_granted', 'punch_cards', v_card_id,
          jsonb_build_object('user_id', p_user_id, 'hours', p_hours, 'note', p_note));

  return query select v_card_id;
end;
$$;
