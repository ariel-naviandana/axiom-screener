// watcher.js — Script 2
// Jalankan macro axiom_watcher untuk coin di axiom_watchlist.csv
// Interval fleksibel: minimal minIntervalMs (default 5 menit). Kalau satu run lebih lama,
// run berikutnya mulai setelah run sebelumnya selesai (+ minGapMs).
// Pakai profil Chrome terpisah (--user-data-dir), jadi tidak bentrok dengan screener.
const fs = require('fs');
const { loadConfig } = require('./lib/config');
const { killChrome, isChromeRunning, launchChrome } = require('./lib/chrome-bot');

const cfg = loadConfig();
const W = cfg.watcher;
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
    log(`>>> MENJALANKAN ${W.macroName}: ${n} coin | estimasi ${fmt(estMs)} | batas ${fmt(hardTimeout)}`);

    // 1. Matikan Chrome watcher lama saja (Chrome screener tidak disentuh)
    const killed = await killChrome({ only: W.profileDir });
    if (killed) log(`${killed} Chrome watcher lama dimatikan`);
    await sleep(cfg.killWaitMs);

    // 2. Buka Chrome watcher
    const start = Date.now();
    const url = `${cfg.uivisionHtml}?macro=${W.macroName}&direct=1&closeRPA=1&closeBrowser=1&storage=xfile`;
    const err = await launchChrome({ url, userDataDir: W.profileDir });
    if (err) {
        log(`Error membuka Chrome: ${err.message}`);
        return W.idleCheckMs;
    }

    // 3. Tunggu Chrome muncul
    let started = false;
    while (Date.now() - start < W.startTimeoutMs) {
        if (await isChromeRunning(W.profileDir)) { started = true; break; }
        await sleep(2000);
    }
    if (!started) {
        log('Chrome watcher tidak terdeteksi berjalan');
        return W.idleCheckMs;
    }

    // 4. Tunggu macro selesai (closeBrowser=1 menutup Chrome) atau kena batas waktu
    let finished = false;
    while (Date.now() - start < hardTimeout) {
        await sleep(W.pollMs);
        if (!(await isChromeRunning(W.profileDir))) { finished = true; break; }
    }
    const elapsed = Date.now() - start;

    if (!finished) {
        log(`Run melewati batas ${fmt(hardTimeout)}, Chrome watcher dimatikan`);
        await killChrome({ only: W.profileDir });
    } else {
        const actualPerCoin = Math.max(20000, (elapsed - W.baseOverheadMs) / n);
        perCoinMs = Math.round(perCoinMs * 0.5 + actualPerCoin * 0.5);
        log(`Selesai dalam ${fmt(elapsed)} (~${Math.round(actualPerCoin / 1000)} dtk/coin)`);
    }

    return Math.max(W.minGapMs, W.minIntervalMs - elapsed);
}

(async () => {
    console.log('='.repeat(50));
    console.log('✅ WATCHER AKTIF');
    console.log(`   Macro     : ${W.macroName}`);
    console.log(`   Profil    : ${W.profileDir}`);
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
