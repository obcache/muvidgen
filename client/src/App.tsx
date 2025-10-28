import { useCallback, useEffect, useState } from 'react';
import { exportSession, loadSessionState, saveSessionState } from './state/storage';
import type { SessionState } from './types/session';

const defaultState: SessionState = { notes: '' };

const App = () => {
  const [session, setSession] = useState<SessionState>(defaultState);
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
      setSession((prev) => ({ ...prev, notes: value }));
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
      <label htmlFor="session-notes">Session Notes</label>
      <textarea
        id="session-notes"
        style={{ display: 'block', width: '100%', minHeight: '200px', marginTop: '0.5rem' }}
        value={String(session.notes ?? '')}
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
