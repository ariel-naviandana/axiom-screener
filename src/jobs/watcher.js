// src/jobs/watcher.js — watcher: semua coin di axiom_watchlist.csv
const fs = require('fs');
const path = require('path');
const { fileTs, log } = require('../core/util');
const { guardedCycle, scrapeList } = require('./cycle');

const CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

module.exports = { runWatcher };
