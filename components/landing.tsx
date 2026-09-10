import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// אבני הבניין של הדפים הציבוריים — הדמיית חלון דפדפן, אריחי KPI, רשימת יומן,
// לוח עמודות, שלבים ממוספרים ואיור האבטחה. אותה שפה בדיוק כמו ב-Cleana+
// (click-na/src/components/landing.tsx), בטוקנים של Cleana. תצוגה בלבד: כל
// מספר בהדמיות הוא UI לדוגמה, הטענות נמצאות בטקסט שמסביב.

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

export function GridPaper({ className }: { className?: string }) {
  return <div aria-hidden className={cn("grid-paper pointer-events-none absolute inset-0", className)} />;
}

export function Eyebrow({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-card px-4 py-1.5 text-xs font-semibold tracking-wide text-violet-700 shadow-sm">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function TrustRow({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-2">
          <Check className="size-4 text-success-fg" strokeWidth={2.5} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function BrowserFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-violet-500/10", className)}>
      <div className="flex items-center gap-2 border-b border-border bg-subtle/70 px-5 py-3.5">
        <span className="size-3 rounded-full bg-[#f87171]" />
        <span className="size-3 rounded-full bg-[#fbbf24]" />
        <span className="size-3 rounded-full bg-[#34d399]" />
      </div>
      {children}
    </div>
  );
}

export function SidebarRail({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col items-center gap-3 border-e border-border px-3 py-5">
      <span className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm" />
      <span className="size-9 rounded-xl bg-violet-100 ring-2 ring-violet-400 ring-offset-1 ring-offset-transparent" />
      {Array.from({ length: count - 2 }).map((_, i) => (
        <span key={i} className="size-9 rounded-xl bg-subtle" />
      ))}
    </div>
  );
}

export function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
      <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-success-fg">{delta}</span>
    </div>
  );
}

export type ScheduleTone = "open" | "held" | "booked";
const TONE = {
  open: { bar: "bg-success-fg", pill: "bg-success-bg text-success-fg" },
  held: { bar: "bg-warning-fg", pill: "bg-warning-bg text-warning-fg" },
  booked: { bar: "bg-violet-500", pill: "bg-violet-100 text-violet-700" },
} satisfies Record<ScheduleTone, { bar: string; pill: string }>;

export function ScheduleList({
  title,
  meta,
  rows,
}: {
  title: string;
  meta: string;
  rows: { time: string; name: string; status: string; tone: ScheduleTone }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{meta}</span>
      </div>
      <ul className="flex flex-col gap-2 pt-3">
        {rows.map((row) => (
          <li key={row.time + row.name} className="flex items-center gap-3 rounded-xl bg-subtle/70 px-3 py-2.5 text-sm">
            <span className={cn("h-6 w-1 rounded-full", TONE[row.tone].bar)} />
            <span className="font-semibold tabular-nums">{row.time}</span>
            <span className="flex-1 truncate">{row.name}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TONE[row.tone].pill)}>{row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Chips({ items }: { items: { icon: IconType; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-border bg-card/80 px-6 py-4 shadow-sm backdrop-blur-sm">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-2.5 text-sm font-semibold">
          <Icon className="size-5 text-violet-500" strokeWidth={1.75} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

export type BoardColumn = { title: string; tone: ScheduleTone; cards: { title: string; sub: string }[]; placeholders?: number };

export function Board({ title, badge, columns }: { title: string; badge: string; columns: BoardColumn[] }) {
  const titleTone: Record<ScheduleTone, string> = { open: "text-success-fg", held: "text-warning-fg", booked: "text-violet-700" };
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-violet-500/10 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-lg font-bold">{title}</span>
        <span className="rounded-full bg-success-bg px-3 py-1 text-xs font-semibold text-success-fg">{badge}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-subtle/60 p-2.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className={cn("text-sm font-bold", titleTone[col.tone])}>{col.title}</span>
              <span className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-card text-xs font-bold tabular-nums">
                {col.cards.length + (col.placeholders ?? 0)}
              </span>
            </div>
            {col.cards.map((card) => (
              <div key={card.title + card.sub} className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                <p className="truncate text-sm font-semibold">{card.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={cn("inline-block size-1.5 rounded-full", TONE[col.tone].bar)} />
                  {card.sub}
                </p>
              </div>
            ))}
            {Array.from({ length: col.placeholders ?? 0 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl border border-dashed border-border-strong" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Steps({ steps }: { steps: { title: string; text: string; icon: IconType }[] }) {
  return (
    <ol className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <step.icon className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-3xl font-bold tabular-nums text-violet-200">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <p className="text-lg font-bold">{step.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function Orbit({ center: Center, satellites }: { center: IconType; satellites: IconType[] }) {
  const spots = ["-top-2 left-[8%]", "top-[4%] right-[10%]", "bottom-[8%] left-[12%]", "bottom-[4%] right-[8%]"];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      <span aria-hidden className="absolute inset-[6%] rounded-full border border-violet-100" />
      <span aria-hidden className="absolute inset-[20%] rounded-full border border-violet-200" />
      <span aria-hidden className="absolute inset-[33%] rounded-full border border-violet-200" />
      <span className="absolute top-1/2 left-1/2 inline-flex size-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-violet-400 to-violet-600 shadow-2xl shadow-violet-500/30">
        <Center className="size-14 text-white" strokeWidth={1.75} aria-hidden />
      </span>
      {satellites.slice(0, 4).map((Icon, i) => (
        <span key={i} className={cn("absolute inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-violet-500 shadow-lg", spots[i])}>
          <Icon className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
      ))}
    </div>
  );
}

export function CheckCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-fg text-white">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
        <span className="text-lg font-bold">{title}</span>
      </div>
      <ul className="flex flex-col gap-3 pt-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FactList({ facts }: { facts: { title: string; sub: string }[] }) {
  return (
    <ul className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
      {facts.map((fact) => (
        <li key={fact.title} className="flex items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success-bg text-success-fg">
            <Check className="size-5" strokeWidth={2.5} aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="font-bold">{fact.title}</span>
            <span className="text-sm text-muted-foreground">{fact.sub}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
