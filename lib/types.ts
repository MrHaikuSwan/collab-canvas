import { z } from "zod";

export interface Point {
  x: number;
  y: number;
  t: number; // timestamp in ms
}

export interface Stroke {
  id: string; // UUID
  color: string; // hex color
  width: number; // px stroke width (1-48)
  tool: "pen" | "eraser";
  points: Point[]; // ordered points, max 2000
  clientId?: string; // Optional: ID of the client that created this stroke
}

// Zod schema for validation
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
  t: z.number(),
});

export const StrokeSchema = z.object({
  id: z.string().uuid(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  width: z.number().int().min(1).max(48),
  tool: z.enum(["pen", "eraser"]),
  points: z.array(PointSchema).min(1).max(2000),
  clientId: z.string().uuid().optional(),
});

