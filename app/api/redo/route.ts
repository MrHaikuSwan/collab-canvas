import { NextRequest, NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { StrokeSchema } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stroke } = body;

    if (!stroke) {
      return NextResponse.json(
        { error: "stroke is required" },
        { status: 400 }
      );
    }

    // Validate stroke
    const validationResult = StrokeSchema.safeParse(stroke);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid stroke data", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    // Broadcast redo event to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "redo", { stroke: validationResult.data });

    return NextResponse.json({ success: true, stroke: validationResult.data }, { status: 200 });
  } catch (error) {
    console.error("Error broadcasting redo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

