import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { GameBoard } from './components/GameBoard';
import { GameHud } from './components/GameHud';
import { GameOverPanel } from './components/GameOverPanel';
import { IntroOverlay } from './components/IntroOverlay';
import { MobileDpad } from './components/MobileDpad';
import {
  BONUS_FOOD_CHANCE,
  BONUS_POINTS,
  FOODS_PER_GROWTH_BOOST,
  GRID_SIZE,
  GROWTH_BOOST_SEGMENTS,
  INITIAL_DIRECTION,
  PLAYER_STORAGE_KEY,
  SNAKE_STRIPE_COLORS,
} from './game/constants';
import {
  coordKey,
  createInitialFoods,
  directionFromKey,
  getInitialSnake,
  isReverse,
  levelForScore,
  spawnFood,
  targetFoodCountForScore,
} from './game/helpers';
import type { Coord, Direction, Food, LeaderboardEntry, Phase } from './game/types';
import { useFaceParticles } from './hooks/useFaceParticles';

interface LeaderboardResponse {
  entries?: LeaderboardEntry[];
  error?: string;
}

interface RunSession {
  runId: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
}

export default function App() {
  const [snake, setSnake] = useState<Coord[]>(() => getInitialSnake());
  const [foods, setFoods] = useState<Food[]>(() => createInitialFoods(getInitialSnake()));
  const [phase, setPhase] = useState<Phase>('intro-logo');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [foodsEaten, setFoodsEaten] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreSubmitStatus, setScoreSubmitStatus] = useState('');
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [runSession, setRunSession] = useState<RunSession | null>(null);

  const directionRef = useRef<Direction>(INITIAL_DIRECTION);
  const pendingDirectionRef = useRef<Direction | null>(null);
  const pendingGrowthRef = useRef(0);
  const foodsRef = useRef<Food[]>(foods);
  const scoreRef = useRef(score);
  const foodsEatenRef = useRef(foodsEaten);
  const runSessionRef = useRef<RunSession | null>(runSession);
  const runStartRequestIdRef = useRef(0);

  const { faceParticles, spawnFaceParticles, clearFaceParticles } = useFaceParticles();

  useEffect(() => {
    foodsRef.current = foods;
  }, [foods]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    foodsEatenRef.current = foodsEaten;
  }, [foodsEaten]);

  useEffect(() => {
    runSessionRef.current = runSession;
  }, [runSession]);

  useEffect(() => {
    const logoTimer = window.setTimeout(() => setPhase('intro-explode'), 1100);
    const playTimer = window.setTimeout(() => setPhase('play'), 2200);

    return () => {
      window.clearTimeout(logoTimer);
      window.clearTimeout(playTimer);
    };
  }, []);

  const startSecureRun = useCallback(async () => {
    const requestId = runStartRequestIdRef.current + 1;
    runStartRequestIdRef.current = requestId;

    setRunSession(null);

    try {
      const response = await fetch('/api/run/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (requestId === runStartRequestIdRef.current) {
          setRunSession(null);
        }
        return;
      }

      const payload = (await response.json()) as Partial<RunSession>;
      if (
        typeof payload.runId !== 'string' ||
        typeof payload.token !== 'string' ||
        typeof payload.issuedAt !== 'number' ||
        typeof payload.expiresAt !== 'number'
      ) {
        if (requestId === runStartRequestIdRef.current) {
          setRunSession(null);
        }
        return;
      }

      if (requestId === runStartRequestIdRef.current) {
        setRunSession({
          runId: payload.runId,
          token: payload.token,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
        });
      }
    } catch {
      if (requestId === runStartRequestIdRef.current) {
        setRunSession(null);
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== 'play' || gameOver) return;
    if (runSessionRef.current) return;
    void startSecureRun();
  }, [gameOver, phase, startSecureRun]);

  useEffect(() => {
    if (!gameOver) {
      setLeaderboardEntries([]);
      setLeaderboardLoading(false);
      setScoreSubmitting(false);
      setScoreSubmitStatus('');
      setScoreSubmitted(false);
      return;
    }

    let cancelled = false;

    const loadTopScores = async () => {
      try {
        const response = await fetch('/api/leaderboard?limit=8');
        if (!response.ok) return;

        const data = (await response.json()) as LeaderboardResponse;
        if (!cancelled && Array.isArray(data?.entries)) {
          setLeaderboardEntries(data.entries);
        }
      } catch {}
    };

    const initializePlayerName = () => {
      try {
        const saved = window.localStorage.getItem(PLAYER_STORAGE_KEY);
        if (saved) {
          setPlayerName(saved);
          return;
        }

        const generated = `Snake-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        window.localStorage.setItem(PLAYER_STORAGE_KEY, generated);
        setPlayerName(generated);
      } catch {
        setPlayerName(`Snake-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
      }
    };

    const run = async () => {
      setLeaderboardLoading(true);
      initializePlayerName();
      await loadTopScores();
      if (!cancelled) setLeaderboardLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [gameOver]);

  const submitScore = useCallback(async () => {
    if (scoreSubmitting) return;
    if (scoreSubmitted) {
      setScoreSubmitStatus('Score already submitted for this run.');
      return;
    }

    const activeRun = runSessionRef.current;
    if (!activeRun) {
      setScoreSubmitStatus('Secure run not ready. Restart and try again.');
      return;
    }

    if (Date.now() > activeRun.expiresAt) {
      setScoreSubmitStatus('Run token expired. Restart and try again.');
      return;
    }

    const name = (playerName || '').trim().slice(0, 24);
    if (!name) {
      setScoreSubmitStatus('Enter a name first.');
      return;
    }

    if (score <= 0) {
      setScoreSubmitStatus('Score must be greater than 0.');
      return;
    }

    setScoreSubmitting(true);
    setScoreSubmitStatus('');

    try {
      window.localStorage.setItem(PLAYER_STORAGE_KEY, name);
    } catch {}

    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: name,
          claimedScore: score,
          runId: activeRun.runId,
          token: activeRun.token,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Submit failed. Try again.';

        try {
          const data = (await response.json()) as LeaderboardResponse;
          if (typeof data.error === 'string' && data.error.length > 0) {
            errorMessage = data.error;
          }
        } catch {}

        if (response.status === 409) {
          setScoreSubmitted(true);
        }

        setScoreSubmitStatus(errorMessage);
        setScoreSubmitting(false);
        return;
      }

      const data = (await response.json()) as LeaderboardResponse;
      if (Array.isArray(data?.entries)) {
        setLeaderboardEntries(data.entries.slice(0, 8));
      }

      setScoreSubmitted(true);
      setScoreSubmitStatus('Score submitted.');
    } catch {
      setScoreSubmitStatus('Submit failed. Try again.');
    } finally {
      setScoreSubmitting(false);
    }
  }, [playerName, score, scoreSubmitted, scoreSubmitting]);

  const resetGame = useCallback(() => {
    const initialSnake = getInitialSnake();
    const nextFoods = createInitialFoods(initialSnake);

    setSnake(initialSnake);
    setFoods(nextFoods);
    setScore(0);
    setFoodsEaten(0);
    setGameOver(false);
    setScoreSubmitting(false);
    setScoreSubmitStatus('');
    setScoreSubmitted(false);

    runStartRequestIdRef.current += 1;
    setRunSession(null);

    clearFaceParticles();

    foodsRef.current = nextFoods;
    scoreRef.current = 0;
    foodsEatenRef.current = 0;
    pendingGrowthRef.current = 0;
    directionRef.current = INITIAL_DIRECTION;
    pendingDirectionRef.current = null;

    setPhase('play');
    void startSecureRun();
  }, [clearFaceParticles, startSecureRun]);

  const queueDirection = useCallback(
    (direction: Direction | null) => {
      if (phase !== 'play' || gameOver || !direction) return;
      if (pendingDirectionRef.current) return;
      if (isReverse(direction, directionRef.current)) return;
      pendingDirectionRef.current = direction;
    },
    [gameOver, phase],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTypingField = tag === 'INPUT' || tag === 'TEXTAREA';
      const direction = directionFromKey(event.key);

      if ((event.key === ' ' || event.key === 'Enter') && gameOver && !isTypingField) {
        event.preventDefault();
        resetGame();
        return;
      }

      if (isTypingField) return;

      if (!direction) return;

      event.preventDefault();
      queueDirection(direction);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameOver, queueDirection, resetGame]);

  useEffect(() => {
    if (phase !== 'play' || gameOver) return undefined;

    const speed = Math.max(62, 138 - levelForScore(score) * 8);

    const timer = window.setInterval(() => {
      setSnake((currentSnake) => {
        if (pendingDirectionRef.current && !isReverse(pendingDirectionRef.current, directionRef.current)) {
          directionRef.current = pendingDirectionRef.current;
        }
        pendingDirectionRef.current = null;

        const direction = directionRef.current;
        const head = currentSnake[0];
        const nextHead: Coord = {
          x: head.x + direction.x,
          y: head.y + direction.y,
        };

        const eatenFoodIndex = foodsRef.current.findIndex(
          (food) => food.x === nextHead.x && food.y === nextHead.y,
        );
        const eatenFood = eatenFoodIndex >= 0 ? foodsRef.current[eatenFoodIndex] : null;
        const ateFood = Boolean(eatenFood);
        const tailWillMove = !ateFood && pendingGrowthRef.current <= 0;
        const collisionBody = tailWillMove ? currentSnake.slice(0, -1) : currentSnake;

        const hitWall =
          nextHead.x < 0 ||
          nextHead.y < 0 ||
          nextHead.x >= GRID_SIZE ||
          nextHead.y >= GRID_SIZE;

        const hitSelf = collisionBody.some(
          (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
        );

        if (hitWall || hitSelf) {
          setGameOver(true);
          return currentSnake;
        }

        const movedSnake = [nextHead, ...currentSnake];

        if (!ateFood) {
          if (pendingGrowthRef.current > 0) {
            pendingGrowthRef.current -= 1;
          } else {
            movedSnake.pop();
          }
        }

        if (eatenFood) {
          const foodsEatenNext = foodsEatenRef.current + 1;
          foodsEatenRef.current = foodsEatenNext;
          setFoodsEaten(foodsEatenNext);

          let growthBoost = eatenFood.kind === 'bonus' ? 1 : 0;
          if (foodsEatenNext % FOODS_PER_GROWTH_BOOST === 0) {
            growthBoost += GROWTH_BOOST_SEGMENTS;
          }
          pendingGrowthRef.current += growthBoost;

          const gainedPoints = eatenFood.kind === 'bonus' ? BONUS_POINTS : 1;
          const nextScore = scoreRef.current + gainedPoints;
          scoreRef.current = nextScore;
          setScore(nextScore);

          window.requestAnimationFrame(() => spawnFaceParticles(nextHead.x, nextHead.y));
        }

        const currentFoods = foodsRef.current;
        const hasBonusFood = currentFoods.some((food) => food.kind === 'bonus');
        let nextFoods = currentFoods;
        let foodsChanged = false;

        if (eatenFoodIndex >= 0 || hasBonusFood) {
          nextFoods = currentFoods
            .filter((_, index) => index !== eatenFoodIndex)
            .map((food) => (food.kind === 'bonus' ? { ...food, ttl: food.ttl - 1 } : food))
            .filter((food) => food.kind !== 'bonus' || food.ttl > 0);
          foodsChanged = true;
        }

        const projectedScore = scoreRef.current;
        const targetRegularCount = targetFoodCountForScore(projectedScore);

        while (nextFoods.filter((food) => food.kind === 'regular').length < targetRegularCount) {
          const regularFood = spawnFood(movedSnake, nextFoods, 'regular');
          if (!regularFood) break;

          if (!foodsChanged) {
            nextFoods = [...nextFoods];
            foodsChanged = true;
          }

          nextFoods.push(regularFood);
        }

        if (
          projectedScore >= 5 &&
          !nextFoods.some((food) => food.kind === 'bonus') &&
          Math.random() < BONUS_FOOD_CHANCE
        ) {
          const bonusFood = spawnFood(movedSnake, nextFoods, 'bonus');
          if (bonusFood) {
            if (!foodsChanged) {
              nextFoods = [...nextFoods];
              foodsChanged = true;
            }
            nextFoods.push(bonusFood);
          }
        }

        if (foodsChanged) {
          foodsRef.current = nextFoods;
          setFoods(nextFoods);
        }

        return movedSnake;
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [gameOver, phase, score, spawnFaceParticles]);

  const snakeColorMap = useMemo(() => {
    const map = new Map<string, string>();

    snake.forEach((segment, index) => {
      const fromTailIndex = snake.length - 1 - index;
      const color = SNAKE_STRIPE_COLORS[fromTailIndex % SNAKE_STRIPE_COLORS.length];
      map.set(coordKey(segment), color);
    });

    return map;
  }, [snake]);

  const foodMap = useMemo(() => {
    const map = new Map<string, Food['kind']>();
    foods.forEach((food) => map.set(coordKey(food), food.kind));
    return map;
  }, [foods]);

  const cells = useMemo<ReactElement[]>(() => {
    const nextCells: ReactElement[] = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x},${y}`;
        const snakeColor = snakeColorMap.get(key);
        const foodKind = foodMap.get(key);

        nextCells.push(
          <div
            className={`cell ${snakeColor ? 'cell-snake' : ''} ${foodKind ? 'cell-food' : ''} ${
              foodKind === 'bonus' ? 'cell-food-bonus' : ''
            }`}
            key={key}
            style={{ backgroundColor: snakeColor || undefined }}
          />,
        );
      }
    }

    return nextCells;
  }, [foodMap, snakeColorMap]);

  const level = levelForScore(score);
  const foodsUntilGrowthBoost =
    (FOODS_PER_GROWTH_BOOST - (foodsEaten % FOODS_PER_GROWTH_BOOST)) % FOODS_PER_GROWTH_BOOST ||
    FOODS_PER_GROWTH_BOOST;

  return (
    <main className="app-shell">
      {(phase === 'intro-logo' || phase === 'intro-explode') && <IntroOverlay phase={phase} />}

      <section className="game-root">
        <GameHud
          score={score}
          level={level}
          tailLength={snake.length}
          foodsUntilGrowthBoost={foodsUntilGrowthBoost}
        />

        <GameBoard
          phase={phase}
          gameOver={gameOver}
          gridSize={GRID_SIZE}
          cells={cells}
          faceParticles={faceParticles}
        />

        <MobileDpad onDirection={(direction) => queueDirection(direction)} />

        {gameOver && (
          <GameOverPanel
            score={score}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            onSubmitScore={submitScore}
            scoreSubmitting={scoreSubmitting}
            scoreSubmitted={scoreSubmitted}
            scoreSubmitStatus={scoreSubmitStatus}
            leaderboardLoading={leaderboardLoading}
            leaderboardEntries={leaderboardEntries}
            onRestart={resetGame}
          />
        )}
      </section>
    </main>
  );
}
