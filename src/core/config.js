// src/core/config.js — baca config.json (bagian "playwright") dari folder exe atau folder project
// config.json tidak di-commit; template: config.example.json. Key di luar "playwright" diabaikan,
// kecuali chromePath di level atas (kompatibel dengan config lama).
const fs = require('fs');
const path = require('path');

const isExe = !['node.exe', 'node'].includes(path.basename(process.execPath).toLowerCase());

// Folder project = folder pertama (naik dari file ini) yang berisi package.json
function projectDir() {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return path.join(__dirname, '..', '..');
}
const BASE_DIR = isExe ? path.dirname(process.execPath) : projectDir();

const defaults = {
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: 'C:\\chrome-profiles\\axiom-playwright', // profil khusus bot (login sekali)
    headless: false,          // true lebih ringan, tapi lebih mudah dicegat anti-bot
    blockResources: true,     // jangan muat gambar/video/font
    viewport: null,           // null = ikut ukuran jendela (maximize); isi { width, height } untuk ukuran tetap
    outputDir: 'C:\\uivision\\datasources',
    terminalLog: true,        // log terminal ikut disimpan ke CSV harian di outputDir
    terminalLogPrefix: 'axiom_log', // nama file: <prefix>_YYYY-MM-DD.csv
    watchlistPath: 'C:\\uivision\\datasources\\axiom_watchlist.csv',

    axiomPulseUrl: 'https://axiom.trade/pulse?chains=sol,robinhood,arc,bnb,ink,hype,base,eth&pulseChains=sol&trackerChains=sol,robinhood,arc,bnb,ink,hype,base,eth&discoverChains=sol,robinhood,arc,bnb,ink,hype,base,eth',
    axiomMemeUrl: 'https://axiom.trade/meme/',
    // XPath market cap di header detail Axiom (mis. "$33.7K"), dicoba berurutan.
    // Utama: blok tepat sebelum blok berlabel "Price". Cadangan: angka besar (18px) pertama yang berisi "$".
    axiomMcapXpath: [
        "(//div[span[normalize-space(.)='Price']]/preceding-sibling::div[1]//span[contains(@class,'text-[18px]')])[1]",
        "(//span[contains(@class,'text-[18px]') and contains(.,'$')])[1]",
    ],
    // Global Fees Paid di header detail: dicari lewat label; XPath ini cadangan kalau label tidak ketemu
    axiomFeesXpath: '',
    gmgnTokenUrl: 'https://gmgn.ai/sol/token/',

    // Filter awal screener -> status SKIP (watcher tidak difilter). Nilai -1 (tidak terbaca) tidak di-skip.
    filter: {
        enabled: true,
        minHolders: 400,    // holder di baris Pulse; kurang -> detail tidak dibuka
        minMigVol: 50000,   // volume candle migrasi (USD); kurang -> statistik lain & GMGN tidak dicatat
        maxTop10: 30,       // Top 10 H. Axiom (%)
        maxBundler: 30,     // Bundlers Axiom (%)
        maxInsider: 10,     // Insiders Axiom (%); salah satu lewat -> GMGN tidak dibuka
    },

    // Tabel Pulse (layout "Migrated only": satu tabel). Tabel role="grid" pertama yang berisi coin.
    pulseGridXpath: "(//div[@role='grid'][.//*[@data-pulse-token-address]])[1]",
    topN: 10,
    scrollStep: 600,
    // Tidak ada filter di program: semua coin dibaca lengkap (Axiom + GMGN), filter dinilai di n8n.
    screenerSchedule: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
    screenerRunOnStart: true,

    watcherIntervalMs: 5 * 60 * 1000, // jarak minimal antar mulai run watcher
    watcherMinGapMs: 30 * 1000,
    watcherIdleMs: 60 * 1000,         // cek ulang kalau watchlist kosong

    timeoutMs: 15000,
    navTimeoutMs: 45000,
    pulseWaitMs: 20000,
    detailWaitMs: 20000,
    gmgnWaitMs: 20000,
    axiomSettleMs: 1500,  // jeda setelah detail Axiom termuat
    gmgnSettleMs: 5000,   // jeda setelah statistik GMGN muncul (macro: 10 dtk)

    // Candle migrasi: data candle ditangkap dari chart Axiom (token-chart), waktu migrasi dari DexScreener
    // (waktu pair AMM dibuat). Hasil: kolom migAt, migVol, lastVol.
    migCandle: true,
    migIntervalMin: 5,       // interval candle migrasi (menit), samakan dengan chart yang kamu lihat
    migChartWaitMs: 10000,   // tunggu data chart tertangkap setelah detail terbuka
    migApiTimeoutMs: 10000,  // batas waktu request DexScreener
    migApiRetries: 1,        // coba ulang request DexScreener kalau gagal
    migBondingDexes: ['pumpfun', 'launchlab', 'meteoradbc', 'moonshot', 'boop', 'believe'], // pair bonding curve, bukan migrasi

    // Pengaman macet (tab hang / crash). Normal satu coin ~40-55 dtk.
    coinTimeoutMs: 3 * 60 * 1000,      // batas satu coin (Axiom + GMGN); lewat = status TIMEOUT, tab diganti baru
    screenerTimeoutMs: 20 * 60 * 1000, // batas satu siklus screener; lewat = dihentikan paksa, jadwal berikutnya jalan
    // batas satu siklus watcher = jumlah coin x coinTimeoutMs + watcherTimeoutExtraMs
    watcherTimeoutExtraMs: 3 * 60 * 1000,
};

function loadPwConfig() {
    const file = path.join(BASE_DIR, 'config.json');
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(file, 'utf-8'));
        console.log(`Config dibaca dari: ${file}`);
    } catch {
        console.log(`config.json tidak ditemukan/rusak di ${file}, pakai nilai bawaan`);
    }
    const user = cfg.playwright || {};
    const pw = { ...defaults, ...user, filter: { ...defaults.filter, ...(user.filter || {}) } };
    if (cfg.chromePath && !user.chromePath) pw.chromePath = cfg.chromePath;
    return pw;
}

module.exports = { loadPwConfig, BASE_DIR };
