import { NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { undoStroke, canUndo } from "@/lib/strokes-store";

export async function POST() {
  try {
    if (!canUndo()) {
      return NextResponse.json(
        { error: "Nothing to undo" },
        { status: 400 }
      );
    }

    const undoneStroke = undoStroke();
    if (!undoneStroke) {
      return NextResponse.json(
        { error: "Nothing to undo" },
        { status: 400 }
      );
    }

    // Broadcast undo event to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "undo", { strokeId: undoneStroke.id });

    return NextResponse.json({ success: true, strokeId: undoneStroke.id }, { status: 200 });
  } catch (error) {
    console.error("Error undoing stroke:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

