/**
 * Monta, a partir do rede.geojson (scripts/gera-rede.mjs), as rotas que os agentes percorrem:
 * cada rota é uma polilinha em metros locais com as "zonas" que o motor precisa saber
 * (caixas amarelas, portões de preferência, linha de retenção do semáforo, gargalo a jusante).
 */
import { Polilinha, XY, criarProjecao, Projecao } from './geo';
import type { Aproximacao, TipoInfracao } from './tipos';

export interface Geometria {
  larg_faixa: number;
  n_faixas: number;
  meio_canteiro: number;
  borda: number;
  x_min: number;
  x_max: number;
  x_vv: number;
  x_norte: number;
  x_gota: number;
  abertura_vv: [number, number];
  abertura_norte: [number, number];
  compr_transversal: number;
}

export type Pista = 'leste' | 'oeste';

export interface Portao {
  s: number; // onde parar esperando brecha
  pista: Pista; // pista da Africanos a atravessar ou em que entra
  xc: number; // x onde cruza essa pista
  entraNaPista: boolean; // true = conversão à direita (só precisa de brecha na faixa da direita)
  sSaida: number; // onde a rota sai da pista (para saber se cabe do outro lado antes de ir)
  yEntrada: number; // y da faixa em que entra (para conversões que seguem pela pista)
}

export interface Rota {
  id: string;
  movimento: string;
  origem: Aproximacao;
  destino: string;
  linha: Polilinha;
  limites: [number, number, number][]; // [s0, s1, vmax m/s]
  caixas: { s0: number; s1: number; id: string }[];
  portoes: Portao[];
  /** Infração inerente a fazer essa rota (conversão/retorno proibido) ou null. */
  infracaoRota: TipoInfracao | null;
  /** Abertura que, fechada, torna a rota impossível. */
  fechadaPor: string | null;
  sSinal: number | null;
  grupoSinal: 'principal' | 'secundaria' | null;
  sJusante: number | null; // gargalo virtual a jusante (próximo cruzamento fora da área)
  pistaJusante: Pista | null;
  sMovIni: number; // início do trecho de conversão
  sMovFim: number;
  /** Tempo extra "fora do mapa" para quem precisou dar a volta (desvio legal). */
  desvioS: number;
}

interface Feicao {
  properties: Record<string, unknown> & { tipo: string; id: string };
  geometry: { type: string; coordinates: unknown };
}

export interface Rede {
  geo: Geometria;
  proj: Projecao;
  faixas: Map<string, XY[]>;
  movimentos: Map<string, { pts: XY[]; props: Record<string, unknown> }>;
  travessias: { id: string; x: number }[];
  /** Rotas montadas para um conjunto de aberturas fechadas e com/sem retorno em gota. */
  montarRotas(opcoes: { fechadas: Set<string>; comGota: boolean }): Map<string, Rota>;
}

const KMH = 1 / 3.6;

export function carregarRede(geojson: {
  metadata: { ancora: { lat: number; lon: number }; rumo_graus: number; geometria: Geometria };
  features: Feicao[];
}): Rede {
  const { ancora, rumo_graus, geometria: g } = geojson.metadata;
  const proj = criarProjecao(ancora, rumo_graus);
  const local = (c: [number, number]): XY => {
    const [x, y] = proj.paraLocal(c);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  };

  const faixas = new Map<string, XY[]>();
  const movimentos = new Map<string, { pts: XY[]; props: Record<string, unknown> }>();
  const travessias: { id: string; x: number }[] = [];

  for (const f of geojson.features) {
    const p = f.properties;
    if (f.geometry.type !== 'LineString') continue;
    const pts = (f.geometry.coordinates as [number, number][]).map(local);
    if (p.tipo === 'faixa') faixas.set(p.id, pts);
    else if (p.tipo === 'movimento' || p.tipo === 'opcional') movimentos.set(p.id, { pts, props: p });
    else if (p.tipo === 'travessia') travessias.push({ id: p.id, x: pts[0][0] });
  }

  const B = g.borda;
  const M = g.meio_canteiro;
  const retPista: Record<Pista, [number, number, number, number]> = {
    leste: [g.x_min - 1, g.x_max + 1, -B, -M],
    oeste: [g.x_min - 1, g.x_max + 1, M, B],
  };
  const dentro = (p: XY, r: [number, number, number, number]) => p[0] >= r[0] && p[0] <= r[1] && p[1] >= r[2] && p[1] <= r[3];

  const origemDaFaixa = (id: string): Aproximacao => {
    if (id.startsWith('africanos_leste')) return 'africanos_leste';
    if (id.startsWith('africanos_oeste')) return 'africanos_oeste';
    if (id.startsWith('vv')) return 'vv';
    if (id.startsWith('minerva')) return 'minerva';
    return 'rua_norte';
  };
  const ehAfricanos = (id: string) => id.startsWith('africanos');
  const velFaixa = (id: string) => (ehAfricanos(id) ? 60 * KMH : 40 * KMH);

  /** Junta: início da faixa de origem → pontos do movimento → fim da faixa de destino. */
  function rotaDeMovimento(
    id: string,
    de: string,
    para: string,
    meio: XY[],
    props: Record<string, unknown>,
    extra?: { desvioS?: number; prefixo?: XY[] }
  ): Rota {
    const fDe = faixas.get(de)!;
    const fPara = faixas.get(para)!;
    const pts: XY[] = [...(extra?.prefixo ?? [fDe[0]]), ...meio, fPara[fPara.length - 1]];
    const linha = new Polilinha(pts);
    const sMovIni = linha.sMaisProximo(meio[0][0], meio[0][1]);
    const sMovFim = linha.sMaisProximo(meio[meio.length - 1][0], meio[meio.length - 1][1]);
    const reto = Math.abs(meio[0][0] - meio[meio.length - 1][0]) < 1 || Math.abs(meio[0][1] - meio[meio.length - 1][1]) < 1;
    const limites: [number, number, number][] = [
      [0, sMovIni, velFaixa(de)],
      [sMovIni, sMovFim, (reto ? 30 : props.conflito === 'retorno_proibido' || id === 'retorno_gota' ? 18 : 22) * KMH],
      [sMovFim, linha.comprimento, velFaixa(para)],
    ];
    const conflito = props.conflito as string | null | undefined;
    const infracaoRota: TipoInfracao | null =
      props.permitido === false ? (conflito === 'retorno_proibido' ? 'retorno_proibido' : 'conversao_proibida') : null;
    return completar({
      id,
      movimento: id,
      origem: origemDaFaixa(de),
      destino: para,
      linha,
      limites,
      caixas: [],
      portoes: [],
      infracaoRota,
      fechadaPor: (props.fechado_por as string | null) ?? null,
      sSinal: null,
      grupoSinal: null,
      sJusante: null,
      pistaJusante: null,
      sMovIni,
      sMovFim,
      desvioS: extra?.desvioS ?? 0,
    });
  }

  function rotaReta(id: string): Rota {
    const pts = faixas.get(id)!;
    const linha = new Polilinha(pts);
    return completar({
      id,
      movimento: id,
      origem: origemDaFaixa(id),
      destino: id,
      linha,
      limites: [[0, linha.comprimento, velFaixa(id)]],
      caixas: [],
      portoes: [],
      infracaoRota: null,
      fechadaPor: null,
      sSinal: null,
      grupoSinal: null,
      sJusante: null,
      pistaJusante: null,
      sMovIni: linha.comprimento,
      sMovFim: linha.comprimento,
      desvioS: 0,
    });
  }

  /** Calcula caixas, portões, semáforo e gargalo a jusante. */
  function completar(r: Rota): Rota {
    const p0 = r.linha.pts[0];
    for (const pista of ['leste', 'oeste'] as Pista[]) {
      const ret = retPista[pista];
      const comecaNela = dentro(p0, ret);
      if (comecaNela) {
        // caixas amarelas desta pista que a rota atravessa
        for (const [nome, ab] of [
          ['vv', g.abertura_vv],
          ['norte', g.abertura_norte],
        ] as [string, [number, number]][]) {
          const t = r.linha.trechoDentro(ab[0], ab[1], ret[2], ret[3]);
          if (t && t[1] - t[0] > 3) r.caixas.push({ s0: t[0], s1: t[1], id: `${nome}_${pista}` });
        }
        continue;
      }
      // rota que entra nesta pista vinda de fora: portão de preferência
      const t = r.linha.trechoDentro(ret[0], ret[1], ret[2], ret[3]);
      if (!t) continue;
      const pe = r.linha.em(t[0]);
      // "entra" = segue pela pista depois (conversão à direita, ou fim do retorno); senão só atravessa
      const entra = t[1] >= r.linha.comprimento - 2 || t[1] - t[0] > 30;
      const yEntrada = r.linha.em(Math.min(t[1], t[0] + 25)).y;
      r.portoes.push({ s: Math.max(0, t[0] - 0.5), pista, xc: pe.x, entraNaPista: entra, sSaida: t[1], yEntrada });
    }
    r.portoes.sort((a, b) => a.s - b.s);

    // semáforo do cruzamento da VV
    const caixaVV = r.caixas.find((c) => c.id.startsWith('vv_'));
    if (caixaVV) {
      r.sSinal = Math.max(0, caixaVV.s0 - 0.5);
      r.grupoSinal = 'principal';
    } else if ((r.origem === 'vv' || r.origem === 'minerva') && r.portoes.length) {
      r.sSinal = r.portoes[0].s;
      r.grupoSinal = 'secundaria';
    }

    // gargalo virtual a jusante, para quem termina na Africanos
    const fim = r.linha.pts[r.linha.pts.length - 1];
    if (dentro(fim, retPista.oeste) && fim[0] < -200) {
      r.sJusante = r.linha.comprimento - (-230 - g.x_min);
      r.pistaJusante = 'oeste';
    } else if (dentro(fim, retPista.leste) && fim[0] > 150) {
      r.sJusante = r.linha.comprimento - (g.x_max - 175);
      r.pistaJusante = 'leste';
    }
    return r;
  }

  function montarRotas({ fechadas, comGota }: { fechadas: Set<string>; comGota: boolean }) {
    const rotas = new Map<string, Rota>();
    for (const id of faixas.keys()) if (ehAfricanos(id)) rotas.set(id, rotaReta(id));
    for (const [id, m] of movimentos) {
      if (m.props.tipo === 'opcional') continue;
      const fp = (m.props.fechado_por as string | null) ?? null;
      if (fp && fechadas.has(fp)) continue; // fisicamente impossível
      rotas.set(id, rotaDeMovimento(id, m.props.de as string, m.props.para as string, m.pts, m.props));
    }

    // Retorno em gota: quem vem da VV e quer ir para oeste vira à direita, passa para a faixa
    // da esquerda e faz o retorno protegido a leste.
    const gota = movimentos.get('retorno_gota');
    const dirVV = movimentos.get('vv_dir_para_leste');
    if (comGota && gota && dirVV) {
      const y2 = dirVV.pts[dirVV.pts.length - 1][1];
      const y0 = gota.pts[0][1];
      const xg = gota.pts[0][0];
      const troca: XY[] = [];
      for (let x = dirVV.pts[dirVV.pts.length - 1][0] + 10; x <= xg - 15; x += 10) {
        const t = Math.min(1, Math.max(0, (x - 30) / Math.max(1, xg - 60)));
        troca.push([x, y2 + (y0 - y2) * (t * t * (3 - 2 * t))]);
      }
      const meio: XY[] = [...dirVV.pts, ...troca, ...gota.pts];
      rotas.set(
        'vv_gota_para_oeste',
        rotaDeMovimento('vv_gota_para_oeste', 'vv_saida_dir', 'africanos_oeste_0', meio, { permitido: true }, {})
      );
      // retorno legal para quem vem pela Africanos sentido leste
      rotas.set(
        'leste_gota_para_oeste',
        rotaDeMovimento('leste_gota_para_oeste', 'africanos_leste_0', 'africanos_oeste_0', gota.pts, { permitido: true })
      );
      // Ajuste dos limites: só o trecho da gota é lento
      for (const id of ['vv_gota_para_oeste', 'leste_gota_para_oeste']) {
        const r = rotas.get(id)!;
        const sG = r.linha.sMaisProximo(gota.pts[0][0], gota.pts[0][1]);
        const sGf = r.linha.sMaisProximo(gota.pts[gota.pts.length - 1][0], gota.pts[gota.pts.length - 1][1]);
        r.limites = [
          [0, sG, (id.startsWith('vv') ? 40 : 60) * KMH],
          [sG, sGf, 18 * KMH],
          [sGf, r.linha.comprimento, 60 * KMH],
        ];
        if (id.startsWith('vv')) r.limites.unshift([0, r.sMovIni + 15, 22 * KMH]);
      }
    }
    return rotas;
  }

  return { geo: g, proj, faixas, movimentos, travessias, montarRotas };
}

/** Velocidade máxima da rota em s. */
export function limiteEm(r: Rota, s: number): number {
  for (const [a, b, v] of r.limites) if (s >= a && s < b) return v;
  return r.limites[r.limites.length - 1][2];
}
