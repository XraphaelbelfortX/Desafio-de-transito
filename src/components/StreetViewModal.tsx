import React, { useState } from 'react';
import { X, Sparkles, MapPin, Camera } from 'lucide-react';
import { Incident } from '../types';
import { StreetViewReal } from './StreetViewReal';
import { PlantaOficial } from './PlantaOficial';
import type { Intervencao } from '../sim/intervencoes';
import { INTERSECTION_CENTER } from '../data/mockData';

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  intervencoesReais: Intervencao[];
}

export const StreetViewModal: React.FC<StreetViewModalProps> = ({ isOpen, onClose, incidents, intervencoesReais }) => {
  // "Ver a rua" abre direto na realidade aumentada (Street View real); sem chave configurada,
  // essa aba mostra a explicação de como ativar, em vez de cair direto na planta.
  const [fonte, setFonte] = useState<'planta' | 'real'>('real');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gv-border/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="street-view-title"
    >
      <div className="bg-gv-card rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-gv-border animate-toast">
        {/* Header */}
        <div className="bg-gv-panel text-white px-6 py-4 flex items-center justify-between border-b border-gv-border">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gv-cyan uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Contexto do cruzamento — não altera a simulação</span>
            </div>
            <h3 id="street-view-title" className="text-lg font-bold mt-0.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gv-red" />
              Av. dos Africanos × Av. Vicente Venâncio de Queiroga
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-gv-panel/80 hover:bg-gv-panel text-gv-muted hover:text-white transition"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fonte da imagem: foto real do Google Street View, ou a planta (vista de cima) */}
        <div className="bg-gv-panel px-6 py-3 border-b border-gv-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gv-muted flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-gv-cyan" />
              Fonte da imagem:
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-gv-border">
              <button
                type="button"
                onClick={() => setFonte('real')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  fonte === 'real' ? 'bg-gv-cyan text-gv-cyanink shadow-sm' : 'text-gv-muted hover:text-gv-ink'
                }`}
              >
                Street View real (Google)
              </button>
              <button
                type="button"
                onClick={() => setFonte('planta')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  fonte === 'planta' ? 'bg-gv-panel text-white shadow-sm' : 'text-gv-muted hover:text-gv-ink'
                }`}
              >
                Planta oficial (SMTT)
              </button>
            </div>
          </div>
          <div className="text-xs text-gv-muted font-mono">
            Coordenadas: {INTERSECTION_CENTER.lat}, {INTERSECTION_CENTER.lng}
          </div>
        </div>

        {/* Viewport: foto real do Google Street View, ou a planta oficial de sinalização da SMTT */}
        {fonte === 'real' ? (
          <StreetViewReal centro={INTERSECTION_CENTER} incidents={incidents} intervencoes={intervencoesReais} />
        ) : (
          <PlantaOficial intervencoes={intervencoesReais} />
        )}

        {/* Rodapé */}
        <div className="p-4 bg-gv-panel flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gv-muted">
            {fonte === 'planta'
              ? 'Planta oficial da SMTT (projeto de sinalização). Para colocar ou mudar intervenções de verdade, use a aba Simular.'
              : 'Pins: cor da zona para cada intervenção real colocada, e a cor da severidade para cada relato.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gv-panel hover:bg-gv-cyan text-white hover:text-gv-cyanink font-semibold text-xs transition shadow shrink-0"
          >
            Voltar ao Dashboard Tático
          </button>
        </div>
      </div>
    </div>
  );
};
