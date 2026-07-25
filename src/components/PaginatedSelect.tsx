import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";

export interface PaginatedItem<T = any> {
  key?: string;
  label: string;
  value: T;
  category?: string;
  description?: string;
  isCurrent?: boolean;
  isRecommended?: boolean;
  badge?: string;
}

interface PaginatedSelectProps<T = any> {
  items: PaginatedItem<T>[];
  pageSize?: number;
  initialIndex?: number;
  onSelect: (item: PaginatedItem<T>) => void;
  onCancel?: () => void;
}

export function PaginatedSelect<T = any>({
  items,
  pageSize = 5,
  initialIndex = 0,
  onSelect,
  onCancel,
}: PaginatedSelectProps<T>) {
  const total = items.length;
  const safeInitial = Math.max(0, Math.min(initialIndex, total > 0 ? total - 1 : 0));
  const [cursor, setCursor] = useState(safeInitial);
  const [windowStart, setWindowStart] = useState(() => {
    return Math.max(0, Math.min(safeInitial - 2, Math.max(0, total - pageSize)));
  });

  useEffect(() => {
    setCursor((prev) => Math.max(0, Math.min(prev, total > 0 ? total - 1 : 0)));
  }, [total]);

  useEffect(() => {
    if (cursor < windowStart) {
      setWindowStart(cursor);
    } else if (cursor >= windowStart + pageSize) {
      setWindowStart(cursor - pageSize + 1);
    }
  }, [cursor, windowStart, pageSize]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      return;
    }
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : total > 0 ? total - 1 : 0));
    }
    if (key.downArrow) {
      setCursor((prev) => (prev < total - 1 ? prev + 1 : 0));
    }
    if (key.pageUp) {
      setCursor((prev) => Math.max(0, prev - pageSize));
    }
    if (key.pageDown) {
      setCursor((prev) => Math.min(total - 1, prev + pageSize));
    }
    if (key.return) {
      if (items[cursor]) {
        onSelect(items[cursor]);
      }
    }
  });

  if (total === 0) {
    return (
      <Box paddingLeft={2}>
        <Text dimColor>No items to display</Text>
      </Box>
    );
  }

  const clampedWindowStart = Math.max(0, Math.min(windowStart, Math.max(0, total - pageSize)));
  const visibleItems = items.slice(clampedWindowStart, clampedWindowStart + pageSize);
  const moreAbove = clampedWindowStart;
  const moreBelow = total - (clampedWindowStart + visibleItems.length);

  return (
    <Box flexDirection="column">
      {moreAbove > 0 ? (
        <Box paddingLeft={2}>
          <Text color="gray">  (↑ {moreAbove} More)</Text>
        </Box>
      ) : (
        <Box paddingLeft={2}>
          <Text> </Text>
        </Box>
      )}

      {visibleItems.map((item, idx) => {
        const itemIdx = clampedWindowStart + idx;
        const isSelected = itemIdx === cursor;

        return (
          <Box key={item.key || `${item.label}-${itemIdx}`} paddingLeft={2}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
            </Text>
            {item.category && (
              <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
                [{item.category}]{" "}
              </Text>
            )}
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {item.label}
            </Text>
            {item.badge && <Text color="yellow" bold={isSelected}> {item.badge}</Text>}
            {item.isCurrent && <Text color="green" bold={isSelected}>  ✓ (active)</Text>}
            {item.isRecommended && <Text color="gray" bold={isSelected}>  (recommended)</Text>}
            {item.description && <Text color="gray" bold={isSelected}> — {item.description}</Text>}
          </Box>
        );
      })}

      {moreBelow > 0 ? (
        <Box paddingLeft={2}>
          <Text color="gray">  (↓ {moreBelow} More)</Text>
        </Box>
      ) : (
        <Box paddingLeft={2}>
          <Text> </Text>
        </Box>
      )}
    </Box>
  );
}
