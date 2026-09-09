-- אותה תקלה כמו 20260904000002 / 20260906200000 / 20260907000001, פעם רביעית:
-- 20260909000001 עשתה `revoke ... from anon` (ו-authenticated לפונקציות ה-service)
-- אבל לא `from public` — ו-EXECUTE ל-PUBLIC שניתן כברירת מחדל נשאר, ולכן
-- has_function_privilege('anon', ...) עדיין החזיר true על כל ארבע הפונקציות.
-- כולן בודקות is_admin() / auth.role() = 'service_role' בפנים (anon נופל על
-- FORBIDDEN) — סגירת חשיפה, לא פרצה פתוחה. כאן: revoke מ-public+anon
-- (+authenticated ל-service בלבד), ואז grant מפורש למי שצריך.
--
-- לקח (נוסח סופי): לכל RPC חדש — `revoke all ... from public, anon;` ואז
-- `grant execute ... to authenticated` (או service_role) במפורש. לא רק from anon.

revoke all on function
  platform_start_checkout(text),
  platform_request_cancellation()
from public, anon;
grant execute on function
  platform_start_checkout(text),
  platform_request_cancellation()
to authenticated, service_role;

revoke all on function
  platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, jsonb),
  platform_billing_lifecycle()
from public, anon, authenticated;
grant execute on function
  platform_apply_payment(uuid, text, text, numeric, numeric, text, text, text, jsonb),
  platform_billing_lifecycle()
to service_role;
