import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        notificationsEnabled: true,
        timeFormat: true,
        workHours: true,
        workMinutes: true,
        breakMinutes: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET Profile Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      notificationsEnabled,
      timeFormat,
      workHours,
      workMinutes,
      breakMinutes,
    } = body;

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: name !== undefined ? name : undefined,
        notificationsEnabled:
          notificationsEnabled !== undefined ? notificationsEnabled : undefined,
        timeFormat: timeFormat !== undefined ? timeFormat : undefined,
        workHours: workHours !== undefined ? workHours : undefined,
        workMinutes: workMinutes !== undefined ? workMinutes : undefined,
        breakMinutes: breakMinutes !== undefined ? breakMinutes : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        notificationsEnabled: true,
        timeFormat: true,
        workHours: true,
        workMinutes: true,
        breakMinutes: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PUT Profile Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
