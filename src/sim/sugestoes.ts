/**
 * Assistente de sugestões para o operador.
 *
 * Lê o que a simulação mediu (eventos de quase-acidente e infração), agrupa por lugar
 * (cruzamento da Vicente Venâncio, cruzamento norte, trechos da avenida) e propõe onde
 * colocar qual intervenção, com o motivo em números. É só sugestão: o operador decide.
 */
import { paraGeo, type Vec2 } from './geometria';
import { analisar, DEFINICAO, type IntervencaoLocal, type TipoIntervencao } from './intervencoes';
import type { Evento, TipoConflito, TipoInfracao } from './motor';
import { NOME_CONFLITO, NOME_INFRACAO } from './motor';
import type { Rede } from './rede';

export interface Sugestao {
  /** Chave estável (tipo + alvo) para lembrar o que o operador ignorou. */
  chave: string;
  tipo: TipoIntervencao;
  p: Vec2;
  lng: number;
  lat: number;
  lugar: string;
  /** Parte do risco medido que acontece neste lugar (0 a 1). */
  parteRisco: number;
  /** Frases do porquê, da mais importante para a menos. */
  porque: string[];
  /** Frase de destaque no título (substitui a parte do risco). */
  destaque?: string;
  /** Outra opção para o mesmo lugar, se houver. */
  alternativa?: { tipo: TipoIntervencao; motivo: string };
}

type Sub = TipoConflito | TipoInfracao;

interface Lugar {
  id: string;
  nome: string;
  x: number;
  cruzamento?: 'vv' | 'norte';
  peso: number;
  n: Partial<Record<Sub, number>>;
  graves: number;
  somaY: number;
  total: number;
}

/** Por que cada intervenção resolve o problema (texto curto, sem prometer número). */
const COMO_AJUDA: Record<TipoIntervencao, string> = {
  fechar_canteiro: 'Fechar a abertura torna a manobra fisicamente impossível, em vez de só multar. As conversões passam a usar outra abertura: teste junto com um Retorno.',
  camera: 'A câmera reduz a manobra pelo risco da multa, sem obra e com implantação rápida. Não elimina o conflito de quem continua arriscando.',
  faixa_elevada: 'Obriga o veículo a passar devagar exatamente onde o pedestre atravessa, e deixa a travessia mais visível.',
  refugio: 'Divide a travessia em duas etapas: o pedestre só precisa achar brecha em um sentido de cada vez.',
  semaforo: 'Separa no tempo os movimentos que hoje se cruzam. Aumenta o atraso médio: confira o efeito na fila.',
  lombada: 'Reduz a velocidade no trecho, o que diminui excesso de velocidade e batidas traseiras.',
  tachoes: 'Impedem fisicamente a troca de faixa e a manobra sobre a faixa onde estão.',
  retorno: 'Oferece um caminho legal para quem hoje faz a manobra proibida.',
  agente: 'Fiscaliza e organiza no horário escolhido, sem obra; o efeito acaba quando o agente sai.',
};

const num = (v: number) => Math.round(v).toLocaleString('pt-BR');
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** O mesmo recorte de lugar do assistente: cruzamento (40 m) ou trecho de 60 m da avenida. */
export function lugarDoEvento(rede: Rede, x: number): { id: string; nome: string; x: number; cruzamento?: 'vv' | 'norte' } {
  for (const c of rede.cruzamentos) {
    if (Math.abs(x - c.x) <= 40) return { id: `cruz_${c.id}`, nome: c.id === 'vv' ? 'cruzamento da Vicente Venâncio' : 'cruzamento norte', x: c.x, cruzamento: c.id };
  }
  const vv = rede.cruzamentos.find((c) => c.id === 'vv');
  const ref = vv ? vv.x : 0;
  const bin = Math.round((x - ref) / 60);
  const d = Math.abs(bin * 60);
  return { id: `trecho_${bin}`, nome: `trecho a ${d} m ${bin < 0 ? 'a oeste' : 'a leste'} da Vicente Venâncio`, x: ref + bin * 60 };
}

/** Pontuação de cada intervenção para o que acontece num lugar. */
function pontuar(l: Lugar, existe: (t: TipoIntervencao) => boolean): { tipo: TipoIntervencao; nota: number }[] {
  const n = (s: Sub) => l.n[s] ?? 0;
  const manobras = n('conversao_proibida') + n('retorno_proibido');
  const cand: { tipo: TipoIntervencao; nota: number }[] = [];
  if (l.cruzamento) {
    cand.push({ tipo: 'fechar_canteiro', nota: manobras * 1.0 + n('cruzamento') * 1.3 });
    cand.push({ tipo: 'camera', nota: manobras * 0.8 + n('avanco_sinal') * 1.2 });
    cand.push({ tipo: 'faixa_elevada', nota: n('pedestre') * 2.2 + n('excesso_velocidade') * 0.4 });
    cand.push({ tipo: 'refugio', nota: n('pedestre') * 1.6 });
    if (!existe('semaforo')) cand.push({ tipo: 'semaforo', nota: n('cruzamento') * 0.9 + n('pedestre') * 0.9 });
  } else {
    cand.push({ tipo: 'lombada', nota: n('excesso_velocidade') * 1.0 + n('traseira') * 1.5 });
    cand.push({ tipo: 'tachoes', nota: n('traseira') * 0.8 });
  }
  return cand.filter((c) => c.nota > 0).sort((a, b) => b.nota - a.nota);
}

function principais(l: Lugar, horas: number): string {
  const itens = (Object.entries(l.n) as [Sub, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${((NOME_INFRACAO as Record<string, string>)[k] ?? (NOME_CONFLITO as Record<string, string>)[k] ?? k).toLowerCase()} (${num(v / horas)}/h)`);
  return itens.join(' e ');
}

/**
 * @param eventos o que a simulação registrou desde a última mudança no mapa
 * @param horas horas simuladas nesse período (para dar valores por hora)
 * @param atuais intervenções já no mapa (não sugere o que já está lá)
 */
export function sugerir(
  rede: Rede,
  eventos: Evento[],
  horas: number,
  atuais: IntervencaoLocal[],
  fluxo?: { desvioExterno: number; retornoLegal: number; kmDesvio: number }
): Sugestao[] {
  const jaTemR = atuais.map((i) => ({ tipo: i.tipo, a: analisar(rede, i) }));
  const sugRetorno = sugerirRetorno(rede, eventos, horas, jaTemR, fluxo);
  if (eventos.length < 25 || horas <= 0) return sugRetorno ? [sugRetorno] : [];
  const lugares = new Map<string, Lugar>();
  let pesoTotal = 0;
  for (const e of eventos) {
    const base = lugarDoEvento(rede, e.x);
    let l = lugares.get(base.id);
    if (!l) {
      l = { ...base, peso: 0, n: {}, graves: 0, somaY: 0, total: 0 };
      lugares.set(base.id, l);
    }
    const peso = e.tipo === 'conflito' ? e.peso : e.peso * 0.5;
    l.peso += peso;
    pesoTotal += peso;
    l.n[e.subtipo] = (l.n[e.subtipo] ?? 0) + 1;
    if (e.grave && e.tipo === 'conflito') l.graves++;
    l.somaY += e.y;
    l.total++;
  }
  if (pesoTotal <= 0) return [];

  const jaTem = atuais.map((i) => ({ tipo: i.tipo, a: analisar(rede, i) }));
  const sugestoes: Sugestao[] = sugRetorno ? [sugRetorno] : [];
  const ordenados = [...lugares.values()].sort((a, b) => b.peso - a.peso);

  for (const l of ordenados) {
    if (sugestoes.length >= 3) break;
    if (l.cruzamento && jaTem.some((j) => j.tipo === 'fechar_canteiro' && j.a.valida && j.a.cruzamento === l.cruzamento)) continue;
    if (l.peso / pesoTotal < 0.08) continue;
    const perto = (t: TipoIntervencao, p: Vec2) =>
      jaTem.some((j) => j.tipo === t && Math.hypot(j.a.p.x - p.x, j.a.p.y - p.y) <= Math.max(DEFINICAO[t].raio, 20));
    const existe = (t: TipoIntervencao) => jaTem.some((j) => j.tipo === t);

    const validas: { tipo: TipoIntervencao; nota: number; p: Vec2; alvo: string }[] = [];
    for (const c of pontuar(l, existe)) {
      let p: Vec2 = { x: l.x, y: l.total ? l.somaY / l.total : 0 };
      if (c.tipo === 'fechar_canteiro' || c.tipo === 'camera' || c.tipo === 'semaforo') {
        const ab = rede.aberturas.find((a) => a.cruzamento === l.cruzamento);
        p = { x: ab ? ab.xc : l.x, y: 0 };
      } else if (c.tipo === 'faixa_elevada' || c.tipo === 'refugio') {
        const tr = rede.travessias.find((t) => t.cruzamento === l.cruzamento);
        if (tr) p = { x: tr.x, y: c.tipo === 'refugio' ? 0 : p.y };
      }
      const a = analisar(rede, { id: 'sugestao', tipo: c.tipo, p });
      if (!a.valida || perto(c.tipo, a.p)) continue;
      validas.push({ ...c, p: a.p, alvo: a.alvo ?? l.id });
    }
    if (!validas.length) continue;
    const [melhor, segunda] = validas;
    const chave = `${melhor.tipo}:${melhor.alvo}`;
    if (sugestoes.some((s) => s.chave === chave)) continue;

    const parte = l.peso / pesoTotal;
    const [lng, lat] = paraGeo(rede.quadro, melhor.p);
    const porque = [
      `${pct(parte)} do risco medido acontece no ${l.nome}${l.graves ? `, com ${num(l.graves / horas)} quase-acidentes graves por hora` : ''}.`,
      `O que mais acontece ali: ${principais(l, horas)}.`,
      COMO_AJUDA[melhor.tipo],
    ];
    sugestoes.push({
      chave,
      tipo: melhor.tipo,
      p: melhor.p,
      lng,
      lat,
      lugar: l.nome,
      parteRisco: parte,
      porque,
      alternativa: segunda ? { tipo: segunda.tipo, motivo: COMO_AJUDA[segunda.tipo] } : undefined,
    });
  }
  return sugestoes;
}

/**
 * Canteiro fechado sem retorno legal: quem queria virar à esquerda sai do trecho e dá a volta
 * pelo bairro (desvio estimado, fora do mapa) ou faz retorno proibido na outra abertura.
 * Sugere um retorno em gota do lado para onde esse fluxo vai.
 */
function sugerirRetorno(
  rede: Rede,
  eventos: Evento[],
  horas: number,
  jaTem: { tipo: TipoIntervencao; a: ReturnType<typeof analisar> }[],
  fluxo?: { desvioExterno: number; retornoLegal: number; kmDesvio: number }
): Sugestao | null {
  const fechado = jaTem.find((j) => j.tipo === 'fechar_canteiro' && j.a.valida);
  if (!fechado) return null;
  if (jaTem.some((j) => j.tipo === 'retorno' && j.a.valida && !j.a.regulariza)) return null;
  const cr = fechado.a.cruzamento ?? 'vv';
  const c = rede.cruzamentos.find((k) => k.id === cr);
  if (!c) return null;
  // Quem perde a esquerda na VV vira à direita (para leste) e precisa voltar: retorno a leste.
  // Na rua norte é o contrário: retorno a oeste.
  const sentido = cr === 'vv' ? 1 : -1;
  for (const d of [90, 120, 70, 150, 180]) {
    const a = analisar(rede, { id: 'sugestao', tipo: 'retorno', p: { x: c.x + sentido * d, y: 0 } });
    if (!a.valida || a.regulariza) continue;
    const [lng, lat] = paraGeo(rede.quadro, a.p);
    const h = Math.max(horas, 1 / 60);
    const desvios = fluxo ? fluxo.desvioExterno / h : 0;
    const kmMedio = fluxo && fluxo.desvioExterno ? fluxo.kmDesvio / fluxo.desvioExterno : 1.4;
    const retProib = eventos.filter((e) => e.subtipo === 'retorno_proibido').length / h;
    const nomeCruz = cr === 'vv' ? 'da Vicente Venâncio' : 'norte';
    const porque = [
      `Com o canteiro ${nomeCruz} fechado e sem retorno legal, quem queria virar à esquerda não some: ${
        desvios >= 1 ? `${num(desvios)} veículos por hora` : 'esses veículos'
      } seguem e dão a volta pelo bairro, cerca de ${kmMedio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km a mais (uns ${Math.round((kmMedio / 30) * 60)} min). Esse desvio entra no atraso médio, mas acontece fora do mapa.`,
      retProib >= 1
        ? `Outros ${num(retProib)} por hora fazem retorno proibido na outra abertura: o problema muda de lugar.`
        : 'Sem um caminho legal curto, parte dos motoristas tende a fazer retorno proibido na outra abertura.',
      `Um retorno em gota ${Math.abs(d)} m ${sentido > 0 ? 'a leste' : 'a oeste'} do cruzamento dá um caminho legal e curto. A fila no retorno e o tempo a mais passam a aparecer no mapa e no atraso.`,
    ];
    return {
      chave: `retorno:apos_fechar_${cr}`,
      tipo: 'retorno',
      p: a.p,
      lng,
      lat,
      lugar: `canteiro a ${Math.abs(d)} m ${sentido > 0 ? 'a leste' : 'a oeste'} do cruzamento ${nomeCruz}`,
      parteRisco: 0,
      destaque: desvios >= 1 ? `${num(desvios)} veículos/h dando a volta pelo bairro` : 'Canteiro fechado sem retorno legal',
      porque,
    };
  }
  return null;
}
