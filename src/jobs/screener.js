// src/jobs/screener.js — screener: top N kolom Migrated di Pulse, setiap coin dibaca lengkap
const path = require('path');
const { readPulse } = require('../scrape/pulse');
const { fileTs, log } = require('../core/util');
const { withTimeout } = require('../core/guard');
const { guardedCycle, scrapeList } = require('./cycle');

const PULSE_TIMEOUT_MS = 5 * 60 * 1000;

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

module.exports = { runScreener };
