// lib/config.js
// Baca config.json dari folder exe (kalau dijalankan sebagai .exe) atau folder project
const fs = require('fs');
const path = require('path');

const isExe = path.basename(process.execPath).toLowerCase() !== 'node.exe'
    && path.basename(process.execPath).toLowerCase() !== 'node';
const BASE_DIR = isExe ? path.dirname(process.execPath) : path.join(__dirname, '..');

const defaults = {
    uivisionHtml: 'file:///C:/coding/axiom-screener-bot/uivision.html',
    timezone: 'Asia/Jakarta',
    killWaitMs: 3000,
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    screener: {
        macroName: 'axiom_screener',
        schedule: '0,10,20,30,40,50 * * * *',
        runOnStart: false,
        profileDir: '', // --user-data-dir. kosong = User Data default Chrome
        profileDirectory: '', // --profile-directory, mis. "Profile 2". kosong = Default
    },
    watcher: {
        macroName: 'axiom_watcher',
        profileDir: 'C:\\chrome-bot\\watcher', // wajib terpisah (dipakai untuk deteksi selesai)
        profileDirectory: '',
        watchlistPath: 'C:\\uivision\\datasources\\axiom_watchlist.csv',
        minIntervalMs: 5 * 60 * 1000,
        minGapMs: 30 * 1000,
        idleCheckMs: 60 * 1000,
        startTimeoutMs: 60 * 1000,
        pollMs: 10 * 1000,
        baseOverheadMs: 60 * 1000,
        perCoinMsInitial: 50 * 1000,
    },
};

function loadConfig() {
    const configPath = path.join(BASE_DIR, 'config.json');
    let user = {};
    try {
        user = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(`Config dibaca dari: ${configPath}`);
    } catch {
        console.log(`config.json tidak ditemukan/rusak di ${configPath}, pakai nilai bawaan`);
    }
    return {
        ...defaults,
        ...user,
        screener: { ...defaults.screener, ...(user.screener || {}) },
        watcher: { ...defaults.watcher, ...(user.watcher || {}) },
    };
}

module.exports = { loadConfig, BASE_DIR };
