import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Mic,
  Send,
  Sparkles,
  Loader2,
  Radio,
  Bot,
  CheckCheck,
} from 'lucide-react';
import { CITIZEN_AUDIO_PRESETS } from '../data/mockData';

interface WhatsAppSimulatorProps {
  onSendReport: (transcribedText: string) => void;
  isProcessing: boolean;
  totalReportsCount: number;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  onSendReport,
  isProcessing,
  totalReportsCount,
}) => {
  const [inputText, setInputText] = useState<string>(
    'Quase fui atropelado agora na bicicleta no cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga, caminhão dobrou fechado em alta velocidade!'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendReport(inputText.trim());
  };

  return (
    <section
      aria-label="Simulador de Cidadão (WhatsApp)"
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Barra Superior do Simulador WhatsApp + Pipeline OpenAI */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                Simulador de Cidadão (WhatsApp)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                Webhook n8n + OpenAI Whisper/GPT-4o
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/80 hidden sm:block">
              Captação descentralizada de &ldquo;quase-acidentes&rdquo; via áudio da população convertida em pontos georreferenciados em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] bg-slate-950/40 px-2.5 py-1 rounded-lg border border-white/10">
          <Bot className="w-3.5 h-3.5 text-emerald-300" />
          <span>
            Relatos Processados:{' '}
            <strong className="text-emerald-300 font-mono">{totalReportsCount}</strong>
          </span>
        </div>
      </div>

      {/* Corpo do Simulador */}
      <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-3">
        {/* Sugestões Rápidas para Demonstração no Pitch */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Mic className="w-3 h-3 text-emerald-600" />
            Áudios de exemplo (1-clique):
          </span>
          {CITIZEN_AUDIO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isProcessing}
              onClick={() => setInputText(preset.replace(/[“”]/g, ''))}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 transition truncate max-w-[230px]"
              title={preset}
            >
              Áudio #{idx + 1}: {preset.slice(1, 38)}...
            </button>
          ))}
        </div>

        {/* Input Obrigatório + Botão "Enviar Relato (IA)" */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <label htmlFor="citizen-whatsapp-input" className="sr-only">
              Simule a mensagem de áudio transcrita do cidadão
            </label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-700 pointer-events-none">
              <Mic className="w-4 h-4 animate-pulse" />
            </div>
            <input
              id="citizen-whatsapp-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              placeholder="Simule a mensagem de áudio transcrita do cidadão"
              className="w-full pl-9 pr-20 py-2.5 text-xs sm:text-sm bg-emerald-50/40 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
              <CheckCheck className="w-3 h-3" /> 0:14s
            </span>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 shadow-sm hover:shadow transition-all duration-150 shrink-0 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando OpenAI (1s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Enviar Relato (IA)</span>
                <Send className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
