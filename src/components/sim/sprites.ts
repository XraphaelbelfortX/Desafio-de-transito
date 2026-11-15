import React, { useEffect } from 'react';
import { useMap } from 'react-map-gl';
interface MapaSprites {
  isStyleLoaded(): boolean;
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8Array }, options?: { pixelRatio?: number }): void;
  on(tipo: string, fn: () => void): void;
  off(tipo: string, fn: () => void): void;
}
import { PALETA } from './paleta';

/** Imagens geradas uma vez e registradas com map.addImage. */

export const IMG = {
  asfalto: 'spr-asfalto',
  grama: 'spr-grama',
  zebra: 'spr-zebra',
  hachura: 'spr-hachura',
  seta: 'spr-seta',
} as const;

const VEICULOS = ['carro', 'moto', 'onibus'] as const;
export type TipoSprite = (typeof VEICULOS)[number];

const CAIXA: Record<TipoSprite, { x: number; y: number; w: number; h: number; r: number }> = {
  carro: { x: 30, y: 52, w: 36, h: 78, r: 12 },
  moto: { x: 40, y: 66, w: 16, h: 50, r: 8 },
  onibus: { x: 26, y: 12, w: 44, h: 156, r: 9 },
};

const LARGURA = 96;
const ALTURA = 180;

const tela = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas indisponível');
  return { c, g };
};

const arredondado = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

const sombra = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  g.save();
  g.translate(x + w / 2, y + h + 5);
  g.scale(1, 0.38);
  g.beginPath();
  g.ellipse(0, 0, w * 0.62, w * 0.62, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(15, 23, 42, 0.42)';
  g.fill();
  g.restore();
};

const farois = (g: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  g.fillStyle = PALETA.farol;
  g.beginPath();
  g.arc(x + w * 0.22, y + 7, 3.2, 0, Math.PI * 2);
  g.arc(x + w * 0.78, y + 7, 3.2, 0, Math.PI * 2);
  g.fill();
};

const corpoCarro = (g: CanvasRenderingContext2D) => {
  const { x, y, w, h, r } = CAIXA.carro;
  sombra(g, x, y, w, h);
  arredondado(g, x, y, w, h, r);
  g.fillStyle = PALETA.carro;
  g.fill();
  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#94a3b8';
  g.fillRect(x + 4, y + 16, w - 8, 16);
  g.fillStyle = '#e2e8f0';
  g.fillRect(x + 5, y + h - 22, w - 10, 10);
  farois(g, x, y, w);
};

const corpoMoto = (g: CanvasRenderingContext2D) => {
  const { x, y, w, h } = CAIXA.moto;
  sombra(g, x - 4, y, w + 8, h);
  g.strokeStyle = '#1e293b';
  g.lineWidth = 3;
  g.fillStyle = '#1e293b';
  g.beginPath();
  g.arc(x + w / 2, y + 8, 6, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(x + w / 2, y + h - 8, 6.5, 0, Math.PI * 2);
  g.stroke();
  arredondado(g, x, y + 10, w, h - 22, 8);
  g.fillStyle = PALETA.moto;
  g.fill();
  g.strokeStyle = '#1e3a5f';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = PALETA.farol;
  g.beginPath();
  g.arc(x + w / 2, y + 4, 3, 0, Math.PI * 2);
  g.fill();
};

const corpoOnibus = (g: CanvasRenderingContext2D) => {
  const { x, y, w, h, r } = CAIXA.onibus;
  sombra(g, x, y, w, h);
  arredondado(g, x, y, w, h, r);
  g.fillStyle = PALETA.onibus;
  g.fill();
  g.strokeStyle = '#7c6bb5';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#ddd6fe';
  g.fillRect(x + 5, y + 8, w - 10, 14);
  g.fillStyle = '#f5f3ff';
  for (let i = 0; i < 5; i++) g.fillRect(x + 6, y + 30 + i * 22, w - 12, 12);
  farois(g, x, y, w);
};

const desenharCorpo = (g: CanvasRenderingContext2D, tipo: TipoSprite) => {
  if (tipo === 'carro') corpoCarro(g);
  else if (tipo === 'moto') corpoMoto(g);
  else corpoOnibus(g);
};

const contorno = (g: CanvasRenderingContext2D, tipo: TipoSprite) => {
  const { x, y, w, h, r } = CAIXA[tipo];
  g.strokeStyle = PALETA.infracao;
  g.lineWidth = 6;
  if (tipo === 'moto') {
    g.beginPath();
    g.roundRect(x - 5, y - 4, w + 10, h + 8, r);
  } else {
    arredondado(g, x - 4, y - 4, w + 8, h + 8, r + 2);
  }
  g.stroke();
};

const freio = (g: CanvasRenderingContext2D, tipo: TipoSprite) => {
  const { x, y, w, h } = CAIXA[tipo];
  g.fillStyle = PALETA.infracao;
  const traseira = y + h - 8;
  if (tipo === 'moto') {
    g.fillRect(x + 2, traseira, w - 4, 5);
    return;
  }
  g.fillRect(x + 4, traseira, 8, 5);
  g.fillRect(x + w - 12, traseira, 8, 5);
};

const pisca = (g: CanvasRenderingContext2D, tipo: TipoSprite, lado: 'esq' | 'dir') => {
  const { x, y, w, h } = CAIXA[tipo];
  const cx = lado === 'esq' ? x + 3 : x + w - 3;
  g.fillStyle = PALETA.pisca;
  g.beginPath();
  g.arc(cx, y + 8, 3.4, 0, Math.PI * 2);
  g.arc(cx, y + h - 8, 3.4, 0, Math.PI * 2);
  g.fill();
};

const anel = (g: CanvasRenderingContext2D, tipo: TipoSprite) => {
  const { x, y, w, h } = CAIXA[tipo];
  g.strokeStyle = PALETA.selecionado;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(x + w / 2, y + h / 2, w * 0.72, h * 0.56, 0, 0, Math.PI * 2);
  g.stroke();
};

const pedestre = (passo: number) => {
  const { c, g } = tela(72, 72);
  g.fillStyle = 'rgba(15, 23, 42, 0.35)';
  g.beginPath();
  g.ellipse(36, 62, 12, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = PALETA.pedestre;
  g.fillStyle = PALETA.pedestre;
  g.lineWidth = 4;
  g.lineCap = 'round';
  const balanco = passo === 0 ? -7 : passo === 2 ? 7 : 0;
  g.beginPath();
  g.moveTo(36, 30);
  g.lineTo(36 + balanco, 56);
  g.moveTo(36, 30);
  g.lineTo(36 - balanco, 56);
  g.moveTo(28, 32);
  g.lineTo(44, 32);
  g.stroke();
  g.fillRect(31, 24, 10, 14);
  g.fillStyle = PALETA.pele;
  g.beginPath();
  g.arc(36, 16, 7, 0, Math.PI * 2);
  g.fill();
  return c;
};

const anelPed = (cor: string) => {
  const { c, g } = tela(72, 72);
  g.strokeStyle = cor;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(36, 36, 28, 0, Math.PI * 2);
  g.stroke();
  return c;
};

const luz = (acesa: 'verde' | 'amarelo' | 'vermelho') => {
  const { c, g } = tela(48, 78);
  g.fillStyle = '#0f172a';
  g.fillRect(21, 4, 6, 70);
  g.beginPath();
  g.roundRect(12, 8, 24, 52, 6);
  g.fill();
  const cores = [PALETA.luzVermelha, PALETA.luzAmarela, PALETA.luzVerde];
  const nomes = ['vermelho', 'amarelo', 'verde'] as const;
  cores.forEach((cor, i) => {
    g.beginPath();
    g.arc(24, 18 + i * 15, 5, 0, Math.PI * 2);
    g.fillStyle = nomes[i] === acesa ? cor : '#1e293b';
    g.fill();
  });
  return c;
};

const seta = () => {
  const { c, g } = tela(32, 32);
  g.translate(16, 16);
  g.fillStyle = '#0f172a';
  g.beginPath();
  g.moveTo(0, -12);
  g.lineTo(9, 2);
  g.lineTo(4, 2);
  g.lineTo(4, 12);
  g.lineTo(-4, 12);
  g.lineTo(-4, 2);
  g.lineTo(-9, 2);
  g.closePath();
  g.fill();
  g.fillStyle = PALETA.faixa;
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(6, 1);
  g.lineTo(3, 1);
  g.lineTo(3, 9);
  g.lineTo(-3, 9);
  g.lineTo(-3, 1);
  g.lineTo(-6, 1);
  g.closePath();
  g.fill();
  return c;
};

const ruido = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

const asfalto = () => {
  const { c, g } = tela(128, 128);
  g.fillStyle = PALETA.asfalto;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const n = ruido(x, y);
      g.fillStyle = n > 0.72 ? 'rgba(255,255,255,0.07)' : n < 0.18 ? 'rgba(0,0,0,0.16)' : 'transparent';
      if (g.fillStyle !== 'transparent') g.fillRect(x, y, 2, 2);
    }
  }
  return c;
};

const grama = () => {
  const { c, g } = tela(128, 128);
  g.fillStyle = PALETA.grama;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 280; i++) {
    const x = Math.floor(ruido(i, 3) * 128);
    const y = Math.floor(ruido(7, i) * 128);
    g.fillStyle = i % 2 === 0 ? 'rgba(220, 252, 200, 0.35)' : 'rgba(20, 83, 45, 0.45)';
    g.fillRect(x, y, 2, 3);
  }
  return c;
};

const zebra = () => {
  const { c, g } = tela(64, 32);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 22, 32);
  return c;
};

const hachura = () => {
  const { c, g } = tela(64, 64);
  g.fillStyle = 'rgba(250, 204, 21, 0.35)';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#eab308';
  g.lineWidth = 4;
  for (let i = -64; i < 128; i += 12) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 64, 0);
    g.stroke();
  }
  return c;
};

let imagens: [string, HTMLCanvasElement][] | null = null;

const gerar = () => {
  if (imagens) return imagens;
  const lista: [string, HTMLCanvasElement][] = [];
  for (const tipo of VEICULOS) {
    const pares: [string, (g: CanvasRenderingContext2D) => void][] = [
      [`spr-${tipo}`, (g) => desenharCorpo(g, tipo)],
      [`spr-contorno-${tipo}`, (g) => contorno(g, tipo)],
      [`spr-freio-${tipo}`, (g) => freio(g, tipo)],
      [`spr-pisca-esq-${tipo}`, (g) => pisca(g, tipo, 'esq')],
      [`spr-pisca-dir-${tipo}`, (g) => pisca(g, tipo, 'dir')],
      [`spr-anel-${tipo}`, (g) => anel(g, tipo)],
    ];
    for (const [id, desenhar] of pares) {
      const { c, g } = tela(LARGURA, ALTURA);
      desenhar(g);
      lista.push([id, c]);
    }
  }
  for (let passo = 0; passo < 3; passo++) lista.push([`spr-ped-${passo}`, pedestre(passo)]);
  lista.push(['spr-anel-ped-vermelho', anelPed(PALETA.infracao)]);
  lista.push(['spr-anel-ped-laranja', anelPed(PALETA.conflito)]);
  lista.push(['spr-luz-verde', luz('verde')]);
  lista.push(['spr-luz-amarelo', luz('amarelo')]);
  lista.push(['spr-luz-vermelho', luz('vermelho')]);
  lista.push([IMG.seta, seta()]);
  lista.push([IMG.asfalto, asfalto()]);
  lista.push([IMG.grama, grama()]);
  lista.push([IMG.zebra, zebra()]);
  lista.push([IMG.hachura, hachura()]);
  imagens = lista;
  return lista;
};

const paraImagem = (canvas: HTMLCanvasElement) => {
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas indisponível');
  const bruto = g.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: new Uint8Array(bruto.data) };
};

export const registrarSprites = (mapa: MapaSprites) => {
  if (mapa.hasImage('spr-carro')) return;
  try {
    for (const [id, canvas] of gerar()) {
      if (!mapa.hasImage(id)) mapa.addImage(id, paraImagem(canvas), { pixelRatio: 1 });
    }
  } catch {
    /* o estilo ainda está montando; o próximo quadro tenta de novo */
  }
};

/** Garante as imagens antes das camadas que usam padrão. */
export const RegistrarSprites: React.FC = () => {
  const { current } = useMap();
  useEffect(() => {
    const mapa = current?.getMap() as MapaSprites | undefined;
    if (!mapa) return;
    const subir = () => registrarSprites(mapa);
    subir();
    mapa.on('load', subir);
    mapa.on('style.load', subir);
    return () => {
      mapa.off('load', subir);
      mapa.off('style.load', subir);
    };
  }, [current]);
  return null;
};
