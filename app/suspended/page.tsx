export default function SuspendedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">החשבון מושעה</h1>
      <p className="max-w-md text-muted-foreground">
        לחשבון שלך יש הגבלה זמנית. פנה/י למנהל/ת הקליניקה שלך, או אלינו אם
        מדובר בקליניקה עצמה, לפרטים נוספים.
      </p>
    </main>
  );
}
