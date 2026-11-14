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
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-slate-600">
        <span className="leading-tight">{fator.rotulo}</span>
        <span className={`tabular-nums shrink-0 ${sobe ? 'text-rose-700' : 'text-emerald-800'}`}>
          {fator.efeito > 0 ? '+' : ''}
          {num(fator.efeito, 1)}
        </span>
      </div>
      <div className="relative h-1.5 mt-0.5 bg-slate-100 rounded-full">
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400" />
        {t !== 0 && (
          <span
            className={`absolute top-0 bottom-0 rounded-full ${sobe ? 'bg-rose-500' : 'bg-emerald-600'}`}
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
    <article className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg text-slate-800 overflow-hidden flex flex-col max-h-[min(420px,55vh)]">
      <header className="flex items-start gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Agente no mapa</p>
          <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
            {NOME_TIPO[agente.tipo]} #{agente.id}
          </h3>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar painel do agente" className="text-slate-400 hover:text-slate-800 p-0.5">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="px-3 py-2 space-y-2 text-[11px] leading-snug overflow-y-auto">
        {!agente.naVia && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            Este agente já deixou o trecho. O retrato é o último.
          </p>
        )}
        <p>
          <span className="text-slate-500">Estado. </span>
          <strong className="text-slate-900">{agente.estado || 'em movimento'}</strong>
        </p>
        <p className="tabular-nums">
          <span className="text-slate-500">Velocidade. </span>
          {num(agente.vKmh)} km/h
          <span className="text-slate-500"> (queria {num(agente.vDesKmh)} km/h)</span>
        </p>
        <p>
          <span className="text-slate-500">Impaciência. </span>
          {num(agente.imp * 100)}%
        </p>
        {agente.desejo && (
          <p>
            <span className="text-slate-500">Desejo. </span>
            {agente.desejo}
          </p>
        )}
        <p>
          <span className="text-slate-500">Infrações. </span>
          {agente.infracoes.length === 0 ? 'Nenhuma' : agente.infracoes.map((i) => NOME_INFRACAO[i]).join(', ')}
        </p>

        <section aria-label="Decisões">
          <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Decisões</h4>
          {agente.decisoes.length === 0 ? (
            <p className="text-slate-500">Ainda sem decisão registrada.</p>
          ) : (
            <ol className="space-y-2">
              {agente.decisoes.map((d, i) => {
                const frase = fraseChance(d);
                return (
                  <li key={`${d.t}-${i}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900">{d.titulo}</span>
                      {d.infracao && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 rounded px-1">
                          Infração
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 mt-0.5">{d.texto}</p>
                    {d.fatores && d.fatores.length > 0 && (
                      <div className="mt-1">
                        {d.fatores.map((f, k) => (
                          <BarraFator key={`${f.rotulo}-${k}`} fator={f} />
                        ))}
                      </div>
                    )}
                    {frase && <p className="mt-1.5 text-slate-800">{frase}</p>}
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
