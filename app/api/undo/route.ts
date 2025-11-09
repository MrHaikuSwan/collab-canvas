import { NextRequest, NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strokeId } = body;

    if (!strokeId) {
      return NextResponse.json(
        { error: "strokeId is required" },
        { status: 400 }
      );
    }

    // Broadcast undo event to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "undo", { strokeId });

    return NextResponse.json({ success: true, strokeId }, { status: 200 });
  } catch (error) {
    console.error("Error broadcasting undo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

