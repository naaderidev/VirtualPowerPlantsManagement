import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { RepresentativesClient } from "./representatives-client";

export default async function RepresentativesPage() {
  const viewer = await getAuthenticatedUser();
  if (viewer?.role !== "ADMIN") redirect("/admin/dashboard");

  return <RepresentativesClient />;
}
