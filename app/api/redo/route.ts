import { NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { redoStroke, canRedo } from "@/lib/strokes-store";

export async function POST() {
  try {
    if (!canRedo()) {
      return NextResponse.json(
        { error: "Nothing to redo" },
        { status: 400 }
      );
    }

    const redoneStroke = redoStroke();
    if (!redoneStroke) {
      return NextResponse.json(
        { error: "Nothing to redo" },
        { status: 400 }
      );
    }

    // Broadcast redo event to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "redo", { stroke: redoneStroke });

    return NextResponse.json({ success: true, stroke: redoneStroke }, { status: 200 });
  } catch (error) {
    console.error("Error redoing stroke:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

