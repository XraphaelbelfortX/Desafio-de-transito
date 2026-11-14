import React, { useEffect, useState } from 'react';
import { BarChart3, MapPin, Minus, MousePointerClick, Plus, Save, Trash2, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import type { Metricas } from '../../sim/motor';
import { CATALOGO, DEFINICAO, TEMPOS_PADRAO, type TemposSemaforo, type TipoIntervencao } from '../../sim/intervencoes';
import { formatarReais, type IdCenario, type Simulacao } from '../../sim/useSimulacao';
import { orcarCenario, paraLocais, rodarCenario, totalConflitos, totalInfracoes } from '../../sim/cenarios';
import { IconeIntervencao } from './IconeIntervencao';
import { CartaoSugestoes, type Assistente } from './Sugestoes';
import { ComparacaoCenarios } from './ComparacaoCenarios';
import { ALCANCE, COR_ZONA, GRUPOS, tintaSobre } from './zonasIntervencao';

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

/** Título de etapa numerada: guia o operador pelo fluxo 1 → 2 → 3. */
const Etapa: React.FC<{ n: number; titulo: string; dica?: string; feita?: boolean; children?: React.ReactNode }> = ({ n, titulo, dica, feita, children }) => (
  <div className="flex items-start gap-2.5 mb-2.5">
    <span
      className={`shrink-0 w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
        feita ? 'bg-emerald-600 text-white' : 'bg-gov-navy text-white'
      }`}
    >
      {n}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900 leading-6">{titulo}</h3>
        {children}
      </div>
      {dica && <p className="text-[11px] text-slate-500 leading-snug">{dica}</p>}
    </div>
  </div>
);

/** Variação em relação ao cruzamento sem intervenções (menor é melhor). */
const Variacao: React.FC<{ agora: number; base: number | undefined; inverter?: boolean }> = ({ agora, base, inverter }) => {
  if (base === undefined || base <= 0) return null;
  const pct = Math.round((agora / base - 1) * 100);
  if (pct === 0) return <span className="text-[10px] font-bold text-slate-500">igual a hoje</span>;
  const melhor = inverter ? pct > 0 : pct < 0;
  const Icone = pct < 0 ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${melhor ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
      <Icone className="w-3 h-3" />
      {pct > 0 ? '+' : ''}
      {pct}% vs hoje
    </span>
  );
};

interface Props {
  sim: Simulacao;
  assistente?: Assistente;
}

export const PainelIntervencoes: React.FC<Props> = ({ sim, assistente }) => {
  const [comparacaoAberta, setComparacaoAberta] = useState(false);
  const custoPorId = new Map((sim.orcamento?.itens ?? []).map((i) => [i.intervencao.id, i.orcamento]));
  const m = sim.metricas;
  const minutos = m ? m.horas * 60 : 0;
  // "Hoje" = o cruzamento sem intervenções, rodado fora da tela do mesmo jeito que a tela Comparar
  // (aquecimento de 6 min, 3 sementes, 1 h), na hora cheia do relógio. Refaz quando a hora muda.
  const [base, setBase] = useState<Metricas | null>(null);
  const [calculandoBase, setCalculandoBase] = useState(false);
  const horaBase = Math.floor(sim.hora);
  const rede = sim.rede;
  useEffect(() => {
    if (!sim.pronto || !rede) return;
    let vivo = true;
    setBase(null);
    setCalculandoBase(true);
    rodarCenario(rede, [], { hora: horaBase })
      .then((r) => vivo && setBase(r.metricas))
      .catch(() => undefined)
      .finally(() => vivo && setCalculandoBase(false));
    return () => {
      vivo = false;
    };
  }, [sim.pronto, rede, horaBase]);
  const comparar = m && base && sim.intervencoes.length > 0 && minutos >= 10;
  const ritmo = !sim.rodando
    ? 'A simulação está pausada.'
    : sim.velocidade === 1
      ? 'A simulação corre na velocidade real.'
      : `A simulação corre ${sim.velocidade} vezes mais rápido que o real.`;

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
      <div className="bg-gov-navy text-white px-4 py-2.5 border-b border-slate-800">
        <h2 className="text-sm font-extrabold tracking-tight leading-tight">Teste uma solução para o cruzamento</h2>
        <p className="text-[11px] text-slate-300">Coloque, rode e compare com o cruzamento como está hoje.</p>
      </div>

      <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
        {/* Paleta */}
        <section aria-label="Intervenções disponíveis" className="space-y-2">
          <Etapa n={1} titulo="Escolha e coloque no mapa" dica="Clique numa intervenção e depois no mapa, ou arraste direto. A mancha colorida é onde ela age." feita={sim.intervencoes.length > 0}>
            <MousePointerClick className="w-4 h-4 text-slate-400" />
          </Etapa>
          {assistente && <CartaoSugestoes assistente={assistente} />}
          {GRUPOS.map((g) => (
            <div key={g.categoria}>
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{g.titulo}</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {CATALOGO.filter((d) => d.categoria === g.categoria).map((d) => {
                  const ativo = sim.modoColocar === d.tipo;
                  return (
                    <button
                      key={d.tipo}
                      type="button"
                      draggable
                      onDragStart={(e) => iniciarArraste(e, d.tipo)}
                      onClick={() => sim.setModoColocar(ativo ? null : d.tipo)}
                      aria-pressed={ativo}
                      title={`${d.resumo} ${ALCANCE[d.tipo]}. ${d.ondeSoltar}`}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center min-h-[64px] transition-colors cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${
                        ativo ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700/30' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <IconeIntervencao tipo={d.tipo} tamanho={26} />
                      <span className="text-[10.5px] font-semibold text-slate-900 leading-tight">{d.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {sim.modoColocar && (
            <p className="text-[11px] text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5" role="status">
              Clique no mapa para colocar {DEFINICAO[sim.modoColocar].nome.toLowerCase()}. {DEFINICAO[sim.modoColocar].ondeSoltar} A mancha mostra onde passa a agir.
            </p>
          )}
        </section>

        {/* Intervenções colocadas */}
        <section aria-label="Intervenções no mapa">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900">No cruzamento ({sim.intervencoes.length})</h3>
            {sim.intervencoes.length > 0 && (
              <button type="button" onClick={sim.limpar} className="text-[11px] font-semibold text-slate-500 hover:text-red-700">
                Tirar todas
              </button>
            )}
          </div>
          {sim.intervencoes.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2">
              Nada colocado: este é o cruzamento como está hoje.
            </p>
          ) : (
            <ul className="space-y-2">
              {sim.intervencoes.map((i, indice) => {
                const a = sim.analises.get(i.id);
                const o = custoPorId.get(i.id);
                const sel = sim.intervencaoSelecionada === i.id;
                const valida = a?.valida === true;
                const cor = valida ? COR_ZONA[i.tipo] : '#ef4444';
                const escolher = () => (sel ? sim.selecionarIntervencao(null) : sim.focarIntervencao(i.id));
                return (
                  <li
                    key={i.id}
                    className={`rounded-xl border-y border-r border-l-4 px-2.5 py-2 ${sel ? 'border-y-cyan-500 border-r-cyan-500 bg-cyan-50/50' : 'border-y-slate-200 border-r-slate-200 bg-white'}`}
                    style={{ borderLeftColor: cor }}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={escolher}
                        className="shrink-0 mt-0.5 w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center"
                        style={{ background: cor, color: valida ? tintaSobre(i.tipo) : '#ffffff', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.25)' }}
                        aria-label={`Mostrar ${DEFINICAO[i.tipo].nome} no mapa`}
                      >
                        {indice + 1}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={escolher} className="text-left w-full">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            {DEFINICAO[i.tipo].nome}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${valida ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-800'}`}>
                              {valida ? 'Agindo' : 'Sem efeito'}
                            </span>
                          </span>
                          <span className={`text-[11px] leading-snug block mt-0.5 ${valida ? 'text-slate-600' : 'text-red-700 font-medium'}`}>
                            {a ? a.efeito : 'Calculando o lugar…'}
                          </span>
                        </button>
                        {o && (
                          <span className="text-[11px] text-slate-700 tabular-nums block mt-0.5">
                            {o.totalImplantacao > 0 && <>{formatarReais(o.totalImplantacao)} na implantação</>}
                            {o.totalImplantacao > 0 && o.totalMensal > 0 && ', '}
                            {o.totalMensal > 0 && <>{formatarReais(o.totalMensal)} por mês</>}
                          </span>
                        )}
                        {sel && (
                          <p className="text-[11px] text-slate-700 mt-1.5 bg-white rounded-lg px-2 py-1.5 border border-slate-200">
                            {ALCANCE[i.tipo]}. {valida ? 'Essa mancha, no mapa, é o trecho que muda.' : DEFINICAO[i.tipo].ondeSoltar}
                          </p>
                        )}
                        {sel && DEFINICAO[i.tipo].observacao && <p className="text-[11px] text-amber-800 mt-1">{DEFINICAO[i.tipo].observacao}</p>}
                        {sel && i.tipo === 'semaforo' && (
                          <EditorTempos tempos={i.tempos ?? TEMPOS_PADRAO} onMudar={(t) => sim.atualizarTempos(i.id, t)} />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => sim.focarIntervencao(i.id)}
                        aria-label={`Centralizar ${DEFINICAO[i.tipo].nome} no mapa`}
                        title="Ver no mapa"
                        className="p-1 rounded text-slate-500 hover:text-blue-800 hover:bg-blue-50 shrink-0"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
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
          <Etapa
            n={2}
            titulo="Veja o efeito"
            dica={`${ritmo} Valores por hora, em ${num(minutos)} min simulados${minutos < 15 ? ' (amostra curta, espere um pouco)' : ''}.`}
            feita={minutos >= 15}
          />
          {calculandoBase && (
            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 mb-2">
              Calculando o cruzamento de hoje às {horaBase}h para comparar…
            </p>
          )}
          {m && (
            <div className={`rounded-xl px-3.5 py-3 mb-2 text-white ${m.risco >= (base?.risco ?? Infinity) * 0.9 || !comparar ? 'bg-gradient-to-br from-gov-navy to-slate-800' : 'bg-gradient-to-br from-emerald-700 to-emerald-900'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-200">Índice de risco por hora</span>
                {comparar && <Variacao agora={m.risco} base={base?.risco} />}
              </div>
              <div className="text-3xl font-extrabold tabular-nums leading-tight">{num(m.risco)}</div>
              <p className="text-[10px] text-slate-300">
                Quase-acidentes pesados pela gravidade e por quem está exposto (pedestre e moto pesam mais).
                {comparar && base ? ` Hoje: ${num(base.risco)}.` : ''}
              </p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2">
            {[
              { rotulo: 'Quase-acidentes', valor: m ? num(totalConflitos(m)) : '–', extra: m ? `${num(m.conflitosGraves)} graves` : '', agora: m ? totalConflitos(m) : 0, b: base ? totalConflitos(base) : undefined },
              { rotulo: 'Infrações', valor: m ? num(totalInfracoes(m)) : '–', extra: m ? `${num(m.infracoes.conversao_proibida + m.infracoes.retorno_proibido)} manobras proibidas` : '', agora: m ? totalInfracoes(m) : 0, b: base ? totalInfracoes(base) : undefined },
              { rotulo: 'Atraso médio', valor: m ? `${num(m.atrasoMedio)} s` : '–', extra: 'por veículo', agora: m?.atrasoMedio ?? 0, b: base?.atrasoMedio },
              { rotulo: 'Espera do pedestre', valor: m ? `${num(m.esperaMediaPedestre)} s` : '–', extra: 'para atravessar', agora: m?.esperaMediaPedestre ?? 0, b: base?.esperaMediaPedestre },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <dt className="text-[11px] text-slate-500">{k.rotulo}</dt>
                <dd className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{k.valor}</dd>
                <dd className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1">
                  {k.extra}
                  {comparar && <Variacao agora={k.agora} base={k.b} />}
                </dd>
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
          <Etapa n={3} titulo="Guarde e compare" dica="Salve o que está no mapa como A ou B e compare com o cruzamento de hoje." feita={!!(sim.cenarios.A || sim.cenarios.B)} />
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

      <footer className="border-t border-slate-200 bg-white px-4 py-3 shrink-0 space-y-2.5">
        {m && (
          <div className="grid grid-cols-3 gap-1.5" aria-label="Resultado ao vivo">
            {[
              { rotulo: 'Risco/h', agora: m.risco, b: base?.risco },
              { rotulo: 'Quase-acidentes/h', agora: totalConflitos(m), b: base ? totalConflitos(base) : undefined },
              { rotulo: 'Infrações/h', agora: totalInfracoes(m), b: base ? totalInfracoes(base) : undefined },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5">
                <div className="text-[10px] text-slate-500 leading-tight">{k.rotulo}</div>
                <div className="text-sm font-extrabold tabular-nums text-slate-900 leading-tight">{num(k.agora)}</div>
                {comparar ? <Variacao agora={k.agora} base={k.b} /> : <span className="text-[10px] text-slate-400">{sim.intervencoes.length === 0 ? (base ? `hoje: ${num(k.b ?? 0)}` : 'calculando…') : 'medindo…'}</span>}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setComparacaoAberta(true)}
          disabled={!sim.pronto}
          className="w-full rounded-xl bg-blue-700 text-white text-sm font-bold py-3 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 flex items-center justify-center gap-2 shadow-sm"
        >
          <BarChart3 className="w-4 h-4" />
          Comparar hoje × A × B
        </button>
      </footer>

      <ComparacaoCenarios sim={sim} aberto={comparacaoAberta} onFechar={() => setComparacaoAberta(false)} />
    </div>
  );
};
