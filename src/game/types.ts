export type Phase = 'intro-logo' | 'intro-explode' | 'play';

export interface Coord {
  x: number;
  y: number;
}

export type Direction = Coord;

export type FoodKind = 'regular' | 'bonus';

export interface Food extends Coord {
  id: string;
  kind: FoodKind;
  ttl: number;
}

export interface FaceParticle {
  id: string;
  burstId: string;
  face: string;
  left: number;
  top: number;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  delay: number;
  duration: number;
}

export interface LeaderboardEntry {
  player: string;
  score: number;
  updatedAt?: number;
}
