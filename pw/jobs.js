// pw/jobs.js — job screener (top N Pulse) dan watcher (coin di watchlist)
// Pengaman macet (guard.js):
//   - satu coin dibatasi coinTimeoutMs -> status TIMEOUT, tab diganti baru, lanjut coin berikutnya
//   - tab crash -> diganti tab baru di coin berikutnya
//   - satu siklus dibatasi (screenerTimeoutMs / watcher: jumlah coin x coinTimeoutMs + extra)
//     -> siklus dihentikan paksa, tab ditutup, jadwal berikutnya bisa jalan
//   - tab yang tidak bisa ditutup (hang) ditinggal, tidak menahan siklus
const fs = require('fs');
const path = require('path');
const { readPulse, scrapeCoin, EMPTY } = require('./scrape');
const { nowTs, fileTs, log, appendRow } = require('./util');
const { withTimeout, closePage, TimeoutError, Progress } = require('./guard');

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PULSE_TIMEOUT_MS = 5 * 60 * 1000;

// progres siklus yang sedang jalan (dipakai di log "dilewati")
const progress = { SCREENER: new Progress(), WATCHER: new Progress() };

// Tab untuk satu siklus. Kalau crash / ada perintah yang menggantung, tab diganti baru.
class Tab {
    constructor(context, tag) {
        this.context = context;
        this.tag = tag;
        this.page = null;
        this.broken = false;
    }

    async get() {
        if (this.page && !this.broken && !this.page.isClosed()) return this.page;
        if (this.page) {
            await closePage(this.page, this.tag);
            log(this.tag, 'Tab lama bermasalah, membuka tab baru');
        }
        this.broken = false;
        const page = await withTimeout(this.context.newPage(), 30000, 'Buka tab baru');
        page.on('crash', () => {
            this.broken = true;
            log(this.tag, 'Tab crash, diganti tab baru di coin berikutnya');
        });
        this.page = page;
        return page;
    }

    async close() {
        await closePage(this.page, this.tag);
        this.page = null;
    }
}

// Jalankan satu siklus dengan batas waktu. ctl.aborted = true kalau dihentikan paksa,
// supaya proses lama (kalau ternyata lanjut) berhenti dan tidak menulis ke CSV lagi.
async function guardedCycle(tag, context, maxMs, body) {
    const prog = progress[tag];
    const ctl = { aborted: false, tab: new Tab(context, tag), prog };
    prog.begin();
    try {
        return await withTimeout(body(ctl), maxMs, `Siklus ${tag}`);
    } catch (e) {
        if (!(e instanceof TimeoutError)) throw e;
        ctl.aborted = true;
        log(tag, `SIKLUS MACET (${prog}), batas ${maxMs >= 60000 ? `${(maxMs / 60000).toFixed(1)} mnt` : `${Math.round(maxMs / 1000)} dtk`} terlewati, dihentikan paksa`);
        return null;
    } finally {
        prog.reset();
        await ctl.tab.close();
    }
}

// Satu coin dengan batas waktu. Kalau lewat: status TIMEOUT dan tab diganti baru.
async function scrapeGuarded(ctl, pw, coin) {
    const base = { ...EMPTY, name: coin.name, ca: coin.ca };
    let page;
    try {
        page = await ctl.tab.get();
    } catch (e) {
        return { row: { ...base, status: 'ERROR' }, holders: -1, error: e.message };
    }
    try {
        const onStep = (step) => { if (!ctl.aborted) ctl.prog.set({ step }); };
        const res = await withTimeout(scrapeCoin(page, pw, coin, onStep), pw.coinTimeoutMs, `Coin ${coin.name}`);
        if (res.error && /crash|closed|Target/i.test(res.error)) ctl.tab.broken = true;
        return res;
    } catch (e) {
        ctl.tab.broken = true; // perintah di tab ini masih menggantung, tidak bisa dipakai lagi
        return { row: { ...base, status: 'TIMEOUT' }, holders: -1, error: e.message };
    }
}

// Scrape daftar coin satu per satu, tulis ke CSV
async function scrapeList(tag, ctl, pw, coins, file) {
    for (const [i, coin] of coins.entries()) {
        if (ctl.aborted) return;
        ctl.prog.set({ i: i + 1, n: coins.length, name: coin.name, step: '' });
        const { row, holders, error } = await scrapeGuarded(ctl, pw, coin);
        if (ctl.aborted) return;
        row.ts = nowTs();
        appendRow(file, row);
        log(tag, `${i + 1}/${coins.length} ${coin.name} | holders=${holders} | top10=${row.aTop10} `
            + `bundler=${row.aBundlers} insider=${row.aInsiders} rug=${row.gRug} | mcap=${row.aMcap} | ${row.status}`
            + (error ? ` (${error})` : ''));
    }
}

// ---------- Screener: sama dengan macro axiom_screener ----------
async function runScreener(context, pw) {
    const file = path.join(pw.outputDir, `axiom_screener_${fileTs()}.csv`);
    const t0 = Date.now();
    log('SCREENER', 'Mulai');

    const done = await guardedCycle('SCREENER', context, pw.screenerTimeoutMs, async (ctl) => {
        ctl.prog.set({ step: 'Pulse' });
        let coins;
        try {
            const page = await ctl.tab.get();
            coins = await withTimeout(readPulse(page, pw, 'SCREENER'), PULSE_TIMEOUT_MS, 'Baca Pulse');
        } catch (e) {
            ctl.tab.broken = true;
            log('SCREENER', `Pulse gagal dibaca (${e.message}), siklus dilewati`);
            return false;
        }
        if (ctl.aborted) return false;
        if (!coins) {
            log('SCREENER', 'Pulse tidak terbaca setelah 3 percobaan, siklus dilewati');
            return false;
        }
        log('SCREENER', `${coins.length} coin terbaca dari kolom Migrated`);
        await scrapeList('SCREENER', ctl, pw, coins, file);
        return !ctl.aborted;
    });

    if (done) log('SCREENER', `Selesai dalam ${Math.round((Date.now() - t0) / 1000)} dtk -> ${path.basename(file)}`);
}

// ---------- Watcher: sama dengan macro axiom_watcher ----------
function readWatchlist(file) {
    try {
        return fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1)
            .map((l) => l.split(','))
            .map(([ca, name]) => ({ ca: String(ca || '').trim(), name: String(name || '').trim() }))
            .filter((c) => CA_RE.test(c.ca));
    } catch {
        return null;
    }
}

async function runWatcher(context, pw) {
    const coins = readWatchlist(pw.watchlistPath);
    if (coins === null) {
        log('WATCHER', 'Watchlist belum ada / tidak terbaca');
        return 0;
    }
    if (coins.length === 0) {
        log('WATCHER', 'Watchlist kosong');
        return 0;
    }

    const file = path.join(pw.outputDir, `axiom_watch_${fileTs()}.csv`);
    const t0 = Date.now();
    log('WATCHER', `Mulai: ${coins.length} coin`);

    const maxMs = coins.length * pw.coinTimeoutMs + pw.watcherTimeoutExtraMs;
    const done = await guardedCycle('WATCHER', context, maxMs, async (ctl) => {
        await scrapeList('WATCHER', ctl, pw, coins, file);
        return !ctl.aborted;
    });

    if (done) log('WATCHER', `Selesai dalam ${Math.round((Date.now() - t0) / 1000)} dtk -> ${path.basename(file)}`);
    return coins.length;
}

module.exports = { runScreener, runWatcher, progress };
