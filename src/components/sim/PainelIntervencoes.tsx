import React from 'react';
import { Minus, Plus, Save, Trash2, Upload } from 'lucide-react';
import { CATALOGO, DEFINICAO, TEMPOS_PADRAO, type TemposSemaforo, type TipoIntervencao } from '../../sim/intervencoes';
import { formatarReais, type IdCenario, type Simulacao } from '../../sim/useSimulacao';
import { orcarCenario, paraLocais, totalConflitos, totalInfracoes } from '../../sim/cenarios';
import { IconeIntervencao } from './IconeIntervencao';

export const COR_CENARIO: Record<'atual' | IdCenario, string> = {
  atual: '#2a78d6',
  A: '#eb6834',
  B: '#1baf7a',
};

export const MIME_INTERVENCAO = 'application/x-guardiao-intervencao';

const num = (v: number, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

const CAMPOS_TEMPO: { chave: keyof TemposSemaforo; rotulo: string; min: number; max: number }[] = [
  { chave: 'verdeAvenida', rotulo: 'Verde da avenida', min: 10, max: 120 },
  { chave: 'verdeTransversal', rotulo: 'Verde da rua e dos pedestres', min: 8, max: 90 },
  { chave: 'amarelo', rotulo: 'Amarelo', min: 2, max: 6 },
  { chave: 'vermelhoGeral', rotulo: 'Vermelho geral', min: 0, max: 5 },
];

const EditorTempos: React.FC<{ tempos: TemposSemaforo; onMudar: (t: TemposSemaforo) => void }> = ({ tempos, onMudar }) => {
  const ciclo = tempos.verdeAvenida + tempos.verdeTransversal + 2 * (tempos.amarelo + tempos.vermelhoGeral);
  return (
    <div className="mt-2 rounded-lg bg-white border border-slate-200 p-2.5">
      <div className="grid grid-cols-1 gap-1.5">
        {CAMPOS_TEMPO.map((c) => {
          const v = tempos[c.chave];
          const mudar = (novo: number) => onMudar({ ...tempos, [c.chave]: Math.min(c.max, Math.max(c.min, novo)) });
          return (
            <div key={c.chave} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-700">{c.rotulo}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => mudar(v - 1)} aria-label={`Diminuir ${c.rotulo}`} className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100">
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={v}
                  min={c.min}
                  max={c.max}
                  onChange={(e) => mudar(Number(e.target.value))}
                  aria-label={`${c.rotulo} em segundos`}
                  className="w-12 text-center text-xs font-semibold tabular-nums border border-slate-300 rounded py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button type="button" onClick={() => mudar(v + 1)} aria-label={`Aumentar ${c.rotulo}`} className="w-6 h-6 rounded border border-slate-300 flex items-center justify-center hover:bg-slate-100">
                  <Plus className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-slate-400 w-3">s</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        Ciclo de {ciclo} s. Amarelo curto faz mais gente avançar o vermelho; verde curto para a rua aumenta a fila e a impaciência.
      </p>
      <button type="button" onClick={() => onMudar({ ...TEMPOS_PADRAO })} className="text-[11px] text-blue-800 font-semibold mt-1 hover:underline">
        Voltar aos tempos padrão
      </button>
    </div>
  );
};

interface Props {
  sim: Simulacao;
}

export const PainelIntervencoes: React.FC<Props> = ({ sim }) => {
  const custoPorId = new Map((sim.orcamento?.itens ?? []).map((i) => [i.intervencao.id, i.orcamento]));
  const m = sim.metricas;
  const minutos = m ? m.horas * 60 : 0;

  const iniciarArraste = (e: React.DragEvent, tipo: TipoIntervencao) => {
    e.dataTransfer.setData(MIME_INTERVENCAO, tipo);
    e.dataTransfer.setData('text/plain', DEFINICAO[tipo].nome);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const resumoCenario = (id: IdCenario) => {
    const c = sim.cenarios[id];
    if (!c) return null;
    const n = `${c.length} ${c.length === 1 ? 'intervenção' : 'intervenções'}`;
    if (!sim.rede || c.length === 0) return c.length === 0 ? 'Sem intervenções' : n;
    const o = orcarCenario(sim.rede, paraLocais(sim.rede, c));
    return `${n}, ${formatarReais(o.implantacao)}${o.mensal > 0 ? ` + ${formatarReais(o.mensal)}/mês` : ''}`;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="bg-gov-navy text-white px-5 py-4 border-b border-slate-800">
        <h2 className="text-lg font-extrabold tracking-tight">Simulador de intervenções</h2>
        <p className="text-xs text-slate-300 mt-0.5">
          Arraste uma intervenção para o mapa, ou clique nela e depois clique no lugar. No mapa, arraste o ícone para reposicionar.
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
        {/* Paleta */}
        <section aria-label="Intervenções disponíveis">
          <div className="grid grid-cols-3 gap-2">
            {CATALOGO.map((d) => {
              const ativo = sim.modoColocar === d.tipo;
              return (
                <button
                  key={d.tipo}
                  type="button"
                  draggable
                  onDragStart={(e) => iniciarArraste(e, d.tipo)}
                  onClick={() => sim.setModoColocar(ativo ? null : d.tipo)}
                  aria-pressed={ativo}
                  title={`${d.resumo} ${d.ondeSoltar}`}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border px-1.5 pt-2.5 pb-2 text-center transition-colors cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${
                    ativo ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700/30' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <IconeIntervencao tipo={d.tipo} tamanho={34} />
                  <span className="text-[11px] font-semibold text-slate-800 leading-tight">{d.nome}</span>
                </button>
              );
            })}
          </div>
          {sim.modoColocar && (
            <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 mt-2" role="status">
              Clique no mapa para colocar: {DEFINICAO[sim.modoColocar].nome.toLowerCase()}. {DEFINICAO[sim.modoColocar].ondeSoltar}
            </p>
          )}
        </section>

        {/* Intervenções colocadas */}
        <section aria-label="Intervenções no mapa">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900">No mapa ({sim.intervencoes.length})</h3>
            {sim.intervencoes.length > 0 && (
              <button type="button" onClick={sim.limpar} className="text-[11px] font-semibold text-slate-500 hover:text-red-700">
                Tirar todas
              </button>
            )}
          </div>
          {sim.intervencoes.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-3">
              Nada colocado: este é o cenário atual do cruzamento. Coloque uma intervenção para ver o efeito nos agentes.
            </p>
          ) : (
            <ul className="space-y-2">
              {sim.intervencoes.map((i) => {
                const a = sim.analises.get(i.id);
                const o = custoPorId.get(i.id);
                const sel = sim.intervencaoSelecionada === i.id;
                return (
                  <li key={i.id} className={`rounded-xl border px-2.5 py-2 ${sel ? 'border-cyan-500 bg-cyan-50/40' : 'border-slate-200 bg-slate-50/70'}`}>
                    <div className="flex items-start gap-2.5">
                      <button type="button" onClick={() => sim.selecionarIntervencao(sel ? null : i.id)} className="shrink-0 mt-0.5" aria-label={`Selecionar ${DEFINICAO[i.tipo].nome}`}>
                        <IconeIntervencao tipo={i.tipo} tamanho={28} invalida={a ? !a.valida : false} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => sim.selecionarIntervencao(sel ? null : i.id)} className="text-left w-full">
                          <span className="text-xs font-bold text-slate-900 block">{DEFINICAO[i.tipo].nome}</span>
                          <span className={`text-[11px] leading-snug block ${a?.valida ? 'text-slate-600' : 'text-red-700 font-medium'}`}>
                            {a?.valida ? a.efeito : `Sem efeito. ${a?.efeito ?? ''}`}
                          </span>
                        </button>
                        {o && (
                          <span className="text-[11px] text-slate-700 tabular-nums block mt-0.5">
                            {o.totalImplantacao > 0 && <>{formatarReais(o.totalImplantacao)} na implantação</>}
                            {o.totalImplantacao > 0 && o.totalMensal > 0 && ', '}
                            {o.totalMensal > 0 && <>{formatarReais(o.totalMensal)} por mês</>}
                          </span>
                        )}
                        {sel && DEFINICAO[i.tipo].observacao && <p className="text-[11px] text-amber-800 mt-1">{DEFINICAO[i.tipo].observacao}</p>}
                        {sel && i.tipo === 'semaforo' && (
                          <EditorTempos tempos={i.tempos ?? TEMPOS_PADRAO} onMudar={(t) => sim.atualizarTempos(i.id, t)} />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => sim.remover(i.id)}
                        aria-label={`Remover ${DEFINICAO[i.tipo].nome}`}
                        className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Resultado ao vivo */}
        <section aria-label="Resultado na simulação">
          <h3 className="text-sm font-bold text-slate-900">Agora na simulação</h3>
          <p className="text-[11px] text-slate-500 mb-2">
            A simulação roda em segundo plano, 20 vezes mais rápido que o real. Valores por hora, medidos em {num(minutos)} min simulados
            desde a última mudança{minutos < 15 ? ' (amostra curta, espere um pouco)' : ''}.
          </p>
          <dl className="grid grid-cols-2 gap-2">
            {[
              { rotulo: 'Quase-acidentes', valor: m ? num(totalConflitos(m)) : '–', extra: m ? `${num(m.conflitosGraves)} graves` : '' },
              { rotulo: 'Infrações', valor: m ? num(totalInfracoes(m)) : '–', extra: m ? `${num(m.infracoes.conversao_proibida + m.infracoes.retorno_proibido)} manobras proibidas` : '' },
              { rotulo: 'Atraso médio', valor: m ? `${num(m.atrasoMedio)} s` : '–', extra: 'por veículo' },
              { rotulo: 'Espera do pedestre', valor: m ? `${num(m.esperaMediaPedestre)} s` : '–', extra: 'para atravessar' },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <dt className="text-[11px] text-slate-500">{k.rotulo}</dt>
                <dd className="text-base font-extrabold text-slate-900 tabular-nums leading-tight">{k.valor}</dd>
                <dd className="text-[10px] text-slate-500">{k.extra}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Custo */}
        {sim.orcamento && sim.orcamento.itens.length > 0 && (
          <section aria-label="Custo do cenário no mapa" className="rounded-xl border border-slate-200 px-3 py-2.5">
            <h3 className="text-sm font-bold text-slate-900">Custo deste cenário</h3>
            <p className="text-xs text-slate-700 tabular-nums mt-1">
              <strong className="text-slate-900">{formatarReais(sim.orcamento.implantacao)}</strong> de implantação
              {sim.orcamento.mensal > 0 && (
                <>
                  {' '}e <strong className="text-slate-900">{formatarReais(sim.orcamento.mensal)}</strong> por mês
                </>
              )}
              . Prazo de {sim.orcamento.prazoDias} {sim.orcamento.prazoDias === 1 ? 'dia' : 'dias'} (obras em paralelo).
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Referência SINAPI/SICRO; itens sem composição pública aparecem como estimativa no detalhamento.</p>
          </section>
        )}

        {/* Cenários */}
        <section aria-label="Cenários salvos">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Cenários salvos</h3>
          <div className="space-y-2">
            {(['A', 'B'] as IdCenario[]).map((id) => {
              const resumo = resumoCenario(id);
              return (
                <div key={id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2">
                  <span className="w-6 h-6 rounded-md text-white text-xs font-extrabold flex items-center justify-center shrink-0" style={{ background: COR_CENARIO[id] }}>
                    {id}
                  </span>
                  <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{resumo ?? 'Vazio'}</span>
                  <button
                    type="button"
                    onClick={() => sim.salvarCenario(id)}
                    title={`Guardar o que está no mapa como cenário ${id}`}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-900 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-2 py-1"
                  >
                    <Save className="w-3 h-3" /> Salvar mapa
                  </button>
                  {resumo && (
                    <button
                      type="button"
                      onClick={() => sim.carregar(sim.cenarios[id] ?? [])}
                      title={`Pôr o cenário ${id} no mapa`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-lg px-2 py-1"
                    >
                      <Upload className="w-3 h-3" /> Abrir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Guarde o que está no mapa para reabrir depois. O cenário atual é o cruzamento sem nenhuma intervenção.</p>
        </section>
      </div>
    </div>
  );
};
