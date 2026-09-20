"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-client";

type ActingParty = {
  id: string;
  displayName: string;
  kind: "PERSONAL" | "REPRESENTED";
};

type ActingPartySwitcherProps = {
  parties: ActingParty[];
  actingPartyId: string | null;
};

export function ActingPartySwitcher({ parties, actingPartyId }: ActingPartySwitcherProps) {
  const [open, setOpen] = useState(parties.length > 0 && !actingPartyId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const actingParty = parties.find(({ id }) => id === actingPartyId) ?? null;

  const selectParty = async (party: ActingParty) => {
    if (party.id === actingPartyId) {
      setOpen(false);
      return;
    }
    setPendingId(party.id);
    setError("");
    try {
      const response = await fetch("/api/customer/acting-party", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actingPartyId: party.id }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "انتخاب طرف فعالیت ناموفق بود."));
      }
      // A detail page from the previous party is no longer accessible after the switch.
      // Leave that route and its client-side requests behind before rendering the new scope.
      window.location.replace("/customer/dashboard");
    } catch (selectionError) {
      setError(
        selectionError instanceof Error ? selectionError.message : "انتخاب طرف فعالیت ناموفق بود."
      );
      setPendingId(null);
    }
  };

  if (parties.length === 0) {
    return (
      <div className="hidden rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:block">
        نمایندگی فعالی ندارید
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-8 justify-center px-1 sm:w-auto sm:max-w-52 sm:justify-between sm:px-2.5"
        onClick={() => setOpen(true)}
        aria-label="انتخاب طرف فعالیت"
        title={actingParty?.displayName ?? "انتخاب طرف فعالیت"}
      >
        {actingParty?.kind === "PERSONAL" ? <UserRound /> : <Building2 />}
        <span className="hidden truncate sm:inline">{actingParty?.displayName ?? "انتخاب طرف فعالیت"}</span>
        <ChevronsUpDown className="hidden sm:block" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (actingPartyId) setOpen(nextOpen);
        }}
      >
        <DialogContent showCloseButton={Boolean(actingPartyId)} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>انتخاب طرف فعالیت</DialogTitle>
            <DialogDescription>
              برای ادامه حساب شخصی یا یکی از شرکت‌های تحت نمایندگی را انتخاب کنید. تمام اطلاعات فقط در محدوده طرف انتخاب‌شده نمایش داده می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" role="list" aria-label="طرف‌های فعالیت قابل انتخاب">
            {parties.map((party) => (
              <Button
                key={party.id}
                variant={party.id === actingPartyId ? "secondary" : "outline"}
                className="h-auto min-h-12 justify-start px-3 py-2 text-right whitespace-normal"
                onClick={() => void selectParty(party)}
                disabled={pendingId !== null}
                role="listitem"
              >
                {pendingId === party.id ? (
                  <Loader2 className="animate-spin" />
                ) : party.id === actingPartyId ? (
                  <Check />
                ) : party.kind === "PERSONAL" ? (
                  <UserRound />
                ) : (
                  <Building2 />
                )}
                <span className="flex min-w-0 flex-col items-start">
                  <span>{party.kind === "PERSONAL" ? "حساب شخصی من" : party.displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {party.kind === "PERSONAL" ? party.displayName : "شرکت تحت نمایندگی"}
                  </span>
                </span>
              </Button>
            ))}
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" aria-live="polite">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
