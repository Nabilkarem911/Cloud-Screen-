export type CanvasObjectJson = {
  id: string;
  type: 'text' | 'image' | 'rect' | 'ellipse';
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  imageUrl?: string;
  mediaId?: string;
};

export type CanvasLayoutV1 = {
  version: 1;
  objects: CanvasObjectJson[];
};

export function parseCanvasLayout(raw: unknown): CanvasLayoutV1 {
  if (typeof raw !== 'object' || raw === null) {
    return { version: 1, objects: [] };
  }
  const o = raw as Record<string, unknown>;
  if (o.version === 1 && Array.isArray(o.objects)) {
    return { version: 1, objects: o.objects as CanvasObjectJson[] };
  }
  return { version: 1, objects: [] };
}

export function extractImageUrlsFromLayout(layout: unknown): string[] {
  const doc = parseCanvasLayout(layout);
  return doc.objects
    .filter((obj) => obj.type === 'image' && obj.imageUrl)
    .map((obj) => obj.imageUrl as string);
}
