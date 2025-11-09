"use client";

import { useState } from "react";

interface MenuButtonProps {
  onReset: () => void;
}

export default function MenuButton({ onReset }: MenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      {isOpen && (
        <div className="mb-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
          <button
            onClick={() => {
              onReset();
              setIsOpen(false);
            }}
            className="w-full rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 active:bg-red-700"
          >
            Reset Canvas
          </button>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 bg-white shadow-lg transition-all hover:border-gray-400 hover:shadow-xl active:scale-95"
        aria-label="Menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`h-5 w-5 text-gray-700 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
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

