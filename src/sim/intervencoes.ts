/**
 * Efeito de cada intervenção sobre o motor.
 *
 * - Fiscalização (câmera, radar, agente): sobe a chance de ser pego só dentro do raio.
 * - Físicas (fechar abertura, retorno em gota, tachões, lombada, faixa elevada, refúgio, baia):
 *   mudam a geometria ou a velocidade possível, então a infração deixa de ser possível ali.
 * - Pintura/sinalização: efeito moderado na obediência.
 * - Semáforo: fases no cruzamento da VV.
 */
import type { Intervencao, TipoInfracao } from './tipos';
import type { Projecao } from './geo';

const CAMERA: TipoInfracao[] = ['caixa_amarela', 'conversao_proibida', 'retorno_proibido', 'avanco_sinal', 'parada_irregular'];

export const CHANCE_BASE: Record<TipoInfracao, number> = {
  caixa_amarela: 0.02,
  conversao_proibida: 0.03,
  retorno_proibido: 0.03,
  avanco_sinal: 0.03,
  excesso_velocidade: 0.02,
  moto_corredor: 0.01,
  parada_irregular: 0.02,
  pedestre_fora_faixa: 0.005,
};

/** Custo estimado de implantação (R$) usado no ranking de cenários. */
export const CUSTO: Record<string, number> = {
  camera: 120_000,
  radar: 90_000,
  agente_transito: 1_500, // por turno
  semaforo: 180_000,
  fechar_abertura_vv: 45_000,
  fechar_abertura_norte: 45_000,
  retorno_gota: 650_000,
  tachoes: 8_000,
  lombada: 6_000,
  faixa_elevada: 35_000,
  refugio_pedestre: 25_000,
  pintura: 5_000,
  baia_onibus: 80_000,
};

interface Pontual {
  tipo: Intervencao['tipo'];
  x: number;
  y: number;
  raio: number;
  ate: number;
}

export interface FaseSemaforo {
  principal: 'verde' | 'amarelo' | 'vermelho';
  secundaria: 'verde' | 'amarelo' | 'vermelho';
  pedestre: boolean;
  /** segundos até o principal voltar a ficar verde (para o "ganho" de avançar). */
  restanteVermelhoPrincipal: number;
}

export class Intervencoes {
  readonly lista: Intervencao[];
  readonly pontuais: Pontual[];
  readonly fechadas: Set<string>;
  readonly comGota: boolean;
  readonly semaforo: { ciclo: number; verdePrincipal: number; amarelo: number; botoeira: boolean } | null;
  readonly custoTotal: number;

  constructor(lista: Intervencao[], proj: Projecao) {
    this.lista = lista;
    this.fechadas = new Set(lista.filter((i) => i.tipo.startsWith('fechar_abertura')).map((i) => i.tipo));
    this.comGota = lista.some((i) => i.tipo === 'retorno_gota');
    const s = lista.find((i) => i.tipo === 'semaforo');
    this.semaforo = s ? { ciclo: 90, verdePrincipal: 50, amarelo: 3, botoeira: false, ...(s.semaforo ?? {}) } : null;
    this.pontuais = lista
      .filter((i) => i.pos)
      .map((i) => {
        const [x, y] = proj.paraLocal(i.pos!);
        return {
          tipo: i.tipo,
          x,
          y,
          raio: i.raio ?? (i.tipo === 'tachoes' ? 40 : i.tipo === 'pintura' ? 80 : 60),
          ate: i.tipo === 'agente_transito' ? i.duracao ?? 900 : Infinity,
        };
      });
    this.custoTotal = lista.reduce((acc, i) => acc + (CUSTO[i.tipo] ?? 0), 0);
  }

  /** Chance de ser pego em (x, y) agora; e a chance sem nenhuma intervenção (para "desistiu"). */
  fiscalizacao(infr: TipoInfracao, x: number, y: number, t: number): { com: number; base: number; fonte: string | null } {
    const base = CHANCE_BASE[infr];
    let semPegar = 1 - base;
    let fonte: string | null = null;
    for (const p of this.pontuais) {
      let max = 0;
      if (p.tipo === 'camera' && CAMERA.includes(infr)) max = 0.85;
      else if (p.tipo === 'radar' && infr === 'excesso_velocidade') max = 0.9;
      else if (p.tipo === 'agente_transito' && t <= p.ate) max = infr === 'pedestre_fora_faixa' ? 0.15 : 0.6;
      if (!max) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > p.raio) continue;
      const q = max * (1 - 0.5 * (d / p.raio) ** 2);
      semPegar *= 1 - q;
      fonte = p.tipo;
    }
    return { com: 1 - semPegar, base, fonte };
  }

  /** Há fiscalização relevante perto? (para saber se a pessoa passou "depois da câmera") */
  existeFiscalizacao(): boolean {
    return this.pontuais.some((p) => p.tipo === 'camera' || p.tipo === 'radar' || p.tipo === 'agente_transito');
  }

  /** Tachões no raio tornam corredor e retornos fisicamente impossíveis ali. */
  bloqueadoPorTachoes(x: number, y: number): boolean {
    return this.pontuais.some((p) => p.tipo === 'tachoes' && Math.hypot(x - p.x, y - p.y) <= p.raio);
  }

  /** Sinalização/pintura: bônus de obediência perto (ou em toda a área, se não tiver posição). */
  bonusObediencia(x: number, y: number): number {
    let b = 0;
    for (const i of this.lista) {
      if (i.tipo !== 'pintura') continue;
      if (!i.pos) b = Math.max(b, 0.12);
    }
    for (const p of this.pontuais) if (p.tipo === 'pintura' && Math.hypot(x - p.x, y - p.y) <= p.raio) b = Math.max(b, 0.15);
    return b;
  }

  /** Velocidade máxima física (m/s) por lombada/faixa elevada perto de (x, y); Infinity se nenhuma. */
  limiteFisico(x: number, y: number): number {
    let v = Infinity;
    for (const p of this.pontuais) {
      if (p.tipo !== 'lombada' && p.tipo !== 'faixa_elevada') continue;
      const cap = (p.tipo === 'lombada' ? 25 : 30) / 3.6;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > 45) continue;
      v = Math.min(v, d < 10 ? cap : cap + (d - 10) * 0.35);
    }
    return v;
  }

  /** Travessias extras criadas por faixa elevada (x local) e refúgios. */
  faixasElevadas(): number[] {
    return this.pontuais.filter((p) => p.tipo === 'faixa_elevada').map((p) => p.x);
  }

  temRefugioPerto(x: number): boolean {
    return this.pontuais.some((p) => p.tipo === 'refugio_pedestre' && Math.abs(p.x - x) < 25);
  }

  baiaPerto(x: number, y: number): boolean {
    return this.pontuais.some((p) => p.tipo === 'baia_onibus' && Math.hypot(x - p.x, y - p.y) < 50);
  }

  fase(t: number, pedestreEsperando: boolean): FaseSemaforo | null {
    const s = this.semaforo;
    if (!s) return null;
    const vermelhoGeral = 2;
    const verdeSec = Math.max(8, s.ciclo - s.verdePrincipal - 2 * s.amarelo - 2 * vermelhoGeral);
    const c = t % s.ciclo;
    const fimVP = s.verdePrincipal;
    const fimAP = fimVP + s.amarelo;
    const fimR1 = fimAP + vermelhoGeral;
    const fimVS = fimR1 + verdeSec;
    const fimAS = fimVS + s.amarelo;
    let principal: FaseSemaforo['principal'] = 'vermelho';
    let secundaria: FaseSemaforo['secundaria'] = 'vermelho';
    if (c < fimVP) principal = 'verde';
    else if (c < fimAP) principal = 'amarelo';
    else if (c >= fimR1 && c < fimVS) secundaria = 'verde';
    else if (c >= fimVS && c < fimAS) secundaria = 'amarelo';
    const pedestre = principal === 'vermelho' && (!s.botoeira || pedestreEsperando);
    return { principal, secundaria, pedestre, restanteVermelhoPrincipal: principal === 'verde' ? 0 : s.ciclo - c };
  }
}
