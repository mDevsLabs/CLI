import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from '@anthropic/ink';
import { Dialog } from '@anthropic/ink';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { isSkillSearchEnabled } from '../../services/skillSearch/featureCheck.js';

type SkillSearchAction = {
  label: string;
  description: string;
  run: () => Promise<string>;
};

const ACTION_LABEL_COLUMN_WIDTH = 28;

const ABOUT_TEXT = `# Skill Search (Automatic Skill Matching)

Skill Search controls automatic skill matching during conversations.

When enabled, mAI CLI automatically searches and loads the most relevant skill files for the current task each turn, without manual specification. Search is based on TF-IDF vector cosine similarity, supporting English stemming and CJK bi-gram tokenization.

## How It Works
1. At the start of a conversation, automatically indexes Markdown files under .claude/skills/ and ~/.claude/skills/
2. Each turn automatically matches the most relevant skill based on context
3. Matched skill content is injected as context to guide mAI CLI behavior

## Controls
- /skill-search start  — Enable automatic matching
- /skill-search stop   — Disable automatic matching
- /skill-search status — View current status

Current status: ${isSkillSearchEnabled() ? 'enabled' : 'disabled'}
`;

function getStatusText(): string {
  return [
    'Skill Search (Automatic Skill Matching)',
    `Status: ${isSkillSearchEnabled() ? 'enabled' : 'disabled'}`,
    '',
    'When enabled, relevant skills are automatically matched and',
    'injected into conversation context each turn.',
  ].join('\n');
}

async function startSkillSearch(): Promise<string> {
  if (isSkillSearchEnabled() && process.env.SKILL_SEARCH_ENABLED !== '0') {
    return 'Skill Search: already enabled';
  }

  process.env.SKILL_SEARCH_ENABLED = '1';
  const lines = ['Skill Search: enabled (SKILL_SEARCH_ENABLED=1)'];

  try {
    const { clearSkillIndexCache } = await import('../../services/skillSearch/localSearch.js');
    clearSkillIndexCache();
    lines.push('Skill index cache: cleared (will rebuild on next search)');
  } catch {
    lines.push('Skill index cache: clear skipped');
  }

  return lines.join('\n');
}

async function stopSkillSearch(): Promise<string> {
  if (!isSkillSearchEnabled()) {
    return 'Skill Search: already disabled';
  }
  process.env.SKILL_SEARCH_ENABLED = '0';
  return 'Skill Search: disabled (SKILL_SEARCH_ENABLED=0)';
}

function SkillSearchPanel({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  useRegisterOverlay('skill-search-panel');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = useMemo<SkillSearchAction[]>(
    () => [
      {
        label: 'Status',
        description: 'Show whether automatic skill matching is active',
        run: () => Promise.resolve(getStatusText()),
      },
      {
        label: 'Start',
        description: 'Enable automatic skill matching for this session',
        run: startSkillSearch,
      },
      {
        label: 'Stop',
        description: 'Disable automatic skill matching for this session',
        run: stopSkillSearch,
      },
      {
        label: 'About',
        description: 'How automatic skill matching works',
        run: () => Promise.resolve(ABOUT_TEXT),
      },
    ],
    [],
  );

  const selectCurrent = () => {
    const action = actions[selectedIndex];
    if (!action) return;
    void action.run().then(result => {
      onDone(result, { display: 'system' });
    });
  };

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(index => Math.max(0, index - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(index => Math.min(actions.length - 1, index + 1));
      return;
    }
    if (key.return) {
      selectCurrent();
    }
  });

  return (
    <Dialog
      title="Skill Search"
      subtitle={`${actions.length} actions`}
      onCancel={() => onDone('Skill search panel dismissed', { display: 'system' })}
      color="background"
      hideInputGuide
    >
      <Box flexDirection="column">
        {actions.map((action, index) => (
          <Box key={action.label} flexDirection="row">
            <Text>{`${index === selectedIndex ? '›' : ' '} ${action.label}`.padEnd(ACTION_LABEL_COLUMN_WIDTH)}</Text>
            <Text dimColor>{action.description}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>↑/↓ select · Enter run · Esc close</Text>
        </Box>
      </Box>
    </Dialog>
  );
}

export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  const trimmed = args?.trim() ?? '';

  if (trimmed === 'start') {
    onDone(await startSkillSearch(), { display: 'system' });
    return null;
  }
  if (trimmed === 'stop') {
    onDone(await stopSkillSearch(), { display: 'system' });
    return null;
  }
  if (trimmed === 'about') {
    onDone(ABOUT_TEXT, { display: 'system' });
    return null;
  }
  if (trimmed === 'status') {
    onDone(getStatusText(), { display: 'system' });
    return null;
  }

  return <SkillSearchPanel onDone={onDone} />;
}
