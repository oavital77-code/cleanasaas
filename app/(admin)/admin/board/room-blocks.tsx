"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getAdminBoardDict } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { createRoomBlockAction, deleteRoomBlockAction, type RoomBlockState } from "./actions";

const initialState: RoomBlockState = {};

export function RoomBlocks({
  rooms,
  blocks,
  initialDate,
}: {
  rooms: { id: string; name: string }[];
  blocks: { id: string; roomName: string; label: string; reason: string }[];
  initialDate: string;
}) {
  const t = getAdminBoardDict(useLocale());
  const [state, formAction, pending] = useActionState(createRoomBlockAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label>{t.room}</Label>
          <Select name="room_id" required className="sm:w-auto">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.blockFrom}</Label>
          <div className="flex gap-2">
            <Input name="date" type="date" defaultValue={initialDate} required className="w-full sm:w-auto" />
            <Input name="start_time" type="time" step={1800} defaultValue="08:00" required className="w-full sm:w-auto" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.blockTo}</Label>
          <div className="flex gap-2">
            <Input name="end_date" type="date" defaultValue={initialDate} className="w-full sm:w-auto" />
            <Input name="end_time" type="time" step={1800} defaultValue="22:00" required className="w-full sm:w-auto" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t.blockReason}</Label>
          <Input name="reason" className="w-full sm:w-40" />
        </div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? t.blockCreating : t.blockCreate}
        </Button>
        {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
      </form>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.blocksEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-field bg-subtle px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium">{b.roomName}</span>
                <span className="text-muted-foreground"> · {b.label}</span>
                {b.reason && b.reason !== "-" && <span className="text-muted-foreground"> · {b.reason}</span>}
              </span>
              <form action={deleteRoomBlockAction}>
                <input type="hidden" name="block_id" value={b.id} />
                <button
                  type="submit"
                  className="flex size-8 shrink-0 items-center justify-center rounded-button text-muted-foreground hover:text-danger"
                  title={t.blockDelete}
                >
                  <X className="size-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
