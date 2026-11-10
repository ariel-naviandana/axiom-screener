// pw/jobs.js — job screener (top N Pulse) dan watcher (coin di watchlist)
const fs = require('fs');
const path = require('path');
const { readPulse, scrapeCoin } = require('./scrape');
const { nowTs, fileTs, log, appendRow } = require('./util');

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function withPage(context, fn) {
    const page = await context.newPage();
    try {
        return await fn(page);
    } finally {
        await page.close().catch(() => {});
    }
}

// ---------- Screener: sama dengan macro axiom_screener ----------
async function runScreener(context, pw) {
    const file = path.join(pw.outputDir, `axiom_screener_${fileTs()}.csv`);
    const t0 = Date.now();
    log('SCREENER', 'Mulai');

    await withPage(context, async (page) => {
        const coins = await readPulse(page, pw, 'SCREENER');
        if (!coins) {
            log('SCREENER', 'Pulse tidak terbaca setelah 3 percobaan, siklus dilewati');
            return;
        }
        log('SCREENER', `${coins.length} coin terbaca dari kolom Migrated`);
        for (const [i, coin] of coins.entries()) {
            const { row, holders } = await scrapeCoin(page, pw, coin, pw.screenerMinHolders, 'SKIP_HOLDER');
            row.ts = nowTs();
            appendRow(file, row);
            log('SCREENER', `${i + 1}/${coins.length} ${coin.name} | holders=${holders} | mcap=${row.aMcap} | ${row.status}`);
        }
    });

    log('SCREENER', `Selesai dalam ${Math.round((Date.now() - t0) / 1000)} dtk -> ${path.basename(file)}`);
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

    await withPage(context, async (page) => {
        for (const [i, coin] of coins.entries()) {
            const { row, holders } = await scrapeCoin(page, pw, coin, pw.watcherMinHolders, 'DROP_HOLDER');
            row.ts = nowTs();
            appendRow(file, row);
            log('WATCHER', `${i + 1}/${coins.length} ${coin.name} | holders=${holders} | mcap=${row.aMcap} | ${row.status}`);
        }
    });

    log('WATCHER', `Selesai dalam ${Math.round((Date.now() - t0) / 1000)} dtk -> ${path.basename(file)}`);
    return coins.length;
}

module.exports = { runScreener, runWatcher };
