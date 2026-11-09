// lib/config.js
// Baca config.json dari folder exe (kalau dijalankan sebagai .exe) atau folder project
const fs = require('fs');
const path = require('path');

const isExe = path.basename(process.execPath).toLowerCase() !== 'node.exe'
    && path.basename(process.execPath).toLowerCase() !== 'node';
const BASE_DIR = isExe ? path.dirname(process.execPath) : path.join(__dirname, '..');

const defaults = {
    uivisionHtml: 'file:///C:/coding/axiom-screener/uivision.html',
    timezone: 'Asia/Jakarta',
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    screener: {
        macroName: 'axiom_screener',
        schedule: '0,10,20,30,40,50 * * * *',
        runOnStart: false,
        profileDirectory: 'Axiom Screener', // --profile-directory (folder profil di User Data Chrome)
    },
    watcher: {
        macroName: 'axiom_watcher',
        profileDirectory: 'Axiom Watcher',
        watchlistPath: 'C:\\uivision\\datasources\\axiom_watchlist.csv',
        minIntervalMs: 5 * 60 * 1000,   // jarak minimal antar mulai run
        minGapMs: 30 * 1000,            // jeda minimal setelah run selesai
        idleCheckMs: 60 * 1000,         // cek ulang kalau watchlist kosong
        pollMs: 5 * 1000,               // cek file penanda selesai
        baseOverheadMs: 60 * 1000,      // perkiraan waktu buka Chrome + UI.Vision
        perCoinMsInitial: 50 * 1000,    // estimasi awal per coin
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
