import React, { useState, useRef } from 'react';
import { Upload, Wand2, Download, Type, Scissors, Copy, ExternalLink } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import SubtitleEditor from './components/SubtitleEditor';
import ExportSettings from './components/ExportSettings';
import { Subtitle } from './types';

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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
Retorne APENAS um array JSON puro (sem explicações ou markdown), seguindo exatamente este modelo:
[
  {"startTime": 0.5, "endTime": 3.0, "text": "Bem-vindos ao meu canal!"},
  {"startTime": 3.2, "endTime": 5.0, "text": "Hoje falaremos sobre marketing."}
]`;
    navigator.clipboard.writeText(prompt);
    alert("Prompt copiado! Agora suba seu vídeo no Gemini/ChatGPT, cole o prompt e depois traga o JSON para cá.");
  };

  const processarLegendasManuais = () => {
    try {
      // Limpa possíveis marcações de markdown se o usuário colar com ```json
      const cleanJson = jsonInput.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setSubtitles(parsed);
      setStep('edit');
    } catch (error) {
      alert("Erro ao ler o JSON. Verifique se você copiou o código completo da IA.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg">
              <Type size={24} />
            </div>
            <h1 className="text-2xl font-bold italic">LegendaAI <span className="text-red-500">PRO</span></h1>
          </div>
        </header>

        {step === 'upload' && (
          <div className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-2xl p-20 text-center">
            <input type="file" accept="video/*" onChange={handleFileUpload} id="video-upload" className="hidden" />
            <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
              <div className="bg-slate-700 p-6 rounded-full mb-4">
                <Upload size={48} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Comece por aqui</h2>
              <p className="text-slate-400 mb-8">Selecione o vídeo que você deseja legendar</p>
              <span className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-full font-bold transition">
                Selecionar Vídeo
              </span>
            </label>
          </div>
        )}

        {step === 'generate' && (
          <div className="max-w-2xl mx-auto bg-slate-800 rounded-2xl p-8 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Wand2 className="text-purple-400" /> Gerar Legendas (Via IA Externa)
            </h2>
            
            <div className="space-y-6">
              <div className="bg-slate-900 p-4 rounded-xl border border-blue-900/30">
                <p className="text-sm text-blue-300 mb-4">
                  Como as APIs do Google costumam instabilizar em navegadores antigos, usamos o método 
                  "MarketPulse" para garantir que você nunca fique na mão.
                </p>
                <div className="flex gap-4">
                  <button onClick={copiarPromptParaIA} className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-lg flex items-center justify-center gap-2 transition">
                    <Copy size={18} /> 1. Copiar Prompt
                  </button>
                  <a href="[https://gemini.google.com/app](https://gemini.google.com/app)" target="_blank" className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-lg flex items-center justify-center gap-2 transition">
                    <ExternalLink size={18} /> 2. Abrir Gemini
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  3. Cole o JSON gerado pela IA abaixo:
                </label>
                <textarea 
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm text-green-400"
                  placeholder='[{"startTime": 0.0, "endTime": 2.0, "text": "Exemplo"}]'
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
              </div>

              <button 
                onClick={processarLegendasManuais}
                disabled={!jsonInput}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 p-4 rounded-xl font-bold text-lg transition shadow-xl"
              >
                Gerar Legendas no Vídeo
              </button>
            </div>
          </div>
        )}

        {step === 'edit' && videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <VideoPlayer 
                url={videoUrl} 
                subtitles={subtitles}
                onTimeUpdate={setCurrentTime}
                setIsPlaying={setIsPlaying}
                videoRef={videoRef}
              />
              <Timeline 
                subtitles={subtitles}
                currentTime={currentTime}
                duration={videoRef.current?.duration || 0}
                onSubtitleChange={setSubtitles}
              />
            </div>
            <div className="space-y-6">
              <SubtitleEditor 
                subtitles={subtitles}
                currentTime={currentTime}
                onSubtitleChange={setSubtitles}
              />
              <ExportSettings 
                videoFile={videoFile!}
                subtitles={subtitles}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
