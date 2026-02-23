import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWorkLogs } from "@/lib/api-services";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const events = await getWorkLogs(session.user.id, startDate, endDate);

    return NextResponse.json(events);
  } catch (error) {
    console.error("Fetch logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, time, totalHours, date } = body;

    // ── Bulk: create multiple completed sessions (past-day manual entry) ──
    if (type === "bulk") {
      const { sessions, date: bulkDate } = body as {
        sessions: { punchIn: string; punchOut: string; totalHours: number }[];
        date: string;
      };

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return NextResponse.json(
          { error: "No sessions provided" },
          { status: 400 },
        );
      }

      const logs = await prisma.$transaction(
        sessions.map((s) =>
          prisma.workLog.create({
            data: {
              userId: session.user.id,
              date: new Date(bulkDate),
              punchIn: new Date(s.punchIn),
              punchOut: new Date(s.punchOut),
              totalHours: s.totalHours,
              status: "completed",
            },
          }),
        ),
      );

      return NextResponse.json(logs, { status: 201 });
    }

    if (type === "punch-in") {
      const log = await prisma.workLog.create({
        data: {
          userId: session.user.id,
          date: new Date(date || new Date().toISOString().split("T")[0]),
          punchIn: new Date(time),
          status: "active",
        },
      });
      return NextResponse.json(log, { status: 201 });
    }

    if (type === "punch-out") {
      const activeLog = await prisma.workLog.findFirst({
        where: {
          userId: session.user.id,
          status: "active",
          punchOut: null,
        },
        orderBy: { punchIn: "desc" },
      });

      if (!activeLog) {
        return NextResponse.json(
          { error: "No active punch-in found" },
          { status: 404 },
        );
      }

      const punchOutTime = new Date(time);
      const durationMs =
        punchOutTime.getTime() - new Date(activeLog.punchIn).getTime();
      const hours = durationMs / (1000 * 60 * 60);

      const log = await prisma.workLog.update({
        where: { id: activeLog.id },
        data: {
          punchOut: punchOutTime,
          totalHours: totalHours
            ? parseFloat(totalHours)
            : parseFloat(hours.toFixed(2)),
          status: "completed",
        },
      });

      return NextResponse.json(log);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
