/**
 * Camera barcode scanner hook — Layer 1 of the NexCort ID capture pipeline.
 *
 * Uses the browser-native BarcodeDetector API (Chrome 83+, Edge 83+, Android Chrome)
 * which supports PDF417 natively at no cost.
 *
 * Safari fallback: Since Safari lacks BarcodeDetector, callers should fall back
 * to Textract OCR (send the image to the server for extraction).
 *
 * Usage:
 *   const { scanning, videoRef, start, stop, lastResult, error } = useBarcodeScanner({
 *     onDetected: (barcode) => handleScan(barcode),
 *     formats: ["pdf417"],
 *   });
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── BarcodeDetector API typings (not in TypeScript stdlib yet) ───────────────

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
}

interface BarcodeDetectorClass {
  new (options?: BarcodeDetectorOptions): {
    detect(source: ImageBitmapSource | HTMLVideoElement): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats(): Promise<string[]>;
}

type MaybeBarcodeDetector = {
  BarcodeDetector?: BarcodeDetectorClass;
};

function getBarcodeDetector(): BarcodeDetectorClass | null {
  const w = window as unknown as MaybeBarcodeDetector;
  return w.BarcodeDetector ?? null;
}

export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(getBarcodeDetector());
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBarcodeScanner {
  /** Whether the scanner is actively scanning. */
  scanning: boolean;
  /** Whether the BarcodeDetector API is available. */
  supported: boolean;
  /** Attach this ref to the <video> element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Canvas ref for image capture (Textract fallback). */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Start the camera and begin scanning. */
  start: () => Promise<void>;
  /** Stop the camera. */
  stop: () => void;
  /** Last detected raw barcode string. */
  lastResult: string | null;
  /** Camera/scanner error message. */
  error: string | null;
  /**
   * Capture the current video frame as a base64 JPEG string.
   * Used when handing off to Textract OCR fallback.
   */
  captureFrame: () => string | null;
}

interface UseBarcanneroptions {
  /** Called when a barcode is successfully decoded. */
  onDetected: (rawValue: string, format: string) => void;
  /** Barcode formats to scan for. Defaults to ["pdf417", "qr_code", "code_128"]. */
  formats?: string[];
  /** Scan interval in ms. Defaults to 500ms. */
  intervalMs?: number;
  /** Camera facing mode. Defaults to "environment" (back camera on mobile). */
  facingMode?: "environment" | "user";
}

export function useBarcodeScanner({
  onDetected,
  formats = ["pdf417", "qr_code", "code_128"],
  intervalMs = 500,
  facingMode = "environment",
}: UseBarcanneroptions): UseBarcodeScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorClass> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect support on mount
  useEffect(() => {
    setSupported(isBarcodeDetectorSupported());
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setLastResult(null);

    const BarcodeDetector = getBarcodeDetector();
    if (!BarcodeDetector) {
      setError(
        "Camera barcode scanning is not supported in this browser. " +
          "Use Chrome or Edge, or switch to Textract OCR mode.",
      );
      return;
    }

    // Check if the requested formats are supported
    try {
      const supportedFormats = await BarcodeDetector.getSupportedFormats();
      const availableFormats = formats.filter((f) => supportedFormats.includes(f));
      if (availableFormats.length === 0) {
        setError("PDF417 barcode scanning is not supported on this device.");
        return;
      }
      detectorRef.current = new BarcodeDetector({ formats: availableFormats });
    } catch {
      detectorRef.current = new BarcodeDetector({ formats });
    }

    // Request camera access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        setError("Camera permission denied. Allow camera access and try again.");
      } else if (e.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError(`Camera error: ${e.message}`);
      }
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => null);
    }
    setScanning(true);

    // Poll for barcodes
    const detector = detectorRef.current;
    if (!detector) return;

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const results = await detector.detect(video);
        for (const r of results) {
          if (r.rawValue) {
            setLastResult(r.rawValue);
            onDetected(r.rawValue, r.format);
            // Stop scanning after first successful detection
            stop();
            return;
          }
        }
      } catch {
        // Detection errors are non-fatal (video frame not ready, etc.)
      }
    }, intervalMs);
  }, [formats, intervalMs, facingMode, onDetected, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Return as JPEG base64 (suitable for Textract)
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? null;
  }, []);

  return {
    scanning,
    supported,
    videoRef,
    canvasRef,
    start,
    stop,
    lastResult,
    error,
    captureFrame,
  };
}
