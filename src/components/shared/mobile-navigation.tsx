"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MobileNavigationProps = {
  title: string;
  className: string;
  children: ReactNode;
};

export function MobileNavigation({ title, className, children }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);

  const closeAfterNavigation = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a")) {
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className={className}
            aria-label="باز کردن منوی ناوبری"
            title="منوی ناوبری"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0">
        <SheetHeader className="border-b py-5">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" onClick={closeAfterNavigation}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
