import Link from "next/link";
import { Logo } from "@/components/logo";

// טקסט סטטי — placeholder. יש להחליף בנוסח משפטי אמיתי לפני השקה ציבורית
// (ר' PROGRESS.md, "לפני שמחברים קליניקה אמיתית") — אותה הערה כמו /privacy.
export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <Link href="/" className="w-fit">
        <Logo size="sm" />
      </Link>
      <h1 className="text-2xl font-semibold">תנאי שימוש</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          מסמך זה הוא טיוטת מסגרת בלבד, ואינו מהווה ייעוץ משפטי. לפני שימוש
          אמיתי בפלטפורמה יש להחליף אותו בנוסח משפטי מלא (הסכם שירות מול
          קליניקות + תנאי שימוש למטפלים).
        </p>
        <p>
          הפלטפורמה מספקת תשתית ניהול לוח זמנים, כרטיסיות וססיות עבור
          קליניקות המשכירות חדרים למטפלים. התשלומים בפועל בין הקליניקה
          למטפל/ת מתבצעים בחנות ה-WooCommerce של הקליניקה עצמה — הפלטפורמה
          אינה צד לעסקת התשלום.
        </p>
        <p>
          כל קליניקה אחראית לתוכן ולמדיניות הביטולים שהיא מציגה למטפלים
          שלה. הפלטפורמה אחראית לזמינות המערכת ולבידוד הנתונים בין קליניקות.
        </p>
      </div>
    </main>
  );
}
