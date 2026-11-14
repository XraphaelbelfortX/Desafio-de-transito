/**
 * Geometria do motor: sistema local em metros (x ao longo da Av. dos Africanos para leste,
 * y para norte, origem no centro da abertura em frente à VV) e conversão para [lon, lat]
 * usando a mesma âncora e rumo de scripts/gera-rede.mjs.
 */

export type XY = [number, number];

export interface Projecao {
  paraGeo(p: XY): [number, number];
  paraLocal(lonlat: [number, number]): XY;
  /** Rumo da bússola (graus) de um vetor local. */
  rumo(hx: number, hy: number): number;
}

export function criarProjecao(ancora: { lat: number; lon: number }, rumoGraus: number): Projecao {
  const rad = (rumoGraus * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const mLat = 111320;
  const mLon = 111320 * Math.cos((ancora.lat * Math.PI) / 180);
  return {
    paraGeo([x, y]) {
      const xe = x * c - y * s;
      const yn = x * s + y * c;
      return [ancora.lon + xe / mLon, ancora.lat + yn / mLat];
    },
    paraLocal([lon, lat]) {
      const xe = (lon - ancora.lon) * mLon;
      const yn = (lat - ancora.lat) * mLat;
      return [xe * c + yn * s, -xe * s + yn * c];
    },
    rumo(hx, hy) {
      const xe = hx * c - hy * s;
      const yn = hx * s + hy * c;
      return ((Math.atan2(xe, yn) * 180) / Math.PI + 360) % 360;
    },
  };
}

/** Polilinha com comprimento acumulado, para andar por "s" (metros desde o início). */
export class Polilinha {
  readonly pts: XY[];
  readonly acum: number[];
  readonly comprimento: number;

  constructor(pts: XY[]) {
    // remove pontos repetidos
    const limpos: XY[] = [];
    for (const p of pts) {
      const u = limpos[limpos.length - 1];
      if (!u || Math.hypot(p[0] - u[0], p[1] - u[1]) > 0.05) limpos.push(p);
    }
    this.pts = limpos;
    this.acum = [0];
    for (let i = 1; i < limpos.length; i++) {
      this.acum.push(this.acum[i - 1] + Math.hypot(limpos[i][0] - limpos[i - 1][0], limpos[i][1] - limpos[i - 1][1]));
    }
    this.comprimento = this.acum[this.acum.length - 1];
  }

  /** Ponto e direção unitária em s. */
  em(s: number): { x: number; y: number; hx: number; hy: number } {
    const pts = this.pts;
    if (s <= 0) return this.seg(0, 0);
    if (s >= this.comprimento) {
      const i = Math.max(0, pts.length - 2);
      return this.seg(i, this.comprimento - this.acum[i]);
    }
    // busca binária
    let lo = 0;
    let hi = this.acum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.acum[m] <= s) lo = m;
      else hi = m;
    }
    return this.seg(lo, s - this.acum[lo]);
  }

  private seg(i: number, d: number) {
    const a = this.pts[Math.max(0, i)];
    const b = this.pts[Math.min(this.pts.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const hx = (b[0] - a[0]) / L;
    const hy = (b[1] - a[1]) / L;
    return { x: a[0] + hx * d, y: a[1] + hy * d, hx, hy };
  }

  /** Menor s em que a polilinha entra no retângulo, e o s em que sai (amostragem de 0,5 m). */
  trechoDentro(x0: number, x1: number, y0: number, y1: number): [number, number] | null {
    let ini = -1;
    let fim = -1;
    for (let s = 0; s <= this.comprimento; s += 0.5) {
      const p = this.em(s);
      const dentro = p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
      if (dentro && ini < 0) ini = s;
      if (dentro) fim = s;
      if (!dentro && ini >= 0) break;
    }
    return ini < 0 ? null : [ini, fim];
  }

  /** s do ponto mais próximo, para polilinhas retas de 2 pontos (projeção direta). */
  sMaisProximoReta(x: number, y: number): number {
    if (this.pts.length !== 2) return this.sMaisProximo(x, y);
    const [a, b] = this.pts;
    const hx = (b[0] - a[0]) / this.comprimento;
    const hy = (b[1] - a[1]) / this.comprimento;
    return Math.max(0, Math.min(this.comprimento, (x - a[0]) * hx + (y - a[1]) * hy));
  }

  /** s do ponto mais próximo de (x, y) (amostragem de 0,5 m). */
  sMaisProximo(x: number, y: number): number {
    let melhor = 0;
    let dMin = Infinity;
    for (let s = 0; s <= this.comprimento; s += 0.5) {
      const p = this.em(s);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < dMin) {
        dMin = d;
        melhor = s;
      }
    }
    return melhor;
  }
}

/** Gerador pseudoaleatório com semente (mulberry32): mesma semente, mesmo trânsito. */
export function criarRng(semente: number) {
  let a = semente >>> 0 || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    rnd,
    entre: (a0: number, a1: number) => a0 + (a1 - a0) * rnd(),
    /** Normal truncada em [0,1] com média m e desvio d. */
    perfil: (m: number, d: number) => {
      const u = 1 - rnd();
      const v = rnd();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return Math.min(1, Math.max(0, m + d * z));
    },
    escolher: <T,>(pesos: [T, number][]): T => {
      const tot = pesos.reduce((acc, [, w]) => acc + w, 0);
      let r = rnd() * tot;
      for (const [v, w] of pesos) {
        r -= w;
        if (r <= 0) return v;
      }
      return pesos[pesos.length - 1][0];
    },
    /** Tempo até a próxima chegada (processo de Poisson) para uma taxa por hora. */
    proximaChegada: (porHora: number) => (porHora <= 0 ? Infinity : -Math.log(1 - rnd()) * (3600 / porHora)),
  };
}
export type Rng = ReturnType<typeof criarRng>;
