type IndependentInvoiceContext = {
  hasNettingReservation: boolean;
  contractNettingEnabled: boolean;
  scheduleNettingEnabled: boolean;
  nettingGroup: { active: boolean; mode: string } | null;
};

export function independentInvoiceRestriction(context: IndependentInvoiceContext): string | null {
  if (context.hasNettingReservation) {
    return "این تسویه وارد خالص‌سازی شده و صورتحساب مستقل برای آن قابل صدور نیست.";
  }
  if (
    context.contractNettingEnabled &&
    context.scheduleNettingEnabled &&
    context.nettingGroup?.active &&
    context.nettingGroup.mode !== "OFF"
  ) {
    return "این قرارداد به گروه خالص‌سازی فعال متصل است؛ پس از تأیید دو تسویه، سند مالی خالص‌سازی صادر کنید، نه صورتحساب مستقل.";
  }
  return null;
}
