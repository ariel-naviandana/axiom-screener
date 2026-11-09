# axiom-screener-bot

Dua scheduler UI.Vision yang jalan bersamaan di satu laptop:

| Script | Macro | Chrome | Jadwal |
|---|---|---|---|
| `screener.js` (script 1) | `axiom_screener` | profil default | cron, default tiap 10 menit |
| `watcher.js` (script 2) | `axiom_watcher` | `--user-data-dir=C:\chrome-bot\watcher` | min 5 menit, menyesuaikan jumlah coin |

Masing-masing hanya mematikan Chrome miliknya sendiri (`lib/chrome-bot.js`).

## Struktur
```
config.example.json  template pengaturan; salin jadi config.json (tidak di-commit)
screener.js          script 1
watcher.js           script 2
lib/chrome-bot.js    launch / kill Chrome per profil
lib/config.js        loader config
uivision.html        halaman autostart UI.Vision
macros/              axiom_screener.json, axiom_watcher.json
n8n/                 workflow n8n WF1-WF3 (lokal saja, tidak di-commit)
build-exe.txt        langkah build 2 exe
```

## Menjalankan
```
copy config.example.json config.json   (lalu sesuaikan)
npm install
npm run screener     (terminal 1)
npm run watcher      (terminal 2)
```

## Setup sekali
1. Profil Chrome watcher: `chrome --user-data-dir="C:\chrome-bot\watcher"`, install UI.Vision + XModules,
   aktifkan "Allow access to file URLs", storage hard drive dengan root folder `C:\uivision`,
   login Axiom & GMGN.
2. Macro `axiom_watcher.json` ada di `C:\uivision\macros` (salinan di `macros/`).
3. `C:\uivision\datasources\axiom_watchlist.csv` (header `ca,name`) harus ter-sync ke Drive;
   file ID-nya dipakai node "Update watchlist di Drive" di WF2.
4. n8n: buat Data Table "Axiom Tracked Coins" (string: ca, name, status, first_sent, last_ok_at,
   watch_since, last_checked; number: last_holders, peak_holders) dan "Last Run Axiom Watcher"
   (string: lastRun, satu baris `2000-01-01 00:00:00`). Import WF2 & WF3, paste node WF1,
   sambungkan output true `If2` ke "Get tracked (screener)", pilih ulang tabel di node Data Table.

## Status coin
ACTIVE (lolos screener) → WATCH (tidak lolos lagi / >15 menit) → DROPPED (holder < 500).
WATCH/DROPPED yang lolos screener lagi kembali ACTIVE.

## Config per laptop
- `screener.profileDir`: kosong = profil Chrome default (laptop scraping 24 jam).
  Diisi (mis. `C:\chrome-bot\screener`) = profil terpisah, Chrome pribadi tidak ikut dimatikan.
- `watcher.minIntervalMs`: jeda minimal antar run watcher (default 5 menit).
