// src/core/util.js — helper umum: waktu WIB, log, parsing angka
const TZ = 'Asia/Jakarta';

// "YYYY-MM-DD HH:mm:ss" (WIB), format sama dengan macro UI.Vision
function nowTs(d = new Date()) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`;
}

// "YYYY-MM-DD_HH-mm-ss" untuk nama file
const fileTs = (d = new Date()) => nowTs(d).replace(' ', '_').replace(/:/g, '-');

const log = (tag, msg) => console.log(`[${nowTs()}] [${tag}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Angka pertama di teks, -1 kalau tidak terbaca (sama dengan macro)
function num(text) {
    const m = String(text ?? '').match(/-?\d[\d,]*\.?\d*/);
    return m ? parseFloat(m[0].replace(/,/g, '')) : -1;
}

// Market cap: "27.6K" / "$1.2M" / "3B" -> angka. -1 kalau tidak terbaca
function mcap(text) {
    const m = String(text ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KMBT])?/i);
    if (!m) return -1;
    const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1;
    return Math.round(parseFloat(m[1]) * mult);
}

// Teks bersih, "-" kalau kosong
function txt(text) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    return s === '' ? '-' : s;
}

module.exports = { nowTs, fileTs, log, sleep, num, mcap, txt };
