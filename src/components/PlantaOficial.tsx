import React from 'react';
import { ExternalLink } from 'lucide-react';
import { DEFINICAO, type Intervencao } from '../sim/intervencoes';
import { COR_ZONA } from './sim/zonasIntervencao';

interface Props {
  intervencoes: Intervencao[];
}

/**
 * Planta oficial de sinalização da SMTT para este cruzamento (projeto 01/01, escala 1:500).
 * É um documento real, não um desenho gerado — por isso não tenta posicionar pixel a pixel
 * as intervenções nele; a lista ao lado mostra o que está de fato colocado na simulação.
 */
export const PlantaOficial: React.FC<Props> = ({ intervencoes }) => (
  <div className="w-full h-[390px] bg-gv-bg flex flex-col sm:flex-row gap-0">
    <div className="relative flex-1 min-w-0 overflow-auto bg-black/40">
      <img
        src="/img/planta-oficial-smtt.png"
        alt="Planta oficial de sinalização da SMTT para o cruzamento Av. dos Africanos × Av. Vicente Venâncio (projeto 01/01, escala 1:500)"
        className="max-w-none h-auto w-[1400px]"
      />
      <a
        href="/img/planta-oficial-smtt.png"
        target="_blank"
        rel="noreferrer"
        className="absolute top-2 right-2 flex items-center gap-1.5 bg-gv-bg/90 border border-gv-border text-gv-ink text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:border-gv-cyan/40"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Abrir em alta resolução
      </a>
    </div>

    <aside className="w-full sm:w-[230px] shrink-0 bg-gv-panel border-t sm:border-t-0 sm:border-l border-gv-border p-3 overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-2">Projeto de sinalização · SMTT</p>
      <p className="text-[11px] text-gv-muted mb-3">Documento oficial, escala 1:500. Arraste a planta pra ver os detalhes.</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-1.5">No mapa agora ({intervencoes.length})</p>
      {intervencoes.length === 0 ? (
        <p className="text-[11px] text-gv-muted">Nenhuma intervenção colocada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {intervencoes.map((i, idx) => (
            <li key={i.id} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COR_ZONA[i.tipo] }} />
              <span className="text-gv-ink">
                {idx + 1}. {DEFINICAO[i.tipo].nome}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  </div>
);
