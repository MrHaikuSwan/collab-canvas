"use client";

interface ToolbarProps {
  color: string;
  width: number;
  tool: "pen" | "eraser";
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onToolChange: (tool: "pen" | "eraser") => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearMyChanges: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasMyStrokes: boolean;
}

export default function Toolbar({
  color,
  width,
  tool,
  onColorChange,
  onWidthChange,
  onToolChange,
  onUndo,
  onRedo,
  onClearMyChanges,
  canUndo,
  canRedo,
  hasMyStrokes,
}: ToolbarProps) {
  return (
    <div className="absolute top-6 left-6 z-10 flex flex-col gap-4 rounded-2xl bg-white/95 p-5 shadow-2xl backdrop-blur-md border border-gray-100">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Color</span>
          <div className="relative">
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-xl border-2 border-gray-200 shadow-sm transition-all hover:scale-105 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={tool === "eraser"}
              style={{ padding: '2px' }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Brush Size</span>
          <span className="text-sm font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">{width}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="48"
          value={width}
          onChange={(e) => onWidthChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onToolChange("pen")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            tool === "pen"
              ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 scale-105"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
          </svg>
          Pen
        </button>
        <button
          onClick={() => onToolChange("eraser")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
            tool === "eraser"
              ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-200 scale-105"
              : "bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20H7L3 16 12 7 20 15V20Z"></path>
            <path d="M11 13L17 19"></path>
          </svg>
          Eraser
        </button>
      </div>

      <div className="border-t border-gray-200 pt-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              canUndo
                ? "bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md active:scale-95"
                : "bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            title="Undo (Ctrl+Z)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
            </svg>
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              canRedo
                ? "bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md active:scale-95"
                : "bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            title="Redo (Ctrl+Y)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"></path>
            </svg>
            Redo
          </button>
        </div>
        <button
          onClick={onClearMyChanges}
          disabled={!hasMyStrokes}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            hasMyStrokes
              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-200 active:scale-95"
              : "bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
          Clear My Changes
        </button>
      </div>
    </div>
  );
}

