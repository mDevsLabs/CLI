import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { loadSettings, saveSettings, getCustomProviders, type OpenAgentSettings } from "../config/settings.js";
import { getAllProviders, getProvider } from "../providers/index.js";
import { getProjectFiles } from "../utils/fileAutocomplete.js";
import { AI_LANGUAGES, getLanguageLabel } from "../utils/systemPrompt.js";
import { PaginatedSelect } from "./PaginatedSelect.js";
import { ModelSelector } from "./ModelSelector.js";
import { AccountMenu } from "./AccountMenu.js";
import { loadAuthState, type AuthState } from "../services/authStore.js";

interface SettingsMenuProps {
  onClose: () => void;
}

type Step =
  | "main"
  | "account"
  | "provider"
  | "instructions-type"
  | "instructions-text"
  | "instructions-file"
  | "instructions-language"
  | "ignored-dirs"
  | "channel"
  | "default-mode";

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const [settings, setSettingsState] = useState<OpenAgentSettings>(() => loadSettings());
  const [authState, setAuthState] = useState<AuthState>(() => loadAuthState());
  const [step, setStep] = useState<Step>("main");
  const [customText, setCustomText] = useState<string>(settings.customInstructionsText || "");
  const [filePath, setFilePath] = useState<string>(settings.customInstructionsFilePath || "");
  const [ignoredInput, setIgnoredInput] = useState<string>((settings.ignoredDirectories || []).join(", "));

  useInput((_input, key) => {
    if (key.escape) {
      if (step === "main") {
        onClose();
      } else {
        setStep("main");
      }
    }
  });

  const mainItems = [
    ...(authState.email ? [{
      label: `👤 Mon Compte (${authState.email})`,
      value: "account",
    }] : []),
    {
      label: `Default Provider & Model: ${settings.provider || "Not set"} / ${settings.model || "Not set"}`,
      value: "provider",
    },
    {
      label: `Default Working Mode: ${settings.defaultPermissionMode || "standard"}`,
      value: "default-mode",
    },
    {
      label: `Custom Providers: ${
        (settings.customProviders ?? []).length > 0
          ? `${settings.customProviders!.length} configured`
          : "None"
      }`,
      value: "custom-providers",
    },
    {
      label: `Custom Instructions: ${
        settings.customInstructionsType === "text"
          ? `Text (${(settings.customInstructionsText || "").length} chars)`
          : settings.customInstructionsType === "file"
          ? `File (${settings.customInstructionsFilePath || ""})`
          : "None"
      } · Lang: ${getLanguageLabel(settings.aiLanguage)}`,
      value: "instructions",
    },
    {
      label: `Ignored Folders for @: ${
        (settings.ignoredDirectories || []).length > 0
          ? settings.ignoredDirectories!.join(", ")
          : "Default (node_modules, .git, dist, build)"
      }`,
      value: "ignored-dirs",
    },
    {
      label: `Update Channel: ${settings.updateChannel === "canary" ? "Canary" : "Stable"}`,
      value: "channel",
    },
    { label: "Exit Settings", value: "exit" },
  ];

  const handleMainSelect = (item: { value: string }) => {
    if (item.value === "account") {
      setStep("account" as any);
    } else if (item.value === "provider") {
      setStep("provider");
    } else if (item.value === "custom-providers") {
      // Signal to REPL to open ProviderManager
      onClose();
      // We close and rely on /provider command to open ProviderManager
      // (settings menu can't nest provider manager without major refactor)
    } else if (item.value === "instructions") {
      setStep("instructions-type");
    } else if (item.value === "ignored-dirs") {
      setStep("ignored-dirs");
    } else if (item.value === "channel") {
      setStep("channel");
    } else if (item.value === "default-mode") {
      setStep("default-mode");
    } else if (item.value === "exit") {
      onClose();
    }
  };

  const instructionTypeItems = [
    { label: "Direct Text (Max 1000 chars)", value: "text" },
    { label: "File Path (From project directory)", value: "file" },
    {
      label: `AI Spoken Language: ${getLanguageLabel(settings.aiLanguage)}`,
      value: "language",
    },
    { label: "Clear Instructions", value: "clear" },
  ];

  const handleInstructionTypeSelect = (item: { value: string }) => {
    if (item.value === "text") {
      setStep("instructions-text");
    } else if (item.value === "file") {
      setStep("instructions-file");
    } else if (item.value === "language") {
      setStep("instructions-language");
    } else if (item.value === "clear") {
      const updated = {
        ...settings,
        customInstructionsType: undefined,
        customInstructionsText: undefined,
        customInstructionsFilePath: undefined,
      };
      saveSettings(updated);
      setSettingsState(updated);
      setStep("main");
    }
  };

  const languageItems = AI_LANGUAGES.map((l) => ({
    label: l.code === "auto"
      ? `${l.name}  ← default`
      : `${l.name} (${l.nativeName})`,
    value: l.code,
    isCurrent: (settings.aiLanguage || "auto") === l.code,
  }));

  const handleLanguageSelect = (item: { value: string }) => {
    const updated: OpenAgentSettings = {
      ...settings,
      aiLanguage: item.value === "auto" ? undefined : item.value,
    };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  const handleTextSubmit = (value: string) => {
    const truncated = value.slice(0, 1000);
    const updated: OpenAgentSettings = {
      ...settings,
      customInstructionsType: "text",
      customInstructionsText: truncated,
      customInstructionsFilePath: undefined,
    };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  const handleFileSubmit = (value: string) => {
    const updated: OpenAgentSettings = {
      ...settings,
      customInstructionsType: "file",
      customInstructionsFilePath: value.trim(),
      customInstructionsText: undefined,
    };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  const handleIgnoredSubmit = (value: string) => {
    const dirs = value
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const updated: OpenAgentSettings = {
      ...settings,
      ignoredDirectories: dirs,
    };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  const channelItems = [
    { label: "Stable (Default release branch)", value: "stable" },
    { label: "Canary (Bleeding edge development branch)", value: "canary" },
  ];

  const handleChannelSelect = (item: { value: string }) => {
    const updated: OpenAgentSettings = {
      ...settings,
      updateChannel: item.value as "stable" | "canary",
    };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  return (
    <Box flexDirection="column"  padding={1} marginY={1}>
      <Text color="cyan" bold>
        ⚙️ mAI CLI Settings
      </Text>
      <Text dimColor>Press ESC to return / back</Text>
      <Box marginTop={1} />

      {step === "main" && (
        <SelectInput items={mainItems} onSelect={handleMainSelect} />
      )}

      {step === "account" && (
        <AccountMenu 
          authState={authState} 
          onBack={() => setStep("main")} 
          onUpdate={setAuthState} 
        />
      )}

      {step === "provider" && (
        <ModelSelector
          isSettingsMenu={true}
          onComplete={(providerId, modelId) => {
            const updated = { ...settings, provider: providerId, model: modelId };
            saveSettings(updated);
            setSettingsState(updated);
            setStep("main");
          }}
          onCancel={() => setStep("main")}
        />
      )}

      {step === "instructions-type" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Custom Instructions:</Text>
          </Box>
          <SelectInput items={instructionTypeItems} onSelect={handleInstructionTypeSelect} />
        </Box>
      )}

      {step === "instructions-language" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>AI Spoken Language:</Text>
          </Box>
          <Text dimColor>
            Default follows the language of the user prompt. A fixed language adds a system instruction.
          </Text>
          <Box marginTop={1} />
          <PaginatedSelect
            items={languageItems}
            pageSize={10}
            initialIndex={Math.max(
              0,
              AI_LANGUAGES.findIndex((l) => l.code === (settings.aiLanguage || "auto"))
            )}
            onSelect={(item) => handleLanguageSelect({ value: item.value })}
            onCancel={() => setStep("instructions-type")}
          />
        </Box>
      )}

      {step === "default-mode" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select Default Working Mode:</Text>
          </Box>
          <SelectInput
            items={[
              { label: "Standard — ask before writes, shell, and side effects", value: "standard" },
              { label: "Plan — read-only planning (explore + design, no execution)", value: "plan" },
              { label: "Turbo — full autonomy, all tools & commands auto-approved", value: "turbo" },
              { label: "Terminal — direct shell prompt, no AI", value: "terminal" },
            ]}
            onSelect={(item) => {
              const updated = loadSettings();
              updated.defaultPermissionMode = item.value as any;
              saveSettings(updated);
              setSettingsState(updated);
              setStep("main");
            }}
          />
        </Box>
      )}

      {step === "instructions-text" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Enter Custom Instructions (Max 1000 chars):</Text>
          </Box>
          <Text dimColor>Chars: {customText.length}/1000</Text>
          <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
            <TextInput
              value={customText}
              onChange={(val) => setCustomText(val.slice(0, 1000))}
              onSubmit={handleTextSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "instructions-file" && (() => {
        const matches = getProjectFiles(process.cwd(), filePath);
        const fileItems = matches.slice(0, 10).map((f) => ({ label: f, value: f }));
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>Search & Select Instructions File:</Text>
            </Box>
            <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
              <TextInput
                value={filePath}
                onChange={setFilePath}
                onSubmit={(val) => {
                  if (val.trim()) handleFileSubmit(val);
                }}
                placeholder="Type file name to search..."
              />
            </Box>
            {fileItems.length > 0 ? (
              <SelectInput
                items={fileItems}
                onSelect={(item) => handleFileSubmit(item.value)}
              />
            ) : (
              <Text dimColor>No matching files found. Press Enter to submit custom path.</Text>
            )}
          </Box>
        );
      })()}

      {step === "ignored-dirs" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Ignored Folders for @ Autocomplete (comma-separated):</Text>
          </Box>
          <Text dimColor>Example: temp, coverage, .cache (node_modules, .git, dist, build are ignored by default)</Text>
          <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
            <TextInput
              value={ignoredInput}
              onChange={setIgnoredInput}
              onSubmit={handleIgnoredSubmit}
              placeholder="e.g. dist, build, temp, .cache"
            />
          </Box>
        </Box>
      )}

      {step === "channel" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select Update Channel:</Text>
          </Box>
          <SelectInput items={channelItems} onSelect={handleChannelSelect} />
        </Box>
      )}
    </Box>
  );
};
