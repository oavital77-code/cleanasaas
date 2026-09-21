#!/usr/bin/env bash
# מקים בסיס נתונים נקי, מריץ את השים + כל המיגרציות + כל בדיקות ה-SQL, ומוחק.
# עוצר בשגיאה הראשונה. דורש psql מקומי (postgres רגיל, לא Supabase).
#
#   supabase/tests/run.sh            # בסיס זמני, נמחק בסוף
#   KEEP=1 supabase/tests/run.sh     # משאיר אותו לבדיקה ידנית
set -euo pipefail

DB="${DB:-cleanasaas_test_$$}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -q --no-psqlrc -d "$DB")

cleanup() { [[ -n "${KEEP:-}" ]] || dropdb --if-exists "$DB"; }
trap cleanup EXIT

createdb "$DB"
"${PSQL[@]}" -f "$ROOT/supabase/tests/local_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done

# אין הרצה שנייה של השים: ה-`alter default privileges` שבו כבר מכסה כל טבלה
# שמיגרציה יוצרת אחריו, והרצה שנייה הייתה מחזירה `grant execute on all
# functions` — כלומר מבטלת את ה-revoke שמיגרציות עושות בכוונה על פונקציות
# של service_role בלבד. identity_test.sql הוא מה שתופס את זה.

for t in "$ROOT"/supabase/tests/*_test.sql; do
  echo "== $(basename "$t")"
  "${PSQL[@]}" -f "$t"
done

echo "== all schema tests passed"
