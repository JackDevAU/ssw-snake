import type { Direction } from './types';

export const COLORS = {
  red: '#CC4141',
  charcoal: '#333333',
  grey: '#797979',
  silver: '#AAAAAA',
} as const;

export const GRID_SIZE = 24;
export const INITIAL_DIRECTION: Direction = { x: 1, y: 0 };
export const SNAKE_STRIPE_COLORS: string[] = [COLORS.red, COLORS.charcoal, COLORS.silver, COLORS.grey];

export const BASE_FOOD_COUNT = 2;
export const MAX_FOOD_COUNT = 5;
export const LEVEL_STEP = 6;
export const BONUS_POINTS = 3;
export const BONUS_FOOD_CHANCE = 0.12;
export const BONUS_FOOD_TICKS = 20;
export const FOODS_PER_GROWTH_BOOST = 4;
export const GROWTH_BOOST_SEGMENTS = 2;

export const PLAYER_STORAGE_KEY = 'ssw-snake-player-name';

export const FACE_PARTICLE_COUNT = 6;
export const FACE_PARTICLE_DURATION_MIN = 810;
export const FACE_PARTICLE_DURATION_RANGE = 360;
export const FACE_PARTICLE_REMOVAL_BUFFER = 30;

const FACE_FILE_NAMES = [
  'adam1.png',
  'adam2.png',
  'brady.png',
  'brook.png',
  'dan.png',
  'gordon.png',
  'ivan.png',
  'jack.png',
  'jayden.png',
  'jk.png',
  'kaha.png',
  'luke.png',
  'penny.png',
  'sam.png',
  'vlad.png',
] as const;

export const FACE_OPTIONS: string[] = FACE_FILE_NAMES.map((fileName) => `/${fileName}`);
