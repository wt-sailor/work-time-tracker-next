import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTimerState, getUserProfile } from "@/lib/api-services";
import DashboardClient from "./_components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const timerState = await getTimerState(session.user.id);
  const userProfile = await getUserProfile(session.user.id);

  return (
    <DashboardClient 
      initialTimerState={timerState} 
      userProfile={userProfile} 
    />
  );
}
