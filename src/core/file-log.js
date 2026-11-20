// src/core/file-log.js — salin semua log terminal ke CSV harian di folder output
//   file : <prefix>_YYYY-MM-DD.csv (tanggal WIB, ganti file otomatis lewat tengah malam)
//   kolom: ts, tag, level, message
//     tag   = isi [..] pertama setelah waktu (mis. BUY, SCREENER, WATCHER), kosong kalau tidak ada
//     level = dari warna log (info / ok / warn / err); console.error -> err
// Log sebelum folder output diketahui (mis. "Config dibaca") ditampung dulu, ditulis saat setLogDir().
// Diatur dari config: terminalLog (true/false) dan terminalLogPrefix (awal nama file).
const fs = require('fs');
const path = require('path');
const nodeUtil = require('util');
const { nowTs } = require('./util');

const ANSI = /\x1b\[[0-9;]*m/g;
const LEVEL = { 36: 'info', 32: 'ok', 33: 'warn', 31: 'err' };
const HEADER = 'ts,tag,level,message\n';
const q = (v) => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

let dir = null;
let prefix = 'log';
let pending = [];
let failed = false;
let disabled = false;

function rowsOf(raw, isErr) {
    const s = String(raw);
    const code = (s.match(/^\x1b\[(\d+)m/) || [])[1];
    const level = isErr ? 'err' : (LEVEL[code] || '');
    const rows = [];
    for (const line of s.replace(ANSI, '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        let ts = nowTs();
        let rest = line.trim();
        const m = rest.match(/^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\]\s*(.*)$/);
        if (m) [, ts, rest] = m;
        let tag = '';
        const t = rest.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (t) [, tag, rest] = t;
        rows.push({ ts, tag, level, msg: rest });
    }
    return rows;
}

function writeRows(rows) {
    if (!rows.length) return;
    try {
        fs.mkdirSync(dir, { recursive: true });
        const byFile = {};
        for (const r of rows) {
            const f = path.join(dir, `${prefix}_${r.ts.slice(0, 10)}.csv`);
            (byFile[f] = byFile[f] || []).push([r.ts, r.tag, r.level, r.msg].map(q).join(','));
        }
        for (const [f, lines] of Object.entries(byFile)) {
            const head = fs.existsSync(f) ? '' : HEADER;
            fs.appendFileSync(f, head + lines.join('\n') + '\n', 'utf8');
        }
        failed = false;
    } catch (e) {
        if (!failed) process.stderr.write(`Gagal menulis log CSV ke ${dir}: ${e.message}\n`);
        failed = true; // pesan gagal cukup sekali, terminal tidak dibanjiri
    }
}

function capture(raw, isErr) {
    if (disabled) return;
    const rows = rowsOf(raw, isErr);
    if (dir) writeRows(rows);
    else if (pending.length < 1000) pending.push(...rows);
}

// Pasang sekali di awal program: console.log / console.error tetap tampil di terminal, sekaligus dicatat
function installFileLog(filePrefix) {
    if (filePrefix) prefix = filePrefix;
    for (const [name, isErr] of [['log', false], ['info', false], ['warn', false], ['error', true]]) {
        const orig = console[name].bind(console);
        console[name] = (...args) => {
            orig(...args);
            capture(nodeUtil.format(...args), isErr);
        };
    }
}

// Folder tujuan (folder output) + opsi dari config. Boleh dipanggil ulang kalau config berubah.
//   opts.enabled = false -> log tidak disimpan ke CSV; opts.prefix -> awal nama file
function setLogDir(d, opts = {}) {
    disabled = opts.enabled === false;
    if (disabled) {
        pending = [];
        return;
    }
    if (opts.prefix && String(opts.prefix).trim()) prefix = String(opts.prefix).trim();
    if (!d) return;
    dir = d;
    const rows = pending;
    pending = [];
    writeRows(rows);
}

module.exports = { installFileLog, setLogDir };
