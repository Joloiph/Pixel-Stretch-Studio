import { ProcessSettings } from '../types';

export const processImage = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  settings: ProcessSettings
) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  // Set canvas size to match image size
  canvas.width = width;
  canvas.height = height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Original Image (Base Layer)
  ctx.drawImage(image, 0, 0);

  // Create an offscreen canvas for the effect layer
  const effectCanvas = document.createElement('canvas');
  effectCanvas.width = width;
  effectCanvas.height = height;
  const effectCtx = effectCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!effectCtx) return;

  // 2. Generate Effect Layer based on Mode
  if (settings.stretchMode === 'linear') {
    processLinearStretch(effectCtx, image, width, height, settings);
  } else {
    processAlgorithmicStretch(effectCtx, image, width, height, settings);
  }

  // 3. Apply Blur to Effect Layer
  if (settings.blurStrength > 0) {
    const blurPx = (settings.blurStrength / 100) * 100;
    
    // Use a temporary canvas to apply the blur filter efficiently
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if(tempCtx) {
        tempCtx.filter = `blur(${blurPx}px)`;
        tempCtx.drawImage(effectCanvas, 0, 0);
        
        effectCtx.clearRect(0, 0, width, height);
        effectCtx.drawImage(tempCanvas, 0, 0);
    }
  }

  // 4. Color Adjustments and Compositing
  const brightness = settings.brightness * 100;
  const contrast = settings.contrast * 100;
  const saturate = settings.saturation * 100;
  
  ctx.globalCompositeOperation = settings.blendMode;
  ctx.globalAlpha = settings.opacity;
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
  
  ctx.drawImage(effectCanvas, 0, 0);

  // Reset context for post-processing
  ctx.filter = 'none';
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';

  // 5. Apply Textures
  if (settings.texture && settings.texture !== 'none' && settings.textureIntensity > 0) {
    applyTexture(
      ctx, 
      width, 
      height, 
      settings.texture, 
      settings.textureIntensity,
      settings.textureScale || 1
    );
  }

  // 6. Add Noise (Grain)
  if (settings.noise > 0) {
    applyNoise(ctx, width, height, settings.noise);
  }
};

// --- Linear Stretch Implementation (Existing Logic) ---
const processLinearStretch = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
  settings: ProcessSettings
) => {
  let sx, sy, sw, sh, dx, dy, dw, dh;

  if (settings.direction === 'horizontal') {
    const sourceX = Math.floor((settings.slicePosition / 100) * (w - 1));
    const width = Math.max(1, settings.sliceSize);
    
    sx = sourceX; sy = 0; sw = width; sh = h;
    dx = 0; dy = 0; dw = w; dh = h;
  } else {
    const sourceY = Math.floor((settings.slicePosition / 100) * (h - 1));
    const height = Math.max(1, settings.sliceSize);
    
    sx = 0; sy = sourceY; sw = w; sh = height;
    dx = 0; dy = 0; dw = w; dh = h;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
};

// --- Spiral & Geometric Stretch Implementation (Pixel Manipulation) ---
const processAlgorithmicStretch = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
  settings: ProcessSettings
) => {
  // 1. Extract Source Slice Data
  // We need a 1D array of colors representing the "line" we are stretching.
  // We'll use a temporary canvas to get this data safely.
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.drawImage(image, 0, 0);

  let sourceData: Uint8ClampedArray;
  let sourceLength: number;
  let isVerticalSlice = settings.direction === 'horizontal'; // Horizontal stretch uses a Vertical slice

  if (isVerticalSlice) {
    // Extract vertical column at slicePosition
    const sliceX = Math.floor((settings.slicePosition / 100) * (w - 1));
    const sliceData = tempCtx.getImageData(sliceX, 0, 1, h).data;
    sourceData = sliceData;
    sourceLength = h;
  } else {
    // Extract horizontal row at slicePosition
    const sliceY = Math.floor((settings.slicePosition / 100) * (h - 1));
    const sliceData = tempCtx.getImageData(0, sliceY, w, 1).data;
    sourceData = sliceData;
    sourceLength = w;
  }

  // 2. Prepare Target Image Data
  const targetImageData = ctx.createImageData(w, h);
  const data = targetImageData.data;

  // Center Point for patterns
  const cx = (settings.originX !== undefined ? settings.originX / 100 : 0.5) * w;
  const cy = (settings.originY !== undefined ? settings.originY / 100 : 0.5) * h;
  const maxDist = Math.sqrt(w * w + h * h) * 0.6; // Approximate max radius

  // 3. Pixel Loop
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      
      // Calculate coordinates relative to center
      const dx = x - cx;
      const dy = y - cy;
      
      let sourceIndex = 0;

      if (settings.stretchMode === 'spiral') {
        // --- SPIRAL LOGIC ---
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx); // -PI to PI
        
        // Map angle to 0-1 range
        let normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
        
        // Spiral formula: radius + angle * tightness
        // We want to map this value to the source array index
        
        // Twist factor
        const twist = settings.spiralTightness * 50;
        
        // Calculate offset in source array
        let samplePos = dist + (normalizedAngle * twist);
        
        // Wrap or Clamp? Usually pixel stretch wraps or repeats.
        // Let's mirror it for smoother look
        sourceIndex = Math.floor(samplePos) % (sourceLength * 2);
        if (sourceIndex >= sourceLength) sourceIndex = (sourceLength * 2) - sourceIndex - 1;
        
      } else if (settings.stretchMode === 'geometric') {
        // --- GEOMETRIC SHAPES LOGIC ---
        let dist = 0;
        
        switch (settings.geometricShape) {
          case 'circle':
            dist = Math.sqrt(dx * dx + dy * dy);
            break;
          case 'square':
            dist = Math.max(Math.abs(dx), Math.abs(dy));
            break;
          case 'triangle':
            // Equilateral triangle distance approximation
            // const k = Math.sqrt(3);
            // dist = Math.max(Math.abs(dx) * k + dy, -dy * 2) / 2; (Standard SDF)
            // Let's do a simpler 3-sided symmetry
            const angleT = Math.atan2(dy, dx) + Math.PI / 2;
            const rT = Math.sqrt(dx * dx + dy * dy);
            // 3 sectors
            const sector = (Math.floor((angleT + Math.PI) / (2 * Math.PI / 3)) + 3) % 3;
            // Map to edge distance?
            // Simple visual hack: 
             dist = Math.max(Math.abs(dx) * 0.866025 + dy * 0.5, -dy);
             if (settings.direction === 'vertical') dist = Math.max(Math.abs(dy) * 0.866025 + dx * 0.5, -dx);
            break;
          case 'pentagon':
             // Polar coordinates approach for regular polygons
             const angleP = Math.atan2(dy, dx);
             const rP = Math.sqrt(dx * dx + dy * dy);
             const sides = 5;
             const a = Math.atan(Math.tan(angleP * sides / 2)); // Not quite right for drawing
             // Correct generic regular polygon distance:
             const ang = Math.atan2(dy, dx) + Math.PI / 2;
             const segment = (Math.PI * 2) / 5;
             const localAng = Math.abs((ang % segment) - (segment / 2));
             dist = rP * Math.cos(localAng);
             break;
          case 'star':
             const angleS = Math.atan2(dy, dx);
             const rS = Math.sqrt(dx * dx + dy * dy);
             // Perturb radius with cosine
             dist = rS * (1 + 0.3 * Math.cos(5 * angleS));
             break;
           case 'heart':
             // Heart shape approximation
             // (x^2 + y^2 - 1)^3 - x^2*y^3 = 0
             // Visual hack: modify Y based on X
             const ah = Math.atan2(-dy, dx); // flip y for heart orientation
             const rh = Math.sqrt(dx*dx + dy*dy);
             dist = rh - rh * 0.4 * Math.sin(ah) * Math.sqrt(Math.abs(Math.cos(ah))); 
             break;
           case 'hypnotic':
             const rhyp = Math.sqrt(dx * dx + dy * dy);
             dist = rhyp + 20 * Math.sin(rhyp / 20);
             break;
          default:
            dist = Math.sqrt(dx * dx + dy * dy);
        }

        // Scale dist slightly to match linear feel
        sourceIndex = Math.floor(dist) % sourceLength;
      }

      // Safety clamp
      sourceIndex = Math.max(0, Math.min(Math.floor(sourceIndex), sourceLength - 1));

      // Map to source data
      const srcBase = sourceIndex * 4;
      data[idx] = sourceData[srcBase];
      data[idx + 1] = sourceData[srcBase + 1];
      data[idx + 2] = sourceData[srcBase + 2];
      data[idx + 3] = sourceData[srcBase + 3];
    }
  }

  ctx.putImageData(targetImageData, 0, 0);
};

// --- Texture & Noise Helpers (Existing) ---
const applyTexture = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  type: string, 
  intensity: number,
  scale: number
) => {
  const alpha = intensity / 100;
  ctx.save();
  
  // Ensure scale is reasonable
  const s = Math.max(0.1, scale);

  if (type === 'scanlines') {
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
    const step = Math.max(2, 4 * s);
    const thickness = Math.max(1, 2 * s);
    for (let y = 0; y < height; y += step) {
      ctx.fillRect(0, y, width, thickness);
    }
  } 
  else if (type === 'vhs') {
    // 1. Scanlines
    ctx.fillStyle = `rgba(10, 10, 10, ${alpha * 0.3})`;
    const step = Math.max(2, 3 * s);
    const thickness = Math.max(1, 1 * s);
    for (let y = 0; y < height; y += step) {
      ctx.fillRect(0, y, width, thickness);
    }
    
    // 2. Chromatic Aberration
    if (alpha > 0.1) {
      const shift = Math.max(2, Math.floor(alpha * 10 * s));
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.drawImage(ctx.canvas, -shift, 0);
      ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
      ctx.drawImage(ctx.canvas, shift, 0);
    }
  } 
  else if (type === 'currency') {
    // Angled lines
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
    ctx.lineWidth = Math.max(1, 1 * s);
    ctx.beginPath();
    const step = Math.max(3, 6 * s);
    for (let x = -height; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
    }
    ctx.stroke();
  } 
  else if (type === 'halftone') {
    // Dot matrix
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.6})`;
    const step = Math.max(4, 8 * s);
    const radius = step * 0.35;
    for (let y = 0; y < height; y += step) {
      // Stagger rows
      const row = Math.floor(y / step);
      const xOffset = (row % 2) * (step / 2);
      for (let x = -step; x < width; x += step) {
        ctx.beginPath();
        ctx.arc(x + xOffset, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  else if (type === 'linotype') {
    // Horizontal Line Screen (like print)
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
    const step = Math.max(4, 6 * s);
    const thickness = step * 0.5;
    for (let y = 0; y < height; y += step) {
      ctx.fillRect(0, y, width, thickness);
    }
  }
  else if (type === 'canvas') {
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 256; 
    noiseCanvas.height = 256;
    const nCtx = noiseCanvas.getContext('2d');
    if (nCtx) {
        const id = nCtx.createImageData(256, 256);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const val = Math.random() * 255;
            d[i] = val;
            d[i+1] = val;
            d[i+2] = val;
            d[i+3] = 100; 
        }
        nCtx.putImageData(id, 0, 0);
        
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = alpha;
        
        ctx.save();
        ctx.scale(s, s);
        const ptrn = ctx.createPattern(noiseCanvas, 'repeat');
        if (ptrn) {
            ctx.fillStyle = ptrn;
            // Draw a rect large enough to cover the canvas when scaled
            ctx.fillRect(0, 0, width / s, height / s);
        }
        ctx.restore();
    }
  }

  ctx.restore();
};

const applyNoise = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = amount * 2;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * factor; 
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
};

export const downloadCanvas = (canvas: HTMLCanvasElement, filename = 'pixel-stretch-art.png') => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
};