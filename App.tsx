import React, { useState, useRef } from 'react';
import { Subtitle, SubtitleStyle } from './types';
import { exportVideo } from './services/exportService';
import Timeline from './components/Timeline';
import VideoPlayer from './components/VideoPlayer';
import StyleControls from './components/StyleControls';
import { Upload, Download, ClipboardPaste, Wand2, ExternalLink } from 'lucide-react';

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

  const promptParaGemini = `Analise o áudio deste vídeo e gere legendas no idioma original dele. 
Retorne APENAS um array JSON puro, sem textos explicativos nem markdown, seguindo este formato exato:
[
  {"id": "1", "startTime": 0.5, "endTime": 3.2, "text": "Frase falada aqui"},
  {"id": "2", "startTime": 3.5, "endTime": 6.0, "text": "Próxima frase"}
]`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptParaGemini);
    alert("Prompt copiado! Agora envie para o Gemini.");
  };

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
      alert("Erro no formato do JSON. Verifique o conteúdo colado.");
    }
  };

  const handleExport = async () => {
    if (!videoFile) return;
    setIsExporting(true);
    try {
      await exportVideo(videoFile, subtitles, style, (progress) => {
        console.log(`Exportando: ${Math.round(progress * 100)}%`);
      });
    } catch (error) {
      alert("Erro ao exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 text-white flex flex-col">
      {/* HEADER */}
      <header className="h-16 border-b border-brand-800 flex items-center justify-between px-6 bg-brand-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Wand2 className="text-brand-500" />
          <h1 className="font-bold tracking-tighter text-xl">SUBTITLE<span className="text-brand-500">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowImportArea(!showImportArea)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-600 rounded-lg transition"
          >
            <ClipboardPaste size={18} /> Importar IA
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting || !videoFile}
            className="flex items-center gap-2 px-6 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 rounded-lg font-bold transition"
          >
            <Download size={18} /> {isExporting ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          
          {/* ÁREA DE IMPORTAÇÃO (FLUXO 3 PASSOS) */}
          {showImportArea && (
            <div className="mb-6 p-6 bg-brand-900 border border-brand-500 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-400">
                <Wand2 size={20} /> Gerar Legendas com IA Externa
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-brand-800 rounded-xl border border-brand-700">
                  <span className="text-brand-500 font-black text-xl mb-1 block">1. Prompt</span>
                  <p className="text-xs mb-3 text-gray-400">Copie as instruções para a IA.</p>
                  <button onClick={handleCopyPrompt} className="w-full py-2 bg-brand-700 hover:bg-brand-600 rounded text-xs font-bold transition">
                    COPIAR PROMPT
                  </button>
                </div>

                <div className="p-4 bg-brand-800 rounded-xl border border-brand-700">
                  <span className="text-brand-500 font-black text-xl mb-1 block">2. Gemini</span>
                  <p className="text-xs mb-3 text-gray-400">Envie o arquivo e o prompt no site.</p>
                  <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-brand-700 hover:bg-brand-600 rounded text-xs font-bold transition">
                    ABRIR SITE <ExternalLink size={12} />
                  </a>
                </div>

                <div className="p-4 bg-brand-800 rounded-xl border border-brand-700">
                  <span className="text-brand-500 font-black text-xl mb-1 block">3. Resultado</span>
                  <p className="text-xs mb-3 text-gray-400">Cole o código JSON gerado.</p>
                  <textarea 
                    className="w-full h-20 bg-brand-950 p-2 rounded border border-brand-600 text-[10px] font-mono focus:border-brand-500 outline-none"
                    placeholder="Cole o [ { ... } ] aqui"
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleImportJson}
                disabled={!rawJson}
                className="w-full py-3 bg-brand-500 hover:bg-brand-400 disabled:opacity-30 rounded-xl font-bold transition"
              >
                GERAR LEGENDAS NA TIMELINE
              </button>
            </div>
          )}

          {/* PLAYER E CONTROLES */}
          {!videoFile ? (
            <div className="flex-1 border-2 border-dashed border-brand-700 rounded-2xl flex flex-col items-center justify-center bg-brand-900/20">
              <input type="file" id="video-upload" className="hidden" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center mb-4"><Upload size={32} /></div>
                <p className="text-xl font-medium">Carregue seu vídeo</p>
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                <VideoPlayer file={videoFile} subtitles={subtitles} currentTime={currentTime} style={style} onTimeUpdate={setCurrentTime} ref={videoRef} />
              </div>
              <StyleControls style={style} onUpdate={setStyle} />
            </div>
          )}
        </div>

        {/* TIMELINE */}
        <div className="w-[400px] border-l border-brand-800 bg-brand-900/30 backdrop-blur-sm">
          <Timeline 
            subtitles={subtitles} 
            currentTime={currentTime} 
            onUpdate={setSubtitles} 
            onSeek={(time) => { if (videoRef.current) videoRef.current.currentTime = time; }} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;