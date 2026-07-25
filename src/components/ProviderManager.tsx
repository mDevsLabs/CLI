import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import {
  loadSettings,
  saveSettings,
  getCustomProviders,
  addCustomProvider,
  removeCustomProvider,
  addModelToCustomProvider,
} from "../config/settings.js";
import { getAllProviders, getProvider } from "../providers/index.js";
import { randomUUID } from "node:crypto";
import { PaginatedSelect, type PaginatedItem } from "./PaginatedSelect.js";

interface ProviderManagerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

type Step =
  | "main"
  | "configure-provider"
  | "edit-apikey"
  | "add-model"
  | "custom-add-name"
  | "custom-add-sdk"
  | "custom-add-url"
  | "custom-add-key"
  | "custom-add-model-id"
  | "custom-add-model-name"
  | "custom-add-more"
  | "custom-done"
  | "remove-confirm";

const SDK_OPTIONS: PaginatedItem<"openai" | "anthropic" | "google">[] = [
  { label: "OpenAI (compatible API)", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google", value: "google" },
];

export function ProviderManager({ onComplete, onCancel }: ProviderManagerProps) {
  const [step, setStep] = useState<Step>("main");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [error, setError] = useState("");

  // Custom provider wizard state
  const [cpName, setCpName] = useState("");
  const [cpSdk, setCpSdk] = useState<"openai" | "anthropic" | "google">("openai");
  const [cpUrl, setCpUrl] = useState("");
  const [cpKey, setCpKey] = useState("");
  const [cpModels, setCpModels] = useState<Array<{ id: string; name: string }>>([]);
  const [cpTempModelId, setCpTempModelId] = useState("");
  const [cpTempModelName, setCpTempModelName] = useState("");

  const allProviders = getAllProviders();
  const customProviders = getCustomProviders();
  const settings = loadSettings();

  useInput((_input, key) => {
    if (key.escape) {
      if (step === "main") { onCancel(); return; }
      setStep("main");
      setError("");
    }
  });

  // ─── Main menu ───────────────────────────────────────────────────────────────
  if (step === "main") {
    const items: PaginatedItem<string>[] = [
      ...allProviders.map((p) => ({
        label: p.config.name,
        value: p.config.id,
        isCurrent: p.config.id === settings.provider,
        description: p.config.description,
      })),
      { label: "+ Add custom provider", value: "__add_custom__" },
      { label: "Exit", value: "__exit__" },
    ];

    const initialIdx = items.findIndex((it) => it.value === settings.provider);

    const handleMainSelect = (item: PaginatedItem<string>) => {
      if (item.value === "__exit__") { onCancel(); return; }
      if (item.value === "__add_custom__") {
        setCpName(""); setCpUrl(""); setCpKey(""); setCpModels([]);
        setStep("custom-add-name");
        return;
      }
      setSelectedProviderId(item.value);
      setStep("configure-provider");
    };

    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">⚡ Provider Manager</Text>
        <Text dimColor>Configure providers, API keys and models</Text>
        <Box marginTop={1} />
        <PaginatedSelect
          items={items}
          pageSize={5}
          initialIndex={initialIdx >= 0 ? initialIdx : 0}
          onSelect={handleMainSelect}
          onCancel={onCancel}
        />
        <Box marginTop={1}>
          <Text dimColor>↑↓ navigate  ·  Enter select  ·  Esc close</Text>
        </Box>
      </Box>
    );
  }

  // ─── Configure a specific provider ───────────────────────────────────────────
  if (step === "configure-provider") {
    const provider = getProvider(selectedProviderId);
    if (!provider) { setStep("main"); return null; }

    const isCustom = customProviders.some((c) => c.id === selectedProviderId);
    const items: PaginatedItem<string>[] = [
      { label: "Set as default provider", value: "set-default" },
      { label: `Change API key${isCustom ? " / URL" : ""}`, value: "edit-key" },
      { label: "Add model", value: "add-model" },
      ...(isCustom ? [{ label: "Remove this provider", value: "remove" }] : []),
      { label: "← Back", value: "back" },
    ];

    const currentKey = settings.apiKey && settings.provider === selectedProviderId
      ? "••••••••" + settings.apiKey.slice(-4)
      : "Not set";

    const handleConfigSelect = (item: PaginatedItem<string>) => {
      if (item.value === "back") { setStep("main"); return; }
      if (item.value === "set-default") {
        const updated = loadSettings();
        updated.provider = selectedProviderId;
        updated.model = provider.config.defaultModel || provider.config.models[0]?.id || "";
        saveSettings(updated);
        onComplete(updated.provider, updated.model);
        return;
      }
      if (item.value === "edit-key") {
        setApiKeyInput("");
        setStep("edit-apikey");
        return;
      }
      if (item.value === "add-model") {
        setNewModelId(""); setNewModelName("");
        setStep("add-model");
        return;
      }
      if (item.value === "remove") {
        setStep("remove-confirm");
        return;
      }
    };

    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">{provider.config.name}</Text>
        <Box marginTop={1} flexDirection="column">
          <Box><Text dimColor>Category: </Text><Text>{provider.config.category}</Text></Box>
          <Box><Text dimColor>API Key:  </Text><Text>{currentKey}</Text></Box>
          <Box><Text dimColor>Models:   </Text><Text>{provider.config.models.length} available</Text></Box>
          <Box><Text dimColor>Default:  </Text><Text>{provider.config.defaultModel || "—"}</Text></Box>
        </Box>
        <Box marginTop={1} />
        <PaginatedSelect items={items} pageSize={5} onSelect={handleConfigSelect} onCancel={() => setStep("main")} />
        {error && <Text color="red">{error}</Text>}
      </Box>
    );
  }

  // ─── Edit API key ─────────────────────────────────────────────────────────────
  if (step === "edit-apikey") {
    const provider = getProvider(selectedProviderId);
    const handleKeySubmit = () => {
      if (!apiKeyInput.trim()) { setError("API key cannot be empty"); return; }
      const updated = loadSettings();
      if (selectedProviderId === settings.provider) {
        updated.apiKey = apiKeyInput.trim();
      }
      const idx = (updated.customProviders ?? []).findIndex((c) => c.id === selectedProviderId);
      if (idx >= 0) {
        updated.customProviders![idx].apiKey = apiKeyInput.trim();
      }
      saveSettings(updated);
      setError("");
      setStep("configure-provider");
    };

    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">{provider?.config.name} — API Key</Text>
        {provider?.config.apiKeyUrl && (
          <Text dimColor>Get one at: {provider.config.apiKeyUrl}</Text>
        )}
        <Box marginTop={1} />
        {error && <Box marginBottom={1}><Text color="red">{error}</Text></Box>}
        <Box>
          <Text color="cyan">❯ </Text>
          <TextInput value={apiKeyInput} onChange={setApiKeyInput} onSubmit={handleKeySubmit} mask="*" />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to save  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  // ─── Add model to provider ────────────────────────────────────────────────────
  if (step === "add-model") {
    const isCustom = customProviders.some((c) => c.id === selectedProviderId);
    const [subStep, setSubStep] = useState<"id" | "name">("id");

    const handleIdSubmit = () => {
      if (!newModelId.trim()) { setError("Model ID required"); return; }
      setError("");
      if (subStep === "id") setSubStep("name");
    };

    const handleNameSubmit = () => {
      if (!newModelName.trim()) { setError("Model name required"); return; }
      if (isCustom) {
        addModelToCustomProvider(selectedProviderId, { id: newModelId.trim(), name: newModelName.trim() });
      }
      setError("");
      setStep("configure-provider");
    };

    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add model to {getProvider(selectedProviderId)?.config.name}</Text>
        <Box marginTop={1} />
        {error && <Box marginBottom={1}><Text color="red">{error}</Text></Box>}
        {subStep === "id" ? (
          <Box flexDirection="column">
            <Text dimColor>Model ID (e.g. gpt-4o-mini, claude-3-5-haiku-20241022):</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <TextInput value={newModelId} onChange={setNewModelId} onSubmit={handleIdSubmit} />
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>Display name (e.g. GPT-4o Mini, Claude 3.5 Haiku):</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <TextInput value={newModelName} onChange={setNewModelName} onSubmit={handleNameSubmit} />
            </Box>
          </Box>
        )}
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  // ─── Remove confirm ───────────────────────────────────────────────────────────
  if (step === "remove-confirm") {
    const handleRemoveSelect = (item: PaginatedItem<string>) => {
      if (item.value === "yes") {
        removeCustomProvider(selectedProviderId);
        setStep("main");
      } else {
        setStep("configure-provider");
      }
    };

    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="red">Remove custom provider</Text>
        <Text>Are you sure you want to remove "{selectedProviderId}"?</Text>
        <Box marginTop={1} />
        <PaginatedSelect
          items={[
            { label: "Yes, remove it", value: "yes" },
            { label: "No, keep it", value: "no" },
          ]}
          pageSize={5}
          onSelect={handleRemoveSelect}
        />
      </Box>
    );
  }

  // ─── Custom provider wizard ───────────────────────────────────────────────────
  if (step === "custom-add-name") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add custom provider</Text>
        <Text dimColor>Step 1 / 4 — Provider name</Text>
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <TextInput
            value={cpName}
            onChange={setCpName}
            onSubmit={() => { if (cpName.trim()) setStep("custom-add-sdk"); }}
            placeholder="My Custom LLM..."
          />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  if (step === "custom-add-sdk") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add custom provider — {cpName}</Text>
        <Text dimColor>Step 2 / 4 — Format (API SDK)</Text>
        <Box marginTop={1} />
        <PaginatedSelect
          items={SDK_OPTIONS}
          pageSize={5}
          onSelect={(item) => {
            setCpSdk(item.value);
            setStep("custom-add-url");
          }}
        />
      </Box>
    );
  }

  if (step === "custom-add-url") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add custom provider — {cpName}</Text>
        <Text dimColor>Step 3 / 4 — Base URL</Text>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <TextInput
            value={cpUrl}
            onChange={setCpUrl}
            onSubmit={() => {
              if (!cpUrl.trim()) { setError("URL required"); return; }
              setError("");
              setStep("custom-add-key");
            }}
            placeholder="https://api.example.com/v1"
          />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  if (step === "custom-add-key") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add custom provider — {cpName}</Text>
        <Text dimColor>Step 4 / 4 — API Key</Text>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <TextInput
            value={cpKey}
            onChange={setCpKey}
            onSubmit={() => {
              if (!cpKey.trim()) { setError("API key required"); return; }
              setError("");
              setCpModels([]);
              setCpTempModelId(""); setCpTempModelName("");
              setStep("custom-add-model-id");
            }}
            mask="*"
            placeholder="sk-..."
          />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  if (step === "custom-add-model-id") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add model to {cpName}</Text>
        <Text dimColor>Model ID (e.g. my-model-v1)</Text>
        {cpModels.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text dimColor>Already added:</Text>
            {cpModels.map((m) => <Text key={m.id} dimColor>  • {m.name} ({m.id})</Text>)}
          </Box>
        )}
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <TextInput
            value={cpTempModelId}
            onChange={setCpTempModelId}
            onSubmit={() => {
              if (!cpTempModelId.trim()) { setError("Model ID required"); return; }
              setError("");
              setStep("custom-add-model-name");
            }}
          />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  if (step === "custom-add-model-name") {
    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add model to {cpName}</Text>
        <Text dimColor>Display name for "{cpTempModelId}"</Text>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}>
          <Text color="cyan">❯ </Text>
          <TextInput
            value={cpTempModelName}
            onChange={setCpTempModelName}
            onSubmit={() => {
              if (!cpTempModelName.trim()) { setError("Model name required"); return; }
              setCpModels((prev) => [...prev, { id: cpTempModelId.trim(), name: cpTempModelName.trim() }]);
              setCpTempModelId(""); setCpTempModelName("");
              setError("");
              setStep("custom-add-more");
            }}
          />
        </Box>
        <Box marginTop={1}><Text dimColor>Enter to continue  ·  Esc to cancel</Text></Box>
      </Box>
    );
  }

  if (step === "custom-add-more") {
    const handleMoreSelect = (item: PaginatedItem<string>) => {
      if (item.value === "add") {
        setStep("custom-add-model-id");
      } else if (item.value === "save") {
        const id = `custom-${cpName.toLowerCase().replace(/\s+/g, "-")}-${randomUUID().slice(0, 6)}`;
        addCustomProvider({
          id,
          name: cpName.trim(),
          sdk: cpSdk,
          baseUrl: cpUrl.trim(),
          apiKey: cpKey.trim(),
          models: cpModels,
          createdAt: new Date().toISOString(),
        });
        setStep("custom-done");
      }
    };

    return (
      <Box flexDirection="column"  paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Add model to {cpName}</Text>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Models added so far:</Text>
          {cpModels.map((m) => <Text key={m.id}>  • {m.name} ({m.id})</Text>)}
        </Box>
        <PaginatedSelect
          items={[
            { label: "+ Add another model", value: "add" },
            { label: "✓ Save provider", value: "save" },
          ]}
          pageSize={5}
          onSelect={handleMoreSelect}
        />
      </Box>
    );
  }

  if (step === "custom-done") {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="green">✓ Custom provider "{cpName}" added!</Text>
        <Text dimColor>It is now available in /model and /settings.</Text>
        <Box marginTop={1} />
        <PaginatedSelect
          items={[
            { label: "Configure it now", value: "configure" },
            { label: "Close", value: "close" },
          ]}
          pageSize={5}
          onSelect={(item) => {
            if (item.value === "configure") {
              const customs = getCustomProviders();
              const newest = customs[customs.length - 1];
              if (newest) { setSelectedProviderId(newest.id); setStep("configure-provider"); }
            } else {
              onCancel();
            }
          }}
        />
      </Box>
    );
  }

  return null;
}
