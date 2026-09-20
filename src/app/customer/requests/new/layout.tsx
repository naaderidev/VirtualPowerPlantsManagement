import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { canCreateCustomerRequest } from "@/lib/ui-access";

export default async function NewCustomerRequestLayout({ children }: LayoutProps<"/customer/requests/new">) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (!canCreateCustomerRequest(user.role, user.accessiblePartyIds.length)) {
    redirect("/customer/requests");
  }
  return children;
}
