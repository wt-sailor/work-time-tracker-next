import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        const where: Record<string, unknown> = { userId: session.user.id };

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            // Only apply date filter if both dates are valid
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                where.date = {
                    gte: start,
                    lte: end,
                };
            }
        }

        const logs = await prisma.workLog.findMany({
            where,
            orderBy: { punchIn: "asc" }, // Sorting by punchIn ascending for easier processing
        });

        // Deduplicate logs based on punchIn time
        // Preference: Completed > Active, then Latest Updated > Older Updated
        const uniqueLogsMap = new Map<string, typeof logs[0]>();

        logs.forEach(log => {
            const key = log.punchIn.toISOString();
            if (!uniqueLogsMap.has(key)) {
                uniqueLogsMap.set(key, log);
            } else {
                const existing = uniqueLogsMap.get(key)!;
                // If existing is active and new is completed, replace
                if (existing.status === "active" && log.status === "completed") {
                    uniqueLogsMap.set(key, log);
                }
                // If both same status, take the one with later updatedAt (if available, otherwise rely on ID or order)
                // Prisma types might not show updatedAt immediately if not selected, but here we select all.
                else if (existing.status === log.status) {
                    if (new Date(log.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                        uniqueLogsMap.set(key, log);
                    }
                }
            }
        });

        const logsSorted = Array.from(uniqueLogsMap.values()).sort((a, b) => 
            new Date(a.punchIn).getTime() - new Date(b.punchIn).getTime()
        );

        // Generate Calendar Events
        const events: any[] = [];
        // logsSorted is already sorted by punchIn

        const now = new Date();

        logsSorted.forEach((log, index) => {
            // 1. Work Event
            const isActive = log.status === "active";
            let workEnd = log.punchOut ? new Date(log.punchOut) : now;
            
            // Calculate duration for title
            let durationMs = 0;
            if (log.totalHours !== null) {
                durationMs = log.totalHours * 3600000;
            } else {
                durationMs = now.getTime() - new Date(log.punchIn).getTime();
            }
            
            const hoursDisplay = (durationMs / 3600000).toFixed(1);

            events.push({
                id: `work-${log.id}`,
                title: `Work: ${hoursDisplay}h${isActive ? " 🟢" : ""}`,
                start: log.punchIn,
                end: workEnd.toISOString(), // If active, this is "server now", client might update it
                backgroundColor: isActive ? "rgba(0, 230, 118, 0.15)" : "rgba(138, 43, 226, 0.15)",
                borderColor: isActive ? "rgba(0, 230, 118, 0.5)" : "rgba(138, 43, 226, 0.4)",
                textColor: isActive ? "#00e676" : "#c4a1e8",
                extendedProps: { 
                    log, 
                    type: "work",
                    isActive: isActive // Flag for frontend real-time updates
                },
            });

            // 2. Break Event (Gap to next log)
            const nextLog = logsSorted[index + 1];
            if (log.punchOut && nextLog) {
                const currentOut = new Date(log.punchOut);
                const nextIn = new Date(nextLog.punchIn);

                // Check if same day and valid gap (next starts after current ends)
                if (currentOut.toDateString() === nextIn.toDateString() && nextIn.getTime() > currentOut.getTime()) {
                    const breakDiff = nextIn.getTime() - currentOut.getTime();
                    const breakMinutes = Math.floor(breakDiff / 60000);

                    if (breakMinutes > 0) {
                        events.push({
                            id: `break-${log.id}-${nextLog.id}`,
                            title: `Break: ${Math.floor(breakMinutes / 60)}h ${breakMinutes % 60}m`,
                            start: log.punchOut,
                            end: nextLog.punchIn,
                            backgroundColor: "rgba(255, 167, 38, 0.15)",
                            borderColor: "rgba(255, 167, 38, 0.4)",
                            textColor: "#ffa726",
                            extendedProps: { 
                                log, 
                                type: "break",
                                previousLogId: log.id,
                                nextLogId: nextLog.id
                            },
                        });
                    }
                }
            }
        });

        return NextResponse.json(events);
    } catch (error) {
        console.error("Fetch logs error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
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
            // Find the latest active log for this user
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
                    { status: 404 }
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
                    totalHours: totalHours ? parseFloat(totalHours) : parseFloat(hours.toFixed(2)),
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
            { status: 500 }
        );
    }
}
