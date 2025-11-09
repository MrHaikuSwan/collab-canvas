import { NextResponse } from "next/server";
import { getAllStrokes } from "@/lib/strokes-store";

export async function GET() {
  try {
    const strokes = getAllStrokes();
    return NextResponse.json({ strokes }, { status: 200 });
  } catch (error) {
    console.error("Error fetching strokes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

