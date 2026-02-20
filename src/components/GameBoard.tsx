import type { CSSProperties, ReactNode } from 'react';
import type { FaceParticle, Phase } from '../game/types';

type BoardStyle = CSSProperties & { '--grid-size': number };
type FaceParticleStyle = CSSProperties & {
  '--dx': string;
  '--dy': string;
  '--rot': string;
  '--duration': string;
  '--delay': string;
  '--scale': string;
};

interface GameBoardProps {
  phase: Phase;
  gameOver: boolean;
  gridSize: number;
  cells: ReactNode;
  faceParticles: FaceParticle[];
}

export const GameBoard = ({ phase, gameOver, gridSize, cells, faceParticles }: GameBoardProps) => (
  <div
    className={`board ${phase === 'play' ? 'board-live' : ''} ${gameOver ? 'board-failed' : ''}`}
    style={{ '--grid-size': gridSize } as BoardStyle}
    role="application"
    aria-label="Snake game board"
  >
    {cells}
    {faceParticles.map((particle) => (
      <img
        className="face-particle"
        key={particle.id}
        src={particle.face}
        alt=""
        aria-hidden="true"
        style={{
          left: `${particle.left}%`,
          top: `${particle.top}%`,
          '--dx': `${particle.dx}px`,
          '--dy': `${particle.dy}px`,
          '--rot': `${particle.rot}deg`,
          '--duration': `${particle.duration}ms`,
          '--delay': `${particle.delay}ms`,
          '--scale': `${particle.scale}`,
        } as FaceParticleStyle}
      />
    ))}
  </div>
);
