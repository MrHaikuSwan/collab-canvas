import type { Stroke } from "@/lib/types";

// In-memory store for all strokes (lost on server restart, which is fine per spec)
const strokesStore: Stroke[] = [];
const redoStack: Stroke[] = []; // Stack for redo operations

export function addStroke(stroke: Stroke): void {
  strokesStore.push(stroke);
  // Clear redo stack when a new stroke is added
  redoStack.length = 0;
}

export function getAllStrokes(): Stroke[] {
  return [...strokesStore]; // Return a copy to prevent mutations
}

export function clearStrokes(): void {
  strokesStore.length = 0;
  redoStack.length = 0;
}

export function undoStroke(): Stroke | null {
  if (strokesStore.length === 0) return null;
  
  const lastStroke = strokesStore.pop()!;
  redoStack.push(lastStroke);
  return lastStroke;
}

export function redoStroke(): Stroke | null {
  if (redoStack.length === 0) return null;
  
  const stroke = redoStack.pop()!;
  strokesStore.push(stroke);
  return stroke;
}

export function canUndo(): boolean {
  return strokesStore.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

