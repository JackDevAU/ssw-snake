import type { MouseEvent, TouchEvent } from 'react';
import { DIRECTION_DOWN, DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP } from '../game/helpers';
import type { Direction } from '../game/types';

interface MobileDpadProps {
  onDirection: (direction: Direction) => void;
}

interface DpadButton {
  className: string;
  direction: Direction;
  label: string;
  ariaLabel: string;
}

const BUTTONS: DpadButton[] = [
  { className: 'dpad-up', direction: DIRECTION_UP, label: '↑', ariaLabel: 'Move up' },
  { className: 'dpad-left', direction: DIRECTION_LEFT, label: '←', ariaLabel: 'Move left' },
  { className: 'dpad-down', direction: DIRECTION_DOWN, label: '↓', ariaLabel: 'Move down' },
  { className: 'dpad-right', direction: DIRECTION_RIGHT, label: '→', ariaLabel: 'Move right' },
];

export const MobileDpad = ({ onDirection }: MobileDpadProps) => {
  const onPress = (event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>, direction: Direction) => {
    event.preventDefault();
    onDirection(direction);
  };

  return (
    <div className="mobile-dpad" role="group" aria-label="Touch controls">
      {BUTTONS.map((button) => (
        <button
          key={button.className}
          aria-label={button.ariaLabel}
          className={`dpad-button ${button.className}`}
          onMouseDown={(event) => onPress(event, button.direction)}
          onTouchStart={(event) => onPress(event, button.direction)}
          type="button"
        >
          {button.label}
        </button>
      ))}
    </div>
  );
};
