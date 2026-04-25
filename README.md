# Sound Splitter (Local-Only)

Sound Splitter is a personal utility app that runs fully in your browser on your own computer.

- ✅ No backend
- ✅ No login
- ✅ No database
- ✅ No cloud upload
- ✅ Local audio processing only

## Features

- Upload a **single audio file** or a **folder of audio files**.
- Select one file at a time for editing.
- View waveform and playback with **WaveSurfer.js**.
- Define segments by start/end times and editable waveform regions.
- Pick exactly one segment as **TERM** and one segment as **SOUND**.
- Export TERM and SOUND as separate high-quality **MP3 (320 kbps)** files using **lamejs**.

## Tech Stack

- React + Vite
- WaveSurfer.js
- Web Audio API
- lamejs (MP3 encoding)

## Local Installation

### 1) Install dependencies

```bash
npm install
```

### 2) Start development server

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

## Usage

1. In "Add audio files", upload either:
   - a single audio file, or
   - a folder containing audio files.
2. Pick the active file from the dropdown.
3. In "Create segments":
   - play/pause audio,
   - set start/end at cursor or type numeric times,
   - click "Add Segment",
   - drag/resize region handles on waveform,
   - click "Refresh Segment Times" if you edited by drag.
4. In the table, choose one **TERM** segment and one **SOUND** segment.
5. Click export to download two MP3 files:
   - `filename__TERM.mp3`
   - `filename__SOUND.mp3`

## Notes

- Folder upload uses browser directory input behavior (`webkitdirectory`) which is widely supported in Chromium-based browsers.
- Some browsers may have codec limitations for playback/decoding specific input formats.
- All processing and exports happen locally in the browser tab.
