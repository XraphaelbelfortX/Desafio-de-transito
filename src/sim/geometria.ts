/**
 * Geometria do simulador em METROS LOCAIS, no mesmo sistema de scripts/gera-rede.mjs:
 * x = ao longo da Av. dos Africanos (positivo para leste), y = positivo para norte,
 * origem no centro da abertura do canteiro em frente à Vicente Venâncio.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface QuadroLocal {
  lat0: number;
  lon0: number;
  cos: number;
  sin: number;
  mLat: number;
  mLon: number;
}

const M_POR_GRAU_LAT = 111320;

/** Cria o quadro local a partir da âncora e do rumo gravados no rede.geojson. */
export function criarQuadro(ancora: { lat: number; lon: number }, rumoGraus: number): QuadroLocal {
  const rad = (rumoGraus * Math.PI) / 180;
  return {
    lat0: ancora.lat,
    lon0: ancora.lon,
    cos: Math.cos(rad),
    sin: Math.sin(rad),
    mLat: M_POR_GRAU_LAT,
    mLon: M_POR_GRAU_LAT * Math.cos((ancora.lat * Math.PI) / 180),
  };
}

/** Metros locais -> [lon, lat]. */
export function paraGeo(q: QuadroLocal, p: Vec2): [number, number] {
  const xe = p.x * q.cos - p.y * q.sin;
  const yn = p.x * q.sin + p.y * q.cos;
  return [q.lon0 + xe / q.mLon, q.lat0 + yn / q.mLat];
}

/** [lon, lat] -> metros locais. */
export function paraLocal(q: QuadroLocal, lon: number, lat: number): Vec2 {
  const xe = (lon - q.lon0) * q.mLon;
  const yn = (lat - q.lat0) * q.mLat;
  return { x: xe * q.cos + yn * q.sin, y: -xe * q.sin + yn * q.cos };
}

/** Linha poligonal com consulta de ponto por distância percorrida. */
export class Polilinha {
  readonly pts: Vec2[];
  readonly acum: number[];
  readonly comprimento: number;

  constructor(pts: Vec2[]) {
    const limpos: Vec2[] = [];
    for (const p of pts) {
      const u = limpos[limpos.length - 1];
      if (!u || Math.hypot(p.x - u.x, p.y - u.y) > 1e-6) limpos.push({ x: p.x, y: p.y });
    }
    if (limpos.length === 1) limpos.push({ x: limpos[0].x + 1e-3, y: limpos[0].y });
    this.pts = limpos;
    this.acum = [0];
    for (let i = 1; i < limpos.length; i++) {
      this.acum.push(this.acum[i - 1] + Math.hypot(limpos[i].x - limpos[i - 1].x, limpos[i].y - limpos[i - 1].y));
    }
    this.comprimento = this.acum[this.acum.length - 1];
  }

  private indice(s: number): number {
    // busca binária do segmento que contém s
    let lo = 0;
    let hi = this.acum.length - 2;
    while (lo < hi) {
      const meio = (lo + hi + 1) >> 1;
      if (this.acum[meio] <= s) lo = meio;
      else hi = meio - 1;
    }
    return lo;
  }

  /** Ponto e direção (radianos, a partir do eixo x) a uma distância s do início. */
  ponto(s: number): { x: number; y: number; ang: number } {
    const sc = Math.max(0, Math.min(this.comprimento, s));
    const i = this.indice(sc);
    const a = this.pts[i];
    const b = this.pts[i + 1];
    const seg = this.acum[i + 1] - this.acum[i] || 1e-9;
    const t = (sc - this.acum[i]) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  /** Pontos entre s0 e s1 (inclusive as pontas). */
  trecho(s0: number, s1: number): Vec2[] {
    const a = Math.max(0, Math.min(s0, s1));
    const b = Math.min(this.comprimento, Math.max(s0, s1));
    const res: Vec2[] = [this.ponto(a)];
    for (let i = 1; i < this.pts.length - 1; i++) {
      if (this.acum[i] > a && this.acum[i] < b) res.push(this.pts[i]);
    }
    res.push(this.ponto(b));
    return res.map((p) => ({ x: p.x, y: p.y }));
  }

  /** Distância ao longo da linha do ponto mais próximo de p. */
  projetar(p: Vec2): { s: number; dist: number } {
    let melhor = { s: 0, dist: Infinity };
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      const qx = a.x + dx * t;
      const qy = a.y + dy * t;
      const d = Math.hypot(p.x - qx, p.y - qy);
      if (d < melhor.dist) melhor = { s: this.acum[i] + t * Math.sqrt(l2), dist: d };
    }
    return melhor;
  }
}

/**
 * Bézier cúbica de p0 a p3 (mesma regra de scripts/gera-rede.mjs):
 * t0/t1 são as tangentes de saída e chegada (vetores unitários).
 */
export function curva(p0: Vec2, t0: Vec2, p3: Vec2, t1: Vec2, n = 16): Vec2[] {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const reserva = Math.hypot(dx, dy) * 0.45;
  const alca = (t: Vec2) => {
    const proj = Math.abs(dx * t.x + dy * t.y);
    return proj > 1 ? 0.55 * proj : reserva;
  };
  const d0 = alca(t0);
  const d1 = alca(t1);
  const p1 = { x: p0.x + t0.x * d0, y: p0.y + t0.y * d0 };
  const p2 = { x: p3.x - t1.x * d1, y: p3.y - t1.y * d1 };
  const pts: Vec2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t ** 2;
    const e = t ** 3;
    pts.push({
      x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
    });
  }
  return pts;
}

export interface Intersecao {
  sA: number;
  sB: number;
  x: number;
  y: number;
  /** Ângulo entre as trajetórias, em graus (0 a 90). */
  angulo: number;
}

/** Todos os pontos em que duas polilinhas se cruzam. */
export function intersecoes(A: Polilinha, B: Polilinha): Intersecao[] {
  const res: Intersecao[] = [];
  for (let i = 0; i < A.pts.length - 1; i++) {
    const p = A.pts[i];
    const r = { x: A.pts[i + 1].x - p.x, y: A.pts[i + 1].y - p.y };
    for (let j = 0; j < B.pts.length - 1; j++) {
      const q = B.pts[j];
      const s = { x: B.pts[j + 1].x - q.x, y: B.pts[j + 1].y - q.y };
      const den = r.x * s.y - r.y * s.x;
      if (Math.abs(den) < 1e-9) continue;
      const qp = { x: q.x - p.x, y: q.y - p.y };
      const t = (qp.x * s.y - qp.y * s.x) / den;
      const u = (qp.x * r.y - qp.y * r.x) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const la = Math.hypot(r.x, r.y);
      const lb = Math.hypot(s.x, s.y);
      let ang = (Math.acos(Math.min(1, Math.abs((r.x * s.x + r.y * s.y) / (la * lb || 1)))) * 180) / Math.PI;
      if (ang > 90) ang = 180 - ang;
      res.push({ sA: A.acum[i] + t * la, sB: B.acum[j] + u * lb, x: p.x + r.x * t, y: p.y + r.y * t, angulo: ang });
    }
  }
  return res;
}

export const LESTE: Vec2 = { x: 1, y: 0 };
export const OESTE: Vec2 = { x: -1, y: 0 };
export const NORTE: Vec2 = { x: 0, y: 1 };
export const SUL: Vec2 = { x: 0, y: -1 };

export const kmh = (v: number) => v / 3.6;
export const paraKmh = (v: number) => v * 3.6;
