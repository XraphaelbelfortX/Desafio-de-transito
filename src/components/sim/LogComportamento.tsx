import React, { useEffect, useRef, useState } from 'react';
import { DEFINICAO, type Intervencao } from '../../sim/intervencoes';
import { totalConflitos, totalInfracoes } from '../../sim/cenarios';
import { NOME_TIPO, type Decisao } from '../../sim/motor';
import { formatarHora, type Simulacao } from '../../sim/useSimulacao';

/**
 * Registro do que os agentes decidem, e do que muda depois de cada intervenção no mapa.
 * As decisões saem do motor a cada quadro; a lista guarda as mais recentes.
 */

type Filtro = 'tudo' | 'critico';

interface Contagem {
  legais: number;
  ilegais: number;
  sinal: number;
  pedestre: number;
  conflitos: number;
}

const ZERO: Contagem = { legais: 0, ilegais: 0, sinal: 0, pedestre: 0, conflitos: 0 };

interface DecisaoLog {
  tipo: 'decisao';
  id: string;
  hora: string;
  agenteId: number;
  agente: string;
  titulo: string;
  texto: string;
  infracao: boolean;
  critico: boolean;
  detalhe: string | null;
}

interface MarcoLog {
  tipo: 'marco';
  id: string;
  texto: string;
  antes: string;
}

type Entrada = DecisaoLog | MarcoLog;

const fraseChance = (d: Decisao) => {
  if (d.probabilidade === undefined || d.sorteio === undefined) return null;
  const relacao =
    d.sorteio < d.probabilidade ? 'abaixo da chance' : d.sorteio > d.probabilidade ? 'acima da chance' : 'igual à chance';
  const sorteio = d.sorteio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Chance calculada: ${Math.round(d.probabilidade * 100)}%. Sorteio: ${sorteio}, ${relacao}.`;
};

const detalheDe = (d: Decisao) => {
  const chance = fraseChance(d);
  const fatores = d.fatores
    ?.slice(0, 4)
    .map((f) => `${f.efeito > 0 ? '+' : ''}${f.efeito.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${f.rotulo}`)
    .join(' · ');
  return [chance, fatores].filter(Boolean).join(' ') || null;
};

const contar = (d: Decisao, c: Contagem) => {
  if (d.tipo === 'conflito') c.conflitos++;
  else if (d.tipo === 'sinal' && d.infracao) c.sinal++;
  else if (d.tipo === 'pedestre') c.pedestre++;
  else if (d.infracao) c.ilegais++;
  else if (d.tipo === 'rota') c.legais++;
};

const textoDesde = (c: Contagem, fase: number) => {
  const partes = [
    c.ilegais ? `${c.ilegais} ${c.ilegais === 1 ? 'manobra proibida' : 'manobras proibidas'}` : '',
    c.sinal ? `${c.sinal} ${c.sinal === 1 ? 'avanço de sinal' : 'avanços de sinal'}` : '',
    c.conflitos ? `${c.conflitos} ${c.conflitos === 1 ? 'quase-acidente' : 'quase-acidentes'}` : '',
    c.pedestre ? `${c.pedestre} ${c.pedestre === 1 ? 'decisão com pedestre' : 'decisões com pedestre'}` : '',
    c.legais ? `${c.legais} ${c.legais === 1 ? 'rota legal' : 'rotas legais'}` : '',
  ].filter(Boolean);
  const prefixo = fase === 0 ? 'Desde o início' : 'Depois da última intervenção';
  if (!partes.length) return `${prefixo}: ainda sem decisão registrada.`;
  return `${prefixo}: ${partes.join(', ')}.`;
};

const descreverMudanca = (antes: Intervencao[], depois: Intervencao[], sim: Simulacao) => {
  const idsAntes = new Set(antes.map((i) => i.id));
  const idsDepois = new Set(depois.map((i) => i.id));
  const partes: string[] = [];
  for (const i of depois) {
    if (idsAntes.has(i.id)) continue;
    const a = sim.analises.get(i.id);
    partes.push(`colocou ${DEFINICAO[i.tipo].nome}${a?.efeito ? ` (${a.efeito})` : ''}`);
  }
  for (const i of antes) {
    if (!idsDepois.has(i.id)) partes.push(`tirou ${DEFINICAO[i.tipo].nome}`);
  }
  for (const i of depois) {
    const antigo = antes.find((x) => x.id === i.id);
    if (!antigo || (antigo.lng === i.lng && antigo.lat === i.lat && antigo.tempos === i.tempos)) continue;
    const a = sim.analises.get(i.id);
    partes.push(`mudou ${DEFINICAO[i.tipo].nome}${a?.efeito ? ` (${a.efeito})` : ''}`);
  }
  if (!partes.length) return 'A configuração no mapa mudou.';
  const texto = partes.join('. ');
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
};

const resumoAntes = (sim: Simulacao) => {
  const m = sim.metricas;
  if (!m || m.horas <= 0) return 'Ainda não havia amostra antes desta mudança.';
  const min = Math.round(m.horas * 60);
  return `Até esta mudança, em ${min} min simulados: ${Math.round(totalInfracoes(m))} infrações/h e ${Math.round(totalConflitos(m))} quase-acidentes/h.`;
};

export const LogComportamento: React.FC<{ sim: Simulacao }> = ({ sim }) => {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [desde, setDesde] = useState<Contagem>(ZERO);
  const [fase, setFase] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const vistos = useRef(new Set<string>());
  const ordem = useRef<string[]>([]);
  const contagem = useRef<Contagem>({ ...ZERO });
  const anteriores = useRef(sim.intervencoes);
  const pronto = useRef(false);
  const pendentes = useRef<DecisaoLog[]>([]);

  useEffect(() => {
    let ultimo = 0;
    const desligar = sim.assinar(() => {
      const motor = sim.motorRef.current;
      if (!motor) return;
      const hora = formatarHora(motor.hora());
      for (const a of motor.agentes) {
        for (const d of a.decisoes) {
          const chave = `${a.id}|${d.t}|${d.tipo}|${d.titulo}`;
          if (vistos.current.has(chave)) continue;
          vistos.current.add(chave);
          ordem.current.push(chave);
          if (ordem.current.length > 4000) {
            const velha = ordem.current.shift();
            if (velha) vistos.current.delete(velha);
          }
          contar(d, contagem.current);
          pendentes.current.push({
            tipo: 'decisao',
            id: chave,
            hora,
            agenteId: a.id,
            agente: `${NOME_TIPO[a.tipo]} #${a.id}`,
            titulo: d.titulo,
            texto: d.texto,
            infracao: Boolean(d.infracao),
            critico: Boolean(d.infracao) || d.tipo === 'conflito',
            detalhe: detalheDe(d),
          });
        }
      }
      const agora = performance.now();
      if (!pendentes.current.length || agora - ultimo < 400) return;
      ultimo = agora;
      const lote = pendentes.current.splice(0, pendentes.current.length);
      const foto = { ...contagem.current };
      setDesde(foto);
      setEntradas((prev) => [...lote, ...prev].slice(0, 300));
    });
    return desligar;
  }, [sim.assinar, sim.motorRef]);

  useEffect(() => {
    if (!pronto.current) {
      pronto.current = true;
      anteriores.current = sim.intervencoes;
      return;
    }
    const antes = anteriores.current;
    const depois = sim.intervencoes;
    anteriores.current = depois;
    const igual =
      antes.length === depois.length &&
      antes.every((i, k) => i.id === depois[k].id && i.lng === depois[k].lng && i.lat === depois[k].lat && i.tempos === depois[k].tempos);
    if (igual) return;
    contagem.current = { ...ZERO };
    setDesde({ ...ZERO });
    setFase((n) => n + 1);
    const marco: MarcoLog = {
      tipo: 'marco',
      id: `marco-${Date.now()}`,
      texto: descreverMudanca(antes, depois, sim),
      antes: resumoAntes(sim),
    };
    const atrasadas = pendentes.current.splice(0, pendentes.current.length);
    setEntradas((prev) => [marco, ...atrasadas, ...prev].slice(0, 300));
  }, [sim.intervencoes]);

  const visiveis = filtro === 'tudo' ? entradas : entradas.filter((e) => e.tipo === 'marco' || e.critico);

  return (
    <section aria-label="Log de funcionamento" className="bg-gv-card rounded-xl border border-gv-border shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-gv-border">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-gv-ink">Log de funcionamento</h2>
            <p className="text-[11px] text-gv-muted mt-0.5 max-w-xl">
              O que cada agente decidiu, e o comportamento depois de cada intervenção no mapa.
            </p>
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Filtrar o log">
            {(
              [
                ['tudo', 'Tudo'],
                ['critico', 'Infrações e conflitos'],
              ] as const
            ).map(([id, nome]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={filtro === id}
                onClick={() => setFiltro(id)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                  filtro === id ? 'bg-gv-bg text-white border-gv-border' : 'bg-gv-card text-gv-muted border-gv-border'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gv-ink mt-2">{textoDesde(desde, fase)}</p>
      </header>
      <ol className="max-h-72 overflow-y-auto divide-y divide-gv-border">
        {visiveis.length === 0 ? (
          <li className="px-4 py-3 text-[11px] text-gv-muted">O log começa quando o primeiro agente decide.</li>
        ) : (
          visiveis.map((e) =>
            e.tipo === 'marco' ? (
              <li key={e.id} className="px-4 py-2.5 bg-gv-amber/10">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gv-amber">Intervenção no mapa</p>
                <p className="text-xs font-semibold text-gv-ink mt-0.5">{e.texto}</p>
                <p className="text-[11px] text-gv-muted mt-0.5">{e.antes} O que aparece acima desta linha foi decidido depois.</p>
              </li>
            ) : (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => sim.selecionar(e.agenteId)}
                  className="w-full text-left px-4 py-2 hover:bg-gv-panel"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-gv-ink">
                      {e.hora} · {e.agente}
                    </span>
                    {e.infracao && (
                      <span className="text-[10px] font-bold uppercase text-gv-red">Infração</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gv-ink mt-0.5">{e.titulo}</p>
                  <p className="text-[11px] text-gv-muted leading-snug">{e.texto}</p>
                  {e.detalhe && <p className="text-[11px] text-gv-muted mt-0.5 leading-snug">{e.detalhe}</p>}
                </button>
              </li>
            ),
          )
        )}
      </ol>
    </section>
  );
};
