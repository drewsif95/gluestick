(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = o => JSON.parse(JSON.stringify(o));
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(a, b) { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x27d4eb2f, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(seed, x) { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); const a = hash2(seed, i), b = hash2(seed, i + 1); return (a + (b - a) * t) * 2 - 1; }
function shuffle(arr, R) { for (let i = arr.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function canvasEl(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function hexToRgb(h) { const n = parseInt(String(h).slice(1, 7), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
function isDark(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) < 110; }
const toHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const z2 = n => String(n).padStart(2, '0');
function isoDay(d) { return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`; }
function todayISO() { return isoDay(new Date()); }
function niceDay(d) { try { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return isoDay(d); } }

/* ================= constants & state ================= */
const MAX_SIDE = 1800, MAX_PHOTOS = 30, PREV_MAX = 900, MAX_SECS = 10, MAX_FRAMES = 15;
const FORMATS = {
  story:     { name: 'Story',     ratio: '9:16', w: 1080, h: 1920 },
  portrait:  { name: 'Portrait',  ratio: '4:5',  w: 1080, h: 1350 },
  tall:      { name: 'Grid post', ratio: '3:4',  w: 1080, h: 1440 },
  square:    { name: 'Square',    ratio: '1:1',  w: 1080, h: 1080 },
  landscape: { name: 'Landscape', ratio: '3:2',  w: 1620, h: 1080 },
  carousel:  { name: 'Carousel',  ratio: 'Seamless', w: 0, h: 0 }
};
const SLIDE = { '4:5': { w: 1080, h: 1350 }, '1:1': { w: 1080, h: 1080 }, '3:4': { w: 1080, h: 1440 } };
const STYLES = [['grid', 'Clean grid'], ['torn', 'Torn paper'], ['scrap', 'Scrapbook'], ['instant', 'Instant'], ['film', 'Film strip'], ['shapes', 'Shapes']];
const LOOK_ORDER = ['none', 'golden', 'soft', 'airy', 'summer', 'pastel', 'faded', 'matte', 'cine', 'moody', 'cool', 'night', 'vivid', 'dispo', 'mono', 'noir', 'sepia'];
const LOOKS = {
  none:   { name: 'Original' },
  golden: { name: 'Golden',     lift: [20, 13, 4],  gain: [255, 243, 216], con: .28, sat: .9 },
  soft:   { name: 'Soft',       lift: [26, 20, 18], gain: [252, 244, 236], con: .08, sat: .85, gamma: [1.06, 1.02, 1] },
  airy:   { name: 'Airy',       lift: [30, 32, 36], gain: [255, 255, 255], con: -.08, sat: .82, gamma: [1.16, 1.17, 1.2] },
  summer: { name: 'Summer',     lift: [10, 6, 0],   gain: [255, 247, 222], con: .3, sat: 1.22, gamma: [1.06, 1.03, .98] },
  pastel: { name: 'Pastel',     lift: [48, 38, 46], gain: [255, 246, 250], con: .04, sat: .76 },
  faded:  { name: 'Faded',      lift: [42, 44, 46], gain: [238, 236, 228], con: .12, sat: .7 },
  matte:  { name: 'Matte',      lift: [34, 34, 34], gain: [240, 240, 238], con: .2, sat: .9 },
  cine:   { name: 'Cinematic',  lift: [0, 12, 22],  gain: [255, 236, 204], con: .36, sat: .95 },
  moody:  { name: 'Moody',      lift: [14, 16, 12], gain: [224, 222, 210], con: .32, sat: .7, gamma: [.94, .98, .92] },
  cool:   { name: 'Cool',       lift: [4, 14, 28],  gain: [234, 246, 255], con: .22, sat: .86 },
  night:  { name: 'Night',      lift: [6, 10, 26],  gain: [224, 240, 255], con: .32, sat: .9, gamma: [.92, 1, 1.08] },
  vivid:  { name: 'Vivid',      lift: [0, 0, 0],    gain: [255, 255, 255], con: .45, sat: 1.3 },
  dispo:  { name: 'Disposable', lift: [6, 18, 12],  gain: [255, 240, 230], con: .55, sat: 1.15 },
  mono:   { name: 'Mono',       lift: [16, 14, 12], gain: [248, 246, 242], con: .4, mono: true },
  noir:   { name: 'Noir',       lift: [0, 0, 0],    gain: [255, 255, 255], con: .8, mono: true },
  sepia:  { name: 'Sepia',      lift: [34, 20, 8],  gain: [252, 232, 196], con: .25, mono: true }
};
const GRADS = [
  { name: 'Peach', stops: ['#ffe0c7', '#f6a6a0'] },
  { name: 'Butter', stops: ['#fff6d8', '#f1cf72'] },
  { name: 'Sea glass', stops: ['#d4f0ec', '#5ea8b5'] },
  { name: 'Lilac', stops: ['#efe6fb', '#b39ddb'] },
  { name: 'Dusk', stops: ['#2d2b5c', '#c86f8a', '#f2b38a'] },
  { name: 'Sage', stops: ['#eef2e6', '#93a882'] },
  { name: 'Mocha', stops: ['#efe1d2', '#8b6a55'] },
  { name: 'Night', stops: ['#0e0f1e', '#3b2a4c'] }
];
const BG_SWATCHES = [['#ffffff', 'White'], ['#f4f1ec', 'Off-white'], ['#f3e3a6', 'Butter'], ['#e6d9c6', 'Sand'], ['#c5cfb8', 'Sage'], ['#ecd0c8', 'Blush'], ['#cbbfe0', 'Lilac'], ['#8b6a55', 'Mocha'], ['#3b2a22', 'Espresso'], ['#8e1b2b', 'Cherry'], ['#2a4fa3', 'Cobalt'], ['#1f2a3a', 'Ink'], ['#111111', 'Black']];
const BORDER_SWATCHES = [['#ffffff', 'White'], ['#f4ede0', 'Cream'], ['#d9c7ab', 'Sand'], ['#c9a77d', 'Kraft'], ['#f3e3a6', 'Butter'], ['#ecd0c8', 'Blush'], ['#8e1b2b', 'Cherry'], ['#2a4fa3', 'Cobalt'], ['#3b2a22', 'Espresso'], ['#161412', 'Black']];
const TEXT_SWATCHES = [['auto', 'Automatic'], ['#ffffff', 'White'], ['#f4ede0', 'Cream'], ['#171512', 'Black'], ['#3b2a22', 'Espresso'], ['#8e1b2b', 'Cherry'], ['#2a4fa3', 'Cobalt'], ['#ff6b3d', 'Tangerine']];
const BORDER_TEXT = {
  grid: ['Outline colour', 'Raise Outline to draw a border around each photo.'],
  shapes: ['Outline colour', 'Also the paper colour for stamps.'],
  torn: ['Paper colour', 'The colour of the torn edges.'],
  scrap: ['Frame colour', 'The colour of the photo frames.'],
  instant: ['Frame colour', 'The colour of the instant frames.'],
  film: ['Film colour', 'Black for film. White, with sprocket holes off, for a photo booth strip.']
};
const FONTS = {
  serif: { name: 'Editorial',   t: { fam: '"Instrument Serif", Georgia, serif', st: 'italic', w: 400, px: 118, up: false, tr: 0 }, s: { fam: 'Figtree, system-ui, sans-serif', st: 'normal', w: 600, px: 24, up: true, tr: .24 }, h: 62, lh: .92 },
  bold:  { name: 'Bold',        t: { fam: '"Archivo Black", "Arial Black", Impact, sans-serif', st: 'normal', w: 400, px: 82, up: true, tr: .01 }, s: { fam: 'Figtree, system-ui, sans-serif', st: 'normal', w: 600, px: 24, up: true, tr: .24 }, h: 40, lh: .95 },
  type:  { name: 'Typewriter',  t: { fam: '"Courier Prime", "Courier New", monospace', st: 'normal', w: 700, px: 72, up: false, tr: 0 }, s: { fam: '"Courier Prime", "Courier New", monospace', st: 'normal', w: 400, px: 30, up: false, tr: 0 }, h: 40, lh: 1 },
  hand:  { name: 'Handwritten', t: { fam: 'Caveat, "Bradley Hand", cursive', st: 'normal', w: 600, px: 120, up: false, tr: 0 }, s: { fam: 'Caveat, "Bradley Hand", cursive', st: 'normal', w: 600, px: 50, up: false, tr: 0 }, h: 66, lh: .9 },
  caps:  { name: 'Minimal',     t: { fam: 'Figtree, system-ui, sans-serif', st: 'normal', w: 600, px: 52, up: true, tr: .3 }, s: { fam: 'Figtree, system-ui, sans-serif', st: 'normal', w: 400, px: 22, up: true, tr: .3 }, h: 28, lh: 1 }
};
const FONT_LOADS = ['italic 400 40px "Instrument Serif"', '400 40px "Archivo Black"', '700 40px "Courier Prime"', '400 40px "Courier Prime"', '600 40px Caveat', '600 40px Figtree', '400 40px Figtree', '700 40px Figtree'];
/* starter recipes: built-in favourites that adapt to any set of photos */
const STARTERS = [
  { id: 'starter:dump', name: 'Photo dump', set: { style: 'scrap', bgMode: 'solid', bg: '#f4f1ec', mess: .75, tape: true, scrapGap: 30, scrapMargin: 50, look: 'dispo', lookAmt: .8, grain: .32, dateStamp: true, dateAuto: true, vignette: .15, titleFont: 'hand', titlePos: 'top' } },
  { id: 'starter:editorial', name: 'Editorial', set: { style: 'grid', bgMode: 'solid', bg: '#ffffff', gap: 12, margin: 60, radius: 0, borderW: 0, look: 'matte', lookAmt: .7, grain: .14, titleFont: 'serif', titlePos: 'top', textAlign: 'center', dateStamp: false } },
  { id: 'starter:holiday', name: 'Holiday film', set: { style: 'film', bgMode: 'solid', bg: '#f4ede0', border: { film: '#161412' }, sprockets: true, edgeText: true, filmTilt: .1, look: 'golden', lookAmt: .85, grain: .35, leak: .3, titleFont: 'type', titlePos: 'top', dateStamp: false } },
  { id: 'starter:zine', name: 'Torn zine', set: { style: 'torn', bgMode: 'solid', bg: '#111111', border: { torn: '#f8f6f1' }, tornMargin: 0, tear: 10, rough: .7, tilt: .45, look: 'faded', lookAmt: .75, grain: .28, titleFont: 'bold', titlePos: 'over', dateStamp: false } },
  { id: 'starter:arches', name: 'Soft arches', set: { style: 'shapes', shape: 'arch', bgMode: 'solid', bg: '#ecd0c8', shapeGap: 26, shapeMargin: 56, borderW: 0, look: 'soft', lookAmt: .85, grain: .12, titleFont: 'hand', titlePos: 'top', dateStamp: false } },
  { id: 'starter:night', name: 'Night out', set: { style: 'grid', bgMode: 'solid', bg: '#111111', gap: 10, margin: 28, radius: 22, borderW: 0, look: 'night', lookAmt: .85, vignette: .35, grain: .3, titleFont: 'caps', titlePos: 'top', dateStamp: false } }
];
const ADJ_KEYS = ['exposure', 'contrast', 'warmth', 'saturation', 'fade'];
const FAV_SKIP = new Set(['title', 'subtitle', 'date', 'blurPid', 'secBy']);

const S = {
  photos: new Map(), active: [], tree: null, crops: {}, caps: {}, hero: null, sel: null, cands: [],
  set: {
    format: 'story', slides: 3, slideRatio: '4:5', style: 'grid', sizing: 'fit',
    bgMode: 'solid', bg: '#ffffff', grad: 0, texture: false, blurPid: null,
    border: { grid: '#ffffff', shapes: '#ffffff', torn: '#f8f6f1', scrap: '#fbfaf6', instant: '#fbfaf6', film: '#161412' },
    borderW: 0,
    gap: 16, margin: 44, radius: 0,
    shape: 'arch', shapeGap: 30, shapeMargin: 64,
    tear: 9, rough: .6, tilt: .35, tornMargin: 0,
    scrapGap: 34, scrapMargin: 56, mess: .6, frame: 16, tape: true,
    strips: 0, filmTilt: .15, sprockets: true, edgeText: true,
    look: 'none', lookAmt: .8, exposure: 0, contrast: 0, warmth: 0, saturation: 0, fade: 0,
    grain: .2, vignette: 0, leak: 0, dust: 0, dateStamp: false, date: todayISO(), dateFmt: 'yy', dateAuto: true, secBy: 'day',
    perImage: 0, splitBy: 'order', // split into several images of up to perImage photos (0 = all in one)
    title: '', subtitle: '', titleFont: 'serif', titlePos: 'top', textAlign: 'center', titleSize: 1, textColor: 'auto',
    secHeads: true, capStyle: 'tag',
    seed: 3
  },
  preset: null // layout carried over from a favourite: { shape } or { secs: 'day' | 'place' }
};
const DEFAULT_SET = clone(S.set);
let hintedSplit = false, lastPerImage = 6, nodeSeq = 1, photoSeq = 1, tab = 'photos', lookSub = 'filters', textSub = 'title', EXPORTING = false, NO_LOOK = false, PSC = 1, viewOff = 0, gridGuide = false;
const borderColor = (style) => (S.set.border && S.set.border[style || S.set.style]) || '#ffffff';
const hasSecs = () => !!(S.tree && S.tree.secs);
const imageMode = () => S.set.perImage > 0;
function dims() {
  const st = S.set;
  if (st.format === 'carousel') {
    const s = SLIDE[st.slideRatio] || SLIDE['4:5'];
    const n = hasSecs() ? clamp(S.tree.secs.length, 1, MAX_FRAMES) : st.slides;
    return { w: s.w * n, h: s.h, slides: n, slideW: s.w };
  }
  const F = FORMATS[st.format] || FORMATS.story;
  // Several images: one frame of this size per group, side by side, saved as separate images.
  if (imageMode() && hasSecs() && S.tree.secs.length > 1) { const n = Math.min(S.tree.secs.length, MAX_FRAMES); return { w: F.w * n, h: F.h, slides: n, slideW: F.w }; }
  return { w: F.w, h: F.h, slides: 0, slideW: F.w };
}

/* ================= photos ================= */
function downscale(src, sw, sh, tw, th) {
  let cur = src, cw = sw, ch = sh;
  while (cw > tw * 2 && ch > th * 2) {
    const c = canvasEl(cw / 2, ch / 2), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    if (cur !== src) { cur.width = cur.height = 0; }
    cur = c; cw = c.width; ch = c.height;
  }
  const out = canvasEl(tw, th), x = out.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height);
  x.imageSmoothingQuality = 'high';
  x.drawImage(cur, 0, 0, out.width, out.height);
  if (cur !== src) { cur.width = cur.height = 0; }
  return out;
}
function canvasToImage(c, q) {
  return new Promise(res => {
    if (!c.toBlob) return res(null);
    c.toBlob(b => {
      if (!b) return res(null);
      const url = URL.createObjectURL(b), im = new Image();
      im.onload = () => { im._url = url; im._blob = b; res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); res(null); };
      im.src = url;
    }, 'image/jpeg', q || 0.92);
  });
}
function loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = url; }); }
function makePhoto(src, w, h, name, sample, time, fixedId) {
  const id = fixedId || 'p' + (photoSeq++);
  const s = 168 / Math.max(w, h);
  const thumb = downscale(src, w, h, Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  const p = { id, src, w, h, a: w / h, name, sample, time: time || null, thumb, thumbURL: thumb.toDataURL('image/jpeg', .82), lk: {}, lkPend: {}, blurMid: null };
  S.photos.set(id, p);
  S.crops[id] = { z: 1, fx: .5, fy: .5 };
  return p;
}
/* ================= photo metadata ================= */
// Capture date and GPS position from EXIF, in JPEG and in HEIC/HEIF (iPhone) files.
// Returns { time?, lat?, lon? }. Anything unreadable is simply left out.
async function readMeta(file) {
  const head = await file.slice(0, 262144).arrayBuffer();
  const v = new DataView(head);
  if (v.byteLength < 12) return {};
  if (v.getUint16(0) === 0xFFD8) { const t = jpegTiff(v); return t == null ? {} : parseTiff(v, t); }
  const t = heifTiff(v);
  if (t == null) return {};
  if (t + 1024 <= v.byteLength) return parseTiff(v, t);
  // The EXIF block sits further into the file (common in HEIC): read just that part.
  const tail = await file.slice(t, t + 131072).arrayBuffer();
  return parseTiff(new DataView(tail), 0);
}
function jpegTiff(v) {
  const len = v.byteLength; let off = 2;
  while (off + 4 < len) {
    const marker = v.getUint16(off); if ((marker & 0xFF00) !== 0xFF00) break;
    if (marker === 0xFFE1 && off + 10 < len && v.getUint32(off + 4) === 0x45786966) return off + 10;
    if (marker === 0xFFDA) break;
    off += 2 + v.getUint16(off + 2);
  }
  return null;
}
// HEIF: the 'meta' box lists items (iinf) and where they live (iloc); the EXIF item holds a TIFF block.
function heifTiff(v) {
  const len = v.byteLength, s4 = o => o + 4 <= len ? String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)) : '';
  if (s4(4) !== 'ftyp') return null;
  let off = 0, meta = -1, metaEnd = 0;
  while (off + 8 <= len) {
    let size = v.getUint32(off), hdr = 8;
    if (size === 1) { if (off + 16 > len) break; size = v.getUint32(off + 8) * 4294967296 + v.getUint32(off + 12); hdr = 16; }
    else if (size === 0) size = len - off;
    if (size < hdr) break;
    if (s4(off + 4) === 'meta') { meta = off + hdr + 4; metaEnd = Math.min(len, off + size); break; }
    off += size;
  }
  if (meta < 0) return null;
  let exifId = -1, iloc = -1, ilocEnd = 0;
  for (off = meta; off + 8 <= metaEnd;) {
    const size = v.getUint32(off), type = s4(off + 4); if (size < 8) break;
    if (type === 'iinf') {
      const ver = v.getUint8(off + 8); let q = off + 12;
      const n = ver === 0 ? v.getUint16(q) : v.getUint32(q); q += ver === 0 ? 2 : 4;
      for (let i = 0; i < n && q + 8 <= off + size; i++) {
        const isz = v.getUint32(q);
        if (s4(q + 4) === 'infe') {
          const iv = v.getUint8(q + 8);
          if (iv >= 2) { const id = iv === 2 ? v.getUint16(q + 12) : v.getUint32(q + 12); if (s4(q + 12 + (iv === 2 ? 2 : 4) + 2) === 'Exif') exifId = id; }
        }
        if (isz < 8) break; q += isz;
      }
    } else if (type === 'iloc') { iloc = off; ilocEnd = Math.min(metaEnd, off + size); }
    off += size;
  }
  if (exifId < 0 || iloc < 0) return null;
  const ver = v.getUint8(iloc + 8); let q = iloc + 12;
  const b1 = v.getUint8(q), b2 = v.getUint8(q + 1); q += 2;
  const offSize = b1 >> 4, lenSize = b1 & 15, baseSize = b2 >> 4, idxSize = ver ? (b2 & 15) : 0;
  const rd = n => { let x = 0; for (let i = 0; i < n; i++) x = x * 256 + v.getUint8(q + i); q += n; return x; };
  const count = ver < 2 ? rd(2) : rd(4);
  for (let i = 0; i < count && q < ilocEnd; i++) {
    const id = ver < 2 ? rd(2) : rd(4);
    if (ver) rd(2);
    rd(2);
    const base = rd(baseSize), ext = rd(2);
    let first = -1;
    for (let e = 0; e < ext; e++) { if (idxSize) rd(idxSize); const eo = rd(offSize); rd(lenSize); if (first < 0) first = base + eo; }
    if (id === exifId && first >= 0) {
      if (first + 4 > len) return first + 10; // assume the usual "Exif\0\0" prefix; read later from the file
      return first + 4 + v.getUint32(first);
    }
  }
  return null;
}
function parseTiff(v, t) {
  try {
    const len = v.byteLength, le = v.getUint16(t) === 0x4949;
    const g16 = o => v.getUint16(o, le), g32 = o => v.getUint32(o, le);
    if (g16(t + 2) !== 42) return {};
    const readIFD = ifd => { const out = {}; if (t + ifd + 2 > len) return out; const n = g16(t + ifd); for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12; if (e + 12 > len) break; out[g16(e)] = { type: g16(e + 2), cnt: g32(e + 4), at: e + 8 }; } return out; };
    const str = ent => { if (!ent || ent.type !== 2) return null; const o = ent.cnt > 4 ? t + g32(ent.at) : ent.at; let s = ''; for (let i = 0; i < ent.cnt - 1 && o + i < len; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; };
    const rats = ent => { if (!ent || ent.type !== 5) return null; const o = t + g32(ent.at); if (o + ent.cnt * 8 > len) return null; const r = []; for (let i = 0; i < ent.cnt; i++) { const a = g32(o + i * 8), b = g32(o + i * 8 + 4); r.push(b ? a / b : 0); } return r; };
    const ifd0 = readIFD(g32(t + 4)), out = {};
    let dt = null;
    if (ifd0[0x8769]) { const ex = readIFD(g32(ifd0[0x8769].at)); dt = str(ex[0x9003]) || str(ex[0x9004]); }
    if (!dt) dt = str(ifd0[0x0132]);
    const m = dt && dt.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m && +m[1] > 1900) out.time = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (ifd0[0x8825]) {
      const gps = readIFD(g32(ifd0[0x8825].at));
      const la = rats(gps[2]), lo = rats(gps[4]);
      if (la && lo && la.length >= 3 && lo.length >= 3) {
        let lat = la[0] + la[1] / 60 + la[2] / 3600, lon = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (/S/i.test(str(gps[1]) || '')) lat = -lat;
        if (/W/i.test(str(gps[3]) || '')) lon = -lon;
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon)) { out.lat = lat; out.lon = lon; }
      }
    }
    return out;
  } catch (e) { return {}; }
}
/* ================= places ================= */
// A photo's GPS position becomes the nearest town's name, worked out on the device from places.txt
// (towns and cities of 1,000+ people, from GeoNames, CC BY 4.0). Nothing is sent anywhere, and the
// list only loads once a photo with a location is added. Nearby bigger places win, so a photo in
// Belém reads "Lisbon", but a village still wins when you are standing in it.
const PLACES = { ready: null, grid: null };
function loadPlaces() {
  if (!PLACES.ready) PLACES.ready = fetch('places.txt').then(r => { if (!r.ok) throw new Error('places'); return r.text(); }).then(parsePlaces).catch(() => false);
  return PLACES.ready;
}
function parsePlaces(txt) {
  const lines = txt.split('\n'), n = lines.length;
  const name = new Array(n), cc = new Array(n), lat = new Float32Array(n), lon = new Float32Array(n), w = new Float32Array(n), grid = new Map();
  let la = 0, lo = 0, k = 0;
  for (const line of lines) {
    const a = line.split('\t'); if (a.length < 4) continue;
    la += parseInt(a[1], 36); lo += parseInt(a[2], 36);
    name[k] = a[0]; cc[k] = a[4] || ''; lat[k] = la / 100; lon[k] = lo / 100;
    w[k] = Math.pow(Math.pow(10, parseInt(a[3], 36) / 10) / 1000, .45);
    const key = Math.floor(lat[k]) * 400 + Math.floor(lon[k]);
    let cell = grid.get(key); if (!cell) grid.set(key, cell = []); cell.push(k);
    k++;
  }
  Object.assign(PLACES, { name, cc, lat, lon, w, grid });
  return true;
}
function nearestPlace(lat, lon) {
  if (!PLACES.grid) return null;
  const kx = 111.2 * Math.cos(lat * Math.PI / 180), la0 = Math.floor(lat), lo0 = Math.floor(lon), near = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    let lo1 = lo0 + b; if (lo1 < -180) lo1 += 360; if (lo1 >= 180) lo1 -= 360;
    const cell = PLACES.grid.get((la0 + a) * 400 + lo1); if (!cell) continue;
    for (const i of cell) {
      let dl = PLACES.lon[i] - lon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      const d = Math.hypot(dl * kx, (PLACES.lat[i] - lat) * 111.2);
      if (d <= 40) near.push([i, d]); // further than that, a town name would mislead more than help
    }
  }
  if (!near.length) return null;
  // A bigger place can win over the nearest one, but only if it isn't much further away:
  // Belém becomes Lisbon, while a Cotswold village doesn't become a city 20 km off.
  const reach = Math.max(12, 2.5 * Math.min(...near.map(n => n[1])));
  let best = -1, bestS = Infinity;
  for (const [i, d] of near) { if (d > reach) continue; const sc = (d + .5) / PLACES.w[i]; if (sc < bestS) { bestS = sc; best = i; } }
  return { name: PLACES.name[best], cc: PLACES.cc[best] };
}
let placesJob = null;
function resolvePlaces() {
  const need = () => [...S.photos.values()].filter(p => p.lat != null && p.place === undefined);
  if (!need().length) return Promise.resolve();
  if (!placesJob) placesJob = loadPlaces().then(ok => {
    need().forEach(p => { const r = ok ? nearestPlace(p.lat, p.lon) : null; p.place = r ? r.name : null; p.cc = r ? r.cc : null; });
    placesJob = null;
    onPlacesResolved();
  });
  return placesJob;
}
function onPlacesResolved() {
  if (hasSecs()) S.tree.secs.forEach(sec => {
    if (sec.autoNote == null || sec.note !== sec.autoNote) return; // keep anything the user typed
    sec.note = sec.autoNote = autoSecNote(sec);
  });
  renderPhotoStrip();
  if (tab === 'text') renderTextPane();
  scheduleRender(false);
}
const shortDay = d => { try { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); } catch (e) { return isoDay(d); } };
// Most common place names first.
function topPlaces(ids) {
  const c = new Map();
  ids.forEach(id => { const p = S.photos.get(id); if (p && p.place) c.set(p.place, (c.get(p.place) || 0) + 1); });
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
}
function countryName(cc) {
  try { return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; }
}
// "12–14 August 2026" (long) or "12–14 Aug" (short).
function dateRange(times, long) {
  const ts = times.filter(Boolean).map(t => t.getTime()).sort((a, b) => a - b);
  if (!ts.length) return '';
  const a = new Date(ts[0]), b = new Date(ts[ts.length - 1]);
  const mo = d => { try { return d.toLocaleDateString('en-GB', { month: long ? 'long' : 'short' }); } catch (e) { return String(d.getMonth() + 1); } };
  const yr = long ? ` ${b.getFullYear()}` : '';
  if (isoDay(a) === isoDay(b)) return long ? `${a.getDate()} ${mo(a)}${yr}` : niceDay(a);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${mo(b)}${yr}`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${mo(a)} – ${b.getDate()} ${mo(b)}${yr}`;
  return `${a.getDate()} ${mo(a)} ${a.getFullYear()} – ${b.getDate()} ${mo(b)} ${b.getFullYear()}`;
}

async function decodeFile(file) {
  const url = URL.createObjectURL(file);
  try { const im = await loadImg(url); return { im, iw: im.naturalWidth, ih: im.naturalHeight, url }; }
  catch (e) {
    URL.revokeObjectURL(url);
    if (!window.createImageBitmap) throw e;
    const bm = await createImageBitmap(file);
    return { im: bm, iw: bm.width, ih: bm.height, url: null };
  }
}
async function loadPhoto(file) {
  let meta = {};
  try { meta = await readMeta(file); } catch (e) { /* no readable metadata */ }
  const given = file.gsMeta || {}; // passed by the iPhone app's picker
  let time = meta.time || given.time || null, timeSrc = meta.time ? 'exif' : given.time ? 'picker' : null;
  // Last resort: the file's own date, unless it is just the moment of upload (what phones report when they strip EXIF).
  if (!time && file.lastModified && Math.abs(Date.now() - file.lastModified) > 10 * 60000) { time = new Date(file.lastModified); timeSrc = 'file'; }
  const lat = meta.lat != null ? meta.lat : given.lat, lon = meta.lon != null ? meta.lon : given.lon;
  const { im, iw, ih, url } = await decodeFile(file);
  if (!iw || !ih) { if (url) URL.revokeObjectURL(url); throw new Error('empty'); }
  const s = Math.min(1, MAX_SIDE / Math.max(iw, ih));
  const tw = Math.max(1, Math.round(iw * s)), th = Math.max(1, Math.round(ih * s));
  const c = downscale(im, iw, ih, tw, th);
  if (url) URL.revokeObjectURL(url);
  if (im.close) im.close();
  const work = await canvasToImage(c, 0.92);
  const p = makePhoto(work || c, tw, th, file.name, false, time);
  if (work) { c.width = c.height = 0; p.blob = work._blob || null; }
  p.timeSrc = timeSrc;
  if (lat != null && lon != null) { p.lat = lat; p.lon = lon; resolvePlaces(); }
  return p;
}

/* sample photos: painted here so the app opens in a working state */
const SAMPLES = [
  { name: 'Harbour sunset', w: 1200, h: 800, when: [2026, 7, 12, 19, 40], where: [38.697, -9.421, 'Cascais'], paint(x, w, h, R) {
    const hz = h * .6;
    let g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#26285a'); g.addColorStop(.42, '#b8507a'); g.addColorStop(.78, '#f0905a'); g.addColorStop(1, '#ffcf8a'); x.fillStyle = g; x.fillRect(0, 0, w, hz);
    const sx = w * .64, sy = hz - h * .05;
    g = x.createRadialGradient(sx, sy, 0, sx, sy, h * .5); g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(.07, 'rgba(255,226,170,.95)'); g.addColorStop(.25, 'rgba(255,170,110,.35)'); g.addColorStop(1, 'rgba(255,140,90,0)'); x.fillStyle = g; x.fillRect(0, 0, w, hz);
    x.fillStyle = '#3a2747'; x.beginPath(); x.moveTo(0, hz);
    for (let i = 0; i <= 60; i++) { const t = i / 60; x.lineTo(t * w * .5, hz - (1 - t) * h * .09 * (.7 + .3 * Math.sin(t * 9))); }
    x.lineTo(w * .5, hz); x.closePath(); x.fill();
    g = x.createLinearGradient(0, hz, 0, h); g.addColorStop(0, '#d98466'); g.addColorStop(.25, '#7d4a6c'); g.addColorStop(1, '#1c1a37'); x.fillStyle = g; x.fillRect(0, hz, w, h - hz);
    for (let i = 0; i < 110; i++) { const d = Math.pow(R(), 1.5), yy = hz + 2 + d * (h - hz), ww = (1 - d) * w * .22 * R() + 6; x.fillStyle = `rgba(255,${(200 + R() * 40) | 0},150,${.12 + R() * .45 * (1 - d)})`; x.fillRect(sx - ww / 2 + (R() - .5) * w * .08 * (1 + d * 2), yy, ww, 1.5 + R() * 3 * (1 - d)); }
  } },
  { name: 'Dusk ridges', w: 900, h: 1200, when: [2026, 7, 13, 7, 10], where: [38.79, -9.39, 'Sintra'], paint(x, w, h) {
    const g = x.createLinearGradient(0, 0, 0, h * .6); g.addColorStop(0, '#3d4a7a'); g.addColorStop(.55, '#c89aa8'); g.addColorStop(1, '#f4c9a0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    ['#b9a3c0', '#8a78a6', '#5b5280', '#2f2b4d', '#1b1930'].forEach((c, L) => {
      const base = h * (.38 + L * .12);
      x.fillStyle = c; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= w; i += 6) x.lineTo(i, base - (vnoise(L * 17 + 3, i / (210 - L * 30)) * .5 + .5) * h * (.17 - L * .015) - vnoise(L * 17 + 5, i / 38) * h * .012);
      x.lineTo(w, h); x.closePath(); x.fill();
      const hg = x.createLinearGradient(0, base - h * .1, 0, base + h * .12); hg.addColorStop(0, 'rgba(244,201,160,0)'); hg.addColorStop(1, `rgba(244,201,160,${.18 - L * .03})`); x.fillStyle = hg; x.fillRect(0, base - h * .1, w, h * .22);
    });
  } },
  { name: 'Pool light', w: 900, h: 1200, when: [2026, 7, 12, 13, 0], where: [38.697, -9.421, 'Cascais'], paint(x, w, h, R) {
    let g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#36bccb'); g.addColorStop(1, '#0d6a8f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    for (let k = 0; k < 150; k++) {
      x.strokeStyle = `rgba(190,250,255,${.05 + R() * .12})`; x.lineWidth = 2 + R() * 7; x.beginPath();
      let px = R() * w, py = R() * h; x.moveTo(px, py);
      for (let s = 0; s < 3; s++) { const nx = px + (R() - .5) * 170, ny = py + (R() - .5) * 170; x.quadraticCurveTo((px + nx) / 2 + (R() - .5) * 80, (py + ny) / 2 + (R() - .5) * 80, nx, ny); px = nx; py = ny; }
      x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#ece5d7'; x.fillRect(0, 0, w, h * .13);
    x.fillStyle = 'rgba(0,0,0,.16)'; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 2, h * .13); x.fillRect(0, h * .065, w, 2);
    g = x.createLinearGradient(0, h * .13, 0, h * .22); g.addColorStop(0, 'rgba(0,40,60,.38)'); g.addColorStop(1, 'rgba(0,40,60,0)'); x.fillStyle = g; x.fillRect(0, h * .13, w, h * .09);
  } },
  { name: 'City lights', w: 1000, h: 1000, when: [2026, 7, 13, 22, 15], where: [38.716, -9.139, 'Lisbon'], paint(x, w, h, R) {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#2c1532'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    const cols = ['255,176,80', '255,120,140', '120,200,255', '255,222,150'];
    for (let i = 0; i < 95; i++) {
      const c = cols[(R() * cols.length) | 0], r = 12 + Math.pow(R(), 2) * 95, cx = R() * w, cy = h * .15 + R() * h * .8, a = .14 + R() * .34;
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, `rgba(${c},${a})`); rg.addColorStop(.82, `rgba(${c},${a * .8})`); rg.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  } },
  { name: 'Dunes', w: 1200, h: 800, when: [2026, 7, 14, 16, 30], where: [38.38, -8.78, 'Comporta'], paint(x, w, h, R) {
    const g = x.createLinearGradient(0, 0, 0, h * .55); g.addColorStop(0, '#8fb3cc'); g.addColorStop(1, '#f2dcc0'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    [['#e9b98a', '#d29a68'], ['#dc9a62', '#b8723f'], ['#c97c46', '#9a5a2e'], ['#b3653a', '#7c4222']].forEach(([a, b], L) => {
      const base = h * (.45 + L * .14), f = 1.1 + L * .5, ph = R() * 6;
      x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= w; i += 5) { const t = i / w; x.lineTo(i, base - (Math.sin(t * Math.PI * f + ph) * .5 + .5) * h * .09 - vnoise(L * 11 + 2, i / 90) * h * .02); }
      x.lineTo(w, h); x.closePath();
      const gg = x.createLinearGradient(0, base - h * .1, 0, base + h * .25); gg.addColorStop(0, a); gg.addColorStop(1, b); x.fillStyle = gg; x.fill();
    });
  } },
  { name: 'Meadow', w: 900, h: 1200, when: [2026, 7, 14, 9, 45], where: [38.38, -8.78, 'Comporta'], paint(x, w, h, R) {
    let g = x.createLinearGradient(0, 0, 0, h * .55); g.addColorStop(0, '#bcd6e6'); g.addColorStop(1, '#f5ecd2'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    g = x.createRadialGradient(w * .78, h * .14, 0, w * .78, h * .14, h * .4); g.addColorStop(0, 'rgba(255,250,225,.95)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    [['#a9bf8f', .5], ['#7fa067', .6], ['#56804a', .72]].forEach(([c, b], L) => {
      x.fillStyle = c; x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= w; i += 6) x.lineTo(i, h * b - (vnoise(L * 7 + 1, i / 260) * .5 + .5) * h * .08);
      x.lineTo(w, h); x.closePath(); x.fill();
    });
    x.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const gx = R() * w, gy = h * (.78 + R() * .24), len = 40 + R() * 140;
      x.strokeStyle = `hsla(${80 + R() * 40},${35 + R() * 25}%,${30 + R() * 25}%,.75)`; x.lineWidth = 1.5 + R() * 2;
      x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (R() - .5) * 30, gy - len * .6, gx + (R() - .5) * 50, gy - len); x.stroke();
    }
    const fl = ['#ffffff', '#ffe27a', '#f6b3c4', '#ffd1a8'];
    for (let i = 0; i < 70; i++) { x.fillStyle = fl[(R() * fl.length) | 0]; x.beginPath(); x.arc(R() * w, h * (.74 + R() * .24), 2 + R() * 4, 0, 7); x.fill(); }
  } }
];
function paintSample(i, fixedId) {
  const s = SAMPLES[i], c = canvasEl(s.w, s.h), x = c.getContext('2d');
  s.paint(x, s.w, s.h, mulberry32(101 + i * 977));
  const [Y, M, D, h, m] = s.when;
  const p = makePhoto(c, s.w, s.h, s.name, true, new Date(Y, M, D, h, m), fixedId);
  p.timeSrc = 'exif'; [p.lat, p.lon, p.place] = s.where; p.cc = 'PT'; p.sampleIdx = i;
  return p;
}
const makeSamples = () => SAMPLES.map((s, i) => paintSample(i).id);

/* ================= layout engine (guillotine trees) ================= */
const isLeaf = n => !!n && n.pid != null;
const mkLeaf = pid => ({ id: nodeSeq++, pid });
const mkSplit = (dir, a, b) => ({ id: nodeSeq++, dir, r: .5, t: 0, a, b });
function leavesOf(n, out = []) { if (!n) return out; if (n.secs) { n.secs.forEach(s => leavesOf(s.tree, out)); return out; } if (isLeaf(n)) out.push(n); else { leavesOf(n.a, out); leavesOf(n.b, out); } return out; }
function cloneTree(n) {
  if (!n) return null;
  if (n.secs) return { id: n.id, secs: n.secs.map(s => ({ id: s.id, key: s.key || null, name: s.name || '', note: s.note || '', pids: s.pids ? s.pids.slice() : undefined, tree: cloneTree(s.tree) })) };
  return isLeaf(n) ? { id: n.id, pid: n.pid } : { id: n.id, dir: n.dir, r: n.r, t: n.t, a: cloneTree(n.a), b: cloneTree(n.b) };
}
function sigS(n) { if (!n) return '-'; if (n.secs) return 'S[' + n.secs.map(s => sigS(s.tree)).join('|') + ']'; return isLeaf(n) ? 'L' : n.dir + '(' + sigS(n.a) + ',' + sigS(n.b) + ')'; }
function sigFull(n) { if (!n) return '-'; if (n.secs) return 'S[' + n.secs.map(s => sigFull(s.tree)).join('|') + ']'; return isLeaf(n) ? n.pid : n.dir + '(' + sigFull(n.a) + ',' + sigFull(n.b) + ')'; }
function removeLeaf(n, pid) {
  if (!n) return null;
  if (n.secs) {
    n.secs.forEach(s => { s.tree = removeLeaf(s.tree, pid); if (s.pids) s.pids = s.pids.filter(x => x !== pid); });
    n.secs = n.secs.filter(s => s.tree || (s.pids && s.pids.length));
    return n.secs.length ? n : null;
  }
  if (isLeaf(n)) return n.pid === pid ? null : n;
  const a = removeLeaf(n.a, pid), b = removeLeaf(n.b, pid); if (!a) return b; if (!b) return a; n.a = a; n.b = b; return n;
}
function setTilts(n, R) { if (!n) return; if (n.secs) { n.secs.forEach(s => setTilts(s.tree, R)); return; } if (!isLeaf(n)) { n.t = R() * 2 - 1; setTilts(n.a, R); setTilts(n.b, R); } }
const secCount = s => s.tree ? leavesOf(s.tree).length : (s.pids || []).length;

/* structure: wide regions tend to split side by side, tall ones stack */
function buildStructure(n, T, R) {
  if (n === 1) return { T };
  const pv = 1 / (1 + Math.exp(-2.4 * Math.log(T)));
  const dir = R() < pv ? 'v' : 'h';
  const n1 = n === 2 ? 1 : clamp(Math.round(n / 2 + (R() - .5) * (n - 1) * .8), 1, n - 1), n2 = n - n1;
  const T1 = dir === 'v' ? T * n1 / n : T * n / n1;
  const T2 = dir === 'v' ? T * n2 / n : T * n / n2;
  return { dir, a: buildStructure(n1, T1, R), b: buildStructure(n2, T2, R) };
}
/* put portrait photos in tall cells and landscape photos in wide ones (mostly) */
function assignPhotos(st, ids, aspects, R) {
  const slots = [];
  (function walk(s) { if (s.dir) { walk(s.a); walk(s.b); } else slots.push(s); })(st);
  if (R() < .75) {
    const ps = ids.map(id => ({ id, k: Math.log(aspects[id]) + (R() - .5) * .35 })).sort((a, b) => a.k - b.k);
    const ss = slots.map((s, i) => ({ i, k: Math.log(s.T) })).sort((a, b) => a.k - b.k);
    ss.forEach((o, j) => { slots[o.i].pid = ps[j].id; });
  } else {
    const sh = shuffle(ids.slice(), R);
    slots.forEach((s, i) => { s.pid = sh[i]; });
  }
  const conv = s => s.dir ? mkSplit(s.dir, conv(s.a), conv(s.b)) : mkLeaf(s.pid);
  return conv(st);
}
/* a featured photo gets one side of the first split to itself */
function heroTree(ids, asp, CA, hero, R) {
  const n = ids.length, share = n <= 4 ? .52 : .44, dir = CA >= 1 ? 'v' : 'h';
  const rest = ids.filter(id => id !== hero);
  const Trest = dir === 'v' ? CA * (1 - share) : CA / (1 - share);
  const restTree = assignPhotos(buildStructure(rest.length, Trest, R), rest, asp, R);
  const first = R() < .6, h = mkLeaf(hero);
  const node = first ? mkSplit(dir, h, restTree) : mkSplit(dir, restTree, h);
  node._hero = { share, first };
  return node;
}
function natAspect(n, asp) {
  if (isLeaf(n)) return asp[n.pid];
  const A = natAspect(n.a, asp), B = natAspect(n.b, asp);
  if (n.dir === 'v') { n.r = A / (A + B); return A + B; }
  const ia = 1 / A, ib = 1 / B; n.r = ia / (ia + ib); return 1 / (ia + ib);
}
function evenRatios(n) { if (isLeaf(n)) return 1; const ca = evenRatios(n.a), cb = evenRatios(n.b); n.r = ca / (ca + cb); return ca + cb; }
function rectsUnit(n, x, y, w, h, out) {
  if (isLeaf(n)) { out.push({ pid: n.pid, x, y, w, h }); return; }
  if (n.dir === 'v') { const wa = w * n.r; rectsUnit(n.a, x, y, wa, h, out); rectsUnit(n.b, x + wa, y, w - wa, h, out); }
  else { const ha = h * n.r; rectsUnit(n.a, x, y, w, ha, out); rectsUnit(n.b, x, y + ha, w, h - ha, out); }
}
/* lower is better: cropping, slivers, tiny cells, awkward carousel seams, and a featured photo that came out small */
function scoreTree(tree, asp, CA, slides, hero) {
  const cells = []; rectsUnit(tree, 0, 0, CA, 1, cells);
  const mean = CA / cells.length;
  let loss = 0, pen = 0;
  for (const c of cells) {
    const ca = c.w / c.h, pa = asp[c.pid];
    loss += 1 - Math.min(ca / pa, pa / ca);
    if (ca < .32 || ca > 3.2) pen += .6;
    const a = c.w * c.h; if (a < mean * .3) pen += (mean * .3 - a) / mean * 3;
    if (slides > 1) for (let k = 1; k < slides; k++) {
      const s = k * CA / slides;
      if (s > c.x + 1e-6 && s < c.x + c.w - 1e-6) { const f = Math.min(s - c.x, c.x + c.w - s) / c.w; if (f < .2) pen += (.2 - f) * 4; }
    }
  }
  let score = (loss + pen) / cells.length;
  if (hero) { const hc = cells.find(c => c.pid === hero); if (hc) { const share = hc.w * hc.h / CA, want = Math.max(.3, 1.6 / cells.length); if (share < want) score += (want - share) * 6; } }
  return score;
}
function genPool(ids, CA, slides, hero, count) {
  if (!ids.length) return [];
  const asp = {}; ids.forEach(id => { asp[id] = S.photos.get(id).a; });
  const R = mulberry32((Math.random() * 2147483647) | 0), n = ids.length;
  const heroOn = !!hero && ids.includes(hero) && n >= 3;
  const tries = n === 1 ? 1 : Math.min(1400, 160 + n * 80);
  const pool = [];
  for (let k = 0; k < tries; k++) {
    const tree = heroOn && R() < .65 ? heroTree(ids, asp, CA, hero, R) : assignPhotos(buildStructure(n, CA, R), ids, asp, R);
    if (S.set.sizing === 'fit') natAspect(tree, asp); else evenRatios(tree);
    if (tree._hero) { tree.r = tree._hero.first ? tree._hero.share : 1 - tree._hero.share; delete tree._hero; }
    setTilts(tree, R);
    pool.push({ tree, score: scoreTree(tree, asp, CA, slides, heroOn ? hero : null) });
  }
  pool.sort((a, b) => a.score - b.score);
  const out = [], seenS = new Set(), seenF = new Set();
  for (const c of pool) { const s = sigS(c.tree); if (seenS.has(s)) continue; seenS.add(s); seenF.add(sigFull(c.tree)); out.push(c); if (out.length >= count) break; }
  if (out.length < count) for (const c of pool) { const f = sigFull(c.tree); if (seenF.has(f)) continue; seenF.add(f); out.push(c); if (out.length >= count) break; }
  return out;
}
function generateLayouts() {
  if (!S.active.length || hasSecs()) { S.cands = []; return; }
  const D = dims();
  S.cands = genPool(S.active, D.w / D.h, D.slides, S.hero, 8);
}
/* ================= layout presets ================= */
// A favourite can carry its layout: the shape of the splits, not the photos that were in it.
// Leaves are {} (or {h: 1} for the featured spot); splits are {d, r, t, a, b}.
function shapeOf(n, hero) {
  if (isLeaf(n)) return n.pid === hero ? { h: 1 } : {};
  return { d: n.dir, r: Math.round(n.r * 1e4) / 1e4, t: Math.round((n.t || 0) * 1e3) / 1e3, a: shapeOf(n.a, hero), b: shapeOf(n.b, hero) };
}
const shapeHasHero = x => !!x && (x.d ? shapeHasHero(x.a) || shapeHasHero(x.b) : !!x.h);
const shapeCount = x => !x ? 0 : x.d ? shapeCount(x.a) + shapeCount(x.b) : 1;
function layoutPreset() {
  if (imageMode() && hasSecs()) {
    const big = S.tree.secs.filter(s => s.tree).sort((a, b) => leavesOf(b.tree).length - leavesOf(a.tree).length)[0];
    return big ? { shape: shapeOf(big.tree, S.hero) } : null;
  }
  if (hasSecs()) return { secs: S.set.secBy === 'place' ? 'place' : 'day' };
  return S.tree ? { shape: shapeOf(S.tree, S.hero) } : null;
}
// Fit a saved shape to these photos. Extra photos split the biggest cells along their long side;
// fewer photos drop the smallest cells. Then tall photos go in tall cells, and a featured photo
// takes the featured spot.
function fitShape(shape, ids, CA) {
  const n = ids.length; if (!n || !shape) return null;
  let root = clone(shape);
  const cellsOf = () => {
    const out = [];
    (function walk(x, w, h) {
      if (!x.d) { out.push({ x, w, h }); return; }
      if (x.d === 'v') { walk(x.a, w * x.r, h); walk(x.b, w * (1 - x.r), h); }
      else { walk(x.a, w, h * x.r); walk(x.b, w, h * (1 - x.r)); }
    })(root, CA, 1);
    return out;
  };
  const drop = (x, target) => {
    if (x === target) return null;
    if (!x.d) return x;
    const a = drop(x.a, target), b = drop(x.b, target);
    if (!a) return b; if (!b) return a;
    x.a = a; x.b = b; return x;
  };
  const area = c => c.w * c.h;
  for (let guard = 0; guard < 200; guard++) {
    const cs = cellsOf(); if (cs.length === n) break;
    const plain = cs.filter(c => !c.x.h), pool = plain.length ? plain : cs;
    if (cs.length < n) {
      const c = pool.reduce((m, c) => area(c) > area(m) ? c : m);
      Object.assign(c.x, { d: c.w >= c.h ? 'v' : 'h', r: .5, t: 0, a: {}, b: {} });
    } else {
      const c = pool.reduce((m, c) => area(c) < area(m) ? c : m);
      root = drop(root, c.x);
    }
  }
  const cs = cellsOf(), asp = {}; ids.forEach(id => { asp[id] = S.photos.get(id).a; });
  let rest = ids.slice();
  const heroCell = S.hero && ids.includes(S.hero) ? cs.find(c => c.x.h) : null;
  if (heroCell) { heroCell.x.pid = S.hero; rest = rest.filter(id => id !== S.hero); }
  const ps = rest.sort((a, b) => asp[a] - asp[b]);
  cs.filter(c => c !== heroCell).sort((a, b) => a.w / a.h - b.w / b.h).forEach((c, i) => { c.x.pid = ps[i]; });
  const conv = x => {
    if (!x.d) return mkLeaf(x.pid);
    const node = mkSplit(x.d, conv(x.a), conv(x.b)); node.r = x.r; node.t = x.t || 0;
    if (heroCell && shapeHasHero(x)) node._keepR = x.r;
    return node;
  };
  const tree = conv(root);
  if (S.set.sizing === 'fit') {
    natAspect(tree, asp);
    // keep the featured spot as big as it was saved
    (function keep(t) { if (isLeaf(t)) return; if (t._keepR != null) { t.r = t._keepR; } keep(t.a); keep(t.b); })(tree);
  }
  (function strip(t) { if (isLeaf(t)) return; delete t._keepR; strip(t.a); strip(t.b); })(tree);
  return tree;
}
// A fresh layout for the current photos: the favourite's shape when one is in force, else the best generated one.
function freshLayout() {
  generateLayouts();
  if (S.preset && S.preset.shape && S.active.length) { const D = dims(); S.tree = fitShape(S.preset.shape, S.active, D.w / D.h); }
  else applyCand(0, false);
}
// Apply a favourite's layout to the photos on screen (caller commits).
function applyLayoutPreset(pre) {
  S.preset = pre ? clone(pre) : null;
  if (!pre || !S.active.length) return;
  // Several images: the split decides the groups; a saved shape is used inside each image.
  if (imageMode()) { if (pre.shape) { viewOff = 0; if (hasSecs()) regenSections('all', false); else freshLayout(); } return; }
  if (pre.secs) {
    if (!hasSecs() || S.set.secBy !== pre.secs) { S.set.secBy = pre.secs; buildSections(); viewOff = 0; }
    return;
  }
  if (hasSecs()) S.tree = null;
  viewOff = 0; freshLayout();
}

/* sections: each gets its own layout, sized to its region */
function regenSections(which, pickRandom) {
  if (!hasSecs()) return;
  const D = dims(), fr = frameFor(D.w, D.h, S.set, S.tree);
  fr.regions.forEach(R => {
    const s = R.sec; if (!s || (which !== 'all' && !which.includes(s))) return;
    const ids = s.tree ? leavesOf(s.tree).map(l => l.pid) : (s.pids || []).slice();
    if (!ids.length) { s.tree = null; return; }
    const CA = Math.max(.05, R.photo.w / Math.max(1, R.photo.h));
    if (imageMode() && S.preset && S.preset.shape) { s.tree = fitShape(S.preset.shape, ids, CA); delete s.pids; return; }
    const pool = genPool(ids, CA, 0, S.hero, 3);
    const pick = pickRandom ? pool[(Math.random() * pool.length) | 0] : pool[0];
    s.tree = cloneTree(pick.tree); delete s.pids;
  });
}
/* ================= several images ================= */
// "Up to N photos per image": photos go in the order they were taken (undated ones last, in the
// order added). By day or by place starts a new image for each, and every group is split as
// evenly as possible: 30 photos at 6 make 5 images of 6; 31 make one of 6 and five of 5.
function chronological(ids) {
  return ids.map((id, i) => ({ id, i, t: S.photos.get(id).time }))
    .sort((a, b) => a.t && b.t ? (a.t - b.t) || (a.i - b.i) : a.t ? -1 : b.t ? 1 : a.i - b.i)
    .map(o => o.id);
}
function imageGroups(ids) {
  const by = S.set.splitBy;
  let groups = (by === 'place' && groupByPlace(ids)) || (by !== 'order' && groupByDay(ids)) || null;
  if (!groups) groups = [{ key: 'all', ids: chronological(ids) }];
  let N = Math.max(1, S.set.perImage | 0);
  const frames = n => groups.reduce((a, g) => a + Math.ceil(g.ids.length / n), 0);
  while (frames(N) > MAX_FRAMES) N++;
  const out = [];
  groups.forEach(g => {
    const k = Math.ceil(g.ids.length / N), base = Math.floor(g.ids.length / k), extra = g.ids.length % k;
    for (let j = 0, at = 0; j < k; j++) { const n = base + (j < extra ? 1 : 0); out.push({ g, part: j, ids: g.ids.slice(at, at + n) }); at += n; }
  });
  return out;
}
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function buildImageSets() {
  const ids = S.active.slice();
  if (ids.length <= S.set.perImage) { S.tree = null; freshLayout(); return 1; }
  const old = hasSecs() ? S.tree.secs : [], by = S.set.splitBy, parts = imageGroups(ids);
  const firstDay = parts[0].g.date ? dayStart(parts[0].g.date) : null;
  const secs = parts.map(p => {
    const key = `img:${p.g.key || 'all'}#${p.part}`, prev = old.find(s => s.key === key);
    let name = '';
    if (by === 'place' && p.g.place) name = p.g.place;
    else if (by !== 'order' && p.g.date && firstDay != null) name = `Day ${Math.round((dayStart(p.g.date) - firstDay) / 864e5) + 1}`;
    const sec = { id: nodeSeq++, key, name: prev ? prev.name : name, pids: p.ids, tree: null };
    sec.autoNote = by === 'order' ? '' : autoSecNote(sec);
    sec.note = prev && prev.note !== prev.autoNote ? prev.note : sec.autoNote;
    return sec;
  });
  S.tree = { id: nodeSeq++, secs };
  regenSections('all', false);
  return secs.length;
}
// Lay out the photos again after the set of photos (or the split) changes.
function arrangeAll() {
  if (!S.active.length) { S.tree = null; return; }
  if (imageMode()) buildImageSets();
  else if (hasSecs()) buildSections();
  else { S.tree = null; freshLayout(); }
}
async function setSplit(perImage, splitBy) {
  const was = imageMode();
  if (perImage != null) S.set.perImage = perImage;
  if (splitBy) S.set.splitBy = splitBy;
  if (imageMode() && S.set.splitBy === 'place') { busy('Finding places…'); await resolvePlaces(); busy(null); }
  if (imageMode()) {
    const n = buildImageSets();
    if (S.set.splitBy === 'place' && hasSecs() && !S.tree.secs.some(s => String(s.key).includes('place:'))) toast('These photos don’t include a location, so they’re split by day instead.', 3600);
    else if (n > 1) toast(`Split into ${n} images`);
    else toast(`All ${S.active.length} photos fit in one image`);
  } else if (was && hasSecs()) { S.tree = null; freshLayout(); toast('Back to one image'); }
  viewOff = 0; commit(); refreshAll();
}

function mergeSmallest(groups) {
  while (groups.length > MAX_SECS) {
    let bi = 0, bs = Infinity;
    for (let i = 0; i < groups.length - 1; i++) { const n = groups[i].ids.length + groups[i + 1].ids.length; if (n < bs) { bs = n; bi = i; } }
    groups[bi].ids = groups[bi].ids.concat(groups[bi + 1].ids);
    if (groups[bi].place && groups[bi + 1].place && groups[bi].place !== groups[bi + 1].place) groups[bi].place += ' & ' + groups[bi + 1].place;
    groups.splice(bi + 1, 1);
  }
  return groups;
}
function groupByDay(ids) {
  const known = ids.map(id => ({ id, t: S.photos.get(id).time })).filter(d => d.t).sort((a, b) => a.t - b.t);
  if (!known.length) return null;
  const groups = [], map = new Map();
  for (const d of known) { const k = isoDay(d.t); if (!map.has(k)) { const g = { key: k, date: d.t, ids: [] }; map.set(k, g); groups.push(g); } map.get(k).ids.push(d.id); }
  const unknown = ids.filter(id => !S.photos.get(id).time);
  if (unknown.length) groups[groups.length - 1].ids.push(...unknown);
  return mergeSmallest(groups);
}
// One section per place, in the order you got there. Photos without a location join the
// place they were taken closest in time to.
function groupByPlace(ids) {
  const ps = ids.map(id => S.photos.get(id));
  if (!ps.some(p => p.place)) return null;
  const t = p => p.time ? p.time.getTime() : Infinity;
  const order = ps.slice().sort((a, b) => t(a) - t(b));
  const groups = [], map = new Map();
  for (const p of order) {
    if (!p.place) continue;
    if (!map.has(p.place)) { const g = { key: 'place:' + p.place, place: p.place, ids: [] }; map.set(p.place, g); groups.push(g); }
    map.get(p.place).ids.push(p.id);
  }
  for (const p of order) {
    if (p.place) continue;
    let best = groups[groups.length - 1];
    if (p.time) {
      let bd = Infinity;
      groups.forEach(g => g.ids.forEach(id => { const q = S.photos.get(id); if (q.time) { const d = Math.abs(q.time - p.time); if (d < bd) { bd = d; best = g; } } }));
    }
    best.ids.push(p.id);
  }
  return mergeSmallest(groups);
}
// Section subtitle: "Wed 12 Aug · Cascais" for a day, "12–13 Aug" for a place.
function autoSecNote(sec) {
  const ids = sec.pids || leavesOf(sec.tree).map(l => l.pid);
  const ps = ids.map(id => S.photos.get(id)).filter(Boolean), times = ps.map(p => p.time).filter(Boolean);
  if (String(sec.key || '').includes('place:')) return dateRange(times, false);
  const first = times.sort((a, b) => a - b)[0], place = topPlaces(ids)[0];
  return first ? (place ? `${niceDay(first)} · ${place}` : niceDay(first)) : (place || '');
}
function buildSections() {
  const ids = S.active.slice(), old = hasSecs() ? S.tree.secs : [];
  const groups = (S.set.secBy === 'place' && groupByPlace(ids)) || groupByDay(ids);
  let secs;
  if (groups && groups.length && groups[0].place) {
    secs = groups.map(g => {
      const prev = old.find(s => s.key === g.key), sec = { id: nodeSeq++, key: g.key, name: prev ? prev.name : g.place, pids: g.ids, tree: null };
      sec.autoNote = autoSecNote(sec); sec.note = prev && prev.note !== prev.autoNote ? prev.note : sec.autoNote;
      return sec;
    });
  } else if (groups && groups.length) {
    const first = new Date(groups[0].date.getFullYear(), groups[0].date.getMonth(), groups[0].date.getDate());
    secs = groups.map(g => {
      const prev = old.find(s => s.key === g.key);
      const day = Math.round((new Date(g.date.getFullYear(), g.date.getMonth(), g.date.getDate()) - first) / 86400000) + 1;
      const sec = { id: nodeSeq++, key: g.key, name: prev ? prev.name : `Day ${day}`, pids: g.ids, tree: null };
      sec.autoNote = autoSecNote(sec); sec.note = prev && prev.note !== prev.autoNote ? prev.note : sec.autoNote;
      return sec;
    });
  } else secs = [{ id: nodeSeq++, key: null, name: 'Day 1', note: '', pids: ids, tree: null }];
  S.tree = { id: nodeSeq++, secs };
  regenSections('all', false);
  return secs.length;
}

/* ================= geometry ================= */
function side(p1, p2, P) { return (p2[0] - p1[0]) * (P[1] - p1[1]) - (p2[1] - p1[1]) * (P[0] - p1[0]); }
function clipHalf(poly, p1, p2, sgn) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i], Q = poly[(i + 1) % n], sp = sgn * side(p1, p2, P), sq = sgn * side(p1, p2, Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return out;
}
function lineSeg(poly, p1, p2) {
  const pts = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i], Q = poly[(i + 1) % n], sp = side(p1, p2, P), sq = side(p1, p2, Q);
    if (sp === 0) pts.push(P);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); pts.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  if (pts.length < 2) return null;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  let mn = Infinity, mx = -Infinity, a = null, b = null;
  for (const p of pts) { const t = (p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy; if (t < mn) { mn = t; a = p; } if (t > mx) { mx = t; b = p; } }
  return [a, b];
}
function bbox(poly) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
function area(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; a += P[0] * Q[1] - Q[0] * P[1]; } return Math.abs(a) / 2; }
function inPoly(poly, p) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a[1] > p.y) !== (b[1] > p.y)) && (p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }

function rectRec(n, x, y, w, h, g, out) {
  if (isLeaf(n)) { out.leaves.push({ node: n, pid: n.pid, x, y, w, h, px: x, py: y, pw: w, ph: h }); return; }
  if (n.dir === 'v') {
    const av = Math.max(2, w - g), wa = Math.max(1, av * n.r);
    rectRec(n.a, x, y, wa, h, g, out); rectRec(n.b, x + wa + g, y, Math.max(1, av - wa), h, g, out);
    out.divs.push({ node: n, dir: 'v', x1: x + wa + g / 2, y1: y, x2: x + wa + g / 2, y2: y + h, box: { x, y, w, h }, gap: g });
  } else {
    const av = Math.max(2, h - g), ha = Math.max(1, av * n.r);
    rectRec(n.a, x, y, w, ha, g, out); rectRec(n.b, x, y + ha + g, w, Math.max(1, av - ha), g, out);
    out.divs.push({ node: n, dir: 'h', x1: x, y1: y + ha + g / 2, x2: x + w, y2: y + ha + g / 2, box: { x, y, w, h }, gap: g });
  }
}
function splitPoly(poly, bb, n, tl) {
  let p1, p2;
  if (n.dir === 'v') { const x0 = bb.x + bb.w * n.r, d = tl * bb.h; p1 = [x0 + d, bb.y]; p2 = [x0 - d, bb.y + bb.h]; }
  else { const y0 = bb.y + bb.h * n.r, d = tl * bb.w; p1 = [bb.x, y0 - d]; p2 = [bb.x + bb.w, y0 + d]; }
  const k = n.dir === 'v' ? 1 : -1;
  const A = clipHalf(poly, p1, p2, k), B = clipHalf(poly, p1, p2, -k), ar = area(poly);
  if (A.length < 3 || B.length < 3 || area(A) < ar * .03 || area(B) < ar * .03) return null;
  const s = lineSeg(poly, p1, p2);
  return s ? { A, B, s } : null;
}
function tornRec(n, poly, g, st) {
  const bb = bbox(poly);
  const leafOf = l => ({ node: l, pid: l.pid, x: bb.x, y: bb.y, w: bb.w, h: bb.h, px: bb.x, py: bb.y, pw: bb.w, ph: bb.h, poly });
  if (isLeaf(n)) { g.leaves.push(leafOf(n)); return; }
  const res = splitPoly(poly, bb, n, st.tilt * (n.t || 0) * .2) || splitPoly(poly, bb, n, 0);
  if (!res) { leavesOf(n).forEach(l => g.leaves.push(leafOf(l))); return; }
  tornRec(n.a, res.A, g, st); tornRec(n.b, res.B, g, st);
  g.divs.push({ node: n, dir: n.dir, x1: res.s[0][0], y1: res.s[0][1], x2: res.s[1][0], y2: res.s[1][1], poly, box: bb, gap: 0 });
}
/* film strips inside a region; photos fill frames in layout order */
function filmGeom(tree, g, st, P, bleed) {
  const leaves = leavesOf(tree), n = leaves.length, sc = g.sc;
  if (!n) return;
  const vertical = P.h >= P.w, A = vertical ? P.w : P.h, Lx = vertical ? P.h : P.w;
  const mA = 46 * sc, gapS = 40 * sc, mL = (bleed ? 54 : 22) * sc, fg = 12 * sc;
  let la = 0; leaves.forEach(l => { la += Math.log(S.photos.get(l.pid).a); }); const avgA = Math.exp(la / n);
  let geo = null;
  const want = st.strips && st.strips <= n ? st.strips : 0;
  for (let k = 1; k <= Math.min(6, n); k++) {
    if (want && k !== want) continue;
    const per = Math.ceil(n / k), sw = (A - 2 * mA - (k - 1) * gapS) / k;
    if (sw < 40 * sc) continue;
    const sb = sw * .13, fa = sw - 2 * sb, fl = (Lx - 2 * mL - (per - 1) * fg) / per;
    if (fl < 16 * sc) continue;
    const scr = vertical ? fa / fl : fl / fa;
    const score = Math.abs(Math.log(scr / avgA)) + ((scr > 2.6 || scr < .38) ? 3 : 0);
    if (!geo || score < geo.score) geo = { k, per, sw, sb, fa, fl, score };
  }
  if (!geo) { const sw = Math.max(20, A - 2 * mA); geo = { k: 1, per: n, sw, sb: sw * .13, fa: sw * .74, fl: Math.max(8, (Lx - 2 * mL - (n - 1) * fg) / n) }; }
  const F = Object.assign({ vertical, fg }, geo);
  g.strips = g.strips || [];
  const R = mulberry32(st.seed * 7919 + 11 + Math.round(P.x + P.y));
  const total = geo.k * geo.sw + (geo.k - 1) * gapS, start = (vertical ? P.x : P.y) + (A - total) / 2;
  let idx = 0;
  for (let s = 0; s < geo.k; s++) {
    const cA = start + s * (geo.sw + gapS) + geo.sw / 2, ang = (R() * 2 - 1) * st.filmTilt * 5 * Math.PI / 180;
    const len = Lx + (bleed ? 240 * sc : 0);
    const strip = vertical ? { cx: cA, cy: P.y + P.h / 2, ang, base: 0, w: geo.sw, len, F } : { cx: P.x + P.w / 2, cy: cA, ang, base: -Math.PI / 2, w: geo.sw, len, F };
    strip.frames = [];
    const tl = geo.per * geo.fl + (geo.per - 1) * fg, s0 = -tl / 2;
    for (let f = 0; f < geo.per; f++) {
      const ly = s0 + f * (geo.fl + fg) + geo.fl / 2, leaf = idx < n ? leaves[idx++] : null;
      const fr = { ly, pid: leaf ? leaf.pid : null, num: g.strips.reduce((a, x) => a + x.frames.length, 0) + s * 0 + f + 1, leaf };
      strip.frames.push(fr);
      if (leaf) g.leaves.push({ node: leaf, pid: leaf.pid, film: { strip, fr }, pw: vertical ? geo.fa : geo.fl, ph: vertical ? geo.fl : geo.fa });
    }
    g.strips.push(strip);
  }
}
function unitScale(W, H) { const D = dims(); return (D.slides ? W / D.slides : Math.min(W, H)) / 1080; }
function outerMargin(st) { const s = st.style; return s === 'torn' ? st.tornMargin : s === 'film' ? 0 : (s === 'scrap' || s === 'instant') ? st.scrapMargin : s === 'shapes' ? st.shapeMargin : st.margin; }
function innerGap(st) { const s = st.style; return s === 'torn' ? 0 : s === 'film' ? 12 : (s === 'scrap' || s === 'instant') ? st.scrapGap : s === 'shapes' ? st.shapeGap : st.gap; }
const hasTitle = st => !!((st.title || '').trim() || (st.subtitle || '').trim());
function titleMetrics(st, sc) {
  const F = FONTS[st.titleFont] || FONTS.serif, k = sc * st.titleSize, tpx = F.t.px * k, spx = F.s.px * k, lineT = tpx * F.lh;
  const t = !!(st.title || '').trim(), s = !!(st.subtitle || '').trim();
  const blockH = (t ? lineT : 0) + (s ? (t ? spx * .75 : 0) + spx * 1.2 : 0);
  return { F, tpx, spx, lineT, blockH, h: blockH + 52 * sc };
}
function headMetrics(st, sc) { const F = FONTS[st.titleFont] || FONTS.serif, k = sc * st.titleSize, hpx = F.h * k, npx = F.s.px * k; return { F, hpx, npx, h: hpx * 1.25 + 22 * sc }; }
/* frame: margins, title band and the regions (one per section) photos are laid out in */
function frameFor(W, H, st, root) {
  const sc = unitScale(W, H), D = dims(), m = outerMargin(st) * sc;
  const secs0 = root && root.secs, perSlide = !!(D.slides && secs0 && secs0.length), sw0 = D.slides ? W / D.slides : W;
  // With one section per slide (or per image), the title goes on the first one only.
  let C = { x: m, y: m, w: Math.max(8, (perSlide ? sw0 : W) - 2 * m), h: Math.max(8, H - 2 * m) };
  let title = null;
  if (hasTitle(st)) {
    const T = titleMetrics(st, sc);
    if (st.titlePos === 'over') title = { box: Object.assign({}, C), T, over: true };
    else if (st.titlePos === 'bottom') { title = { box: { x: C.x, y: C.y + C.h - T.h, w: C.w, h: T.h }, T, over: false }; C = { x: C.x, y: C.y, w: C.w, h: Math.max(8, C.h - T.h) }; }
    else { title = { box: { x: C.x, y: C.y, w: C.w, h: T.h }, T, over: false }; C = { x: C.x, y: C.y + T.h, w: C.w, h: Math.max(8, C.h - T.h) }; }
  }
  const regions = [], secs = root && root.secs;
  if (secs && secs.length) {
    const named = secs.some(s => String(s.name || '').trim() || String(s.note || '').trim());
    const hb = st.secHeads && named ? headMetrics(st, sc).h : 0;
    const mk = (r, s) => ({ rect: r, head: hb ? { x: r.x, y: r.y, w: r.w, h: hb } : null, photo: { x: r.x, y: r.y + hb, w: r.w, h: Math.max(8, r.h - hb) }, sec: s, tree: s.tree });
    if (D.slides) {
      const sw = W / D.slides;
      secs.slice(0, D.slides).forEach((s, i) => regions.push(mk(i === 0 ? Object.assign({}, C) : { x: i * sw + m, y: m, w: Math.max(8, sw - 2 * m), h: Math.max(8, H - 2 * m) }, s)));
    } else {
      const sg = innerGap(st) * sc, wts = secs.map(s => Math.pow(Math.max(1, secCount(s)), .75)), tot = wts.reduce((a, b) => a + b, 0);
      const avail = Math.max(8, C.h - sg * (secs.length - 1));
      let y = C.y;
      secs.forEach((s, i) => { const h = avail * wts[i] / tot; regions.push(mk({ x: C.x, y, w: C.w, h }, s)); y += h + sg; });
    }
  } else regions.push({ rect: C, head: null, photo: C, sec: null, tree: root });
  return { sc, m, C, title, regions };
}
function geometryFor(root, W, H, st) {
  const sc = unitScale(W, H), g = { W, H, sc, leaves: [], divs: [], off: 0, tornEdges: [], heads: [], title: null, strips: [] };
  if (!root) return g;
  const fr = frameFor(W, H, st, root);
  g.title = fr.title; g.C = fr.C;
  const style = st.style;
  for (const R of fr.regions) {
    if (R.head) g.heads.push({ box: R.head, sec: R.sec });
    if (!R.tree) continue;
    const P = R.photo;
    if (style === 'torn') { tornRec(R.tree, [[P.x, P.y], [P.x + P.w, P.y], [P.x + P.w, P.y + P.h], [P.x, P.y + P.h]], g, st); g.tornEdges.push(P); }
    else if (style === 'film') filmGeom(R.tree, g, st, P, P.x <= .5 && P.y <= .5 && P.x + P.w >= W - .5 && P.y + P.h >= H - .5);
    else rectRec(R.tree, P.x, P.y, P.w, P.h, innerGap(st) * sc, g);
  }
  if (style === 'scrap' || style === 'instant') for (const L of g.leaves) {
    const R = mulberry32(L.node.id * 9973 + st.seed * 7919);
    const ang = (R() * 2 - 1) * 6 * st.mess * Math.PI / 180;
    const cx = L.x + L.w / 2 + (R() * 2 - 1) * L.w * .04 * st.mess, cy = L.y + L.h / 2 + (R() * 2 - 1) * L.h * .04 * st.mess;
    const fw = Math.min((style === 'instant' ? Math.max(st.frame, 10) : st.frame) * sc, L.w * .2, L.h * .2);
    const chin = style === 'instant' ? Math.min(Math.max(fw * 3.2, 24 * sc), L.h * .28) : fw;
    L.scrap = { cx, cy, ang, w: L.w, h: L.h, fw, chin, tapeSeed: (R() * 2147483647) | 0 };
    L.pw = Math.max(1, L.w - 2 * fw); L.ph = Math.max(1, L.h - fw - chin);
  }
  if (style === 'shapes' && st.shape === 'stamp') for (const L of g.leaves) {
    const pad = Math.min(Math.max(12 * sc, st.borderW * sc) + 7 * sc, L.w * .25, L.h * .25);
    L.px = L.x + pad; L.py = L.y + pad; L.pw = Math.max(1, L.w - 2 * pad); L.ph = Math.max(1, L.h - 2 * pad);
  }
  return g;
}

/* ================= film looks & adjustments ================= */
const LUTS = {};
function lutFor(name) {
  if (LUTS[name]) return LUTS[name];
  const L = LOOKS[name];
  return (LUTS[name] = [0, 1, 2].map(ch => {
    const a = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i / 255;
      if (L.gamma) v = Math.pow(v, 1 / L.gamma[ch]);
      const s = v * v * (3 - 2 * v); v = v + (s - v) * L.con;
      a[i] = clamp(L.lift[ch] + v * (L.gain[ch] - L.lift[ch]), 0, 255);
    }
    return a;
  }));
}
function adjLUT(useAdj) {
  const s = S.set, ex = useAdj ? Math.pow(2, s.exposure) : 1, k = useAdj ? s.contrast * .8 : 0, w = useAdj ? s.warmth : 0, f = useAdj ? s.fade * .22 : 0;
  const gains = [1 + .09 * w, 1 + .015 * w, 1 - .09 * w];
  return [0, 1, 2].map(ch => {
    const a = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) { let v = Math.min(1, i / 255 * ex * gains[ch]); const sm = v * v * (3 - 2 * v); v = v + (sm - v) * k; v = f + v * (1 - f - f * .25); a[i] = v * 255; }
    return a;
  });
}
function applyPipeline(d, name, amt, useAdj) {
  const A = adjLUT(useAdj), L = LOOKS[name] || LOOKS.none, B = name && name !== 'none' && LOOKS[name] ? lutFor(name) : null, mono = !!L.mono, lsat = L.sat != null ? L.sat : 1;
  const gsat = useAdj ? clamp(1 + S.set.saturation, 0, 2) : 1, A0 = A[0], A1 = A[1], A2 = A[2];
  for (let i = 0; i < d.length; i += 4) {
    let r = A0[d[i]], g = A1[d[i + 1]], b = A2[d[i + 2]];
    if (B) {
      let r2, g2, b2;
      if (mono) { const y = (.299 * r + .587 * g + .114 * b) | 0; r2 = B[0][y]; g2 = B[1][y]; b2 = B[2][y]; }
      else { r2 = B[0][r]; g2 = B[1][g]; b2 = B[2][b]; const y = .299 * r2 + .587 * g2 + .114 * b2; r2 = y + (r2 - y) * lsat; g2 = y + (g2 - y) * lsat; b2 = y + (b2 - y) * lsat; }
      r += (r2 - r) * amt; g += (g2 - g) * amt; b += (b2 - b) * amt;
    }
    if (gsat !== 1) { const y = .299 * r + .587 * g + .114 * b; r = y + (r - y) * gsat; g = y + (g - y) * gsat; b = y + (b - y) * gsat; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
}
const adjKey = () => ADJ_KEYS.map(k => Math.round(S.set[k] * 100)).join(',');
function lookKey() { const s = S.set, a = adjKey(); if (s.look === 'none' && a === '0,0,0,0,0') return 'none'; return s.look + ':' + Math.round(s.lookAmt * 100) + ':' + a; }
let lookQueue = [], lookBusy = false;
function sourceFor(p) {
  if (NO_LOOK) return p.src;
  const key = lookKey();
  if (key === 'none') return p.src;
  const full = p.lk.full, prev = p.lk.prev;
  if (full && full.key === key) return full.src;
  if (!EXPORTING && prev && prev.key === key) return prev.src;
  queueLook(p, EXPORTING ? 'full' : 'prev');
  const pv = p.lk.prev, fu = p.lk.full;
  return (pv && pv.src && pv.src.width !== 0 && pv.src) || (fu && fu.src) || p.src;
}
function queueLook(p, slot) { const key = lookKey(); if (p.lkPend[slot] === key) return; p.lkPend[slot] = key; lookQueue.push({ p, slot }); setTimeout(pumpLooks, 0); }
async function pumpLooks() {
  if (lookBusy) return;
  lookBusy = true;
  while (lookQueue.length) {
    const { p, slot } = lookQueue.shift(), key = lookKey();
    if (key === 'none' || p.lkPend[slot] !== key || (p.lk[slot] && p.lk[slot].key === key)) continue;
    await processLook(p, slot, key);
    if (slot === 'prev') scheduleRender(false);
    await new Promise(r => setTimeout(r, 0));
  }
  lookBusy = false;
}
async function processLook(p, slot, key) {
  const k = slot === 'full' ? 1 : Math.min(1, PREV_MAX / Math.max(p.w, p.h));
  const c = canvasEl(p.w * k, p.h * k), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(p.src, 0, 0, c.width, c.height);
  const id = x.getImageData(0, 0, c.width, c.height);
  applyPipeline(id.data, S.set.look, S.set.lookAmt, true);
  x.putImageData(id, 0, 0);
  const old = p.lk[slot];
  if (slot === 'full') {
    const im = await canvasToImage(c, .93);
    p.lk.full = { key, src: im || c };
    if (im) c.width = c.height = 0;
  } else p.lk.prev = { key, src: c };
  if (old && old.src) { if (old.src._url) URL.revokeObjectURL(old.src._url); else if (old.src !== p.src && old.src.width) { old.src.width = old.src.height = 0; } }
}
function looksReady() {
  if (lookKey() === 'none') return Promise.resolve();
  const need = () => S.active.filter(id => { const p = S.photos.get(id); return !(p.lk.full && p.lk.full.key === lookKey()); });
  need().forEach(id => queueLook(S.photos.get(id), 'full'));
  return new Promise(res => { const check = () => { if (!need().length) res(); else setTimeout(check, 60); }; check(); });
}
let fontsReady = null;
function ensureFonts() {
  if (fontsReady) return fontsReady;
  if (!document.fonts || !document.fonts.load) return (fontsReady = Promise.resolve());
  return (fontsReady = Promise.all(FONT_LOADS.map(s => document.fonts.load(s).catch(() => null))).then(() => null));
}

/* ================= painting ================= */
function cropOf(pid) { return S.crops[pid] || (S.crops[pid] = { z: 1, fx: .5, fy: .5 }); }
function coverRect(pw, ph, x, y, w, h, c) { const s = Math.max(w / pw, h / ph) * c.z, dw = pw * s, dh = ph * s; return { dx: x - (dw - w) * c.fx, dy: y - (dh - h) * c.fy, dw, dh }; }
function drawPhoto(ctx, pid, x, y, w, h) {
  const p = S.photos.get(pid); if (!p) return;
  const r = coverRect(p.w, p.h, x, y, w, h, cropOf(pid));
  ctx.drawImage(sourceFor(p), r.dx, r.dy, r.dw, r.dh);
}
const fontCss = (spec, px) => `${spec.st} ${spec.w} ${Math.max(1, px).toFixed(2)}px ${spec.fam}`;
function measureT(ctx, t, px, tr) { if (!tr) return ctx.measureText(t).width; let w = 0, n = 0; for (const ch of t) { w += ctx.measureText(ch).width; n++; } return w + tr * px * Math.max(0, n - 1); }
function drawLine(ctx, text, spec, px, x, y, align, maxW) {
  const t = spec.up ? text.toUpperCase() : text;
  ctx.font = fontCss(spec, px);
  let w = measureT(ctx, t, px, spec.tr);
  if (maxW > 0 && w > maxW) { px = px * maxW / w; ctx.font = fontCss(spec, px); w = measureT(ctx, t, px, spec.tr); }
  let sx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.textAlign = 'left';
  if (!spec.tr) { ctx.fillText(t, sx, y); return w; }
  for (const ch of t) { ctx.fillText(ch, sx, y); sx += ctx.measureText(ch).width + spec.tr * px; }
  return w;
}
function dateText(d) {
  let v = d ? isoDay(d) : (/^\d{4}-\d{2}-\d{2}$/.test(S.set.date || '') ? S.set.date : todayISO());
  const [Y, M, D] = v.split('-'), yy = Y.slice(2);
  return S.set.dateFmt === 'us' ? `${M} ${D} '${yy}` : S.set.dateFmt === 'dot' ? `${D}.${M}.${yy}` : `'${yy} ${M} ${D}`;
}
function fxVignette(ctx, x, y, w, h, a) {
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(w / 2, h / 2);
  const gr = ctx.createRadialGradient(0, 0, .45, 0, 0, 1.45); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${.85 * a})`);
  ctx.fillStyle = gr; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
}
function fxLeak(ctx, x, y, w, h, a, seed) {
  const R = mulberry32(seed * 131 + S.set.seed * 17 + 5), side = (R() * 4) | 0, t = .15 + R() * .7, m = Math.max(w, h);
  const cx = side === 1 ? x + w : side === 3 ? x : x + w * t, cy = side === 0 ? y : side === 2 ? y + h : y + h * t;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  let gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * .75); gr.addColorStop(0, `rgba(255,150,60,${.95 * a})`); gr.addColorStop(.35, `rgba(255,70,40,${.55 * a})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * .3); gr.addColorStop(0, `rgba(255,235,170,${.7 * a})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.restore();
}
function fxDust(ctx, x, y, w, h, a, seed) {
  const R = mulberry32(seed * 977 + S.set.seed * 31 + 9), sc = PSC;
  const n = Math.min(260, Math.round(a * 60 * (w * h) / (sc * sc * 250000)));
  ctx.save(); ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) { ctx.globalAlpha = .25 + R() * .55; ctx.beginPath(); ctx.arc(x + R() * w, y + R() * h, (.4 + R() * R() * 1.8) * sc, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = .8 * sc;
  const hairs = Math.round(a * 3 * (w * h) / (sc * sc * 360000));
  for (let i = 0; i < hairs; i++) { ctx.globalAlpha = .25 + R() * .3; const hx = x + R() * w, hy = y + R() * h, l = (14 + R() * 30) * sc; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + (R() - .5) * l, hy + (R() - .5) * l, hx + (R() - .5) * l * 1.4, hy + (R() - .5) * l * 1.4); ctx.stroke(); }
  ctx.restore();
}
function fxDate(ctx, x, y, w, h, pid) {
  const sc = PSC, fs = clamp(Math.min(w, h) * .07, 11 * sc, 46 * sc), pad = Math.min(w, h) * .06, p = S.photos.get(pid);
  const t = dateText(S.set.dateAuto && p && p.time ? p.time : null);
  ctx.save(); ctx.font = `700 ${fs}px "Courier New", ui-monospace, Menlo, monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ff9a3c'; ctx.shadowColor = 'rgba(255,100,20,.95)'; ctx.shadowBlur = fs * .45; ctx.fillText(t, x + w - pad, y + h - pad);
  ctx.shadowBlur = fs * .12; ctx.fillStyle = 'rgba(255,214,150,.92)'; ctx.fillText(t, x + w - pad, y + h - pad);
  ctx.restore();
}
function fxCaption(ctx, x, y, w, h, text) {
  const st = S.set, sc = PSC, F = FONTS[st.titleFont] || FONTS.serif;
  const spec = st.titleFont === 'hand' ? F.s : st.titleFont === 'type' ? { fam: F.s.fam, st: 'normal', w: 700, up: false, tr: 0 } : { fam: 'Figtree, system-ui, sans-serif', st: 'normal', w: 600, up: false, tr: 0 };
  let px = clamp(Math.min(w, h) * .055, 12 * sc, 30 * sc) * (st.titleFont === 'hand' ? 1.35 : 1);
  const pad = Math.min(w, h) * .045, maxW = w - 2 * pad - (st.dateStamp ? w * .4 : 0) - px;
  ctx.save(); ctx.font = fontCss(spec, px);
  let t = text, tw = ctx.measureText(t).width;
  if (tw > maxW) { px *= Math.max(.65, maxW / tw); ctx.font = fontCss(spec, px); tw = ctx.measureText(t).width; while (tw > maxW && t.length > 2) { t = t.slice(0, -2) + '…'; tw = ctx.measureText(t).width; } }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (st.capStyle === 'tag') {
    const ch = px * 1.8, cw = tw + px * 1.25, cx = x + pad, cy = y + h - pad - ch;
    ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 6 * sc; ctx.fillStyle = 'rgba(255,255,255,.94)'; rrPath(ctx, cx, cy, cw, ch, ch / 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.fillStyle = '#171512'; ctx.fillText(t, cx + px * .62, cy + ch / 2 + px * .04);
  } else { ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = px * .5; ctx.fillText(t, x + pad, y + h - pad - px * .6); }
  ctx.restore();
}
function drawPhotoFx(ctx, pid, x, y, w, h, seed) {
  drawPhoto(ctx, pid, x, y, w, h);
  const st = S.set;
  if (st.vignette > .001) fxVignette(ctx, x, y, w, h, st.vignette);
  if (st.leak > .001) fxLeak(ctx, x, y, w, h, st.leak, seed);
  if (st.dust > .001) fxDust(ctx, x, y, w, h, st.dust, seed);
  if (st.dateStamp) fxDate(ctx, x, y, w, h, pid);
  const cap = (S.caps[pid] || '').trim(); if (cap) fxCaption(ctx, x, y, w, h, cap);
}
function polyPath(ctx, poly) { ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); }
function rrSub(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function rrPath(ctx, x, y, w, h, r) { ctx.beginPath(); rrSub(ctx, x, y, w, h, r); }
let grainTile = null;
function getGrain() {
  if (grainTile) return grainTile;
  const c = canvasEl(256, 256), x = c.getContext('2d'), id = x.createImageData(256, 256), R = mulberry32(1234);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (R() + R() + R() + R() - 2) * 72; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0);
  return (grainTile = c);
}
function patternFill(ctx, g, scale, op, alpha) {
  const pat = ctx.createPattern(getGrain(), 'repeat');
  try { pat.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0])); } catch (e) { /* older browsers draw grain unscaled */ }
  ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(0, 0, g.W, g.H); ctx.restore();
}

/* backgrounds */
function blurPid() { const st = S.set; if (st.blurPid && S.active.includes(st.blurPid)) return st.blurPid; const ls = leavesOf(S.tree); return ls.length ? ls[0].pid : S.active[0]; }
function blurMid(p) {
  if (p.blurMid) return p.blurMid;
  const t = p.thumb, tw = p.a >= 1 ? 20 : Math.max(4, Math.round(20 * p.a)), th = p.a >= 1 ? Math.max(4, Math.round(20 / p.a)) : 20;
  const tiny = downscale(t, t.width, t.height, tw, th), mid = canvasEl(tw * 6, th * 6), x = mid.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(tiny, 0, 0, mid.width, mid.height);
  return (p.blurMid = mid);
}
function paintBackground(ctx, g) {
  const st = S.set;
  let done = false;
  if (st.bgMode === 'gradient') {
    const G = GRADS[st.grad] || GRADS[0], lg = ctx.createLinearGradient(0, 0, g.W, g.H);
    G.stops.forEach((c, i) => lg.addColorStop(i / (G.stops.length - 1), c));
    ctx.fillStyle = lg; ctx.fillRect(0, 0, g.W, g.H); done = true;
  } else if (st.bgMode === 'blur') {
    const p = S.photos.get(blurPid());
    if (p) { const m = blurMid(p), r = coverRect(m.width, m.height, 0, 0, g.W, g.H, { z: 1.15, fx: .5, fy: .5 }); ctx.drawImage(m, r.dx, r.dy, r.dw, r.dh); ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(0, 0, g.W, g.H); done = true; }
  }
  if (!done) { ctx.fillStyle = st.bg; ctx.fillRect(0, 0, g.W, g.H); }
  if (st.texture || st.style === 'scrap' || st.style === 'instant') patternFill(ctx, g, g.sc * 3, 'soft-light', .35);
}

/* clean grid */
function paintGrid(ctx, g) {
  paintBackground(ctx, g);
  const st = S.set, r = st.radius * g.sc, bw = st.borderW * g.sc, col = borderColor();
  for (const L of g.leaves) {
    ctx.save(); rrPath(ctx, L.x, L.y, L.w, L.h, r); ctx.clip();
    drawPhotoFx(ctx, L.pid, L.px, L.py, L.pw, L.ph, L.node.id);
    if (bw > 0) { ctx.lineWidth = bw * 2; ctx.strokeStyle = col; rrPath(ctx, L.x, L.y, L.w, L.h, r); ctx.stroke(); }
    ctx.restore();
  }
}

/* shapes */
function stampSub(ctx, x, y, w, h, sc) {
  const r = Math.max(2, 6.5 * sc), nx = Math.max(3, Math.round(w / (r * 3.3))), ny = Math.max(3, Math.round(h / (r * 3.3))), sx = w / nx, sy = h / ny;
  ctx.moveTo(x, y);
  for (let i = 0; i < nx; i++) { const c = x + sx * (i + .5); ctx.lineTo(c - r, y); ctx.arc(c, y, r, Math.PI, 0, true); }
  ctx.lineTo(x + w, y);
  for (let i = 0; i < ny; i++) { const c = y + sy * (i + .5); ctx.lineTo(x + w, c - r); ctx.arc(x + w, c, r, -Math.PI / 2, Math.PI / 2, true); }
  ctx.lineTo(x + w, y + h);
  for (let i = nx - 1; i >= 0; i--) { const c = x + sx * (i + .5); ctx.lineTo(c + r, y + h); ctx.arc(c, y + h, r, 0, Math.PI, true); }
  ctx.lineTo(x, y + h);
  for (let i = ny - 1; i >= 0; i--) { const c = y + sy * (i + .5); ctx.lineTo(x, c + r); ctx.arc(x, c, r, Math.PI / 2, -Math.PI / 2, true); }
  ctx.closePath();
}
function shapePath(ctx, L, shape, sc) {
  const { x, y, w, h } = L;
  ctx.beginPath();
  if (shape === 'arch') { const ry = Math.min(w / 2, h * .55); ctx.moveTo(x, y + h); ctx.lineTo(x, y + ry); ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, Math.PI, 2 * Math.PI, false); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  else if (shape === 'oval') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
  else if (shape === 'pill') rrSub(ctx, x, y, w, h, Math.min(w, h) / 2);
  else stampSub(ctx, x, y, w, h, sc);
}
function paintShapes(ctx, g) {
  paintBackground(ctx, g);
  const st = S.set, sc = g.sc, col = borderColor(), bw = st.borderW * sc;
  for (const L of g.leaves) {
    if (st.shape === 'stamp') {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 8 * sc; ctx.shadowOffsetY = 2 * sc; shapePath(ctx, L, 'stamp', sc); ctx.fillStyle = col; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(L.px, L.py, L.pw, L.ph); ctx.clip(); drawPhotoFx(ctx, L.pid, L.px, L.py, L.pw, L.ph, L.node.id); ctx.restore();
    } else {
      ctx.save(); shapePath(ctx, L, st.shape, sc); ctx.clip(); drawPhotoFx(ctx, L.pid, L.px, L.py, L.pw, L.ph, L.node.id);
      if (bw > 0) { ctx.lineWidth = bw * 2; ctx.strokeStyle = col; shapePath(ctx, L, st.shape, sc); ctx.stroke(); }
      ctx.restore();
    }
  }
}

/* torn paper */
const fibreColor = paper => isDark(paper) ? mixHex(paper, '#8a8580', .35) : mixHex(paper, '#ffffff', .55);
function pathBand(ctx, A, B) { ctx.moveTo(A[0][0], A[0][1]); for (let i = 1; i < A.length; i++) ctx.lineTo(A[i][0], A[i][1]); for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath(); }
function addFibre(ctx, P, nx, ny, sc, R, h1, h2) {
  const ang = (h1 - .5) * 1.4, c = Math.cos(ang), s = Math.sin(ang), dx = nx * c - ny * s, dy = nx * s + ny * c, L = (.8 + 4.2 * h2 * h2) * sc * (.5 + R);
  ctx.moveTo(P[0] - nx * .8 * sc, P[1] - ny * .8 * sc); ctx.lineTo(P[0] + dx * L, P[1] + dy * L);
}
/* a strip of torn paper along p1→p2, torn on both sides */
function tornBand(ctx, p1, p2, g, seed, ext, draft, paper, fib) {
  const st = S.set, sc = g.sc, dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, half = st.tear * sc, R = st.rough, k = 1 / sc;
  const total = len + 2 * ext, step = (draft ? 3.5 : 1.6) * sc, N = Math.max(8, Math.ceil(total / step));
  const A = [], B = [], FA = [], FB = [];
  for (let i = 0; i <= N; i++) {
    const s = -ext + total * i / N, ss = s * k, cx = p1[0] + ux * s, cy = p1[1] + uy * s;
    const wander = R * 12 * sc * vnoise(seed + 1, ss / 280);
    const w = half * (1 + .45 * vnoise(seed + 2, ss / 150));
    const ra = R * sc * (6.5 * vnoise(seed + 3, ss / 52) + 2.8 * vnoise(seed + 4, ss / 14) + 1.2 * vnoise(seed + 5, ss / 3.8));
    const rb = R * sc * (6.5 * vnoise(seed + 7, ss / 52) + 2.8 * vnoise(seed + 8, ss / 14) + 1.2 * vnoise(seed + 9, ss / 3.8));
    const oa = wander + Math.max(w * .35, w + ra), ob = wander - Math.max(w * .35, w + rb);
    A.push([cx + nx * oa, cy + ny * oa]); B.push([cx + nx * ob, cy + ny * ob]);
    const fa = oa + (.8 + 2.2 * Math.abs(vnoise(seed + 6, ss / 2.1))) * sc * (.35 + R), fb = ob - (.8 + 2.2 * Math.abs(vnoise(seed + 10, ss / 2.1))) * sc * (.35 + R);
    FA.push([cx + nx * fa, cy + ny * fa]); FB.push([cx + nx * fb, cy + ny * fb]);
  }
  ctx.save();
  ctx.beginPath(); pathBand(ctx, A, B);
  ctx.shadowColor = isDark(paper) ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.3)'; ctx.shadowBlur = 7 * sc; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1.5 * sc;
  ctx.fillStyle = paper; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = fib; ctx.beginPath(); pathBand(ctx, FA, FB); ctx.fill(); ctx.restore();
  ctx.fillStyle = paper; ctx.beginPath(); pathBand(ctx, A, B); ctx.fill();
  if (!draft) {
    ctx.save(); ctx.strokeStyle = fib; ctx.globalAlpha = .55; ctx.lineWidth = Math.max(.5, .7 * sc); ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      if (hash2(seed + 20, i) < .45) addFibre(ctx, A[i], nx, ny, sc, R, hash2(seed + 21, i), hash2(seed + 22, i));
      if (hash2(seed + 23, i) < .45) addFibre(ctx, B[i], -nx, -ny, sc, R, hash2(seed + 24, i), hash2(seed + 25, i));
    }
    ctx.stroke(); ctx.restore();
  }
}
function tornEdgeList(g) {
  const out = [], seen = new Set(), e = .5;
  g.tornEdges.forEach((r, ri) => {
    const c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const on = [r.y > e, r.x + r.w < g.W - e, r.y + r.h < g.H - e, r.x > e];
    for (let i = 0; i < 4; i++) {
      if (!on[i]) continue;
      const a = c[i], b = c[(i + 1) % 4], key = [a, b].map(p => p.map(v => Math.round(v / 3)).join(',')).sort().join('|');
      if (seen.has(key)) continue; seen.add(key);
      out.push({ a, b, seed: S.set.seed * 104729 + ri * 977 + i * 131 + 17 });
    }
  });
  return out;
}
function drawTornStrips(ctx, g, draft) {
  const st = S.set, paper = borderColor('torn'), fib = fibreColor(paper), sc = g.sc;
  for (const d of g.divs) {
    ctx.save(); polyPath(ctx, d.poly); ctx.clip();
    tornBand(ctx, [d.x1, d.y1], [d.x2, d.y2], g, d.node.id * 7919 + st.seed * 104729, st.tear * sc * 4 + 30 * sc, draft, paper, fib);
    ctx.restore();
  }
  for (const E of tornEdgeList(g)) tornBand(ctx, E.a, E.b, g, E.seed, st.tear * sc * 4 + 6 * sc, draft, paper, fib);
}
let tornCache = { key: null, canvas: null, draft: false };
function tornLayer(g, draft) {
  const st = S.set, rd = v => Math.round(v);
  const key = [g.W, g.H, g.divs.map(d => [d.node.id, rd(d.x1), rd(d.y1), rd(d.x2), rd(d.y2)].join(',')).join(';'), g.tornEdges.map(r => [rd(r.x), rd(r.y), rd(r.w), rd(r.h)].join(',')).join(';'), st.tear, st.rough, borderColor('torn'), st.seed].join('|');
  if (tornCache.key === key && (!tornCache.draft || draft)) return tornCache.canvas;
  const c = tornCache.canvas || document.createElement('canvas');
  if (c.width !== g.W || c.height !== g.H) { c.width = g.W; c.height = g.H; }
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  drawTornStrips(x, g, draft);
  tornCache = { key, canvas: c, draft };
  return c;
}
function paintTorn(ctx, g, opt) {
  paintBackground(ctx, g);
  for (const L of g.leaves) { ctx.save(); polyPath(ctx, L.poly); ctx.clip(); drawPhotoFx(ctx, L.pid, L.px, L.py, L.pw, L.ph, L.node.id); ctx.restore(); }
  if (opt.preview) ctx.drawImage(tornLayer(g, opt.draft), 0, 0);
  else drawTornStrips(ctx, g, !!opt.draft);
}

/* scrapbook & instant */
const TAPES = ['rgba(238,224,182,.8)', 'rgba(196,222,214,.75)', 'rgba(242,196,188,.75)', 'rgba(222,214,238,.75)', 'rgba(250,232,140,.7)'];
function drawTape(ctx, R, w, h, sc) {
  const tw = Math.min(w * .42, 170 * sc), th = 30 * sc + R() * 8 * sc, x = (R() - .5) * w * .3, y = -h / 2 + (R() - .5) * 6 * sc, ang = (R() - .5) * .28, z = 4, zh = th / z, j = 3 * sc;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = TAPES[(R() * TAPES.length) | 0];
  ctx.beginPath(); ctx.moveTo(-tw / 2, -th / 2); ctx.lineTo(tw / 2, -th / 2);
  for (let i = 1; i <= z; i++) ctx.lineTo(tw / 2 - (i % 2 ? j : 0), -th / 2 + i * zh);
  ctx.lineTo(-tw / 2, th / 2);
  for (let i = z - 1; i >= 0; i--) ctx.lineTo(-tw / 2 + (i % 2 ? j : 0), -th / 2 + i * zh);
  ctx.closePath(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 3 * sc; ctx.fill();
  ctx.restore();
}
function paintScrap(ctx, g) {
  paintBackground(ctx, g);
  const st = S.set, sc = g.sc, col = borderColor();
  for (const L of g.leaves) {
    const s = L.scrap;
    ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(s.ang);
    ctx.save(); ctx.shadowColor = 'rgba(20,12,4,.32)'; ctx.shadowBlur = 16 * sc; ctx.shadowOffsetY = 6 * sc; ctx.fillStyle = col; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); ctx.restore();
    const ix = -s.w / 2 + s.fw, iy = -s.h / 2 + s.fw;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, L.pw, L.ph); ctx.clip(); drawPhotoFx(ctx, L.pid, ix, iy, L.pw, L.ph, L.node.id); ctx.restore();
    if (st.tape) { const R = mulberry32(s.tapeSeed); if (R() < .9) drawTape(ctx, R, s.w, s.h, sc); }
    ctx.restore();
  }
}

/* film strip */
function paintFilm(ctx, g) {
  paintBackground(ctx, g);
  if (!g.strips || !g.strips.length) return;
  const st = S.set, sc = g.sc, col = borderColor('film'), dark = isDark(col), base = ctx.getTransform();
  const blank = dark ? '#0b0a09' : mixHex(col, '#000000', .08);
  for (const s of g.strips) {
    const F = s.F;
    ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(s.base + s.ang);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16 * sc; ctx.shadowOffsetY = 4 * sc; ctx.fillStyle = col; ctx.fillRect(-s.w / 2, -s.len / 2, s.w, s.len); ctx.restore();
    if (st.sprockets) {
      const hw = F.sb * .42, hh = hw * .74, pitch = hh * 2.15;
      ctx.save(); ctx.beginPath();
      for (let y = -s.len / 2 + pitch / 2; y < s.len / 2 - hh / 2; y += pitch) for (const sx of [-s.w / 2 + F.sb / 2, s.w / 2 - F.sb / 2]) rrSub(ctx, sx - hw / 2, y - hh / 2, hw, hh, hh * .3);
      ctx.clip(); ctx.setTransform(base); paintBackground(ctx, g); ctx.restore();
    }
    for (const fr of s.frames) {
      ctx.save(); ctx.beginPath(); ctx.rect(-F.fa / 2, fr.ly - F.fl / 2, F.fa, F.fl); ctx.fillStyle = blank; ctx.fill();
      if (fr.pid) {
        ctx.clip(); ctx.translate(0, fr.ly); ctx.rotate(-s.base);
        const bw = F.vertical ? F.fa : F.fl, bh = F.vertical ? F.fl : F.fa;
        drawPhotoFx(ctx, fr.pid, -bw / 2, -bh / 2, bw, bh, fr.leaf ? fr.leaf.id : fr.num);
      }
      ctx.restore();
    }
    if (st.edgeText) {
      const fs = Math.max(5 * sc, F.sb * .3);
      ctx.save(); ctx.fillStyle = dark ? 'rgba(236,160,70,.85)' : 'rgba(60,55,50,.6)'; ctx.font = `700 ${fs}px "Courier New", ui-monospace, Menlo, monospace`; ctx.textBaseline = 'middle';
      const xIn = s.w / 2 - F.sb * (st.sprockets ? .9 : .5), xOut = -s.w / 2 + F.sb * (st.sprockets ? .9 : .5);
      s.frames.forEach((fr, i) => {
        const y0 = fr.ly - F.fl / 2;
        ctx.save(); ctx.translate(xIn, y0 + fs); ctx.rotate(Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText(`${fr.num}  ▸ ${fr.num}A`, 0, 0); ctx.restore();
        if (i % 2 === 0) { ctx.save(); ctx.translate(xOut, fr.ly); ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('TESSERA 400', 0, 0); ctx.restore(); }
      });
      ctx.restore();
    }
    ctx.restore();
  }
}

/* titles, section headings */
function textColor(over) {
  const st = S.set;
  if (st.textColor && st.textColor !== 'auto') return st.textColor;
  if (over || st.bgMode === 'blur') return '#ffffff';
  if (st.bgMode === 'gradient') {
    const G = GRADS[st.grad] || GRADS[0], avg = G.stops.map(hexToRgb).reduce((a, c) => a.map((v, i) => v + c[i] / G.stops.length), [0, 0, 0]);
    return (0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2]) < 130 ? '#ffffff' : '#171512';
  }
  return isDark(st.bg) ? '#ffffff' : '#171512';
}
function textShadow(ctx, col, sc, strong) {
  if (strong) { ctx.shadowColor = isDark(col) ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18 * sc; }
  else if (S.set.bgMode === 'blur') { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10 * sc; }
}
function drawTitle(ctx, g) {
  const st = S.set, ti = g.title, T = ti.T, F = T.F, sc = g.sc, box = ti.box, D = dims(), col = textColor(ti.over);
  let x0 = box.x, x1 = box.x + box.w;
  if (D.slides) x1 = Math.min(x1, g.W / D.slides - box.x);
  const padX = box.x < 1 ? 32 * sc : 0, align = st.textAlign, ax = align === 'left' ? x0 + padX : (x0 + x1) / 2, maxW = (x1 - x0) - 2 * Math.max(padX, 16 * sc);
  let y = ti.over ? box.y + box.h / 2 - T.blockH / 2 : box.y + 28 * sc;
  ctx.save(); ctx.fillStyle = col; ctx.textBaseline = 'middle'; textShadow(ctx, col, sc, ti.over);
  const t = (st.title || '').trim(), s = (st.subtitle || '').trim();
  if (t) { drawLine(ctx, t, F.t, T.tpx, ax, y + T.lineT / 2, align, maxW); y += T.lineT + T.spx * .75; }
  if (s) { ctx.globalAlpha = .85; drawLine(ctx, s, F.s, T.spx, ax, y + T.spx * .6, align, maxW); }
  ctx.restore();
}
function drawHead(ctx, g, h) {
  const st = S.set, sc = g.sc, M = headMetrics(st, sc), F = M.F, box = h.box, s = h.sec, col = textColor(false);
  const name = (s.name || '').trim(), note = (s.note || '').trim(); if (!name && !note) return;
  const padX = box.x < 1 ? 28 * sc : 0, gapW = M.npx * .9;
  ctx.save(); ctx.fillStyle = col; ctx.textBaseline = 'middle'; textShadow(ctx, col, sc, false);
  ctx.font = fontCss(F.t, M.hpx); const w1 = name ? measureT(ctx, F.t.up ? name.toUpperCase() : name, M.hpx, F.t.tr) : 0;
  ctx.font = fontCss(F.s, M.npx); const w2 = note ? measureT(ctx, F.s.up ? note.toUpperCase() : note, M.npx, F.s.tr) : 0;
  const total = w1 + (name && note ? gapW : 0) + w2, maxW = box.w - 2 * Math.max(padX, 8 * sc), k = total > maxW ? maxW / total : 1;
  let x = st.textAlign === 'left' ? box.x + padX : box.x + box.w / 2 - total * k / 2;
  const cy = box.y + box.h * .54;
  if (name) { drawLine(ctx, name, F.t, M.hpx * k, x, cy, 'left', 0); x += (w1 + gapW) * k; }
  if (note) { ctx.globalAlpha = .72; drawLine(ctx, note, F.s, M.npx * k, x, cy, 'left', 0); }
  ctx.restore();
}
function paintText(ctx, g) {
  if (S.set.secHeads) for (const h of g.heads) drawHead(ctx, g, h);
  if (g.title) drawTitle(ctx, g);
}

function paint(ctx, g, opt) {
  const st = S.set; PSC = g.sc;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!S.tree) paintBackground(ctx, g);
  else {
    if (st.style === 'torn') paintTorn(ctx, g, opt);
    else if (st.style === 'scrap' || st.style === 'instant') paintScrap(ctx, g);
    else if (st.style === 'film') paintFilm(ctx, g);
    else if (st.style === 'shapes') paintShapes(ctx, g);
    else paintGrid(ctx, g);
    paintText(ctx, g);
  }
  if (S.tree && st.grain > .001) patternFill(ctx, g, Math.max(.6, g.sc * 1.1), 'overlay', st.grain * .6);
  ctx.restore();
}
/* render the current photos with other settings (style tiles, favourites) */
function renderWith(override, boxH, maxW, dpr, postLook, treeFn) {
  const saved = S.set;
  S.set = Object.assign({}, saved, override, override.border ? { border: Object.assign({}, saved.border, override.border) } : {});
  try {
    const D = dims(), asp = D.w / D.h;
    let th = boxH, tw = Math.round(th * asp); if (tw > maxW) { tw = maxW; th = Math.round(tw / asp); }
    const cv = canvasEl(tw * dpr, th * dpr); cv.style.width = tw + 'px'; cv.style.height = th + 'px';
    const tree = (treeFn && treeFn()) || S.tree;
    if (!tree) return cv;
    NO_LOOK = !!postLook;
    paint(cv.getContext('2d'), geometryFor(tree, cv.width, cv.height, S.set), { draft: true, preview: false });
    if (postLook && lookKey() !== 'none') { const x = cv.getContext('2d'); const id = x.getImageData(0, 0, cv.width, cv.height); applyPipeline(id.data, S.set.look, S.set.lookAmt, true); x.putImageData(id, 0, 0); }
    return cv;
  } finally { NO_LOOK = false; S.set = saved; }
}

/* ================= preview & overlay ================= */
const stage = $('#stage'), frame = $('#frame'), view = $('#view'), ov = $('#ov'), scrub = $('#scrub');
const vctx = view.getContext('2d'), octx = ov.getContext('2d');
let lastGeom = null, raf = 0, wantFull = false, gesture = null, swapMode = false, mini = null;

function fitStage() {
  const r = stage.getBoundingClientRect(), D = dims(), asp = D.w / D.h;
  const pad = r.width < 500 ? 16 : 32, cta = $('#samplePill');
  // With samples on screen, the "Add your photos" card gets its own space under the collage.
  const ctaH = cta.hidden ? 0 : cta.offsetHeight + 12;
  const carousel = !!D.slides, scrubH = carousel ? 76 : 0;
  const aw = Math.max(40, r.width - pad * 2), ah = Math.max(40, r.height - pad * 2 - scrubH - ctaH);
  let w, h;
  if (carousel) { const sa = D.slideW / D.h; h = Math.min(ah, aw / (sa * 1.25)); w = Math.min(aw, h * asp); }
  else { w = aw; h = w / asp; if (h > ah) { h = ah; w = h * asp; } }
  w = Math.floor(w); h = Math.floor(h);
  const windowed = carousel && h * asp > w + 1;
  frame.style.width = w + 'px'; frame.style.height = h + 'px';
  frame.style.marginTop = '0px'; frame.style.marginBottom = ((windowed ? scrubH : 0) + ctaH) + 'px';
  scrub.style.bottom = (12 + ctaH) + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5), pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (view.width !== pw || view.height !== ph) { view.width = ov.width = pw; view.height = ov.height = ph; }
  scrub.hidden = !windowed || S.active.length === 0;
  if (!scrub.hidden) {
    const mh = Math.max(24, Math.min(52, (aw - 12) / asp)), sw = Math.round(mh * asp + 12), shh = Math.round(mh + 12);
    scrub.style.width = sw + 'px'; scrub.style.height = shh + 'px'; scrub.width = Math.round(sw * dpr); scrub.height = Math.round(shh * dpr); mini = null;
  }
  scheduleRender(false);
}
function scheduleRender(draft) {
  if (!draft) wantFull = true;
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; const full = wantFull; wantFull = false; renderView(!full); });
}
function renderView(draft) {
  const D = dims(), Hv = view.height, Wv = D.slides ? Math.max(view.width, Math.round(Hv * D.w / D.h)) : view.width;
  const g = geometryFor(S.tree, Wv, Hv, S.set);
  viewOff = clamp(viewOff, 0, Math.max(0, Wv - view.width)); g.off = viewOff;
  lastGeom = g;
  vctx.setTransform(1, 0, 0, 1, -g.off, 0);
  paint(vctx, g, { draft, preview: true });
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  drawOverlay();
  if (!scrub.hidden) { if (!draft || !mini) updateMini(); drawScrub(); }
}
function updateMini() {
  const D = dims(), asp = D.w / D.h, pad = 6 * (scrub.width / Math.max(1, scrub.getBoundingClientRect().width || 1));
  let mh = scrub.height - pad * 2, mw = mh * asp;
  if (mw > scrub.width - pad * 2) { mw = scrub.width - pad * 2; mh = mw / asp; }
  const c = canvasEl(mw, mh);
  if (S.tree) paint(c.getContext('2d'), geometryFor(S.tree, c.width, c.height, S.set), { draft: true, preview: false });
  mini = { c, x: (scrub.width - c.width) / 2, y: (scrub.height - c.height) / 2 };
}
const UI_DARK = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: true };
if (UI_DARK.addEventListener) UI_DARK.addEventListener('change', () => { if (!scrub.hidden) drawScrub(); });
function drawScrub() {
  const x = scrub.getContext('2d'), g = lastGeom; if (!mini || !g) return;
  const k = scrub.width / (scrub.getBoundingClientRect().width || 1);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, scrub.width, scrub.height);
  x.fillStyle = UI_DARK.matches ? 'rgba(27,25,28,.92)' : 'rgba(255,253,249,.94)'; rrPath(x, 0, 0, scrub.width, scrub.height, 10 * k); x.fill();
  x.drawImage(mini.c, mini.x, mini.y);
  const kk = mini.c.width / g.W, wx = mini.x + g.off * kk, ww = view.width * kk;
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(mini.x, mini.y, wx - mini.x, mini.c.height); x.fillRect(wx + ww, mini.y, mini.x + mini.c.width - wx - ww, mini.c.height);
  x.lineWidth = 2 * k; x.strokeStyle = '#ff6b3d'; x.strokeRect(wx + 1, mini.y + 1, ww - 2, mini.c.height - 2);
  const D = dims(); x.fillStyle = UI_DARK.matches ? 'rgba(255,255,255,.75)' : 'rgba(26,24,25,.7)';
  for (let i = 1; i < D.slides; i++) x.fillRect(mini.x + mini.c.width * i / D.slides - .5, mini.y, 1, mini.c.height);
}
function scrubTo(e) {
  const g = lastGeom; if (!mini || !g) return;
  const r = scrub.getBoundingClientRect(), px = (e.clientX - r.left) * (scrub.width / r.width);
  const fx = clamp((px - mini.x) / mini.c.width, 0, 1);
  viewOff = fx * g.W - view.width / 2; scheduleRender(true);
}
scrub.addEventListener('pointerdown', e => { try { scrub.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } scrub._down = true; scrubTo(e); });
scrub.addEventListener('pointermove', e => { if (scrub._down) scrubTo(e); });
const scrubUp = () => { if (scrub._down) { scrub._down = false; scheduleRender(false); } };
scrub.addEventListener('pointerup', scrubUp); scrub.addEventListener('pointercancel', scrubUp);

const handlesOn = () => tab === 'layout' && !S.sel && !!S.tree && !swapMode && S.set.style !== 'film';
function filmCorners(L) {
  const s = L.film.strip, fr = L.film.fr, F = s.F, t = s.base + s.ang, c = Math.cos(t), sn = Math.sin(t);
  return [[-F.fa / 2, fr.ly - F.fl / 2], [F.fa / 2, fr.ly - F.fl / 2], [F.fa / 2, fr.ly + F.fl / 2], [-F.fa / 2, fr.ly + F.fl / 2]].map(([x, y]) => [s.cx + x * c - y * sn, s.cy + x * sn + y * c]);
}
function leafPath(ctx, L) {
  if (L.film) polyPath(ctx, filmCorners(L));
  else if (L.poly) polyPath(ctx, L.poly);
  else if (L.scrap) {
    const s = L.scrap, c = Math.cos(s.ang), sn = Math.sin(s.ang);
    polyPath(ctx, [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]].map(([x, y]) => [s.cx + x * c - y * sn, s.cy + x * sn + y * c]));
  } else if (S.set.style === 'shapes') shapePath(ctx, L, S.set.shape, lastGeom ? lastGeom.sc : 1);
  else { ctx.beginPath(); ctx.rect(L.x, L.y, L.w, L.h); }
}
/* where Instagram's 3:4 profile grid crops the post (the first slide for carousels) */
function guideRect(g) {
  const D = dims(), st = S.set;
  if (st.format === 'story') return null;
  const sw = D.slides ? g.W / D.slides : g.W, H = g.H, tw = Math.min(sw, H * .75), th = Math.min(H, sw / .75);
  return { x: (sw - tw) / 2, y: (H - th) / 2, w: tw, h: th, sw };
}
function drawOverlay() {
  const o = octx, g = lastGeom;
  o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, ov.width, ov.height);
  if (!g || !S.tree) return;
  const k = ov.width / Math.max(1, ov.getBoundingClientRect().width || 1), D = dims();
  o.translate(-g.off, 0);
  if (gridGuide) {
    const r = guideRect(g);
    if (r) {
      o.save(); o.fillStyle = 'rgba(10,9,10,.55)'; o.beginPath(); o.rect(0, 0, r.sw, g.H); o.rect(r.x + r.w, r.y, -r.w, r.h); o.fill('evenodd');
      o.setLineDash([6 * k, 5 * k]); o.lineWidth = 1.5 * k; o.strokeStyle = '#fff'; o.strokeRect(r.x, r.y, r.w, r.h); o.setLineDash([]);
      o.font = `700 ${11 * k}px Figtree, system-ui, sans-serif`; o.textBaseline = 'middle'; o.textAlign = 'center';
      const lw = 112 * k, lx = r.x + r.w / 2, ly = r.y + r.h - 18 * k; o.fillStyle = 'rgba(19,18,20,.85)'; rrPath(o, lx - lw / 2, ly - 10 * k, lw, 20 * k, 10 * k); o.fill(); o.fillStyle = '#fff'; o.fillText('Profile grid crop', lx, ly + .5 * k);
      o.restore();
    }
  }
  if (D.slides) {
    const sw = g.W / D.slides;
    for (let i = 1; i < D.slides; i++) {
      const x = i * sw;
      o.lineWidth = 3 * k; o.strokeStyle = 'rgba(0,0,0,.28)'; o.beginPath(); o.moveTo(x, 0); o.lineTo(x, g.H); o.stroke();
      o.setLineDash([7 * k, 6 * k]); o.lineWidth = 1.5 * k; o.strokeStyle = 'rgba(255,255,255,.9)'; o.beginPath(); o.moveTo(x, 0); o.lineTo(x, g.H); o.stroke(); o.setLineDash([]);
    }
    o.font = `700 ${11 * k}px Figtree, system-ui, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
    for (let i = 0; i < D.slides; i++) { const cx = i * sw + 18 * k, cy = 16 * k; o.fillStyle = 'rgba(19,18,20,.78)'; rrPath(o, cx - 12 * k, cy - 9 * k, 24 * k, 18 * k, 9 * k); o.fill(); o.fillStyle = '#fff'; o.fillText(String(i + 1), cx, cy + .5 * k); }
  }
  if (swapMode) {
    for (const L of g.leaves) {
      if (L.pid === S.sel) continue;
      leafPath(o, L); o.fillStyle = 'rgba(255,107,61,.18)'; o.fill();
      o.setLineDash([6 * k, 5 * k]); o.lineWidth = 2 * k; o.strokeStyle = 'rgba(255,255,255,.9)'; o.stroke(); o.setLineDash([]);
    }
  }
  if (S.sel) {
    const L = g.leaves.find(l => l.pid === S.sel);
    if (L) { leafPath(o, L); o.lineWidth = 5 * k; o.strokeStyle = 'rgba(0,0,0,.35)'; o.stroke(); o.lineWidth = 2.5 * k; o.strokeStyle = '#ff6b3d'; o.stroke(); }
  }
  if (gesture && gesture.type === 'drag') {
    const t = gesture.target;
    if (t && t.pid !== gesture.L.pid) { leafPath(o, t); o.fillStyle = 'rgba(255,107,61,.28)'; o.fill(); o.lineWidth = 3 * k; o.strokeStyle = '#ff6b3d'; o.stroke(); }
    else if (gesture.region) { const R = gesture.region.rect; o.save(); o.fillStyle = 'rgba(255,107,61,.12)'; o.fillRect(R.x, R.y, R.w, R.h); o.setLineDash([8 * k, 6 * k]); o.lineWidth = 3 * k; o.strokeStyle = '#ff6b3d'; o.strokeRect(R.x, R.y, R.w, R.h); o.restore(); }
    const p = S.photos.get(gesture.L.pid), r = 36 * k, cx = gesture.pos.x, cy = gesture.pos.y - 56 * k;
    o.save(); o.shadowColor = 'rgba(0,0,0,.45)'; o.shadowBlur = 14 * k; o.beginPath(); o.arc(cx, cy, r + 3 * k, 0, 7); o.fillStyle = '#fff'; o.fill(); o.restore();
    o.save(); o.beginPath(); o.arc(cx, cy, r, 0, 7); o.clip(); const cr = coverRect(p.thumb.width, p.thumb.height, cx - r, cy - r, 2 * r, 2 * r, { z: 1, fx: .5, fy: .5 }); o.drawImage(p.thumb, cr.dx, cr.dy, cr.dw, cr.dh); o.restore();
  }
  if (handlesOn() || (gesture && gesture.type === 'div')) {
    for (const d of g.divs) {
      const mx = (d.x1 + d.x2) / 2, my = (d.y1 + d.y2) / 2, ang = Math.atan2(d.y2 - d.y1, d.x2 - d.x1), hl = 34 * k, ht = 9 * k, active = gesture && gesture.type === 'div' && gesture.d.node.id === d.node.id;
      o.save(); o.translate(mx, my); o.rotate(ang);
      o.shadowColor = 'rgba(0,0,0,.45)'; o.shadowBlur = 6 * k;
      rrPath(o, -hl / 2, -ht / 2, hl, ht, ht / 2); o.fillStyle = active ? '#ff6b3d' : '#ffffff'; o.fill();
      o.shadowColor = 'transparent'; o.lineWidth = 1 * k; o.strokeStyle = 'rgba(0,0,0,.35)'; o.stroke();
      o.restore();
    }
  }
}

/* ================= interaction ================= */
const pointers = new Map();
let lpTimer = 0;
function pt(e) { const r = ov.getBoundingClientRect(), k = ov.width / r.width; return { x: (e.clientX - r.left) * k + (lastGeom ? lastGeom.off : 0), y: (e.clientY - r.top) * k }; }
const kpx = () => ov.width / Math.max(1, ov.getBoundingClientRect().width);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function hitLeaf(g, p) {
  if (!g) return null;
  for (let i = g.leaves.length - 1; i >= 0; i--) {
    const L = g.leaves[i];
    if (L.film) { const s = L.film.strip, fr = L.film.fr, F = s.F, t = -(s.base + s.ang), dx = p.x - s.cx, dy = p.y - s.cy, lx = dx * Math.cos(t) - dy * Math.sin(t), ly = dx * Math.sin(t) + dy * Math.cos(t); if (Math.abs(lx) <= F.fa / 2 && Math.abs(ly - fr.ly) <= F.fl / 2) return L; }
    else if (L.poly) { if (inPoly(L.poly, p)) return L; }
    else if (L.scrap) { const s = L.scrap, dx = p.x - s.cx, dy = p.y - s.cy, c = Math.cos(-s.ang), sn = Math.sin(-s.ang), rx = dx * c - dy * sn, ry = dx * sn + dy * c; if (Math.abs(rx) <= s.w / 2 && Math.abs(ry) <= s.h / 2) return L; }
    else if (p.x >= L.x && p.x <= L.x + L.w && p.y >= L.y && p.y <= L.y + L.h) return L;
  }
  return null;
}
function hitDiv(g, p) {
  if (!g || !handlesOn()) return null;
  const thr = 22 * kpx(); let best = null, bd = thr;
  for (const d of g.divs) {
    const vx = d.x2 - d.x1, vy = d.y2 - d.y1, l2 = vx * vx + vy * vy || 1, t = clamp(((p.x - d.x1) * vx + (p.y - d.y1) * vy) / l2, 0, 1);
    const dd = Math.hypot(p.x - (d.x1 + vx * t), p.y - (d.y1 + vy * t));
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
function panBy(L, dx, dy) {
  const p = S.photos.get(L.pid), c = cropOf(L.pid), s = Math.max(L.pw / p.w, L.ph / p.h) * c.z, ox = p.w * s - L.pw, oy = p.h * s - L.ph;
  if (ox > .5) c.fx = clamp(c.fx - dx / ox, 0, 1);
  if (oy > .5) c.fy = clamp(c.fy - dy / oy, 0, 1);
}
function startPinch() {
  const pts = Array.from(pointers.values()), g = lastGeom, mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  clearTimeout(lpTimer);
  let L = S.sel ? g.leaves.find(l => l.pid === S.sel) : null;
  if (!L) { L = hitLeaf(g, mid); if (L) select(L.pid); }
  if (!L) { gesture = null; return; }
  gesture = { type: 'pinch', L, d0: Math.max(1, dist(pts[0], pts[1])), z0: cropOf(L.pid).z, last: mid, changed: false };
}
ov.addEventListener('pointerdown', e => {
  if (!S.tree) return;
  try { ov.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const p = pt(e); pointers.set(e.pointerId, p);
  if (pointers.size === 2) { startPinch(); return; }
  if (pointers.size > 2) return;
  const g = lastGeom;
  if (swapMode) {
    const L = hitLeaf(g, p);
    if (L && L.pid !== S.sel) { swapPids(S.sel, L.pid); commit(); scheduleRender(false); }
    setSwap(false); gesture = null; return;
  }
  const d = hitDiv(g, p);
  if (d) { gesture = { type: 'div', d, start: p, r0: d.node.r, changed: false }; drawOverlay(); return; }
  const L = hitLeaf(g, p);
  if (!L) { select(null); gesture = null; return; }
  if (S.sel !== L.pid) select(L.pid);
  gesture = { type: 'pan', L, start: p, last: p, moved: false, changed: false };
  clearTimeout(lpTimer);
  lpTimer = setTimeout(() => {
    if (gesture && gesture.type === 'pan' && !gesture.moved && pointers.size === 1) {
      gesture = { type: 'drag', L: gesture.L, pos: gesture.last, target: null, region: null, cx: e.clientX, cy: e.clientY };
      if (navigator.vibrate) try { navigator.vibrate(10); } catch (err) { /* not supported */ }
      if (NATIVE && NATIVE.haptic) NATIVE.haptic();
      drawOverlay();
    }
  }, 350);
});
ov.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const p = pt(e); pointers.set(e.pointerId, p);
  if (!gesture) return;
  if (gesture.type === 'pinch') {
    if (pointers.size < 2) return;
    const pts = Array.from(pointers.values()), mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const c = cropOf(gesture.L.pid);
    c.z = clamp(gesture.z0 * dist(pts[0], pts[1]) / gesture.d0, 1, 4);
    panBy(gesture.L, mid.x - gesture.last.x, mid.y - gesture.last.y);
    gesture.last = mid; gesture.changed = true; syncZoom(); scheduleRender(true);
  } else if (gesture.type === 'pan') {
    if (!gesture.moved && dist(p, gesture.start) < 6 * kpx()) { gesture.last = p; return; }
    gesture.moved = true; clearTimeout(lpTimer);
    panBy(gesture.L, p.x - gesture.last.x, p.y - gesture.last.y);
    gesture.last = p; gesture.changed = true; scheduleRender(true);
  } else if (gesture.type === 'div') {
    const d = gesture.d, n = d.node;
    const span = d.dir === 'v' ? d.box.w - d.gap : d.box.h - d.gap;
    const delta = d.dir === 'v' ? p.x - gesture.start.x : p.y - gesture.start.y;
    n.r = clamp(gesture.r0 + delta / Math.max(1, span), .08, .92);
    gesture.changed = true; scheduleRender(true);
  } else if (gesture.type === 'drag') {
    gesture.cx = e.clientX; gesture.cy = e.clientY;
    dragTo(p); dragAutoScroll();
  }
});
// Where a dragged photo would land: another photo (swap) or the empty space of another image or section (move).
// Several images: anywhere in another image that isn't a photo (its margins, gaps, heading) counts.
function sectionRegionAt(p) {
  if (!hasSecs() || !lastGeom) return null;
  const D = dims(), g = lastGeom, secs = S.tree.secs;
  if (D.slides) {
    const sw = g.W / D.slides, i = Math.floor(p.x / sw);
    return i >= 0 && i < Math.min(secs.length, D.slides) ? { sec: secs[i], rect: { x: i * sw, y: 0, w: sw, h: g.H } } : null;
  }
  const R = frameFor(g.W, g.H, S.set, S.tree).regions.find(R => p.x >= R.rect.x && p.x <= R.rect.x + R.rect.w && p.y >= R.rect.y - 1 && p.y <= R.rect.y + R.rect.h + 1);
  return R ? { sec: R.sec, rect: R.rect } : null;
}
function dragTo(p) {
  const gs = gesture; gs.pos = p; gs.target = hitLeaf(lastGeom, p);
  gs.region = null;
  if (!gs.target) {
    const R = sectionRegionAt(p), from = secIndexOf(gs.L.pid);
    if (R && R.sec && S.tree.secs.indexOf(R.sec) !== from) gs.region = R;
  }
  drawOverlay();
}
// While dragging a photo near the left or right edge of a several-image preview, slide the view along.
function dragAutoScroll() {
  const gs = gesture; clearInterval(dragAutoScroll.t);
  if (!gs || gs.type !== 'drag' || !dims().slides) return;
  const r = ov.getBoundingClientRect(), edge = gs.cx < r.left + 36 ? -1 : gs.cx > r.right - 36 ? 1 : 0;
  if (!edge) return;
  dragAutoScroll.t = setInterval(() => {
    if (!gesture || gesture.type !== 'drag') { clearInterval(dragAutoScroll.t); return; }
    viewOff += edge * 16 * kpx(); renderView(true);
    dragTo(pt({ clientX: gesture.cx, clientY: gesture.cy }));
  }, 30);
}
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  clearTimeout(lpTimer);
  if (!gesture) return;
  if (gesture.type === 'pinch' && pointers.size > 0) {
    if (gesture.changed) commit();
    const rest = Array.from(pointers.values())[0];
    gesture = { type: 'pan', L: gesture.L, start: rest, last: rest, moved: true, changed: false };
    return;
  }
  if (gesture.type === 'drag') {
    clearInterval(dragAutoScroll.t);
    const t = gesture.target, R = gesture.region, pid = gesture.L.pid;
    if (t && t.pid !== pid) { swapPids(pid, t.pid); commit(); toast('Swapped', 1200); }
    else if (R) { gesture = null; moveToSection(pid, String(S.tree.secs.indexOf(R.sec))); renderOrderStrip(); scheduleRender(false); return; }
  } else if (gesture.changed) commit();
  gesture = null;
  scheduleRender(false);
}
ov.addEventListener('pointerup', endPointer);
ov.addEventListener('pointercancel', endPointer);
let wheelT = 0;
ov.addEventListener('wheel', e => {
  const D = dims();
  if (D.slides && !scrub.hidden && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey)) {
    e.preventDefault(); viewOff += (e.deltaX || e.deltaY) * kpx(); scheduleRender(true);
    clearTimeout(wheelT); wheelT = setTimeout(() => scheduleRender(false), 200); return;
  }
  if (!S.sel) return;
  e.preventDefault();
  const c = cropOf(S.sel); c.z = clamp(c.z * Math.exp(-e.deltaY * .0015), 1, 4);
  syncZoom(); scheduleRender(true);
  clearTimeout(wheelT); wheelT = setTimeout(() => { scheduleRender(false); commit(); }, 300);
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

function swapPids(a, b) {
  const ls = leavesOf(S.tree), la = ls.find(l => l.pid === a), lb = ls.find(l => l.pid === b);
  if (!la || !lb) return;
  la.pid = b; lb.pid = a;
  const ia = S.active.indexOf(a), ib = S.active.indexOf(b);
  if (ia > -1 && ib > -1) { S.active[ia] = b; S.active[ib] = a; }
  renderPhotoStrip(); if (S.sel) syncCellPane();
}
function setSwap(on) {
  swapMode = !!on && !!S.sel;
  $('#swapHint').hidden = !swapMode;
  $('#toolSwap').classList.toggle('on', swapMode);
  drawOverlay();
}

/* ================= selection & panes ================= */
function showPanes() {
  const cell = !!S.sel;
  $('#cellPane').hidden = !cell;
  $$('.pane[data-pane]').forEach(p => { p.hidden = cell || p.dataset.pane !== tab; });
}
function select(pid) {
  if (pid && !S.active.includes(pid)) pid = null;
  S.sel = pid;
  if (!pid) setSwap(false);
  if (pid) { const i = S.active.indexOf(pid); $('#cellTitle').textContent = `Photo ${i + 1} of ${S.active.length}`; syncZoom(); syncCellPane(); }
  showPanes();
  $$('#photoStrip .tile[data-id]').forEach(t => t.setAttribute('aria-current', String(t.dataset.id === pid)));
  drawOverlay();
}
function syncZoom() { if (!S.sel) return; const z = Math.round(cropOf(S.sel).z * 100); $('#zoom').value = z; $('#zoomOut').textContent = z + '%'; }
function secIndexOf(pid) { return hasSecs() ? S.tree.secs.findIndex(s => leavesOf(s.tree).some(l => l.pid === pid)) : -1; }
function syncCellPane() {
  const pid = S.sel; if (!pid) return;
  if (document.activeElement !== $('#capIn')) $('#capIn').value = S.caps[pid] || '';
  $('#secRow').hidden = !hasSecs();
  if (hasSecs()) {
    const sel = $('#secSel'), cur = secIndexOf(pid); sel.textContent = '';
    const im = imageMode();
    $('#secRow').querySelector('label').textContent = im ? 'Image' : 'Section';
    S.tree.secs.forEach((s, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = im ? [`Image ${i + 1}`, s.name].filter(Boolean).join(' · ') : [s.name, s.note].filter(Boolean).join(' · ') || `Section ${i + 1}`; if (i === cur) o.selected = true; sel.appendChild(o); });
    const o = document.createElement('option'); o.value = 'new'; o.textContent = im ? '+ New image' : '+ New section'; sel.appendChild(o);
  }
  $('#toolFeature').classList.toggle('on', S.hero === pid);
  $('#cellHint').textContent = hasSecs()
    ? `Drag to move, pinch to zoom. Hold and drag onto a photo to swap, or onto a space in another ${imageMode() || dims().slides ? 'image' : 'section'} to move it there.`
    : 'Drag to move, pinch to zoom, hold and drag to swap.';
}
function setTab(t) {
  tab = t;
  if (S.sel) S.sel = null;
  setSwap(false);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  showPanes();
  if (t === 'layout') renderLayoutStrip();
  if (t === 'style') { renderFavStrip(); renderStyleStrip(); }
  if (t === 'look') renderLookStrip();
  if (t === 'text') renderTextPane();
  $$('#photoStrip .tile[data-id]').forEach(el => el.setAttribute('aria-current', 'false'));
  drawOverlay();
}

/* ================= panels ================= */
function renderPhotoStrip() {
  const strip = $('#photoStrip'); strip.textContent = '';
  const n = S.active.length, samples = S.active.some(id => S.photos.get(id).sample);
  const add = document.createElement('label');
  add.className = 'tile add' + (samples || !n ? ' hot' : ''); add.htmlFor = 'fileAdd'; add.tabIndex = 0;
  add.innerHTML = ICON_PLUS + `<span>${samples || !n ? 'Add photos' : 'Add'}</span>`;
  strip.appendChild(add);
  S.active.forEach((id, i) => {
    const p = S.photos.get(id), t = document.createElement('div');
    t.className = 'tile'; t.dataset.id = id; t.setAttribute('aria-current', String(S.sel === id));
    const b = document.createElement('button'); b.className = 'tile-pick'; b.setAttribute('aria-label', `Select photo ${i + 1}`);
    const im = document.createElement('img'); im.src = p.thumbURL; im.alt = ''; b.appendChild(im);
    b.addEventListener('click', () => select(id));
    const x = document.createElement('button'); x.className = 'tile-x'; x.setAttribute('aria-label', `Remove photo ${i + 1}`); x.innerHTML = ICON_X;
    x.addEventListener('click', ev => { ev.stopPropagation(); removePhoto(id); });
    // What Gluestick read from the photo: when it was taken and where.
    const meta = document.createElement('span'); meta.className = 'tile-meta';
    const d = document.createElement('b'); d.textContent = p.time ? shortDay(p.time) : 'No date';
    if (!p.time) d.className = 'none';
    const pl = document.createElement('span'); pl.textContent = p.place || (p.lat != null && p.place === undefined ? 'Finding place…' : '');
    meta.append(d, pl);
    t.append(b, x, meta); strip.appendChild(t);
  });
  $('#photoCount').textContent = samples ? `${n} sample photos` : `${n} photo${n === 1 ? '' : 's'}`;
  $('#clearAll').hidden = n === 0;
  const real = S.active.map(id => S.photos.get(id)).filter(p => !p.sample);
  const dated = real.filter(p => p.timeSrc === 'exif' || p.timeSrc === 'picker').length, places = topPlaces(real.map(p => p.id));
  let note = '';
  if (real.length) {
    note = dated === real.length ? `Dates from all ${real.length} photos` : dated ? `Dates from ${dated} of ${real.length} photos` : 'No dates found';
    note += places.length ? ` · ${places.slice(0, 3).join(', ')}${places.length > 3 ? ` +${places.length - 3}` : ''}` : real.some(p => p.lat != null) ? '' : ' · no locations';
    if (!dated && !places.length) note += '. Screenshots and photos saved from chats often lose them.';
    else if (IOS_WEB && !places.length && !real.some(p => p.lat != null)) note += '. For places, tap Options at the top of the photo picker and turn on Location.';
  }
  $('#metaNote').textContent = note; $('#metaNote').hidden = !note;
  const dn = $('#dateNote');
  if (dn) dn.textContent = !real.length ? '' : dated === real.length ? `All ${real.length} photos have their date.` : dated ? `${dated} of ${real.length} photos have their date; the rest use the date above.` : 'These photos don’t include a date, so the stamp uses the date above.';
}
function renderLayoutStrip() {
  renderOrderStrip();
  const strip = $('#layoutStrip'); strip.textContent = '';
  strip.hidden = hasSecs();
  const D = dims(), asp = D.w / D.h, dpr = Math.min(2, window.devicePixelRatio || 1), cur = S.tree ? sigFull(S.tree) : '';
  let th = 92, tw = Math.round(th * asp); if (tw > 230) { tw = 230; th = Math.round(tw / asp); }
  S.cands.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'lay'; b.setAttribute('aria-label', `Layout ${i + 1}`); b.setAttribute('aria-pressed', String(sigFull(c.tree) === cur));
    const cv = canvasEl(tw * dpr, th * dpr); cv.style.width = tw + 'px'; cv.style.height = th + 'px';
    const x = cv.getContext('2d'); x.fillStyle = '#efe9e1'; x.fillRect(0, 0, cv.width, cv.height);
    const g = { leaves: [], divs: [] }; rectRec(c.tree, 2 * dpr, 2 * dpr, cv.width - 4 * dpr, cv.height - 4 * dpr, 2 * dpr, g);
    for (const L of g.leaves) { const p = S.photos.get(L.pid); x.save(); x.beginPath(); x.rect(L.x, L.y, L.w, L.h); x.clip(); const r = coverRect(p.thumb.width, p.thumb.height, L.x, L.y, L.w, L.h, { z: 1, fx: .5, fy: .5 }); x.drawImage(p.thumb, r.dx, r.dy, r.dw, r.dh); x.restore(); }
    b.appendChild(cv);
    b.addEventListener('click', () => { S.preset = null; applyCand(i); });
    strip.appendChild(b);
  });
  $('#layoutHint').textContent = hasSecs() && imageMode()
    ? 'Each image gets its own layout. Shuffle tries new ones; save a favourite with a layout to use the same one in every image.'
    : hasSecs()
    ? 'Each section gets its own layout. Shuffle tries new ones; tap a photo and choose Feature to make it bigger.'
    : S.set.style === 'film'
      ? 'Film strip fills frames in layout order. Shuffle or pick a layout to change the order.'
      : 'Drag the white handles to resize rows and columns. Tap a photo and choose Feature to make it the big one.';
}
/* ================= image (and section) order ================= */
// One thumbnail per image (or per section when they stack in one image). Hold and drag one to a new
// place, or tap it and use Earlier / Later. Reordering keeps each image's layout as it is.
let ordSel = 0, ordDrag = null;
function sectionThumbs(boxH) {
  const D = dims(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const H = Math.round(boxH * dpr), W = Math.max(1, Math.round(H * D.w / D.h));
  const c = canvasEl(W, H);
  paint(c.getContext('2d'), geometryFor(S.tree, W, H, S.set), { draft: true, preview: false });
  const n = S.tree.secs.length;
  const rects = D.slides
    ? Array.from({ length: Math.min(n, D.slides) }, (_, i) => ({ x: i * W / D.slides, y: 0, w: W / D.slides, h: H }))
    : frameFor(W, H, S.set, S.tree).regions.map(R => R.rect);
  return rects.map(r => {
    const t = canvasEl(r.w, r.h); t.getContext('2d').drawImage(c, r.x, r.y, r.w, r.h, 0, 0, t.width, t.height);
    let w = r.w / dpr, h = r.h / dpr; const k = Math.min(1, 132 / w); w *= k; h *= k;
    t.style.width = Math.round(w) + 'px'; t.style.height = Math.round(h) + 'px';
    return t;
  });
}
function renderOrderStrip() {
  const pane = $('#orderPane'), on = hasSecs() && S.tree.secs.length > 1;
  pane.hidden = !on; if (!on) return;
  const strip = $('#orderStrip'); strip.textContent = '';
  const secs = S.tree.secs, im = imageMode() || !!dims().slides;
  ordSel = clamp(ordSel, 0, secs.length - 1);
  $('#orderLabel').textContent = im ? (S.set.format === 'carousel' ? 'Slide order' : 'Image order') : 'Section order';
  const thumbs = sectionThumbs(im ? 84 : 54);
  secs.forEach((s, i) => {
    const b = document.createElement('div'); b.className = 'ord'; b.dataset.i = String(i); b.tabIndex = 0;
    b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === ordSel));
    b.setAttribute('aria-label', `${im ? 'Image' : 'Section'} ${i + 1}${s.name ? ', ' + s.name : ''}, ${secCount(s)} photos`);
    if (thumbs[i]) b.appendChild(thumbs[i]);
    const lab = document.createElement('span'); lab.textContent = s.name && !im ? s.name : String(i + 1); b.appendChild(lab);
    strip.appendChild(b);
  });
  $('#ordEarlier').disabled = ordSel <= 0; $('#ordLater').disabled = ordSel >= secs.length - 1;
  $('#ordNote').textContent = '';
}
function showSection(i) {
  const D = dims(); if (!D.slides) return;
  const Hv = view.height, Wv = Math.max(view.width, Math.round(Hv * D.w / D.h)), sw = Wv / D.slides;
  viewOff = clamp(i * sw - (view.width - sw) / 2, 0, Math.max(0, Wv - view.width));
  scheduleRender(false);
}
function moveSection(from, to) {
  const secs = S.tree.secs; if (from === to || to < 0 || to >= secs.length) return;
  const [m] = secs.splice(from, 1); secs.splice(to, 0, m);
  ordSel = to; commit(); scheduleRender(false); renderOrderStrip(); showSection(to);
  if (tab === 'text') renderTextPane();
  const im = imageMode() || !!dims().slides;
  toast(`Moved to ${im ? (S.set.format === 'carousel' ? 'slide' : 'image') : 'section'} ${to + 1}`, 1600);
}
(function wireOrderStrip() {
  const strip = $('#orderStrip');
  const itemAt = el => el && el.closest ? el.closest('.ord') : null;
  const dropIndex = x => {
    const items = $$('.ord', strip); let at = items.length;
    for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (x < r.left + r.width / 2) { at = i; break; } }
    return at;
  };
  const caretAt = at => {
    let c = $('.ord-caret', strip); if (!c) { c = document.createElement('i'); c.className = 'ord-caret'; strip.appendChild(c); }
    const items = $$('.ord', strip), sr = strip.getBoundingClientRect();
    const r = items[Math.min(at, items.length - 1)].getBoundingClientRect();
    const x = at < items.length ? r.left : r.right + 12;
    c.style.left = (x - sr.left + strip.scrollLeft) + 'px';
  };
  const lift = () => {
    const d = ordDrag; d.active = true; d.el.classList.add('lifted');
    const g = document.createElement('div'); g.className = 'ord-ghost';
    const src = $('canvas', d.el); if (src) { const c = canvasEl(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); c.style.width = src.style.width; c.style.height = src.style.height; g.appendChild(c); }
    document.body.appendChild(g); d.ghost = g; place(d.x, d.y);
    if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) { /* not supported */ }
    if (NATIVE && NATIVE.haptic) NATIVE.haptic();
  };
  const place = (x, y) => {
    const d = ordDrag; if (!d || !d.ghost) return;
    d.ghost.style.left = x + 'px'; d.ghost.style.top = y + 'px';
    d.to = dropIndex(x); caretAt(d.to);
    const sr = strip.getBoundingClientRect(); // scroll the strip when the finger nears an edge
    clearInterval(d.auto);
    const edge = x < sr.left + 28 ? -1 : x > sr.right - 28 ? 1 : 0;
    if (edge) d.auto = setInterval(() => { strip.scrollLeft += edge * 10; d.to = dropIndex(d.x); caretAt(d.to); }, 30);
  };
  const end = commitMove => {
    const d = ordDrag; ordDrag = null; if (!d) return;
    clearTimeout(d.timer); clearInterval(d.auto);
    if (d.ghost) d.ghost.remove();
    const c = $('.ord-caret', strip); if (c) c.remove();
    d.el.classList.remove('lifted');
    if (commitMove && d.active) { const to = d.to > d.from ? d.to - 1 : d.to; if (to !== d.from) moveSection(d.from, to); }
  };
  strip.addEventListener('pointerdown', e => {
    const el = itemAt(e.target); if (!el || !hasSecs()) return;
    const from = +el.dataset.i;
    ordDrag = { el, from, to: from, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, active: false, touch: e.pointerType === 'touch', id: e.pointerId };
    // Touch: hold briefly to pick up (a quick swipe still scrolls the strip). Mouse: drag straight away.
    if (ordDrag.touch) ordDrag.timer = setTimeout(() => { if (ordDrag && !ordDrag.active) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } lift(); } }, 260);
  });
  strip.addEventListener('pointermove', e => {
    const d = ordDrag; if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.active) {
      const moved = Math.hypot(d.x - d.sx, d.y - d.sy);
      if (d.touch) { if (moved > 8) { clearTimeout(d.timer); ordDrag = null; } return; }
      if (moved > 5) { try { d.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } lift(); } else return;
    }
    place(d.x, d.y);
  });
  strip.addEventListener('pointerup', e => {
    const d = ordDrag; if (!d || e.pointerId !== d.id) return;
    if (!d.active) { end(false); ordSel = d.from; renderOrderStrip(); showSection(d.from); return; }
    end(true);
  });
  strip.addEventListener('pointercancel', () => end(false));
  // Once an item is picked up, stop the page and the strip from scrolling under the finger.
  strip.addEventListener('touchmove', e => { if (ordDrag && ordDrag.active) e.preventDefault(); }, { passive: false });
  strip.addEventListener('contextmenu', e => e.preventDefault());
  strip.addEventListener('keydown', e => {
    const el = itemAt(e.target); if (!el) return;
    const i = +el.dataset.i;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.altKey || e.shiftKey) moveSection(i, i + (e.key === 'ArrowLeft' ? -1 : 1));
      else { ordSel = clamp(i + (e.key === 'ArrowLeft' ? -1 : 1), 0, S.tree.secs.length - 1); renderOrderStrip(); showSection(ordSel); }
      const f = $(`.ord[data-i="${ordSel}"]`, strip); if (f) f.focus();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ordSel = i; renderOrderStrip(); showSection(i); }
  });
  $('#ordEarlier').addEventListener('click', () => { if (hasSecs()) moveSection(ordSel, ordSel - 1); });
  $('#ordLater').addEventListener('click', () => { if (hasSecs()) moveSection(ordSel, ordSel + 1); });
})();
function renderStyleStrip() {
  const strip = $('#styleStrip'); strip.textContent = '';
  const dpr = Math.min(2, window.devicePixelRatio || 1), saved = S.set.style;
  STYLES.forEach(([k, name]) => {
    const b = document.createElement('button'); b.className = 'stile'; b.setAttribute('aria-pressed', String(saved === k)); b.dataset.v = k;
    const box = document.createElement('span'); box.className = 'thumb';
    box.appendChild(renderWith({ style: k }, 96, 150, dpr, false));
    const lab = document.createElement('span'); lab.textContent = name;
    b.append(box, lab);
    b.addEventListener('click', () => {
      if (S.set.style === k) return;
      S.set.style = k; activeFav = null; $$('.stile', strip).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === k)));
      syncControls(); scheduleRender(false); commit(); renderFavStrip();
    });
    strip.appendChild(b);
  });
}
function renderLookStrip() {
  const strip = $('#lookStrip'); strip.textContent = '';
  const p = S.photos.get((leavesOf(S.tree)[0] || {}).pid || S.active[0]);
  LOOK_ORDER.forEach(k => {
    const L = LOOKS[k], b = document.createElement('button'); b.className = 'look'; b.setAttribute('aria-pressed', String(S.set.look === k));
    const cv = canvasEl(120, 120), x = cv.getContext('2d', { willReadFrequently: true });
    if (p) {
      const r = coverRect(p.thumb.width, p.thumb.height, 0, 0, 120, 120, { z: 1, fx: .5, fy: .5 }); x.drawImage(p.thumb, r.dx, r.dy, r.dw, r.dh);
      if (k !== 'none') { const id = x.getImageData(0, 0, 120, 120); applyPipeline(id.data, k, 1, false); x.putImageData(id, 0, 0); }
    } else { x.fillStyle = '#3a363c'; x.fillRect(0, 0, 120, 120); }
    const sp = document.createElement('span'); sp.textContent = L.name;
    b.append(cv, sp);
    b.addEventListener('click', () => { S.set.look = k; activeFav = null; $$('.look', strip).forEach((el, i) => el.setAttribute('aria-pressed', String(LOOK_ORDER[i] === k))); scheduleRender(false); commit(); });
    strip.appendChild(b);
  });
}
function buildFormatStrip() {
  const strip = $('#fmtStrip');
  Object.entries(FORMATS).forEach(([k, F]) => {
    const b = document.createElement('button'); b.className = 'fmt'; b.dataset.v = k;
    if (k === 'carousel') b.innerHTML = '<span class="shape"><i style="width:15px;height:19px"></i><i style="width:15px;height:19px"></i><i style="width:15px;height:19px"></i></span><b>Carousel</b><small>Seamless<br>2–10 slides</small>';
    else { const s = 38 / Math.max(F.w, F.h); b.innerHTML = `<span class="shape"><i style="width:${Math.round(F.w * s)}px;height:${Math.round(F.h * s)}px"></i></span><b>${F.name}</b><small>${F.ratio}<br>${F.w} × ${F.h}</small>`; }
    b.addEventListener('click', () => {
      if (S.set.format === k) return;
      S.set.format = k; viewOff = 0; relayout(); commit();
    });
    strip.appendChild(b);
  });
}
function relayout() {
  if (hasSecs()) regenSections('all', false); else freshLayout();
  syncControls(); fitStage();
  if (tab === 'layout') renderLayoutStrip();
  if (tab === 'style') { renderStyleStrip(); renderFavStrip(); }
}

/* colours */
function buildSwatchRow(box, list, getV, setV, idSuffix, cls) {
  list.forEach(([hex, name]) => {
    const b = document.createElement('button'); b.className = 'sw' + (hex === 'auto' ? ' sw-auto' : ''); b.dataset.v = hex; if (hex !== 'auto') b.style.background = hex; b.setAttribute('aria-label', name);
    b.addEventListener('click', () => { setV(hex); activeFav = null; syncColour(); scheduleRender(false); commit(); });
    box.appendChild(b);
  });
  const lab = document.createElement('label'); lab.className = 'sw sw-custom'; lab.setAttribute('aria-label', 'Custom colour');
  const inp = document.createElement('input'); inp.type = 'color'; inp.id = 'custom-' + idSuffix;
  inp.addEventListener('input', () => { setV(inp.value); syncColour(); scheduleRender(true); });
  inp.addEventListener('change', () => { setV(inp.value); activeFav = null; syncColour(); scheduleRender(false); commit(); });
  lab.appendChild(inp); box.appendChild(lab);
  box._get = getV; box._set = setV;
}
function syncSwatchRow(box) {
  const v = String(box._get()).toLowerCase(); let matched = false;
  $$('button.sw', box).forEach(b => { const on = b.dataset.v.toLowerCase() === v; matched = matched || on; b.setAttribute('aria-pressed', String(on)); });
  const lab = $('.sw-custom', box); lab.setAttribute('aria-pressed', String(!matched && v !== '')); lab.style.background = (!matched && /^#/.test(v)) ? v : '';
  const inp = $('input', box); if (/^#[0-9a-f]{6}$/i.test(v)) inp.value = v;
}
/* colours pulled from the user's own photos, offered first in the background and border rows */
function photoPalette() {
  const hist = new Map();
  for (const id of S.active) {
    const t = S.photos.get(id).thumb, d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    for (let i = 0; i < d.length; i += 16) { const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); }
  }
  const arr = Array.from(hist.entries()).map(([k, c]) => { const r = ((k >> 8) & 15) * 16 + 8, g = ((k >> 4) & 15) * 16 + 8, b = (k & 15) * 16 + 8, s = (Math.max(r, g, b) - Math.min(r, g, b)) / 255; return { r, g, b, w: c * (.55 + s) }; }).sort((a, b) => b.w - a.w);
  const picks = [];
  for (const o of arr) { if (picks.every(p => Math.hypot(p.r - o.r, p.g - o.g, p.b - o.b) > 70)) picks.push(o); if (picks.length >= 4) break; }
  const soft = picks.map(p => toHex(p.r + (244 - p.r) * .6, p.g + (240 - p.g) * .6, p.b + (232 - p.b) * .6));
  const deep = picks.slice(0, 3).map(p => toHex(p.r * .7, p.g * .7, p.b * .7));
  return soft.concat(deep);
}
let palCache = { key: null, pal: [] };
function buildPalette() {
  const pk = S.active.join(',');
  if (palCache.key !== pk) palCache = { key: pk, pal: S.active.length ? photoPalette() : [] };
  const pal = palCache.pal;
  [$('#bgSolid'), $('#borderSw')].forEach(box => {
    $$('.pal, .swsep', box).forEach(el => el.remove());
    if (!pal.length) return;
    const first = box.firstChild, sep = document.createElement('span'); sep.className = 'swsep'; sep.setAttribute('aria-hidden', 'true');
    box.insertBefore(sep, first);
    pal.forEach(hex => {
      const b = document.createElement('button'); b.className = 'sw pal'; b.dataset.v = hex; b.style.background = hex; b.setAttribute('aria-label', 'Colour from your photos ' + hex);
      b.addEventListener('click', () => { box._set(hex); activeFav = null; syncColour(); scheduleRender(false); commit(); });
      box.insertBefore(b, sep);
    });
  });
  syncColour();
}
function buildColourPane() {
  buildSwatchRow($('#bgSolid'), BG_SWATCHES, () => S.set.bgMode === 'solid' ? S.set.bg : '', v => { S.set.bg = v; S.set.bgMode = 'solid'; }, 'bg');
  buildSwatchRow($('#borderSw'), BORDER_SWATCHES, () => borderColor(), v => { S.set.border = Object.assign({}, S.set.border, { [S.set.style]: v }); }, 'border');
  buildSwatchRow($('#textSw'), TEXT_SWATCHES, () => S.set.textColor || 'auto', v => { S.set.textColor = v; }, 'text');
  const gbox = $('#bgGrad');
  GRADS.forEach((G, i) => {
    const b = document.createElement('button'); b.className = 'grad'; b.setAttribute('aria-label', G.name + ' gradient');
    b.style.background = `linear-gradient(135deg, ${G.stops.join(', ')})`;
    b.addEventListener('click', () => { S.set.bgMode = 'gradient'; S.set.grad = i; activeFav = null; syncColour(); scheduleRender(false); commit(); });
    gbox.appendChild(b);
  });
}
function syncColour() {
  const st = S.set;
  $('#bgSolid').hidden = st.bgMode !== 'solid'; $('#bgGrad').hidden = st.bgMode !== 'gradient'; $('#bgBlurHint').hidden = st.bgMode !== 'blur';
  syncSwatchRow($('#bgSolid')); syncSwatchRow($('#borderSw')); syncSwatchRow($('#textSw'));
  $$('#bgGrad .grad').forEach((b, i) => b.setAttribute('aria-pressed', String(st.bgMode === 'gradient' && st.grad === i)));
  $$('.seg[data-seg="bgMode"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.bgMode)));
  const [lab, hint] = BORDER_TEXT[st.style] || BORDER_TEXT.grid;
  $('#borderLabel').textContent = lab; $('#borderHint').textContent = hint;
  $('#borderWField').hidden = !(st.style === 'grid' || st.style === 'shapes');
}

/* text tab */
function buildFontStrip() {
  const strip = $('#fontStrip');
  Object.entries(FONTS).forEach(([k, F]) => {
    const b = document.createElement('button'); b.className = 'font'; b.dataset.v = k;
    const aa = document.createElement('span'); aa.className = 'aa'; aa.textContent = F.t.up ? 'AA' : 'Aa';
    aa.style.fontFamily = F.t.fam; aa.style.fontStyle = F.t.st; aa.style.fontWeight = F.t.w; if (F.t.tr) aa.style.letterSpacing = F.t.tr + 'em';
    const nm = document.createElement('span'); nm.textContent = F.name;
    b.append(aa, nm);
    b.addEventListener('click', () => { S.set.titleFont = k; activeFav = null; syncControls(); scheduleRender(false); commit(); });
    strip.appendChild(b);
  });
}
function renderSecList() {
  const box = $('#secList'); box.textContent = '';
  const im = imageMode();
  $('#secToggle').closest('label').hidden = im; $('#secByDay').closest('.row').hidden = im;
  $('#secImagesNote').hidden = !im;
  $('#secHint').hidden = im;
  $('#secToggle').checked = hasSecs();
  $('#secHeads').closest('label').hidden = !hasSecs();
  if (im) $('#secImagesNote').textContent = hasSecs()
    ? `Your photos are split into ${S.tree.secs.length} images (Size › Split into several images). Give an image a heading here, or reorder them.`
    : 'All your photos fit in one image right now. Add more, or lower the number per image in Size.';
  if (!hasSecs()) return;
  const secs = S.tree.secs;
  secs.forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'secrow';
    const n = document.createElement('input'); n.className = 'txt sm'; n.value = s.name || ''; n.placeholder = im ? `Image ${i + 1} heading` : `Day ${i + 1}`; n.maxLength = 30; n.setAttribute('aria-label', `${im ? 'Image' : 'Section'} ${i + 1} name`);
    const t = document.createElement('input'); t.className = 'txt sm'; t.value = s.note || ''; t.placeholder = 'Place or date'; t.maxLength = 40; t.setAttribute('aria-label', `Section ${i + 1} place or date`);
    n.addEventListener('input', () => { s.name = n.value; scheduleRender(false); });
    t.addEventListener('input', () => { s.note = t.value; scheduleRender(false); });
    [n, t].forEach(el => el.addEventListener('change', () => commit()));
    const up = document.createElement('button'); up.className = 'mini'; up.textContent = '↑'; up.disabled = i === 0; up.setAttribute('aria-label', 'Move section up');
    const dn = document.createElement('button'); dn.className = 'mini'; dn.textContent = '↓'; dn.disabled = i === secs.length - 1; dn.setAttribute('aria-label', 'Move section down');
    up.addEventListener('click', () => { secs.splice(i - 1, 0, secs.splice(i, 1)[0]); commit(); renderSecList(); scheduleRender(false); });
    dn.addEventListener('click', () => { secs.splice(i + 1, 0, secs.splice(i, 1)[0]); commit(); renderSecList(); scheduleRender(false); });
    const cnt = document.createElement('small'); const c = secCount(s); cnt.textContent = `${c} photo${c === 1 ? '' : 's'}`;
    row.append(n, t, up, dn, cnt); box.appendChild(row);
  });
}
function renderCapList() {
  const box = $('#capList'); box.textContent = '';
  const ids = leavesOf(S.tree).map(l => l.pid);
  if (!ids.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Add photos to caption them.'; box.appendChild(p); return; }
  ids.forEach((id, i) => {
    const p = S.photos.get(id), row = document.createElement('div'); row.className = 'caprow';
    const im = document.createElement('img'); im.src = p.thumbURL; im.alt = '';
    const inp = document.createElement('input'); inp.className = 'txt sm'; inp.value = S.caps[id] || ''; inp.placeholder = p.place || 'Caption, e.g. Sintra'; inp.maxLength = 40; inp.setAttribute('aria-label', `Caption for photo ${i + 1}`);
    inp.addEventListener('input', () => { S.caps[id] = inp.value; scheduleRender(false); });
    inp.addEventListener('change', () => commit());
    row.append(im, inp); box.appendChild(row);
  });
}
async function fillCaptionsFromPlaces() {
  await resolvePlaces();
  const ids = leavesOf(S.tree).map(l => l.pid);
  let n = 0;
  ids.forEach(id => { const p = S.photos.get(id); if (p && p.place && !(S.caps[id] || '').trim()) { S.caps[id] = p.place; n++; } });
  if (!n) { toast(ids.some(id => S.photos.get(id).place) ? 'Every photo with a place already has a caption.' : 'These photos don’t include a location. Type captions below instead.', 3400); return; }
  commit(); renderCapList(); scheduleRender(false);
  toast(`Added ${n} place name${n > 1 ? 's' : ''}`);
}
// Title from the places, subtitle from the dates: "Portugal" / "12–14 August 2026".
async function fillTitleFromPhotos() {
  await resolvePlaces();
  const ps = S.active.map(id => S.photos.get(id)), places = topPlaces(S.active);
  const ccs = [...new Set(ps.map(p => p.cc).filter(Boolean))];
  let title = '';
  if (places.length === 1) title = places[0];
  else if (places.length === 2) title = `${places[0]} & ${places[1]}`;
  else if (places.length > 2) title = ccs.length === 1 ? countryName(ccs[0]) : ccs.length === 2 ? `${countryName(ccs[0])} & ${countryName(ccs[1])}` : places[0];
  const sub = dateRange(ps.map(p => p.time), true);
  if (!title && !sub) { toast('These photos don’t include dates or places.'); return; }
  if (title) S.set.title = title;
  if (sub) S.set.subtitle = sub;
  commit(); renderTextPane(); scheduleRender(false);
  toast(title && sub ? 'Title and dates filled in from your photos' : title ? 'Title filled in from your photos' : 'Dates filled in from your photos');
}
function renderTextPane() {
  const st = S.set;
  if (document.activeElement !== $('#titleIn')) $('#titleIn').value = st.title || '';
  if (document.activeElement !== $('#subIn')) $('#subIn').value = st.subtitle || '';
  $$('#textSub button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === textSub)));
  $$('[data-tsub]').forEach(p => { p.hidden = p.dataset.tsub !== textSub; });
  if (textSub === 'sections') renderSecList();
  if (textSub === 'captions') renderCapList();
}

let saveMult = 1;
function syncControls() {
  const st = S.set;
  $$('input[type=range][data-key]').forEach(inp => { const div = +(inp.dataset.div || 1); inp.value = Math.round(st[inp.dataset.key] * div); inp.nextElementSibling.textContent = inp.value; });
  $$('.seg[data-seg]').forEach(seg => { const key = seg.dataset.seg, v = key === 'res' ? String(saveMult) : String(st[key]); $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); });
  $$('.style-ctl').forEach(el => { el.hidden = !el.dataset.style.split(' ').includes(st.style); });
  $$('.stile').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.style)));
  $$('.fmt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.format)));
  $$('.font').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.titleFont)));
  $$('input[type=checkbox][data-flag]').forEach(c => { c.checked = !!st[c.dataset.flag]; });
  $('#dateIn').value = st.date || todayISO();
  $$('#lookSub button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === lookSub)));
  $$('[data-sub]').forEach(p => { p.hidden = p.dataset.sub !== lookSub; });
  const car = st.format === 'carousel', D = dims();
  $('#carouselCtl').hidden = !car; $('#slCount').textContent = D.slides || st.slides;
  const im = imageMode(), nImg = im && hasSecs() ? S.tree.secs.length : 1;
  $('#splitOn').checked = im; $('#splitOpts').hidden = !im;
  $('#piCount').textContent = String(st.perImage || lastPerImage);
  $$('#splitBy button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.splitBy)));
  $('#piMinus').disabled = !im || st.perImage <= 2; $('#piPlus').disabled = !im || st.perImage >= 12;
  $('#splitNote').textContent = !im ? `Keeps all ${S.active.length} photos in one image. Turn on to spread them over several, all in the same style.`
    : nImg > 1 ? `${S.active.length} photos → ${nImg} images. Each is its own ${car ? 'slide' : FORMATS[st.format].name.toLowerCase()} in the same style; Save gives you all ${nImg}.`
    : `All ${S.active.length} photos fit in one image at ${st.perImage} each.`;
  $('#slMinus').disabled = $('#slPlus').disabled = hasSecs() || im;
  $('#gridGuide').checked = gridGuide; $('#guideRow').hidden = st.format === 'story';
  $('#sizeHint').textContent = car
    ? (hasSecs() ? 'Each section is its own slide, so the slide count follows your sections. Save gives you one image per slide.' : 'Photos flow across the slides. Save gives you one image per slide: post them in order as a single carousel.')
    : st.format === 'story' ? 'Stories and Reels are 9:16. They don’t appear in your profile grid.'
      : 'Sized for Instagram: feed posts 4:5, and the profile grid shows posts cropped to 3:4.';
  syncColour(); updateUndo(); updateSamplesUI();
  if (tab === 'text') renderTextPane();
}
function updateSamplesUI() {
  const has = S.active.some(id => S.photos.get(id).sample);
  $('#samplePill').hidden = !has;
  $('#openSave').classList.toggle('accent', !has); // with samples on screen, adding photos is the main action
  $('#empty').hidden = S.active.length > 0;
  frame.hidden = S.active.length === 0;
}

/* ================= host ================= */
// Gluestick runs in three places, and the engine never talks to any of them directly:
//  native  the iPhone (later Android) app. native.js loads first and sets window.GluestickNative:
//          photo picker that keeps capture dates, save to Photos, share sheet, on-phone storage.
//  claude  the Claude artifact. Capabilities come from window.claude.use().
//  web     any other browser: press and hold to save, favourites in localStorage only.
const NATIVE = window.GluestickNative || null;
const HOST = NATIVE ? 'native' : (window.claude && typeof window.claude.use === 'function') ? 'claude' : 'web';
document.documentElement.dataset.host = HOST;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hostErr = (code, done = 0) => Object.assign(new Error(code), { code, done });
async function hostCap(name) {
  if (HOST !== 'claude') return null;
  try { return await window.claude.use(name); } catch (e) { return null; }
}
// Durable favourites storage beyond this browser: { label, get(), set(body) } or null.
async function hostPrefs() {
  if (NATIVE) return { label: 'Saved on this phone', get: () => NATIVE.prefs.get('favourites'), set: body => NATIVE.prefs.set('favourites', body) };
  const [db, user] = await Promise.all([hostCap('db'), hostCap('user')]);
  if (!db || !user) return null;
  const id = await user.id(); if (!id) return null;
  const doc = db.doc('data/users/' + id + '/prefs');
  return {
    label: 'Synced to your account',
    get: async () => { const snap = await doc.get(); return snap.exists ? clone(snap.data() || {}) : null; },
    set: body => doc.set(body),
  };
}
const IOS_WEB = HOST === 'web' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
// Plain browser: on a phone, the system share sheet (Save Image, Instagram, Messages); on a computer, downloads.
function webSaver() {
  const toFiles = (blobs, names) => blobs.map((b, i) => new File([b], names[i], { type: 'image/jpeg' }));
  let canShare = false;
  try { canShare = !!(navigator.share && navigator.canShare && navigator.canShare({ files: toFiles([new Blob(['x'], { type: 'image/jpeg' })], ['x.jpg']) })); } catch (e) { /* no file sharing */ }
  const phone = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (canShare && phone) return {
    kind: 'sheet',
    // navigator.share must run straight from the tap, so nothing is awaited before it.
    save: (blobs, names) => navigator.share({ files: toFiles(blobs, names) }).catch(e => { throw hostErr(e && e.name === 'AbortError' ? 'cancelled' : 'failed'); }),
  };
  return {
    kind: 'download',
    async save(blobs, names, onStep) {
      for (let i = 0; i < blobs.length; i++) {
        if (onStep) onStep(i);
        const a = document.createElement('a'), url = URL.createObjectURL(blobs[i]);
        a.href = url; a.download = names[i]; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (i < blobs.length - 1) await sleep(400);
      }
    },
  };
}
// Where finished images go: { save(blobs, names, onStep), share? } or null (press and hold only).
// save() rejects with code cancelled | busy | denied | failed, and `done` = images already saved.
async function hostSaver() {
  if (NATIVE) return {
    kind: 'native',
    save: (blobs, names, onStep) => NATIVE.saveToPhotos(blobs, names, onStep),
    share: (blobs, names) => NATIVE.share(blobs, names),
  };
  if (HOST === 'web') return webSaver();
  const dl = await hostCap('downloads');
  if (!dl) return null;
  return {
    kind: 'claude',
    async save(blobs, names, onStep) {
      for (let i = 0; i < blobs.length; i++) {
        if (onStep) onStep(i);
        for (let tries = 0; ; tries++) {
          try { await dl.save({ filename: names[i], data: blobs[i] }); break; }
          catch (err) {
            const code = err && err.code;
            if (code === 'rate_limited' && tries < 3) { await sleep(1200); continue; }
            throw hostErr(code === 'declined' ? 'cancelled' : code === 'rate_limited' ? 'busy' : 'failed', i);
          }
        }
      }
    },
  };
}
// Where drafts live: { label, getJSON, setJSON, getBlob, setBlob, del, delDir } or null.
// Keys: 'index', '<draft>/state', '<draft>/<photo>'.
async function hostDrafts() {
  if (NATIVE && NATIVE.drafts) return Object.assign({ label: 'Saved on this phone' }, NATIVE.drafts);
  const st = await idbStore();
  return st && Object.assign({ label: 'Saved in this browser' }, st);
}
function idbStore() {
  return new Promise(resolve => {
    let req;
    try { req = indexedDB.open('gluestick', 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const run = (mode, fn) => new Promise((ok, bad) => {
        let t, r;
        try { t = db.transaction('kv', mode); r = fn(t.objectStore('kv')); } catch (e) { bad(e); return; }
        t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
        t.onerror = t.onabort = () => bad(t.error);
      });
      const get = k => run('readonly', s => s.get(k)).then(v => v == null ? null : v);
      resolve({
        getJSON: get, getBlob: get,
        setJSON: (k, v) => run('readwrite', s => s.put(v, k)),
        setBlob: (k, b) => run('readwrite', s => s.put(b, k)),
        del: k => run('readwrite', s => s.delete(k)),
        delDir: id => run('readwrite', s => s.delete(IDBKeyRange.bound(id + '/', id + '/\uffff'))),
      });
    };
  });
}
// In the app, photos come through the native picker, which keeps each photo's capture date
// (the browser file picker on iPhone can drop it, and day sections depend on it).
let nativePicker = !!(NATIVE && NATIVE.pickPhotos);
async function pickNative(multiple) {
  const room = MAX_PHOTOS - S.active.filter(id => !S.photos.get(id).sample).length;
  if (multiple && room <= 0) { toast(`A collage holds up to ${MAX_PHOTOS} photos. Remove one to add more.`); return; }
  let files;
  try { files = await NATIVE.pickPhotos({ multiple, limit: multiple ? room : 1 }); }
  catch (err) {
    if (err && err.code === 'cancelled') return;
    nativePicker = false;
    toast('The photo picker didn’t open. Tap again to use the standard picker.');
    return;
  }
  if (!files || !files.length) return;
  if (multiple) addFiles(files); else replaceSelected(files[0]);
}
if (nativePicker) {
  document.addEventListener('click', e => {
    const lab = nativePicker && e.target.closest && e.target.closest('label[for="fileAdd"], label[for="fileReplace"]');
    if (!lab) return;
    e.preventDefault();
    pickNative(lab.htmlFor === 'fileAdd');
  }, true);
}

/* ================= favourites (saved recipes) ================= */
// The old key is still read so favourites made before the rename carry over.
const store = { favs: [], def: null, t: 0 }, LS_KEY = 'gluestick.favourites.v1', LS_OLD = 'tessera.favourites.v1';
let activeFav = null, defaultApplied = false, remote = null, dbChain = Promise.resolve();
function lsLoad() {
  try {
    for (const k of [LS_KEY, LS_OLD]) { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && Array.isArray(v.favs)) return v; }
  } catch (e) { /* storage unavailable */ }
  return null;
}
function lsSave() { try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch (e) { /* storage unavailable */ } }
function persist() {
  store.t = Date.now(); lsSave();
  if (!remote) return;
  const body = clone(store);
  dbChain = dbChain.then(() => remote.set(body)).catch(() => { /* kept locally; next change retries */ });
}
async function initStore() {
  const ls = lsLoad();
  if (ls) { store.favs = ls.favs; store.def = ls.def || null; store.t = ls.t || 0; onStoreLoaded(); }
  try {
    const r = await hostPrefs(); if (!r) return;
    remote = r;
    $('#favNote').textContent = r.label;
    const d = await Promise.race([r.get(), sleep(10000).then(() => { throw new Error('timeout'); })]);
    if (d) {
      if (Array.isArray(d.favs) && (d.t || 0) >= (store.t || 0)) { store.favs = d.favs; store.def = d.def || null; store.t = d.t || 0; lsSave(); onStoreLoaded(); }
      else if ((store.t || 0) > (d.t || 0)) persist();
    } else if (store.favs.length) persist();
  } catch (e) { /* favourites stay in this browser */ }
}
const allFavs = () => store.favs.concat(STARTERS);
const favById = id => allFavs().find(f => f.id === id);
function favSettings() { const o = {}; for (const [k, v] of Object.entries(S.set)) if (!FAV_SKIP.has(k)) o[k] = clone(v); return o; }
function favName() {
  const st = S.set, s = (STYLES.find(x => x[0] === st.style) || ['', 'Style'])[1], l = st.look !== 'none' ? LOOKS[st.look].name : '';
  const base = l ? `${s} · ${l}` : s; let name = base, i = 2;
  while (store.favs.some(f => f.name === name)) name = `${base} ${i++}`;
  return name;
}
function applySettings(set) {
  const before = [S.set.format, S.set.slides, S.set.slideRatio, S.set.sizing].join('|'), split = [S.set.perImage, S.set.splitBy].join('|');
  const keep = {}; FAV_SKIP.forEach(k => { keep[k] = S.set[k]; });
  const next = Object.assign({}, S.set, clone(set), keep);
  if (set.border) next.border = Object.assign({}, S.set.border, set.border);
  S.set = next;
  if ([S.set.perImage, S.set.splitBy].join('|') !== split) {
    viewOff = 0;
    if (imageMode()) buildImageSets(); else if (hasSecs() && String(S.tree.secs[0].key || '').startsWith('img:')) { S.tree = null; freshLayout(); }
    relayout();
  } else if ([S.set.format, S.set.slides, S.set.slideRatio, S.set.sizing].join('|') !== before) { viewOff = 0; relayout(); }
  else { syncControls(); fitStage(); }
  if (tab === 'look') renderLookStrip();
}
const favUsesLayout = f => !!(f && f.layout && f.useLayout !== false);
// Style always; the layout too when the favourite has one and it's switched on.
function applyFavCore(f) {
  applySettings(f.set); activeFav = f.id;
  if (favUsesLayout(f)) applyLayoutPreset(f.layout);
}
function applyFav(f) { applyFavCore(f); commit(); refreshAll(); }
function saveFav() {
  if (store.favs.length >= 24) { toast('You can keep up to 24 favourites. Delete one to add more.'); return; }
  const layout = layoutPreset();
  const f = { id: 'f' + Date.now().toString(36), name: favName(), set: favSettings(), layout, useLayout: !!layout };
  store.favs.unshift(f); activeFav = f.id; S.preset = layout ? clone(layout) : null; persist(); renderFavStrip(); commit();
  toast(layout ? `Saved “${f.name}” with its layout` : `Saved “${f.name}”`);
}
function onStoreLoaded() {
  if (tab === 'style') renderFavStrip();
  if (store.def && !defaultApplied && HIST.i <= 0 && !DR.id) {
    const f = favById(store.def);
    if (f) { defaultApplied = true; applyFavCore(f); HIST.stack = []; HIST.i = -1; commit(); refreshAll(); toast(`Started with your default: ${f.name}`); if (tab === 'style') renderFavStrip(); }
  }
}
function renderFavStrip() {
  const strip = $('#favStrip'); if (!strip) return; strip.textContent = '';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const add = document.createElement('button'); add.className = 'favadd'; add.innerHTML = ICON_PLUS + '<span>Save<br>current</span>';
  add.addEventListener('click', saveFav); strip.appendChild(add);
  const tile = (f, starter) => {
    const b = document.createElement('button'); b.className = 'fav'; b.setAttribute('aria-pressed', String(activeFav === f.id)); b.setAttribute('aria-label', (starter ? 'Starter: ' : 'Favourite: ') + f.name);
    const box = document.createElement('span'); box.className = 'thumb';
    const shape = favUsesLayout(f) && f.layout.shape;
    box.appendChild(renderWith(f.set, 84, 120, dpr, true, shape && S.active.length ? () => { const D = dims(); return fitShape(shape, S.active, D.w / D.h); } : null));
    if (store.def === f.id) { const s = document.createElement('span'); s.className = 'star'; s.textContent = '★'; s.setAttribute('aria-label', 'Default'); box.appendChild(s); }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = f.name;
    b.append(box, nm); b.addEventListener('click', () => applyFav(f));
    strip.appendChild(b);
  };
  store.favs.forEach(f => tile(f, false));
  const sep = document.createElement('span'); sep.className = 'stripsep'; sep.textContent = 'Starters'; strip.appendChild(sep);
  STARTERS.forEach(f => tile(f, true));
  const f = activeFav && favById(activeFav), mine = f && !f.id.startsWith('starter:');
  $('#favActions').hidden = !f;
  if (f) {
    $('#favName').hidden = !mine; if (mine && document.activeElement !== $('#favName')) $('#favName').value = f.name;
    $('#favDelete').hidden = !mine;
    $('#favDefault').textContent = store.def === f.id ? '★ Default' : '☆ Make default';
    $('#favDefault').setAttribute('aria-pressed', String(store.def === f.id));
  }
  const lay = f && mine && f.layout;
  $('#favLayoutRow').hidden = !lay;
  if (lay) {
    $('#favLayout').checked = favUsesLayout(f);
    $('#favLayoutNote').textContent = f.layout.secs
      ? `Splits photos into sections by ${f.layout.secs === 'place' ? 'place' : 'day'}.`
      : `${shapeCount(f.layout.shape)}-photo layout. It adapts when you have more or fewer photos.`;
  }
  if (!$('#favNote').textContent) $('#favNote').textContent = remote ? remote.label : 'Saved in this browser';
}

/* ================= drafts ================= */
// A collage with your own photos saves itself as you go. Each draft stores its photos once
// (the working-size JPEGs) plus a small JSON of the arrangement, and the index keeps a thumbnail.
const DR = { store: null, id: null, saved: new Set(), last: '', timer: 0, chain: Promise.resolve(), index: { last: null, items: [] }, gone: new Set(), loading: false, warned: false, confirm: null };
const ownPhotos = () => S.active.filter(id => { const p = S.photos.get(id); return p && !p.sample; });
function draftName() {
  const t = String(S.set.title || '').trim(); if (t) return t.slice(0, 40);
  const ids = ownPhotos(), times = ids.map(id => S.photos.get(id).time).filter(Boolean), place = topPlaces(ids)[0];
  return [times.length ? dateRange(times, false) : '', place].filter(Boolean).join(' · ') || 'Untitled collage';
}
function draftThumb() {
  try { return renderWith({}, 220, 160, 1, true).toDataURL('image/jpeg', .72); } catch (e) { return ''; }
}
function photoBlob(p) {
  if (p.blob) return Promise.resolve(p.blob);
  return new Promise((res, rej) => {
    let c = p.src;
    if (!(c instanceof HTMLCanvasElement)) { c = canvasEl(p.w, p.h); c.getContext('2d').drawImage(p.src, 0, 0, p.w, p.h); }
    c.toBlob(b => { if (!b) { rej(new Error('encode')); return; } p.blob = b; res(b); }, 'image/jpeg', .92);
  });
}
const draftKey = () => snap();
// Take everything a save needs right now, so later edits (or opening another collage) can't mix in.
function captureDraft() {
  if (!DR.store || DR.loading) return null;
  const own = ownPhotos(); if (!own.length) return null;
  const key = draftKey(); if (key === DR.last) return null;
  if (!DR.id) { DR.id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); DR.saved = new Set(); }
  DR.last = key;
  return {
    id: DR.id, saved: DR.saved, state: key, active: S.active.slice(),
    photos: S.active.map(pid => S.photos.get(pid)).filter(Boolean),
    name: draftName(), n: own.length, thumb: draftThumb()
  };
}
async function writeDraft(c) {
  const st = DR.store; if (DR.gone.has(c.id)) return;
  for (const p of c.photos) {
    if (p.sample || c.saved.has(p.id)) continue;
    await st.setBlob(`${c.id}/${p.id}`, await photoBlob(p)); c.saved.add(p.id);
  }
  const photos = c.photos.map(p => ({ id: p.id, name: p.name, w: p.w, h: p.h, time: p.time ? +p.time : null, timeSrc: p.timeSrc || null, lat: p.lat == null ? null : p.lat, lon: p.lon == null ? null : p.lon, place: p.place || null, cc: p.cc || null, sample: p.sample ? p.sampleIdx : null }));
  await st.setJSON(`${c.id}/state`, { v: 1, state: JSON.parse(c.state), photos, seq: { photo: photoSeq, node: nodeSeq } });
  for (const pid of Array.from(c.saved)) if (!c.active.includes(pid)) { await st.del(`${c.id}/${pid}`); c.saved.delete(pid); }
  if (DR.gone.has(c.id)) { await st.delDir(c.id); return; }
  const item = { id: c.id, name: c.name, t: Date.now(), n: c.n, thumb: c.thumb };
  DR.index.items = [item].concat(DR.index.items.filter(x => x.id !== c.id));
  if (DR.id === c.id) DR.index.last = c.id;
  await st.setJSON('index', DR.index);
  if (!$('#drafts').hidden) renderDrafts();
}
function flushDraft() {
  clearTimeout(DR.timer);
  const c = captureDraft();
  if (c) DR.chain = DR.chain.then(() => writeDraft(c)).catch(err => {
    if (DR.id === c.id) DR.last = ''; // try again on the next change
    if (!DR.warned) { DR.warned = true; toast('This collage couldn’t be saved as a draft. Free up some space and keep going.', 4200); }
    console.warn('draft save failed', err);
  });
  return DR.chain;
}
function queueDraft() {
  if (!DR.store || DR.loading) return;
  clearTimeout(DR.timer); DR.timer = setTimeout(flushDraft, 1200);
}
function saveIndex() { if (DR.store) DR.chain = DR.chain.then(() => DR.store.setJSON('index', DR.index)).catch(() => {}); }
function dropPhotos(map) { map.forEach(p => { if (p.src && p.src._url) URL.revokeObjectURL(p.src._url); }); }
function maxNodeId(n) {
  if (!n) return 0;
  let m = n.id || 0;
  if (n.secs) n.secs.forEach(s => { m = Math.max(m, s.id || 0, maxNodeId(s.tree)); });
  else if (!isLeaf(n)) m = Math.max(m, maxNodeId(n.a), maxNodeId(n.b));
  return m;
}
async function loadDraft(id) {
  if (!DR.store) return false;
  flushDraft(); await DR.chain;
  const data = await DR.store.getJSON(`${id}/state`).catch(() => null);
  if (!data || !data.state) { toast('That collage couldn’t be opened.'); return false; }
  DR.loading = true; busy('Opening collage…');
  const oldPhotos = S.photos, oldCrops = S.crops;
  S.photos = new Map(); S.crops = {};
  try {
    let maxSeq = 0;
    for (const m of data.photos || []) {
      maxSeq = Math.max(maxSeq, parseInt(String(m.id).slice(1), 10) || 0);
      let p = null;
      if (m.sample != null && SAMPLES[m.sample]) p = paintSample(m.sample, m.id);
      else {
        const blob = await DR.store.getBlob(`${id}/${m.id}`).catch(() => null);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        let im;
        try { im = await loadImg(url); } catch (e) { URL.revokeObjectURL(url); continue; }
        im._url = url;
        p = makePhoto(im, m.w || im.naturalWidth, m.h || im.naturalHeight, m.name, false, m.time ? new Date(m.time) : null, m.id);
        p.blob = blob;
      }
      p.timeSrc = m.timeSrc || p.timeSrc || null;
      if (m.lat != null && m.lon != null) { p.lat = m.lat; p.lon = m.lon; }
      if (m.place) p.place = m.place; if (m.cc) p.cc = m.cc;
    }
    const st = data.state, have = id => S.photos.has(id);
    if (!(st.active || []).some(have)) throw new Error('no photos');
    let tree = st.tree;
    (st.active || []).filter(pid => !have(pid)).forEach(pid => { tree = removeLeaf(tree, pid); });
    S.tree = tree; S.active = st.active.filter(have);
    S.crops = Object.assign(S.crops, st.crops || {}); S.caps = st.caps || {};
    S.hero = have(st.hero) ? st.hero : null; S.preset = st.preset || null;
    S.set = Object.assign(clone(DEFAULT_SET), st.set || {}, { border: Object.assign({}, DEFAULT_SET.border, (st.set || {}).border) });
    photoSeq = Math.max(photoSeq, maxSeq + 1, (data.seq && data.seq.photo) || 0);
    nodeSeq = Math.max(nodeSeq, maxNodeId(S.tree) + 1, (data.seq && data.seq.node) || 0);
    dropPhotos(oldPhotos);
    DR.id = id; DR.saved = new Set(ownPhotos()); DR.gone.delete(id);
    DR.index.last = id; saveIndex();
    activeFav = null; S.sel = null; setSwap(false); viewOff = 0;
    HIST.stack = []; HIST.i = -1;
    DR.last = draftKey(); commit();
    generateLayouts(); refreshAll(); resolvePlaces();
    return true;
  } catch (e) {
    dropPhotos(S.photos); S.photos = oldPhotos; S.crops = oldCrops;
    toast('That collage couldn’t be opened.'); return false;
  } finally { DR.loading = false; busy(null); }
}
// Start over from the samples (with your default favourite, if you have one).
function newCollage(skipSave) {
  if (skipSave) clearTimeout(DR.timer); else flushDraft();
  const old = S.photos;
  S.photos = new Map(); dropPhotos(old);
  DR.id = null; DR.saved = new Set(); DR.last = '';
  S.set = clone(DEFAULT_SET); S.set.date = todayISO();
  S.crops = {}; S.caps = {}; S.hero = null; S.tree = null; S.preset = null; S.sel = null;
  activeFav = null; setSwap(false); viewOff = 0;
  S.active = makeSamples();
  freshLayout();
  const f = store.def && favById(store.def);
  if (f) applyFavCore(f);
  HIST.stack = []; HIST.i = -1; commit();
  DR.index.last = null; saveIndex();
  refreshAll();
}
async function deleteDraft(id) {
  DR.gone.add(id);
  DR.index.items = DR.index.items.filter(x => x.id !== id);
  if (DR.index.last === id) DR.index.last = null;
  const open = DR.id === id;
  if (open) { clearTimeout(DR.timer); DR.id = null; DR.last = ''; }
  saveIndex();
  DR.chain = DR.chain.then(() => DR.store.delDir(id)).catch(() => {});
  if (open) newCollage(true);
  renderDrafts();
}
function whenLabel(t) {
  const d = new Date(t), now = new Date(), day = 86400000;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (now - d < 60000) return 'Just now';
  if (t >= midnight) return `Today ${hm}`;
  if (t >= midnight - day) return `Yesterday ${hm}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
function renderDrafts() {
  const list = $('#draftList'); list.textContent = '';
  const items = DR.index.items;
  $('#draftEmpty').hidden = items.length > 0;
  items.forEach(d => {
    const card = document.createElement('div'); card.className = 'dcard' + (d.id === DR.id ? ' current' : '');
    const open = document.createElement('button'); open.className = 'dopen'; open.setAttribute('aria-label', `Open ${d.name}`);
    const box = document.createElement('span'); box.className = 'dthumb';
    if (d.thumb) { const im = document.createElement('img'); im.src = d.thumb; im.alt = ''; box.appendChild(im); }
    if (d.id === DR.id) { const b = document.createElement('span'); b.className = 'dnow'; b.textContent = 'Open'; box.appendChild(b); }
    const nm = document.createElement('span'); nm.className = 'dname'; nm.textContent = d.name;
    const meta = document.createElement('span'); meta.className = 'dmeta'; meta.textContent = `${whenLabel(d.t)} · ${d.n} photo${d.n === 1 ? '' : 's'}`;
    open.append(box, nm, meta);
    open.addEventListener('click', async () => {
      if (d.id === DR.id) { closeDrafts(); return; }
      closeDrafts(); await loadDraft(d.id);
    });
    const del = document.createElement('button'); del.className = 'icon-btn ddel'; del.setAttribute('aria-label', `Delete ${d.name}`);
    del.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
    del.addEventListener('click', () => { DR.confirm = d.id; renderDrafts(); });
    card.append(open, del);
    if (DR.confirm === d.id) {
      const c = document.createElement('div'); c.className = 'dconfirm';
      const q = document.createElement('p'); q.textContent = 'Delete this collage? This can’t be undone.';
      const yes = document.createElement('button'); yes.className = 'btn sm danger'; yes.textContent = 'Delete';
      const no = document.createElement('button'); no.className = 'btn sm'; no.textContent = 'Keep';
      yes.addEventListener('click', () => { DR.confirm = null; deleteDraft(d.id); toast('Collage deleted'); });
      no.addEventListener('click', () => { DR.confirm = null; renderDrafts(); });
      c.append(q, yes, no); card.appendChild(c);
    }
    list.appendChild(card);
  });
  $('#draftNote').textContent = DR.store ? `${DR.store.label}. Collages with your photos save as you go.` : '';
}
function openDrafts() { flushDraft(); DR.confirm = null; renderDrafts(); $('#drafts').hidden = false; $('#draftsClose').focus(); }
function closeDrafts() { $('#drafts').hidden = true; DR.confirm = null; }
async function initDrafts() {
  try { DR.store = await Promise.race([hostDrafts(), sleep(3000).then(() => null)]); } catch (e) { DR.store = null; }
  if (!DR.store) return;
  try {
    const idx = await Promise.race([DR.store.getJSON('index'), sleep(3000).then(() => null)]);
    if (idx && Array.isArray(idx.items)) DR.index = { last: idx.last || null, items: idx.items.filter(x => x && x.id) };
  } catch (e) { /* start with an empty list */ }
  $('#openDrafts').hidden = false;
  const last = DR.index.last && DR.index.items.find(x => x.id === DR.index.last);
  if (last) { const ok = await loadDraft(last.id); if (ok) toast(`Back to “${last.name}”`); }
}

/* ================= actions ================= */
function applyCand(i, doCommit = true) {
  const c = S.cands[i]; if (!c) return;
  S.tree = cloneTree(c.tree);
  if (tab === 'layout') renderLayoutStrip();
  scheduleRender(false);
  if (doCommit) commit();
}
function shuffleLayout() {
  S.preset = null;
  if (hasSecs()) { regenSections('all', true); scheduleRender(false); commit(); return; }
  const cur = S.tree ? sigFull(S.tree) : '';
  generateLayouts();
  const opts = S.cands.map((c, i) => i).filter(i => sigFull(S.cands[i].tree) !== cur);
  applyCand(opts.length ? opts[Math.floor(Math.random() * Math.min(3, opts.length))] : 0);
  renderLayoutStrip();
}
function reseed(randomTilts) {
  S.set.seed = (S.set.seed + 1) % 100000;
  if (randomTilts && S.tree) { const R = mulberry32(S.set.seed * 31 + 7); setTilts(S.tree, R); }
  scheduleRender(false); commit();
}
function toggleFeature() {
  const pid = S.sel; if (!pid) return;
  const was = S.hero; S.hero = S.hero === pid ? null : pid;
  // A favourite's layout keeps going if it has a big spot for the featured photo.
  if (!hasSecs() && !(S.preset && S.preset.shape && shapeHasHero(S.preset.shape))) S.preset = null;
  if (hasSecs()) { const affected = S.tree.secs.filter(s => leavesOf(s.tree).some(l => l.pid === pid || l.pid === was)); regenSections(affected, false); }
  else freshLayout();
  commit(); scheduleRender(false); syncCellPane();
  toast(S.hero ? 'Featured: this photo gets the biggest spot' : 'Feature removed');
}
function moveToSection(pid, v) {
  if (!hasSecs()) return;
  const root = S.tree, fromI = secIndexOf(pid); if (fromI < 0) return;
  const from = root.secs[fromI];
  let to;
  if (v === 'new') {
    const cap = imageMode() ? MAX_FRAMES : MAX_SECS;
    if (root.secs.length >= cap) { toast(imageMode() ? `Up to ${cap} images.` : `Up to ${cap} sections.`); syncCellPane(); return; }
    to = { id: nodeSeq++, key: imageMode() ? `img:new${nodeSeq}` : null, name: imageMode() ? '' : `Day ${root.secs.length + 1}`, note: '', autoNote: '', pids: [], tree: null };
    root.secs.splice(fromI + 1, 0, to);
  } else { to = root.secs[+v]; if (!to || to === from) return; }
  from.tree = removeLeaf(from.tree, pid);
  to.pids = leavesOf(to.tree).map(l => l.pid).concat(pid); to.tree = null;
  if (!from.tree) root.secs = root.secs.filter(s => s !== from);
  regenSections([to], false);
  commit(); fitStage(); syncControls(); syncCellPane(); if (tab === 'layout') renderOrderStrip();
  toast(imageMode() ? `Moved to image ${root.secs.indexOf(to) + 1}` : `Moved to ${to.name || 'the new section'}`);
}
async function setSections(on, by) {
  if (!S.active.length) return;
  if (on) {
    if (by) S.set.secBy = by;
    if (S.set.secBy === 'place') { busy('Finding places…'); await resolvePlaces(); busy(null); }
    const n = buildSections(), places = String(S.tree.secs[0].key || '').startsWith('place:');
    if (S.set.secBy === 'place' && !places) toast('These photos don’t include a location, so they’re grouped by day instead.', 3600);
    else toast(n > 1 ? `Grouped into ${n} ${places ? 'places' : 'days'}` : 'One section for now. Tap a photo to start another.');
  } else { S.tree = null; freshLayout(); }
  viewOff = 0; commit(); refreshAll();
}
function removePhoto(pid) {
  S.active = S.active.filter(x => x !== pid);
  S.tree = S.active.length && S.tree ? removeLeaf(S.tree, pid) : null;
  if (S.hero === pid) S.hero = null;
  delete S.caps[pid];
  if (S.sel === pid) select(null);
  generateLayouts();
  commit(); refreshAll();
}
async function addFiles(files) {
  const list = files.filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|avif|bmp)$/i.test(f.name));
  if (!list.length) { toast('Those files aren’t photos. Choose JPEG, PNG or HEIC images.'); return; }
  const real = S.active.filter(id => !S.photos.get(id).sample), room = MAX_PHOTOS - real.length;
  if (room <= 0) { toast(`A collage holds up to ${MAX_PHOTOS} photos. Remove one to add more.`); return; }
  const take = list.slice(0, room);
  busy(`Adding ${take.length} photo${take.length > 1 ? 's' : ''}…`);
  const added = []; let failed = 0;
  for (const f of take) { try { added.push(await loadPhoto(f)); } catch (err) { failed++; } }
  busy(null);
  if (!added.length) { toast('Those photos couldn’t be opened. Try JPEG or PNG.'); return; }
  const hadSamples = S.active.some(id => S.photos.get(id).sample);
  S.active = real.concat(added.map(p => p.id));
  if (hadSamples) { S.caps = {}; S.hero = null; }
  select(null);
  arrangeAll();
  commit(); refreshAll();
  if (!imageMode() && S.active.length > 12 && !hintedSplit) { hintedSplit = true; setTimeout(() => toast('That’s a lot for one image. Size › Split into several images spreads them out.', 4500), 2900); }
  let msg = `Added ${added.length} photo${added.length > 1 ? 's' : ''}`;
  if (failed) msg += ` · ${failed} couldn’t be opened`;
  if (list.length > take.length) msg += ` · limit is ${MAX_PHOTOS}`;
  toast(msg);
}
async function replaceSelected(file) {
  const old = S.sel; if (!old) return;
  busy('Opening photo…');
  try {
    const p = await loadPhoto(file);
    S.active = S.active.map(id => id === old ? p.id : id);
    const L = leavesOf(S.tree).find(l => l.pid === old); if (L) L.pid = p.id;
    if (S.set.blurPid === old) S.set.blurPid = p.id;
    if (S.hero === old) S.hero = p.id;
    if (S.caps[old]) { S.caps[p.id] = S.caps[old]; delete S.caps[old]; }
    busy(null);
    generateLayouts(); commit(); refreshAll(); select(p.id);
  } catch (e) { busy(null); toast('That photo couldn’t be opened. Try a JPEG or PNG.'); }
}
function refreshAll() {
  syncControls(); renderPhotoStrip(); buildPalette();
  if (tab === 'layout') renderLayoutStrip();
  if (tab === 'style') { renderStyleStrip(); renderFavStrip(); }
  if (tab === 'look') renderLookStrip();
  if (tab === 'text') renderTextPane();
  showPanes(); fitStage();
}

/* ================= history ================= */
const HIST = { stack: [], i: -1 };
const snap = () => JSON.stringify({ tree: S.tree, crops: S.crops, set: S.set, active: S.active, caps: S.caps, hero: S.hero, preset: S.preset });
function commit() {
  const s = snap(); if (HIST.stack[HIST.i] === s) return;
  HIST.stack.length = HIST.i + 1; HIST.stack.push(s);
  if (HIST.stack.length > 80) HIST.stack.shift();
  HIST.i = HIST.stack.length - 1; updateUndo();
  queueDraft();
}
function restore(i) {
  const o = JSON.parse(HIST.stack[i]); HIST.i = i;
  S.tree = o.tree; S.crops = o.crops; S.set = o.set; S.active = o.active.filter(id => S.photos.has(id)); S.caps = o.caps || {}; S.hero = o.hero || null; S.preset = o.preset || null;
  S.sel = null; setSwap(false); generateLayouts(); refreshAll(); queueDraft();
}
function updateUndo() { $('#undo').disabled = HIST.i <= 0; $('#redo').disabled = HIST.i >= HIST.stack.length - 1; }
const undo = () => { if (HIST.i > 0) restore(HIST.i - 1); };
const redo = () => { if (HIST.i < HIST.stack.length - 1) restore(HIST.i + 1); };

/* ================= toast ================= */
let toastT = 0;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function busy(msg) { const t = $('#toast'); clearTimeout(toastT); if (msg) { t.innerHTML = '<span class="spinner"></span>'; t.appendChild(document.createTextNode(msg)); t.classList.add('show'); } else t.classList.remove('show'); }

/* ================= save ================= */
let saver = null, saverReady = null, saving = false, rendering = false, saveItems = [], saveToken = 0;
function initSaver() {
  if (!saverReady) saverReady = hostSaver().catch(() => null).then(s => { saver = s; updateSaveUI(); return s; });
  return saverReady;
}
function updateSaveUI() {
  const n = saveItems.length, many = n > 1, app = !!(saver && saver.share), kind = saver && saver.kind;
  const U = S.set.format === 'carousel' ? 'slides' : 'images';
  $('#saveBtn').hidden = !saver;
  $('#shareBtn').hidden = !app;
  $('#saveBtn').textContent = app ? (many ? `Save ${n} ${U} to Photos` : 'Save to Photos')
    : kind === 'sheet' ? (many ? `Save or share ${n} ${U}` : 'Save or share')
    : kind === 'download' ? (many ? `Download ${n} ${U}` : 'Download JPEG')
    : (many ? `Save ${n} ${U}` : 'Save JPEG');
  $('#saveBtn').disabled = $('#shareBtn').disabled = saving || rendering || !n;
  if (kind === 'sheet' || kind === 'download') {
    $('#saveHint').textContent = kind === 'sheet'
      ? (many ? `Opens the share sheet with all ${n} ${U}. Tap Save Images to put them in Photos in order, or send them to Instagram.`
              : 'Opens the share sheet. Tap Save Image to put it in Photos, or send it to Instagram, Messages and more.')
      : (many ? `Each of the ${n} ${U} downloads as its own JPEG, numbered in order.` : 'Saves a full-quality JPEG to your Downloads.');
    return;
  }
  $('#saveHint').textContent = app
    ? (many ? 'Slides save in order, ready to post as one carousel. Share attaches every slide at once.'
            : 'Saves straight to your Photos. Share sends it to Instagram, Messages and more.')
    : saver
    ? (many ? 'Each slide saves as its own image. On iPhone, choose Save Image in each share sheet, then post them in order as one carousel.'
            : 'On iPhone, Save opens the share sheet: choose Save Image to put it in Photos. You can also press and hold the picture above.')
    : (many ? 'Press and hold each slide, then choose Save to Photos. Post them in order as one carousel.'
            : 'Press and hold the picture above, then choose Save to Photos. On a computer, right-click it and choose Save Image.');
}
async function exportImages(mult) {
  await Promise.all([looksReady(), ensureFonts()]);
  const D = dims(), W = D.w * mult, H = D.h * mult, n = D.slides || 1, sw = W / n, out = [];
  EXPORTING = true;
  try {
    const g = geometryFor(S.tree, W, H, S.set);
    for (let i = 0; i < n; i++) {
      const c = canvasEl(sw, H), ctx = c.getContext('2d');
      ctx.translate(-i * sw, 0);
      paint(ctx, g, { draft: false, preview: false });
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .93));
      c.width = c.height = 0;
      out.push({ blob, W: Math.round(sw), H });
    }
  } finally { EXPORTING = false; }
  return out;
}
async function refreshSave() {
  const token = ++saveToken, prev = $('#savePrev');
  rendering = true; $('#saveSpin').hidden = false; $('#saveBtn').disabled = $('#shareBtn').disabled = true; $('#saveMeta').textContent = 'Rendering…';
  $$('img, .save-strip', prev).forEach(el => { el.style.opacity = .35; });
  const items = await exportImages(saveMult);
  if (token !== saveToken) return;
  rendering = false;
  saveItems.forEach(it => URL.revokeObjectURL(it.url));
  $$('img, .save-strip', prev).forEach(el => el.remove());
  if (items.some(it => !it.blob)) { saveItems = []; $('#saveMeta').textContent = 'This size is too large for this device. Try Standard.'; $('#saveSpin').hidden = true; updateSaveUI(); return; }
  saveItems = items.map(it => Object.assign(it, { url: URL.createObjectURL(it.blob) }));
  if (saveItems.length === 1) { const im = document.createElement('img'); im.className = 'one'; im.alt = 'Your finished collage'; im.src = saveItems[0].url; prev.appendChild(im); }
  else { const strip = document.createElement('div'); strip.className = 'save-strip'; saveItems.forEach((it, i) => { const im = document.createElement('img'); im.alt = `Slide ${i + 1}`; im.src = it.url; strip.appendChild(im); }); prev.appendChild(strip); }
  $('#saveSpin').hidden = true;
  const it = saveItems[0], mb = saveItems.reduce((s, x) => s + x.blob.size, 0) / 1048576;
  $('#saveMeta').textContent = saveItems.length > 1 ? `${saveItems.length} ${S.set.format === 'carousel' ? 'slides' : 'images'} · ${it.W} × ${it.H} px each` : `${it.W} × ${it.H} px · ${mb.toFixed(1)} MB`;
  updateSaveUI();
}
function openSave() {
  if (!S.tree) { toast('Add photos first.'); return; }
  select(null);
  $('#sheet').hidden = false;
  initSaver();
  syncControls(); refreshSave();
}
function closeSave() { $('#sheet').hidden = true; }
function fileName(i, n) { const d = new Date(); return `gluestick-${S.set.format}-${d.getFullYear()}${z2(d.getMonth() + 1)}${z2(d.getDate())}-${z2(d.getHours())}${z2(d.getMinutes())}${n > 1 ? '-' + z2(i + 1) : ''}.jpg`; }
async function doSave() {
  if (!saver || saving || !saveItems.length) return;
  const n = saveItems.length, names = saveItems.map((_, i) => fileName(i, n));
  saving = true; updateSaveUI();
  try {
    await saver.save(saveItems.map(it => it.blob), names, i => { if (n > 1) toast(`Saving slide ${i + 1} of ${n}…`, 2000); });
    if (saver.kind !== 'sheet') toast(n > 1 ? `Saved ${n} ${S.set.format === 'carousel' ? 'slides' : 'images'}` : 'Saved'); // the share sheet confirms for itself
  } catch (err) {
    const code = err && err.code, done = (err && err.done) || 0;
    if (code === 'cancelled') toast(n > 1 && done ? `Stopped after ${done} of ${n} slides` : 'Save cancelled');
    else if (code === 'busy') toast('A save is already waiting for you. Try again in a moment.');
    else if (code === 'denied') toast('Gluestick needs permission to add photos. Turn it on in Settings › Gluestick › Photos.', 5000);
    else if (saver.share) toast('That didn’t save. Try Share, then Save Image.', 4000);
    else if (saver.kind === 'sheet') toast('The share sheet didn’t open. Press and hold the picture above, then choose Save to Photos.', 4500);
    else { saver = null; toast('Saving isn’t available here. Press and hold the picture instead.'); }
  } finally { saving = false; updateSaveUI(); }
}
async function doShare() {
  if (!saver || !saver.share || saving || !saveItems.length) return;
  const n = saveItems.length;
  saving = true; updateSaveUI();
  try { await saver.share(saveItems.map(it => it.blob), saveItems.map((_, i) => fileName(i, n))); }
  catch (err) { if (!(err && err.code === 'cancelled')) toast('Sharing didn’t work. Try Save to Photos instead.'); }
  finally { saving = false; updateSaveUI(); }
}

/* ================= wiring ================= */
let adjT = 0;
$$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$$('input[type=range][data-key]').forEach(inp => {
  const key = inp.dataset.key, div = +(inp.dataset.div || 1), heavy = key === 'lookAmt' || ADJ_KEYS.includes(key);
  inp.addEventListener('input', () => {
    S.set[key] = +inp.value / div; inp.nextElementSibling.textContent = inp.value; activeFav = null;
    if (heavy) { clearTimeout(adjT); adjT = setTimeout(() => scheduleRender(false), 160); }
    else scheduleRender(true);
  });
  inp.addEventListener('change', () => { S.set[key] = +inp.value / div; scheduleRender(false); commit(); });
});
$$('.seg[data-seg]').forEach(seg => {
  const key = seg.dataset.seg, num = seg.dataset.num === '1';
  $$('button', seg).forEach(b => b.addEventListener('click', () => {
    if (key === 'res') { saveMult = +b.dataset.v; syncControls(); refreshSave(); return; }
    const v = num ? +b.dataset.v : b.dataset.v;
    if (S.set[key] === v) return;
    S.set[key] = v; activeFav = null;
    if (key === 'sizing' || key === 'slideRatio') { viewOff = 0; relayout(); }
    else { syncControls(); scheduleRender(false); }
    commit();
  }));
});
$$('input[type=checkbox][data-flag]').forEach(c => c.addEventListener('change', () => { S.set[c.dataset.flag] = c.checked; activeFav = null; scheduleRender(false); commit(); }));
$('#dateIn').addEventListener('change', e => { if (e.target.value) { S.set.date = e.target.value; S.set.dateStamp = true; syncControls(); scheduleRender(false); commit(); } });
$$('#lookSub button').forEach(b => b.addEventListener('click', () => { lookSub = b.dataset.v; syncControls(); }));
$$('#textSub button').forEach(b => b.addEventListener('click', () => { textSub = b.dataset.v; renderTextPane(); }));
$('#resetAdj').addEventListener('click', () => { ADJ_KEYS.forEach(k => { S.set[k] = 0; }); syncControls(); scheduleRender(false); commit(); });
$('#splitOn').addEventListener('change', e => { activeFav = null; setSplit(e.target.checked ? (S.set.perImage || lastPerImage) : 0); });
$('#piMinus').addEventListener('click', () => { if (imageMode() && S.set.perImage > 2) { activeFav = null; lastPerImage = S.set.perImage - 1; setSplit(lastPerImage); } });
$('#piPlus').addEventListener('click', () => { if (imageMode() && S.set.perImage < 12) { activeFav = null; lastPerImage = S.set.perImage + 1; setSplit(lastPerImage); } });
$$('#splitBy button').forEach(b => b.addEventListener('click', () => { if (S.set.splitBy === b.dataset.v) return; activeFav = null; if (imageMode()) setSplit(null, b.dataset.v); else { S.set.splitBy = b.dataset.v; syncControls(); } }));
$('#slMinus').addEventListener('click', () => { if (S.set.slides <= 2 || hasSecs()) return; S.set.slides--; viewOff = 0; relayout(); commit(); });
$('#slPlus').addEventListener('click', () => { if (S.set.slides >= 10 || hasSecs()) return; S.set.slides++; relayout(); commit(); });
$('#gridGuide').addEventListener('change', e => { gridGuide = e.target.checked; drawOverlay(); });
$('#retear').addEventListener('click', () => reseed(true));
$('#rescatter').addEventListener('click', () => reseed(false));
$('#shuffle').addEventListener('click', shuffleLayout);
$('#titleIn').addEventListener('input', e => { S.set.title = e.target.value; scheduleRender(false); });
$('#subIn').addEventListener('input', e => { S.set.subtitle = e.target.value; scheduleRender(false); });
$('#titleAuto').addEventListener('click', fillTitleFromPhotos);
$('#capPlaces').addEventListener('click', fillCaptionsFromPlaces);
['#titleIn', '#subIn'].forEach(s => $(s).addEventListener('change', () => commit()));
$('#secToggle').addEventListener('change', e => { S.preset = null; setSections(e.target.checked); });
$('#secByDay').addEventListener('click', () => { S.preset = null; setSections(true, 'day'); });
$('#secByPlace').addEventListener('click', () => { S.preset = null; setSections(true, 'place'); });
$('#capIn').addEventListener('input', e => { if (!S.sel) return; S.caps[S.sel] = e.target.value; scheduleRender(false); });
$('#capIn').addEventListener('change', () => commit());
$('#secSel').addEventListener('change', e => { if (S.sel) moveToSection(S.sel, e.target.value); });
$('#favDefault').addEventListener('click', () => { if (!activeFav) return; store.def = store.def === activeFav ? null : activeFav; persist(); renderFavStrip(); toast(store.def ? 'This opens by default next time' : 'Default cleared'); });
$('#favDelete').addEventListener('click', () => { const f = favById(activeFav); if (!f || f.id.startsWith('starter:')) return; store.favs = store.favs.filter(x => x.id !== f.id); if (store.def === f.id) store.def = null; activeFav = null; persist(); renderFavStrip(); toast(`Deleted “${f.name}”`); });
$('#favLayout').addEventListener('change', e => {
  const f = store.favs.find(x => x.id === activeFav); if (!f || !f.layout) return;
  f.useLayout = e.target.checked; persist();
  if (f.useLayout) { applyLayoutPreset(f.layout); toast('Layout applied. New photos fit into it.'); }
  else { S.preset = null; toast('Style only. Layouts are picked fresh for your photos.'); }
  commit(); refreshAll();
});
$('#favName').addEventListener('change', e => { const f = store.favs.find(x => x.id === activeFav); if (!f) return; f.name = e.target.value.trim() || f.name; persist(); renderFavStrip(); });
$('#clearAll').addEventListener('click', () => { S.active = []; S.tree = null; S.hero = null; select(null); generateLayouts(); commit(); refreshAll(); toast('Cleared. Undo brings them back.'); });
$('#fileAdd').addEventListener('change', e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) addFiles(files); });
$('#fileReplace').addEventListener('change', e => { const f = (e.target.files || [])[0]; e.target.value = ''; if (f) replaceSelected(f); });
// On a computer: drop photos anywhere on the page, or paste one.
let dragDepth = 0;
const dragHasFiles = e => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
document.addEventListener('dragenter', e => { if (!dragHasFiles(e)) return; e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
document.addEventListener('dragover', e => { if (!dragHasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.addEventListener('dragleave', e => { if (!dragHasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
document.addEventListener('drop', e => {
  if (!dragHasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; $('#drop').hidden = true;
  const files = Array.from(e.dataTransfer.files || []); if (files.length) addFiles(files);
});
document.addEventListener('paste', e => {
  if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
  if (files.length) { e.preventDefault(); addFiles(files); }
});
$$('label[for][tabindex]').forEach(l => l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.click(); } }));
document.addEventListener('keydown', e => {
  if (e.target && e.target.classList && e.target.classList.contains('tile') && e.target.htmlFor && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !['range', 'checkbox', 'color'].includes(document.activeElement.type);
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (e.key === 'Escape') { if (!$('#drafts').hidden) closeDrafts(); else if (!$('#sheet').hidden) closeSave(); else if (swapMode) setSwap(false); else select(null); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel && !typing) { e.preventDefault(); removePhoto(S.sel); }
});
$('#cellDone').addEventListener('click', () => select(null));
$('#toolSwap').addEventListener('click', () => setSwap(!swapMode));
$('#swapCancel').addEventListener('click', () => setSwap(false));
$('#toolFeature').addEventListener('click', toggleFeature);
$('#toolReset').addEventListener('click', () => { if (!S.sel) return; S.crops[S.sel] = { z: 1, fx: .5, fy: .5 }; syncZoom(); scheduleRender(false); commit(); });
$('#toolBlur').addEventListener('click', () => { if (!S.sel) return; S.set.bgMode = 'blur'; S.set.blurPid = S.sel; syncControls(); scheduleRender(false); commit(); toast('Background is now a blur of this photo. Change it in Colour.'); });
$('#toolRemove').addEventListener('click', () => { if (S.sel) removePhoto(S.sel); });
$('#zoom').addEventListener('input', e => { if (!S.sel) return; cropOf(S.sel).z = +e.target.value / 100; $('#zoomOut').textContent = e.target.value + '%'; scheduleRender(true); });
$('#zoom').addEventListener('change', () => { scheduleRender(false); commit(); });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#openSave').addEventListener('click', openSave);
$('#openDrafts').addEventListener('click', openDrafts);
$('#draftsClose').addEventListener('click', closeDrafts);
$('#drafts').addEventListener('click', e => { if (e.target.id === 'drafts') closeDrafts(); });
// New collage: start fresh, then go straight to the photo picker.
$('#draftNew').addEventListener('click', () => {
  closeDrafts(); newCollage();
  if (nativePicker) pickNative(true); else $('#fileAdd').click();
});
$('#sheetClose').addEventListener('click', closeSave);
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSave(); });
$('#saveBtn').addEventListener('click', doSave);
$('#shareBtn').addEventListener('click', doShare);
stage.addEventListener('dragover', e => { e.preventDefault(); });
stage.addEventListener('drop', e => { e.preventDefault(); const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []); if (files.length) addFiles(files); });
stage.addEventListener('pointerdown', e => { if (e.target === stage) select(null); });
if (window.ResizeObserver) new ResizeObserver(() => fitStage()).observe(stage); else window.addEventListener('resize', fitStage);

/* ================= start ================= */
if (/[?&]debug\b/.test(location.search)) window.__gs = { S, DR, store, HIST, fitShape, leavesOf, geom: () => lastGeom, kpx };
buildFormatStrip(); buildColourPane(); buildFontStrip();
S.active = makeSamples();
generateLayouts(); applyCand(0, false);
commit();
refreshAll(); setTab('photos');
ensureFonts().then(() => { scheduleRender(false); if (tab === 'style') { renderStyleStrip(); renderFavStrip(); } });
// Reopen the last collage before showing anything, so the samples don't flash up first.
setTimeout(async () => {
  initSaver();
  try { await initDrafts(); } finally { document.documentElement.classList.remove('booting'); }
  initStore();
}, 0);
// Save straight away when the app goes to the background or the tab closes.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDraft(); });
window.addEventListener('pagehide', () => flushDraft());
})();
