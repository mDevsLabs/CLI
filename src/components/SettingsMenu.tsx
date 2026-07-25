import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { loadSettings, saveSettings, getCustomProviders, type OpenAgentSettings } from "../config/settings.js";
import { getAllProviders, getProvider } from "../providers/index.js";
import { getProjectFiles } from "../utils/fileAutocomplete.js";

interface SettingsMenuProps {
  onClose: () => void;
}

type Step =
  | "main"
  | "provider"
  | "model"
  | "instructions-type"
  | "instructions-text"
  | "instructions-file"
  | "ignored-dirs"
  | "channel"
  | "default-mode";

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const [settings, setSettingsState] = useState<OpenAgentSettings>(() => loadSettings());
  const [step, setStep] = useState<Step>("main");
  const [selectedProvider, setSelectedProvider] = useState<string>(settings.provider || "openai");
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
      }`,
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
    if (item.value === "provider") {
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

  const providers = getAllProviders();
  const providerItems = providers.map((p) => ({ label: p.config.name, value: p.config.id }));

  const handleProviderSelect = (item: { value: string }) => {
    setSelectedProvider(item.value);
    setStep("model");
  };

  const currentProviderObj = getProvider(selectedProvider);
  const modelItems = (currentProviderObj?.config.models || []).map((m: { id: string; name: string }) => ({
    label: m.name,
    value: m.id,
  }));

  const handleModelSelect = (item: { value: string }) => {
    const updated = { ...settings, provider: selectedProvider, model: item.value };
    saveSettings(updated);
    setSettingsState(updated);
    setStep("main");
  };

  const instructionTypeItems = [
    { label: "Direct Text (Max 1000 chars)", value: "text" },
    { label: "File Path (From project directory)", value: "file" },
    { label: "Clear Instructions", value: "clear" },
  ];

  const handleInstructionTypeSelect = (item: { value: string }) => {
    if (item.value === "text") {
      setStep("instructions-text");
    } else if (item.value === "file") {
      setStep("instructions-file");
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

      {step === "provider" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select Provider:</Text>
          </Box>
          <SelectInput items={providerItems} onSelect={handleProviderSelect} />
        </Box>
      )}

      {step === "model" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select Model for {selectedProvider}:</Text>
          </Box>
          <SelectInput items={modelItems} onSelect={handleModelSelect} />
        </Box>
      )}

      {step === "instructions-type" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Custom Instructions Type:</Text>
          </Box>
          <SelectInput items={instructionTypeItems} onSelect={handleInstructionTypeSelect} />
        </Box>
      )}

      {step === "default-mode" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select Default Working Mode:</Text>
          </Box>
          <SelectInput
            items={[
              { label: "Standard (Default formatting, standard prompt)", value: "standard" },
              { label: "Plan (Architectural mode, creates plans and tasks)", value: "plan" },
              { label: "Turbo (Fast output, no reasoning shown)", value: "turbo" },
              { label: "Terminal (No markdown, plain CLI interface)", value: "terminal" },
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
