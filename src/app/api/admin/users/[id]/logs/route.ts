import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkLogs } from "@/lib/api-services";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const events = await getWorkLogs(id, startDate, endDate);

    return NextResponse.json(events);
  } catch (error) {
    console.error("Failed to fetch user logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch user logs" },
      { status: 500 },
    );
  }
}
