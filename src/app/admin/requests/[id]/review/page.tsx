import { redirect } from "next/navigation";

export default async function RequestReviewPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  redirect(`/admin/requests/${id}`);
}
