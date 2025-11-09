import { NextRequest, NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { clearStrokesByClientId } from "@/lib/strokes-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Remove strokes by this client from server storage
    const removedStrokes = clearStrokesByClientId(clientId);

    // Broadcast removal to all clients via Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "clear-client-strokes", {
      clientId,
      strokeIds: removedStrokes.map((s) => s.id),
    });

    return NextResponse.json(
      { success: true, removedCount: removedStrokes.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error clearing client strokes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

