import React, { useState, useRef } from 'react';
import { Upload, Wand2, Type, Copy, ExternalLink, Download } from 'lucide-react';
// Importamos apenas o que você realmente tem na pasta components
import Timeline from './components/Timeline';

// Definimos a interface aqui mesmo para evitar erros de importação de tipos
interface Subtitle {
  startTime: number;
  endTime: number;
  text: string;
}

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [step, setStep] = useState<'upload' | 'generate' | 'edit'>('upload');
  const [jsonInput, setJsonInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStep('generate');
    }
  };

  const copiarPromptParaIA = () => {
    const prompt = `Analise o áudio deste vídeo e gere legendas sincronizadas em Português do Brasil.
Retorne APENAS um array JSON puro, seguindo exatamente este modelo:
[
  {"startTime": 0.5, "endTime": 3.0, "text": "Bem-vindos ao meu canal!"},
  {"startTime": 3.2, "endTime": 5.0, "text": "Hoje falaremos sobre marketing."}
]`;
    navigator.clipboard.writeText(prompt);
    alert("Prompt copiado! Vá ao Gemini, cole o prompt e traga o JSON.");
  };

  const processarLegendasManuais = () => {
    try {
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setSubtitles(parsed);
      setStep('edit');
    } catch (error) {
      alert("Erro no JSON. Verifique se copiou o código completo.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg"><Type size={24} /></div>
            <h1 className="text-2xl font-bold italic">LegendaAI <span className="text-red-500">PRO</span></h1>
          </div>
        </header>

        {step === 'upload' && (
          <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-20 text-center">
            <input type="file" accept="video/*" onChange={handleFileUpload} id="video-upload" className="hidden" />
            <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
              <Upload size={48} className="text-blue-400 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Selecione o vídeo</h2>
              <span className="bg-blue-600 px-8 py-3 rounded-full font-bold">Upload</span>
            </label>
          </div>
        )}

        {step === 'generate' && (
          <div className="max-w-2xl mx-auto bg-slate-800 rounded-2xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Wand2 /> Gerar via Gemini</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <button onClick={copiarPromptParaIA} className="flex-1 bg-slate-700 p-3 rounded-lg flex items-center justify-center gap-2 transition"><Copy size={18} /> 1. Copiar Prompt</button>
                <a href="https://gemini.google.com/app" target="_blank" className="flex-1 bg-slate-700 p-3 rounded-lg flex items-center justify-center gap-2 transition"><ExternalLink size={18} /> 2. Abrir Gemini</a>
              </div>
              <textarea 
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm text-green-400"
                placeholder='Cole o JSON aqui...'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
              <button onClick={processarLegendasManuais} className="w-full bg-blue-600 p-4 rounded-xl font-bold transition">Visualizar no Vídeo</button>
            </div>
          </div>
        )}

        {step === 'edit' && videoUrl && (
          <div className="space-y-6">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video max-w-3xl mx-auto">
              <video 
                ref={videoRef}
                src={videoUrl} 
                className="w-full h-full" 
                controls
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
              {/* Overlay de Legenda Simples */}
              <div className="absolute bottom-10 left-0 right-0 text-center px-4">
                <p className="inline-block bg-black/70 text-white text-xl px-4 py-1 rounded">
                  {subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.text || ""}
                </p>
              </div>
            </div>
            
            <Timeline 
              subtitles={subtitles}
              currentTime={currentTime}
              duration={videoRef.current?.duration || 0}
              onSubtitleChange={setSubtitles}
            />
            
            <button onClick={() => window.print()} className="w-full bg-green-600 p-4 rounded-xl font-bold flex items-center justify-center gap-2">
              <Download size={20} /> Salvar Projeto (PDF/Print)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
