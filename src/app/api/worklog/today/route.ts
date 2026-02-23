import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/worklog/today
 * Deletes ALL work log entries for the authenticated user for today (local date),
 * then clears the timer state from the backend as well.
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count } = await prisma.workLog.deleteMany({
      where: {
        userId: session.user.id,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    // Also wipe the timer state so the dashboard resets
    await prisma.timerState.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true, deletedCount: count });
  } catch (error) {
    console.error("[today] clear error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
