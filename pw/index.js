// pw/index.js — Axiom Screener + Watcher versi Playwright
// Satu Chrome untuk dua tugas, masing-masing di tab sendiri:
//   - screener : cron (default tiap 10 menit), top N kolom Migrated di Pulse
//   - watcher  : loop, coin di axiom_watchlist.csv, jeda minimal watcherIntervalMs
// Output CSV sama persis dengan versi UI.Vision, jadi workflow n8n tidak berubah.
const cron = require('node-cron');
const { loadPwConfig } = require('./config');
const { openBrowser } = require('./browser');
const { runScreener, runWatcher } = require('./jobs');
const { log, sleep } = require('./util');

const pw = loadPwConfig();
const only = process.argv[2]; // "screener" | "watcher" | undefined (dua-duanya)

(async () => {
    console.log('='.repeat(50));
    console.log('✅ AXIOM BOT (Playwright) AKTIF');
    console.log(`   Mode     : ${only || 'screener + watcher'}`);
    console.log(`   Chrome   : ${pw.chromePath}`);
    console.log(`   Profil   : ${pw.userDataDir}`);
    console.log(`   Headless : ${pw.headless ? 'ya' : 'tidak'}`);
    console.log(`   Output   : ${pw.outputDir}`);
    console.log('='.repeat(50));

    const context = await openBrowser(pw);
    // Tab bawaan dibiarkan terbuka sebagai penjaga: kalau semua tab tertutup,
    // Chrome (mode berjendela) ikut menutup dan bot berhenti.
    const keepAlive = context.pages()[0] || await context.newPage();
    await keepAlive.goto('about:blank').catch(() => {});

    // Kalau browser tertutup (mis. jendela ditutup manual), hentikan bot dengan jelas
    context.on('close', () => {
        log('BOT', 'Browser tertutup, bot berhenti. Jalankan ulang: npm run pw');
        process.exit(1);
    });

    // ---- Screener ----
    if (!only || only === 'screener') {
        let busy = false;
        const tick = async () => {
            if (busy) {
                log('SCREENER', 'Siklus sebelumnya belum selesai, jadwal ini dilewati');
                return;
            }
            busy = true;
            try {
                await runScreener(context, pw);
            } catch (e) {
                log('SCREENER', `Error: ${e.message}`);
            } finally {
                busy = false;
            }
        };
        cron.schedule(pw.screenerSchedule, tick, { timezone: 'Asia/Jakarta' });
        log('SCREENER', `Jadwal: ${pw.screenerSchedule}`);
        if (pw.screenerRunOnStart) tick();
    }

    // ---- Watcher ----
    if (!only || only === 'watcher') {
        (async () => {
            while (true) {
                const t0 = Date.now();
                let n = 0;
                try {
                    n = await runWatcher(context, pw);
                } catch (e) {
                    log('WATCHER', `Error: ${e.message}`);
                }
                const wait = n === 0
                    ? pw.watcherIdleMs
                    : Math.max(pw.watcherMinGapMs, pw.watcherIntervalMs - (Date.now() - t0));
                log('WATCHER', `Run berikutnya dalam ${Math.round(wait / 1000)} dtk`);
                await sleep(wait);
            }
        })();
    }

    const shutdown = async () => {
        log('BOT', 'Menutup browser...');
        await context.close().catch(() => {});
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
})().catch((e) => {
    console.error('Gagal start:', e);
    process.exit(1);
});
