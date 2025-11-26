import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface WaveformProps {
  srcPath: string;
  playhead?: number;
  onPlayheadChange?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
}

const toFileURL = (absPath: string): string => {
  // Convert Windows or POSIX absolute paths to file URLs
  const normalized = absPath.replace(/\\/g, '/');
  return 'file:///' + encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized);
};

const formatTime = (t: number): string => {
  if (!isFinite(t)) return '0:00';
  const total = Math.max(0, Math.floor(t));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const Waveform = ({ srcPath, playhead, onPlayheadChange, onDurationChange }: WaveformProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [current, setCurrent] = useState<number>(0);

  const src = useMemo(() => toFileURL(srcPath), [srcPath]);

  // Create AudioContext + Analyser for a simple live waveform
  useEffect(() => {
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
    if (typeof onDurationChange === 'function') {
      onDurationChange(audio.duration || 0);
    }
    if (typeof playhead === 'number' && isFinite(playhead)) {
      try { audio.currentTime = playhead; } catch {}
    }
  }, [playhead, onDurationChange]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(audio.currentTime || 0);
    onPlayheadChange?.(audio.currentTime || 0);
  }, [onPlayheadChange]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); } catch {}
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const onSeek = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    try { audio.currentTime = t; } catch {}
    setCurrent(t);
    onPlayheadChange?.(t);
  }, [onPlayheadChange]);

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={120} style={{ width: '100%', height: 120, background: '#111', display: 'block', borderRadius: 4 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="button" onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#666' }}>{formatTime(current)} / {formatTime(duration)}</span>
        <input type="range" min={0} max={Math.max(0, duration)} step={0.01} value={current} onChange={onSeek} style={{ flex: 1 }} />
      </div>
      {/* Hidden native audio; we control via custom UI */}
      <audio ref={audioRef} src={src} onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate} preload="metadata" />
    </div>
  );
};

export default Waveform;
