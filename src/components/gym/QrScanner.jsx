import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, CameraOff, CheckCircle2 } from 'lucide-react';

// Uses the native BarcodeDetector API (Chrome/Edge/Android WebView).
// Falls back gracefully when unsupported.
// After each scan there is a 2-second cooldown before scanning resumes,
// so the next member can step up without a double-trigger.
export default function QrScanner({ onDetect }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const coolRef    = useRef(false); // true during the 2-s cooldown
  const [supported, setSupported] = useState(true);
  const [error, setError]         = useState(null);
  const [active, setActive]       = useState(false);
  const [lastScan, setLastScan]   = useState(null); // name/token of last scan for UI feedback

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      return;
    }
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const startCamera = async () => {
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
      setError(null);

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      const tick = async () => {
        if (!videoRef.current || coolRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const value = codes[0].rawValue;
            // Enter cooldown — resume scanning after 2 s
            coolRef.current = true;
            setLastScan(value);
            onDetect(value);
            setTimeout(() => {
              coolRef.current = false;
              setLastScan(null);
            }, 2000);
          }
        } catch { /* ignore per-frame errors */ }
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
        <p className="mt-1 text-xs text-muted-foreground">
          Use the Search tab instead, or open in Chrome / Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-900">
      <video
        ref={videoRef}
        className="h-64 w-full object-cover"
        playsInline
        muted
      />

      {/* Loading state */}
      {!active && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <ScanLine className="h-8 w-8 animate-pulse" />
        </div>
      )}

      {/* Camera error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
          <CameraOff className="h-8 w-8" />
          <p className="text-sm">{error}</p>
          <button
            onClick={startCamera}
            className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scan reticle — dims during cooldown */}
      {active && !lastScan && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-44 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
      )}

      {/* Scanned feedback overlay — shows for the 2-s cooldown */}
      {active && lastScan && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-900/70 backdrop-blur-sm">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <p className="text-sm font-semibold text-white">QR detected</p>
          <p className="text-xs text-emerald-200">Ready again in 2 s…</p>
        </div>
      )}
    </div>
  );
}
