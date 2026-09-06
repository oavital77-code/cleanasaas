import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

// 🔴 user.created לא מטופל כאן, בכוונה — בניגוד לדוגמת Click-na (שהיא
// single-tenant, כל signup יוצר ישר חשבון). ב-cleanasaas יצירת פרופיל
// עוברת תמיד דרך signup_clinic/join_clinic_as_therapist/
// accept_therapist_invite — ל-RPCs האלה יש הקשר עסקי (שם קליניקה, טוקן
// הזמנה, role) שה-webhook הגולמי של Clerk לא מכיר בכלל. טיפול כאן היה
// יוצר פרופיל יתום בלי clinic_id, לפני שהמשתמש/ת בכלל עבר/ה את זרימת
// ההרשמה/הצטרפות בפועל.
//
// user.deleted כן מטופל: מקרה קצה נדיר (מחיקת חשבון ישירות מדשבורד/API
// של Clerk, לא דרך cleanasaas) שמשאיר clerk_user_id "יתום" על הפרופיל.
// clear_clerk_identity (מיגרציה 20260906000005) רק מנתקת את הזיהוי —
// לא מוחקת את הפרופיל/ההיסטוריה שלו.
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  if (event.type === "user.deleted" && event.data.id) {
    const supabase = createAdminClient();
    await supabase.rpc("clear_clerk_identity", { p_clerk_user_id: event.data.id });
  }

  return NextResponse.json({ ok: true });
}
