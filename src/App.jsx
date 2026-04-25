import { useEffect, useMemo, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { exportSegmentToMp3 } from './audioExport';

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${min}:${sec}`;
}

function toAudioItems(fileList) {
  return Array.from(fileList || [])
    .filter((file) => file.type.startsWith('audio/'))
    .map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
    }));
}

export default function App() {
  const waveRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef(null);
  const activeRegionIdRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [status, setStatus] = useState('Upload an audio file or folder to begin.');

  const [segments, setSegments] = useState([]);
  const [termSegmentId, setTermSegmentId] = useState('');
  const [soundSegmentId, setSoundSegmentId] = useState('');

  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);

  const selectedItem = useMemo(
    () => files.find((item) => item.id === selectedFileId) || null,
    [files, selectedFileId]
  );

  useEffect(() => {
    const regionPlugin = RegionsPlugin.create();
    regionsRef.current = regionPlugin;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: '#9db4ff',
      progressColor: '#3452d1',
      cursorColor: '#111',
      normalize: true,
      minPxPerSec: 50,
      height: 160,
      plugins: [regionPlugin],
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      const duration = ws.getDuration() || 0;
      setRangeStart(0);
      setRangeEnd(duration);
      setStatus(`Loaded ${selectedItem?.name ?? 'audio'} (${duration.toFixed(2)} sec).`);
    });

    ws.on('error', (err) => {
      setStatus(`WaveSurfer error: ${String(err)}`);
    });

    regionPlugin.on('region-clicked', (region, e) => {
      e.stopPropagation();
      activeRegionIdRef.current = region.id;
      setStatus(`Selected segment: ${region.id}`);
      region.play(true);
    });

    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadSelectedFile() {
      if (!selectedItem || !wavesurferRef.current) return;

      setSegments([]);
      setTermSegmentId('');
      setSoundSegmentId('');
      activeRegionIdRef.current = null;

      const objectUrl = URL.createObjectURL(selectedItem.file);
      setStatus(`Loading ${selectedItem.name}...`);

      try {
        await wavesurferRef.current.load(objectUrl);
      } catch (error) {
        setStatus(`Failed to load file: ${String(error)}`);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    loadSelectedFile();
  }, [selectedItem]);

  function addFiles(newItems) {
    if (newItems.length === 0) {
      setStatus('No audio files detected in the selected input.');
      return;
    }

    setFiles((prev) => {
      const merged = [...prev, ...newItems];
      if (!selectedFileId && merged.length > 0) {
        setSelectedFileId(merged[0].id);
      }
      return merged;
    });

    setStatus(`Added ${newItems.length} file(s).`);
  }

  function addSegment() {
    const ws = wavesurferRef.current;
    const regionPlugin = regionsRef.current;
    if (!ws || !regionPlugin) return;

    const duration = ws.getDuration();
    const start = Math.max(0, Math.min(rangeStart, duration));
    const end = Math.max(0, Math.min(rangeEnd, duration));

    if (end <= start) {
      setStatus('Segment end must be after start.');
      return;
    }

    const id = `seg-${segments.length + 1}`;

    regionPlugin.addRegion({
      id,
      start,
      end,
      color: 'rgba(52, 82, 209, 0.25)',
      drag: true,
      resize: true,
    });

    setSegments((prev) => [
      ...prev,
      {
        id,
        start,
        end,
      },
    ]);

    setStatus(`Added segment ${id}. Click on waveform region to preview.`);
  }

  function deleteSegment(segmentId) {
    const regionPlugin = regionsRef.current;
    const region = regionPlugin?.getRegions().find((r) => r.id === segmentId);
    region?.remove();

    setSegments((prev) => prev.filter((seg) => seg.id !== segmentId));
    if (termSegmentId === segmentId) setTermSegmentId('');
    if (soundSegmentId === segmentId) setSoundSegmentId('');
    setStatus(`Deleted ${segmentId}.`);
  }

  function syncSegmentPositions() {
    const regionPlugin = regionsRef.current;
    if (!regionPlugin) return;

    const regions = regionPlugin.getRegions();
    setSegments((prev) =>
      prev.map((seg) => {
        const region = regions.find((r) => r.id === seg.id);
        if (!region) return seg;
        return {
          ...seg,
          start: region.start,
          end: region.end,
        };
      })
    );

    setStatus('Segment positions refreshed from waveform handles.');
  }

  function setStartAtCursor() {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setRangeStart(ws.getCurrentTime());
  }

  function setEndAtCursor() {
    const ws = wavesurferRef.current;
    if (!ws) return;
    setRangeEnd(ws.getCurrentTime());
  }

  async function exportSelections() {
    if (!selectedItem) {
      setStatus('No selected file.');
      return;
    }

    const termSegment = segments.find((s) => s.id === termSegmentId);
    const soundSegment = segments.find((s) => s.id === soundSegmentId);

    if (!termSegment || !soundSegment) {
      setStatus('Please choose one TERM segment and one SOUND segment before export.');
      return;
    }

    setStatus('Decoding audio for export...');

    const fileBuffer = await selectedItem.file.arrayBuffer();
    const audioContext = new AudioContext();

    try {
      const decoded = await audioContext.decodeAudioData(fileBuffer.slice(0));
      const baseName = selectedItem.name.replace(/\.[^/.]+$/, '');

      await exportSegmentToMp3({
        audioBuffer: decoded,
        startSec: termSegment.start,
        endSec: termSegment.end,
        name: `${baseName}__TERM`,
        kbps: 320,
      });

      await exportSegmentToMp3({
        audioBuffer: decoded,
        startSec: soundSegment.start,
        endSec: soundSegment.end,
        name: `${baseName}__SOUND`,
        kbps: 320,
      });

      setStatus('Export complete. Downloaded TERM and SOUND MP3 files.');
    } catch (error) {
      setStatus(`Export failed: ${String(error)}`);
    } finally {
      await audioContext.close();
    }
  }

  return (
    <main className="app-shell">
      <h1>Sound Splitter</h1>
      <p className="subtitle">
        Local-only utility. Files are loaded and processed in your browser.
      </p>

      <section className="card">
        <h2>1) Add audio files</h2>
        <div className="upload-row">
          <label>
            Single file
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => addFiles(toAudioItems(e.target.files))}
            />
          </label>
          <label>
            Folder
            <input
              type="file"
              accept="audio/*"
              multiple
              webkitdirectory="true"
              directory="true"
              onChange={(e) => addFiles(toAudioItems(e.target.files))}
            />
          </label>
        </div>

        <label className="file-picker">
          Active file
          <select
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {files.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>2) Create segments</h2>
        <div ref={waveRef} className="wave" />

        <div className="controls-row">
          <button onClick={() => wavesurferRef.current?.playPause()}>Play / Pause</button>
          <button onClick={setStartAtCursor}>Set Start @ Cursor</button>
          <button onClick={setEndAtCursor}>Set End @ Cursor</button>
          <button onClick={addSegment}>Add Segment</button>
          <button onClick={syncSegmentPositions}>Refresh Segment Times</button>
        </div>

        <div className="range-row">
          <label>
            Start (sec)
            <input
              type="number"
              min="0"
              step="0.01"
              value={Number.isFinite(rangeStart) ? rangeStart : 0}
              onChange={(e) => setRangeStart(Number(e.target.value))}
            />
          </label>
          <label>
            End (sec)
            <input
              type="number"
              min="0"
              step="0.01"
              value={Number.isFinite(rangeEnd) ? rangeEnd : 0}
              onChange={(e) => setRangeEnd(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>3) Pick TERM and SOUND, then export</h2>

        {segments.length === 0 ? (
          <p>No segments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th>Start</th>
                <th>End</th>
                <th>TERM</th>
                <th>SOUND</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.id}>
                  <td>{seg.id}</td>
                  <td>{formatTime(seg.start)}</td>
                  <td>{formatTime(seg.end)}</td>
                  <td>
                    <input
                      type="radio"
                      name="term"
                      checked={termSegmentId === seg.id}
                      onChange={() => setTermSegmentId(seg.id)}
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="sound"
                      checked={soundSegmentId === seg.id}
                      onChange={() => setSoundSegmentId(seg.id)}
                    />
                  </td>
                  <td>
                    <button onClick={() => deleteSegment(seg.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="export-btn" onClick={exportSelections}>
          Export TERM + SOUND as MP3 (320 kbps)
        </button>
      </section>

      <p className="status">Status: {status}</p>
    </main>
  );
}
