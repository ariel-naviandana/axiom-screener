// src/core/csv.js — urutan kolom & tulis baris CSV (format sama dengan versi UI.Vision, tanpa quoting)
const fs = require('fs');
const path = require('path');

// Nilai aman untuk CSV tanpa quoting (macro juga tidak memakai quoting)
const cell = (v) => String(v ?? '').replace(/[,\r\n"]/g, ' ').trim();

// Urutan kolom CSV (index = row['n'] di n8n)
const COLUMNS = [
    'ts', 'name', 'ca', 'aTop10', 'aDev', 'aSnipers', 'aInsiders', 'aBundlers', 'aLpBurned', 'aHolders',
    'aProTraders', 'aDexPaid', 'gTop10', 'gDev', 'gHolders', 'gSnipers', 'gInsiders', 'gPhishing', 'gBundler',
    'gDexPaid', 'gNoMint', 'gNoBlacklist', 'gBurnt', 'gRug',
    'aMcap',  // row['24'] di n8n: market cap Axiom (USD), -1 kalau tidak terbaca
    'status', // row['25'] di n8n: OK / AXIOM_GAGAL / GMGN_GAGAL / ERROR / TIMEOUT
    // candle migrasi (config migCandle), '-' / -1 kalau tidak terbaca
    'migAt',  // row['26'] waktu migrasi (WIB)
    'migVol', // row['27'] volume candle migrasi (USD)
    'migO', 'migH', 'migL', 'migC', // row['28'-'31'] open/high/low/close candle migrasi (market cap USD)
];

// Tulis satu baris (append) ke file CSV
function appendRow(filePath, row) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const line = COLUMNS.map((c) => cell(row[c])).join(',') + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
}

module.exports = { appendRow, COLUMNS };
