import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <AuthShell>
      <Card className="shadow-e2 border-warning-border text-center">
        <CardHeader>
          <CardTitle className="text-xl text-warning-fg">החשבון מושעה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            לחשבון שלך יש הגבלה זמנית. פנה/י למנהל/ת הקליניקה שלך, או אלינו אם
            מדובר בקליניקה עצמה, לפרטים נוספים.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
