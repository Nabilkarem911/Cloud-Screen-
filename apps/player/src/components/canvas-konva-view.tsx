'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Ellipse, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import useImage from 'use-image';
import {
  type CanvasLayoutV1,
  type CanvasObjectJson,
  parseCanvasLayout,
} from '@/types/canvas-layout';

type Props = {
  designWidth: number;
  designHeight: number;
  layoutData: unknown;
  liveOverride?: unknown | null;
};

function CanvasImageNode({ obj }: { obj: CanvasObjectJson }) {
  const [img] = useImage(obj.imageUrl ?? '', 'anonymous');
  if (!img || !obj.width || !obj.height) return null;
  return (
    <KonvaImage
      image={img}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation ?? 0}
      opacity={obj.opacity ?? 1}
      scaleX={obj.scaleX ?? 1}
      scaleY={obj.scaleY ?? 1}
    />
  );
}

function ObjectNode({ obj }: { obj: CanvasObjectJson }) {
  const common = {
    rotation: obj.rotation ?? 0,
    opacity: obj.opacity ?? 1,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
  };

  if (obj.type === 'rect') {
    return (
      <Rect
        x={obj.x}
        y={obj.y}
        width={obj.width ?? 120}
        height={obj.height ?? 80}
        fill={obj.fill ?? '#4b0082'}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth ?? 0}
        cornerRadius={obj.cornerRadius ?? 0}
        {...common}
      />
    );
  }
  if (obj.type === 'ellipse') {
    const rw = (obj.width ?? 120) / 2;
    const rh = (obj.height ?? 80) / 2;
    return (
      <Ellipse
        x={obj.x + rw}
        y={obj.y + rh}
        radiusX={rw}
        radiusY={rh}
        fill={obj.fill ?? '#4b0082'}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth ?? 0}
        {...common}
      />
    );
  }
  if (obj.type === 'text') {
    return (
      <Text
        x={obj.x}
        y={obj.y}
        text={obj.text ?? ''}
        fontSize={obj.fontSize ?? 48}
        fontFamily={
          obj.fontFamily ??
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif'
        }
        fontStyle={obj.fontStyle ?? 'normal'}
        fill={obj.fill ?? '#ffd700'}
        align={obj.align ?? 'left'}
        verticalAlign={obj.verticalAlign ?? 'top'}
        width={obj.width}
        height={obj.height}
        {...common}
      />
    );
  }
  if (obj.type === 'image') {
    return <CanvasImageNode obj={obj} />;
  }
  return null;
}

export function CanvasKonvaView({ designWidth, designHeight, layoutData, liveOverride }: Props) {
  const doc: CanvasLayoutV1 = useMemo(
    () => parseCanvasLayout(liveOverride ?? layoutData),
    [layoutData, liveOverride],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(size.w / designWidth, size.h / designHeight, 4);
  const ox = (size.w - designWidth * scale) / 2;
  const oy = (size.h - designHeight * scale) / 2;

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center bg-black">
      <Stage width={size.w} height={size.h}>
        <Layer>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="#030712" />
          <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
            <Rect x={0} y={0} width={designWidth} height={designHeight} fill="#030712" />
            {doc.objects.map((obj) => (
              <ObjectNode key={obj.id} obj={obj} />
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
