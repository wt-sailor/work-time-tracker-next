import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWorkLogs } from "@/lib/api-services";
import CalendarClient from "./_components/CalendarClient";

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const events = await getWorkLogs(session.user.id);

  return <CalendarClient initialEvents={events} />;
}
