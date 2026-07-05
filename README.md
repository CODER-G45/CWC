# CWC Daily Discharge Data Sheet

A single-file, offline-first web tool for recording river discharge gauging data (station details, instrument/method, water & weather conditions, gauge readings, cross-section velocity table, and salient data), with built-in save, backup, and PDF export.

No installation, no backend, no build step — it's one HTML file that runs entirely in your browser.

## Features

- 📋 Structured entry form covering station/site info, instrument & method, water & weather conditions, gauge readings, cross-section velocity table, and computed salient data
- 💾 **Save entry** — stores the entry locally in your browser and automatically downloads a JSON copy to your Downloads folder
- 📂 **Saved entries** — view, reload, re-export, or delete previously saved entries (stored in the browser you're using)
- 📄 **Export PDF** — generates a clean, 2-page print-ready sheet (opens the browser print dialog — choose "Save as PDF")
- 🗂️ **Export JSON** — download the current entry as a standalone `.json` file, easy to email or archive
- 📥 **Import JSON** — load a previously exported entry (or a full backup bundle) back into the app
- 🗄️ **Backup all** — download every saved entry as one JSON bundle, for periodic archiving

## Getting Started

1. Download `vol4.html` from this repo (or clone the repo).
2. Open it directly in any modern browser (Chrome, Edge, or Firefox) by double-clicking it — no server required.
3. Fill in the form and click **Save entry**.

### Optional: host it online

Since it's a static HTML file, you can also serve it via GitHub Pages:

1. In your repo settings, enable **GitHub Pages** for the branch containing `vol4.html`.
2. Rename it to `index.html` (or link directly to `vol4.html` in the Pages URL) if you want it as your site's home page.
3. Visit the published URL — the tool works the same way, just hosted instead of local.

## How data is stored

This tool has no server and no database — everything happens in your browser:

- **Saved entries** are stored in your browser's local storage, scoped to that browser on that device. They will **not** appear if you open the file in a different browser or on another computer.
- **Save entry** also downloads a `.json` file to your Downloads folder — treat these downloaded files as your real, portable backup, since they aren't tied to any one browser.
- **Backup all** bundles every saved entry into a single JSON file for archiving — use it periodically, especially before clearing browser data or switching machines.
- **Import JSON** accepts either a single entry file or a "Backup all" bundle, so you can move entries between browsers/computers.

## Sharing an entry

- Send someone the exported **JSON** file if they need the raw structured data (e.g. to import into another instance of this tool).
- Send someone the exported **PDF** if they just need a readable, printable record.

## File structure

```
vol4.html   → the entire application (HTML, CSS, and JavaScript in one file)
README.md   → this file
```

## Browser support

Works best in Chromium-based browsers (Chrome, Edge) and Firefox. Requires JavaScript enabled. No internet connection needed after the page loads (all fonts/assets are self-contained or optional).

## License

Add your preferred license here (e.g. MIT) before publishing, if you want others to reuse or modify this tool.
