// Map pin pictures, drawn once and shared as data URLs (a bare canvas would make
// Cesium keep one copy per pin). Style taken from Ton's screenshot: a coloured icon
// with a white vehicle symbol and a white ring; several types sit in one white pill.
export const MODE_COLORS = {metro: '#ff6319', train: '#8c4799', tram: '#00985f', ferry: '#00b9e4', bus: '#0974b9'};
export const SQUARE_MODES = new Set(['bus', 'metro', 'train']);
const ICON = 20, RING = 2.5, GAP = 3, EDGE = 'rgba(16, 32, 36, 0.45)';

// White vehicle symbol in a 20 x 20 box; `hole` is the icon colour for windows and lights.
function symbol(ctx, mode, hole) {
 const rect = (x, y, w, h, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
 const dot = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
 if (mode === 'tram') {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8, 3.6); ctx.lineTo(12, 3.6); ctx.moveTo(10, 3.6); ctx.lineTo(10, 5.2); ctx.stroke();
  rect(6.6, 5.2, 6.8, 10.2, 2, '#fff'); rect(7.7, 6.6, 4.6, 3.6, 0.8, hole); dot(8.6, 13.3, 0.75, hole); dot(11.4, 13.3, 0.75, hole);
 } else if (mode === 'bus') {
  rect(4.4, 4.2, 11.2, 10.6, 2, '#fff'); rect(5.7, 5.6, 8.6, 4.6, 1, hole); dot(7.1, 12.6, 0.85, hole); dot(12.9, 12.6, 0.85, hole);
  rect(5.4, 14.4, 2.2, 1.8, 0.6, '#fff'); rect(12.4, 14.4, 2.2, 1.8, 0.6, '#fff');
 } else if (mode === 'train') {
  rect(5.8, 3.8, 8.4, 11, 3.2, '#fff'); rect(7, 5.8, 6, 3.6, 0.8, hole); dot(8, 12.4, 0.8, hole); dot(12, 12.4, 0.8, hole);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(7.4, 15); ctx.lineTo(6.2, 16.8); ctx.moveTo(12.6, 15); ctx.lineTo(13.8, 16.8); ctx.stroke();
 } else if (mode === 'ferry') {
  rect(7.4, 6.6, 5.2, 4, 0.8, '#fff');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(4, 11); ctx.lineTo(16, 11); ctx.lineTo(14, 15); ctx.lineTo(6, 15); ctx.closePath(); ctx.fill();
 } else {
  ctx.fillStyle = '#fff'; ctx.font = '700 12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', 10, 10.6);
 }
}

function icon(ctx, mode, x, y) {
 const color = MODE_COLORS[mode];
 ctx.save(); ctx.translate(x, y);
 ctx.fillStyle = color; ctx.beginPath();
 if (SQUARE_MODES.has(mode)) ctx.roundRect(0, 0, ICON, ICON, 4.5); else ctx.arc(ICON / 2, ICON / 2, ICON / 2, 0, Math.PI * 2);
 ctx.fill();
 symbol(ctx, mode, color);
 ctx.restore();
}

const cache = new Map();
// modes: mode keys in display order -> {image, width, height}.
export function stopPin(modes) {
 const key = modes.join();
 if (cache.has(key)) return cache.get(key);
 const single = modes.length === 1, scale = 2;
 const width = single ? ICON + RING * 2 + 2 : modes.length * ICON + (modes.length - 1) * GAP + 2 * (RING + 2) + 2;
 const height = ICON + RING * 2 + 2;
 const canvas = document.createElement('canvas');
 canvas.width = width * scale; canvas.height = height * scale;
 const ctx = canvas.getContext('2d');
 ctx.scale(scale, scale);
 // White ring or pill with a thin dark edge, then the icons.
 ctx.fillStyle = '#fff'; ctx.strokeStyle = EDGE; ctx.lineWidth = 1; ctx.beginPath();
 if (single && !SQUARE_MODES.has(modes[0])) ctx.arc(width / 2, height / 2, height / 2 - 0.5, 0, Math.PI * 2);
 else ctx.roundRect(0.5, 0.5, width - 1, height - 1, single ? 7 : (height - 1) / 2);
 ctx.fill(); ctx.stroke();
 const inset = single ? RING + 1 : RING + 3;
 modes.forEach((mode, i) => icon(ctx, mode, inset + i * (ICON + GAP), RING + 1));
 const pin = {image: canvas.toDataURL(), width, height};
 cache.set(key, pin);
 return pin;
}

// Landmark: dark navy disc, thin gold ring, gold diamond in the middle.
let landmark = null;
export function landmarkPin() {
 if (landmark) return landmark;
 const size = 30, scale = 2, canvas = document.createElement('canvas');
 canvas.width = canvas.height = size * scale;
 const ctx = canvas.getContext('2d'), c = size / 2;
 ctx.scale(scale, scale);
 ctx.fillStyle = '#14353e'; ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.fill();
 ctx.strokeStyle = '#e7d4a1'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(c, c, c - 1.7, 0, Math.PI * 2); ctx.stroke();
 ctx.fillStyle = '#e7d4a1'; ctx.beginPath(); ctx.moveTo(c, c - 4.5); ctx.lineTo(c + 6, c); ctx.lineTo(c, c + 4.5); ctx.lineTo(c - 6, c); ctx.closePath(); ctx.fill();
 landmark = {image: canvas.toDataURL(), width: size, height: size};
 return landmark;
}
