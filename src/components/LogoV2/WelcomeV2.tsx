import React from 'react';
import { Box, Text, useTheme, useAnimationFrame } from '@anthropic/ink';
import type { Theme } from '@anthropic/ink';
import { intensityToColor } from '../EffortPanel/rippleAnimation.js';

const ASCII_STAR = `          ★          
        ✦ ✧ ✦        
      ✦ ✧ ▲ ✧ ✦      
    ★ ✧ █ ✪ █ ✧ ★    
      ✦ ✧ ▼ ✧ ✦      
        ✦ ✧ ✦        
          ★          `;

export function WelcomeV2(): React.ReactNode {
  const [theme] = useTheme();
  const welcomeMessage = 'Welcome to mAI CLI';
  const [, time] = useAnimationFrame(80);
  const intensity = ((Math.sin(time / 300) + 1) / 2) * 0.6 + 0.4;
  const animatedBlue = intensityToColor(intensity, 0);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="claude">{welcomeMessage} </Text>
        <Text dimColor>v{MACRO.VERSION} </Text>
      </Text>
      <Box flexDirection="column" alignItems="center">
        {ASCII_STAR.split('\n').map((line, i) => (
          <Text key={i} color={animatedBlue as keyof Theme} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
