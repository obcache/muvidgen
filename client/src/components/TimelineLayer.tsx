import React, { useMemo } from 'react';
import { clamp } from '../utils/timelineMath';
import { useTimeline } from '../context/TimelineContext';
import type { Clip, Layer } from '../utils/timelineTypes';

type TimelineLayerProps = {
  layer: Layer;
  pixelsPerSecond: number;
  offsetY: number;
  totalDuration: number;
  onStartInteraction(
    clip: Clip,
    mode: 'move' | 'resize:start' | 'resize:end',
    event: React.PointerEvent<SVGRectElement>,
  ): void;
};

const clipStrokeWidth = 2;
const resizeHandleWidth = 6;

export const TimelineLayer: React.FC<TimelineLayerProps> = ({
  layer,
  pixelsPerSecond,
  offsetY,
  totalDuration,
  onStartInteraction,
}) => {
  const {
    selectedClipId,
    actions: { selectClip },
  } = useTimeline();

  const extent = useMemo(() => {
    const end = layer.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    return Math.max(totalDuration, end + 4);
  }, [layer.clips, totalDuration]);

  return (
    <g transform={`translate(0, ${offsetY + layer.height})`}>
      <rect
        x={0}
        y={-layer.height}
        width={extent * pixelsPerSecond}
        height={layer.height}
        fill="#0f172a"
        stroke="#1f2937"
      />
      <text
        x={12}
        y={-layer.height + 18}
        fill="#94a3b8"
        fontSize={14}
        fontWeight={600}
      >
        {layer.name}
      </text>
      {layer.clips.map((clip) => {
        const x = clip.start * pixelsPerSecond;
        const width = Math.max(clip.duration * pixelsPerSecond, resizeHandleWidth * 2 + 4);
        const isSelected = selectedClipId === clip.id;
        return (
          <g key={clip.id} transform={`translate(${x}, ${-layer.height + clipStrokeWidth})`}>
            <rect
              role="button"
              x={0}
              y={0}
              width={width}
              height={layer.height - clipStrokeWidth * 2}
              rx={8}
              ry={8}
              fill={clip.color ?? '#4ade80'}
              stroke={isSelected ? '#f97316' : '#1e293b'}
              strokeWidth={clipStrokeWidth}
              onPointerDown={(event) => {
                event.stopPropagation();
                onStartInteraction(clip, 'move', event);
              }}
              onClick={(event) => {
                event.stopPropagation();
                selectClip(clip.id);
              }}
            />
            <rect
              x={0}
              y={0}
              width={resizeHandleWidth}
              height={layer.height - clipStrokeWidth * 2}
              fill="rgba(0,0,0,0.15)"
              onPointerDown={(event) => {
                event.stopPropagation();
                onStartInteraction(clip, 'resize:start', event);
              }}
            />
            <rect
              x={width - resizeHandleWidth}
              y={0}
              width={resizeHandleWidth}
              height={layer.height - clipStrokeWidth * 2}
              fill="rgba(0,0,0,0.15)"
              onPointerDown={(event) => {
                event.stopPropagation();
                onStartInteraction(clip, 'resize:end', event);
              }}
            />
            <text
              x={clamp(width / 2, 8, width - 8)}
              y={(layer.height - clipStrokeWidth * 2) / 2}
              textAnchor="middle"
              alignmentBaseline="middle"
              fill="#0f172a"
              fontSize={12}
              fontWeight={600}
            >
              {clip.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};
