import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.user || !session.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, message, type } = body;

    if (!userId || !message || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (type !== "ONE_TIME" && type !== "ALL_TIME") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        message,
        type,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 },
    );
  }
}
