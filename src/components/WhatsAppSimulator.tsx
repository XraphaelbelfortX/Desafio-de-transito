import React, { useState } from 'react';
import { MessageSquarePlus, Mic, Send, Loader2, MessageSquare } from 'lucide-react';
import { CITIZEN_AUDIO_PRESETS } from '../data/mockData';

interface WhatsAppSimulatorProps {
  onSendReport: (transcribedText: string) => void;
  isProcessing: boolean;
  totalReportsCount: number;
  ativo: boolean;
  onAtivo: (ligado: boolean) => void;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  onSendReport,
  isProcessing,
  totalReportsCount,
  ativo,
  onAtivo,
}) => {
  const [inputText, setInputText] = useState<string>(
    'Quase fui atropelado agora na bicicleta no cruzamento da Av. dos Africanos com a Vicente Venâncio de Queiroga, caminhão dobrou fechado em alta velocidade!'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativo || !inputText.trim() || isProcessing) return;
    onSendReport(inputText.trim());
  };

  return (
    <section
      aria-label="Simulador de Cidadão (WhatsApp)"
      className="bg-gv-card rounded-xl border border-gv-border shadow-sm overflow-hidden"
    >
      {/* Barra superior do simulador de relatos */}
      <div className={`text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${ativo ? 'bg-gradient-to-r from-gv-green via-gv-green to-gv-bg' : 'bg-gv-panel'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gv-green/20 border border-gv-green/40 flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-gv-green" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                Simulador de Cidadão (WhatsApp)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-white border border-white/25">
                Protótipo, sem integração com o WhatsApp ainda
              </span>
            </div>
            <p className="text-[11px] text-white/85 hidden sm:block">
              Simula o relato que a população mandaria pelo WhatsApp: o texto é classificado por palavras-chave e vira um ponto na mancha &ldquo;Relatos&rdquo;
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] bg-gv-border/40 px-2.5 py-1 rounded-lg border border-white/10">
            <MessageSquare className="w-3.5 h-3.5 text-gv-green" />
            <span>
              Relatos recebidos:{' '}
              <strong className="text-gv-green font-mono">{totalReportsCount}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onAtivo(!ativo)}
            aria-pressed={ativo}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
              ativo
                ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                : 'bg-gv-green border-gv-green text-gv-cyanink hover:brightness-110'
            }`}
          >
            {ativo ? 'Desligar relatos' : 'Ligar relatos'}
          </button>
        </div>
      </div>
      {!ativo && (
        <p className="px-4 py-2 text-[11px] text-gv-muted bg-gv-panel border-b border-gv-border">
          Relatos desligados. Nenhum ponto novo entra no mapa até você ligar de novo.
        </p>
      )}

      {/* Corpo do Simulador */}
      <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-3">
        {/* Relatos de exemplo para a demonstração */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gv-muted mr-1 flex items-center gap-1">
            <Mic className="w-3 h-3 text-gv-green" />
            Relatos de exemplo:
          </span>
          {CITIZEN_AUDIO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!ativo || isProcessing}
              onClick={() => setInputText(preset.replace(/[“”]/g, ''))}
              className="text-[11px] px-2.5 py-1 rounded-full bg-gv-bg hover:bg-gv-green/10 text-gv-ink hover:text-gv-green border border-gv-border hover:border-gv-green transition truncate max-w-[230px]"
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gv-green pointer-events-none">
              <Mic className="w-4 h-4" />
            </div>
            <input
              id="citizen-whatsapp-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!ativo || isProcessing}
              placeholder="Simule a mensagem de áudio transcrita do cidadão"
              className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-gv-bg border border-gv-border rounded-xl text-gv-ink placeholder:text-gv-muted focus:outline-none focus:ring-2 focus:ring-gv-green focus:bg-gv-card transition"
            />
          </div>

          <button
            type="submit"
            disabled={!ativo || isProcessing || !inputText.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-gv-cyanink bg-gv-green hover:brightness-110 disabled:bg-gv-border disabled:text-gv-muted shadow-sm hover:shadow transition-all duration-150 shrink-0 cursor-pointer"
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
