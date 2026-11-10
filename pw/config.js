// pw/config.js — pengaturan versi Playwright, diambil dari bagian "playwright" di config.json
const { loadConfig } = require('../lib/config');

const defaults = {
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: 'C:\\chrome-profiles\\axiom-playwright', // profil khusus bot (login sekali)
    headless: false,          // true lebih ringan, tapi lebih mudah dicegat anti-bot
    blockResources: true,     // jangan muat gambar/video/font
    outputDir: 'C:\\uivision\\datasources',
    watchlistPath: 'C:\\uivision\\datasources\\axiom_watchlist.csv',

    axiomPulseUrl: 'https://axiom.trade/pulse?chains=sol,robinhood,arc,bnb,ink,hype,base,eth&pulseChains=sol&trackerChains=sol,robinhood,arc,bnb,ink,hype,base,eth&discoverChains=sol,robinhood,arc,bnb,ink,hype,base,eth',
    axiomMemeUrl: 'https://axiom.trade/meme/',
    // XPath market cap di header detail Axiom (mis. "$33.7K"), dicoba berurutan.
    // Utama: blok tepat sebelum blok berlabel "Price". Cadangan: angka besar (18px) pertama yang berisi "$".
    axiomMcapXpath: [
        "(//div[span[normalize-space(.)='Price']]/preceding-sibling::div[1]//span[contains(@class,'text-[18px]')])[1]",
        "(//span[contains(@class,'text-[18px]') and contains(.,'$')])[1]",
    ],
    gmgnTokenUrl: 'https://gmgn.ai/sol/token/',

    topN: 10,
    scrollStep: 600,
    screenerMinHolders: 800,
    watcherMinHolders: 500,
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
};

function loadPwConfig() {
    const cfg = loadConfig();
    const pw = { ...defaults, ...(cfg.playwright || {}) };
    if (cfg.chromePath && !(cfg.playwright || {}).chromePath) pw.chromePath = cfg.chromePath;
    return pw;
}

module.exports = { loadPwConfig };
