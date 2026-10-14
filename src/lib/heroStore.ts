/**
 * Estado mutável compartilhado entre o DOM do hero e a cena 3D.
 * Escrito por scroll/pointer, lido a cada frame dentro do Canvas (sem re-render React).
 */
export type CalloutDef = {
  id: string;
  title: string;
  text: string;
  /** Ponto no espaço local do boné (antes do scale). */
  anchor: [number, number, number];
  /** Progresso do scroll em que o callout fica centrado (0..1). */
  at: number;
};

export const CALLOUTS: CalloutDef[] = [
  { id: "panel", title: "5 panel, perfil baixo", text: "Copa rente, sem volume.", anchor: [0.12, 0.58, -0.1], at: 0.16 },
  { id: "brim", title: "Aba reta", text: "Linha limpa, pesponto duplo.", anchor: [0.2, -0.04, 1.45], at: 0.31 },
  { id: "ripstop", title: "Ripstop", text: "Leve, texturizado, resistente.", anchor: [0.86, 0.22, -0.05], at: 0.46 },
  { id: "embroidery", title: "Stay Alive. bordado", text: "Bordado branco no painel frontal.", anchor: [0.18, 0.26, 0.86], at: 0.61 },
];

export const heroStore = {
  /** Progresso do scroll story (0 = topo, 1 = fim da seção sticky). */
  progress: 0,
  /** Mouse normalizado (-1..1). */
  mouse: { x: 0, y: 0 },
  /** Velocidade angular aplicada pelo arrasto. */
  dragVelocity: 0,
  /** Delta de rotação acumulado desde o último frame (consumido pela cena). */
  dragImpulse: 0,
  dragging: false,
  reduced: false,
  /** GLB carregado e shaders compilados: libera a entrada do boné. */
  capReady: false,
  isMobile: false,
  /** Elementos DOM dos callouts, preenchidos pela camada de callouts. */
  calloutEls: [] as (HTMLDivElement | null)[],
  lineEls: [] as (SVGLineElement | null)[],
  dotEls: [] as (SVGCircleElement | null)[],
  stageEl: null as HTMLDivElement | null,
};
