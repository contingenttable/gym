import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, CameraOff } from 'lucide-react';

// Uses the native BarcodeDetector API (Chrome/Edge) — no paid dependency, no library.
// Falls back gracefully when unsupported.
export default function QrScanner({ onDetect }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      return;
    }
    start();
    return () => stop();
  }, []);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await det.detect(videoRef.current);
          if (codes && codes.length) {
            onDetect(codes[0].rawValue);
            return;
          }
        } catch (e) { /* ignore frame errors */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setError(e.message || 'Camera unavailable');
    }
  };

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <CameraOff className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Camera scanning not supported</p>
        <p className="mt-1 text-xs text-muted-foreground">Use search check-in instead, or open this page in Chrome/Edge.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-900">
      <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
      {!active && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <ScanLine className="h-8 w-8 animate-pulse" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
          <CameraOff className="mb-2 h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {/* Scan reticle */}
      {active && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-40 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        </div>
      )}
    </div>
  );
}