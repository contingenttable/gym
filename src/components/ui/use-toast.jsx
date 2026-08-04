/**
 * use-toast.jsx — thin wrapper around sonner so all existing
 * code that calls `const { toast } = useToast()` keeps working unchanged.
 *
 * Sonner handles auto-dismiss, animations, stacking, and swipe-to-dismiss
 * natively — no custom timer logic needed.
 */
import { toast as sonnerToast } from 'sonner';

/**
 * Maps the old shadcn toast({ title, description, variant, duration }) API
 * to sonner's API.
 */
function toast({ title, description, variant, duration, ...rest }) {
  const message = title || '';
  const opts = {
    description,
    duration: typeof duration === 'number' ? duration : 15000,
    ...rest,
  };

  if (variant === 'destructive') {
    return sonnerToast.error(message, opts);
  }
  return sonnerToast(message, opts);
}

// Keep the dismiss API compatible
toast.dismiss = sonnerToast.dismiss;
toast.error   = sonnerToast.error;
toast.success = sonnerToast.success;

/**
 * useToast() — drop-in replacement.
 * Returns { toast, dismiss } matching the old API.
 */
function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
    // Legacy compat — pages that destructure `toasts` get an empty array
    toasts: [],
  };
}

export { useToast, toast };
