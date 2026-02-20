import {
  BASE_FOOD_COUNT,
  BONUS_FOOD_TICKS,
  GRID_SIZE,
  INITIAL_DIRECTION,
  LEVEL_STEP,
  MAX_FOOD_COUNT,
} from './constants';
import type { Coord, Direction, Food, FoodKind } from './types';

let foodId = 0;

export const DIRECTION_UP: Direction = { x: 0, y: -1 };
export const DIRECTION_DOWN: Direction = { x: 0, y: 1 };
export const DIRECTION_LEFT: Direction = { x: -1, y: 0 };
export const DIRECTION_RIGHT: Direction = { x: 1, y: 0 };

export const coordKey = ({ x, y }: Coord): string => `${x},${y}`;

export const createId = (prefix: string): string => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export const getInitialSnake = (): Coord[] => {
  const cx = Math.floor(GRID_SIZE / 2);
  const cy = Math.floor(GRID_SIZE / 2);

  return [
    { x: cx + 1, y: cy },
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
};

const randomFreeCell = (occupied: Set<string>): Coord | null => {
  if (occupied.size >= GRID_SIZE * GRID_SIZE) return null;

  while (true) {
    const cell: Coord = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };

    if (!occupied.has(coordKey(cell))) return cell;
  }
};

export const spawnFood = (snake: Coord[], foods: Food[], kind: FoodKind = 'regular'): Food | null => {
  const occupied = new Set(snake.map(coordKey));
  foods.forEach((food) => occupied.add(coordKey(food)));

  const cell = randomFreeCell(occupied);
  if (!cell) return null;

  return {
    id: `food-${(foodId += 1)}`,
    x: cell.x,
    y: cell.y,
    kind,
    ttl: kind === 'bonus' ? BONUS_FOOD_TICKS : 0,
  };
};

export const createInitialFoods = (snake: Coord[]): Food[] => {
  const foods: Food[] = [];

  while (foods.length < BASE_FOOD_COUNT) {
    const spawned = spawnFood(snake, foods, 'regular');
    if (!spawned) break;
    foods.push(spawned);
  }

  return foods;
};

export const levelForScore = (score: number): number => Math.floor(score / LEVEL_STEP) + 1;

export const targetFoodCountForScore = (score: number): number =>
  Math.min(MAX_FOOD_COUNT, BASE_FOOD_COUNT + Math.floor(score / 7));

export const isReverse = (a: Direction, b: Direction): boolean => a.x + b.x === 0 && a.y + b.y === 0;

export const directionFromKey = (key: string): Direction | null => {
  if (key === 'ArrowUp' || key === 'w' || key === 'W') return DIRECTION_UP;
  if (key === 'ArrowDown' || key === 's' || key === 'S') return DIRECTION_DOWN;
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return DIRECTION_LEFT;
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return DIRECTION_RIGHT;
  return null;
};

export { INITIAL_DIRECTION };
