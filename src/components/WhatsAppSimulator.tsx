import React, { useState } from 'react';
import { MessageSquarePlus, Mic, Send, Loader2, Bot } from 'lucide-react';
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
      {/* Barra superior do simulador de relatos */}
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
                Protótipo, sem integração com o WhatsApp ainda
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/80 hidden sm:block">
              Simula o relato que a população mandaria pelo WhatsApp: o texto é classificado por palavras-chave e vira um ponto na mancha &ldquo;Relatos&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] bg-slate-950/40 px-2.5 py-1 rounded-lg border border-white/10">
          <Bot className="w-3.5 h-3.5 text-emerald-300" />
          <span>
            Relatos recebidos:{' '}
            <strong className="text-emerald-300 font-mono">{totalReportsCount}</strong>
          </span>
        </div>
      </div>

      {/* Corpo do Simulador */}
      <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-3">
        {/* Relatos de exemplo para a demonstração */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Mic className="w-3 h-3 text-emerald-600" />
            Relatos de exemplo:
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
              {preset.slice(1, 38)}…
            </button>
          ))}
        </div>

        {/* Texto do relato + envio */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <label htmlFor="citizen-whatsapp-input" className="sr-only">
              Simule a mensagem de áudio transcrita do cidadão
            </label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-700 pointer-events-none">
              <Mic className="w-4 h-4" />
            </div>
            <input
              id="citizen-whatsapp-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              placeholder="Simule a mensagem de áudio transcrita do cidadão"
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-emerald-50/40 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 shadow-sm hover:shadow transition-all duration-150 shrink-0 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Classificando…</span>
              </>
            ) : (
              <>
                <span>Enviar relato</span>
                <Send className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
