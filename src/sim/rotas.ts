import { curva, intersecoes, kmh, LESTE, OESTE, Polilinha, type Vec2 } from './geometria';
import type { Rede } from './rede';
import { type DesejoId, DESVIO_EXTERNO_CONVERSAO, DESVIO_EXTERNO_RETORNO } from './demanda';
import { analisar, type AnaliseIntervencao, type IntervencaoLocal, type TemposSemaforo, TEMPOS_PADRAO } from './intervencoes';

/**
 * Monta, para uma configuração de intervenções, os elementos (faixas, conectores, travessias),
 * as rotas possíveis de cada desejo de viagem (legal, infração ou desvio externo) e as zonas
 * de conflito entre trajetórias.
 */

export type TipoElemento = 'faixa_avenida' | 'faixa_transversal' | 'conector' | 'mudanca_faixa' | 'travessia';

export interface Elemento {
  id: string;
  tipo: TipoElemento;
  linha: Polilinha;
  velMax: number;
  sentido?: 'oeste' | 'leste';
  indice?: number;
  /** Movimento da rede ou retorno novo que o conector representa. */
  movimentoId?: string;
  nome?: string;
  ehRetorno?: boolean;
}

export interface Peca {
  elem: Elemento;
  sElem0: number;
  sElem1: number;
  sRota0: number;
}

export interface CruzamentoFluxo {
  elemId: string;
  sElem: number;
  sRota: number;
  merge: boolean;
}

export interface PontoCedencia {
  sRota: number;
  tipo: 'pare' | 'conversao' | 'retorno';
  fluxos: CruzamentoFluxo[];
}

export interface LinhaRetencao {
  sRota: number;
  semaforoId: string;
  grupo: 'avenida' | 'transversal';
}

export interface LimiteVelocidade {
  s0: number;
  s1: number;
  v: number;
  motivo: string;
}

export interface PontoFiscalizacao {
  sRota: number;
  tipo: 'camera' | 'agente';
  id: string;
}

export interface PontoTravessia {
  sRota: number;
  travessiaId: string;
  /** Posição na travessia (sentido sul -> norte) onde a rota a cruza. */
  sPed: number;
}

export type TipoOpcao = 'legal' | 'infracao' | 'desvio_externo';

export interface Rota {
  id: string;
  desejo: DesejoId | 'pedestre';
  opcao: TipoOpcao;
  pecas: Peca[];
  linha: Polilinha;
  comprimento: number;
  desvioExterno: number;
  infracao?: 'conversao_proibida' | 'retorno_proibido';
  /** Onde está a manobra proibida (para o mapa de calor e a fiscalização percebida). */
  manobra?: { sRota: number; ponto: Vec2; nome: string };
  descricao: string;
  cedencias: PontoCedencia[];
  retencoes: LinhaRetencao[];
  limites: LimiteVelocidade[];
  fiscalizacoes: PontoFiscalizacao[];
  travessias: PontoTravessia[];
  tempoEstimado: number;
  tempoLivre: number;
}

export interface Semaforo {
  id: string;
  cruzamento: 'vv' | 'norte';
  tempos: TemposSemaforo;
  /** Instante em que o ciclo começou (s de simulação). */
  fase0: number;
}

export interface ZonaConflito {
  id: number;
  x: number;
  y: number;
  a: string;
  sa: number;
  b: string;
  sb: number;
}

export interface ConfigDerivada {
  analises: Map<string, AnaliseIntervencao>;
  intervencoes: IntervencaoLocal[];
  aberturasFechadas: Set<string>;
  retornosLegalizados: Set<string>;
  semaforos: Semaforo[];
  cameras: { id: string; p: Vec2; lado: 'oeste' | 'leste' | 'ambos' }[];
  agentes: { id: string; p: Vec2 }[];
  tachoes: { id: string; p: Vec2 }[];
  faixasElevadas: Set<string>;
  refugios: Set<string>;
}

export interface Malha {
  elementos: Map<string, Elemento>;
  /** Opções de rota por desejo. */
  opcoes: Map<DesejoId, Rota[]>;
  /** Rotas de quem segue reto, por faixa de entrada. */
  retas: { oeste: Rota[]; leste: Rota[] };
  pedestres: Map<string, { sn: Rota; ns: Rota }>;
  zonas: ZonaConflito[];
  zonasPorElemento: Map<string, { zona: number; s: number }[]>;
  config: ConfigDerivada;
}

// ------------------------------------------------------------ CONFIGURAÇÃO
export function derivarConfig(rede: Rede, intervencoes: IntervencaoLocal[]): ConfigDerivada {
  const cfg: ConfigDerivada = {
    analises: new Map(),
    intervencoes,
    aberturasFechadas: new Set(),
    retornosLegalizados: new Set(),
    semaforos: [],
    cameras: [],
    agentes: [],
    tachoes: [],
    faixasElevadas: new Set(),
    refugios: new Set(),
  };
  for (const int of intervencoes) {
    const a = analisar(rede, int);
    cfg.analises.set(int.id, a);
    if (!a.valida) continue;
    switch (int.tipo) {
      case 'fechar_canteiro':
        if (a.alvo) cfg.aberturasFechadas.add(a.alvo);
        break;
      case 'retorno':
        if (a.regulariza && a.alvo) cfg.retornosLegalizados.add(a.alvo);
        break;
      case 'semaforo':
        if (a.cruzamento && !cfg.semaforos.some((s) => s.cruzamento === a.cruzamento)) {
          cfg.semaforos.push({ id: int.id, cruzamento: a.cruzamento, tempos: { ...TEMPOS_PADRAO, ...int.tempos }, fase0: 0 });
        }
        break;
      case 'camera':
        cfg.cameras.push({ id: int.id, p: a.p, lado: a.lado ?? 'ambos' });
        break;
      case 'agente':
        cfg.agentes.push({ id: int.id, p: a.p });
        break;
      case 'tachoes':
        cfg.tachoes.push({ id: int.id, p: a.p });
        break;
      case 'faixa_elevada':
        if (a.alvo) cfg.faixasElevadas.add(a.alvo);
        break;
      case 'refugio':
        if (a.alvo) cfg.refugios.add(a.alvo);
        break;
      case 'lombada':
        break;
    }
  }
  // um canteiro fechado anula o retorno regularizado na mesma abertura
  for (const ab of cfg.aberturasFechadas) cfg.retornosLegalizados.delete(ab);
  return cfg;
}

// ------------------------------------------------------------ MONTAGEM
interface ConectorRetorno {
  elem: Elemento;
  dir: 'OL' | 'LO';
  xIni: number;
  xFim: number;
  legal: boolean;
  nome: string;
  aberturaId?: string;
}

const VEL_CONVERSAO = kmh(25);
const VEL_RETORNO = kmh(15);

export function montarMalha(rede: Rede, cfg: ConfigDerivada): Malha {
  const elementos = new Map<string, Elemento>();
  const reg = (e: Elemento) => {
    elementos.set(e.id, e);
    return e;
  };

  // faixas da avenida
  for (const sentido of ['oeste', 'leste'] as const) {
    for (let i = 0; i < 3; i++) {
      const fx = rede.faixas[`africanos_${sentido}_${i}`];
      reg({
        id: `${sentido === 'oeste' ? 'O' : 'L'}${i}`,
        tipo: 'faixa_avenida',
        linha: fx.linha,
        velMax: kmh(fx.velMaxKmh),
        sentido,
        indice: i,
        nome: fx.nome,
      });
    }
  }
  for (const id of ['vv_entrada', 'vv_saida_esq', 'vv_saida_dir', 'norte_chegada', 'norte_saida']) {
    const fx = rede.faixas[id];
    if (fx) reg({ id, tipo: 'faixa_transversal', linha: fx.linha, velMax: kmh(fx.velMaxKmh), nome: fx.nome });
  }
  const aberturaDoMov = (fechadoPor: string | null) =>
    fechadoPor ? rede.aberturas.find((a) => a.intervencaoFecha === fechadoPor) : undefined;
  for (const m of Object.values(rede.movimentos)) {
    const ehRet = m.id.startsWith('retorno');
    reg({
      id: `M:${m.id}`,
      tipo: 'conector',
      linha: m.linha,
      velMax: ehRet ? VEL_RETORNO : VEL_CONVERSAO,
      movimentoId: m.id,
      nome: m.nome,
      ehRetorno: ehRet,
    });
  }
  // travessias de pedestres (sul -> norte e norte -> sul)
  for (const t of rede.travessias) {
    const a = { x: t.x, y: -rede.borda - 2 };
    const b = { x: t.x, y: rede.borda + 2 };
    reg({ id: `P:${t.id}:SN`, tipo: 'travessia', linha: new Polilinha([a, b]), velMax: 1.3, nome: t.nome });
    reg({ id: `P:${t.id}:NS`, tipo: 'travessia', linha: new Polilinha([b, a]), velMax: 1.3, nome: t.nome });
  }

  const E = (id: string) => {
    const e = elementos.get(id);
    if (!e) throw new Error(`elemento ${id} inexistente`);
    return e;
  };
  const yFaixa = (sentido: 'oeste' | 'leste', i: number) => (sentido === 'oeste' ? rede.yOeste[i] : rede.yLeste[i]);
  /** s ao longo de uma faixa da avenida para um x. */
  const sAv = (elemId: string, x: number) => (elemId.startsWith('O') ? rede.xMax - x : x - rede.xMin);

  const movAberto = (movId: string) => {
    const m = rede.movimentos[movId];
    if (!m) return false;
    const ab = aberturaDoMov(m.fechadoPor);
    return !ab || !cfg.aberturasFechadas.has(ab.id);
  };

  // conectores de retorno: os da rede (proibidos, salvo regularização) e os novos
  const retornos: ConectorRetorno[] = [];
  for (const m of Object.values(rede.movimentos)) {
    if (!m.id.startsWith('retorno') || !movAberto(m.id)) continue;
    const ab = aberturaDoMov(m.fechadoPor);
    const ini = m.linha.pts[0];
    const fim = m.linha.pts[m.linha.pts.length - 1];
    retornos.push({
      elem: E(`M:${m.id}`),
      dir: m.de.includes('leste') ? 'LO' : 'OL',
      xIni: ini.x,
      xFim: fim.x,
      legal: m.permitido || (!!ab && cfg.retornosLegalizados.has(ab.id)),
      nome: m.nome,
      aberturaId: ab?.id,
    });
  }
  for (const int of cfg.intervencoes) {
    const a = cfg.analises.get(int.id);
    if (int.tipo !== 'retorno' || !a?.valida || a.regulariza) continue;
    const xr = a.p.x;
    const lo = new Polilinha(
      curva({ x: xr - 2, y: rede.yLeste[0] }, LESTE, { x: xr - 2, y: rede.yOeste[0] }, OESTE)
    );
    const ol = new Polilinha(
      curva({ x: xr + 2, y: rede.yOeste[0] }, OESTE, { x: xr + 2, y: rede.yLeste[0] }, LESTE)
    );
    const nome = `Retorno novo (${a.efeito.replace('Novo retorno ', '').replace(/\.$/, '')})`;
    retornos.push({
      elem: reg({ id: `R:${int.id}:LO`, tipo: 'conector', linha: lo, velMax: VEL_RETORNO, nome, ehRetorno: true }),
      dir: 'LO',
      xIni: xr - 2,
      xFim: xr - 2,
      legal: true,
      nome,
    });
    retornos.push({
      elem: reg({ id: `R:${int.id}:OL`, tipo: 'conector', linha: ol, velMax: VEL_RETORNO, nome, ehRetorno: true }),
      dir: 'OL',
      xIni: xr + 2,
      xFim: xr + 2,
      legal: true,
      nome,
    });
  }

  /** Conector de mudança de faixa (30 m), criado sob demanda. */
  const mudanca = (sentido: 'oeste' | 'leste', de: number, para: number, x0: number) => {
    const id = `X:${sentido}:${de}:${para}:${Math.round(x0)}`;
    const ex = elementos.get(id);
    if (ex) return ex;
    const dir = sentido === 'oeste' ? OESTE : LESTE;
    const x1 = x0 + dir.x * 30;
    return reg({
      id,
      tipo: 'mudanca_faixa',
      linha: new Polilinha(curva({ x: x0, y: yFaixa(sentido, de) }, dir, { x: x1, y: yFaixa(sentido, para) }, dir, 10)),
      velMax: kmh(50),
      sentido,
    });
  };

  // ----------------------------------------------------- construção das rotas
  let contador = 0;
  const novaRota = (
    desejo: DesejoId | 'pedestre',
    opcao: TipoOpcao,
    trechos: [Elemento, number, number][],
    extra: Partial<Rota> & { descricao: string }
  ): Rota => {
    const pecas: Peca[] = [];
    const pts: Vec2[] = [];
    let s = 0;
    for (const [elem, s0, s1] of trechos) {
      const a = Math.max(0, Math.min(elem.linha.comprimento, s0));
      const b = Math.max(0, Math.min(elem.linha.comprimento, s1));
      if (b - a < 0.05) continue;
      pecas.push({ elem, sElem0: a, sElem1: b, sRota0: s });
      pts.push(...elem.linha.trecho(a, b));
      s += b - a;
    }
    const linha = new Polilinha(pts);
    const rota: Rota = {
      id: `r${++contador}`,
      desejo,
      opcao,
      pecas,
      linha,
      comprimento: s,
      desvioExterno: 0,
      cedencias: [],
      retencoes: [],
      limites: [],
      fiscalizacoes: [],
      travessias: [],
      tempoEstimado: 0,
      tempoLivre: 0,
      ...extra,
    };
    return rota;
  };

  /** Trechos de uma rota baseada num movimento da rede: chegada + movimento + saída. */
  const trechosMov = (movId: string, ate?: number): [Elemento, number, number][] => {
    const m = rede.movimentos[movId];
    const de = idFaixa(m.de);
    const para = idFaixa(m.para);
    const eDe = E(de);
    const ePara = E(para);
    const sIni = eDe.linha.projetar(m.linha.pts[0]).s;
    const sFim = ePara.linha.projetar(m.linha.pts[m.linha.pts.length - 1]).s;
    return [
      [eDe, 0, sIni],
      [E(`M:${movId}`), 0, m.linha.comprimento],
      [ePara, sFim, ate ?? ePara.linha.comprimento],
    ];
  };

  const opcoes = new Map<DesejoId, Rota[]>();
  const add = (d: DesejoId, r: Rota | null) => {
    if (!r) return;
    const lista = opcoes.get(d) ?? [];
    lista.push(r);
    opcoes.set(d, lista);
  };

  const reta = (sentido: 'oeste' | 'leste', i: number, desejo: DesejoId, opcao: TipoOpcao, desvio: number, descricao: string) => {
    const e = E(`${sentido === 'oeste' ? 'O' : 'L'}${i}`);
    return novaRota(desejo, opcao, [[e, 0, e.linha.comprimento]], { desvioExterno: desvio, descricao });
  };

  const fimMov = (movId: string) => {
    const pts = rede.movimentos[movId].linha.pts;
    return pts[pts.length - 1];
  };
  const iniMov = (movId: string) => rede.movimentos[movId].linha.pts[0];

  /**
   * Rota com retorno: [faixa de origem até o retorno] + retorno + [faixa de destino] e,
   * se preciso, mudança de faixa e um movimento final (conversão à direita).
   */
  const rotaComRetorno = (
    desejo: DesejoId,
    ret: ConectorRetorno,
    prefixo: [Elemento, number, number][],
    origemLane: string,
    final: { movId: string; faixaDestino: number } | null,
    opcao: TipoOpcao,
    descricao: string
  ): Rota | null => {
    const sentidoOrig = origemLane.startsWith('O') ? 'oeste' : 'leste';
    const sentidoDest = sentidoOrig === 'oeste' ? 'leste' : 'oeste';
    const laneDest0 = sentidoDest === 'oeste' ? 'O0' : 'L0';
    const eOrig = E(origemLane);
    const sInicio = prefixo.length ? sAv(origemLane, prefixoX(prefixo)) : 0;
    const sChegada = sAv(origemLane, ret.xIni);
    if (sChegada < sInicio + 1) return null;
    const trechos: [Elemento, number, number][] = [...prefixo, [eOrig, sInicio, sChegada], [ret.elem, 0, ret.elem.linha.comprimento]];
    const eDest0 = E(laneDest0);
    const sSaida = sAv(laneDest0, ret.xFim);
    if (!final) {
      trechos.push([eDest0, sSaida, eDest0.linha.comprimento]);
    } else {
      const dirx = sentidoDest === 'oeste' ? -1 : 1;
      const xMud = ret.xFim + dirx * 8;
      const xPos = xMud + dirx * 30;
      const xMov = iniMov(final.movId).x;
      // a mudança de faixa precisa terminar antes do início da conversão
      if ((xMov - xPos) * dirx < 5) return null;
      const eDestF = E(`${sentidoDest === 'oeste' ? 'O' : 'L'}${final.faixaDestino}`);
      const t = trechosMov(final.movId);
      trechos.push([eDest0, sSaida, sAv(laneDest0, xMud)]);
      trechos.push([mudanca(sentidoDest, 0, final.faixaDestino, xMud), 0, 1e9]);
      trechos.push([eDestF, sAv(eDestF.id, xPos), t[0][2]]);
      trechos.push(t[1], t[2]);
    }
    if (trechos.some(([, a, b]) => b < a - 0.05)) return null;
    return novaRota(desejo, opcao, trechos, {
      descricao,
      infracao: opcao === 'infracao' ? 'retorno_proibido' : undefined,
      manobra:
        opcao === 'infracao'
          ? { sRota: 0, ponto: ret.elem.linha.ponto(ret.elem.linha.comprimento / 2), nome: ret.nome }
          : undefined,
    });
  };
  /** x onde termina o prefixo (último ponto da última peça). */
  const prefixoX = (prefixo: [Elemento, number, number][]) => {
    const [e, , s1] = prefixo[prefixo.length - 1];
    return e.linha.ponto(s1).x;
  };

  const melhores = (lista: (Rota | null)[]) =>
    lista.filter((r): r is Rota => !!r).sort((a, b) => a.comprimento - b.comprimento);

  const rotaMov = (desejo: DesejoId, movId: string, opcao: TipoOpcao, descricao: string) => {
    const m = rede.movimentos[movId];
    const r = novaRota(desejo, opcao, trechosMov(movId), {
      descricao,
      infracao: opcao === 'infracao' ? (m.id.startsWith('retorno') ? 'retorno_proibido' : 'conversao_proibida') : undefined,
    });
    if (opcao === 'infracao') r.manobra = { sRota: 0, ponto: m.linha.ponto(m.linha.comprimento / 2), nome: m.nome };
    return r;
  };

  // reto
  const retas = {
    oeste: [0, 1, 2].map((i) => reta('oeste', i, 'oeste_reto', 'legal', 0, 'Segue reto pela Africanos (sentido oeste).')),
    leste: [0, 1, 2].map((i) => reta('leste', i, 'leste_reto', 'legal', 0, 'Segue reto pela Africanos (sentido leste).')),
  };

  // VV -> leste / leste -> VV / norte -> oeste / oeste -> norte (sempre legais)
  add('vv_para_leste', rotaMov('vv_para_leste', 'vv_dir_para_leste', 'legal', 'Conversão à direita da Vicente Venâncio.'));
  add('leste_para_vv', rotaMov('leste_para_vv', 'leste_para_vv', 'legal', 'Conversão à direita para a Vicente Venâncio.'));
  add('norte_para_oeste', rotaMov('norte_para_oeste', 'norte_dir_para_oeste', 'legal', 'Conversão à direita da rua norte.'));
  add('oeste_para_norte', rotaMov('oeste_para_norte', 'oeste_para_norte', 'legal', 'Conversão à direita para a rua norte.'));

  // VV -> oeste
  if (movAberto('vv_esq_para_oeste')) {
    add('vv_para_oeste', rotaMov('vv_para_oeste', 'vv_esq_para_oeste', 'legal', 'Conversão à esquerda pela abertura da VV, cruzando a pista sul.'));
  } else {
    const fim = fimMov('vv_dir_para_leste');
    const candidatos = retornos
      .filter((r) => r.dir === 'LO' && r.legal && r.xIni > fim.x + 45)
      .map((r) => {
        const t = trechosMov('vv_dir_para_leste');
        const xMud = fim.x + 8;
        const trechos: [Elemento, number, number][] = [
          t[0],
          t[1],
          [E('L2'), t[2][1], sAv('L2', xMud)],
          [mudanca('leste', 2, 0, xMud), 0, 1e9],
        ];
        return rotaComRetorno('vv_para_oeste', r, trechos, 'L0', null, 'legal', `Direita na VV e retorno legal (${r.nome}).`);
      });
    const legal = melhores(candidatos)[0];
    if (legal) add('vv_para_oeste', legal);
    else {
      add(
        'vv_para_oeste',
        novaRota('vv_para_oeste', 'desvio_externo', trechosMov('vv_dir_para_leste'), {
          desvioExterno: DESVIO_EXTERNO_RETORNO,
          descricao: 'Direita na VV e desvio pelo bairro até um retorno (canteiro fechado).',
        })
      );
    }
  }

  // norte -> leste
  if (movAberto('norte_esq_para_leste')) {
    add('norte_para_leste', rotaMov('norte_para_leste', 'norte_esq_para_leste', 'legal', 'Conversão à esquerda pela abertura norte, cruzando a pista norte.'));
  } else {
    const fim = fimMov('norte_dir_para_oeste');
    const candidatos = retornos
      .filter((r) => r.dir === 'OL' && r.legal && r.xIni < fim.x - 45)
      .map((r) => {
        const t = trechosMov('norte_dir_para_oeste');
        const xMud = fim.x - 8;
        const trechos: [Elemento, number, number][] = [
          t[0],
          t[1],
          [E('O2'), t[2][1], sAv('O2', xMud)],
          [mudanca('oeste', 2, 0, xMud), 0, 1e9],
        ];
        return rotaComRetorno('norte_para_leste', r, trechos, 'O0', null, 'legal', `Direita na rua norte e retorno legal (${r.nome}).`);
      });
    const legal = melhores(candidatos)[0];
    if (legal) add('norte_para_leste', legal);
    else {
      add(
        'norte_para_leste',
        novaRota('norte_para_leste', 'desvio_externo', trechosMov('norte_dir_para_oeste'), {
          desvioExterno: DESVIO_EXTERNO_RETORNO,
          descricao: 'Direita na rua norte e desvio pelo bairro até um retorno (canteiro fechado).',
        })
      );
    }
  }

  // oeste -> VV: conversão proibida, retorno + direita, ou desvio externo
  {
    const lista: Rota[] = [];
    if (movAberto('oeste_para_vv')) lista.push(rotaMov('oeste_para_vv', 'oeste_para_vv', 'infracao', 'Conversão proibida à esquerda pela abertura da VV.'));
    for (const r of retornos.filter((k) => k.dir === 'OL' && k.xIni < 0)) {
      const rota = rotaComRetorno(
        'oeste_para_vv',
        r,
        [],
        'O0',
        { movId: 'leste_para_vv', faixaDestino: 2 },
        r.legal ? 'legal' : 'infracao',
        r.legal ? `Retorno legal (${r.nome}) e direita na VV.` : `Retorno proibido (${r.nome}) e direita na VV.`
      );
      if (rota) lista.push(rota);
    }
    lista.push(reta('oeste', 0, 'oeste_para_vv', 'desvio_externo', DESVIO_EXTERNO_CONVERSAO, 'Segue reto e dá a volta pelo bairro (rota legal).'));
    for (const r of lista) add('oeste_para_vv', r);
  }

  // leste -> norte
  {
    const lista: Rota[] = [];
    if (movAberto('leste_para_norte')) lista.push(rotaMov('leste_para_norte', 'leste_para_norte', 'infracao', 'Conversão proibida à esquerda pela abertura norte.'));
    for (const r of retornos.filter((k) => k.dir === 'LO' && k.xIni > -140)) {
      const rota = rotaComRetorno(
        'leste_para_norte',
        r,
        [],
        'L0',
        { movId: 'oeste_para_norte', faixaDestino: 2 },
        r.legal ? 'legal' : 'infracao',
        r.legal ? `Retorno legal (${r.nome}) e direita na rua norte.` : `Retorno proibido (${r.nome}) e direita na rua norte.`
      );
      if (rota) lista.push(rota);
    }
    lista.push(reta('leste', 0, 'leste_para_norte', 'desvio_externo', DESVIO_EXTERNO_CONVERSAO, 'Segue reto e dá a volta pelo bairro (rota legal).'));
    for (const r of lista) add('leste_para_norte', r);
  }

  // retornos puros
  for (const [desejo, dir, origem] of [
    ['retorno_leste_oeste', 'LO', 'L0'],
    ['retorno_oeste_leste', 'OL', 'O0'],
  ] as const) {
    for (const r of retornos.filter((k) => k.dir === dir)) {
      const rota = rotaComRetorno(desejo, r, [], origem, null, r.legal ? 'legal' : 'infracao', r.legal ? `Retorno legal (${r.nome}).` : `Retorno proibido (${r.nome}).`);
      if (rota) add(desejo, rota);
    }
    add(
      desejo,
      reta(origem === 'L0' ? 'leste' : 'oeste', 0, desejo, 'desvio_externo', DESVIO_EXTERNO_RETORNO, 'Segue reto até um retorno legal fora do trecho.')
    );
  }

  // pedestres
  const pedestres = new Map<string, { sn: Rota; ns: Rota }>();
  for (const t of rede.travessias) {
    const sn = E(`P:${t.id}:SN`);
    const ns = E(`P:${t.id}:NS`);
    pedestres.set(t.id, {
      sn: novaRota('pedestre', 'legal', [[sn, 0, sn.linha.comprimento]], { descricao: `Atravessa a Africanos ${t.cruzamento === 'vv' ? 'junto à Vicente Venâncio' : 'junto à rua norte'}, de sul para norte.` }),
      ns: novaRota('pedestre', 'legal', [[ns, 0, ns.linha.comprimento]], { descricao: `Atravessa a Africanos ${t.cruzamento === 'vv' ? 'junto à Vicente Venâncio' : 'junto à rua norte'}, de norte para sul.` }),
    });
  }

  // ----------------------------------------------------- anotações das rotas
  const todas: Rota[] = [...retas.oeste, ...retas.leste];
  for (const l of opcoes.values()) todas.push(...l);
  for (const r of todas) anotar(rede, cfg, r, elementos);

  // ----------------------------------------------------- zonas de conflito
  const usados = new Set<string>();
  for (const r of todas) for (const p of r.pecas) usados.add(p.elem.id);
  for (const t of rede.travessias) {
    usados.add(`P:${t.id}:SN`);
    usados.add(`P:${t.id}:NS`);
  }
  const lista = [...usados].map((id) => elementos.get(id)!).filter((e) => e.tipo !== 'mudanca_faixa');
  const zonas: ZonaConflito[] = [];
  const zonasPorElemento = new Map<string, { zona: number; s: number }[]>();
  const indexar = (elemId: string, zona: number, s: number) => {
    const l = zonasPorElemento.get(elemId) ?? [];
    l.push({ zona, s });
    zonasPorElemento.set(elemId, l);
  };
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const A = lista[i];
      const B = lista[j];
      if (A.tipo === 'faixa_avenida' && B.tipo === 'faixa_avenida') continue;
      if (A.tipo === 'travessia' && B.tipo === 'travessia') continue;
      for (const x of intersecoes(A.linha, B.linha)) {
        if (x.angulo < 25) continue;
        // ignora o ponto de partida/chegada compartilhado entre faixa e conector
        if ((x.sA < 0.5 || x.sA > A.linha.comprimento - 0.5) && (x.sB < 0.5 || x.sB > B.linha.comprimento - 0.5)) continue;
        const id = zonas.length;
        zonas.push({ id, x: x.x, y: x.y, a: A.id, sa: x.sA, b: B.id, sb: x.sB });
        indexar(A.id, id, x.sA);
        indexar(B.id, id, x.sB);
      }
    }
  }
  for (const l of zonasPorElemento.values()) l.sort((a, b) => a.s - b.s);

  return { elementos, opcoes, retas, pedestres, zonas, zonasPorElemento, config: cfg };

  function idFaixa(idRede: string) {
    const m = /^africanos_(oeste|leste)_(\d)$/.exec(idRede);
    if (m) return `${m[1] === 'oeste' ? 'O' : 'L'}${m[2]}`;
    return idRede;
  }
}

/** Calcula cedências, retenções de semáforo, limites de velocidade, fiscalização e travessias. */
function anotar(rede: Rede, cfg: ConfigDerivada, r: Rota, elementos: Map<string, Elemento>) {
  const avenida = [...elementos.values()].filter((e) => e.tipo === 'faixa_avenida');

  // cedência: conectores que cruzam faixas da avenida ou entram nelas
  r.pecas.forEach((p, k) => {
    if (p.elem.tipo !== 'conector') return;
    const anterior = r.pecas[k - 1]?.elem;
    const proxima = r.pecas[k + 1]?.elem;
    const fluxos: CruzamentoFluxo[] = [];
    for (const f of avenida) {
      if (f.id === anterior?.id || f.id === proxima?.id) continue;
      for (const x of intersecoes(p.elem.linha, f.linha)) {
        if (x.angulo < 25 || x.sA < p.sElem0 || x.sA > p.sElem1) continue;
        fluxos.push({ elemId: f.id, sElem: x.sB, sRota: p.sRota0 + (x.sA - p.sElem0), merge: false });
      }
    }
    if (proxima && proxima.tipo === 'faixa_avenida') {
      const pp = r.pecas[k + 1];
      fluxos.push({ elemId: proxima.id, sElem: pp.sElem0, sRota: pp.sRota0, merge: true });
    }
    if (fluxos.length) {
      // quem vira a partir da avenida espera dentro da abertura do canteiro, fora da faixa
      let sEspera = Math.max(0, p.sRota0 - 0.5);
      if (anterior?.tipo === 'faixa_avenida') {
        for (let s = p.sElem0; s <= p.sElem1; s += 0.5) {
          if (Math.abs(p.elem.linha.ponto(s).y) <= rede.meioCanteiro - 0.3) {
            sEspera = p.sRota0 + (s - p.sElem0);
            break;
          }
        }
      }
      // fluxos antes do ponto de espera não contam (já foram cruzados)
      for (let i = fluxos.length - 1; i >= 0; i--) if (!fluxos[i].merge && fluxos[i].sRota < sEspera) fluxos.splice(i, 1);
      r.cedencias.push({
        sRota: sEspera,
        tipo: anterior?.tipo === 'faixa_transversal' ? 'pare' : p.elem.ehRetorno ? 'retorno' : 'conversao',
        fluxos,
      });
    }
  });

  // retenção nos semáforos
  for (const sem of cfg.semaforos) {
    const ab = rede.aberturas.find((a) => a.cruzamento === sem.cruzamento)!;
    const trav = rede.travessias.find((t) => t.cruzamento === sem.cruzamento);
    const xLeste = Math.min(ab.x0 - 6, trav && trav.x < ab.x0 ? trav.x - 4 : Infinity);
    const xOeste = Math.max(ab.x1 + 6, trav && trav.x > ab.x1 ? trav.x + 4 : -Infinity);
    for (const p of r.pecas) {
      const e = p.elem;
      if (e.tipo === 'faixa_avenida') {
        const x = e.sentido === 'leste' ? xLeste : xOeste;
        const s = e.sentido === 'leste' ? x - rede.xMin : rede.xMax - x;
        if (s > p.sElem0 + 0.5 && s < p.sElem1 - 0.5) {
          r.retencoes.push({ sRota: p.sRota0 + (s - p.sElem0), semaforoId: sem.id, grupo: 'avenida' });
        }
      } else if (e.tipo === 'faixa_transversal') {
        const ehAproximacao =
          (sem.cruzamento === 'vv' && (e.id === 'vv_saida_esq' || e.id === 'vv_saida_dir')) ||
          (sem.cruzamento === 'norte' && e.id === 'norte_chegada');
        if (ehAproximacao && Math.abs(p.sElem1 - e.linha.comprimento) < 0.5) {
          r.retencoes.push({ sRota: p.sRota0 + (p.sElem1 - p.sElem0) - 1, semaforoId: sem.id, grupo: 'transversal' });
        }
      }
    }
  }

  // limites de velocidade pela geometria e pelas intervenções físicas
  for (const p of r.pecas) {
    const e = p.elem;
    const len = p.sElem1 - p.sElem0;
    if (e.tipo === 'conector') r.limites.push({ s0: p.sRota0, s1: p.sRota0 + len, v: e.velMax, motivo: e.ehRetorno ? 'retorno' : 'curva da conversão' });
    if (e.tipo === 'faixa_transversal') r.limites.push({ s0: p.sRota0, s1: p.sRota0 + len, v: e.velMax, motivo: 'limite da rua (40 km/h)' });
    if (e.tipo !== 'faixa_avenida') continue;
    const sDeX = (x: number) => (e.sentido === 'leste' ? x - rede.xMin : rede.xMax - x);
    const dentro = (s: number) => s >= p.sElem0 - 10 && s <= p.sElem1 + 10;
    const yLane = e.linha.pts[0].y;
    for (const int of cfg.intervencoes) {
      const a = cfg.analises.get(int.id);
      if (!a?.valida) continue;
      if (int.tipo === 'lombada' && a.lado === e.sentido) {
        const s = sDeX(a.p.x);
        if (dentro(s)) r.limites.push({ s0: p.sRota0 + s - p.sElem0 - 6, s1: p.sRota0 + s - p.sElem0 + 6, v: kmh(25), motivo: 'lombada' });
      }
      if (int.tipo === 'faixa_elevada') {
        const s = sDeX(a.p.x);
        if (dentro(s)) r.limites.push({ s0: p.sRota0 + s - p.sElem0 - 7, s1: p.sRota0 + s - p.sElem0 + 7, v: kmh(25), motivo: 'faixa elevada' });
      }
      if (int.tipo === 'tachoes' && Math.abs(a.p.y - yLane) < 4) {
        const s = sDeX(a.p.x);
        if (dentro(s)) r.limites.push({ s0: p.sRota0 + s - p.sElem0 - 8, s1: p.sRota0 + s - p.sElem0 + 8, v: kmh(40), motivo: 'tachões na faixa' });
      }
    }
  }

  // fiscalização ao longo da rota (ponto mais próximo de cada câmera/agente no raio)
  const lado = (s: number): 'oeste' | 'leste' | null => {
    for (const p of r.pecas) {
      if (s >= p.sRota0 && s <= p.sRota0 + (p.sElem1 - p.sElem0)) return p.elem.sentido ?? null;
    }
    return null;
  };
  const pontos = [
    ...cfg.cameras.map((c) => ({ id: c.id, p: c.p, tipo: 'camera' as const, raio: 60, ladoCam: c.lado })),
    ...cfg.agentes.map((c) => ({ id: c.id, p: c.p, tipo: 'agente' as const, raio: 45, ladoCam: 'ambos' as const })),
  ];
  for (const f of pontos) {
    const pr = r.linha.projetar(f.p);
    if (pr.dist > f.raio) continue;
    const l = lado(pr.s);
    if (f.tipo === 'camera' && f.ladoCam !== 'ambos' && l && l !== f.ladoCam) continue;
    r.fiscalizacoes.push({ sRota: pr.s, tipo: f.tipo, id: f.id });
  }

  // travessias de pedestre cruzadas pela rota
  for (const t of rede.travessias) {
    const ped = elementos.get(`P:${t.id}:SN`);
    if (!ped) continue;
    for (const x of intersecoes(r.linha, ped.linha)) {
      if (x.angulo < 25) continue;
      r.travessias.push({ sRota: x.sA, travessiaId: t.id, sPed: x.sB });
    }
  }

  if (r.manobra) r.manobra.sRota = r.linha.projetar(r.manobra.ponto).s;
  r.cedencias.sort((a, b) => a.sRota - b.sRota);
  r.retencoes.sort((a, b) => a.sRota - b.sRota);
  r.travessias.sort((a, b) => a.sRota - b.sRota);
  r.tempoLivre = r.pecas.reduce((acc, p) => acc + (p.sElem1 - p.sElem0) / Math.min(p.elem.velMax, kmh(60)), 0);
  r.tempoEstimado = r.tempoLivre + r.desvioExterno / kmh(30) + r.cedencias.length * 6;
}
