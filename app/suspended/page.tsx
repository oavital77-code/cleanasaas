import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <AuthShell>
      <Card className="shadow-e2 border-warning-border text-center">
        <CardHeader>
          <CardTitle className="text-xl text-warning-fg">החשבון מושהה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            הגישה לחשבון שלך מוגבלת כרגע. לפרטים אפשר לפנות להנהלת הקליניקה,
            ואם החשבון של הקליניקה כולה מושהה, אלינו.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
