"use client";

import { useSession } from "next-auth/react";
import { isAppRole, roleIsAllowed, type AppRole } from "@/lib/access-control";

export function RoleGate({
  allowedRoles,
  children,
}: Readonly<{ allowedRoles: readonly AppRole[]; children: React.ReactNode }>) {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!isAppRole(role) || !roleIsAllowed(role, allowedRoles)) return null;
  return children;
}
