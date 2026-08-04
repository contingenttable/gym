import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const DEFAULT_DURATION = 15000; // 15 seconds

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const timersRef = useRef({});

  useEffect(() => {
    // Start a timer for every toast that doesn't have one yet
    toasts.forEach((t) => {
      if (timersRef.current[t.id]) return; // already scheduled
      const ms = typeof t.duration === 'number' ? t.duration : DEFAULT_DURATION;
      timersRef.current[t.id] = setTimeout(() => {
        dismiss(t.id);
        delete timersRef.current[t.id];
      }, ms);
    });

    // Clear timers for toasts that have already been removed
    const activeIds = new Set(toasts.map((t) => t.id));
    Object.keys(timersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    });
  }, [toasts, dismiss]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
