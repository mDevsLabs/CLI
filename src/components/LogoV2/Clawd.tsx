import * as React from 'react';
import { Star, type StarPose } from './Star.js';

export type ClawdPose = StarPose;

type Props = {
  pose?: ClawdPose;
};

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  return <Star pose={pose} />;
}
