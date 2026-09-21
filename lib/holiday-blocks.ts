import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { israeliHolidays, yearsBetween, type HolidayPolicy } from "@/lib/holidays";
import { zonedDateTimeToUtc } from "@/lib/time";

/**
 * Israeli holidays in CleanaS are room blocks. The clinic's switches say
 * which kinds of day close; this turns them into `room_blocks` rows, one per
 * room per closed day, tagged `holiday:<key>`, for the next HORIZON_DAYS.
 * Everything downstream — the schedule, the board, the booking RPC — already
 * refuses a blocked room, so nothing else has to know what a holiday is.
 *
 * Idempotent: the RPC inserts what is missing and deletes future holiday
 * blocks the policy no longer covers. Bookings that already sit on a holiday
 * are left alone; the admin decides what to do with those.
 */
const HORIZON_DAYS = 400;

type Clinic = { id: string; timezone: string } & {
  block_holidays: boolean;
  block_holiday_eves: boolean;
  block_chol_hamoed: boolean;
};

function todayIn(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The closed days ahead, each as one whole day in the clinic's timezone. */
export function holidayBlocksFor(clinic: Clinic, now = new Date()) {
  const policy: HolidayPolicy = {
    blockHolidays: clinic.block_holidays,
    blockHolidayEves: clinic.block_holiday_eves,
    blockCholHamoed: clinic.block_chol_hamoed,
  };
  const from = todayIn(clinic.timezone);
  const to = addDays(from, HORIZON_DAYS);
  const starts: string[] = [];
  const ends: string[] = [];
  const reasons: string[] = [];
  for (const year of yearsBetween(from, to)) {
    for (const h of israeliHolidays(year)) {
      if (h.date < from || h.date > to) continue;
      const closes =
        (h.kind === "holiday" && policy.blockHolidays) ||
        (h.kind === "eve" && policy.blockHolidayEves) ||
        (h.kind === "cholHamoed" && policy.blockCholHamoed);
      if (!closes) continue;
      starts.push(zonedDateTimeToUtc(h.date, "00:00", clinic.timezone).toISOString());
      ends.push(zonedDateTimeToUtc(addDays(h.date, 1), "00:00", clinic.timezone).toISOString());
      reasons.push(`holiday:${h.key}`);
    }
  }
  void now;
  return { starts, ends, reasons };
}

export async function materializeHolidayBlocks(supabase: SupabaseClient<Database>, clinic: Clinic) {
  const { starts, ends, reasons } = holidayBlocksFor(clinic);
  const { data, error } = await supabase.rpc("materialize_holiday_blocks", {
    p_clinic_id: clinic.id,
    p_starts: starts,
    p_ends: ends,
    p_reasons: reasons,
  });
  if (error) throw new Error(`materialize_holiday_blocks failed for clinic ${clinic.id}: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { inserted: row?.inserted ?? 0, deleted: row?.deleted ?? 0 };
}

/** Every clinic, for the nightly job. A failing clinic is reported, not fatal to the rest. */
export async function materializeHolidayBlocksForAllClinics(supabase: SupabaseClient<Database>) {
  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, timezone, block_holidays, block_holiday_eves, block_chol_hamoed");
  // Not thrown: this rides on the nightly sessions job, and a migration that
  // has not been applied yet must not take that job down with it.
  if (error) {
    console.error("[holiday-blocks] could not list clinics:", error.message);
    return { clinics: 0, inserted: 0, deleted: 0, failed: 0, error: error.message };
  }

  const summary: { clinics: number; inserted: number; deleted: number; failed: number; error?: string } = { clinics: 0, inserted: 0, deleted: 0, failed: 0 };
  for (const clinic of clinics ?? []) {
    try {
      const r = await materializeHolidayBlocks(supabase, clinic);
      summary.clinics++;
      summary.inserted += r.inserted;
      summary.deleted += r.deleted;
    } catch (err) {
      summary.failed++;
      console.error("[holiday-blocks]", err instanceof Error ? err.message : err);
    }
  }
  return summary;
}
