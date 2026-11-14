import { criarQuadro, paraLocal, Polilinha, type QuadroLocal, type Vec2 } from './geometria';

/**
 * Lê public/data/rede.geojson (gerado por scripts/gera-rede.mjs) e converte tudo para
 * metros locais. O arquivo é a única fonte da geometria: larguras, posição das aberturas
 * e travessias saem dele, então recalibrar o script recalibra o simulador.
 */

export interface FaixaRede {
  id: string;
  nome: string;
  linha: Polilinha;
  velMaxKmh: number;
  via: string;
  sentido: string;
  indice?: number;
}

export interface MovimentoRede {
  id: string;
  nome: string;
  de: string;
  para: string;
  permitido: boolean;
  fechadoPor: string | null;
  conflito: string | null;
  principal: boolean;
  linha: Polilinha;
}

export interface AberturaRede {
  id: string;
  nome: string;
  x0: number;
  x1: number;
  xc: number;
  intervencaoFecha: string;
  /** Cruzamento a que a abertura serve. */
  cruzamento: 'vv' | 'norte';
}

export interface TravessiaRede {
  id: string;
  nome: string;
  x: number;
  cruzamento: 'vv' | 'norte';
}

export interface CruzamentoRede {
  id: 'vv' | 'norte';
  nome: string;
  x: number;
}

export interface Rede {
  quadro: QuadroLocal;
  calibrado: boolean;
  /** Eixo de cada faixa da Africanos (índice 0 = junto ao canteiro). */
  yOeste: number[];
  yLeste: number[];
  largFaixa: number;
  meioCanteiro: number;
  borda: number;
  xMin: number;
  xMax: number;
  faixas: Record<string, FaixaRede>;
  movimentos: Record<string, MovimentoRede>;
  aberturas: AberturaRede[];
  travessias: TravessiaRede[];
  cruzamentos: CruzamentoRede[];
}

interface Feicao {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface ColecaoRede {
  metadata?: { ancora?: { lat: number; lon: number }; rumo_graus?: number; calibrado?: boolean };
  features: Feicao[];
}

export function lerRede(geojson: ColecaoRede): Rede {
  const meta = geojson.metadata ?? {};
  if (!meta.ancora || typeof meta.rumo_graus !== 'number') {
    throw new Error('rede.geojson sem metadata.ancora/rumo_graus: rode node scripts/gera-rede.mjs');
  }
  const quadro = criarQuadro(meta.ancora, meta.rumo_graus);
  const local = (c: number[]): Vec2 => paraLocal(quadro, c[0], c[1]);

  const faixas: Record<string, FaixaRede> = {};
  const movimentos: Record<string, MovimentoRede> = {};
  const aberturasBrutas: { id: string; nome: string; xs: number[]; fecha: string }[] = [];
  const travessiasBrutas: { id: string; nome: string; x: number }[] = [];

  for (const f of geojson.features) {
    const p = f.properties;
    const tipo = String(p.tipo);
    if (tipo === 'faixa') {
      const linha = new Polilinha((f.geometry.coordinates as number[][]).map(local));
      faixas[String(p.id)] = {
        id: String(p.id),
        nome: String(p.nome),
        linha,
        velMaxKmh: Number(p.vel_max_kmh ?? 40),
        via: String(p.via),
        sentido: String(p.sentido),
        indice: typeof p.indice === 'number' ? p.indice : undefined,
      };
    } else if (tipo === 'movimento') {
      movimentos[String(p.id)] = {
        id: String(p.id),
        nome: String(p.nome),
        de: String(p.de),
        para: String(p.para),
        permitido: p.permitido === true,
        fechadoPor: (p.fechado_por as string | null) ?? null,
        conflito: (p.conflito as string | null) ?? null,
        principal: p.principal === true,
        linha: new Polilinha((f.geometry.coordinates as number[][]).map(local)),
      };
    } else if (tipo === 'abertura') {
      const anel = (f.geometry.coordinates as number[][][])[0].map(local);
      aberturasBrutas.push({
        id: String(p.id),
        nome: String(p.nome),
        xs: anel.map((v) => v.x),
        fecha: String(p.intervencao_fecha ?? ''),
      });
    } else if (tipo === 'travessia') {
      const pts = (f.geometry.coordinates as number[][]).map(local);
      travessiasBrutas.push({ id: String(p.id), nome: String(p.nome), x: (pts[0].x + pts[1].x) / 2 });
    }
  }

  const eixoY = (id: string) => {
    const fx = faixas[id];
    if (!fx) throw new Error(`rede.geojson sem a faixa ${id}`);
    return (fx.linha.pts[0].y + fx.linha.pts[fx.linha.pts.length - 1].y) / 2;
  };
  const yOeste = [0, 1, 2].map((i) => eixoY(`africanos_oeste_${i}`));
  const yLeste = [0, 1, 2].map((i) => eixoY(`africanos_leste_${i}`));
  const largFaixa = Math.abs(yOeste[1] - yOeste[0]);
  const meioCanteiro = yOeste[0] - largFaixa / 2;
  const borda = yOeste[2] + largFaixa / 2;
  const xsAvenida = faixas.africanos_oeste_0.linha.pts.map((v) => v.x);

  const aberturas: AberturaRede[] = aberturasBrutas
    .map((a) => {
      const x0 = Math.min(...a.xs);
      const x1 = Math.max(...a.xs);
      return {
        id: a.id,
        nome: a.nome,
        x0,
        x1,
        xc: (x0 + x1) / 2,
        intervencaoFecha: a.fecha,
        cruzamento: (a.id.includes('vv') ? 'vv' : 'norte') as 'vv' | 'norte',
      };
    })
    .sort((a, b) => a.xc - b.xc);

  const cruzamentos: CruzamentoRede[] = aberturas.map((a) => ({
    id: a.cruzamento,
    nome: a.cruzamento === 'vv' ? 'Vicente Venâncio' : 'rua norte',
    x: a.xc,
  }));

  const travessias: TravessiaRede[] = travessiasBrutas.map((t) => ({
    ...t,
    cruzamento: (t.id.includes('vv') ? 'vv' : 'norte') as 'vv' | 'norte',
  }));

  return {
    quadro,
    calibrado: meta.calibrado === true,
    yOeste,
    yLeste,
    largFaixa,
    meioCanteiro,
    borda,
    xMin: Math.min(...xsAvenida),
    xMax: Math.max(...xsAvenida),
    faixas,
    movimentos,
    aberturas,
    travessias,
    cruzamentos,
  };
}
