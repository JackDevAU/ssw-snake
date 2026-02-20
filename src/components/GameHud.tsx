interface GameHudProps {
  score: number;
  level: number;
  tailLength: number;
  foodsUntilGrowthBoost: number;
}

export const GameHud = ({ score, level, tailLength, foodsUntilGrowthBoost }: GameHudProps) => (
  <div className="game-hud" aria-live="polite">
    <span>Score {score}</span>
    <span>Level {level}</span>
    <span>Tail {tailLength}</span>
    <span>Boost in {foodsUntilGrowthBoost}</span>
  </div>
);
