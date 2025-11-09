import { NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { clearStrokes } from "@/lib/strokes-store";

export async function POST() {
  try {
    // Clear strokes from memory
    clearStrokes();

    // Broadcast clear event to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "clear", {});

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error clearing canvas:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

