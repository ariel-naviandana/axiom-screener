# axiom-screener

Bot Axiom berbasis Playwright: satu Chrome untuk dua tugas, masing-masing di tab sendiri.
- **Screener**: cron (`screenerSchedule`), membaca top N coin tabel Migrated di Axiom Pulse (layout "Migrated only").
- **Watcher**: loop, membaca semua coin di `axiom_watchlist.csv` (dibuat workflow n8n).

Setiap coin dicatat ke CSV (statistik Axiom + GMGN + candle migrasi). Screener punya filter awal (status `SKIP`)
supaya coin yang jelas tidak lolos tidak perlu dibuka; filter lengkap dan notifikasi Telegram tetap di n8n.

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
- `pulseGridXpath`: tabel Pulse yang dibaca (bawaan: tabel pertama; layout Pulse "Migrated only").
- `topN`, `screenerSchedule`, `screenerRunOnStart`, `watcherIntervalMs`: jadwal & jumlah coin.
- Filter awal screener (`filter`, watcher tidak difilter) -> status `SKIP`, supaya lebih cepat:
  1. holder di baris Pulse < `minHolders` (400): detail Axiom & GMGN tidak dibuka.
  2. volume candle migrasi < `minMigVol` (50000): statistik Axiom lain & GMGN tidak dicatat.
  3. Top 10 > `maxTop10` (30) / Bundler > `maxBundler` (30) / Insider > `maxInsider` (10): statistik Axiom dicatat, GMGN tidak dibuka.
  Nilai yang tidak terbaca (-1) tidak membuat coin di-skip. `filter.enabled: false` mematikan semua filter.
- Pengaman macet (tab hang / crash):
  - `coinTimeoutMs` (bawaan 3 mnt): satu coin lebih lama dari ini -> status `TIMEOUT`, tab diganti baru, lanjut coin berikutnya.
  - `screenerTimeoutMs` (bawaan 20 mnt): satu siklus screener lebih lama dari ini -> dihentikan paksa, jadwal berikutnya jalan lagi.
  - watcher: batas siklus = jumlah coin x `coinTimeoutMs` + `watcherTimeoutExtraMs` (bawaan 3 mnt).
  - Log "jadwal ini dilewati" menampilkan progres siklus yang sedang jalan (lama, coin ke berapa, langkah Axiom/GMGN).
- Candle migrasi (`migCandle`, bawaan aktif): saat detail Axiom dibuka, data candle chart ditangkap dari request
  `token-chart` Axiom; waktu migrasi dari DexScreener (waktu pair AMM dibuat, pair bonding curve di `migBondingDexes`
  dilewati). `migIntervalMin` (bawaan 5) = interval candle migrasi & candle terbaru; candle 1 menit digabung kalau perlu.

## Output CSV
Nama file `axiom_screener_<waktu>.csv` / `axiom_watch_<waktu>.csv`, tanpa header, tanpa quoting.
Status: `OK` / `AXIOM_GAGAL` / `GMGN_GAGAL` / `ERROR` / `TIMEOUT` (coin macet, dihentikan) / `SKIP` (tidak lolos filter awal). Nilai `-1` / `-` = tidak terbaca.

| row | isi |
|---|---|
| `row['0']`-`row['2']` | waktu, nama, CA |
| `row['3']`-`row['11']` | Axiom: Top 10, Dev, Snipers, Insiders, Bundlers, LP Burned, holder, Pro Traders, Dex Paid |
| `row['12']`-`row['22']` | GMGN: Top 10, Dev, holder, Snipers, Insiders, Phishing, Bundler, Dex Paid, NoMint, No Blacklist, Burnt |
| `row['23']` | market cap Axiom |
| `row['24']` | waktu migrasi (WIB) |
| `row['25']` | volume candle migrasi (USD) |
| `row['26']` | volume candle terbaru (USD) |
| `row['27']` | akun X/Twitter coin (@...), dari baris Pulse |
| `row['28']` | jenis kartu X di baris Pulse: `post` / `profile` / `-` |
| `row['29']` | isi tweet (`post`) atau bio akun (`profile`) |
| `row['30']` | jumlah KOL (ikon piala) |
| `row['31']` | Global Fees Paid (SOL), header detail Axiom |
| `row['32']` | alasan `SKIP` (`-` kalau tidak di-skip) |
| `row['33']` | status |

Kolom 27-30 hanya terisi untuk screener (dibaca dari baris Pulse); watcher mengisi `-` / -1.
Urutan lengkap kolom ada di `src/core/csv.js`.

## Status coin (n8n)
ACTIVE (lolos screener) → WATCH (tidak lolos lagi / >15 menit) → DROPPED (holder < 500).
WATCH/DROPPED yang lolos screener lagi kembali ACTIVE.
