import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, Clock, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeUsersOf, type ProductResult, type ProductStats } from "@/lib/owner/stats";
import { ladder, THRESHOLDS } from "@/lib/owner/thresholds";

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  trialing: { text: "ניסיון", cls: "bg-info-bg text-info-fg" },
  active: { text: "משלם", cls: "bg-success-bg text-success-fg" },
  grace: { text: "חסד", cls: "bg-warning-bg text-warning-fg" },
  canceling: { text: "מבטל", cls: "bg-subtle text-muted-foreground" },
  locked: { text: "נעול", cls: "bg-danger-bg text-danger" },
  legacy_free: { text: "חינם (ותיק)", cls: "bg-subtle text-muted-foreground" },
  none: { text: "—", cls: "bg-subtle text-muted-foreground" },
};

const ils = (n: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

/** התצוגה עצמה, בלי השער — כדי שאפשר יהיה לראות אותה עם נתוני דוגמה. */
export type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string | null;
  clinic_name: string | null;
  message: string | null;
  status: string;
};

export function OwnerDashboardView({ plus, saas, leads }: { plus: ProductResult; saas: ProductResult; leads: LeadRow[] }) {
  const plusStats = plus.ok ? plus.stats : null;
  const saasStats = saas.ok ? saas.stats : null;
  const activeUsers = activeUsersOf(plusStats) + activeUsersOf(saasStats);
  const paying = (plusStats?.totals.paying ?? 0) + (saasStats?.totals.paying ?? 0);
  const trialing = (plusStats?.totals.trialing ?? 0) + (saasStats?.totals.trialing ?? 0);
  const revenueMonth = (plusStats?.revenueIls.thisMonth ?? 0) + (saasStats?.revenueIls.thisMonth ?? 0);
  const revenueAll = (plusStats?.revenueIls.allTime ?? 0) + (saasStats?.revenueIls.allTime ?? 0);
  const steps = ladder(activeUsers);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader isSuperadmin />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">CleanaGroup</p>
            <h1 className="text-2xl font-semibold">דשבורד בעלים</h1>
          </div>
          <Link href="/superadmin" className="text-sm text-violet-600 hover:underline">
            לרשימת הקליניקות
          </Link>
        </div>

        {(!plus.ok || !saas.ok) && (
          <div className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              {!plus.ok && <span>Cleana+ לא נטען: {plus.reason}. המספרים למטה הם של CleanaS בלבד.</span>}
              {!saas.ok && <span>CleanaS לא נטען: {saas.reason}.</span>}
            </div>
          </div>
        )}

        {/* מספרים ראשיים */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="משתמשים פעילים" value={String(activeUsers)} hint="ניסיון + משלמים + חסד, שני המוצרים" accent />
          <Stat label="משלמים" value={String(paying)} />
          <Stat label="בניסיון" value={String(trialing)} />
          <Stat label="הכנסות החודש" value={ils(revenueMonth)} />
          <Stat label="הכנסות מצטבר" value={ils(revenueAll)} />
        </section>

        {/* מדרגות רכישה */}
        <Card className="shadow-e1">
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
            <div>
              <CardTitle className="text-lg">מדרגות רכישה</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                לפי {activeUsers} משתמשים פעילים. עלות חודשית של מה שכבר נדרש: כ-${steps.monthlyDueUsd}.
                {steps.next && ` המדרגה הבאה בעוד ${steps.next.at - activeUsers} משתמשים.`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">מחירים משוערים לפי דפי התמחור הציבוריים. לאמת לפני רכישה.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0">
            {THRESHOLDS.map((t, i) => {
              const due = activeUsers >= t.at;
              return (
                <div
                  key={i}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 md:flex-row md:items-center md:gap-4 ${
                    due ? "border-warning-border bg-warning-bg/60" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3 md:w-44 md:shrink-0">
                    <span
                      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                        due ? "bg-warning-fg text-white" : "bg-subtle text-muted-foreground"
                      }`}
                    >
                      {t.at}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">משתמש מספר</span>
                      <span className="text-sm font-semibold">{t.service}</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{t.action}</span>
                    <span className="text-sm text-muted-foreground">{t.why}</span>
                    <span className="text-xs text-muted-foreground">אם לא: {t.risk}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:w-56 md:shrink-0 md:flex-col md:items-end">
                    <span className="text-sm font-semibold tabular-nums">{t.usdPerMonth === 0 ? "חינם" : `$${t.usdPerMonth}/חודש`}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        due ? "bg-warning-fg text-white" : "bg-subtle text-muted-foreground"
                      }`}
                    >
                      {due ? <Check className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}
                      {due ? "נדרש עכשיו" : `בעוד ${t.at - activeUsers}`}
                    </span>
                    <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                      לדף הרכישה <ArrowUpRight className="size-3" aria-hidden />
                    </a>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <LeadsSection leads={leads} />

        <ProductSection title="Cleana+" subtitle="מטפלים עצמאיים · ₪79 לחודש" result={plus} />
        <ProductSection title="CleanaS" subtitle="קליניקות · ₪209 לחודש" result={saas} seats />
      </main>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border p-4 ${accent ? "border-violet-200 bg-violet-50" : "border-border bg-card"}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ProductSection({ title, subtitle, result, seats }: { title: string; subtitle: string; result: ProductResult; seats?: boolean }) {
  if (!result.ok) {
    return (
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="text-sm text-destructive">לא נטען: {result.reason}</CardContent>
      </Card>
    );
  }
  const s: ProductStats = result.stats;
  const t = s.totals;
  return (
    <Card className="shadow-e1 overflow-hidden p-0">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 p-6">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Pill label="חשבונות" value={t.accounts} />
          <Pill label="משלמים" value={t.paying} tone="success" />
          <Pill label="ניסיון" value={t.trialing} tone="info" />
          <Pill label="חסד" value={t.grace} tone="warning" />
          <Pill label="נעולים" value={t.locked} tone="danger" />
          {t.legacyFree > 0 && <Pill label="חינם ותיק" value={t.legacyFree} />}
          <Pill label="החודש" value={ils(s.revenueIls.thisMonth)} tone="success" />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {s.accounts.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">עדיין אין חשבונות.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-right">
              <tr>
                <th className="p-3 font-medium">שם</th>
                <th className="hidden p-3 font-medium md:table-cell">אימייל</th>
                <th className="p-3 font-medium">מצב</th>
                {seats && <th className="hidden p-3 font-medium sm:table-cell">מטפלים</th>}
                <th className="hidden p-3 font-medium sm:table-cell">נרשם</th>
                <th className="hidden p-3 font-medium lg:table-cell">ניסיון עד / שולם עד</th>
                <th className="hidden p-3 font-medium lg:table-cell">תשלום אחרון</th>
              </tr>
            </thead>
            <tbody>
              {s.accounts.map((a) => {
                const st = STATE_LABEL[a.state] ?? STATE_LABEL.none;
                return (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="hidden p-3 text-muted-foreground md:table-cell" dir="ltr">
                      {a.email}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.text}</span>
                    </td>
                    {seats && <td className="hidden p-3 tabular-nums sm:table-cell">{a.seats ?? 0}</td>}
                    <td className="hidden p-3 tabular-nums sm:table-cell">{day(a.createdAt)}</td>
                    <td className="hidden p-3 tabular-nums lg:table-cell">{day(a.trialEndsAt ?? a.currentPeriodEnd)}</td>
                    <td className="hidden p-3 tabular-nums lg:table-cell">
                      {a.lastPaymentAt ? `${day(a.lastPaymentAt)} · ${ils(a.lastPaymentIls ?? 0)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

/** פניות מדף הנחיתה — מה שהגיע ועוד לא טופל, ראשון. */
function LeadsSection({ leads }: { leads: LeadRow[] }) {
  const fresh = leads.filter((l) => l.status === "new").length;
  return (
    <Card className="shadow-e1">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-violet-500" aria-hidden />
          <CardTitle className="text-lg">פניות מדף הנחיתה</CardTitle>
        </div>
        {fresh > 0 && <Pill label="חדשות" value={fresh} tone="warning" />}
      </CardHeader>
      <CardContent className="pt-0">
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין עדיין פניות.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <div key={lead.id} className="flex flex-col gap-1.5 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {lead.name}
                    {lead.clinic_name && <span className="text-muted-foreground"> · {lead.clinic_name}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{day(lead.created_at)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <a href={`tel:${lead.phone}`} dir="ltr" className="font-medium text-violet-600 hover:underline">
                    {lead.phone}
                  </a>
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} dir="ltr" className="text-violet-600 hover:underline">
                      {lead.email}
                    </a>
                  )}
                </div>
                {lead.message && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lead.message}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Pill({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "info" | "warning" | "danger" }) {
  const cls = {
    success: "bg-success-bg text-success-fg",
    info: "bg-info-bg text-info-fg",
    warning: "bg-warning-bg text-warning-fg",
    danger: "bg-danger-bg text-danger",
  }[tone ?? "info"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${tone ? cls : "bg-subtle text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}
