import * as React from 'react';
import { Box, Text, useAnimationFrame } from '@anthropic/ink';
import type { Theme } from '@anthropic/ink';
import { env } from '../../utils/env.js';
import { intensityToColor } from '../EffortPanel/rippleAnimation.js';

export type StarPose = 'default' | 'flare' | 'spin-45' | 'sparkle-burst';

type Props = {
  pose?: StarPose;
};

const ASCII_STAR = `          ★          
        ✦ ✧ ✦        
      ✦ ✧ ▲ ✧ ✦      
    ★ ✧ █ ✪ █ ✧ ★    
      ✦ ✧ ▼ ✧ ✦      
        ✦ ✧ ✦        
          ★          `;

export function Star({ pose = 'default' }: Props = {}): React.ReactNode {
  const [, time] = useAnimationFrame(80);
  const intensity = ((Math.sin(time / 300) + 1) / 2) * 0.6 + 0.4;
  const animatedColor = intensityToColor(intensity, 0);

  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalStar pose={pose} animatedColor={animatedColor} />;
  }

  return (
    <Box flexDirection="column" alignItems="center">
      {ASCII_STAR.split('\n').map((line, i) => (
        <Text key={i} color={animatedColor as keyof Theme} wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  );
}

function AppleTerminalStar({ pose, animatedColor }: { pose: StarPose; animatedColor: string }): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      {ASCII_STAR.split('\n').map((line, i) => (
        <Text key={i} color={animatedColor as keyof Theme} wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  );
}
