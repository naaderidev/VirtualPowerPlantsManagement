import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { CustomerOnboardingForm } from "./customer-onboarding-form";

export default async function CustomerOnboardingPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect(user.role === "CUSTOMER_REPRESENTATIVE" ? "/customer/dashboard" : "/admin/dashboard");
  if (user.partyId) redirect("/customer/dashboard");

  return <CustomerOnboardingForm defaultName={user.name} defaultMobile={user.mobile} defaultEmail={user.email ?? ""} />;
}
