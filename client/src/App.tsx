import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  exportSession,
  loadSessionState,
  saveSessionState,
  openAudioFile,
  openVideoFiles,
  readFileBuffer,
  chooseProjectSavePath,
  startRender,
  cancelRender,
  onRenderLog,
  onRenderProgress,
  onRenderDone,
  onRenderError,
  onRenderCancelled,
  openProject,
  updateProjectDirty,
  onProjectRequestSave,
  notifyProjectSaved,
  chooseRenderOutput,
  prepareRenderProject,
  getDefaultProjectPath,
  saveProject,
  loadMediaLibrary,
  saveMediaLibrary as persistMediaLibrary,
  probeMediaFile,
} from './state/storage';
import type { SessionState } from './types/session';
// ProjectSchema usage comes via storage types; no direct import needed here.
import Waveform from './components/Waveform';
import type { WaveformHandle } from './components/Waveform';
import OverviewWaveform from './components/OverviewWaveform';
import Storyboard from './components/Storyboard';
import VolumeSlider from './components/VolumeSlider';
import type { ProjectSchema, LayerConfig, LayerType } from 'common/project';
import type { MediaLibraryItem } from 'common/project';

type Theme = 'dark' | 'light';
type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

type LocalSession = SessionState & {
  audioPath?: string;
  videoPaths?: string[];
  projectSavePath?: string;
  playhead?: number;
  layers?: LayerConfig[];
};

const defaultState: LocalSession = { notes: '', playhead: 0 };

const App = () => {
  const [session, setSession] = useState<LocalSession>(defaultState);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [renderElapsedMs, setRenderElapsedMs] = useState<number>(0);
  const [renderTotalMs, setRenderTotalMs] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
  const [theme, setThemeChoice] = useState<Theme>('dark');
  const [overviewPeaks, setOverviewPeaks] = useState<number[]>([]);
  const [volume, setVolume] = useState<number>(0.85);
  const waveRef = useRef<WaveformHandle | null>(null);
  const [layerDialogOpen, setLayerDialogOpen] = useState<boolean>(false);
  const [layerDraft, setLayerDraft] = useState<Partial<LayerConfig> & { text?: string; mode?: 'bar' | 'line' | 'solid' | 'dots'; font?: string; fontSize?: number }>({});
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [timelineScroll, setTimelineScroll] = useState<number>(0);
  const layers = useMemo(() => session.layers ?? [], [session.layers]);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPoolRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioMotionRef = useRef<any>(null);
  const previewBusyRef = useRef<boolean>(false);
  const [library, setLibrary] = useState<MediaLibraryItem[]>([]);
  const [librarySelectedId, setLibrarySelectedId] = useState<string | null>(null);
  const [addVideoModalOpen, setAddVideoModalOpen] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    preview: false,
    audio: false,
    videos: false,
    layers: false,
    project: false,
    library: false,
  });
  const getMaxVideoWidth = useCallback(() => {
    let max = 0;
    videoPoolRef.current.forEach((v) => {
      if (v.videoWidth && v.videoWidth > max) max = v.videoWidth;
    });
    return max || 640;
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
    const items = await loadMediaLibrary();
    setLibrary(items);
  } catch (err) {
    console.warn('Failed to load media library', err);
  }
  }, []);

  const assetHref = (rel: string) => {
    try {
      return new URL(rel, document.baseURI).toString();
    } catch {
      return rel;
    }
  };
  const PillIconButton = ({ icon, label, ...rest }: { icon: string; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className="pill-btn" type="button" {...rest}>
      <img className="pill-btn__img" src={assetHref(icon)} alt="" />
      <span className="pill-btn__label">{label}</span>
    </button>
  );
  const makeId = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch {}
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const makePseudoPeaks = useCallback((key: string, buckets = 640) => {
    const peaks: number[] = [];
    let seed = 2166136261;
    for (let i = 0; i < key.length; i++) {
      seed ^= key.charCodeAt(i);
      seed += (seed << 1) + (seed << 4) + (seed << 7) + (seed << 8) + (seed << 24);
    }
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1000) / 1000;
    };
    for (let i = 0; i < buckets; i++) {
      const base = 0.35 + rand() * 0.45;
      // slight smoothing with neighbors
      const prev = i > 0 ? peaks[i - 1] : base;
      peaks.push((base * 0.7) + (prev * 0.3));
    }
    return peaks;
  }, []);
  
  const toFileURL = (absPath: string): string => {
    if (/^file:\/\//i.test(absPath)) return absPath;
    if (/^\\\\/.test(absPath)) {
      const withoutPrefix = absPath.replace(/^\\\\+/, '');
      const normalized = withoutPrefix.replace(/\\/g, '/');
      return 'file://' + encodeURI(normalized);
    }
    const normalized = absPath.replace(/\\/g, '/');
    if (/^[A-Za-z]:\//.test(normalized)) {
      return 'file:///' + encodeURI(normalized);
    }
    if (normalized.startsWith('/')) {
      return 'file:///' + encodeURI(normalized);
    }
    return 'file:///' + encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized);
  };
  
  const applyTheme = useCallback((name: Theme) => {
    try {
      localStorage.setItem('muvidgen:theme', name);
    } catch {}
    document.documentElement.setAttribute('data-theme', name);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('muvidgen:theme');
      if (saved === 'light' || saved === 'dark') {
        setThemeChoice(saved);
        return;
      }
    } catch {}
    applyTheme('dark');
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    // Reset zoom/scroll when audio loads
    if (audioDuration > 0) {
      setTimelineZoom(1);
      setTimelineScroll(0);
    }
  }, [audioDuration]);

  const startNewLayer = (type: LayerType) => {
    const baseWidth = getMaxVideoWidth();
    setLayerDraft({
      id: makeId(),
      type,
      color: '#ffffff',
      x: 0.05,
      y: 0.05,
      width: baseWidth,
      height: Math.round(baseWidth * 9 / 16),
      mode: type === 'spectrograph' ? 'bar' : undefined,
      text: type === 'text' ? 'Text' : undefined,
      font: type === 'text' ? 'Segoe UI' : undefined,
      fontSize: type === 'text' ? 12 : undefined,
    });
    setLayerDialogOpen(true);
  };

  const openEditLayer = (layer: LayerConfig) => {
    setLayerDraft({ ...layer });
    setLayerDialogOpen(true);
  };

  const saveLayerDraft = () => {
    const draft = layerDraft as LayerConfig;
    if (!draft.type || !draft.id) return;
    if (draft.type === 'spectrograph') {
      draft.mode = (draft as any).mode === 'line' || (draft as any).mode === 'solid' || (draft as any).mode === 'dots' ? (draft as any).mode : 'bar';
      if (!draft.width) {
        const w = getMaxVideoWidth();
        draft.width = w;
        draft.height = Math.round(w * 9 / 16);
      }
    } else if (draft.type === 'text') {
      (draft as any).text = (draft as any).text ?? 'Text';
      (draft as any).font = (draft as any).font ?? 'Segoe UI';
      (draft as any).fontSize = Number((draft as any).fontSize ?? 12);
    }
    setSession((prev) => {
      const existing = prev.layers ?? [];
      const idx = existing.findIndex((l) => l.id === draft.id);
      const next = existing.slice();
      if (idx >= 0) next[idx] = draft;
      else next.push(draft);
      return { ...prev, layers: next };
    });
    setLayerDialogOpen(false);
    void updateProjectDirty(true);
  };

  const deleteLayer = (id: string) => {
    setSession((prev) => ({ ...prev, layers: (prev.layers ?? []).filter((l) => l.id !== id) }));
    void updateProjectDirty(true);
  };

  const saveLibrary = async (items: MediaLibraryItem[]) => {
    setLibrary(items);
    try {
      await persistMediaLibrary(items);
    } catch (err) {
      console.warn('Failed to save media library', err);
    }
  };

  const addLibraryEntryFromPath = async (filePath: string, name: string) => {
    const meta = await probeMediaFile(filePath);
    const item: MediaLibraryItem = {
      id: makeId(),
      name: name.trim(),
      path: filePath,
      description: '',
      duration: meta.duration ? Number(meta.duration) : undefined,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      audioChannels: meta.audioChannels ? Number(meta.audioChannels) : undefined,
      width: meta.width ? Number(meta.width) : undefined,
      height: meta.height ? Number(meta.height) : undefined,
    };
    const next = [...library, item];
    await saveLibrary(next);
    return item;
  };

  // Manage hidden video elements for preview
  useEffect(() => {
    const pool = videoPoolRef.current;
    const keep = new Set(session.videoPaths ?? []);
    // remove stale
    for (const key of Array.from(pool.keys())) {
      if (!keep.has(key)) {
        const vid = pool.get(key)!;
        vid.pause();
        pool.delete(key);
      }
    }
    // add new
    for (const p of keep) {
      if (!pool.has(p)) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.crossOrigin = 'anonymous';
        v.src = toFileURL(p);
        pool.set(p, v);
      }
    }
  }, [session.videoPaths]);

  const buildProjectFromSession = useCallback((): ProjectSchema => {
    const clips: ProjectSchema['clips'] = (session.videoPaths ?? []).map((p, index) => {
      const clip: ProjectSchema['clips'][number] = { path: p, index };
      const dur = videoDurations[p];
      if (Number.isFinite(dur)) clip.duration = dur;
      return clip;
    });
    const audio = session.audioPath ? { path: session.audioPath } : null;
    const playhead = typeof session.playhead === 'number' && Number.isFinite(session.playhead) ? session.playhead : 0;
    return {
      version: '1.0',
      audio,
      playhead,
      clips,
      layers: session.layers ?? [],
    };
  }, [session.audioPath, session.playhead, session.videoPaths, session.layers, videoDurations]);

  useEffect(() => {
    // Load session
    let cancelled = false;
    loadSessionState()
      .then((state) => {
        if (!cancelled && state) setSession({ ...(state as any), playhead: 0 });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));

    // Wire render event listeners
    const offLog = onRenderLog((line) => setLogs((prev) => [...prev, line]));
    const offProgress = onRenderProgress(({ outTimeMs, totalMs }) => {
      if (typeof outTimeMs === 'number') setRenderElapsedMs(outTimeMs);
      if (typeof totalMs === 'number') setRenderTotalMs(totalMs);
    });
    const offDone = onRenderDone(() => {
      setIsRendering(false);
      setStatus('Render completed');
    });
    const offErr = onRenderError((msg) => {
      setIsRendering(false);
      setError(msg);
    });
    const offCancelled = onRenderCancelled(() => {
      setIsRendering(false);
      setStatus('Render cancelled');
    });

    // Handle external save requests (e.g., Ctrl+S from host)
    const offReqSave = onProjectRequestSave(() => {
      void handleSaveProject();
    });

    // Cleanup only (not JSX)
    return () => {
      cancelled = true;
      offLog?.();
      offProgress?.();
      offDone?.();
      offErr?.();
      offCancelled?.();
      offReqSave?.();
    };
  }, []);

  const handleBrowseAudio = async () => {
    try {
      const path = await openAudioFile();
      if (path) {
        setSession((prev) => ({ ...prev, audioPath: path, playhead: 0 }));
        setAudioDuration(0);
        setStatus('Audio selected');
        void updateProjectDirty(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleBrowseVideos = async () => {
    try {
      const paths = await openVideoFiles();
      if (!paths || paths.length === 0) return;
      setSession((prev) => {
        const existing = prev.videoPaths ?? [];
        return { ...prev, videoPaths: [...existing, ...paths] };
      });
      setStatus(`${paths.length} video file(s) added`);
      void updateProjectDirty(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddVideoFromLibrary = (item: MediaLibraryItem) => {
    setSession((prev) => {
      const existing = prev.videoPaths ?? [];
      return { ...prev, videoPaths: [...existing, item.path] };
    });
    setStatus(`Added ${item.name} from library`);
    setAddVideoModalOpen(false);
    void updateProjectDirty(true);
  };

  const handleBrowseAndAddToLibrary = async () => {
    try {
      const paths = await openVideoFiles();
      if (!paths || paths.length === 0) return;
      for (const p of paths) {
        let name = window.prompt('Enter clip name (required)', p.split(/[\\/]/).pop() || 'Clip');
        if (!name || !name.trim()) continue;
        const item = await addLibraryEntryFromPath(p, name);
        handleAddVideoFromLibrary(item);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLoadProject = async () => {
    try {
      const opened = await openProject();
      if (opened) {
        const project = opened.project as any;
        const nextVideos = Array.isArray(project?.clips) ? project.clips.map((c: any) => c?.path).filter(Boolean) : [];
        setSession((prev) => ({
          ...prev,
          projectSavePath: opened.path,
          audioPath: project?.audio?.path ?? undefined,
          videoPaths: nextVideos,
          playhead: typeof project?.playhead === 'number' ? project.playhead : 0,
          layers: Array.isArray(project?.layers) ? project.layers : [],
        }));
        setStatus('Project loaded');
        await updateProjectDirty(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSaveProject = async () => {
    try {
      const project = buildProjectFromSession();
      let target = session.projectSavePath;
      if (!target) {
        const defaultPath = await getDefaultProjectPath();
        target = await chooseProjectSavePath(defaultPath);
        if (!target) return;
        setSession((prev) => ({ ...prev, projectSavePath: target }));
      }
      await saveProject(target, project);
      await updateProjectDirty(false);
      notifyProjectSaved(true);
      setStatus('Project saved');
    } catch (e: unknown) {
      notifyProjectSaved(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSaveProjectAs = async () => {
    try {
      const defaultPath = session.projectSavePath ?? await getDefaultProjectPath();
      const target = await chooseProjectSavePath(defaultPath);
      if (!target) return;
      setSession((prev) => ({ ...prev, projectSavePath: target }));
      const project = buildProjectFromSession();
      await saveProject(target, project);
      await updateProjectDirty(false);
      notifyProjectSaved(true);
      setStatus('Project saved as...');
    } catch (e: unknown) {
      notifyProjectSaved(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartRender = async () => {
    try {
      const project = buildProjectFromSession();
      let target = session.projectSavePath;
      if (!target) {
        const defaultPath = await getDefaultProjectPath();
        target = await chooseProjectSavePath(defaultPath);
        if (!target) {
          setStatus('Render cancelled: no project path selected');
          return;
        }
        setSession((prev) => ({ ...prev, projectSavePath: target }));
      }
      await saveProject(target, project);
      await updateProjectDirty(false);

      const outputPath = await chooseRenderOutput(target);
      if (!outputPath) {
        setStatus('Render cancelled');
        return;
      }
      const preparedPath = await prepareRenderProject(target, outputPath);

      setIsRendering(true);
      setRenderElapsedMs(0);
      setRenderTotalMs(0);
      setLogs([]);
      setStatus('Render started');
      void startRender(preparedPath).catch((err) => {
        setIsRendering(false);
        setError(err instanceof Error ? err.message : String(err));
      });
    } catch (e: unknown) {
      setIsRendering(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleNotesChange = (ev: ChangeEvent<HTMLTextAreaElement>) => {
    const value = ev.target.value;
    setSession((prev) => ({ ...prev, notes: value }));
    void updateProjectDirty(true);
  };

  const handleSave = async () => {
    try {
      const { audioPath, videoPaths, projectSavePath, playhead, ...rest } = session;
      const toSave: SessionState = { ...(rest as SessionState) };
      await saveSessionState(toSave);
      setStatus('Session saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExport = async () => {
    try {
      const targetPath = session.projectSavePath;
      if (!targetPath) {
        setError('Set a project path before export');
        return;
      }
      await exportSession({ targetPath, state: (session as unknown as SessionState) });
      setStatus('Session exported');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Load video durations to scale storyboard items
  useEffect(() => {
    const paths = session.videoPaths ?? [];
    if (paths.length === 0) { setVideoDurations({}); return; }
    let cancel = false;
    const next: Record<string, number> = {};
    let loaded = 0;
    paths.forEach((p) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = toFileURL(p);
      const done = () => {
        loaded += 1;
        if (!cancel) {
          if (Number.isFinite(v.duration)) next[p] = v.duration;
          if (loaded === paths.length) setVideoDurations(next);
        }
        v.src = '';
      };
      v.addEventListener('loadedmetadata', done, { once: true });
      v.addEventListener('error', done, { once: true });
      // In case metadata is cached
      if (Number.isFinite(v.duration) && v.duration > 0) done();
    });
    return () => { cancel = true; };
  }, [session.videoPaths]);

  useEffect(() => {
    const audioPath = session.audioPath;
    if (!audioPath) {
      setOverviewPeaks([]);
      return;
    }
    // Show something immediately while decoding
    setOverviewPeaks(makePseudoPeaks(audioPath));
    let cancelled = false;

    const generatePeaks = async () => {
      try {
        const buf = await readFileBuffer(audioPath);
        const slice = buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength
          ? buf.buffer
          : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        // Ensure we hand AudioContext a real ArrayBuffer (not SharedArrayBuffer)
        const arrayBuffer = slice instanceof ArrayBuffer
          ? slice
          : (() => {
              const copy = new Uint8Array(slice.byteLength);
              copy.set(new Uint8Array(slice));
              return copy.buffer;
            })();
        const AudioCtor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
        if (!AudioCtor) throw new Error('AudioContext unavailable');
        const audioCtx = new AudioCtor();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          await audioCtx.close();
          return;
        }
        const channelData = decoded.numberOfChannels > 0 ? decoded.getChannelData(0) : undefined;
        if (!channelData) {
          await audioCtx.close();
          throw new Error('No channel data');
        }
        const bucketCount = 640;
        const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
        const peaks: number[] = [];
        for (let bucket = 0; bucket < bucketCount; bucket++) {
          const start = bucket * samplesPerBucket;
          if (start >= channelData.length) break;
          let peak = 0;
          for (let i = 0; i < samplesPerBucket && start + i < channelData.length; i++) {
            const sample = Math.abs(channelData[start + i]);
            if (sample > peak) peak = sample;
          }
          peaks.push(peak);
        }
        await audioCtx.close();
        if (!cancelled) setOverviewPeaks(peaks);
      } catch (err) {
        if (!cancelled) {
          console.warn('Overview waveform generation failed:', err);
          setOverviewPeaks(makePseudoPeaks(audioPath));
        }
      }
    };

    void generatePeaks();
    return () => {
      cancelled = true;
    };
  }, [session.audioPath, makePseudoPeaks]);

  // Wire AudioMotion analyzer when audio element is available (lazy-loaded from CDN)
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    let container: HTMLDivElement | null = null;
    let destroyed = false;
    (async () => {
      try {
        // @ts-ignore external ESM import
        const mod: any = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/audiomotion-analyzer@4.0.0/+esm');
        const AudioMotion = mod?.default ?? mod;
        if (!AudioMotion) return;
        if (destroyed) return;
        container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.width = '400px';
        container.style.height = '200px';
        document.body.appendChild(container);
        const am = new AudioMotion(container, {
          source: audio,
          height: 200,
          width: 400,
          mode: 10,
          ledBars: false,
          ansiBands: false,
          smoothing: 0.7,
          gradient: 'classic',
          showScale: false,
          overlay: true,
          bgAlpha: 0,
        });
        audioMotionRef.current = am;
      } catch (err) {
        console.warn('AudioMotion init failed', err);
      }
    })();
    return () => {
      destroyed = true;
      if (audioMotionRef.current) {
        try { (audioMotionRef.current as any).destroy?.(); } catch {}
        audioMotionRef.current = null;
      }
      if (container) {
        container.remove();
      }
    };
  }, [session.audioPath]);

  const resolveActiveClip = useCallback((playheadSec: number) => {
    const paths = session.videoPaths ?? [];
    let acc = 0;
    for (const p of paths) {
      const dur = videoDurations[p] ?? 0;
      const next = acc + dur;
      if (playheadSec <= next) {
        return { path: p, local: Math.max(0, playheadSec - acc), duration: dur };
      }
      acc = next;
    }
    return null;
  }, [session.videoPaths, videoDurations]);

  const renderPreviewFrame = useCallback(async () => {
    if (previewBusyRef.current) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    previewBusyRef.current = true;
    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.clientWidth || 800;
    const logicalH = canvas.clientHeight || 450;
    canvas.width = Math.floor(logicalW * dpr);
    canvas.height = Math.floor(logicalH * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalW, logicalH);
    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, logicalW, logicalH);

    const active = resolveActiveClip(session.playhead ?? 0);
    if (active) {
      const vid = videoPoolRef.current.get(active.path);
      if (vid) {
        const seekOk = await new Promise<boolean>((resolve) => {
          const handler = () => resolve(true);
          vid.currentTime = Math.min(Math.max(0, active.local), (vid.duration || active.duration || 0));
          vid.addEventListener('seeked', handler, { once: true });
          setTimeout(() => resolve(false), 500);
        });
        if (seekOk) {
          try {
            const vw = vid.videoWidth || logicalW;
            const vh = vid.videoHeight || logicalH;
            const scale = Math.min(logicalW / vw, logicalH / vh);
            const dw = vw * scale;
            const dh = vh * scale;
            const dx = (logicalW - dw) / 2;
            const dy = (logicalH - dh) / 2;
            ctx.drawImage(vid, dx, dy, dw, dh);
          } catch {
            // ignore draw errors
          }
        }
      }
    }

    // Draw layers
    for (const layer of layers) {
      const x = (layer.x ?? 0) * logicalW;
      const y = (layer.y ?? 0) * logicalH;
      const baseW = layer.width ?? getMaxVideoWidth();
      const baseH = layer.height ?? Math.round(baseW * 9 / 16);
      if (layer.type === 'spectrograph') {
        const am = audioMotionRef.current;
        if (am?.canvas) {
          try { am.draw?.(); } catch {}
          const srcCanvas = am.canvas as HTMLCanvasElement;
          const cropH = Math.floor(srcCanvas.height * 0.8);
          ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, cropH, x, y, baseW, baseH);
        }
      } else if (layer.type === 'text') {
        ctx.save();
        const fontSize = Math.max(8, layer.fontSize ?? 12);
        ctx.font = `${fontSize}px ${layer.font ?? 'Segoe UI'}, sans-serif`;
        ctx.fillStyle = layer.color ?? '#ffffff';
        const shadowOpacity = layer.glowOpacity ?? 0.4;
        if (layer.glowAmount) {
          ctx.shadowColor = `${layer.glowColor ?? layer.color ?? '#ffffff'}${Math.round(shadowOpacity * 255).toString(16).padStart(2, '0')}`;
          ctx.shadowBlur = layer.glowAmount ?? 0;
        } else {
          ctx.shadowBlur = 0;
        }
        if (layer.shadowDistance) {
          ctx.shadowOffsetX = layer.shadowDistance;
          ctx.shadowOffsetY = layer.shadowDistance;
          ctx.shadowColor = layer.shadowColor ?? '#000000';
        }
        ctx.strokeStyle = layer.outlineColor ?? '#000000';
        ctx.lineWidth = Math.max(0, layer.outlineWidth ?? 0);
        if ((layer.outlineWidth ?? 0) > 0) {
          ctx.strokeText(layer.text ?? 'Text', x, y);
        }
        ctx.fillText(layer.text ?? 'Text', x, y);
        ctx.restore();
      }
    }

    previewBusyRef.current = false;
  }, [layers, resolveActiveClip, session.playhead]);

  useEffect(() => {
    void renderPreviewFrame();
  }, [renderPreviewFrame, session.playhead, layers, videoDurations, session.videoPaths]);

  useEffect(() => {
    const onResize = () => { void renderPreviewFrame(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [renderPreviewFrame]);

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>MuvidGen Session</h1>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Theme
          <select
            value={theme}
            onChange={(e) => {
              const next = e.target.value === 'light' ? 'light' : 'dark';
              setThemeChoice(next);
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </header>
      <div className="grid">
        {/* Audio Row */}
        <div className="right">
            <div className="section-header">
              <h2 style={{ margin: 0 }}>AUDIO</h2>
              <button className="pill-btn" type="button" onClick={() => { setTimelineZoom((z) => Math.max(0.25, z / 2)); setTimelineScroll(0); }}>
                <img className="pill-btn__img" src={assetHref('ui/icon-zoom-minus.png')} alt="" />
                <span className="pill-btn__label">Zoom Out</span>
              </button>
              <span className="muted" style={{ minWidth: 60, textAlign: 'center' }}>{Math.round(timelineZoom * 100)}%</span>
              <button className="pill-btn" type="button" onClick={() => { setTimelineZoom((z) => Math.min(8, z * 2)); setTimelineScroll(0); }}>
                <img className="pill-btn__img" src={assetHref('ui/icon-zoom-plus.png')} alt="" />
                <span className="pill-btn__label">Zoom In</span>
              </button>
              <button className="pill-btn" type="button" onClick={() => { setTimelineZoom(1); setTimelineScroll(0); }}>
                <img className="pill-btn__img" src={assetHref('ui/icon-sliders.png')} alt="" />
                <span className="pill-btn__label">Fit to Audio</span>
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <VolumeSlider value={volume} onChange={(v) => setVolume(Math.min(1, Math.max(0, v)))} width={180} />
                <button className="collapse-btn" type="button" onClick={() => toggleSection('audio')} aria-label="Toggle audio">
                  {collapsed.audio ? '▾' : '▴'}
                </button>
              </div>
            </div>
            {!collapsed.audio && (
              <div className="panel" style={{ marginTop: 0, padding: 0, position: 'relative', overflow: 'hidden' }}>
                <OverviewWaveform
                  duration={audioDuration}
                  playhead={session.playhead ?? 0}
                  onSeek={(t: number) => setSession((prev) => ({ ...prev, playhead: t }))}
                  peaks={overviewPeaks}
                  hasAudio={!!session.audioPath}
                  zoom={timelineZoom}
                  scroll={timelineScroll}
                />
                <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="pill-btn" type="button" title="Load Audio" aria-label="Load Audio" onClick={handleBrowseAudio}>
                    <img className="pill-btn__img" src={assetHref('ui/icon-audio-load.png')} alt="" />
                    <span className="pill-btn__label">Audio</span>
                  </button>
                  <button className="pill-btn" type="button" title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => waveRef.current?.toggle()} disabled={!session.audioPath}>
                    <img className="pill-btn__img" src={assetHref(isPlaying ? 'ui/icon-audio-pause.png' : 'ui/icon-audio-play.png')} alt="" />
                    <span className="pill-btn__label">{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <div style={{ color: '#e5e7eb', fontSize: 12, marginTop: 4 }}>
                    {Math.floor(session.playhead ?? 0)}s / {Math.floor(audioDuration)}s
                  </div>
                </div>
              </div>
            )}
            {session.audioPath && (
              <div className="panel" style={{ marginTop: 8, padding: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className="muted">{Math.floor(session.playhead ?? 0)}s / {Math.floor(audioDuration)}s</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <VolumeSlider
                    value={volume}
                    onChange={(v) => setVolume(Math.min(1, Math.max(0, v)))}
                  />
                  <span className="muted" style={{ minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <Waveform
                  ref={waveRef as any}
                  srcPath={session.audioPath}
                  playhead={session.playhead ?? 0}
                  onPlayheadChange={(t) => setSession((prev) => ({ ...prev, playhead: t }))}
                  onDurationChange={(d) => setAudioDuration(d)}
                  onPlayingChange={(p) => setIsPlaying(p)}
                  volume={volume}
                  hideBuiltInControls
                  hideCanvas
                  onAudioElement={(el) => { audioElRef.current = el; }}
                />
              </div>
            )}
            {!session.audioPath && <div className="muted" style={{ marginTop: 8 }}>No audio selected</div>}
            <div style={{ margin: '6px 0 14px', padding: '2px 8px' }}>
              <div style={{ height: 12, background: '#1e2432', borderRadius: 6, position: 'relative' }} onClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                setTimelineScroll(pct);
              }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(1, Math.max(0, timelineScroll)) * Math.max(0, 1 - 1 / Math.max(1, timelineZoom)) * 100}%`,
                    top: 2,
                    height: 8,
                    width: `${Math.min(100, (1 / Math.max(1, timelineZoom)) * 100)}%`,
                    background: '#3f51b5',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const onMove = (ev: MouseEvent) => {
                      const rect = (e.currentTarget!.parentElement as HTMLDivElement).getBoundingClientRect();
                      const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
                      setTimelineScroll(pct);
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
              </div>
            </div>
        </div>

        {/* Preview Row */}
        <div className="right">
          <div className="section-header">
            <h2 style={{ margin: 0 }}>PREVIEW</h2>
            <button className="collapse-btn" type="button" onClick={() => toggleSection('preview')} aria-label="Toggle preview">
              {collapsed.preview ? '▾' : '▴'}
            </button>
          </div>
          {!collapsed.preview && (
            <div className="panel" style={{ padding: 8 }}>
              <canvas ref={previewCanvasRef} style={{ width: '100%', height: 320, display: 'block', borderRadius: 8, background: '#0b0f16' }} />
            </div>
          )}
        </div>

        {/* Videos Row */}
        <div className="right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>VIDEOS</h2>
              <PillIconButton icon="ui/icon-video-add.png" label="Browse" onClick={handleBrowseVideos} />
              <PillIconButton icon="ui/icon-video.png" label="From Library" onClick={() => setAddVideoModalOpen(true)} />
              <div style={{ marginLeft: 'auto' }}>
                <button className="pill-btn" type="button" onClick={() => toggleSection('videos')}>
                  <span className="pill-btn__label">{collapsed.videos ? 'Expand' : 'Collapse'}</span>
                </button>
              </div>
            </div>
            {!collapsed.videos && (
              <>
                {(session.videoPaths?.length ?? 0) > 0 ? (
                  <div style={{ marginTop: 0 }}>
                    <Storyboard
                      paths={session.videoPaths ?? []}
                      onChange={(next) => {
                        setSession((prev) => ({ ...prev, videoPaths: next }));
                        void updateProjectDirty(true);
                      }}
                      durations={videoDurations}
                      totalDuration={audioDuration}
                      zoom={timelineZoom}
                      scroll={timelineScroll}
                      playhead={session.playhead ?? 0}
                      onDoubleClick={(path) => {
                        const hit = (library.find((i) => i.path === path));
                        if (hit) {
                          setCollapsed((prev) => ({ ...prev, library: false }));
                          setLibrarySelectedId(hit.id);
                        } else {
                          setCollapsed((prev) => ({ ...prev, library: false }));
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: '0.5rem' }}>No clips. Use Add Videos to include files.</div>
                )}
              </>
            )}
        </div>

        <div className="right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>LAYERS</h2>
            <PillIconButton icon="ui/icon-layer-visualizer-add.png" label="Visualizer" onClick={() => startNewLayer('spectrograph')} />
            <PillIconButton icon="ui/icon-layer-text-add.png" label="Text" onClick={() => startNewLayer('text')} />
            <div style={{ marginLeft: 'auto' }}>
              <button className="pill-btn" type="button" onClick={() => toggleSection('layers')}>
                <span className="pill-btn__label">{collapsed.layers ? 'Expand' : 'Collapse'}</span>
              </button>
            </div>
          </div>
          {!collapsed.layers && (
            <>
              {layers.length === 0 && <div className="muted">No layers yet. Add spectrograph or text overlays to render on top of the video.</div>}
              {layers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {layers.map((layer) => (
                    <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: layer.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{layer.type === 'text' ? 'Text Layer' : 'Spectrograph Layer'}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {layer.type === 'text'
                            ? `Text: ${(layer as any).text ?? ''} @ (${Math.round(layer.x * 100)}%, ${Math.round(layer.y * 100)}%), font ${(layer as any).font ?? ''} ${(layer as any).fontSize ?? ''}`
                            : `Mode: ${(layer as any).mode ?? 'bar'} @ (${Math.round(layer.x * 100)}%, ${Math.round(layer.y * 100)}%)`}
                        </div>
                      </div>
                      <button className="pill-btn" type="button" onClick={() => openEditLayer(layer)}>Edit</button>
                      <button className="pill-btn" type="button" onClick={() => deleteLayer(layer.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
              {layerDialogOpen && (
                <div className="panel" style={{ marginTop: 10, padding: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Type
                  <select
                    value={layerDraft.type ?? 'spectrograph'}
                    onChange={(e) => {
                      const nextType = e.target.value as LayerType;
                      setLayerDraft((prev) => ({
                        ...prev,
                        type: nextType,
                        mode: nextType === 'spectrograph' ? (prev.mode as any) ?? 'bar' : undefined,
                        text: nextType === 'text' ? (prev.text ?? 'Text') : undefined,
                        font: nextType === 'text' ? (prev.font ?? 'Segoe UI') : undefined,
                        fontSize: nextType === 'text' ? (prev.fontSize ?? 12) : undefined,
                      }));
                    }}
                  >
                    <option value="spectrograph">Standard Spectrograph</option>
                    <option value="text">Text</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Color
                  <input type="color" value={layerDraft.color ?? '#ffffff'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, color: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Outline Color
                  <input type="color" value={layerDraft.outlineColor ?? '#000000'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, outlineColor: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Outline Width
                  <input type="number" min={0} max={20} value={layerDraft.outlineWidth ?? 0} onChange={(e) => setLayerDraft((prev) => ({ ...prev, outlineWidth: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Glow Color
                  <input type="color" value={layerDraft.glowColor ?? '#ffffff'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, glowColor: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Glow Amount
                  <input type="number" min={0} max={50} value={layerDraft.glowAmount ?? 0} onChange={(e) => setLayerDraft((prev) => ({ ...prev, glowAmount: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Glow Opacity
                  <input type="number" min={0} max={1} step={0.05} value={layerDraft.glowOpacity ?? 0.4} onChange={(e) => setLayerDraft((prev) => ({ ...prev, glowOpacity: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Shadow Color
                  <input type="color" value={layerDraft.shadowColor ?? '#000000'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, shadowColor: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Shadow Distance
                  <input type="number" min={0} max={50} value={layerDraft.shadowDistance ?? 0} onChange={(e) => setLayerDraft((prev) => ({ ...prev, shadowDistance: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  X (%)
                  <input type="number" min={0} max={100} value={Math.round((layerDraft.x ?? 0) * 100)} onChange={(e) => setLayerDraft((prev) => ({ ...prev, x: Math.min(100, Math.max(0, Number(e.target.value))) / 100 }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Y (%)
                  <input type="number" min={0} max={100} value={Math.round((layerDraft.y ?? 0) * 100)} onChange={(e) => setLayerDraft((prev) => ({ ...prev, y: Math.min(100, Math.max(0, Number(e.target.value))) / 100 }))} />
                </label>
                {layerDraft.type === 'spectrograph' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Mode
                    <select value={layerDraft.mode ?? 'bar'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, mode: e.target.value as 'bar' | 'line' | 'solid' | 'dots' }))}>
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="solid">Solid</option>
                      <option value="dots">Dots</option>
                    </select>
                  </label>
                )}
                {layerDraft.type === 'text' && (
                  <>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      Text
                      <input type="text" value={layerDraft.text ?? ''} onChange={(e) => setLayerDraft((prev) => ({ ...prev, text: e.target.value }))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      Font
                      <input type="text" value={layerDraft.font ?? 'Segoe UI'} onChange={(e) => setLayerDraft((prev) => ({ ...prev, font: e.target.value }))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      Font Size
                      <input type="number" min={8} max={96} value={layerDraft.fontSize ?? 12} onChange={(e) => setLayerDraft((prev) => ({ ...prev, fontSize: Number(e.target.value) }))} />
                    </label>
                  </>
                )}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="button" onClick={saveLayerDraft}>OK</button>
                <button type="button" onClick={() => { setLayerDialogOpen(false); }}>Cancel</button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Media Library */}
        <div className="right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>MEDIA LIBRARY</h2>
            <button className="pill-btn" type="button" onClick={() => setAddVideoModalOpen(true)}>
              <span>Add Entry</span>
            </button>
            <button className="pill-btn" type="button" disabled={!librarySelectedId} onClick={async () => {
              if (!librarySelectedId) return;
              const next = library.filter((i) => i.id !== librarySelectedId);
              await saveLibrary(next);
              setLibrarySelectedId(null);
            }}>
              <span>Remove</span>
            </button>
            <div style={{ marginLeft: 'auto' }}>
              <button className="pill-btn" type="button" onClick={() => toggleSection('library')}>
                <span className="pill-btn__label">{collapsed.library ? 'Expand' : 'Collapse'}</span>
              </button>
            </div>
          </div>
          {!collapsed.library && (
            <div className="panel" style={{ padding: 8 }}>
              {library.length === 0 && <div className="muted">No items in library.</div>}
              {library.length > 0 && (
                <>
                  <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                    {library.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setLibrarySelectedId(item.id)}
                        style={{
                          padding: '6px 8px',
                          cursor: 'pointer',
                          background: librarySelectedId === item.id ? 'var(--panel-alt)' : 'transparent',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{item.path}</div>
                      </div>
                    ))}
                  </div>
                  {librarySelectedId && (() => {
                    const sel = library.find((i) => i.id === librarySelectedId);
                    if (!sel) return null;
                    return (
                      <div style={{ marginTop: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{sel.name}</div>
                        {sel.description && <div className="muted">{sel.description}</div>}
                        <div className="muted" style={{ fontSize: 12 }}>Path: {sel.path}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Duration: {sel.duration ? `${Math.round(sel.duration)}s` : 'n/a'}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Video: {sel.videoCodec ?? 'n/a'} {sel.width && sel.height ? `(${sel.width}x${sel.height})` : ''}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Audio: {sel.audioCodec ?? 'n/a'} {sel.audioChannels ? `(${sel.audioChannels}ch)` : ''}</div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        {addVideoModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, width: 520, maxHeight: '70vh', overflow: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>Add Video</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <button className="pill-btn" type="button" onClick={() => { setCollapsed((prev) => ({ ...prev, library: false })); }}>
                  <span>Pick From Library Below</span>
                </button>
                <button className="pill-btn" type="button" onClick={handleBrowseAndAddToLibrary}>
                  <span>Browse Files</span>
                </button>
                <button className="pill-btn" type="button" onClick={() => setAddVideoModalOpen(false)}>
                  <span>Close</span>
                </button>
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                {library.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setLibrarySelectedId(item.id)}
                    onDoubleClick={() => handleAddVideoFromLibrary(item)}
                    style={{
                      padding: '6px 8px',
                      cursor: 'pointer',
                      background: librarySelectedId === item.id ? 'var(--panel-alt)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{item.path}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="pill-btn" type="button" disabled={!librarySelectedId} onClick={() => {
                  const sel = library.find((i) => i.id === librarySelectedId);
                  if (sel) handleAddVideoFromLibrary(sel);
                }}>
                  <span>Use Selected</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>PROJECT</h2>
              <PillIconButton icon="ui/icon-project-load.png" label="Load" onClick={handleLoadProject} />
              <PillIconButton icon="ui/icon-project-save-as.png" label="Save As" onClick={handleSaveProjectAs} />
              <PillIconButton icon="ui/icon-project-save.png" label="Save" onClick={handleSaveProject} />
              <div style={{ marginLeft: 'auto' }}>
                <button className="pill-btn" type="button" onClick={() => toggleSection('project')}>
                  <span className="pill-btn__label">{collapsed.project ? 'Expand' : 'Collapse'}</span>
                </button>
              </div>
              <span style={{ color: '#666' }}>{session.projectSavePath ?? 'No project path selected'}</span>
            </div>
            {!collapsed.project && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>RENDER</h2>
                <PillIconButton icon="ui/icon-sliders.png" label="Render" onClick={handleStartRender} disabled={!session.projectSavePath || isRendering} />
                <PillIconButton icon="ui/icon-x.png" label="Cancel" onClick={() => cancelRender()} disabled={!isRendering} />
                <button className="pill-btn" type="button" onClick={() => { setLogs([]); setRenderElapsedMs(0); setRenderTotalMs(0); }}>
                  <span>Clear Logs</span>
                </button>
                <span style={{ color: '#666' }}>Elapsed: {Math.floor((renderElapsedMs/1000))}s</span>
                {renderTotalMs > 0 && (
                  <span style={{ color: '#666' }}>
                    ETA: {Math.max(0, Math.floor((renderTotalMs - renderElapsedMs)/1000))}s
                  </span>
                )}
              </div>
            )}
            {renderTotalMs > 0 && (
              <div style={{ marginTop: '0.5rem', height: 10, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, (renderElapsedMs / renderTotalMs) * 100)).toFixed(1)}%`, background: '#3f51b5' }} />
              </div>
            )}
            <div style={{ marginTop: '0.5rem', padding: '8px', background: '#0b0b0b', border: '1px solid #333', borderRadius: 4, maxHeight: 200, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
              {logs.length === 0 ? (
                <div style={{ color: '#777' }}>Render logs will appear here...</div>
              ) : (
                logs.map((l, i) => (<div key={i}>{l}</div>))
              )}
            </div>
        </div>

        {/* Notes Row (collapsed by default) */}
        <div className="right">
          <div className="section-header">
            <h2 style={{ margin: 0 }}>NOTES</h2>
            <PillIconButton icon="ui/button_notes.svg" label={showNotes ? 'Hide' : 'Show'} onClick={() => setShowNotes((v) => !v)} />
          </div>
          <h2>Notes</h2>
          {showNotes && (
            <>
              <textarea
                id="session-notes"
                style={{ display: 'block', width: '100%', minHeight: '200px', marginTop: '0.5rem' }}
                value={String((session as any).notes ?? '')}
                onChange={handleNotesChange}
              />
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={handleSave}>Save Session</button>
                <button type="button" onClick={handleExport}>Export Session</button>
              </div>
            </>
          )}
          {status && <p style={{ color: 'green' }}>{status}</p>}
          {error && (
            <p role="alert" style={{ color: 'red' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
