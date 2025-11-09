import { NextResponse } from "next/server";
import { canUndo, canRedo } from "@/lib/strokes-store";

export async function GET() {
  try {
    return NextResponse.json(
      {
        canUndo: canUndo(),
        canRedo: canRedo(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking undo/redo state:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

