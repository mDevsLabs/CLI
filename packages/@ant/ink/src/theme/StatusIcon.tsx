import figures from 'figures';
import React from 'react';
import { Text } from '../index.js';

type Status = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'loading';

type Props = {
  /**
   * The status to display. Determines both the icon and color.
   *
   * - `success`: Green checkmark (✓)
   * - `error`: Red cross (✗)
   * - `warning`: Warning mark (!)
   * - `info`: Info mark (i)
   * - `pending`: Dimmed circle (○)
   * - `loading`: Dimmed ellipsis (…)
   */
  status: Status;
  /**
   * Include a trailing space after the icon. Useful when followed by text.
   * @default false
   */
  withSpace?: boolean;
};

const STATUS_CONFIG: Record<
  Status,
  {
    icon: string;
    color: 'success' | 'error' | 'warning' | 'suggestion' | undefined;
  }
> = {
  success: { icon: '✓', color: 'success' },
  error: { icon: '✗', color: 'error' },
  warning: { icon: '!', color: 'warning' },
  info: { icon: 'i', color: 'suggestion' },
  pending: { icon: figures.circle, color: undefined },
  loading: { icon: '…', color: undefined },
};

/**
 * Renders a status indicator icon with appropriate color.
 *
 * @example
 * // Success indicator
 * <StatusIcon status="success" />
 *
 * @example
 * // Error with trailing space for text
 * <Text><StatusIcon status="error" withSpace />Failed to connect</Text>
 *
 * @example
 * // Status line pattern
 * <Text>
 *   <StatusIcon status="pending" withSpace />
 *   Waiting for response
 * </Text>
 */
export function StatusIcon({ status, withSpace = false }: Props): React.ReactNode {
  const config = STATUS_CONFIG[status];

  return (
    <Text color={config.color} dimColor={!config.color}>
      {config.icon}
      {withSpace && ' '}
    </Text>
  );
}
