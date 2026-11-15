import React, { useState } from 'react';
import { ListChecks, MessageCircle } from 'lucide-react';
import type { Simulacao } from '../sim/useSimulacao';
import { LogComportamento } from '../components/sim/LogComportamento';
import { WhatsAppSimulator } from '../components/WhatsAppSimulator';

interface Props {
  sim: Simulacao;
  onSendReport: (texto: string) => void;
  isProcessing: boolean;
  totalReportsCount: number;
  relatosAtivos: boolean;
  onRelatosAtivos: (ligado: boolean) => void;
}

/** Tela "Relatórios": sem desenho próprio no Figma, reúne o log de decisões e os relatos do cidadão. */
export const TelaRelatorios: React.FC<Props> = ({ sim, onSendReport, isProcessing, totalReportsCount, relatosAtivos, onRelatosAtivos }) => {
  const [aba, setAba] = useState<'log' | 'relatos'>('log');

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 py-3 border-b border-gv-border">
        <h1 className="text-lg font-bold text-gv-ink leading-tight">Relatórios</h1>
        <p className="text-xs text-gv-muted">O que os agentes fizeram na simulação e os relatos recebidos pelo WhatsApp.</p>
      </header>

      <div className="flex-1 min-h-0 flex flex-col p-3 gap-3 max-w-3xl mx-auto w-full">
        <nav className="grid grid-cols-2 bg-gv-panel border border-gv-border rounded-xl overflow-hidden shrink-0" role="tablist">
          {(
            [
              { id: 'log', rotulo: 'O que aconteceu', icone: ListChecks },
              { id: 'relatos', rotulo: 'Relatos (WhatsApp)', icone: MessageCircle },
            ] as const
          ).map((t) => {
            const Icone = t.icone;
            const ativo = aba === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setAba(t.id)}
                className={`flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors ${
                  ativo ? 'bg-gv-cyan/15 text-gv-cyan' : 'text-gv-muted hover:text-gv-ink'
                }`}
              >
                <Icone className="w-4 h-4" />
                {t.rotulo}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto bg-gv-panel border border-gv-border rounded-xl">
          {aba === 'log' && <LogComportamento sim={sim} />}
          {aba === 'relatos' && (
            <WhatsAppSimulator onSendReport={onSendReport} isProcessing={isProcessing} totalReportsCount={totalReportsCount} ativo={relatosAtivos} onAtivo={onRelatosAtivos} />
          )}
        </div>
      </div>
    </div>
  );
};
