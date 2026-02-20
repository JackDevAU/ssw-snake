import type { FormEvent } from 'react';
import type { LeaderboardEntry } from '../game/types';

interface GameOverPanelProps {
  score: number;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onSubmitScore: () => void;
  scoreSubmitting: boolean;
  scoreSubmitted: boolean;
  scoreSubmitStatus: string;
  leaderboardLoading: boolean;
  leaderboardEntries: LeaderboardEntry[];
  onRestart: () => void;
}

export const GameOverPanel = ({
  score,
  playerName,
  onPlayerNameChange,
  onSubmitScore,
  scoreSubmitting,
  scoreSubmitted,
  scoreSubmitStatus,
  leaderboardLoading,
  leaderboardEntries,
  onRestart,
}: GameOverPanelProps) => {
  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitScore();
  };

  return (
    <div className="game-over">
      <h2>Game Over</h2>
      <p className="game-over-score">Score {score}</p>

      <form className="name-form" onSubmit={onFormSubmit}>
        <input
          className="name-input"
          disabled={scoreSubmitted}
          maxLength={24}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          placeholder="Enter your name"
          type="text"
          value={playerName}
        />
        <button className="submit-score-button" disabled={scoreSubmitting || scoreSubmitted} type="submit">
          {scoreSubmitted ? 'Submitted' : scoreSubmitting ? 'Submitting...' : 'Submit Score'}
        </button>
      </form>

      {scoreSubmitStatus && <p className="submit-status">{scoreSubmitStatus}</p>}

      <div className="game-over-leaderboard">
        <p>Leaderboard</p>
        {leaderboardLoading ? (
          <p className="leaderboard-status">Loading...</p>
        ) : leaderboardEntries.length > 0 ? (
          <ol>
            {leaderboardEntries.map((entry, index) => (
              <li key={`${entry.player}-${index}`}>
                <span>{entry.player}</span>
                <strong>{entry.score}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="leaderboard-status">No scores yet.</p>
        )}
      </div>

      <div className="game-over-actions">
        <button className="restart-button" type="button" onClick={onRestart}>
          Restart
        </button>
        <a className="leaderboard-link" href="/leaderboard">
          Full Leaderboard
        </a>
      </div>
    </div>
  );
};
