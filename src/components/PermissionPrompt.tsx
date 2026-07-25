import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type PermissionDecision = "allow" | "deny" | "always-allow";

interface PermissionPromptProps {
  toolName: string;
  description: string;
  onDecide: (decision: PermissionDecision) => void;
}

const OPTIONS: { label: string; key: string; value: PermissionDecision }[] = [
  { label: "Allow once", key: "y", value: "allow" },
  { label: "Deny", key: "n", value: "deny" },
  { label: `Always allow this tool`, key: "a", value: "always-allow" },
];

export function PermissionPrompt({ toolName, description, onDecide }: PermissionPromptProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    const lower = input.toLowerCase();
    if (lower === "y") { onDecide("allow"); return; }
    if (lower === "n") { onDecide("deny"); return; }
    if (lower === "a") { onDecide("always-allow"); return; }
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(OPTIONS.length - 1, c + 1));
    if (key.return) onDecide(OPTIONS[cursor].value);
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color="yellow">⚠  Permission required</Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Tool:        </Text>
          <Text bold>{toolName}</Text>
        </Box>
        {description && (
          <Box>
            <Text dimColor>Action:      </Text>
            <Text>{description}</Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {OPTIONS.map((opt, i) => {
          const active = i === cursor;
          return (
            <Box key={opt.value}>
              <Text color={active ? "cyan" : undefined} bold={active}>
                {active ? "❯ " : "  "}
              </Text>
              <Text color={active ? "cyan" : "white"} bold={active}>
                [{opt.key.toUpperCase()}] {opt.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ or Y / N / A  ·  Enter to confirm</Text>
      </Box>
    </Box>
  );
}
