/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente repete a simulação. */
export class Aleatorio {
  private estado: number;

  constructor(semente: number) {
    this.estado = semente >>> 0 || 1;
  }

  /** Número em [0, 1). */
  proximo(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  entre(a: number, b: number): number {
    return a + (b - a) * this.proximo();
  }

  /** Normal (Box-Muller). */
  normal(media: number, desvio: number): number {
    const u = Math.max(1e-12, this.proximo());
    const v = this.proximo();
    return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Escolhe uma chave conforme os pesos. */
  escolher<T extends string>(pesos: Record<T, number>): T {
    const chaves = Object.keys(pesos) as T[];
    const total = chaves.reduce((acc, k) => acc + pesos[k], 0);
    let r = this.proximo() * total;
    for (const k of chaves) {
      r -= pesos[k];
      if (r <= 0) return k;
    }
    return chaves[chaves.length - 1];
  }
}

export const sigmoide = (z: number) => 1 / (1 + Math.exp(-z));
