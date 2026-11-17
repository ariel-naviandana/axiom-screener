# axiom-screener

Bot Axiom berbasis Playwright: satu Chrome untuk dua tugas, masing-masing di tab sendiri.
- **Screener**: cron (`screenerSchedule`), membaca top N coin kolom Migrated di Axiom Pulse.
- **Watcher**: loop, membaca semua coin di `axiom_watchlist.csv` (dibuat workflow n8n).

Setiap coin dibaca lengkap (statistik Axiom + GMGN + candle migrasi) lalu dicatat ke CSV;
semua filter dan notifikasi Telegram ada di n8n.

## Setup
1. `copy config.example.json config.json`, lalu sesuaikan (lihat Pengaturan).
2. `npm install`
3. `npm run login` sekali saja: login Axiom & GMGN di jendela yang terbuka, lalu tutup jendelanya.

## Menjalankan
```
npm start             screener + watcher
npm run screener      screener saja
npm run watcher       watcher saja
npm run login         login Axiom & GMGN (bot harus sedang tidak jalan)
```

## Struktur
```
src/
├─ index.js            titik masuk (mode: kosong | screener | watcher | login)
├─ runner.js           jadwal cron screener, loop watcher, shutdown
├─ login.js            buka Chrome profil bot untuk login manual
├─ core/
│  ├─ config.js        baca config.json (bagian "playwright") + nilai bawaan
│  ├─ browser.js       buka Chrome (persistent context, profil bot)
│  ├─ util.js          waktu WIB, log, parsing angka
│  ├─ csv.js           urutan kolom & tulis baris CSV
│  └─ guard.js         batas waktu & pengaman macet
├─ scrape/
│  ├─ pulse.js         top N kolom Migrated
│  ├─ axiom.js         statistik detail Axiom
│  ├─ gmgn.js          statistik GMGN
│  ├─ migcandle.js     candle migrasi (data chart Axiom + waktu migrasi DexScreener)
│  └─ coin.js          satu coin: Axiom + GMGN + status
└─ jobs/
   ├─ cycle.js         tab, batas waktu siklus/coin, tulis CSV (bersama)
   ├─ screener.js
   └─ watcher.js
config.example.json    template config.json (config.json tidak di-commit)
datasources/           template axiom_watchlist.csv
n8n/                   workflow n8n (tidak di-commit)
```

## Pengaturan (`config.json` -> `playwright`)
Semua key opsional, nilai bawaan ada di `src/core/config.js`.
- `userDataDir`: profil Chrome khusus bot (sesi login tersimpan di sini).
- `headless: true` lebih ringan, tapi lebih mudah terdeteksi anti-bot. Coba `false` dulu.
- `blockResources`: tidak memuat gambar/video/font untuk hemat CPU & RAM.
- `outputDir`, `watchlistPath`: folder CSV hasil dan lokasi watchlist.
- `topN`, `screenerSchedule`, `screenerRunOnStart`, `watcherIntervalMs`: jadwal & jumlah coin.
- Pengaman macet (tab hang / crash):
  - `coinTimeoutMs` (bawaan 3 mnt): satu coin lebih lama dari ini -> status `TIMEOUT`, tab diganti baru, lanjut coin berikutnya.
  - `screenerTimeoutMs` (bawaan 20 mnt): satu siklus screener lebih lama dari ini -> dihentikan paksa, jadwal berikutnya jalan lagi.
  - watcher: batas siklus = jumlah coin x `coinTimeoutMs` + `watcherTimeoutExtraMs` (bawaan 3 mnt).
  - Log "jadwal ini dilewati" menampilkan progres siklus yang sedang jalan (lama, coin ke berapa, langkah Axiom/GMGN).
- Candle migrasi (`migCandle`, bawaan aktif): saat detail Axiom dibuka, data candle chart ditangkap dari request
  `token-chart` Axiom; waktu migrasi dari DexScreener (waktu pair AMM dibuat, pair bonding curve di `migBondingDexes`
  dilewati). `migIntervalMin` (bawaan 5) = interval candle migrasi; candle 1 menit digabung kalau perlu.

## Output CSV
Nama file `axiom_screener_<waktu>.csv` / `axiom_watch_<waktu>.csv`, tanpa header, tanpa quoting.
Status: `OK` / `AXIOM_GAGAL` / `GMGN_GAGAL` / `ERROR` / `TIMEOUT` (coin macet, dihentikan). Nilai `-1` / `-` = tidak terbaca.

| row | isi |
|---|---|
| `row['3']` | Top 10 H. Axiom |
| `row['6']` | Insiders Axiom |
| `row['7']` | Bundlers Axiom |
| `row['9']` | holder (tab "Holders (n)", cadangan kotak statistik) |
| `row['23']` | Rug GMGN (`-1` kalau tidak ditampilkan GMGN) |
| `row['24']` | market cap Axiom |
| `row['25']` | status |
| `row['26']` | waktu migrasi (WIB) |
| `row['27']` | volume candle migrasi (USD) |
| `row['28']`-`row['31']` | open / high / low / close candle migrasi (market cap USD) |

Urutan lengkap kolom ada di `src/core/csv.js`.

## Status coin (n8n)
ACTIVE (lolos screener) → WATCH (tidak lolos lagi / >15 menit) → DROPPED (holder < 500).
WATCH/DROPPED yang lolos screener lagi kembali ACTIVE.
