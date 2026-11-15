import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { CATALOGO, DEFINICAO, type TipoIntervencao } from '../../sim/intervencoes';
import type { Simulacao } from '../../sim/useSimulacao';
import { definirPrevia } from './CamadaIntervencoes';
import { IconeIntervencao } from './IconeIntervencao';
import { CartaoSugestoes, type Assistente } from './Sugestoes';
import { ALCANCE, GRUPOS } from './zonasIntervencao';
import { anunciarArraste, Etapa, MIME_INTERVENCAO } from './PainelIntervencoes';

interface Props {
  sim: Simulacao;
  assistente?: Assistente;
}

/**
 * Coluna esquerda da tela Simular (igual à "Paleta de intervenções" do Figma):
 * catálogo das 9 intervenções, arrastáveis para o mapa, mais as sugestões do assistente.
 */
export const PaletaIntervencoes: React.FC<Props> = ({ sim, assistente }) => {
  const iniciarArraste = (e: React.DragEvent, tipo: TipoIntervencao) => {
    anunciarArraste(tipo);
    e.dataTransfer.setData(MIME_INTERVENCAO, tipo);
    e.dataTransfer.setData('text/plain', DEFINICAO[tipo].nome);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const encerrarArraste = () => {
    anunciarArraste(null);
    definirPrevia(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gv-panel border border-gv-border rounded-xl overflow-hidden">
      <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <Etapa n={1} titulo="Escolha e coloque no mapa" dica="Clique numa intervenção e depois no mapa, ou arraste direto. A mancha colorida é onde ela age." feita={sim.intervencoes.length > 0}>
          <MousePointerClick className="w-4 h-4 text-gv-muted" />
        </Etapa>
        {assistente && <CartaoSugestoes assistente={assistente} />}
        {GRUPOS.map((g) => (
          <div key={g.categoria}>
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-1">{g.titulo}</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {CATALOGO.filter((d) => d.categoria === g.categoria).map((d) => {
                const ativo = sim.modoColocar === d.tipo;
                return (
                  <button
                    key={d.tipo}
                    type="button"
                    draggable
                    onDragStart={(e) => iniciarArraste(e, d.tipo)}
                    onDragEnd={encerrarArraste}
                    onClick={() => sim.setModoColocar(ativo ? null : d.tipo)}
                    aria-pressed={ativo}
                    title={`${d.resumo} ${ALCANCE[d.tipo]}. ${d.ondeSoltar}`}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center min-h-[64px] transition-colors cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-gv-cyan ${
                      ativo ? 'border-gv-cyan bg-gv-cyan/10 ring-1 ring-gv-cyan/30' : 'border-gv-border bg-gv-card hover:bg-gv-bg hover:border-gv-cyan/40'
                    }`}
                  >
                    <IconeIntervencao tipo={d.tipo} tamanho={26} />
                    <span className="text-[10.5px] font-semibold text-gv-ink leading-tight">{d.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {sim.modoColocar && (
          <p className="text-[11px] text-gv-cyan bg-gv-cyan/10 border border-gv-cyan/40 rounded-lg px-2.5 py-1.5" role="status">
            Clique no mapa para colocar {DEFINICAO[sim.modoColocar].nome.toLowerCase()}. {DEFINICAO[sim.modoColocar].ondeSoltar} A mancha mostra onde passa a agir.
          </p>
        )}
      </div>
    </div>
  );
};
