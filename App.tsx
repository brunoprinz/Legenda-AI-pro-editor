import React, { useState, useRef, useEffect } from 'react';
import { Subtitle, SubtitleStyle } from './types';
import { exportVideo } from './services/exportService';
import Timeline from './components/Timeline';
import { Upload, Download, ClipboardPaste, Wand2, ExternalLink, Play, Pause } from 'lucide-react';

// --- COMPONENTE INTERNO: VideoPlayer ---
const VideoPlayer = React.forwardRef<HTMLVideoElement, {
  file: File;
  subtitles: Subtitle[];
  currentTime: number;
  style: SubtitleStyle;
  onTimeUpdate: (time: number) => void;
}>(({ file, subtitles, currentTime, style, onTimeUpdate }, ref) => {
  const videoUrl = React.useMemo(() => URL.createObjectURL(file), [file]);
  const activeSubtitle = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={ref}
        src={videoUrl}
        className="max-w-full max-h-full"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      />
      {activeSubtitle && (
        <div 
          className="absolute left-0 right-0 px-4 text-center pointer-events-none"
          style={{
            bottom: '10%',
            color: style.color,
            fontSize: `${style.fontSize}px`,
            fontFamily: style.fontFamily,
            textShadow: `0 0 ${style.outlineWidth}px ${style.outlineColor}`
          }}
        >
          <span style={{ backgroundColor: style.backgroundColor, padding: '2px 8px', borderRadius: '4px' }}>
            {activeSubtitle.text}
          </span>
        </div>
      )}
    </div>
  );
});

// --- COMPONENTE INTERNO: StyleControls ---
const StyleControls = ({ style, onUpdate }: { style: SubtitleStyle, onUpdate: (s: SubtitleStyle) => void }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-brand-900/50 p-4 rounded-xl border border-brand-800">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Tamanho da Fonte</label>
        <input type="number" value={style.fontSize} onChange={e => onUpdate({...style, fontSize: Number(e.target.value)})} className="w-full bg-brand-950 border border-brand-700 rounded p-1 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Cor do Texto</label>
        <input type="color" value={style.color} onChange={e => onUpdate({...style, color: e.target.value})} className="w-full h-8 bg-transparent border-none cursor-pointer" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Fundo (RGBA)</label>
        <input type="text" value={style.backgroundColor} onChange={e => onUpdate({...style, backgroundColor: e.target.value})} className="w-full bg-brand-950 border border-brand-700 rounded p-1 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Espessura Borda</label>
        <input type="number" value={style.outlineWidth} onChange={e => onUpdate({...style, outlineWidth: Number(e.target.value)})} className="w-full bg-brand-950 border border-brand-700 rounded p-1 text-sm" />
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL: App ---
const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportArea, setShowImportArea] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [style, setStyle] = useState<SubtitleStyle>({
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    fontFamily: 'Inter',
    position: 'bottom',
    outlineColor: '#000000',
    outlineWidth: 2
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  const promptParaGemini = `Analise o áudio deste vídeo e gere legendas. Retorne APENAS um array JSON: [{"id": "1", "startTime": 0.5, "endTime": 3.2, "text": "Frase"}]`;

  const handleImportJson = () => {
    try {
      const cleanJson = rawJson.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        setSubtitles(parsed);
        setShowImportArea(false);
        setRawJson('');
      }
    } catch (e) {
      alert("Erro no JSON.");
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-white flex flex-col">
      <header className="h-16 border-b border-brand-800 flex items-center justify-between px-6 bg-brand-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Wand2 className="text-brand-500" />
          <h1 className="font-bold tracking-tighter text-xl">SUBTITLE<span className="text-brand-500">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowImportArea(!showImportArea)} className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-600 rounded-lg transition text-sm">
            <ClipboardPaste size={18} /> Importar IA
          </button>
          <button 
            onClick={() => videoFile && exportVideo(videoFile, subtitles, style, 1, 'original', (m, p) => console.log(m, p))}
            className="flex items-center gap-2 px-6 py-2 bg-brand-500 hover:bg-brand-400 rounded-lg font-bold transition text-sm"
          >
            <Download size={18} /> Exportar
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
       {showImportArea && (
  <div className="mb-6 p-6 bg-brand-900 border-2 border-brand-500 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4">
    <div className="flex justify-between items-center mb-4">
      <h2 className="font-bold text-lg flex items-center gap-2">
        <Wand2 size={20} className="text-brand-500" /> 
        Assistente de Legendas IA
      </h2>
      <button onClick={() => setShowImportArea(false)} className="text-gray-400 hover:text-white">✕</button>
    </div>

    <div className="space-y-4">
      {/* PASSO 1 e 2 */}
      <div className="bg-brand-950 p-4 rounded-lg border border-brand-800">
        <p className="text-sm font-medium mb-2">1. Copie o comando e use no Gemini:</p>
        <div className="flex gap-2">
          <code className="flex-1 bg-black p-2 rounded text-[10px] text-brand-400 overflow-x-auto">
            {promptParaGemini}
          </code>
          <button 
            onClick={() => navigator.clipboard.writeText(promptParaGemini)}
            className="px-3 py-1 bg-brand-700 rounded text-xs hover:bg-brand-600 transition"
          >
            Copiar
          </button>
        </div>
        <a href="https://gemini.google.com" target="_blank" rel="noreferrer" 
           className="inline-flex items-center gap-1 text-xs text-brand-500 mt-2 hover:underline">
          2. Abrir Gemini no navegador <ExternalLink size={12} />
        </a>
      </div>

      {/* PASSO 3 e 4 */}
      <div>
        <p className="text-sm font-medium mb-2">3. Cole o JSON gerado abaixo:</p>
        <textarea 
          className="w-full h-32 bg-brand-950 p-3 rounded border border-brand-700 text-xs font-mono mb-3 focus:border-brand-500 outline-none"
          placeholder='[{"id": "1", "startTime": 0, "endTime": 2, "text": "Exemplo"}]'
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
        />
        <button 
          onClick={handleImportJson} 
          className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-bold transition shadow-lg shadow-brand-500/20"
        >
          4. Gerar Legendas na Timeline
        </button>
      </div>
    </div>
  </div>
)}

          {!videoFile ? (
            <div className="flex-1 border-2 border-dashed border-brand-700 rounded-2xl flex flex-col items-center justify-center bg-brand-900/20">
              <input type="file" className="hidden" id="v" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
              <label htmlFor="v" className="cursor-pointer flex flex-col items-center">
                <Upload size={48} className="text-brand-500 mb-4" />
                <p>Clique para subir o vídeo</p>
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                <VideoPlayer 
                  ref={videoRef} file={videoFile} subtitles={subtitles} 
                  currentTime={currentTime} style={style} onTimeUpdate={setCurrentTime} 
                />
              </div>
              <StyleControls style={style} onUpdate={setStyle} />
            </div>
          )}
        </div>

        <div className="w-[400px] border-l border-brand-800 bg-brand-900/30">
          <Timeline 
            subtitles={subtitles} currentTime={currentTime} onUpdate={setSubtitles} 
            onSeek={t => videoRef.current && (videoRef.current.currentTime = t)} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;
