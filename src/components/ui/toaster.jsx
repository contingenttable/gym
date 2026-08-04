import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

// Default auto-dismiss after 2 seconds.
// Individual toasts can override with a `duration` prop (ms).
const DEFAULT_DURATION = 2000;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // Auto-dismiss each toast after its duration
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => {
      const ms = t.duration ?? DEFAULT_DURATION;
      return setTimeout(() => dismiss(t.id), ms);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

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
