"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const VIEW = 280;

function placement(width: number, height: number, zoom: number, offset: { x: number; y: number }) {
  const scale = (VIEW / Math.min(width, height)) * zoom;
  const drawW = width * scale;
  const drawH = height * scale;
  return {
    drawW,
    drawH,
    dx: (VIEW - drawW) / 2 + offset.x,
    dy: (VIEW - drawH) / 2 + offset.y,
  };
}

/** Circular crop. The caller keeps the original file for a later recrop. */
export function PhotoCropDialog({ file, onCancel, onConfirm }: Props) {
  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const box = natural.width ? placement(natural.width, natural.height, zoom, offset) : null;

  async function confirm() {
    const image = imageRef.current;
    if (!image || !box) return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(512 / VIEW, 512 / VIEW);
    context.beginPath();
    context.arc(VIEW / 2, VIEW / 2, VIEW / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(image, box.dx, box.dy, box.drawW, box.drawH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size > 5_000_000) {
      setError("That crop is over 5 MB. Zoom out and try again.");
      return;
    }
    onConfirm(new File([blob], "profile.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-slate-900 shadow-2xl">
        <h2 id="crop-title" className="text-lg font-semibold">Edit photo</h2>
        <p className="mt-1 text-sm text-slate-500">Drag to reposition. The circle is what visitors see.</p>
        <div
          className="relative mx-auto mt-4 h-[280px] w-[280px] touch-none overflow-hidden rounded-full bg-slate-200"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setOffset({
              x: drag.current.ox + event.clientX - drag.current.x,
              y: drag.current.oy + event.clientY - drag.current.y,
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {url ? (
            <img
              ref={imageRef}
              alt=""
              src={url}
              draggable={false}
              className="absolute max-w-none select-none"
              style={box ? { left: box.dx, top: box.dy, width: box.drawW, height: box.drawH } : undefined}
              onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError("This photo could not be opened. Use a JPG, PNG, or WebP.")}
            />
          ) : null}
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Zoom
          <input className="mt-1 w-full accent-violet-700" type="range" min={1} max={2.6} step={0.02} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        {error ? <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={onCancel}>Cancel</button>
          <button type="button" className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void confirm()}>Use photo</button>
        </div>
      </div>
    </div>
  );
}
