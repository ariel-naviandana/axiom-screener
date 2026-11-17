// src/scrape/migcandle.js — candle migrasi dari data chart Axiom
// Saat detail coin dibuka, chart Axiom mengambil candle dari
//   https://sol-api*.axiom.trade/token-chart?tokenAddress=<CA>&...&interval=1m
// isinya bars: [waktu ms, open, high, low, close, volume USD, supply] (harga USD, market cap = harga x supply).
// Waktu migrasi = waktu pair AMM dibuat (DexScreener pairCreatedAt, pair bonding curve seperti "pumpfun" dilewati).
// Candle migrasi = candle migIntervalMin menit yang mencakup waktu migrasi (gabungan bar chart 1 menit: O pertama,
// H maks, L min, C terakhir, volume dijumlah). O/H/L/C dicatat sebagai market cap (sama dengan chart).
const { sleep, nowTs } = require('../core/util');

const EMPTY_MIG = { migAt: '-', migVol: -1, migO: -1, migH: -1, migL: -1, migC: -1 };
const migCache = new Map(); // CA -> waktu migrasi (ms), tidak berubah, jadi cukup diambil sekali

// Pasang penangkap respons token-chart SEBELUM halaman detail dibuka. Return fungsi untuk menunggu hasilnya.
function captureChart(page, ca) {
    let bars = null;
    let interval = '';
    const onResponse = async (res) => {
        const url = res.url();
        if (!url.includes('/token-chart?') || !url.includes(ca)) return;
        try {
            const data = await res.json();
            if (Array.isArray(data.bars) && data.bars.length) {
                bars = data.bars;
                interval = (url.match(/[?&]interval=([^&]+)/) || [])[1] || '';
            }
        } catch { /* respons rusak / bukan JSON */ }
    };
    page.on('response', onResponse);
    return async (waitMs) => {
        const end = Date.now() + waitMs;
        while (!bars && Date.now() < end) await sleep(250);
        page.off('response', onResponse);
        return bars ? { bars, interval } : null;
    };
}

// Waktu migrasi dari DexScreener (pair AMM paling awal, selain pair bonding curve)
async function migrationTime(pw, ca) {
    if (migCache.has(ca)) return migCache.get(ca);
    // gagal (timeout / error jaringan / HTTP bukan 200) -> dicoba ulang migApiRetries kali
    let data;
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
                signal: AbortSignal.timeout(pw.migApiTimeoutMs),
            });
            if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
            data = await res.json();
            break;
        } catch (e) {
            if (attempt >= (Number(pw.migApiRetries) || 0)) throw e;
            await sleep(1000);
        }
    }
    const skip = new Set(pw.migBondingDexes.map((d) => d.toLowerCase()));
    const pair = (data.pairs || [])
        .filter((p) => p.chainId === 'solana' && p.pairCreatedAt && !skip.has(String(p.dexId).toLowerCase()))
        .sort((a, b) => a.pairCreatedAt - b.pairCreatedAt)[0];
    if (!pair) return null;
    migCache.set(ca, pair.pairCreatedAt);
    return pair.pairCreatedAt;
}

const STEP_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
function intervalMs(interval, bars) {
    const m = String(interval).match(/^(\d+)([smhd])$/i);
    if (m) return Number(m[1]) * STEP_MS[m[2].toLowerCase()];
    return bars.length > 1 ? bars[1][0] - bars[0][0] : 60000;
}

// Hitung candle migrasi dari bars + waktu migrasi
async function readMigCandle(pw, ca, chart) {
    if (!chart) return { ...EMPTY_MIG, migNote: 'data chart tidak tertangkap' };
    let at;
    try {
        at = await migrationTime(pw, ca);
    } catch (e) {
        return { ...EMPTY_MIG, migNote: `waktu migrasi gagal (${e.message})` };
    }
    if (!at) return { ...EMPTY_MIG, migNote: 'belum migrasi / pair AMM tidak ada di DexScreener' };

    const step = intervalMs(chart.interval, chart.bars);
    const res = { ...EMPTY_MIG, migAt: nowTs(new Date(at)) };
    // candle migrasi dengan interval migIntervalMin (mis. 5 menit): gabungan bar chart dalam rentang itu
    const want = Math.max(step, (Number(pw.migIntervalMin) || 0) * 60000);
    const start = Math.floor(at / want) * want;
    const inRange = chart.bars.filter((b) => b[0] >= start && b[0] < start + want);
    const first = chart.bars[0][0];
    if (!inRange.length || first > at) {
        return { ...res, migNote: `migrasi ${res.migAt} di luar data chart (mulai ${nowTs(new Date(first))})` };
    }
    if (first > start) {
        return { ...res, migNote: `data chart mulai ${nowTs(new Date(first))}, candle ${want / 60000}m migrasi tidak lengkap` };
    }
    // market cap tiap bar = harga x supply bar itu (supply di data chart bisa berubah antar bar)
    const sup = (b) => (Number(b[6]) > 0 ? Number(b[6]) : 1e9);
    const mcs = inRange.map((b) => ({ o: b[1] * sup(b), h: b[2] * sup(b), l: b[3] * sup(b), c: b[4] * sup(b), v: Number(b[5]) }));
    const o = mcs[0].o;
    const h = Math.max(...mcs.map((x) => x.h));
    const l = Math.min(...mcs.map((x) => x.l));
    const c = mcs[mcs.length - 1].c;
    const v = mcs.reduce((t, x) => t + x.v, 0);
    return {
        ...res,
        migVol: Math.round(v * 100) / 100,
        migO: Math.round(o), migH: Math.round(h), migL: Math.round(l), migC: Math.round(c),
        migNote: `candle ${want / 60000}m ${nowTs(new Date(start))} (${inRange.length} bar ${chart.interval || `${step / 60000}m`})`,
    };
}

module.exports = { captureChart, readMigCandle, EMPTY_MIG };
