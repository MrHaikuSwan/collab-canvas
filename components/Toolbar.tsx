"use client";

import { useState } from "react";

interface ToolbarProps {
  color: string;
  width: number;
  tool: "pen" | "eraser";
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onToolChange: (tool: "pen" | "eraser") => void;
  onReset: () => void;
}

export default function Toolbar({
  color,
  width,
  tool,
  onColorChange,
  onWidthChange,
  onToolChange,
  onReset,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 rounded-lg bg-white/90 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Color:</label>
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-8 w-16 cursor-pointer rounded border border-gray-300"
          disabled={tool === "eraser"}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Width:</label>
        <input
          type="range"
          min="1"
          max="48"
          value={width}
          onChange={(e) => onWidthChange(Number(e.target.value))}
          className="h-2 w-24 cursor-pointer rounded-lg bg-gray-200"
        />
        <span className="text-xs text-gray-600">{width}px</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToolChange("pen")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "pen"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Pen
        </button>
        <button
          onClick={() => onToolChange("eraser")}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            tool === "eraser"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Eraser
        </button>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <button
          onClick={onReset}
          className="w-full rounded bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          Reset Canvas
        </button>
      </div>
    </div>
  );
}

