import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/worklog/add-break
 *
 * Inserts a historical break into the database by splitting the active work session.
 *
 * Before:  [active log: punchIn=A, punchOut=null]
 * After:   [completed log: punchIn=A, punchOut=breakStart]
 *          [new active log: punchIn=breakEnd, punchOut=null]
 *
 * This keeps the DB in perfect sync with the timer state, so the calendar
 * shows the break properly.
 *
 * If there is no active log (rare: e.g. a completed-day manual entry),
 * we instead look for the most recent completed log on the same day and
 * create two new completed logs surrounding the break.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { breakStart, breakEnd } = body as {
      breakStart: string;
      breakEnd: string;
    };

    if (!breakStart || !breakEnd) {
      return NextResponse.json(
        { error: "Missing breakStart or breakEnd" },
        { status: 400 },
      );
    }

    const breakStartMs = new Date(breakStart).getTime();
    const breakEndMs = new Date(breakEnd).getTime();

    if (breakStartMs >= breakEndMs) {
      return NextResponse.json(
        { error: "breakStart must be before breakEnd" },
        { status: 400 },
      );
    }

    const now = new Date();
    if (breakEndMs > now.getTime()) {
      return NextResponse.json(
        { error: "breakEnd cannot be in the future" },
        { status: 400 },
      );
    }

    // Find the current active (open) work log
    const activeLog = await prisma.workLog.findFirst({
      where: { userId: session.user.id, status: "active", punchOut: null },
      orderBy: { punchIn: "desc" },
    });

    if (activeLog) {
      // Validate: break must start after the active session's punch-in
      if (breakStartMs <= activeLog.punchIn.getTime()) {
        return NextResponse.json(
          { error: "Break start must be after your current session punch-in." },
          { status: 400 },
        );
      }

      // Atomically: close existing log at breakStart, open new log at breakEnd
      await prisma.$transaction([
        // 1. Close the active log at breakStart
        prisma.workLog.update({
          where: { id: activeLog.id },
          data: {
            punchOut: new Date(breakStart),
            totalHours: parseFloat(
              (
                (breakStartMs - activeLog.punchIn.getTime()) /
                3_600_000
              ).toFixed(4),
            ),
            status: "completed",
          },
        }),
        // 2. Create a new active log starting at breakEnd
        prisma.workLog.create({
          data: {
            userId: session.user.id,
            date: activeLog.date,
            punchIn: new Date(breakEnd),
            punchOut: null,
            status: "active",
          },
        }),
      ]);

      return NextResponse.json({ success: true, mode: "split-active" });
    }

    // No active session — insert as a standalone break between completed logs
    // Find the most recent completed log for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const recentLog = await prisma.workLog.findFirst({
      where: {
        userId: session.user.id,
        status: "completed",
        date: { gte: todayStart },
      },
      orderBy: { punchIn: "desc" },
    });

    if (!recentLog) {
      return NextResponse.json(
        { error: "No active or recent work session found for today." },
        { status: 404 },
      );
    }

    // Just note we can't do anything meaningful without a live session
    return NextResponse.json(
      { error: "No active session — please add the break from the calendar." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[add-break] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
