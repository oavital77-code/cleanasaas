-- Cleana SaaS — הקשחת הרשאות EXECUTE על RPCs, לפי ממצאי get_advisors (security)
--
-- Supabase מעניקה EXECUTE אוטומטית ל-anon+authenticated על כל פונקציה
-- ב-schema public כברירת מחדל — גם ל-46 ה-RPCs שלנו, כולל כאלה שאף פעם לא
-- אמורים להיקרא לפני login (anon) או בכלל לא ישירות ע"י client (עוזרים
-- פנימיים/cron). כל פונקציה כאן כבר בודקת הרשאה בעצמה (auth.uid() is null →
-- FORBIDDEN, is_admin(), assert_service_or_admin()) — זו לא חולשה פעילה,
-- אבל צמצום שטח החשיפה הוא תרגול בריאות שה-linter ממליץ עליו.
--
-- 🔴 שלוש הפונקציות is_admin/is_superadmin/current_clinic_id מוחרגות
-- במפורש ולא נוגעים בהן: הן משמשות בתוך ביטויי RLS POLICY (לא רק כ-RPC),
-- וה-EXECUTE grant על שני התפקידים (anon+authenticated) חובה כדי שהערכת
-- ה-policy עצמה לא תיפול עם "permission denied for function" בכל query
-- בכל טבלה. גם assert_service_or_admin/assert_within_plan_quota וטריגרים
-- לא נמצאים בשום ביטוי RLS — בטוח להסיר מהם execute משני התפקידים (קריאה
-- פנימית מתוך פונקציית SECURITY DEFINER אחרת ממשיכה לעבוד: היא רצה
-- בהרשאות ה-owner, לא בהרשאות ה-role שקרא לפונקציה החיצונית).

-- ═══ קבוצה 1: RPCs עסקיים לקוחות — דורשים משתמש מחובר בפועל. anon מוסר. ═══
revoke execute on function
  accept_therapist_invite(uuid, text, text),
  admin_activate_session_cash_payment(uuid, payment_method, text),
  admin_adjust_punch_card_hours(uuid, numeric, text),
  admin_cancel_booking(uuid, boolean),
  admin_complete_deposit(uuid),
  admin_create_booking(uuid, uuid, timestamptz, timestamptz, text),
  admin_create_session(uuid, jsonb, date, integer),
  admin_create_session_prepaid(uuid, jsonb, date, integer),
  admin_end_session_term(uuid),
  admin_mark_session_recurring_paid_cash(uuid, payment_method, text),
  admin_renew_session_term(uuid, integer),
  approve_session(uuid, integer),
  cancel_booking(uuid),
  claim_woo_pending_purchase(),
  create_booking(uuid, timestamptz, timestamptz),
  create_branch(text, text, text, text),
  create_room(uuid, text, room_type[], int, text, jsonb),
  create_session_initial_payment(uuid),
  create_therapist_invite(user_role),
  grant_bonus_hours(uuid, numeric, text),
  initiate_session_renewal_payment(uuid),
  preview_overrun(uuid, int),
  record_overrun(uuid, int, text),
  reject_session(uuid, text),
  request_session(jsonb, date),
  request_subscription_cancellation(uuid),
  signup_clinic(text, text, text, text),
  superadmin_list_clinics(),
  superadmin_set_clinic_status(uuid, clinic_status, text),
  superadmin_set_plan(uuid, text, text, timestamptz)
from anon;

-- ═══ קבוצה 2: עוזרים פנימיים/cron/webhook בלבד — לא בשום ביטוי RLS.
-- מוסר גם מ-authenticated: לקוח אף פעם לא אמור לקרוא להם ישירות (הם
-- נקראים רק מבפנים ע"י RPCs אחרים, שרצים בהרשאות ה-owner). ═══
revoke execute on function
  activate_session_payment(uuid, text, payment_method, text, text, text, text),
  assert_service_or_admin(),
  assert_within_plan_quota(uuid, text),
  emit_booking_availability_event(),
  emit_room_block_availability_event(),
  enforce_clinic_privilege_columns(),
  enforce_profile_privilege_columns(),
  expire_session_holds_and_cancellations(),
  expire_trial_subscriptions(),
  finalize_overrun_charge(uuid, boolean, text, text),
  finalize_session_renewal(uuid, boolean, text, text, text, payment_method),
  materialize_session_bookings(),
  materialize_subscription_bookings(uuid, int)
from anon, authenticated;
