import { NextRequest, NextResponse } from "next/server";
import { getPusher } from "@/lib/pusher";
import { StrokeSchema } from "@/lib/types";
import { addStroke } from "@/lib/strokes-store";

// Estimate payload size: each point is ~5 bytes (x, y, t as numbers + JSON overhead)
// Stroke object overhead: ~100 bytes (id, color, width, tool, array structure)
const MAX_PAYLOAD_SIZE_BYTES = 10 * 1024; // 10KB

function estimatePayloadSize(stroke: { points: Array<{ x: number; y: number; t: number }> }): number {
  // Rough estimate: JSON.stringify overhead + data
  const jsonString = JSON.stringify(stroke);
  return new Blob([jsonString]).size;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = StrokeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid stroke data", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const stroke = validationResult.data;

    // Check payload size
    const payloadSize = estimatePayloadSize(stroke);
    if (payloadSize > MAX_PAYLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Payload too large", size: payloadSize, max: MAX_PAYLOAD_SIZE_BYTES },
        { status: 400 }
      );
    }

    // Store stroke in memory
    addStroke(stroke);

    // Emit to Pusher
    const pusher = getPusher();
    await pusher.trigger("room-global", "stroke", stroke);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error broadcasting stroke:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
