import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportSession,
  loadSessionState,
  saveSessionState,
  openAudioFile,
  openVideoFiles,
  chooseProjectSavePath,
  startRender,
} from './state/storage';
import type { SessionState } from './types/session';
import type { ProjectSchema } from 'common/project';

type LocalSession = SessionState & {
  audioPath?: string;
  videoPaths?: string[];
  projectSavePath?: string;
  playhead?: number;
};

const defaultState: LocalSession = { notes: '' };

const App = () => {
  const [session, setSession] = useState<LocalSession>(defaultState);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadSessionState()
      .then((state) => {
        if (!cancelled && state) {
          setSession(state);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotesChange = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>(
    (event) => {
      const value = event.target.value;
      setSession((prev: LocalSession) => ({ ...prev, notes: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setStatus('Saving...');
    setError(null);

    try {
      await saveSessionState(session);
      setStatus('Session saved.');
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session]);

  const handleBrowseAudio = useCallback(async () => {
    setError(null);
    try {
      const selected = await openAudioFile();
      if (selected) {
        setSession((prev) => ({ ...prev, audioPath: selected }));
        setStatus(`Selected audio: ${selected}`);
      }
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleBrowseVideos = useCallback(async () => {
    setError(null);
    try {
      const files = await openVideoFiles();
      if (files && files.length) {
        setSession((prev) => ({ ...prev, videoPaths: files }));
        setStatus(`Selected ${files.length} video file(s).`);
      }
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const projectJson = useMemo<ProjectSchema>(() => {
    const clips = (session.videoPaths ?? []).map((p, index) => ({ path: p, index }));
    return {
      version: '1.0',
      audio: session.audioPath ? { path: session.audioPath } : null,
      playhead: typeof session.playhead === 'number' ? session.playhead : 0,
      clips,
      output: session.projectSavePath ? { path: session.projectSavePath } : undefined,
      metadata: {},
    };
  }, [session.audioPath, session.videoPaths, session.playhead, session.projectSavePath]);

  const handleSaveProjectAs = useCallback(async () => {
    setStatus('');
    setError(null);
    try {
      const chosen = await chooseProjectSavePath(session.projectSavePath);
      if (!chosen) return;
      setSession((prev) => ({ ...prev, projectSavePath: chosen }));
      await exportSession({ targetPath: chosen, state: projectJson as unknown as SessionState });
      setStatus(`Project saved: ${chosen}`);
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session.projectSavePath, projectJson]);

  const handleStartRender = useCallback(async () => {
    setStatus('');
    setError(null);
    try {
      const path = session.projectSavePath;
      if (!path) {
        setError('Please save the project JSON first.');
        return;
      }
      await startRender(path);
      setStatus('Render job validated/started.');
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session.projectSavePath]);

  const handleExport = useCallback(async () => {
    const targetPath = window.prompt('Enter the destination path for the exported session file');

    if (!targetPath) {
      return;
    }

    setStatus('Exporting...');
    setError(null);

    try {
      await exportSession({ targetPath, state: session });
      setStatus(`Session exported to ${targetPath}.`);
    } catch (err: unknown) {
      setStatus('');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [session]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>MuvidGen Session</h1>
      <section style={{ margin: '1rem 0' }}>
        <h2>Audio</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" onClick={handleBrowseAudio}>Browse Audio</button>
          <span style={{ color: '#666' }}>{session.audioPath ?? 'No audio selected'}</span>
        </div>
      </section>

      <section style={{ margin: '1rem 0' }}>
        <h2>Videos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" onClick={handleBrowseVideos}>Browse Videos</button>
          <span style={{ color: '#666' }}>{(session.videoPaths?.length ?? 0)} selected</span>
        </div>
        {(session.videoPaths?.length ?? 0) > 0 && (
          <ul style={{ marginTop: '0.5rem' }}>
            {(session.videoPaths ?? []).map((p) => (
              <li key={p} title={p}>{p}</li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ margin: '1rem 0' }}>
        <h2>Project</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" onClick={handleSaveProjectAs}>Save Project As…</button>
          <span style={{ color: '#666' }}>{session.projectSavePath ?? 'No project path selected'}</span>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" onClick={handleStartRender} disabled={!session.projectSavePath}>Render</button>
        </div>
      </section>
      <label htmlFor="session-notes">Session Notes</label>
      <textarea
        id="session-notes"
        style={{ display: 'block', width: '100%', minHeight: '200px', marginTop: '0.5rem' }}
        value={String((session as any).notes ?? '')}
        onChange={handleNotesChange}
      />
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={handleSave}>
          Save Session
        </button>
        <button type="button" onClick={handleExport}>
          Export Session
        </button>
      </div>
      {status && <p style={{ color: 'green' }}>{status}</p>}
      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default App;
