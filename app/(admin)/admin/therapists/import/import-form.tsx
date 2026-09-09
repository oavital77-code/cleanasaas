"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getAdminImportDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { confirmImportAction, previewImportAction, type ImportPreviewState } from "./actions";

const initialState: ImportPreviewState = { step: "upload" };

export function ImportForm() {
  const t = getAdminImportDict(useLocale());
  const [preview, previewAction, previewPending] = useActionState(previewImportAction, initialState);
  const [confirm, confirmAction, confirmPending] = useActionState(confirmImportAction, initialState);

  // שני מצבים נפרדים: preview מחזיק את השורות; confirm מחזיק תוצאה (done)
  // או שגיאת אישור שמוצגת מעל הטבלה.
  const state = confirm.step === "done" ? confirm : preview;
  const confirmError = confirm.step === "done" ? undefined : confirm.error;

  if (state.step === "done" && state.result) {
    const r = state.result;
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-field bg-success-bg px-3 py-2 text-sm text-success-fg">{t.doneSummary(r.inserted, r.skipped)}</p>
        {r.errors.length > 0 && (
          <div className="rounded-field bg-warning-bg px-3 py-2 text-sm text-warning-fg">
            <p className="mb-1 font-medium">{t.doneErrorsTitle(r.errors.length)}</p>
            <ul className="list-disc ps-5">
              {r.errors.map((e, i) => (
                <li key={i}>{t.lineLabel(e.line)}: {e.message}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t.doneNextSteps}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/therapists">{t.backToTherapists}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/therapists/import">{t.importAnother}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state.step === "preview" && state.rows) {
    const rows = state.rows;
    const validCount = state.validCount ?? 0;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          <span className="font-medium">{state.fileName}</span> · {t.previewSummary(rows.length, validCount)}
        </p>
        {confirmError && <p className="rounded-field bg-danger-bg px-3 py-2 text-sm text-danger">{confirmError}</p>}
        <div className="overflow-x-auto rounded-field border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-start font-medium">#</th>
                <th className="p-2 text-start font-medium">{t.fields.full_name}</th>
                <th className="p-2 text-start font-medium">{t.fields.phone}</th>
                <th className="p-2 text-start font-medium">{t.fields.email}</th>
                <th className="p-2 text-start font-medium">{t.fields.hours}</th>
                <th className="p-2 text-start font-medium">{t.fields.profession}</th>
                <th className="p-2 text-start font-medium">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const bad = r.errors.length > 0;
                return (
                  <tr key={r.line} className={`border-t border-border ${bad ? "bg-danger-bg/40" : ""}`}>
                    <td className="tabular-nums p-2 text-muted-foreground">{r.line}</td>
                    <td className="p-2">{r.full_name || "—"}</td>
                    <td className="p-2" dir="ltr">{r.phone || "—"}</td>
                    <td className="p-2" dir="ltr">{r.email || "—"}</td>
                    <td className="tabular-nums p-2">{r.hours}</td>
                    <td className="p-2">{r.profession ?? "—"}</td>
                    <td className="p-2">
                      {bad ? (
                        <span className="text-danger">{r.errors.map((e) => t.rowErrors[e]).join(" · ")}</span>
                      ) : (
                        <span className="text-success">{t.rowOk}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={confirmAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="rows" value={JSON.stringify(rows)} />
          <Button type="submit" disabled={confirmPending || validCount === 0}>
            {confirmPending ? t.importing : t.confirmImport(validCount)}
          </Button>
          <Button asChild variant="outline" type="button">
            <Link href="/admin/therapists/import">{t.chooseAnotherFile}</Link>
          </Button>
          {validCount < rows.length && <span className="text-xs text-muted-foreground">{t.invalidRowsSkipped}</span>}
        </form>
      </div>
    );
  }

  return (
    <form action={previewAction} className="flex flex-col gap-3">
      {state.error && <p className="rounded-field bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Label htmlFor="import_file">{t.fileLabel}</Label>
      <input id="import_file" name="file" type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="text-sm" />
      <Button type="submit" disabled={previewPending} className="w-fit">
        {previewPending ? t.reading : t.previewButton}
      </Button>
    </form>
  );
}
