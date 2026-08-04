/**
 * toaster.jsx — uses sonner's Toaster component.
 * Sonner handles auto-dismiss, animations, swipe, and stacking natively.
 */
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      duration={15000}
      richColors
      closeButton
      toastOptions={{
        style: {
          fontFamily: 'inherit',
          fontSize: '14px',
        },
      }}
    />
  );
}
