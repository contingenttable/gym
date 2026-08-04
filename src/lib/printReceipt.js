/**
 * printReceipt.js — safe receipt printer using DOM APIs instead of
 * document.write() with template literals (which was XSS-prone).
 */

/** Escape a value for safe text rendering */
const esc = (v) => String(v ?? '');

/**
 * printReceipt({ payment, member, settings, symbol, balance })
 * Opens a small print popup with the receipt. No template literal injection.
 */
export function printReceipt({ payment: p, member: m, settings, symbol = '₹', balance }) {
  const w = window.open('', '_blank', 'width=400,height=640');
  if (!w) return;

  const doc = w.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title></head><body></body></html>');
  doc.close();

  // Styles
  const style = doc.createElement('style');
  style.textContent = `
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#0f172a;margin:0}
    h1{font-size:18px;margin:0 0 2px}
    .muted{color:#64748b;font-size:12px}
    .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px dashed #e2e8f0}
    .total{font-weight:700;font-size:16px}
    .center{text-align:center;margin:12px 0}
  `;
  doc.head.appendChild(style);

  const body = doc.body;

  const addCenter = (tag, text, cls) => {
    const el = doc.createElement(tag);
    el.className = cls || '';
    el.textContent = text;
    body.appendChild(el);
  };

  const addRow = (label, value, bold) => {
    const row = doc.createElement('div');
    row.className = 'row' + (bold ? ' total' : '');
    const l = doc.createElement('span');
    l.textContent = esc(label);
    const v = doc.createElement(bold ? 'b' : 'span');
    v.textContent = esc(value);
    row.appendChild(l);
    row.appendChild(v);
    body.appendChild(row);
  };

  // Header
  const hdr = doc.createElement('div');
  hdr.className = 'center';
  const h1 = doc.createElement('h1');
  h1.textContent = esc(settings?.gym_name || 'GYM');
  const addr = doc.createElement('div');
  addr.className = 'muted';
  addr.textContent = esc(settings?.address || '');
  hdr.appendChild(h1);
  hdr.appendChild(addr);
  body.appendChild(hdr);

  addRow('Receipt', p.receipt_number, true);
  addRow('Member', m?.full_name || p.member_name);
  addRow('Member ID', m?.member_id || '');
  addRow('Date', p.payment_date);
  addRow('Mode', p.mode);
  if (p.reference_number) addRow('Reference', p.reference_number);
  addRow('Amount', `${symbol}${Number(p.amount || 0).toLocaleString('en-IN')}`, true);
  if (balance !== undefined) addRow('Balance', `${symbol}${Number(balance || 0).toLocaleString('en-IN')}`);

  const thanks = doc.createElement('div');
  thanks.className = 'center muted';
  thanks.textContent = 'Thank you for your payment!';
  body.appendChild(thanks);

  setTimeout(() => w.print(), 300);
}
