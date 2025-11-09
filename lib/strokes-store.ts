import type { Stroke } from "@/lib/types";

// In-memory store for all strokes (lost on server restart, which is fine per spec)
const strokesStore: Stroke[] = [];

export function addStroke(stroke: Stroke): void {
  strokesStore.push(stroke);
}

export function getAllStrokes(): Stroke[] {
  return [...strokesStore]; // Return a copy to prevent mutations
}

export function clearStrokes(): void {
  strokesStore.length = 0;
}

