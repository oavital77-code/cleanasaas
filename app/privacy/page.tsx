import Link from "next/link";
import { Logo } from "@/components/logo";

// טקסט סטטי — placeholder. יש להחליף בנוסח משפטי אמיתי (ToS/DPA) לפני
// השקה ציבורית (ר' PROGRESS.md, "לפני שמחברים קליניקה אמיתית").
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <Link href="/" className="w-fit">
        <Logo size="sm" />
      </Link>
      <h1 className="text-2xl font-semibold">מדיניות פרטיות</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          מסמך זה הוא טיוטת מסגרת בלבד, ואינו מהווה ייעוץ משפטי. לפני שימוש
          אמיתי בפלטפורמה יש להחליף אותו בנוסח משפטי מלא (מדיניות פרטיות +
          הסכם עיבוד נתונים).
        </p>
        <p>
          כל קליניקה (&quot;דייר&quot;) בפלטפורמה מבודדת מנתונית קליניקות
          אחרות ברמת בסיס הנתונים. מטפל/ת בקליניקה אחת לעולם אינו/ה חשוף/ה
          לנתוני מטפל/ת בקליניקה אחרת.
        </p>
        <p>
          נתונים הנאספים: פרטי קשר (שם, טלפון, אימייל), פרטי הזמנות ותשלומים
          הקשורים לשימוש בשירות. תשלומים עצמם מתבצעים דרך חנות ה-WooCommerce
          של הקליניקה — הפלטפורמה אינה שומרת פרטי כרטיס אשראי.
        </p>
      </div>
    </main>
  );
}
