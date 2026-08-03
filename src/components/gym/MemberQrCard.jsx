import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useOutletContext } from 'react-router-dom';
import MemberAvatar from './MemberAvatar';

// QR is generated from the member's OPAQUE token only — no personal data is embedded.
function qrImageUrl(token) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(token)}`;
}

export default function MemberQrCard({ open, onOpenChange, member }) {
  const { settings } = useOutletContext();
  const printRef = useRef(null);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
      <html><head><title>QR Card - ${member?.full_name || ''}</title>
      <style>
        body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh}
        .card{width:320px;border-radius:20px;overflow:hidden;background:#0f172a;color:white;padding:24px;text-align:center}
        .brand{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#34d399;font-weight:700}
        .name{font-size:20px;font-weight:700;margin:8px 0 2px}
        .id{font-size:13px;color:#94a3b8;margin-bottom:16px}
        img{width:240px;height:240px;border-radius:12px;background:white;padding:8px}
        .hint{font-size:11px;color:#64748b;margin-top:12px}
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Member QR Card</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="overflow-hidden rounded-2xl bg-slate-900 p-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">{settings?.gym_name || 'FitCore Gym'}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Membership Pass</p>
          <div className="mt-4 flex justify-center">
            {member?.qr_token ? (
              <img src={qrImageUrl(member.qr_token)} alt="QR code" className="h-48 w-48 rounded-xl bg-white p-2" />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-800 text-slate-500 text-sm">No QR token</div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <MemberAvatar member={member} size="md" className="ring-slate-700" />
            <div className="text-left">
              <p className="font-bold text-white">{member?.full_name}</p>
              <p className="text-xs text-slate-400">{member?.member_id}</p>
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-500">Scan at reception to check in. Card is non-transferable.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}