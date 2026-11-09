// watcher.js — Script 2
// Jalankan macro axiom_watcher untuk coin di axiom_watchlist.csv
// Chrome dibuka dengan profil watcher (--profile-directory), tanpa kill Chrome.
// Selesai-nya macro dideteksi lewat file penanda yang ditulis macro di akhir run:
//   <folder datasources>/axiom_watcher_done_<runId>.csv   (runId dikirim lewat cmd_var1)
// Interval fleksibel: minimal minIntervalMs. Kalau satu run lebih lama, run berikutnya
// mulai setelah run sebelumnya selesai (+ minGapMs).
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib/config');
const { launchChrome } = require('./lib/chrome');

const cfg = loadConfig();
const W = cfg.watcher;
const DATASOURCES = path.dirname(W.watchlistPath);
let perCoinMs = W.perCoinMsInitial; // diperbarui dari durasi nyata

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowWIB = () => new Date().toLocaleString('id-ID', { timeZone: cfg.timezone });
const log = (msg) => console.log(`[${nowWIB()}] ${msg}`);
const fmt = (ms) => `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;

// Hitung jumlah coin di watchlist (null = file belum ada / tidak terbaca)
function countCoins() {
    try {
        const lines = fs.readFileSync(W.watchlistPath, 'utf8').split(/\r?\n/).slice(1); // lewati header
        return lines.filter((l) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(l.split(',')[0].trim())).length;
    } catch {
        return null;
    }
}

async function runOnce() {
    const n = countCoins();
    if (n === null) {
        log('Watchlist belum ada / tidak terbaca, cek lagi nanti');
        return W.idleCheckMs;
    }
    if (n === 0) {
        log('Watchlist kosong, cek lagi nanti');
        return W.idleCheckMs;
    }

    const estMs = W.baseOverheadMs + n * perCoinMs;
    const hardTimeout = Math.max(estMs * 2, 5 * 60 * 1000);
    const runId = String(Date.now());
    const doneFile = path.join(DATASOURCES, `axiom_watcher_done_${runId}.csv`);
    log(`>>> MENJALANKAN ${W.macroName} (profil "${W.profileDirectory}"): ${n} coin | estimasi ${fmt(estMs)} | batas ${fmt(hardTimeout)}`);

    const start = Date.now();
    const url = `${cfg.uivisionHtml}?macro=${encodeURIComponent(W.macroName)}&direct=1&closeRPA=1&closeBrowser=1&storage=xfile&cmd_var1=${runId}`;
    const err = await launchChrome({ url, profileDirectory: W.profileDirectory, chromePath: cfg.chromePath });
    if (err) {
        log(`Error membuka Chrome: ${err.message}`);
        return W.idleCheckMs;
    }

    // Tunggu file penanda selesai dari macro, atau kena batas waktu
    let finished = false;
    while (Date.now() - start < hardTimeout) {
        await sleep(W.pollMs);
        if (fs.existsSync(doneFile)) { finished = true; break; }
    }
    const elapsed = Date.now() - start;

    if (finished) {
        try { fs.unlinkSync(doneFile); } catch { /* biarkan */ }
        const actualPerCoin = Math.max(20000, (elapsed - W.baseOverheadMs) / n);
        perCoinMs = Math.round(perCoinMs * 0.5 + actualPerCoin * 0.5);
        log(`Selesai dalam ${fmt(elapsed)} (~${Math.round(actualPerCoin / 1000)} dtk/coin)`);
    } else {
        log(`Run belum selesai setelah ${fmt(hardTimeout)} (macro macet atau gagal start). Lanjut ke run berikutnya`);
    }

    return Math.max(W.minGapMs, W.minIntervalMs - elapsed);
}

(async () => {
    console.log('='.repeat(50));
    console.log('✅ WATCHER AKTIF');
    console.log(`   Macro     : ${W.macroName}`);
    console.log(`   Profil    : ${W.profileDirectory}`);
    console.log(`   Watchlist : ${W.watchlistPath}`);
    console.log(`   Interval  : min ${fmt(W.minIntervalMs)}, menyesuaikan jumlah coin`);
    console.log('='.repeat(50));

    while (true) {
        let wait;
        try {
            wait = await runOnce();
        } catch (e) {
            log(`Error tak terduga: ${e.message}`);
            wait = W.idleCheckMs;
        }
        log(`Run berikutnya dalam ${fmt(wait)}`);
        await sleep(wait);
    }
})();
