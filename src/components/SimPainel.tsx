import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, X, BarChart3 } from 'lucide-react';
import { NOMES_INFRACAO, PRESETS, cenariosDemo, intervencaoDe } from '../sim';
import type { Horario, TipoInfracao } from '../sim';
import type { useSimulacao } from '../sim/useSimulacao';

/**
 * Painel mínimo para testar o motor (src/sim) na tela. O Raphael pode trocar por um
 * painel definitivo: tudo aqui vem do hook useSimulacao e dos tipos do contrato.
 */
type Sim = ReturnType<typeof useSimulacao>;

const HORARIOS: { id: Horario; nome: string }[] = [
  { id: 'pico_tarde', nome: 'Pico da tarde' },
  { id: 'pico_manha', nome: 'Pico da manhã' },
  { id: 'fora_pico', nome: 'Fora do pico' },
];

const APROX_NOME: Record<string, string> = {
  africanos_leste: 'Africanos → leste',
  africanos_oeste: 'Africanos → oeste',
  vv: 'Vicente Venâncio',
  minerva: 'Rua Minerva',
  rua_norte: 'Rua norte',
};

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const reais = (v: number) => (v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : `R$ ${v}`);

export const SimPainel: React.FC<{ sim: Sim }> = ({ sim }) => {
  const [aberto, setAberto] = useState(true);
  const [horario, setHorario] = useState<Horario>('pico_tarde');
  const [semente, setSemente] = useState(42);
  const [ativas, setAtivas] = useState<string[]>([]);
  const [aba, setAba] = useState<'metricas' | 'comparar'>('metricas');

  const config = () => ({ semente, horario, intervencoes: ativas.map(intervencaoDe) });

  useEffect(() => {
    sim.iniciar(config());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reiniciar = () => sim.iniciar(config());

  const alternar = (id: string) => {
    const nova = ativas.includes(id) ? ativas.filter((a) => a !== id) : [...ativas, id];
    setAtivas(nova);
    sim.aplicarIntervencoes(nova.map(intervencaoDe));
  };

  const q = sim.quadro;
  const m = q?.metricas;
  const filaMax = m ? Math.max(1, ...Object.values(m.filaPorAproximacao)) : 1;

  return (
    <>
      <div className="absolute bottom-3 left-3 z-20 w-[340px] max-w-[calc(100%-24px)] max-h-[72%] flex flex-col bg-slate-900/92 backdrop-blur-md text-white rounded-xl border border-slate-700/80 shadow-xl text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/70">
          <span className="font-bold text-xs text-sky-300">Simulador com IA</span>
          <span className="font-mono text-slate-300">{q ? mmss(q.tempo) : '--:--'}</span>
          {q?.semaforo && (
            <span className="flex items-center gap-1 text-[10px] text-slate-300">
              <span className={`w-2 h-2 rounded-full ${q.semaforo.principal === 'verde' ? 'bg-green-400' : q.semaforo.principal === 'amarelo' ? 'bg-yellow-300' : 'bg-red-500'}`} />
              Africanos
              <span className={`w-2 h-2 rounded-full ${q.semaforo.secundaria === 'verde' ? 'bg-green-400' : q.semaforo.secundaria === 'amarelo' ? 'bg-yellow-300' : 'bg-red-500'}`} />
              VV
            </span>
          )}
          <button type="button" className="ml-auto p-1 hover:bg-slate-700 rounded" onClick={() => setAberto((a) => !a)} title={aberto ? 'Recolher' : 'Abrir'}>
            {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {aberto && (
          <div className="overflow-y-auto px-3 py-2 space-y-2.5">
            {/* Controles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={sim.rodando ? sim.pausar : sim.rodar}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold"
              >
                {sim.rodando ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {sim.rodando ? 'Pausar' : 'Rodar'}
              </button>
              {[1, 4, 10, 30].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => sim.setVelocidade(f)}
                  className={`px-2 py-1.5 rounded-lg border ${sim.velocidade === f ? 'bg-slate-200 text-slate-900 border-slate-200' : 'border-slate-600 hover:bg-slate-700'}`}
                >
                  {f}×
                </button>
              ))}
              <button type="button" onClick={reiniciar} className="p-1.5 rounded-lg border border-slate-600 hover:bg-slate-700" title="Reiniciar com a mesma semente">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={horario}
                onChange={(e) => setHorario(e.target.value as Horario)}
                className="bg-slate-800 border border-slate-600 rounded px-1.5 py-1"
              >
                {HORARIOS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-slate-300">
                Semente
                <input
                  type="number"
                  value={semente}
                  onChange={(e) => setSemente(Number(e.target.value) || 1)}
                  className="w-16 bg-slate-800 border border-slate-600 rounded px-1.5 py-1"
                />
              </label>
              <span className="text-slate-500">(reinicie para aplicar)</span>
            </div>

            {/* Intervenções */}
            <div>
              <div className="font-semibold text-slate-300 mb-1">Intervenções (valem na hora)</div>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.descricao}
                    onClick={() => alternar(p.id)}
                    className={`px-2 py-1 rounded-full border ${ativas.includes(p.id) ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-semibold' : 'border-slate-600 text-slate-200 hover:bg-slate-700'}`}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1 border-b border-slate-700">
              {(['metricas', 'comparar'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAba(a)}
                  className={`px-2 py-1 -mb-px border-b-2 ${aba === a ? 'border-sky-400 text-white' : 'border-transparent text-slate-400'}`}
                >
                  {a === 'metricas' ? 'Agora' : 'Comparar cenários'}
                </button>
              ))}
            </div>

            {aba === 'metricas' && m && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1 text-center">
                  <Kpi rotulo="Índice de risco" valor={`${m.indiceRisco}`} alerta={m.indiceRisco >= 60} />
                  <Kpi rotulo="Tempo médio" valor={`${Math.round(m.tempoMedioTravessiaS)} s`} />
                  <Kpi rotulo="Infrações" valor={`${m.infracoesTotal}`} />
                  <Kpi rotulo="Conflitos graves" valor={`${m.conflitosGraves}`} alerta={m.conflitosGraves > 0} />
                </div>
                <div>
                  <div className="font-semibold text-slate-300 mb-0.5">Fila por aproximação (veículos)</div>
                  {Object.entries(m.filaPorAproximacao).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <span className="w-28 text-slate-300 truncate">{APROX_NOME[k]}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded">
                        <div className="h-2 rounded bg-amber-400" style={{ width: `${(v / filaMax) * 100}%` }} />
                      </div>
                      <span className="w-7 text-right font-mono">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-semibold text-slate-300 mb-0.5">
                    Infrações por tipo <span className="font-normal text-slate-400">· {m.desistencias} desistiram</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2">
                    {(Object.keys(NOMES_INFRACAO) as TipoInfracao[]).map((k) => (
                      <div key={k} className="flex justify-between text-slate-300">
                        <span className="truncate">{NOMES_INFRACAO[k]}</span>
                        <span className="font-mono">{m.infracoes[k]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-300 mb-0.5">Últimos eventos</div>
                  {sim.eventos.slice(0, 5).map((e, i) => (
                    <button
                      key={`${e.tempo}-${i}`}
                      type="button"
                      onClick={() => sim.selecionar(e.agenteId)}
                      className="block w-full text-left truncate text-slate-300 hover:text-white"
                    >
                      <span className="font-mono text-slate-500">{mmss(e.tempo)}</span>{' '}
                      <span className={e.tipo.startsWith('conflito') || e.tipo === 'infracao' ? 'text-red-300' : e.tipo === 'desistencia' ? 'text-yellow-300' : 'text-sky-300'}>
                        {e.tipo === 'desistencia' ? 'Desistiu' : e.texto.split(':')[0]}
                      </span>{' '}
                      #{e.agenteId}
                    </button>
                  ))}
                </div>
                <Legenda />
              </div>
            )}

            {aba === 'comparar' && (
              <div className="space-y-1.5">
                <p className="text-slate-400">
                  Roda cada cenário por 30 min (+5 min de aquecimento) com a mesma semente: os mesmos motoristas chegam na mesma hora.
                </p>
                <button
                  type="button"
                  disabled={sim.comparando}
                  onClick={() => sim.comparar(cenariosDemo({ semente, horario }, ativas.map(intervencaoDe)))}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold disabled:opacity-50"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {sim.comparando ? 'Rodando cenários…' : 'Comparar cenários'}
                </button>
                {sim.comparacao && (
                  <table className="w-full text-[10px]">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="text-left">#</th>
                        <th className="text-left">Cenário</th>
                        <th>Nota</th>
                        <th>Tempo</th>
                        <th>Infr.</th>
                        <th>Graves</th>
                        <th>Risco</th>
                        <th>Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.comparacao.map((r, i) => (
                        <tr key={r.nome} className="border-t border-slate-700/60">
                          <td>{i + 1}</td>
                          <td className="pr-1">{r.nome}</td>
                          <td className="text-center font-bold">{r.nota}</td>
                          <td className="text-center">{Math.round(r.metricas.tempoMedioTravessiaS)}s</td>
                          <td className="text-center">{r.metricas.infracoesTotal}</td>
                          <td className="text-center">{r.metricas.conflitosGraves}</td>
                          <td className="text-center">{r.metricas.indiceRisco}</td>
                          <td className="text-center">{reais(r.custo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {sim.detalhe && <PainelAgente sim={sim} />}
    </>
  );
};

const Kpi: React.FC<{ rotulo: string; valor: string; alerta?: boolean }> = ({ rotulo, valor, alerta }) => (
  <div className={`rounded-lg px-1 py-1 ${alerta ? 'bg-red-500/20 text-red-200' : 'bg-slate-800'}`}>
    <div className="text-sm font-bold leading-tight">{valor}</div>
    <div className="text-[9px] text-slate-400 leading-tight">{rotulo}</div>
  </div>
);

const Legenda: React.FC = () => (
  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
    {[
      ['#e2e8f0', 'carro'],
      ['#a78bfa', 'app'],
      ['#34d399', 'moto'],
      ['#fb923c', 'ônibus'],
      ['#22d3ee', 'pedestre'],
      ['#ef4444', 'infringindo'],
      ['#facc15', 'desistiu'],
    ].map(([c, n]) => (
      <span key={n} className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
        {n}
      </span>
    ))}
  </div>
);

const TIPO_NOME: Record<string, string> = { carro: 'Carro particular', app: 'Carro de aplicativo', moto: 'Moto', onibus: 'Ônibus', pedestre: 'Pedestre' };

const PainelAgente: React.FC<{ sim: Sim }> = ({ sim }) => {
  const d = sim.detalhe!;
  return (
    <div className="absolute bottom-3 left-[360px] z-20 w-[300px] max-h-[60%] overflow-y-auto bg-slate-900/95 backdrop-blur-md text-white rounded-xl border border-slate-700/80 shadow-xl text-[11px] p-3 space-y-2 max-md:left-3 max-md:bottom-[calc(72%+12px)]">
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs">
          {TIPO_NOME[d.tipo]} #{d.id}
        </span>
        {d.infracao && <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px]">{NOMES_INFRACAO[d.infracao]}</span>}
        {d.desistiu && <span className="px-1.5 py-0.5 rounded bg-yellow-300 text-slate-900 text-[10px]">desistiu</span>}
        <button type="button" className="ml-auto p-0.5 hover:bg-slate-700 rounded" onClick={() => sim.selecionar(null)}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="text-slate-300">
        {d.movimento.replace(/_/g, ' ')} · {Math.round(d.velKmh)} km/h · {Math.round(d.tempoNaRede)} s na área
      </div>
      <div className="space-y-0.5">
        {(
          [
            ['Pressa', d.perfil.pressa, 'bg-orange-400'],
            ['Obediência', d.perfil.obediencia, 'bg-emerald-400'],
            ['Aversão a risco', d.perfil.aversaoRisco, 'bg-sky-400'],
          ] as const
        ).map(([n, v, c]) => (
          <div key={n} className="flex items-center gap-1.5">
            <span className="w-24 text-slate-400">{n}</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded">
              <div className={`h-1.5 rounded ${c}`} style={{ width: pct(v) }} />
            </div>
            <span className="w-8 text-right font-mono">{pct(v)}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="font-semibold text-slate-300 mb-0.5">Decisões (mais recente primeiro)</div>
        {d.decisoes.length === 0 && <div className="text-slate-500">Ainda não teve chance de infringir.</div>}
        {d.decisoes.map((dec, i) => (
          <div key={i} className={`mb-1 p-1.5 rounded ${dec.infringiu ? 'bg-red-500/15' : 'bg-slate-800'}`}>
            <div className="flex justify-between">
              <span className="font-semibold">{NOMES_INFRACAO[dec.infracao]}</span>
              <span className="text-slate-400">chance {pct(dec.probabilidade)}</span>
            </div>
            <div className="text-slate-300">{dec.motivo}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
