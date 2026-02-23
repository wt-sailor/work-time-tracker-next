import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminClient from "./_components/AdminClient";

export const metadata = {
  title: "Admin Panel | WorkTracker",
};

export default async function AdminPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <main className="main-content admin-page">
      <AdminClient currentUserId={session.user.id} />
    </main>
  );
}
