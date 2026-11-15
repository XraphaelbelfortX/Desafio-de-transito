import React from 'react';
import { paraGeo } from '../../sim/geometria';
import { DEFINICAO, type AnaliseIntervencao, type Intervencao, type TipoIntervencao } from '../../sim/intervencoes';
import { NOME_INFRACAO, type Evento, type Metricas, type TipoInfracao } from '../../sim/motor';
import type { Rede, TravessiaRede } from '../../sim/rede';
import { lugarDoEvento } from '../../sim/sugestoes';

const TIPOS_INFRACAO: TipoInfracao[] = ['avanco_sinal', 'excesso_velocidade', 'conversao_proibida', 'retorno_proibido'];
const ORDEM_QUEM = ['pedestre', 'moto', 'carro', 'ônibus'];
const RE_QUEM = '(pedestre|moto|carro|ônibus) #\\d+';

export interface TrechoOrigem {
  texto: string;
  /** Nome falado no botão, quando o texto da frase traz preposição. */
  nome?: string;
  ponto?: { lng: number; lat: number };
  intervencaoId?: string;
}

export interface LinhaOrigem {
  id: 'quase' | 'infracoes' | 'atraso' | 'espera';
  rotulo: string;
  trechos: TrechoOrigem[];
}

interface FluxoRetorno {
  desvioExterno: number;
  retornoLegal: number;
  kmDesvio: number;
}

interface Entrada {
  rede: Rede;
  metricas: Metricas;
  eventos: Evento[];
  fluxo: FluxoRetorno;
  intervencoes: Intervencao[];
  analises: Map<string, AnaliseIntervencao>;
}

const num = (v: number) => Math.round(v).toLocaleString('pt-BR');

const juntar = (partes: string[]) => {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
};

const pontoEm = (rede: Rede, x: number) => {
  const [lng, lat] = paraGeo(rede.quadro, { x, y: 0 });
  return { lng, lat };
};

const contarPorLugar = (rede: Rede, eventos: Evento[], aceita: (e: Evento) => boolean) => {
  const mapa = new Map<string, { lugar: ReturnType<typeof lugarDoEvento>; n: number }>();
  for (const e of eventos) {
    if (!aceita(e)) continue;
    const lugar = lugarDoEvento(rede, e.x);
    const atual = mapa.get(lugar.id);
    if (atual) atual.n += 1;
    else mapa.set(lugar.id, { lugar, n: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
};

const paresNoLugar = (rede: Rede, eventos: Evento[], lugarId: string, horas: number) => {
  const n = new Map<string, number>();
  for (const e of eventos) {
    if (e.tipo !== 'conflito' || lugarDoEvento(rede, e.x).id !== lugarId) continue;
    const tipos = [...e.descricao.matchAll(new RegExp(RE_QUEM, 'g'))].map((achado) => achado[1]);
    if (tipos.length < 2) continue;
    const [a, b] = [tipos[0], tipos[1]].sort((u, v) => ORDEM_QUEM.indexOf(u) - ORDEM_QUEM.indexOf(v));
    const chave = `${a} × ${b}`;
    n.set(chave, (n.get(chave) ?? 0) + 1);
  }
  return [...n.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([rotulo, qtd]) => `${rotulo} (${num(qtd / horas)}/h)`);
};

interface Peca {
  id: string;
  tipo: TipoIntervencao;
  nome: string;
  cruzamento?: 'vv' | 'norte';
}

const pecasQueSeguram = (entrada: Entrada): Peca[] => {
  const achadas: Peca[] = [];
  for (const i of entrada.intervencoes) {
    const a = entrada.analises.get(i.id);
    if (!a?.valida) continue;
    if (i.tipo === 'semaforo' || i.tipo === 'lombada' || i.tipo === 'faixa_elevada') {
      achadas.push({ id: i.id, tipo: i.tipo, nome: DEFINICAO[i.tipo].nome, cruzamento: a.cruzamento });
    } else if (i.tipo === 'fechar_canteiro' && entrada.fluxo.desvioExterno > 0) {
      achadas.push({ id: i.id, tipo: i.tipo, nome: 'Fechar canteiro, com volta pelo bairro', cruzamento: a.cruzamento });
    }
  }
  const ordem: TipoIntervencao[] = ['semaforo', 'lombada', 'faixa_elevada', 'fechar_canteiro'];
  const repetido = (tipo: TipoIntervencao) => achadas.filter((p) => p.tipo === tipo).length > 1;
  return achadas
    .sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo))
    .map((p) => {
      if (!repetido(p.tipo)) return p;
      const efeito = entrada.analises.get(p.id)?.efeito;
      return efeito ? { ...p, nome: `${p.nome} (${efeito})` } : p;
    });
};

const comBotoes = (prefixo: string, pecas: Peca[]): TrechoOrigem[] => {
  const trechos: TrechoOrigem[] = [{ texto: prefixo }];
  pecas.forEach((p, i) => {
    if (i > 0) trechos.push({ texto: i === pecas.length - 1 ? ' e ' : ', ' });
    trechos.push({ texto: p.nome, nome: p.nome, intervencaoId: p.id });
  });
  trechos.push({ texto: '.' });
  return trechos;
};

const linhaQuase = (rede: Rede, eventos: Evento[], horas: number): LinhaOrigem => {
  const topo = contarPorLugar(rede, eventos, (e) => e.tipo === 'conflito')[0];
  if (!topo) return { id: 'quase', rotulo: 'Quase-acidentes', trechos: [{ texto: 'Ainda não há quase-acidente nesta amostra.' }] };
  const quem = paresNoLugar(rede, eventos, topo.lugar.id, horas);
  return {
    id: 'quase',
    rotulo: 'Quase-acidentes',
    trechos: [
      { texto: `No ${topo.lugar.nome}`, nome: topo.lugar.nome, ponto: pontoEm(rede, topo.lugar.x) },
      { texto: `, ${num(topo.n / horas)}/h${quem.length ? `. Quem se cruza: ${juntar(quem)}` : ''}.` },
    ],
  };
};

const linhaInfracoes = (rede: Rede, metricas: Metricas, eventos: Evento[]): LinhaOrigem => {
  const presentes = TIPOS_INFRACAO.filter((t) => metricas.infracoes[t] > 0);
  if (!presentes.length) return { id: 'infracoes', rotulo: 'Infrações', trechos: [{ texto: 'Nenhuma infração nesta amostra.' }] };
  const frases = presentes.map((t, i) => {
    const nome = NOME_INFRACAO[t].toLowerCase();
    const rotulo = i === 0 ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome;
    return `${rotulo} ${num(metricas.infracoes[t])}/h`;
  });
  const principal = presentes.reduce((a, b) => (metricas.infracoes[a] >= metricas.infracoes[b] ? a : b));
  const onde = contarPorLugar(rede, eventos, (e) => e.tipo === 'infracao' && e.subtipo === principal)[0];
  const trechos: TrechoOrigem[] = [{ texto: `${juntar(frases)}.` }];
  if (onde) {
    trechos.push({ texto: ` Onde mais acontece ${NOME_INFRACAO[principal].toLowerCase()}: ` });
    trechos.push({ texto: onde.lugar.nome, nome: onde.lugar.nome, ponto: pontoEm(rede, onde.lugar.x) });
    trechos.push({ texto: '.' });
  }
  return { id: 'infracoes', rotulo: 'Infrações', trechos };
};

const linhaAtraso = (entrada: Entrada): LinhaOrigem => {
  const pecas = pecasQueSeguram(entrada);
  if (!pecas.length) {
    return {
      id: 'atraso',
      rotulo: 'Atraso',
      trechos: [{ texto: 'Nenhuma peça que segura o veículo está agindo: semáforo, lombada, faixa elevada ou canteiro fechado com volta pelo bairro.' }],
    };
  }
  return { id: 'atraso', rotulo: 'Atraso', trechos: comBotoes('Quem segura o veículo: ', pecas) };
};

const travessiaDaEspera = (entrada: Entrada, pecas: Peca[]): TravessiaRede | null => {
  const porCruz = new Map<'vv' | 'norte', number>();
  for (const e of entrada.eventos) {
    if (e.tipo !== 'conflito' || e.subtipo !== 'pedestre') continue;
    const cruz = lugarDoEvento(entrada.rede, e.x).cruzamento;
    if (cruz) porCruz.set(cruz, (porCruz.get(cruz) ?? 0) + 1);
  }
  let melhor: TravessiaRede | null = null;
  let nota = 0;
  for (const t of entrada.rede.travessias) {
    const temPeca = pecas.some((p) => (p.tipo === 'semaforo' || p.tipo === 'faixa_elevada') && p.cruzamento === t.cruzamento);
    const score = (temPeca ? 1_000_000 : 0) + (porCruz.get(t.cruzamento) ?? 0);
    if (score > nota) {
      nota = score;
      melhor = t;
    }
  }
  return melhor;
};

const linhaEspera = (entrada: Entrada): LinhaOrigem => {
  const pecas = pecasQueSeguram(entrada);
  const travessia = travessiaDaEspera(entrada, pecas);
  if (!travessia) {
    return { id: 'espera', rotulo: 'Espera do pedestre', trechos: [{ texto: 'Ainda não deu para ver em qual travessia a espera se acumula.' }] };
  }
  const noLugar = pecas.filter((p) => (p.tipo === 'semaforo' || p.tipo === 'faixa_elevada') && p.cruzamento === travessia.cruzamento);
  const trechos: TrechoOrigem[] = [{ texto: travessia.nome, nome: travessia.nome, ponto: pontoEm(entrada.rede, travessia.x) }];
  if (noLugar.length) {
    trechos.push({ texto: ', com ' });
    noLugar.forEach((p, i) => {
      if (i > 0) trechos.push({ texto: i === noLugar.length - 1 ? ' e ' : ', ' });
      trechos.push({ texto: p.nome, nome: p.nome, intervencaoId: p.id });
    });
  }
  trechos.push({ texto: '.' });
  return { id: 'espera', rotulo: 'Espera do pedestre', trechos };
};

/** Origem dos quatro cartões. Só lê métricas, eventos e o fluxo de retorno, no ritmo de quem chama. */
export function explicarOrigem(entrada: Entrada): LinhaOrigem[] {
  const horas = Math.max(entrada.metricas.horas, 1 / 3600);
  return [linhaQuase(entrada.rede, entrada.eventos, horas), linhaInfracoes(entrada.rede, entrada.metricas, entrada.eventos), linhaAtraso(entrada), linhaEspera(entrada)];
}

export const BlocoOrigem: React.FC<{
  linhas: LinhaOrigem[];
  onPonto: (lng: number, lat: number) => void;
  onIntervencao: (id: string) => void;
}> = ({ linhas, onPonto, onIntervencao }) => (
  <section aria-label="De onde vêm" className="mt-2 rounded-xl border border-gv-border bg-gv-card px-3 py-2.5">
    <h3 className="text-xs font-extrabold text-gv-ink mb-1.5">De onde vêm</h3>
    <ul className="space-y-1.5">
      {linhas.map((linha) => (
        <li key={linha.id} className="text-[11px] text-gv-ink leading-snug">
          <span className="font-bold">{linha.rotulo}. </span>
          {linha.trechos.map((t, i) =>
            t.ponto || t.intervencaoId ? (
              <button
                key={i}
                type="button"
                className="font-semibold text-gv-cyan underline decoration-gv-cyan/40 underline-offset-2 text-left hover:decoration-gv-cyan"
                aria-label={`Centralizar ${t.nome ?? t.texto} no mapa`}
                onClick={() => (t.intervencaoId ? onIntervencao(t.intervencaoId) : t.ponto && onPonto(t.ponto.lng, t.ponto.lat))}
              >
                {t.texto}
              </button>
            ) : (
              <span key={i}>{t.texto}</span>
            ),
          )}
        </li>
      ))}
    </ul>
  </section>
);
