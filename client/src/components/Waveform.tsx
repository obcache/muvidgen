import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';

export interface WaveformProps {
  srcPath: string;
  playhead?: number;
  onPlayheadChange?: (seconds: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  hideBuiltInControls?: boolean;
  volume?: number;
  hideCanvas?: boolean;
  onAudioElement?: (el: HTMLAudioElement) => void;
}

export interface WaveformHandle {
  toggle: () => void;
  isPlaying: () => boolean;
}

const toFileURL = (absPath: string): string => {
  // Convert Windows absolute paths and UNC shares to file URLs
  if (/^file:\/\//i.test(absPath)) return absPath; // already a file URL
  // UNC path: \\SERVER\Share\path -> file://SERVER/Share/path
  if (/^\\\\/.test(absPath)) {
    const withoutPrefix = absPath.replace(/^\\\\+/, '');
    const normalized = withoutPrefix.replace(/\\/g, '/');
    return 'file://' + encodeURI(normalized);
  }
  // Drive path: C:\path -> file:///C:/path
  const normalized = absPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) {
    return 'file:///' + encodeURI(normalized);
  }
  // POSIX-like absolute
  if (normalized.startsWith('/')) {
    return 'file:///' + encodeURI(normalized);
  }
  // Fallback: treat as absolute-like
  return 'file:///' + encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized);
};

const formatTime = (t: number): string => {
  if (!isFinite(t)) return '0:00';
  const total = Math.max(0, Math.floor(t));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const Waveform = forwardRef<WaveformHandle, WaveformProps>(({ srcPath, playhead, onPlayheadChange, onDurationChange, onPlayingChange, hideBuiltInControls, volume = 1, hideCanvas, onAudioElement }: WaveformProps, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);
  const syncingRef = useRef(false);

  const src = useMemo(() => toFileURL(srcPath), [srcPath]);

  // Create AudioContext + Analyser for a simple live waveform
  useEffect(() => {
    if (hideCanvas) return;
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    let ctx: AudioContext | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let rafId: number | null = null;
    let mounted = true;

    const startAudioGraph = () => {
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        source = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const draw = () => {
          if (!mounted || !analyser) return;
          const { width, height } = canvas;
          canvasCtx.clearRect(0, 0, width, height);
          analyser.getByteTimeDomainData(buffer);
          canvasCtx.strokeStyle = '#3f51b5';
          canvasCtx.lineWidth = 1;
          canvasCtx.beginPath();
          const slice = width / buffer.length;
          for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i] / 128.0; // ~0..2
            const y = (v * height) / 2;
            const x = i * slice;
            i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
          }
          canvasCtx.stroke();
          rafId = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        // AudioContext may fail if not allowed; ignore silently.
      }
    };

    startAudioGraph();

    return () => {
      mounted = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      try { source?.disconnect(); } catch {}
      try { analyser?.disconnect(); } catch {}
      try { ctx?.close(); } catch {}
    };
  }, [src]);

  // Sync external playhead when metadata is ready
  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    try { onDurationChange?.(audio.duration || 0); } catch {}
    if (typeof playhead === 'number' && isFinite(playhead)) {
      try { audio.currentTime = playhead; } catch {}
    }
  }, [playhead, onDurationChange]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(audio.currentTime || 0);
    // Prevent feedback when we are programmatically syncing to props
    if (!syncingRef.current) {
      onPlayheadChange?.(audio.currentTime || 0);
    }
  }, [onPlayheadChange]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); onPlayingChange?.(true); } catch (err) { console.error('[Waveform] audio.play() failed:', err); }
    } else {
      audio.pause();
      setPlaying(false);
      onPlayingChange?.(false);
    }
  }, [onPlayingChange]);

  const onSeek = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    try { audio.currentTime = t; } catch {}
    setCurrent(t);
    onPlayheadChange?.(t);
  }, [onPlayheadChange]);

  // Sync to external playhead updates (e.g., from OverviewWaveform clicks)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextVol = Math.min(1, Math.max(0, volume));
    audio.volume = nextVol;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = typeof playhead === 'number' && isFinite(playhead) ? playhead : 0;
    const cur = audio.currentTime || 0;
    if (!Number.isFinite(target)) return;
    if (Math.abs(cur - target) > 0.05) {
      try {
        syncingRef.current = true;
        audio.currentTime = target;
      } catch {}
      // release the guard on next tick so natural timeupdates propagate again
      setTimeout(() => { syncingRef.current = false; }, 0);
    }
  }, [playhead]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => onPlayingChange?.(true);
    const onPause = () => onPlayingChange?.(false);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    try { onAudioElement?.(a); } catch {}
    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [onPlayingChange, onAudioElement]);

  useImperativeHandle(ref, () => ({ toggle: () => { void togglePlay(); }, isPlaying: () => isPlaying }), [togglePlay, isPlaying]);

  return (
    <div>
      {!hideCanvas && (
        <canvas ref={canvasRef} width={800} height={120} style={{ width: '100%', height: 120, background: '#111', display: 'block', borderRadius: 4 }} />
      )}
      {!hideBuiltInControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#666' }}>{formatTime(current)} / {formatTime(duration)}</span>
          <input type="range" min={0} max={Math.max(0, duration)} step={0.01} value={current} onChange={onSeek} style={{ flex: 1 }} />
        </div>
      )}
      {/* Hidden native audio; we control via custom UI */}
      <audio ref={audioRef} src={src} onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate} preload="metadata" />
    </div>
  );
});

export default Waveform;
