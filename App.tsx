import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RefreshCw, Image as ImageIcon, Zap, Layers, Sliders, Maximize2, MoveHorizontal, MoveVertical, ScanLine, Wand2, Tv, Banknote, Brush, Monitor, Grid, AlignJustify, Circle, Triangle, Pentagon, Star, Sparkles, AlertCircle, Fingerprint } from 'lucide-react';
import { Button } from './components/Button';
import { Slider } from './components/Slider';
import { processImage, downloadCanvas } from './utils/imageProcessor';
import { ProcessSettings, BLEND_MODES, TextureType, StretchMode, GeometricShape } from './types';

// Default Demo Image (Abstract Gradient)
const DEMO_IMAGE = "https://picsum.photos/1200/800";

// --- Preset Definitions ---

const STRETCH_PRESETS: { name: string; settings: Partial<ProcessSettings> }[] = [
  { name: 'Linear Beam', settings: { stretchMode: 'linear', direction: 'horizontal', sliceSize: 60, slicePosition: 50 } },
  { name: 'Spiral Galaxy', settings: { stretchMode: 'spiral', spiralTightness: 5, slicePosition: 50, originX: 50, originY: 50 } },
  { name: 'Pixel Star', settings: { stretchMode: 'geometric', geometricShape: 'star', slicePosition: 30, originX: 50, originY: 50 } },
  { name: 'Hex Tunnel', settings: { stretchMode: 'geometric', geometricShape: 'pentagon', slicePosition: 70, originX: 50, originY: 50 } },
  { name: 'Hypnosis', settings: { stretchMode: 'geometric', geometricShape: 'hypnotic', slicePosition: 40, originX: 50, originY: 50 } },
  { name: 'Heart Core', settings: { stretchMode: 'geometric', geometricShape: 'heart', slicePosition: 50, originX: 50, originY: 60 } },
];

const STYLE_PRESETS: { name: string; settings: Partial<ProcessSettings> }[] = [
  { name: 'Standard', settings: { blurStrength: 20, noise: 15, blendMode: 'source-over', opacity: 1, brightness: 1.1, contrast: 1.2, saturation: 1.5, texture: 'none', textureScale: 1 } },
  { name: 'Ethereal', settings: { blurStrength: 60, noise: 5, blendMode: 'screen', opacity: 0.8, brightness: 1.3, contrast: 1.0, saturation: 0.8, texture: 'canvas', textureIntensity: 30, textureScale: 1.5 } },
  { name: 'Cyberpunk', settings: { blurStrength: 0, noise: 45, blendMode: 'hard-light', opacity: 1, brightness: 1.1, contrast: 1.5, saturation: 1.8, texture: 'scanlines', textureIntensity: 50, textureScale: 1 } },
  { name: 'Retro VHS', settings: { blurStrength: 10, noise: 30, blendMode: 'lighten', opacity: 0.9, brightness: 1.2, contrast: 1.1, saturation: 1.3, texture: 'vhs', textureIntensity: 60, textureScale: 1.2 } },
  { name: 'Minted', settings: { blurStrength: 0, noise: 10, blendMode: 'overlay', opacity: 1, brightness: 1.0, contrast: 1.4, saturation: 0.5, texture: 'currency', textureIntensity: 40, textureScale: 1 } },
  { name: 'Soft Focus', settings: { blurStrength: 30, noise: 8, blendMode: 'overlay', opacity: 1, brightness: 1.1, contrast: 1.1, saturation: 1.2, texture: 'none', textureScale: 1 } },
];

const TEXTURE_OPTIONS: { id: TextureType; label: string; icon: React.ReactNode }[] = [
  { id: 'none', label: 'None', icon: <div className="w-4 h-4 border border-gray-500 rounded-sm bg-gray-900" /> },
  { id: 'scanlines', label: 'Scanlines', icon: <Monitor className="w-4 h-4" /> },
  { id: 'vhs', label: 'VHS Tape', icon: <Tv className="w-4 h-4" /> },
  { id: 'currency', label: 'Currency', icon: <Banknote className="w-4 h-4" /> },
  { id: 'halftone', label: 'Halftone', icon: <Grid className="w-4 h-4" /> },
  { id: 'linotype', label: 'Linotype', icon: <AlignJustify className="w-4 h-4" /> },
  { id: 'canvas', label: 'Canvas', icon: <Brush className="w-4 h-4" /> },
];

const SHAPE_OPTIONS: { id: GeometricShape; label: string; icon: React.ReactNode }[] = [
  { id: 'circle', label: 'Circle', icon: <Circle className="w-4 h-4" /> },
  { id: 'square', label: 'Square', icon: <div className="w-3 h-3 border-2 border-current" /> },
  { id: 'triangle', label: 'Triangle', icon: <Triangle className="w-4 h-4" /> },
  { id: 'pentagon', label: 'Pentagon', icon: <Pentagon className="w-4 h-4" /> },
  { id: 'star', label: 'Star', icon: <Star className="w-4 h-4" /> },
  { id: 'heart', label: 'Heart', icon: <div className="text-xs">♥</div> },
  { id: 'hypnotic', label: 'Hypnotic', icon: <Fingerprint className="w-4 h-4" /> },
];

const App: React.FC = () => {
  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<ProcessSettings>({
    slicePosition: 50,
    sliceSize: 1,
    blurStrength: 20,
    direction: 'horizontal',
    brightness: 1.1,
    contrast: 1.2,
    saturation: 1.5,
    noise: 15,
    opacity: 1,
    blendMode: 'source-over',
    texture: 'none',
    textureIntensity: 50,
    textureScale: 1,
    stretchMode: 'linear',
    geometricShape: 'circle',
    spiralTightness: 2,
    originX: 50,
    originY: 50
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(new Image());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with demo image
  useEffect(() => {
    const img = imageRef.current;
    img.crossOrigin = "Anonymous";
    img.src = DEMO_IMAGE;
    img.onload = () => {
        setImageSrc(DEMO_IMAGE);
    };
  }, []);

  // Handle Image Process
  const handleProcess = useCallback(() => {
    if (!canvasRef.current || !imageSrc) return;
    const img = imageRef.current;
    
    // Ensure image is loaded
    if (!img.complete) return;

    setIsProcessing(true);
    // Use RequestAnimationFrame to prevent UI locking
    requestAnimationFrame(() => {
      processImage(canvasRef.current!, img, settings);
      setIsProcessing(false);
    });
  }, [imageSrc, settings]);

  // Trigger process on settings change
  useEffect(() => {
    handleProcess();
  }, [handleProcess]);

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const result = event.target.result as string;
          imageRef.current.src = result;
          setImageSrc(result);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const updateSetting = (key: keyof ProcessSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetSettings: Partial<ProcessSettings>) => {
    setSettings(prev => ({ ...prev, ...presetSettings }));
  };

  const randomize = () => {
    const randomTexture = TEXTURE_OPTIONS[Math.floor(Math.random() * TEXTURE_OPTIONS.length)].id;
    const randomBlendMode = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
    const randomMode = ['linear', 'linear', 'spiral', 'geometric'][Math.floor(Math.random() * 4)] as StretchMode;
    const randomShape = SHAPE_OPTIONS[Math.floor(Math.random() * SHAPE_OPTIONS.length)].id;

    setSettings({
      slicePosition: Math.random() * 100,
      sliceSize: Math.floor(Math.random() * 300) + 1,
      blurStrength: Math.random() * 100,
      direction: Math.random() > 0.5 ? 'horizontal' : 'vertical',
      brightness: 0.5 + Math.random() * 1.5,
      contrast: 0.5 + Math.random() * 1.5,
      saturation: Math.random() * 3,
      noise: Math.random() * 100,
      opacity: 0.4 + (Math.random() * 0.6),
      blendMode: randomBlendMode,
      texture: randomTexture,
      textureIntensity: Math.random() * 100,
      textureScale: 0.2 + Math.random() * 4.8,
      stretchMode: randomMode,
      geometricShape: randomShape,
      spiralTightness: Math.random() * 10,
      originX: 20 + Math.random() * 60,
      originY: 20 + Math.random() * 60
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#09090b] text-gray-100 overflow-hidden">
      
      {/* Sidebar / Controls */}
      <aside className="w-full md:w-[400px] flex-shrink-0 border-r border-gray-800 bg-[#121214] flex flex-col h-screen overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2">
            <Zap className="text-emerald-500" />
            PixelStretch
          </h1>
          <p className="text-sm text-gray-500 mt-1">Generative Motion Blur Studio</p>
        </div>

        {/* Upload Section */}
        <div className="p-6 border-b border-gray-800">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <Button 
            variant="secondary" 
            className="w-full py-6 border-dashed border-2 border-gray-700 bg-gray-900/50 hover:bg-gray-800 hover:border-emerald-500/50 group transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-gray-400 group-hover:text-emerald-400 transition-colors" />
              <span className="text-sm text-gray-400">Upload Source Image</span>
            </div>
          </Button>
        </div>

        {/* Controls Container */}
        <div className="p-6 space-y-8 pb-24">

          {/* Preset Libraries */}
          <section className="space-y-4">
             {/* Stretch Patterns */}
             <div>
                <div className="flex items-center gap-2 mb-3 text-emerald-400 font-medium">
                  <ScanLine className="w-4 h-4" />
                  <h2>Stretch Presets</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STRETCH_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset.settings)}
                      className="px-3 py-2 text-xs font-medium bg-gray-800 hover:bg-gray-700 hover:text-emerald-400 text-gray-300 rounded border border-gray-700 transition-colors text-left truncate flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                      {preset.name}
                    </button>
                  ))}
                </div>
             </div>

             {/* Style Presets */}
             <div className="pt-2">
                <div className="flex items-center gap-2 mb-3 text-emerald-400 font-medium">
                  <Wand2 className="w-4 h-4" />
                  <h2>Art Styles</h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset.settings)}
                      className="px-2 py-2 text-xs font-medium bg-gray-800 hover:bg-gray-700 hover:text-emerald-400 text-gray-300 rounded border border-gray-700 transition-colors text-center truncate"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
             </div>
          </section>
          
          <div className="h-px bg-gray-800" />

          {/* Main Effect Controls */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-medium">
              <Maximize2 className="w-4 h-4" />
              <h2>Geometry & Stretch</h2>
            </div>
            
            {/* Stretch Mode Selector */}
             <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { id: 'linear', label: 'Linear', icon: <MoveHorizontal className="w-4 h-4"/> },
                { id: 'spiral', label: 'Spiral', icon: <AlertCircle className="w-4 h-4"/> }, // Using AlertCircle as pseudo-spiral icon
                { id: 'geometric', label: 'Shapes', icon: <Sparkles className="w-4 h-4"/> }
              ].map((mode) => (
                <button 
                  key={mode.id}
                  onClick={() => updateSetting('stretchMode', mode.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded text-xs font-medium transition-all ${settings.stretchMode === mode.id ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            {settings.stretchMode === 'linear' && (
              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => updateSetting('direction', 'horizontal')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-all ${settings.direction === 'horizontal' ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  <MoveHorizontal className="w-4 h-4" /> Horizontal
                </button>
                <button 
                  onClick={() => updateSetting('direction', 'vertical')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-all ${settings.direction === 'vertical' ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  <MoveVertical className="w-4 h-4" /> Vertical
                </button>
              </div>
            )}

            {settings.stretchMode === 'geometric' && (
               <div className="mb-6">
                 <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Shape Pattern</label>
                 <div className="grid grid-cols-4 gap-2">
                   {SHAPE_OPTIONS.map(opt => (
                     <button
                       key={opt.id}
                       onClick={() => updateSetting('geometricShape', opt.id)}
                       className={`flex flex-col items-center justify-center p-2 rounded border text-xs transition-all ${
                         settings.geometricShape === opt.id 
                           ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' 
                           : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                       }`}
                     >
                       {opt.icon}
                     </button>
                   ))}
                 </div>
               </div>
            )}

            {(settings.stretchMode === 'spiral' || settings.stretchMode === 'geometric') && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Slider 
                  label="Center X" 
                  value={Math.round(settings.originX)} 
                  min={0} max={100} 
                  onChange={(v) => updateSetting('originX', v)}
                  unit="%" 
                />
                <Slider 
                  label="Center Y" 
                  value={Math.round(settings.originY)} 
                  min={0} max={100} 
                  onChange={(v) => updateSetting('originY', v)}
                  unit="%" 
                />
              </div>
            )}

            {settings.stretchMode === 'spiral' && (
              <Slider 
                label="Spiral Twist" 
                value={parseFloat(settings.spiralTightness.toFixed(1))} 
                min={0} max={10} step={0.1}
                onChange={(v) => updateSetting('spiralTightness', v)} 
              />
            )}

            <Slider 
              label="Slice Origin" 
              value={Math.round(settings.slicePosition)} 
              min={0} max={100} 
              onChange={(v) => updateSetting('slicePosition', v)}
              unit="%" 
            />
            {settings.stretchMode === 'linear' && (
              <Slider 
                label="Slice Thickness" 
                value={settings.sliceSize} 
                min={1} max={300} 
                onChange={(v) => updateSetting('sliceSize', v)}
                unit="px" 
              />
            )}
            <Slider 
              label="Motion Blur" 
              value={Math.round(settings.blurStrength)} 
              min={0} max={100} 
              onChange={(v) => updateSetting('blurStrength', v)}
              unit="%" 
            />
          </section>

          {/* Color & Texture */}
          <section>
             <div className="flex items-center gap-2 mb-4 text-emerald-400 font-medium">
              <Sliders className="w-4 h-4" />
              <h2>Color & Texture</h2>
            </div>

            <div className="mb-6">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Texture Overlay</label>
              <div className="grid grid-cols-3 gap-2">
                {TEXTURE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => updateSetting('texture', option.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded border text-xs transition-all ${
                      settings.texture === option.id 
                        ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.texture !== 'none' && (
              <div className="space-y-4 mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-800">
                <Slider 
                  label="Texture Intensity" 
                  value={Math.round(settings.textureIntensity)} 
                  min={0} max={100} 
                  onChange={(v) => updateSetting('textureIntensity', v)}
                  unit="%" 
                />
                <Slider 
                  label="Texture Scale" 
                  value={parseFloat(settings.textureScale.toFixed(1))} 
                  min={0.1} max={5} step={0.1}
                  onChange={(v) => updateSetting('textureScale', v)}
                  unit="x" 
                />
              </div>
            )}

            <Slider 
              label="Brightness" 
              value={parseFloat(settings.brightness.toFixed(2))} 
              min={0} max={2} step={0.1}
              onChange={(v) => updateSetting('brightness', v)} 
            />
            <Slider 
              label="Contrast" 
              value={parseFloat(settings.contrast.toFixed(2))} 
              min={0} max={2} step={0.1}
              onChange={(v) => updateSetting('contrast', v)} 
            />
            <Slider 
              label="Saturation" 
              value={parseFloat(settings.saturation.toFixed(2))} 
              min={0} max={3} step={0.1}
              onChange={(v) => updateSetting('saturation', v)} 
            />
             <Slider 
              label="Noise / Grain" 
              value={Math.round(settings.noise)} 
              min={0} max={100} 
              onChange={(v) => updateSetting('noise', v)}
              unit="%" 
            />
          </section>

          {/* Blending */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-emerald-400 font-medium">
              <Layers className="w-4 h-4" />
              <h2>Composition</h2>
            </div>
             <Slider 
              label="Effect Opacity" 
              value={parseFloat(settings.opacity.toFixed(2))} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateSetting('opacity', v)} 
            />
            
            <div className="mt-4">
               <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Blend Mode</label>
               <select 
                  className="w-full bg-gray-800 border-none rounded p-2 text-sm text-gray-200 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  value={settings.blendMode}
                  onChange={(e) => updateSetting('blendMode', e.target.value)}
                >
                  {BLEND_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                  ))}
               </select>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div className="mt-auto p-6 border-t border-gray-800 bg-[#121214] flex gap-3 sticky bottom-0 z-10">
          <Button variant="secondary" onClick={randomize} className="flex-1" icon={<RefreshCw className="w-4 h-4"/>}>
            Randomize
          </Button>
           <Button onClick={() => canvasRef.current && downloadCanvas(canvasRef.current)} className="flex-[2]" icon={<Download className="w-4 h-4"/>}>
            Export
          </Button>
        </div>

      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 bg-[#09090b] relative flex items-center justify-center p-4 md:p-8 overflow-hidden h-[50vh] md:h-screen">
        
        {/* Grid Background Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
        />

        {/* Canvas Container */}
        <div className="relative shadow-2xl shadow-black/50 border border-gray-800 bg-black max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-sm">
          {!imageSrc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 z-10">
              <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
              <p>No Image Loaded</p>
            </div>
          )}
          <canvas 
            ref={canvasRef}
            className="max-w-full max-h-[80vh] object-contain cursor-crosshair"
            style={{ 
              maxWidth: '100%', 
              maxHeight: 'calc(100vh - 80px)', // Account for padding
              imageRendering: 'pixelated' // Optional: for sharper preview if low res
            }} 
          />
        </div>
        
        {/* Loading Indicator */}
        {isProcessing && (
          <div className="absolute bottom-8 right-8 bg-black/80 text-emerald-400 px-4 py-2 rounded-full text-xs font-mono backdrop-blur-md border border-emerald-900/30 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            PROCESSING
          </div>
        )}

      </main>
    </div>
  );
};

export default App;