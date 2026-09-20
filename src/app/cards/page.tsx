import { redirect } from "next/navigation";
import { DemoRoleCards } from "./demo-role-cards";
import { isDemoLoginEnabled } from "@/lib/demo-accounts";

export default function DemoCardsPage() {
  if (!isDemoLoginEnabled()) redirect("/login");

  return <DemoRoleCards />;
}
