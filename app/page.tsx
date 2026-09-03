import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Cleana SaaS</h1>
      <p className="max-w-md text-muted-foreground">
        פלטפורמה רב-דיירית לניהול השכרת קליניקות — כל עסק עם הסניפים, החדרים
        והמחירון שלו.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          פתיחת קליניקה חדשה
        </Link>
        <Link href="/login" className="rounded-md border px-4 py-2">
          כניסה
        </Link>
      </div>
    </main>
  );
}
