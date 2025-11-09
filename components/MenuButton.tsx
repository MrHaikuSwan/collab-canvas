"use client";

import { useState } from "react";

interface MenuButtonProps {
  onReset: () => void;
}

export default function MenuButton({ onReset }: MenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-6 z-10">
      {isOpen && (
        <div className="mb-3 rounded-2xl bg-white/95 p-3 shadow-2xl backdrop-blur-md border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => {
              onReset();
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-all hover:from-red-600 hover:to-pink-700 hover:shadow-xl active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
            Reset Canvas
          </button>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border-2 border-gray-300 shadow-xl transition-all hover:shadow-2xl hover:scale-105 hover:border-gray-400 active:scale-95"
        aria-label="Menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`h-6 w-6 text-gray-700 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
          />
        </svg>
      </button>
    </div>
  );
}

