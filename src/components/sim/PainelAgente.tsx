import React from 'react';
import { X } from 'lucide-react';
import { NOME_INFRACAO, NOME_TIPO, type Decisao, type Fator } from '../../sim/motor';
import type { AgenteVisao } from '../../sim/useSimulacao';

const num = (v: number, casas = 0) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

const fraseChance = (d: Decisao) => {
  if (d.probabilidade === undefined || d.sorteio === undefined) return null;
  const relacao =
    d.sorteio < d.probabilidade ? 'abaixo da chance' : d.sorteio > d.probabilidade ? 'acima da chance' : 'igual à chance';
  const sorteio = d.sorteio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Chance calculada: ${Math.round(d.probabilidade * 100)}%. Sorteio: ${sorteio}, ${relacao}.`;
};

/** Barra a partir do centro: direita aumenta a chance, esquerda reduz. */
const BarraFator: React.FC<{ fator: Fator }> = ({ fator }) => {
  const t = Math.max(-1, Math.min(1, fator.efeito / 4));
  const sobe = t > 0;
  return (
    <div className="mt-1">
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-gv-muted">
        <span className="leading-tight">{fator.rotulo}</span>
        <span className={`tabular-nums shrink-0 ${sobe ? 'text-rose-700' : 'text-gv-green'}`}>
          {fator.efeito > 0 ? '+' : ''}
          {num(fator.efeito, 1)}
        </span>
      </div>
      <div className="relative h-1.5 mt-0.5 bg-gv-bg rounded-full">
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-gv-border" />
        {t !== 0 && (
          <span
            className={`absolute top-0 bottom-0 rounded-full ${sobe ? 'bg-rose-500' : 'bg-gv-green'}`}
            style={sobe ? { left: '50%', width: `${t * 50}%` } : { right: '50%', width: `${-t * 50}%` }}
          />
        )}
      </div>
    </div>
  );
};

interface Props {
  agente: AgenteVisao;
  onFechar: () => void;
}

/** Porquê da decisão do agente clicado. Rola se a lista passar da altura. */
export const PainelAgente: React.FC<Props> = ({ agente, onFechar }) => {
  return (
    <article className="pointer-events-auto bg-gv-bg/90 backdrop-blur-md border border-gv-border rounded-xl shadow-lg text-gv-ink overflow-hidden flex flex-col max-h-[min(420px,55vh)]">
      <header className="flex items-start gap-2 px-3 py-2 border-b border-gv-border shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gv-muted">Agente no mapa</p>
          <h3 className="text-sm font-extrabold text-gv-ink leading-tight">
            {NOME_TIPO[agente.tipo]} #{agente.id}
          </h3>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar painel do agente" className="text-gv-muted hover:text-gv-ink p-0.5">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="px-3 py-2 space-y-2 text-[11px] leading-snug overflow-y-auto">
        {!agente.naVia && (
          <p className="text-gv-amber bg-gv-amber/10 border border-gv-amber rounded-lg px-2 py-1">
            Este agente já deixou o trecho. O retrato é o último.
          </p>
        )}
        <p>
          <span className="text-gv-muted">Estado. </span>
          <strong className="text-gv-ink">{agente.estado || 'em movimento'}</strong>
        </p>
        <p className="tabular-nums">
          <span className="text-gv-muted">Velocidade. </span>
          {num(agente.vKmh)} km/h
          <span className="text-gv-muted"> (queria {num(agente.vDesKmh)} km/h)</span>
        </p>
        <p>
          <span className="text-gv-muted">Impaciência. </span>
          {num(agente.imp * 100)}%
        </p>
        {agente.desejo && (
          <p>
            <span className="text-gv-muted">Desejo. </span>
            {agente.desejo}
          </p>
        )}
        <p>
          <span className="text-gv-muted">Infrações. </span>
          {agente.infracoes.length === 0 ? 'Nenhuma' : agente.infracoes.map((i) => NOME_INFRACAO[i]).join(', ')}
        </p>

        <section aria-label="Decisões">
          <h4 className="text-[10px] font-bold uppercase tracking-wide text-gv-muted mb-1">Decisões</h4>
          {agente.decisoes.length === 0 ? (
            <p className="text-gv-muted">Ainda sem decisão registrada.</p>
          ) : (
            <ol className="space-y-2">
              {agente.decisoes.map((d, i) => {
                const frase = fraseChance(d);
                return (
                  <li key={`${d.t}-${i}`} className="rounded-lg border border-gv-border bg-gv-panel px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-gv-ink">{d.titulo}</span>
                      {d.infracao && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-gv-red bg-gv-red/10 border border-gv-red rounded px-1">
                          Infração
                        </span>
                      )}
                    </div>
                    <p className="text-gv-muted mt-0.5">{d.texto}</p>
                    {d.fatores && d.fatores.length > 0 && (
                      <div className="mt-1">
                        {d.fatores.map((f, k) => (
                          <BarraFator key={`${f.rotulo}-${k}`} fator={f} />
                        ))}
                      </div>
                    )}
                    {frase && <p className="mt-1.5 text-gv-ink">{frase}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </article>
  );
};
