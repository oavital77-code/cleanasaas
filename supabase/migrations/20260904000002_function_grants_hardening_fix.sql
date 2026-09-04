-- Cleana SaaS — תיקון migration הקודמת: REVOKE FROM anon לא מספיק
--
-- 🔴 גילוי: PostgreSQL מעניק EXECUTE ל-PUBLIC (הפסאודו-role שכולל את כולם,
-- כולל anon/authenticated) אוטומטית ב-CREATE FUNCTION. "revoke ... from
-- anon" לא מסיר את זה — anon עדיין ירש EXECUTE דרך PUBLIC. אימות בפועל
-- (has_function_privilege('anon', ...)) אחרי ה-migration הקודמת עדיין
-- החזיר true. התיקון הנכון: REVOKE FROM PUBLIC (מסיר את ברירת המחדל
-- הגורפת), ואז GRANT מפורש רק לתפקידים שבאמת צריכים.

-- ═══ קבוצה 1: RPCs עסקיים — מסיר PUBLIC, מחזיר ל-authenticated בלבד
-- (anon לעולם לא קורא ל-RPC לפני login; service_role עוקף grants ברמת
-- role attribute משלו וממשיך לעבוד ללא צורך ב-GRANT מפורש). ═══
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
from public;

grant execute on function
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
to authenticated;

-- ═══ קבוצה 2: עוזרים פנימיים בלבד — מסיר PUBLIC לגמרי, בלי להחזיר לאף
-- role חיצוני. קריאה פנימית מפונקציה אחרת ממשיכה לעבוד (רצה בהרשאות ה-owner). ═══
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
from public;

-- ═══ current_clinic_id/is_admin/is_superadmin: לא נוגעים בהם — משמשים
-- בתוך ביטויי RLS POLICY עצמם, לשני התפקידים. אין להריץ עליהם REVOKE FROM
-- PUBLIC בשום migration עתידית בלי לבדוק קודם שאף policy לא נשען עליהם. ═══
