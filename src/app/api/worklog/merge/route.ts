import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { previousLogId, nextLogId } = body;

        if (!previousLogId || !nextLogId) {
            return NextResponse.json({ error: "Missing log IDs" }, { status: 400 });
        }

        // Fetch both logs to verify ownership and data
        const [prevLog, nextLog] = await Promise.all([
            prisma.workLog.findUnique({ where: { id: previousLogId } }),
            prisma.workLog.findUnique({ where: { id: nextLogId } }),
        ]);

        if (!prevLog || !nextLog) {
            return NextResponse.json({ error: "Logs not found" }, { status: 404 });
        }

        if (prevLog.userId !== session.user.id || nextLog.userId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized access to logs" }, { status: 403 });
        }

        // Logic: Merge nextLog into prevLog
        // 1. New punchOut for prevLog is nextLog.punchOut (or null if active)
        const newPunchOut = nextLog.punchOut;
        
        // 2. Calculate new totalHours if punchOut exists
        let newTotalHours: number | null = null;
        if (newPunchOut) {
            const durationMs = new Date(newPunchOut).getTime() - new Date(prevLog.punchIn).getTime();
            newTotalHours = durationMs / 3600000;
        }

        // 3. Status logic: if nextLog was active, prevLog becomes active
        const newStatus = nextLog.status === "active" ? "active" : prevLog.status;

        // Transaction to ensure atomicity
        await prisma.$transaction([
            // Update previous log
            prisma.workLog.update({
                where: { id: previousLogId },
                data: {
                    punchOut: newPunchOut,
                    totalHours: newTotalHours,
                    status: newStatus,
                    // Optionally append notes? Let's keep it simple for now or maybe concat
                },
            }),
            // Delete next log
            prisma.workLog.delete({
                where: { id: nextLogId },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Merge logs error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
