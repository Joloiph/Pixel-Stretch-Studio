export type TextureType = 'none' | 'vhs' | 'scanlines' | 'currency' | 'canvas' | 'halftone' | 'linotype';
export type StretchMode = 'linear' | 'spiral' | 'geometric';
export type GeometricShape = 'circle' | 'square' | 'triangle' | 'pentagon' | 'star' | 'heart' | 'hypnotic';

export interface ProcessSettings {
  slicePosition: number; // 0 to 100 (percentage of image)
  sliceSize: number; // 1 to 500 (pixels)
  blurStrength: number; // 0 to 100
  direction: 'horizontal' | 'vertical';
  brightness: number; // 0.5 to 1.5
  contrast: number; // 0.5 to 1.5
  saturation: number; // 0 to 2
  noise: number; // 0 to 100
  opacity: number; // 0 to 1
  blendMode: GlobalCompositeOperation;
  texture: TextureType;
  textureIntensity: number; // 0 to 100
  textureScale: number; // 0.1 to 5
  
  // New settings for Spiral and Shapes
  stretchMode: StretchMode;
  geometricShape: GeometricShape;
  spiralTightness: number; // 0 to 20
  originX: number; // 0 to 100 (center point x)
  originY: number; // 0 to 100 (center point y)
}

export const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over',
  'lighten',
  'darken',
  'screen',
  'overlay',
  'multiply',
  'difference',
  'exclusion',
  'soft-light',
  'hard-light'
];