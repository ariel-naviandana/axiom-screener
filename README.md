# axiom-screener

Dua scheduler UI.Vision yang jalan bersamaan di satu laptop, memakai Chrome default
dengan **profil berbeda** (`--profile-directory`):

| Script | Macro | Profil Chrome | Jadwal |
|---|---|---|---|
| `screener.js` (script 1) | `axiom_screener` | `Axiom Screener` | cron, default tiap 10 menit |
| `watcher.js` (script 2) | `axiom_watcher` | `Axiom Watcher` | min 5 menit, menyesuaikan jumlah coin |

Bot tidak mematikan Chrome sama sekali. Macro menutup jendelanya sendiri (`closeBrowser=1`),
jadi profil lain dan Chrome pribadi tidak terganggu. Watcher tahu run selesai dari file penanda
`axiom_watcher_done_<runId>.csv` yang ditulis macro di akhir run (runId dikirim lewat `cmd_var1`).

## Struktur
```
config.example.json  template pengaturan; salin jadi config.json (tidak di-commit)
screener.js          script 1
watcher.js           script 2
lib/chrome.js        buka chrome.exe (spawn) dengan --profile-directory
lib/config.js        loader config
uivision.html        halaman autostart UI.Vision
macros/              axiom_screener.json, axiom_watcher.json
datasources/         template axiom_watchlist.csv
build-exe.txt        langkah build 2 exe
```

## Setup
1. `copy config.example.json config.json`, lalu sesuaikan `uivisionHtml` (lokasi folder clone)
   dan `watcher.watchlistPath` (folder `datasources` UI.Vision yang ter-sync Google Drive).
2. `npm install`
3. Siapkan 2 profil Chrome (folder profil dibuat otomatis kalau belum ada):
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory="Axiom Screener"
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory="Axiom Watcher"
   ```
   Di masing-masing: install UI.Vision + XModules, aktifkan "Allow access to file URLs",
   storage hard drive dengan root folder UI.Vision yang sama, login Axiom & GMGN.
   Mau pakai profil yang sudah ada? Isi `profileDirectory` dengan nama foldernya
   (lihat `chrome://version` → Profile Path, mis. `Profile 2`).
4. Salin `macros/*.json` ke folder `macros` UI.Vision dan `datasources/axiom_watchlist.csv`
   ke folder `datasources` UI.Vision.

## Menjalankan
```
npm run screener     (terminal 1)
npm run watcher      (terminal 2)
```

## Status coin (n8n)
ACTIVE (lolos screener) → WATCH (tidak lolos lagi / >15 menit) → DROPPED (holder < 500).
WATCH/DROPPED yang lolos screener lagi kembali ACTIVE.

## Versi Playwright (tanpa UI.Vision)
Satu Chrome untuk screener + watcher (masing-masing di tab sendiri), lebih ringan daripada
dua UI.Vision. Output CSV identik (nama file & 25 kolom), jadi workflow n8n tidak berubah.
Pengaturan ada di bagian `playwright` pada `config.json`.

```
npm install
npm run pw:login      sekali saja: login Axiom & GMGN di jendela yang terbuka, lalu tutup
npm run pw            screener + watcher
npm run pw:screener   screener saja
npm run pw:watcher    watcher saja
```
- `userDataDir`: profil Chrome khusus bot (sesi login tersimpan di sini).
- `headless: true` lebih ringan, tapi lebih mudah terdeteksi anti-bot. Coba `false` dulu.
- `blockResources`: tidak memuat gambar/video/font untuk hemat CPU & RAM.
- Jangan jalankan versi UI.Vision dan Playwright bersamaan (output ke folder yang sama).
