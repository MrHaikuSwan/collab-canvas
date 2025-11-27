"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import { v4 as uuidv4 } from "uuid";
import Toolbar from "./Toolbar";
import MenuButton from "./MenuButton";
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
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasMyStrokes, setHasMyStrokes] = useState(false);
  const clientIdRef = useRef<string>(uuidv4()); // Unique ID for this client session
  
  // Undo/redo actions can be either a single stroke or a "clear" action (multiple strokes)
  type UndoRedoAction = 
    | { type: "stroke"; stroke: Stroke }
    | { type: "clear"; strokes: Stroke[] };
  
  const localUndoStackRef = useRef<UndoRedoAction[]>([]); // Local undo stack for this client's actions
  const localRedoStackRef = useRef<UndoRedoAction[]>([]); // Local redo stack for this client's actions

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas by filling it with a subtle off-white
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear stroke tracking
    drawnStrokesRef.current.clear();
    allStrokesRef.current = [];
    localUndoStackRef.current = [];
    localRedoStackRef.current = [];
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
        // Enable image smoothing for better anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
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
        // Track in local undo stack if it's from this client and not already in undo stack
        if (stroke.clientId === clientIdRef.current) {
          // Check if this stroke is already in the undo stack (to prevent duplicates)
          const alreadyInUndoStack = localUndoStackRef.current.some(
            (action) => action.type === "stroke" && action.stroke.id === stroke.id
          );
          if (!alreadyInUndoStack) {
            localUndoStackRef.current.push({ type: "stroke", stroke });
            // Clear redo stack when a new stroke is added
            localRedoStackRef.current = [];
          }
        }
        updateUndoRedoState();
      }
    });

    // Bind to clear events
    channel.bind("clear", () => {
      clearCanvas();
      updateUndoRedoState();
    });

    // Bind to undo events
    channel.bind("undo", (data: { strokeId: string }) => {
      // Find the stroke before removing it
      const strokeIndex = allStrokesRef.current.findIndex((s) => s.id === data.strokeId);
      if (strokeIndex === -1) return; // Stroke not found
      
      const stroke = allStrokesRef.current[strokeIndex];
      
      // Remove from canvas
      removeStroke(data.strokeId);
      
      // Update local stacks if this stroke was from this client
      if (stroke.clientId === clientIdRef.current) {
        // Remove stroke action from undo stack
        localUndoStackRef.current = localUndoStackRef.current.filter(
          (action) => action.type === "stroke" ? action.stroke.id !== data.strokeId : true
        );
        // Add to redo stack (if not already there)
        if (!localRedoStackRef.current.find(
          (action) => action.type === "stroke" && action.stroke.id === data.strokeId
        )) {
          localRedoStackRef.current.push({ type: "stroke", stroke });
        }
      }
      updateUndoRedoState();
    });

    // Bind to redo events
    channel.bind("redo", (data: { stroke: Stroke }) => {
      if (!drawnStrokesRef.current.has(data.stroke.id)) {
        drawStroke(data.stroke);
        drawnStrokesRef.current.add(data.stroke.id);
        allStrokesRef.current.push(data.stroke);
        // Update local stacks if this stroke was from this client
        if (data.stroke.clientId === clientIdRef.current) {
          localUndoStackRef.current.push({ type: "stroke", stroke: data.stroke });
          localRedoStackRef.current = localRedoStackRef.current.filter(
            (action) => action.type === "stroke" ? action.stroke.id !== data.stroke.id : true
          );
        }
        updateUndoRedoState();
      }
    });

    // Bind to clear-client-strokes events
    channel.bind("clear-client-strokes", (data: { clientId: string; strokeIds: string[] }) => {
      // Remove all strokes with the specified IDs (single redraw)
      removeStrokes(data.strokeIds);
      // Update local stacks if these were our strokes
      if (data.clientId === clientIdRef.current) {
        // Don't modify undo/redo stacks here - handleClearMyChanges already handled it
        // The clear action is already in the undo stack
      }
      updateUndoRedoState();
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
                // Track in local undo stack if it's from this client
                if (stroke.clientId === clientIdRef.current) {
                  localUndoStackRef.current.push({ type: "stroke", stroke });
                }
              }
            });
            updateUndoRedoState();
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

  // Update undo/redo button states
  const updateUndoRedoState = () => {
    // Check if this client has strokes to undo/redo
    const myStrokes = allStrokesRef.current.filter(
      (s) => s.clientId === clientIdRef.current
    );
    setCanUndo(myStrokes.length > 0 || localUndoStackRef.current.length > 0);
    setCanRedo(localRedoStackRef.current.length > 0);
    setHasMyStrokes(myStrokes.length > 0);
  };

  // Remove multiple strokes from the canvas by redrawing all other strokes
  const removeStrokes = (strokeIds: string[]) => {
    const canvas = canvasRef.current;
    if (!canvas || strokeIds.length === 0) return;

    // Remove from tracking
    strokeIds.forEach((id) => {
      drawnStrokesRef.current.delete(id);
    });
    allStrokesRef.current = allStrokesRef.current.filter((s) => !strokeIds.includes(s.id));

    // Clear canvas and redraw all remaining strokes
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas by resetting transform and filling with subtle off-white
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set the DPR scaling transform (same as resizeCanvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Redraw all remaining strokes
    allStrokesRef.current.forEach((stroke) => {
      drawStroke(stroke);
    });
  };

  // Remove a stroke from the canvas by redrawing all other strokes
  const removeStroke = (strokeId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Remove from tracking
    drawnStrokesRef.current.delete(strokeId);
    allStrokesRef.current = allStrokesRef.current.filter((s) => s.id !== strokeId);

    // Clear canvas and redraw all remaining strokes
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas by resetting transform and filling with subtle off-white
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set the DPR scaling transform (same as resizeCanvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Redraw all remaining strokes
    allStrokesRef.current.forEach((stroke) => {
      drawStroke(stroke);
    });
  };

  // Handle undo button click - undo last action by this client
  const handleUndo = () => {
    if (localUndoStackRef.current.length === 0) return;
    
    // Pop the last action from undo stack
    const action = localUndoStackRef.current.pop()!;
    
    if (action.type === "clear") {
      // Restore all cleared strokes
      action.strokes.forEach((stroke) => {
        if (!drawnStrokesRef.current.has(stroke.id)) {
          drawStroke(stroke);
          drawnStrokesRef.current.add(stroke.id);
          allStrokesRef.current.push(stroke);
        }
      });
      
      // Move clear action to redo stack
      localRedoStackRef.current.push(action);
      
      // Broadcast restore for each stroke (or we could create a restore endpoint)
      action.strokes.forEach((stroke) => {
        fetch("/api/broadcast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(stroke),
        }).catch((error) => {
          console.error("Error broadcasting restored stroke:", error);
        });
      });
    } else {
      // Undo a single stroke
      const strokeToUndo = action.stroke;
      
      // Remove from all strokes
      removeStroke(strokeToUndo.id);
      
      // Move stroke action to redo stack
      localRedoStackRef.current.push(action);
      
      // Broadcast undo event
      fetch("/api/undo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ strokeId: strokeToUndo.id }),
      }).catch((error) => {
        console.error("Error broadcasting undo:", error);
      });
    }
    
    updateUndoRedoState();
  };

  // Handle clear my changes button click
  const handleClearMyChanges = () => {
    // Find all strokes created by this client
    const myStrokes = allStrokesRef.current.filter(
      (s) => s.clientId === clientIdRef.current
    );

    if (myStrokes.length === 0) return;

    const strokeIds = myStrokes.map((s) => s.id);

    // Remove all strokes by this client locally (single redraw)
    removeStrokes(strokeIds);

    // Create a clear action and add it to undo stack
    const clearAction: UndoRedoAction = {
      type: "clear",
      strokes: [...myStrokes], // Make a copy
    };
    localUndoStackRef.current.push(clearAction);

    // Clear redo stack when a new action is added
    localRedoStackRef.current = [];

    updateUndoRedoState();

    // Call API to remove from server and broadcast to all clients
    fetch("/api/clear-client-strokes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId: clientIdRef.current }),
    }).catch((error) => {
      console.error("Error clearing my strokes:", error);
    });
  };

  // Handle redo button click - redo last undone action by this client
  const handleRedo = () => {
    if (localRedoStackRef.current.length === 0) return;
    
    // Pop the last action from redo stack
    const action = localRedoStackRef.current.pop()!;
    
    if (action.type === "clear") {
      // Re-apply the clear action (remove all strokes again)
      const strokeIds = action.strokes.map((s) => s.id);
      removeStrokes(strokeIds);
      
      // Move clear action back to undo stack
      localUndoStackRef.current.push(action);
      
      // Broadcast clear event
      fetch("/api/clear-client-strokes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: clientIdRef.current }),
      }).catch((error) => {
        console.error("Error broadcasting clear:", error);
      });
    } else {
      // Redo a single stroke
      const strokeToRedo = action.stroke;
      
      // Add back to all strokes
      if (!drawnStrokesRef.current.has(strokeToRedo.id)) {
        drawStroke(strokeToRedo);
        drawnStrokesRef.current.add(strokeToRedo.id);
        allStrokesRef.current.push(strokeToRedo);
        localUndoStackRef.current.push(action);
      }
      
      // Broadcast redo event
      fetch("/api/redo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stroke: strokeToRedo }),
      }).catch((error) => {
        console.error("Error broadcasting redo:", error);
      });
    }
    
    updateUndoRedoState();
  };

  // Draw a stroke on the canvas (used for both local and remote strokes)
  const drawStroke = (stroke: Stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Enable image smoothing for consistent, smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color; // Set fillStyle for single-point strokes
    }

    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    if (stroke.points.length === 0) return;

    ctx.beginPath();
    
    if (stroke.points.length === 1) {
      // Single point - draw a circle
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (stroke.points.length === 2) {
      // Two points - draw a simple line
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
      ctx.stroke();
    } else {
      // Multiple points - use quadratic curves for smooth lines
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      
      // Draw to the last point
      const last = stroke.points[stroke.points.length - 1];
      const secondLast = stroke.points[stroke.points.length - 2];
      ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
      
      ctx.stroke();
    }
    
    ctx.restore();
  };

  // Draw current stroke smoothly (for local optimistic rendering)
  const drawCurrentStroke = () => {
    const points = currentStrokeRef.current;
    if (points.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Enable image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle = color; // Set fillStyle for single-point strokes
    }
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    ctx.beginPath();
    
    if (points.length === 1) {
      // Single point - draw a circle
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (points.length === 2) {
      // Two points - draw a simple line
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else {
      // Multiple points - use quadratic curves for smooth lines
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      
      // Draw to the last point
      const last = points[points.length - 1];
      const secondLast = points[points.length - 2];
      ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
      
      ctx.stroke();
    }
    
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
      ctx.fillStyle = color; // Set fillStyle for single-point strokes
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();

      return;
    }

    currentStrokeRef.current.push(point);

    // Redraw the entire current stroke smoothly
    // First, clear the area where we're drawing by redrawing all existing strokes
    // Then draw the current stroke smoothly
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and redraw all strokes, then draw current stroke
    // This ensures smooth rendering
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Redraw all existing strokes
    allStrokesRef.current.forEach((stroke) => {
      drawStroke(stroke);
    });

    // Draw current stroke smoothly
    drawCurrentStroke();
  };

  const handlePointerUp = async (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    setIsDrawing(false);

    let points = currentStrokeRef.current;
    
    // Fix: Ensure the last point is captured if pointer event is available
    // This prevents the last point from disappearing
    if (e && points.length > 0) {
      const lastPoint = getPointFromEvent(e);
      const lastStoredPoint = points[points.length - 1];
      // Only add if it's different from the last stored point
      if (lastPoint.x !== lastStoredPoint.x || lastPoint.y !== lastStoredPoint.y) {
        points = [...points, lastPoint];
      }
    }
    
    if (points.length === 0) {
      currentStrokeRef.current = [];
      return;
    }

    // Ensure points array doesn't exceed 2000
    let finalPoints = points;
    if (points.length > 2000) {
      // Downsample: take every nth point, but always keep first and last
      const step = Math.ceil(points.length / 2000);
      const downsampled = points.filter((_, i) => i % step === 0);
      // Ensure last point is included
      if (downsampled[downsampled.length - 1] !== points[points.length - 1]) {
        downsampled.push(points[points.length - 1]);
      }
      finalPoints = downsampled;
    }

    // Create stroke object
    const stroke: Stroke = {
      id: uuidv4(),
      color,
      width,
      tool,
      points: finalPoints,
      clientId: clientIdRef.current, // Include client ID
    };

    // Estimate payload size and downsample if needed
    const estimateSize = (s: Stroke): number => {
      const json = JSON.stringify(s);
      return new Blob([json]).size;
    };

    let strokeToSend = stroke;
    let payloadSize = estimateSize(strokeToSend);
    const MAX_SIZE = 10 * 1024; // 10KB

    // If too large, downsample points (but always keep first and last)
    if (payloadSize > MAX_SIZE && finalPoints.length > 1) {
      let currentPoints = finalPoints;
      while (payloadSize > MAX_SIZE && currentPoints.length > 1) {
        // Remove every other point, but always keep first and last
        const filtered = currentPoints.filter((_, i) => i % 2 === 0);
        // Ensure last point is included if it was removed
        if (filtered[filtered.length - 1] !== currentPoints[currentPoints.length - 1]) {
          filtered.push(currentPoints[currentPoints.length - 1]);
        }
        currentPoints = filtered;
        strokeToSend = { ...stroke, points: currentPoints };
        payloadSize = estimateSize(strokeToSend);
      }
    }

    // Fix: Add stroke to tracking IMMEDIATELY to prevent double-drawing
    // This ensures that when the Pusher event arrives, it won't redraw the stroke
    drawnStrokesRef.current.add(strokeToSend.id);
    allStrokesRef.current.push(strokeToSend);
    if (strokeToSend.clientId === clientIdRef.current) {
      localUndoStackRef.current.push({ type: "stroke", stroke: strokeToSend });
      localRedoStackRef.current = [];
    }
    updateUndoRedoState();

    // Clear current stroke ref before redrawing to prevent interference
    currentStrokeRef.current = [];

    // Clear the optimistic drawing and redraw with the final stroke
    // This ensures consistency and prevents visual artifacts
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Redraw all strokes including the final version of the current stroke
        allStrokesRef.current.forEach((stroke) => {
          drawStroke(stroke);
        });
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
        // Stroke is already tracked above, so we don't need to do anything here
        // The Pusher event handler will check drawnStrokesRef and skip drawing
      })
      .catch((error) => {
        console.error("Error broadcasting stroke:", error);
        // On error, remove from tracking so it can be retried if needed
        drawnStrokesRef.current.delete(strokeToSend.id);
        allStrokesRef.current = allStrokesRef.current.filter((s) => s.id !== strokeToSend.id);
        if (strokeToSend.clientId === clientIdRef.current) {
          localUndoStackRef.current = localUndoStackRef.current.filter(
            (action) => action.type === "stroke" ? action.stroke.id !== strokeToSend.id : true
          );
        }
        updateUndoRedoState();
        
        // Redraw canvas without the failed stroke
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#fafafa";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Redraw all remaining strokes
            allStrokesRef.current.forEach((stroke) => {
              drawStroke(stroke);
            });
          }
        }
      });
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearMyChanges={handleClearMyChanges}
        canUndo={canUndo}
        canRedo={canRedo}
        hasMyStrokes={hasMyStrokes}
      />
      <MenuButton onReset={handleReset} />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ backgroundColor: '#fafafa' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}

