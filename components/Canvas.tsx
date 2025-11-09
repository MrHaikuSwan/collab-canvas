"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import { v4 as uuidv4 } from "uuid";
import Toolbar from "./Toolbar";
import type { Stroke, Point } from "@/lib/types";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(5);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);
  const drawnStrokesRef = useRef<Set<string>>(new Set()); // Track which strokes we've already drawn
  const allStrokesRef = useRef<Stroke[]>([]); // Store all strokes so we can redraw after resize

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas by filling it with white
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.scale(dpr, dpr);

    // Clear stroke tracking
    drawnStrokesRef.current.clear();
    allStrokesRef.current = [];
  };

  // Handle reset button click
  const handleReset = () => {
    // Clear local canvas immediately
    clearCanvas();

    // Call API to clear server-side storage and broadcast to all clients
    fetch("/api/clear", {
      method: "POST",
    }).catch((error) => {
      console.error("Error clearing canvas:", error);
    });
  };

  // Initialize canvas and Pusher
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Redraw all strokes (used after resize to restore canvas content)
    const redrawAllStrokes = () => {
      allStrokesRef.current.forEach((stroke) => {
        drawStroke(stroke);
      });
    };

    // Set canvas size to window dimensions
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Set CSS size
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      // Set actual canvas resolution (scaled by DPR for crisp rendering)
      // Note: Setting width/height clears the canvas, so we need to redraw after
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      // Redraw all strokes after resize
      redrawAllStrokes();
    };

    // Use requestAnimationFrame to ensure canvas is mounted and parent is sized
    // Also call immediately in case RAF hasn't fired yet
    resizeCanvas();
    requestAnimationFrame(() => {
      resizeCanvas();
      // Double-check after a short delay to ensure it's correct
      setTimeout(() => resizeCanvas(), 100);
    });
    
    window.addEventListener("resize", resizeCanvas);

    // Initialize Pusher
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.error("Missing Pusher environment variables");
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    pusherRef.current = pusher;

    // Subscribe to channel
    const channel = pusher.subscribe("room-global");
    channelRef.current = channel;

    // Bind to stroke events
    channel.bind("stroke", (stroke: Stroke) => {
      // Only draw if we haven't drawn this stroke already (prevents duplicates)
      if (!drawnStrokesRef.current.has(stroke.id)) {
        drawStroke(stroke);
        drawnStrokesRef.current.add(stroke.id);
        // Store stroke so we can redraw after resize
        allStrokesRef.current.push(stroke);
      }
    });

    // Bind to clear events
    channel.bind("clear", () => {
      clearCanvas();
    });

    // Fetch existing strokes and draw them
    // Wait for all resize operations to complete before fetching
    setTimeout(() => {
      fetch("/api/strokes")
        .then((res) => res.json())
        .then((data) => {
          if (data.strokes && Array.isArray(data.strokes)) {
            // Store all strokes first
            allStrokesRef.current = data.strokes;
            // Draw all existing strokes
            data.strokes.forEach((stroke: Stroke) => {
              if (!drawnStrokesRef.current.has(stroke.id)) {
                drawStroke(stroke);
                drawnStrokesRef.current.add(stroke.id);
              }
            });
          }
        })
        .catch((error) => {
          console.error("Error fetching existing strokes:", error);
        });
    }, 150); // Wait for all resize operations to complete

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current.unsubscribe();
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, []);

  // Draw a stroke on the canvas
  const drawStroke = (stroke: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }

    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.points.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  };

  // Throttle points to keep payload manageable
  const shouldAddPoint = (points: Point[]): boolean => {
    // Add point if array is empty or if enough time has passed
    if (points.length === 0) return true;
    
    const lastPoint = points[points.length - 1];
    const now = Date.now();
    const timeSinceLastPoint = now - lastPoint.t;
    
    // Add point if more than 16ms has passed (~60fps) or if distance is significant
    return timeSinceLastPoint > 16;
  };

  const getPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, t: Date.now() };

    const rect = canvas.getBoundingClientRect();
    // Since we scale the context by DPR, coordinates should be in CSS pixels
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const point = getPointFromEvent(e);
    currentStrokeRef.current = [point];

    // Draw first point immediately
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const point = getPointFromEvent(e);

    // Throttle points
    if (!shouldAddPoint(currentStrokeRef.current)) {
      // Still draw to the last point for smooth rendering
      const lastPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();

      return;
    }

    currentStrokeRef.current.push(point);

    // Draw locally (optimistic)
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const points = currentStrokeRef.current;
    if (points.length < 2) return;

    ctx.save();
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerUp = async () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    const points = currentStrokeRef.current;
    if (points.length === 0) return;

    // Ensure points array doesn't exceed 2000
    let finalPoints = points;
    if (points.length > 2000) {
      // Downsample: take every nth point
      const step = Math.ceil(points.length / 2000);
      finalPoints = points.filter((_, i) => i % step === 0);
    }

    // Create stroke object
    const stroke: Stroke = {
      id: uuidv4(),
      color,
      width,
      tool,
      points: finalPoints,
    };

    // Estimate payload size and downsample if needed
    const estimateSize = (s: Stroke): number => {
      const json = JSON.stringify(s);
      return new Blob([json]).size;
    };

    let strokeToSend = stroke;
    let payloadSize = estimateSize(strokeToSend);
    const MAX_SIZE = 10 * 1024; // 10KB

    // If too large, downsample points
    if (payloadSize > MAX_SIZE && finalPoints.length > 1) {
      let currentPoints = finalPoints;
      while (payloadSize > MAX_SIZE && currentPoints.length > 1) {
        // Remove every other point
        currentPoints = currentPoints.filter((_, i) => i % 2 === 0);
        strokeToSend = { ...stroke, points: currentPoints };
        payloadSize = estimateSize(strokeToSend);
      }
    }

    // POST to API (don't await, but catch errors)
    fetch("/api/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strokeToSend),
    })
      .then(() => {
        // Mark this stroke as drawn so we don't redraw it when it comes back via Pusher
        drawnStrokesRef.current.add(strokeToSend.id);
        // Store stroke so we can redraw after resize
        allStrokesRef.current.push(strokeToSend);
      })
      .catch((error) => {
        console.error("Error broadcasting stroke:", error);
      });

    currentStrokeRef.current = [];
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <Toolbar
        color={color}
        width={width}
        tool={tool}
        onColorChange={setColor}
        onWidthChange={setWidth}
        onToolChange={setTool}
        onReset={handleReset}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}

