import * as React from 'react';
import { Box, Text, useAnimationFrame } from '@anthropic/ink';
import { mLogoRowsAt, type MLoRowSegment } from './mLogo.js';

export type StarPose = 'default' | 'flare' | 'spin-45' | 'sparkle-burst';

type Props = {
  pose?: StarPose;
};

/**
 * Renders the startup ASCII logo as an uppercase "M".
 *
 * Each block glyph is colored from a gradient that rotates through blue, red,
 * yellow and green over time, so the whole logo shimmers as the phase advances.
 */
export function Star({ pose: _pose = 'default' }: Props = {}): React.ReactNode {
  const [, time] = useAnimationFrame(80);
  const rows = mLogoRowsAt(time);

  return (
    <Box flexDirection="column" alignItems="center">
      {rows.map((row, i) => (
        <Box key={i} flexDirection="row">
          {row.map((seg: MLoRowSegment, j) => (
            <Text
              key={j}
              color={seg.color != null ? (seg.color as `#${string}`) : undefined}
            >
              {seg.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}