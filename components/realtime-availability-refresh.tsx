"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient } from "@/lib/supabase/client";

// עדכון חי ל-/schedule ו-/admin/board: availability_events כבר ב-Realtime
// publication ומאוכלס ע"י triggers על bookings/room_blocks (ר' migrations),
// חסר רק המנוי בצד הלקוח. בלי גוף — component "שקט" שרק מפעיל
// router.refresh() בשינוי, כדי שהעמוד ימשיך לקבל את הנתונים דרך אותה
// שאילתת Server Component בדיוק (לא state כפול בצד הלקוח).
//
// 🔴 מוגבל למשתמשי Clerk: useSupabaseClient() (lib/supabase/client.ts)
// מביא טוקן רק מ-useSession() של Clerk. משתמש/ת legacy (Supabase Auth,
// עוד לא עבר/ה ל-Clerk) לא יקבל/תקבל עדכון חי — העמוד ממשיך לעבוד כרגיל,
// פשוט בלי הרענון האוטומטי, עד שהחשבון יעבור ל-Clerk.
export function RealtimeAvailabilityRefresh({ clinicId }: { clinicId: string }) {
  const supabase = useSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`availability-events:${clinicId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "availability_events", filter: `clinic_id=eq.${clinicId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, clinicId, router]);

  return null;
}
