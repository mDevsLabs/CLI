import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { getAllProviders } from "../providers/index.js";
import { loadSettings } from "../config/settings.js";
import { PaginatedSelect, type PaginatedItem } from "./PaginatedSelect.js";

interface ModelSelectorProps {
  initialSearch?: string;
  onComplete: (providerId: string, modelId: string) => void;
  onCancel: () => void;
  isSettingsMenu?: boolean;
}

export function ModelSelector({ initialSearch, onComplete, onCancel, isSettingsMenu }: ModelSelectorProps) {
  const settings = loadSettings();
  const allProviders = getAllProviders();
  const [searchQuery, setSearchQuery] = useState(initialSearch || "");

  const items = useMemo<PaginatedItem<{ providerId: string; modelId: string }>[]>(() => {
    const list: PaginatedItem<{ providerId: string; modelId: string }>[] = [];
    for (const p of allProviders) {
      if (p.config.models.length === 0) continue;
      for (const m of p.config.models) {
        const isCurrent = p.config.id === settings.provider && m.id === settings.model;
        list.push({
          label: m.name,
          category: p.config.name,
          value: { providerId: p.config.id, modelId: m.id },
          isCurrent,
          description: `${Math.round(m.contextWindow / 1000)}k ctx`,
        });
      }
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(m => m.label.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q));
    }
    return list;
  }, [allProviders, settings, searchQuery]);

  const initialIdx = useMemo(() => {
    const idx = items.findIndex((it) => it.isCurrent);
    return idx >= 0 ? idx : 0;
  }, [items]);

  return (
    <Box flexDirection="column" paddingLeft={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Select a model </Text>
        {isSettingsMenu ? (
          <Text dimColor>(This will be your default model)</Text>
        ) : (
          <Text dimColor>(session only — use /settings to change the default)</Text>
        )}
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <TextInput value={searchQuery} onChange={setSearchQuery} placeholder="Type to filter..." />
      </Box>

      <PaginatedSelect
        items={items}
        pageSize={5}
        initialIndex={initialIdx}
        onSelect={(item) => onComplete(item.value.providerId, item.value.modelId)}
        onCancel={onCancel}
      />

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  ·  Enter select  ·  Esc cancel</Text>
      </Box>
    </Box>
  );
}
