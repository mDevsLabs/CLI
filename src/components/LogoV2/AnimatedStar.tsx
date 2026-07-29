import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Box } from '@anthropic/ink';
import { getInitialSettings } from '../../utils/settings/settings.js';
import { Star, type StarPose } from './Star.js';

type Frame = { pose: StarPose; offset: number };

function hold(pose: StarPose, offset: number, frames: number): Frame[] {
  return Array.from({ length: frames }, () => ({ pose, offset }));
}

const STAR_SPIN: readonly Frame[] = [
  ...hold('default', 0, 1),
  ...hold('spin-45', 0, 2),
  ...hold('flare', 0, 3),
  ...hold('sparkle-burst', 0, 3),
  ...hold('spin-45', 0, 2),
  ...hold('default', 0, 1),
];

const STAR_PULSE: readonly Frame[] = [
  ...hold('flare', 1, 2),
  ...hold('sparkle-burst', 0, 4),
  ...hold('flare', 0, 3),
  ...hold('default', 0, 1),
];

const CLICK_ANIMATIONS: readonly (readonly Frame[])[] = [STAR_SPIN, STAR_PULSE];

const IDLE: Frame = { pose: 'default', offset: 0 };
const FRAME_MS = 60;
const incrementFrame = (i: number) => i + 1;
const STAR_HEIGHT = 3;

export function AnimatedStar(): React.ReactNode {
  const { pose, bounceOffset, onClick } = useStarAnimation();
  return (
    <Box height={STAR_HEIGHT} flexDirection="column" onClick={onClick}>
      <Box marginTop={bounceOffset} flexShrink={0}>
        <Star pose={pose} />
      </Box>
    </Box>
  );
}

function useStarAnimation(): {
  pose: StarPose;
  bounceOffset: number;
  onClick: () => void;
} {
  const [reducedMotion] = useState(() => getInitialSettings().prefersReducedMotion ?? false);
  const [frameIndex, setFrameIndex] = useState(-1);
  const sequenceRef = useRef<readonly Frame[]>(STAR_SPIN);

  const onClick = () => {
    if (reducedMotion || frameIndex !== -1) return;
    sequenceRef.current = CLICK_ANIMATIONS[Math.floor(Math.random() * CLICK_ANIMATIONS.length)]!;
    setFrameIndex(0);
  };

  useEffect(() => {
    if (frameIndex === -1) return;
    if (frameIndex >= sequenceRef.current.length) {
      setFrameIndex(-1);
      return;
    }
    const timer = setTimeout(setFrameIndex, FRAME_MS, incrementFrame);
    return () => clearTimeout(timer);
  }, [frameIndex]);

  const seq = sequenceRef.current;
  const current = frameIndex >= 0 && frameIndex < seq.length ? seq[frameIndex]! : IDLE;
  return { pose: current.pose, bounceOffset: current.offset, onClick };
}
