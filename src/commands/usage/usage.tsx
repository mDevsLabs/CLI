import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from '@anthropic/ink';
import type { Theme } from '@anthropic/ink';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { updateSettingsForSource } from '../../utils/settings/settings.js';

interface UsageData {
  tier: string;
  email: string;
  username: string;
  tokensUsed: number;
  limit: number;
  weekStart: string;
  resetAt: string;
}

function UsageScreen({ onDone }: { onDone: () => void }) {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'upgrade' | 'processing'>('view');
  const [code, setCode] = useState('');
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'upgrade') setMode('view');
      else onDone();
      return;
    }

    if (mode === 'view') {
      if (input.toLowerCase() === 'y') {
        setMode('upgrade');
        setCode('');
        setUpgradeMsg(null);
      } else if (input.toLowerCase() === 'n' || key.return) {
        onDone();
      }
    } else if (mode === 'upgrade') {
      if (key.return) {
        handleUpgrade(code);
      } else if (key.backspace || key.delete) {
        setCode(prev => prev.slice(0, -1));
      } else if (input.length === 1 && !key.ctrl && !key.meta) {
        setCode(prev => prev + input);
      }
    }
  });

  const handleUpgrade = async (inputCode: string) => {
    if (!inputCode.trim()) return;
    setMode('processing');
    try {
      const token =
        process.env.MAI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.MAI_TOKEN;
      const res = await fetch('https://mai.val.run/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-mai-token': token,
          'x-api-key': token,
        },
        body: JSON.stringify({ code: inputCode }),
      });

      const json = await res.json();
      if (json.success) {
        setUpgradeMsg('Plan successfully updated!');
        // Refresh data
        setTimeout(() => {
          setMode('view');
          setLoading(true);
          fetchData();
        }, 1500);
      } else {
        setUpgradeMsg(json.error || 'Invalid code.');
        setTimeout(() => setMode('upgrade'), 2000);
      }
    } catch (err) {
      setUpgradeMsg('Network error.');
      setTimeout(() => setMode('upgrade'), 2000);
    }
  };

  const fetchData = async () => {
    const token =
      process.env.MAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.MAI_TOKEN;
    if (!token) {
      setError('Not authenticated. Please run /login first.');
      setLoading(false);
      return;
    }
    let res = await fetch('https://mai.val.run/v1/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-mai-token': token,
        'x-api-key': token,
      },
    });
    if (res.status === 404) {
      res = await fetch('https://mai.val.run/usage', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-mai-token': token,
          'x-api-key': token,
        },
      });
    }
    if (res.ok) {
      const json = await res.json();
      if (!json.error) setData(json);
      else setError(json.error);
    } else {
      setError('Failed to fetch usage data from server.');
    }
    setLoading(false);
  };

  if (loading)
    return (
      <Box padding={1}>
        <Text>Loading usage data...</Text>
      </Box>
    );
  if (error)
    return (
      <Box padding={1}>
        <Text color={'red' as keyof Theme}>{error}</Text>
      </Box>
    );
  if (!data)
    return (
      <Box padding={1}>
        <Text>No data available.</Text>
      </Box>
    );

  const percent = data.limit > 0 ? Math.min(100, Math.max(0, Math.round((data.tokensUsed / data.limit) * 100))) : 0;
  const barWidth = 30;
  const filled = Math.min(barWidth, Math.max(0, Math.round((percent / 100) * barWidth)));
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  let resetStr = 'Unknown';
  if (data.resetAt) {
    const resetDate = new Date(data.resetAt);
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      resetStr = `${days} days, ${hours} hours`;
    } else {
      resetStr = 'Now';
    }
  }

  return (
    <Box flexDirection="column" padding={1} paddingLeft={2}>
      <Box marginBottom={1}>
        <Text bold>Plan: </Text>
        <Text color={'cyan' as keyof Theme}>{data.tier.toUpperCase()}</Text>
      </Box>

      <Box>
        <Text>Tokens: </Text>
        <Text>
          {data.tokensUsed.toLocaleString()} / {data.limit.toLocaleString()}{' '}
        </Text>
        <Text color={(percent >= 90 ? 'red' : percent >= 75 ? 'yellow' : 'green') as keyof Theme}>({percent}%)</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={(percent >= 90 ? 'red' : percent >= 75 ? 'yellow' : 'green') as keyof Theme}>[{bar}]</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Reset in: </Text>
        <Text color={'yellow' as keyof Theme}>{resetStr}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {mode === 'view' && (
          <>
            <Text bold>Do you want to update your plan?</Text>
            <Text> [N/Enter] No</Text>
            <Text> [Y] Yes, Update the plan (Enter a code)</Text>
          </>
        )}

        {mode === 'upgrade' && (
          <Box flexDirection="column">
            <Text bold color={'cyan' as keyof Theme}>
              Enter your upgrade code:
            </Text>
            <Box>
              <Text>
                {'> '} {code}
              </Text>
            </Box>
            {upgradeMsg && <Text color={'red' as keyof Theme}>{upgradeMsg}</Text>}
            <Text color={'gray' as keyof Theme}>(Press Enter to submit, ESC to cancel)</Text>
          </Box>
        )}

        {mode === 'processing' && <Text color={'yellow' as keyof Theme}>Processing upgrade... {upgradeMsg}</Text>}
      </Box>
    </Box>
  );
}

export const call: LocalJSXCommandCall = async (onDone, _context) => {
  return <UsageScreen onDone={onDone} />;
};
