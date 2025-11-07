import { useCallback, useMemo, useState } from 'react';

export interface StoryboardProps {
  paths: string[];
  onChange: (next: string[]) => void;
}

const fileName = (p: string) => {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
};

const colorFor = (key: string) => {
  // Simple, stable hashing to color via HSL
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 60% 50%)`;
};

const reorder = (arr: string[], from: number, to: number) => {
  const a = arr.slice();
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
};

const Storyboard = ({ paths, onChange }: StoryboardProps) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const items = useMemo(() => paths.map((p, i) => ({ path: p, index: i })), [paths]);

  const onDragStart = useCallback((idx: number, e: React.DragEvent<HTMLDivElement>) => {
    setDragFrom(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((toIdx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromStr = e.dataTransfer.getData('text/plain');
    const fromIdx = Number(fromStr);
    if (Number.isFinite(fromIdx) && fromIdx !== toIdx) {
      onChange(reorder(paths, fromIdx, toIdx));
    }
    setDragFrom(null);
  }, [onChange, paths]);

  const removeAt = useCallback((idx: number) => {
    const next = paths.slice();
    next.splice(idx, 1);
    onChange(next);
  }, [onChange, paths]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, border: '1px solid #333', borderRadius: 4, background: '#0b0b0b' }}>
      {items.map((item) => (
        <div
          key={item.path + ':' + item.index}
          title={item.path}
          draggable
          onDragStart={(e) => onDragStart(item.index, e)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(item.index, e)}
          style={{
            cursor: 'move',
            userSelect: 'none',
            padding: '6px 28px 6px 8px',
            borderRadius: 4,
            background: colorFor(item.path),
            color: 'white',
            minWidth: 120,
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            position: 'relative',
            opacity: dragFrom === item.index ? 0.6 : 1,
          }}
        >
          <span style={{ fontWeight: 600 }}>{fileName(item.path)}</span>
          <button
            type="button"
            aria-label={`Remove ${fileName(item.path)}`}
            onClick={(e) => { e.stopPropagation(); removeAt(item.index); }}
            title="Remove clip"
            style={{
              position: 'absolute',
              right: 6,
              top: 4,
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              border: 'none',
              borderRadius: 3,
              width: 20,
              height: 20,
              lineHeight: '20px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
      {paths.length === 0 && (
        <div style={{ color: '#777' }}>No clips. Use “Browse Videos” to add files.</div>
      )}
    </div>
  );
};

export default Storyboard;

