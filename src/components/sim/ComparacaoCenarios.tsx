import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { NOME_CONFLITO, NOME_INFRACAO, type TipoConflito, type TipoInfracao } from '../../sim/motor';
import { DEFINICAO, type Intervencao, type ItemCusto } from '../../sim/intervencoes';
import {
  orcarCenario,
  paraLocais,
  reducaoDeRisco,
  rodarCenario,
  totalInfracoes,
  type OrcamentoCenario,
  type ResultadoRodada,
} from '../../sim/cenarios';
import { formatarHora, formatarReais, type IdCenario, type Simulacao } from '../../sim/useSimulacao';

const COR: Record<IdColuna, string> = { atual: '#2a78d6', A: '#eb6834', B: '#1baf7a' };

type IdColuna = 'atual' | IdCenario;

interface Coluna {
  id: IdColuna;
  nome: string;
  resultado: ResultadoRodada;
  orcamento: OrcamentoCenario;
}

const INFR: TipoInfracao[] = ['conversao_proibida', 'retorno_proibido', 'avanco_sinal', 'excesso_velocidade'];
const CONF: TipoConflito[] = ['cruzamento', 'pedestre', 'traseira'];

const num = (v: number, casas = 0) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas });

const reaisCentavos = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const textoReducao = (r: number | null) => {
  if (r === null || !Number.isFinite(r)) return '–';
  const pct = Math.round(r * 100);
  if (pct === 0) return '0%';
  return `${r > 0 ? '−' : '+'}${Math.abs(pct)}%`;
};

const custoAno = (o: OrcamentoCenario) => o.implantacao + 12 * o.mensal;

interface BarraItem {
  id: IdColuna;
  nome: string;
  valor: number;
  texto: string;
}

const Grafico: React.FC<{ titulo: string; itens: BarraItem[] }> = ({ titulo, itens }) => {
  const max = Math.max(1e-9, ...itens.map((i) => i.valor));
  return (
    <figure className="min-w-0">
      <figcaption className="text-xs font-bold text-slate-900 mb-1.5">{titulo}</figcaption>
      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <span className="w-10 text-[11px] font-semibold text-slate-600 shrink-0">{i.nome}</span>
            <span className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${(i.valor / max) * 100}%`, background: COR[i.id] }} />
            </span>
            <span className="w-[7.5rem] text-right text-[11px] tabular-nums text-slate-800 shrink-0">{i.texto}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};

const LinhaItem: React.FC<{ item: ItemCusto }> = ({ item }) => {
  const estimativa = item.fonte === 'Estimativa';
  const total = item.quantidade * item.precoUnitario;
  return (
    <li className={`rounded-lg border px-2 py-1.5 ${estimativa ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-slate-900">{item.descricao}</span>
        {estimativa && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-900 bg-amber-200 rounded px-1">Estimativa</span>
        )}
      </div>
      <p className="text-slate-500 mt-0.5">
        {item.fonte}
        {item.codigo ? ` · ${item.codigo}` : ''}
        {item.referencia ? ` · ${item.referencia}` : ''}
      </p>
      <p className="tabular-nums text-slate-700 mt-0.5">
        {num(item.quantidade, 2)} {item.unidade} × {reaisCentavos(item.precoUnitario)} = {reaisCentavos(total)}
      </p>
    </li>
  );
};

interface Props {
  sim: Simulacao;
  aberto: boolean;
  onFechar: () => void;
}

/**
 * Roda Atual, A e B fora da tela (3 × 1 h, mesmas sementes) e mostra risco, atraso e custo.
 * O efeito só depende de `aberto`: o objeto sim muda a cada render.
 */
export const ComparacaoCenarios: React.FC<Props> = ({ sim, aberto, onFechar }) => {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [prog, setProg] = useState(0);
  const [fase, setFase] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [horaConta, setHoraConta] = useState(sim.hora);
  const [faltam, setFaltam] = useState<IdCenario[]>([]);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!aberto || !sim.rede) return;
    const rede = sim.rede;
    const hora = sim.hora;
    const salvos = sim.cenarios;
    const estava = sim.rodando;
    const pausar = sim.setRodando;
    const token = ++tokenRef.current;
    let vivo = true;
    let terminou = false;
    if (estava) pausar(false);

    const entradas: { id: IdColuna; nome: string; ints: Intervencao[] }[] = [{ id: 'atual', nome: 'Hoje', ints: [] }];
    const ausentes: IdCenario[] = [];
    (['A', 'B'] as IdCenario[]).forEach((id) => {
      const ints = salvos[id];
      if (ints) entradas.push({ id, nome: id, ints });
      else ausentes.push(id);
    });

    setColunas([]);
    setProg(0);
    setErro(null);
    setCalculando(true);
    setHoraConta(hora);
    setFaltam(ausentes);
    setFase(entradas[0].nome);

    const executar = async () => {
      try {
        const acc: Coluna[] = [];
        for (let i = 0; i < entradas.length; i++) {
          if (!vivo) return;
          setFase(entradas[i].nome);
          const locais = paraLocais(rede, entradas[i].ints);
          const resultado = await rodarCenario(rede, locais, {
            hora,
            aoProgresso: (f) => {
              if (!vivo) throw new Error('cancelado');
              setProg((i + f) / entradas.length);
            },
          });
          if (!vivo) return;
          acc.push({ ...entradas[i], resultado, orcamento: orcarCenario(rede, locais) });
          setColunas([...acc]);
        }
        if (vivo) setProg(1);
      } catch (e) {
        if (vivo && !(e instanceof Error && e.message === 'cancelado')) {
          setErro(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (vivo && tokenRef.current === token) {
          terminou = true;
          setCalculando(false);
          if (estava) pausar(true);
        }
      }
    };
    void executar();

    return () => {
      vivo = false;
      if (!terminou && estava) pausar(true);
    };
    // sim muda de identidade a cada render; a rodada usa o retrato do momento em que o modal abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!aberto) return null;

  const riscoAtual = colunas.find((c) => c.id === 'atual')?.resultado.metricas.risco ?? null;
  const barras = (valor: (c: Coluna) => number, texto: (c: Coluna) => string): BarraItem[] =>
    colunas.map((c) => ({ id: c.id, nome: c.nome, valor: valor(c), texto: texto(c) }));

  const celula = (c: Coluna, texto: string) => (
    <td key={c.id} className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
      {texto}
    </td>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" role="presentation" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-comparacao"
        className="bg-white text-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 id="titulo-comparacao" className="text-lg font-extrabold text-slate-900">
              Hoje × A × B
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Horário {formatarHora(horaConta)}. Três rodadas de 1 h, com as mesmas sementes. A simulação ao vivo pausa enquanto a conta roda.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar comparação" className="text-slate-400 hover:text-slate-800 p-1">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-5">
          {calculando && (
            <div>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                <span>Calculando {fase}</span>
                <span className="tabular-nums">{Math.round(prog * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-700 transition-[width] duration-150" style={{ width: `${Math.round(prog * 100)}%` }} />
              </div>
            </div>
          )}

          {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

          {faltam.length > 0 && (
            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 space-y-1">
              {faltam.map((id) => (
                <p key={id}>
                  O cenário {id} ainda não foi salvo. No painel, monte as intervenções no mapa e clique em Salvar mapa ao lado de {id}.
                </p>
              ))}
            </div>
          )}

          {colunas.length > 0 && (
            <>
              <div className="flex flex-wrap gap-3 text-[11px]" aria-label="Legenda dos cenários">
                {colunas.map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR[c.id] }} />
                    {c.nome}
                    {c.id !== 'atual' && riscoAtual !== null && (
                      <span className="font-medium text-slate-500">{textoReducao(reducaoDeRisco(c.resultado.metricas.risco, riscoAtual))} de risco</span>
                    )}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Grafico
                  titulo="Risco por hora"
                  itens={barras(
                    (c) => c.resultado.metricas.risco,
                    (c) => `${num(c.resultado.metricas.risco)} (${num(c.resultado.riscoMin)}–${num(c.resultado.riscoMax)})`
                  )}
                />
                <Grafico titulo="Quase-acidentes graves por hora" itens={barras((c) => c.resultado.metricas.conflitosGraves, (c) => num(c.resultado.metricas.conflitosGraves))} />
                <Grafico titulo="Infrações por hora" itens={barras((c) => totalInfracoes(c.resultado.metricas), (c) => num(totalInfracoes(c.resultado.metricas)))} />
                <Grafico titulo="Atraso médio" itens={barras((c) => c.resultado.metricas.atrasoMedio, (c) => `${num(c.resultado.metricas.atrasoMedio)} s`)} />
                <Grafico titulo="Custo em 12 meses" itens={barras((c) => custoAno(c.orcamento), (c) => formatarReais(custoAno(c.orcamento)))} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="py-1.5 pr-2 font-semibold text-slate-500">Indicador</th>
                      {colunas.map((c) => (
                        <th key={c.id} className="px-2 py-1.5 text-right font-bold" style={{ color: COR[c.id] }}>
                          {c.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Risco por hora</th>
                      {colunas.map((c) => celula(c, `${num(c.resultado.metricas.risco)} (${num(c.resultado.riscoMin)} a ${num(c.resultado.riscoMax)})`))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Redução de risco</th>
                      {colunas.map((c) => celula(c, c.id === 'atual' || riscoAtual === null ? '–' : textoReducao(reducaoDeRisco(c.resultado.metricas.risco, riscoAtual))))}
                    </tr>
                    {INFR.map((k) => (
                      <tr key={k} className="border-b border-slate-100">
                        <th className="py-1 pr-2 font-medium text-left">{NOME_INFRACAO[k]} por hora</th>
                        {colunas.map((c) => celula(c, num(c.resultado.metricas.infracoes[k])))}
                      </tr>
                    ))}
                    {CONF.map((k) => (
                      <tr key={k} className="border-b border-slate-100">
                        <th className="py-1 pr-2 font-medium text-left">{NOME_CONFLITO[k]} por hora</th>
                        {colunas.map((c) => celula(c, num(c.resultado.metricas.conflitos[k])))}
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Espera do pedestre</th>
                      {colunas.map((c) => celula(c, `${num(c.resultado.metricas.esperaMediaPedestre)} s`))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Implantação</th>
                      {colunas.map((c) => celula(c, formatarReais(c.orcamento.implantacao)))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Mensal</th>
                      {colunas.map((c) => celula(c, formatarReais(c.orcamento.mensal)))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-1 pr-2 font-medium text-left">Prazo</th>
                      {colunas.map((c) => celula(c, `${c.orcamento.prazoDias} ${c.orcamento.prazoDias === 1 ? 'dia' : 'dias'}`))}
                    </tr>
                    <tr>
                      <th className="py-1 pr-2 font-medium text-left">Custo em 12 meses</th>
                      {colunas.map((c) => celula(c, formatarReais(custoAno(c.orcamento))))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <section aria-label="Memorial de custos" className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Memorial de custos</h3>
                {colunas.map((c) => (
                  <div key={c.id}>
                    <h4 className="text-xs font-bold mb-1" style={{ color: COR[c.id] }}>
                      {c.nome}
                      {c.orcamento.itens.length === 0 && <span className="font-medium text-slate-500"> · sem obra</span>}
                    </h4>
                    {c.orcamento.invalidas.length > 0 && (
                      <p className="text-[11px] text-red-700 mb-1">
                        {c.orcamento.invalidas.length === 1 ? 'Uma intervenção ficou' : `${c.orcamento.invalidas.length} intervenções ficaram`} fora do lugar em que age e não entra no custo.
                      </p>
                    )}
                    <ul className="space-y-2">
                      {c.orcamento.itens.map((item) => (
                        <li key={item.intervencao.id}>
                          <p className="text-[11px] font-semibold text-slate-800 mb-1">{DEFINICAO[item.intervencao.tipo].nome}</p>
                          <ul className="space-y-1 text-[11px]">
                            {item.orcamento.implantacao.map((linha, i) => (
                              <LinhaItem key={`i-${i}`} item={linha} />
                            ))}
                            {item.orcamento.mensal.map((linha, i) => (
                              <LinhaItem key={`m-${i}`} item={linha} />
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </>
          )}

          <footer className="text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-3">
            <p>
              O risco por hora soma os quase-acidentes com peso: grave vale 3, moderado vale 1, conflito com pedestre vale o dobro e colisão traseira vale 0,7. A redução é 1 − risco do cenário ÷ risco do atual. A medida seguinte age sobre o risco que sobrou. As porcentagens não se somam.
            </p>
            <p>Os volumes de carros, motos, ônibus e pedestres são estimativas para esta demonstração. A contagem da SMTT substitui esses números.</p>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
};
