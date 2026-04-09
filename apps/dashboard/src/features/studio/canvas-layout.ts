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

export function emptyLayout(): CanvasLayoutV1 {
  return { version: 1, objects: [] };
}
