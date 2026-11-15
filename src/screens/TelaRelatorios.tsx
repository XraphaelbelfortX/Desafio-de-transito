import React, { useMemo, useState } from 'react';
import { BarChart3, Printer, SlidersHorizontal, ListChecks } from 'lucide-react';
import type { Incident } from '../types';
import type { Tela } from '../components/shell/NavRail';
import { KpiCard } from '../components/shell/KpiCard';
import { LogComportamento } from '../components/sim/LogComportamento';
import { ComparacaoCenarios } from '../components/sim/ComparacaoCenarios';
import { COR_ZONA } from '../components/sim/zonasIntervencao';
import { formatarHora, formatarReais, type IdCenario, type Simulacao } from '../sim/useSimulacao';
import { orcarCenario, paraLocais, totalConflitos, totalInfracoes } from '../sim/cenarios';
import { DEFINICAO } from '../sim/intervencoes';
import { NOME_CONFLITO, NOME_INFRACAO, type TipoConflito, type TipoInfracao } from '../sim/motor';

interface Props {
  sim: Simulacao;
  incidents: Incident[];
  onNavegar: (t: Tela) => void;
}

const num = (v: number, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });
const reais2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const SEVERIDADE: Record<Incident['severidade'], { rotulo: string; cor: string }> = {
  critica: { rotulo: 'Crítica', cor: '#ef4444' },
  alta: { rotulo: 'Alta', cor: '#fb923c' },
  media: { rotulo: 'Média', cor: '#facc15' },
  baixa: { rotulo: 'Baixa', cor: '#8a97b0' },
};

const Secao: React.FC<{ titulo: string; descricao?: string; children: React.ReactNode }> = ({ titulo, descricao, children }) => (
  <section className="print-bloco bg-gv-panel border border-gv-border rounded-xl p-4">
    <h2 className="text-sm font-bold text-gv-ink">{titulo}</h2>
    {descricao && <p className="text-[11px] text-gv-muted mt-0.5">{descricao}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

const Barras: React.FC<{ itens: { rotulo: string; valor: number }[]; cor: string }> = ({ itens, cor }) => {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[150px_1fr_44px] items-center gap-2 text-[11px]">
          <span className="text-gv-ink truncate">{i.rotulo}</span>
          <span className="h-2.5 rounded-full bg-gv-border overflow-hidden">
            <span className="barra block h-full rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          </span>
          <span className="text-right font-semibold text-gv-ink tabular-nums">{num(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
};

/** Relatório do cruzamento: o que a simulação mediu, o que se propõe, quanto custa e o que já aconteceu. */
export const TelaRelatorios: React.FC<Props> = ({ sim, incidents, onNavegar }) => {
  const [comparar, setComparar] = useState(false);
  const m = sim.metricas;
  const minutos = m ? m.horas * 60 : 0;
  const orc = sim.orcamento;
  const geradoEm = useMemo(() => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), []);

  const cenarios = (['A', 'B'] as IdCenario[]).map((id) => {
    const c = sim.cenarios[id];
    if (!c || !sim.rede) return { id, n: c?.length ?? null, implantacao: 0, mensal: 0 };
    const o = orcarCenario(sim.rede, paraLocais(sim.rede, c));
    return { id, n: c.length, implantacao: o.implantacao, mensal: o.mensal };
  });

  const itensCusto = (orc?.itens ?? []).flatMap((it) =>
    it.orcamento.implantacao.map((c) => ({ ...c, intervencao: DEFINICAO[it.intervencao.tipo].nome })),
  );

  const porOrigem = incidents.reduce<Record<string, number>>((acc, i) => {
    const k = i.origem ?? 'Registro SMTT';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="relatorio flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gv-border">
        <div>
          <h1 className="text-lg font-bold text-gv-ink leading-tight">Relatório do cruzamento</h1>
          <p className="text-xs text-gv-muted">Av. dos Africanos × Av. Vicente Venâncio de Queiroga · São Luís/MA · gerado em {geradoEm}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            type="button"
            onClick={() => setComparar(true)}
            disabled={!sim.pronto}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gv-border bg-gv-card text-gv-ink hover:border-gv-cyan/40 disabled:opacity-40"
          >
            <BarChart3 className="w-4 h-4" /> Comparar hoje × A × B
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-gv-cyan text-gv-cyanink hover:brightness-110"
          >
            <Printer className="w-4 h-4" /> Imprimir / salvar PDF
          </button>
        </div>
      </header>

      <div className="relatorio-rolagem flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 flex flex-col gap-3">
          {/* 1. Resumo */}
          <Secao
            titulo="1. Situação medida na simulação"
            descricao={`Cenário no mapa agora: ${sim.intervencoes.length} ${sim.intervencoes.length === 1 ? 'intervenção' : 'intervenções'} · ${num(minutos)} min simulados · relógio às ${formatarHora(sim.hora)} · valores por hora.`}
          >
            <div className="flex flex-wrap gap-3">
              <KpiCard rotulo="Índice de risco" valor={m ? num(m.risco) : '—'} variacao="quase-acidentes ponderados" corVariacao="red" />
              <KpiCard rotulo="Quase-acidentes" valor={m ? num(totalConflitos(m)) : '—'} variacao={m ? `${num(m.conflitosGraves)} graves` : ''} corVariacao="amber" />
              <KpiCard rotulo="Infrações" valor={m ? num(totalInfracoes(m)) : '—'} variacao="manobras e excessos" corVariacao="amber" />
              <KpiCard rotulo="Atraso médio" valor={m ? `${num(m.atrasoMedio)} s` : '—'} variacao="por veículo" corVariacao="cyan" />
              <KpiCard rotulo="Espera do pedestre" valor={m ? `${num(m.esperaMediaPedestre)} s` : '—'} variacao="para atravessar" corVariacao="cyan" />
            </div>
            {minutos < 15 && (
              <p className="no-print text-[11px] text-gv-amber bg-gv-amber/10 border border-gv-amber/40 rounded-lg px-2.5 py-1.5 mt-3">
                Amostra curta ({num(minutos)} min). Deixe a simulação rodar em 20× na aba Simular antes de usar estes números.
              </p>
            )}
          </Secao>

          {/* 2. Por tipo */}
          {m && (
            <div className="grid md:grid-cols-2 gap-3">
              <Secao titulo="2. Quase-acidentes por tipo" descricao="Por hora. Grave = trajetórias a menos de 0,8 s uma da outra.">
                <Barras cor="#fb923c" itens={(Object.keys(m.conflitos) as TipoConflito[]).map((k) => ({ rotulo: NOME_CONFLITO[k], valor: m.conflitos[k] }))} />
              </Secao>
              <Secao titulo="3. Infrações por tipo" descricao="Por hora, decididas pelos motoristas simulados.">
                <Barras cor="#a78bfa" itens={(Object.keys(m.infracoes) as TipoInfracao[]).map((k) => ({ rotulo: NOME_INFRACAO[k], valor: m.infracoes[k] }))} />
              </Secao>
            </div>
          )}

          {/* 4. Intervenções propostas */}
          <Secao titulo="4. Intervenções propostas" descricao="O que está colocado no mapa da aba Simular, com o efeito e o custo de cada uma.">
            {!orc || orc.itens.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gv-muted bg-gv-card border border-dashed border-gv-border rounded-xl px-3 py-3">
                Nenhuma intervenção colocada: este é o cruzamento como está hoje.
                <button type="button" onClick={() => onNavegar('simular')} className="no-print flex items-center gap-1.5 text-gv-cyan font-semibold">
                  <SlidersHorizontal className="w-4 h-4" /> Ir para Simular
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-gv-muted border-b border-gv-border">
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-2 font-semibold">Intervenção</th>
                      <th className="py-1.5 pr-2 font-semibold">Efeito no local</th>
                      <th className="py-1.5 pr-2 font-semibold text-right">Implantação</th>
                      <th className="py-1.5 font-semibold text-right">Mensal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orc.itens.map((it, k) => (
                      <tr key={it.intervencao.id} className="border-b border-gv-border/60 align-top">
                        <td className="py-1.5 pr-2 text-gv-muted">{k + 1}</td>
                        <td className="py-1.5 pr-2 font-semibold text-gv-ink whitespace-nowrap">
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: COR_ZONA[it.intervencao.tipo] }} />
                          {DEFINICAO[it.intervencao.tipo].nome}
                        </td>
                        <td className="py-1.5 pr-2 text-gv-muted">{it.efeito}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-gv-ink">{it.orcamento.totalImplantacao > 0 ? formatarReais(it.orcamento.totalImplantacao) : '—'}</td>
                        <td className="py-1.5 text-right tabular-nums text-gv-ink">{it.orcamento.totalMensal > 0 ? formatarReais(it.orcamento.totalMensal) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-gv-ink">
                      <td colSpan={3} className="pt-2">Total · prazo {orc.prazoDias} {orc.prazoDias === 1 ? 'dia' : 'dias'} (obras em paralelo)</td>
                      <td className="pt-2 text-right tabular-nums text-gv-cyan">{formatarReais(orc.implantacao)}</td>
                      <td className="pt-2 text-right tabular-nums text-gv-cyan">{orc.mensal > 0 ? formatarReais(orc.mensal) : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
                {orc.invalidas.length > 0 && (
                  <p className="text-[11px] text-gv-red mt-2">
                    {orc.invalidas.length} {orc.invalidas.length === 1 ? 'intervenção está' : 'intervenções estão'} fora de um lugar onde agem e não entram no orçamento.
                  </p>
                )}
              </div>
            )}
          </Secao>

          {/* 4b. Memória de cálculo */}
          {itensCusto.length > 0 && (
            <Secao titulo="Memória de cálculo da implantação" descricao="Custo direto, sem BDI. Itens marcados como estimativa precisam de cotação da SMTT.">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-gv-muted border-b border-gv-border">
                      <th className="py-1.5 pr-2 font-semibold">Item</th>
                      <th className="py-1.5 pr-2 font-semibold">Referência</th>
                      <th className="py-1.5 pr-2 font-semibold text-right">Qtd × unit.</th>
                      <th className="py-1.5 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensCusto.map((c, k) => (
                      <tr key={k} className="border-b border-gv-border/60 align-top">
                        <td className="py-1.5 pr-2 text-gv-ink">
                          {c.descricao}
                          <span className="block text-[10px] text-gv-muted">{c.intervencao}</span>
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {c.fonte === 'Estimativa' ? (
                            <span className="text-[10px] font-bold uppercase text-gv-cyanink bg-gv-amber rounded px-1">Estimativa</span>
                          ) : (
                            <span className="text-gv-muted">
                              {c.fonte}
                              {c.codigo ? ` ${c.codigo}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-gv-muted whitespace-nowrap">
                          {num(c.quantidade, c.quantidade % 1 ? 1 : 0)} {c.unidade} × {reais2(c.precoUnitario)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums font-semibold text-gv-ink">{reais2(c.quantidade * c.precoUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Secao>
          )}

          {/* 6. Cenários */}
          <Secao titulo="5. Cenários guardados" descricao="Salvos na aba Simular para comparar com o cruzamento de hoje.">
            <div className="grid sm:grid-cols-2 gap-2">
              {cenarios.map((c) => (
                <div key={c.id} className="rounded-lg border border-gv-border bg-gv-card px-3 py-2.5">
                  <p className="text-xs font-bold text-gv-ink">Cenário {c.id}</p>
                  {c.n === null ? (
                    <p className="text-[11px] text-gv-muted">Vazio</p>
                  ) : (
                    <p className="text-[11px] text-gv-muted">
                      {c.n} {c.n === 1 ? 'intervenção' : 'intervenções'} · {formatarReais(c.implantacao)}
                      {c.mensal > 0 ? ` + ${formatarReais(c.mensal)}/mês` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="no-print text-[11px] text-gv-muted mt-2">
              Use "Comparar hoje × A × B" no topo para rodar os três cenários lado a lado (1 hora simulada, 3 repetições).
            </p>
          </Secao>

          {/* 7. Ocorrências */}
          <Secao
            titulo="6. Ocorrências registradas"
            descricao={`${incidents.length} no cruzamento · ${Object.entries(porOrigem)
              .map(([k, v]) => `${v} ${k}`)
              .join(' · ')}. Fatos já acontecidos: não mudam com a simulação.`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gv-muted border-b border-gv-border">
                    <th className="py-1.5 pr-2 font-semibold">Quando</th>
                    <th className="py-1.5 pr-2 font-semibold">Ocorrência</th>
                    <th className="py-1.5 pr-2 font-semibold">Severidade</th>
                    <th className="py-1.5 font-semibold">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((i) => (
                    <tr key={i.id} className="border-b border-gv-border/60 align-top">
                      <td className="py-1.5 pr-2 text-gv-muted whitespace-nowrap">{i.horario ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-gv-ink">
                        <span className="font-semibold">{i.tipo}</span>
                        <span className="block text-gv-muted">{i.resumo}</span>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span className="font-semibold" style={{ color: SEVERIDADE[i.severidade].cor }}>
                          {SEVERIDADE[i.severidade].rotulo}
                        </span>
                      </td>
                      <td className="py-1.5 text-gv-muted whitespace-nowrap">{i.origem ?? 'Registro SMTT'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>

          {/* 8. Decisões */}
          <details className="no-print bg-gv-panel border border-gv-border rounded-xl">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-gv-ink flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-gv-cyan" /> 7. Registro de decisões dos agentes
              <span className="text-[11px] font-normal text-gv-muted">(por que cada motorista fez o que fez)</span>
            </summary>
            <div className="px-1 pb-1">
              <LogComportamento sim={sim} />
            </div>
          </details>

          <p className="text-[10px] text-gv-muted leading-relaxed px-1 pb-2">
            Método: simulação microscópica por agentes (aceleração pelo modelo IDM, decisões com fatores explícitos). Quase-acidente = duas
            trajetórias pelo mesmo ponto com menos de 1,5 s de diferença (PET) ou risco de batida traseira (TTC). Índice de risco = quase-acidentes
            por hora ponderados pela gravidade e pela vulnerabilidade de quem está exposto. Os volumes de tráfego são estimativas até a contagem
            classificada da SMTT; os custos seguem SINAPI, SICRO e outras referências públicas, sem BDI.
          </p>
        </div>
      </div>

      <ComparacaoCenarios sim={sim} aberto={comparar} onFechar={() => setComparar(false)} />
    </div>
  );
};
