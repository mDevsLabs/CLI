import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdout, Static } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { useStatusWord } from "../utils/statusWords.js";
import { getProvider } from "../providers/index.js";
import { loadSettings, saveSettings, type OpenAgentSettings } from "../config/settings.js";
import { getEffectiveMode, getModeMeta, addRule, loadPermissions, savePermissions } from "../config/permissions.js";
import { runQueryLoop, describeToolCall, type QueryCallbacks } from "../query.js";
import {
  createSession,
  appendMessage,
  listSessions,
  loadSession,
  type SessionMeta,
} from "../session/history.js";
import { executeCommand, getCommand, getAllCommands, type CommandContext, type CommandResult } from "../commands/index.js";
import type { ProviderMessage, TokenUsage } from "../providers/types.js";
import {
  getBanner,
  getTerminalSize,
  onResize,
  formatTokens,
} from "../utils/terminal.js";
import { ProviderPicker } from "./ProviderPicker.js";
import { ModelPicker } from "./ModelPicker.js";
import { ModelSelector } from "./ModelSelector.js";
import { ProviderManager } from "./ProviderManager.js";
import { PermissionPrompt, type PermissionDecision } from "./PermissionPrompt.js";
import { RedditSetup } from "./RedditSetup.js";
import { XSetup } from "./XSetup.js";
import { DiscordSetup } from "./DiscordSetup.js";
import { WhatsAppSetup } from "./WhatsAppSetup.js";
import { detectProject, formatProjectInfo } from "../utils/projectDetect.js";
import { DiffView } from "./DiffView.js";
import { McpStore } from "./McpStore.js";
import { PluginStore } from "./PluginStore.js";
import { UploadView } from "./UploadView.js";
import { SettingsMenu } from "./SettingsMenu.js";
import { subscribeTodos, clearTodos, type TodoItem } from "../tools/TodoWriteTool/index.js";
import { setUploadListener } from "../tools/UploadTool/index.js";
import { filterStreamText, shortPath } from "../utils/streamFilter.js";
import { estimateCost } from "../utils/costTracker.js";
import { renderMarkdown } from "../utils/renderMarkdown.js";
import { getContextMeter } from "../utils/contextMeter.js";
import { getCurrentVersion } from "../utils/updateCheck.js";

interface MessageDisplay {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
  toolError?: boolean;
  toolMeta?: string;
}

interface REPLProps {
  settings: OpenAgentSettings;
  thinkingEnabled: boolean;
}

export function REPL({ settings: initialSettings, thinkingEnabled: initialThinking }: REPLProps) {
  const [input, setInput] = useState("");
  const [displayMessages, setDisplayMessages] = useState<MessageDisplay[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTool, setActiveTool] = useState("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0 });
  const [termSize, setTermSize] = useState(getTerminalSize());
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [thinking, setThinking] = useState(initialThinking);
  const [settings, setSettings] = useState(initialSettings);
  const [pickerView, setPickerView] = useState<"none" | "provider" | "model" | "model-selector" | "provider-manager" | "settings" | "reddit" | "x" | "whatsapp" | "discord" | "mcp" | "plugins" | "upload">("none");
  const [pickerData, setPickerData] = useState<any>(null);
  const [sessionProvider, setSessionProvider] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [initialBanner] = useState(() => initialSettings.defaultPermissionMode !== "terminal");
  
  const [permissionPrompt, setPermissionPrompt] = useState<{ name: string; desc: string } | null>(null);
  const permissionResolveRef = useRef<((allowed: boolean) => void) | null>(null);

  // Initialize modes from settings if not overridden
  const [terminalMode, setTerminalMode] = useState(() => initialSettings.defaultPermissionMode === "terminal");
  
  useEffect(() => {
    if (initialSettings.defaultPermissionMode && initialSettings.defaultPermissionMode !== "terminal") {
      import("../config/permissions.js").then((m) => {
        const current = m.loadPermissions();
        // Only apply if the current mode is the default "standard" (i.e. not overridden by CLI flags like --turbo)
        if (current.mode === "standard" && initialSettings.defaultPermissionMode !== "standard") {
          current.mode = initialSettings.defaultPermissionMode as any;
          m.savePermissions(current);
        }
      });
    }
  }, [initialSettings.defaultPermissionMode]);

  const messagesRef = useRef<ProviderMessage[]>([]);
  const streamingTextRef = useRef("");
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const todoFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const [expandedView, setExpandedView] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteItems, setAutocompleteItems] = useState<{ label: string, value: string, desc?: string }[]>([]);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [interruptPrompt, setInterruptPrompt] = useState(false);
  const startTimeRef = useRef(0);
  const inputHistoryRef = useRef<string[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const draftInputRef = useRef<string>("");
  const { exit } = useApp();
  const { stdout } = useStdout();
  const statusWord = useStatusWord(isProcessing);

  useEffect(() => {
    const session = createSession(process.cwd(), settings.provider, settings.model);
    setSessionId(session.id);
  }, []);

  useEffect(() => {
    return onResize((size) => setTermSize(size));
  }, []);

  useEffect(() => {
    return subscribeTodos((s) => setTodoItems([...s.items]));
  }, []);

  useEffect(() => {
    setUploadListener((summary, donePromise) => {
      setDisplayMessages((prev) => [...prev, { role: "system", content: summary }]);
      donePromise.then((msg) => {
        setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
      });
    });
    return () => setUploadListener(null);
  }, []);

  useEffect(() => {
    if (terminalMode || isProcessing) {
      setAutocompleteItems([]);
      return;
    }
    if (input.startsWith("/")) {
      const cmds = getAllCommands();
      const q = input.slice(1).toLowerCase();
      const matches = cmds.filter(c => c.name.startsWith(q) || c.aliases?.some(a => a.startsWith(q)));
      setAutocompleteItems(matches.map(c => ({ label: `/${c.name}`, value: `/${c.name}`, desc: c.description })));
      setAutocompleteIndex(0);
    } else {
      const words = input.split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.startsWith("@")) {
        const q = lastWord.slice(1);
        import("../utils/fileAutocomplete.js").then(({ getProjectFiles }) => {
          const files = getProjectFiles(process.cwd(), q);
          setAutocompleteItems(files.map(f => ({ label: `@${f}`, value: `@${f}` })));
          setAutocompleteIndex(0);
        });
      } else {
        setAutocompleteItems([]);
      }
    }
  }, [input, terminalMode, isProcessing]);

  useInput((ch, key) => {
    if (key.ctrl && ch === "b") {
      setExpandedView((prev) => !prev);
      return;
    }

    if (key.ctrl && ch === "t") {
      if (terminalMode) {
        setTerminalMode(false);
        const state = loadPermissions();
        state.mode = "standard";
        savePermissions(state);
        setPermModeKey((k: number) => k + 1);
        setDisplayMessages((prev: any) => [...prev, { role: "system", content: `Mode: standard` }]);
      } else {
        const state = loadPermissions();
        if (state.mode === "standard") {
          state.mode = "plan";
          savePermissions(state);
          setPermModeKey((k: number) => k + 1);
          setDisplayMessages((prev: any) => [...prev, { role: "system", content: `Mode: plan` }]);
        } else if (state.mode === "plan") {
          state.mode = "turbo";
          savePermissions(state);
          setPermModeKey((k: number) => k + 1);
          setDisplayMessages((prev: any) => [...prev, { role: "system", content: `Mode: turbo` }]);
        } else {
          setTerminalMode(true);
        }
      }
      return;
    }

    if (key.shift && key.tab) {
      const state = loadPermissions();
      const modes: Array<"standard" | "cautious" | "turbo" | "plan"> = ["standard", "cautious", "turbo", "plan"];
      const idx = modes.indexOf(state.mode);
      state.mode = modes[(idx + 1) % modes.length];
      savePermissions(state);
      setPermModeKey((k: number) => k + 1);
      setDisplayMessages((prev: any) => [...prev, { role: "system", content: `Mode: ${state.mode}` }]);
      return;
    }

    if (autocompleteItems.length > 0) {
      if (key.upArrow) {
        setAutocompleteIndex((i) => (i > 0 ? i - 1 : autocompleteItems.length - 1));
        return;
      }
      if (key.downArrow) {
        setAutocompleteIndex((i) => (i < autocompleteItems.length - 1 ? i + 1 : 0));
        return;
      }
      if (key.tab || key.rightArrow) {
        const sel = autocompleteItems[autocompleteIndex];
        if (sel) {
          if (input.startsWith("/")) {
            setInput(sel.value + " ");
          } else {
            const words = input.split(/\s+/);
            words[words.length - 1] = sel.value;
            setInput(words.join(" ") + " ");
          }
          setAutocompleteItems([]);
        }
        return;
      }
    }

    if (key.ctrl && ch === "c") {
      if (permissionPrompt && permissionResolveRef.current) {
        permissionResolveRef.current(false);
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        return;
      }
      if (isProcessing && abortRef.current) {
        abortRef.current.abort();
        return;
      }
      exit();
      return;
    }

    if (key.escape) {
      if (autocompleteItems.length > 0 || input.startsWith("/") || input.startsWith("@")) {
        setAutocompleteItems([]);
        if (input.startsWith("/") || input.startsWith("@")) {
          setInput("");
        }
        return;
      }
      if (permissionPrompt && permissionResolveRef.current) {
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(false);
        return;
      }
      if (isProcessing && abortRef.current) {
        // First Esc instantly aborts and shows "what should it do instead?" prompt.
        abortRef.current.abort();
        abortRef.current = null;
        setIsProcessing(false);
        setActiveTool("");
        setStreamingText("");
        streamingTextRef.current = "";
        if (streamThrottleRef.current) {
          clearTimeout(streamThrottleRef.current);
          streamThrottleRef.current = null;
        }
        setInterruptPrompt(true);
        return;
      }
      if (interruptPrompt) {
        setInterruptPrompt(false);
        return;
      }
    }

    if ((key.upArrow || key.downArrow) && pickerView === "none" && !isProcessing && !permissionPrompt && !terminalMode && autocompleteItems.length === 0) {
      const hist = inputHistoryRef.current;
      if (hist.length === 0) return;
      if (key.upArrow) {
        if (historyIdxRef.current === -1) {
          draftInputRef.current = input;
          historyIdxRef.current = hist.length - 1;
        } else if (historyIdxRef.current > 0) {
          historyIdxRef.current -= 1;
        }
        setInput(hist[historyIdxRef.current]);
      } else {
        if (historyIdxRef.current === -1) return;
        if (historyIdxRef.current < hist.length - 1) {
          historyIdxRef.current += 1;
          setInput(hist[historyIdxRef.current]);
        } else {
          historyIdxRef.current = -1;
          setInput(draftInputRef.current);
          draftInputRef.current = "";
        }
      }
      return;
    }

    if (key.escape && key.shift && isProcessing && input.trim()) {
      setQueuedMessages((prev) => [...prev, input.trim()]);
      setDisplayMessages((prev) => [
        ...prev,
        { role: "system", content: `Queued: ${input.trim()}` },
      ]);
      setInput("");
      return;
    }

    if (permissionPrompt && permissionResolveRef.current) {
      const c = ch.toLowerCase();
      if (c === "y") {
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(true);
      } else if (c === "n") {
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(false);
      } else if (c === "a") {
        addRule({ tool: permissionPrompt.name, behavior: "allow" }, "global");
        setDisplayMessages((prev) => [
          ...prev,
          { role: "system", content: `Always approved: ${permissionPrompt.name}` },
        ]);
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(true);
      }
    }
  });

  const commandHint = useMemo(() => {
    if (!input.startsWith("/") || input.includes(" ")) return "";
    const partial = input.slice(1).toLowerCase();
    if (!partial) return "";
    const allCmds = getAllCommands();
    const matches = allCmds.filter(
      (c) => c.name.startsWith(partial) || c.aliases.some((a) => a.startsWith(partial))
    );
    if (matches.length === 0) return "";
    if (matches.length <= 5) {
      return matches.map((m) => `/${m.name}`).join("  ");
    }
    return matches.slice(0, 5).map((m) => `/${m.name}`).join("  ") + `  +${matches.length - 5} more`;
  }, [input]);

  const [permModeKey, setPermModeKey] = useState(0);
  const permMode = useMemo(() => {
    const mode = getEffectiveMode();
    return { ...getModeMeta(mode), mode };
  }, [permModeKey]);

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setInput("");
      const hist = inputHistoryRef.current;
      if (hist[hist.length - 1] !== trimmed) {
        hist.push(trimmed);
        if (hist.length > 200) hist.shift();
      }
      historyIdxRef.current = -1;
      draftInputRef.current = "";
      setInput("");

      if (todoFadeTimerRef.current) {
        clearTimeout(todoFadeTimerRef.current);
        todoFadeTimerRef.current = null;
      }
      clearTodos();

      if (terminalMode) {
        setDisplayMessages((prev) => [
          ...prev,
          { role: "system", content: `\x1b[33m$\x1b[0m ${trimmed}` },
        ]);
        setIsProcessing(true);
        const { spawn: spawnCmd } = await import("node:child_process");
        const { isWindows } = await import("../utils/platform.js");
        // Pass the full command line as a single string with no args array —
        // shell:true + args[] triggers Node's DEP0190 warning. The shell parses
        // the command itself, so no manual splitting is needed.
        const proc = spawnCmd(trimmed, {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          shell: isWindows() ? "powershell.exe" : true,
          windowsHide: true,
        });
        let output = "";
        proc.stdout?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.stderr?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.on("close", (code) => {
          setDisplayMessages((prev) => [
            ...prev,
            { role: "system", content: output.trim() || (code ? `Exit code ${code}` : "(no output)") },
          ]);
          setIsProcessing(false);
        });
        abortRef.current = new AbortController();
        abortRef.current.signal.addEventListener("abort", () => { proc.kill(); });
        return;
      }

      if (trimmed.startsWith("/")) {
        if (trimmed === "/think" || trimmed === "/thinking") {
          setThinking((prev) => !prev);
          setDisplayMessages((prev) => [
            ...prev,
            { role: "system", content: `Thinking mode: ${!thinking ? "enabled" : "disabled"}` },
          ]);
          return;
        }

        const cmdCtx: CommandContext = {
          cwd: process.cwd(),
          tokenUsage,
          sessionId,
          messageCount: messageCountRef.current,
        };

        const result = await executeCommand(trimmed, cmdCtx);

        if (result.action === "exit") {
          console.log(result.output || "Resume your conversation using the /resume command.");
          exit();
          return;
        }

        if (result.action === "exit-update") {
          console.log(result.output);
          exit();
          return;
        }

        if (result.action === "pick-settings") {
          setPickerView("settings");
          return;
        }

        if (result.action === "clear") {
          setDisplayMessages([]);
          messagesRef.current = [];
          setStreamingText("");
          setTokenUsage({ inputTokens: 0, outputTokens: 0 });
          messageCountRef.current = 0;
          clearTodos();
          return;
        }

        if (result.action === "resume" && result.data) {
          const loaded = loadSession(result.data.id);
          if (loaded) {
            messagesRef.current = loaded.messages;
            setSessionId(loaded.meta.id);
            messageCountRef.current = loaded.messages.length;
            setDisplayMessages(
              loaded.messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                  role: m.role as "user" | "assistant",
                  content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                }))
            );
          }
          return;
        }

        if (result.action === "pick-provider") {
          setPickerView("provider");
          return;
        }

        if (result.action === "pick-model") {
          setPickerView("model");
          return;
        }

        if (result.action === "pick-model-selector") {
          setPickerData(result.data);
          setPickerView("model-selector");
          return;
        }

        if (result.action === "pick-provider-manager") {
          setPickerView("provider-manager");
          return;
        }

        if (result.action === "queue-message") {
          if (result.output) {
            setDisplayMessages((prev) => [...prev, { role: "system", content: result.output }]);
          }
          setQueuedMessages((prev) => [...prev, result.data]);
          return;
        }

        if (result.action === "setup-reddit") {
          setPickerView("reddit");
          return;
        }

        if (result.action === "setup-x") {
          setPickerView("x");
          return;
        }

        if ((result.action as string) === "setup-whatsapp") {
          setPickerView("whatsapp");
          return;
        }

        if ((result.action as string) === "setup-discord") {
          setPickerView("discord");
          return;
        }

        if (result.action === "pick-mcp") {
          setPickerView("mcp");
          return;
        }

        if (result.action === "pick-plugins") {
          setPickerView("plugins");
          return;
        }

        if (result.action === "upload") {
          setPickerView("upload");
          return;
        }

        if (result.action === "compact") {
          const msgCount = messagesRef.current.length;
          if (msgCount < 2) {
            setDisplayMessages((prev) => [...prev, { role: "system", content: "Nothing to compact." }]);
            return;
          }

          const summaryParts: string[] = [];
          for (const m of messagesRef.current) {
            if (m.role === "user" && typeof m.content === "string") {
              summaryParts.push(`User asked: ${m.content.slice(0, 100)}`);
            }
            if (m.role === "assistant" && typeof m.content === "string" && m.content.length > 0) {
              summaryParts.push(`Agent: ${m.content.slice(0, 150)}`);
            }
          }
          const summary = summaryParts.slice(-10).join("\n");

          messagesRef.current = [
            { role: "user", content: `[Compacted session summary]\n${summary}` },
            { role: "assistant", content: "Understood. I have the context from our previous conversation. What's next?" },
          ];
          messageCountRef.current = 2;

          setDisplayMessages([
            { role: "system", content: `Compacted ${msgCount} messages → 2. Context preserved.` },
          ]);
          setTokenUsage({ inputTokens: 0, outputTokens: 0 });
          return;
        }

        if (result.output) {
          setDisplayMessages((prev) => [...prev, { role: "system", content: result.output }]);
        }
        setPermModeKey((k) => k + 1);
        return;
      }

      setDisplayMessages((prev) => [...prev, { role: "user", content: trimmed }]);

      const userMessage: ProviderMessage = { role: "user", content: trimmed };
      messagesRef.current.push(userMessage);
      messageCountRef.current++;
      appendMessage(sessionId, userMessage);

      // Session overrides take priority over saved settings
      const activeProviderId = sessionProvider || settings.provider;
      const activeModelId = sessionModel || settings.model;
      const provider = getProvider(activeProviderId);
      if (!provider) {
        setError(`Provider "${activeProviderId}" not found`);
        return;
      }

      setIsProcessing(true);
      startTimeRef.current = Date.now();
      setStreamingText("");
      streamingTextRef.current = "";
      setActiveTool("");
      setError("");
      const abortController = new AbortController();
      abortRef.current = abortController;

      const callbacks: QueryCallbacks = {
        onText: (text) => {
          const cleaned = filterStreamText(text);
          if (!cleaned) return;
          streamingTextRef.current += cleaned;

          if (!streamThrottleRef.current) {
            streamThrottleRef.current = setTimeout(() => {
              setStreamingText(streamingTextRef.current);
              streamThrottleRef.current = null;
            }, 200);
          }
        },
        onToolStart: (name) => {
          setActiveTool(name);
        },
        onToolPermission: async (name, args) => {
          const desc = describeToolCall(name, args);
          setActiveTool("");
          setPermissionPrompt({ name, desc });
          return new Promise<boolean>((resolve) => {
            permissionResolveRef.current = (allowed: boolean) => resolve(allowed);
          });
        },
        onToolEnd: (name, _id, result, err, args) => {
          setActiveTool("");
          let displayContent = "";
          let meta = "";

          const shortenInResult = (s: string) => filterStreamText(s);
          // Drop ToolSearch / TodoWrite / Monitor — internal harness leaks
          if (name === "TodoWrite" || name === "ToolSearch" || name === "Monitor") {
            return;
          }
          // If the "result" is just our placeholder ("Ran X"), it's a no-op echo.
          const isPlaceholder = /^Ran\s+\w+\s*$/.test(result.trim());

          if (name === "FileEdit" || name === "FileWrite") {
            meta = name;
            displayContent = shortenInResult(result);
          } else if (name === "FileRead") {
            const filePath = (args?.file_path as string) || "";
            const fileName = filePath ? filePath.split("/").pop() : "";
            meta = `Read(${fileName})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const lines = shortenInResult(result).split("\n");
              const total = lines.length;
              displayContent = lines.slice(0, 6).join("\n");
              if (total > 6) displayContent += `\n  … ${total - 6} more lines`;
            }
          } else if (name === "Bash") {
            const cmd = shortPath((args?.command as string) || "");
            const cmdPreview = cmd.length > 60 ? cmd.slice(0, 57) + "…" : cmd;
            meta = `Bash(${cmdPreview})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const lines = shortenInResult(result).split("\n").filter((l) => l.length > 0);
              const total = lines.length;
              displayContent = lines.slice(0, 8).join("\n");
              if (total > 8) displayContent += `\n  … ${total - 8} more lines`;
            }
          } else if (name === "Glob") {
            meta = `Glob(${(args?.pattern as string) || ""})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const out = shortenInResult(result);
              displayContent = out.length > 300 ? out.slice(0, 300) + "…" : out;
            }
          } else if (name === "Grep") {
            meta = `Grep(${(args?.pattern as string) || ""})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const out = shortenInResult(result);
              displayContent = out.length > 300 ? out.slice(0, 300) + "…" : out;
            }
          } else if (name === "WebSearch") {
            meta = `Search(${(args?.query as string) || ""})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const out = shortenInResult(result);
              displayContent = out.length > 400 ? out.slice(0, 400) + "…" : out;
            }
          } else if (name === "WebFetch") {
            meta = `Fetch(${shortPath((args?.url as string) || "")})`;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const out = shortenInResult(result);
              displayContent = out.length > 400 ? out.slice(0, 400) + "…" : out;
            }
          } else {
            meta = name;
            if (isPlaceholder) {
              displayContent = "";
            } else {
              const out = shortenInResult(result);
              displayContent = out.length > 500 ? out.slice(0, 500) + "…" : out;
            }
          }

          if (!displayContent) displayContent = result.length > 500 ? result.slice(0, 500) + "..." : result;
          if (!meta) meta = name;

          setDisplayMessages((prev) => [
            ...prev,
            {
              role: "tool",
              content: err ? `Error: ${err}\n${displayContent}` : displayContent,
              toolName: name,
              toolMeta: meta,
              toolError: !!err,
            },
          ]);
        },
        onDone: (usage) => {
          setTokenUsage((prev) => ({
            inputTokens: prev.inputTokens + usage.inputTokens,
            outputTokens: prev.outputTokens + usage.outputTokens,
            cacheReadTokens: (prev.cacheReadTokens || 0) + (usage.cacheReadTokens || 0),
            costUsd: usage.costUsd != null ? (prev.costUsd || 0) + usage.costUsd : prev.costUsd,
          }));
        },
        onError: (err) => {
          setError(err);
        },
      };

      try {
        const result = await runQueryLoop(provider, messagesRef.current, sessionId, callbacks, thinking, abortController.signal, activeModelId);
        messagesRef.current = result.messages;
        messageCountRef.current = result.messages.length;

        if (streamingTextRef.current) {
          setDisplayMessages((prev) => [
            ...prev,
            { role: "assistant", content: streamingTextRef.current },
          ]);
        }
      } catch (err: any) {
        setError(err.message);
      }

      if (streamThrottleRef.current) {
        clearTimeout(streamThrottleRef.current);
        streamThrottleRef.current = null;
      }
      setStreamingText("");
      streamingTextRef.current = "";
      abortRef.current = null;
      startTimeRef.current = 0;
      setIsProcessing(false);

      if (todoFadeTimerRef.current) {
        clearTimeout(todoFadeTimerRef.current);
      }
      todoFadeTimerRef.current = setTimeout(() => {
        clearTodos();
        todoFadeTimerRef.current = null;
      }, 30000);

      setQueuedMessages((prev) => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          setTimeout(() => handleSubmit(next), 100);
          return rest;
        }
        return prev;
      });
    },
    [settings, sessionId, exit, thinking, tokenUsage, terminalMode]
  );

  const modelDisplay = useMemo(() => {
    const p = sessionProvider || settings.provider;
    const m = sessionModel || settings.model;
    const provider = getProvider(p);
    if (provider) {
      const model = provider.config.models.find((mod) => mod.id === m);
      if (model) return model.name;
    }
    const parts = m.split("/");
    return parts[parts.length - 1];
  }, [settings.provider, settings.model, sessionProvider, sessionModel]);

  const renderMessage = (msg: MessageDisplay, idx: number) => {
    const width = Math.max(termSize.columns - 4, 40);

    switch (msg.role) {
      case "user":
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color="blue" bold>{"❯"} You</Text>
            <Box marginLeft={2}>
              <Text>{msg.content}</Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color="green" bold>{"⏺"} mAI CLI — <Text color="gray">{modelDisplay}</Text></Text>
            <Box marginLeft={2}>
              <Text>{renderMarkdown(msg.content)}</Text>
            </Box>
          </Box>
        );

      case "tool":
        if (msg.toolName === "FileEdit" || msg.toolName === "FileWrite") {
          return (
            <Box key={idx} flexDirection="column" marginBottom={1}>
              <DiffView
                toolName={msg.toolName as "FileEdit" | "FileWrite"}
                rawOutput={msg.content}
                isError={!!msg.toolError}
                errorMessage={msg.toolError ? msg.content : undefined}
              />
            </Box>
          );
        }
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color={msg.toolError ? "red" : "yellow"}>
              {"  ⎿ "}{msg.toolMeta || msg.toolName}{msg.toolError ? " FAILED" : ""}
            </Text>
            {msg.content && msg.content.trim() !== "" && (
              <Box marginLeft={4} flexDirection="column">
                <Text dimColor>{msg.content}</Text>
              </Box>
            )}
          </Box>
        );

      case "system":
        return (
          <Box key={idx} marginBottom={1} marginLeft={2}>
            <Text color="gray">{msg.content}</Text>
          </Box>
        );
    }
  };

  const handlePickerComplete = (providerId: string, modelId: string) => {
    const updated = loadSettings();
    setSettings(updated);
    setPickerView("none");
    setDisplayMessages((prev) => [
      ...prev,
      { role: "system", content: `Switched to ${providerId}/${modelId}` },
    ]);
  };

  const handlePickerCancel = () => {
    setPickerView("none");
  };



  return (
    <Box flexDirection="column" width={termSize.columns}>
      <Static items={[
        ...(initialBanner ? [{ type: "banner", _key: "banner" }] : []),
        ...displayMessages.map((m, i) => ({ ...m, _key: `msg-${i}` }))
      ]}>
        {(msg: any) => {
          if (msg.type === "banner") {
            const project = detectProject(process.cwd());
            return (
              <Box key="banner" flexDirection="column" marginBottom={1}>
                <Text>{getBanner(termSize.columns)}</Text>
                <Text dimColor>v{getCurrentVersion()} • mAI CLI</Text>
                <Text color="gray">
                  {permMode.mode === "turbo"
                    ? "\x1b[31m⚡ turbo\x1b[0m"
                    : permMode.label} • /help for commands
                </Text>
                {project ? (
                  <Text color="cyan" dimColor>
                    {formatProjectInfo(project)}
                  </Text>
                ) : (
                  <Text color="gray" dimColor>No project context detected.</Text>
                )}
                <Text> </Text>
              </Box>
            );
          }
          return renderMessage(msg, msg._key);
        }}
      </Static>

      {isProcessing && !streamingText && !activeTool && !permissionPrompt && (
        <Box marginBottom={1}>
          <Text bold>● </Text>
          <Text color="green" bold>mAI CLI</Text>
          <Text color="gray"> — {modelDisplay}</Text>
        </Box>
      )}

      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>{"⏺"} mAI CLI — <Text color="gray">{modelDisplay}</Text></Text>
          <Box marginLeft={2}>
            <Text>{renderMarkdown(streamingText)}</Text>
          </Box>
        </Box>
      )}

      {activeTool && (
        <Box marginBottom={1} marginLeft={2}>
          <Text color="yellow">
            <Spinner type="dots" /> {activeTool}
          </Text>
        </Box>
      )}

      {error && (
        <Box marginBottom={1} marginLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {permissionPrompt && (
        <PermissionPrompt
          toolName={permissionPrompt.name}
          description={permissionPrompt.desc}
          onDecide={(decision: PermissionDecision) => {
            const resolve = permissionResolveRef.current;
            permissionResolveRef.current = null;
            setPermissionPrompt(null);
            if (decision === "always-allow") {
              addRule({ tool: permissionPrompt.name, behavior: "allow" }, "global");
              setDisplayMessages((prev) => [
                ...prev,
                { role: "system", content: `✓ Always approved: ${permissionPrompt.name}` },
              ]);
              resolve?.(true);
            } else {
              resolve?.(decision === "allow");
            }
          }}
        />
      )}

      {todoItems.length > 0 && (
        <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
          {todoItems.map((t, i) => {
            if (t.status === "completed") {
              return (
                <Box key={i}>
                  <Text color="green">  ✓ </Text>
                  <Text dimColor>{t.content}</Text>
                </Box>
              );
            }
            if (t.status === "in_progress") {
              return (
                <Box key={i}>
                  <Text color="red" bold>  ■ </Text>
                  <Text bold>{t.activeForm || t.content}</Text>
                </Box>
              );
            }
            return (
              <Box key={i}>
                <Text dimColor>  ☐ </Text>
                <Text dimColor>{t.content}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {isProcessing && !permissionPrompt && (
        <Box marginLeft={1} marginBottom={0}>
          <Text color="white" bold>{activeTool ? "Agent" : statusWord}</Text>
          <Text dimColor>  (esc to interrupt • ↓ {formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)} tokens)</Text>
        </Box>
      )}

      {interruptPrompt && !permissionPrompt && (
        <Box marginLeft={1} marginBottom={0} flexDirection="column">
          <Text color="yellow" bold>⏸ Interrupted</Text>
          <Text dimColor>What should {modelDisplay} do instead?</Text>
        </Box>
      )}

      {!permissionPrompt && (
        <Box borderStyle="single" borderColor={terminalMode ? "magenta" : interruptPrompt ? "yellow" : "gray"} paddingLeft={1} width={termSize.columns - 1}>
          <Box flexGrow={1}>
            <Text color={terminalMode ? "magenta" : interruptPrompt ? "yellow" : "cyan"} bold>{terminalMode ? "$" : "❯"} </Text>
            <TextInput
              focus={pickerView === "none"}
              value={input}
              onChange={setInput}
              onSubmit={(value) => {
                if (interruptPrompt) setInterruptPrompt(false);
                
                if (autocompleteItems.length > 0) {
                  const sel = autocompleteItems[autocompleteIndex];
                  if (sel) {
                    const words = value.split(/\s+/);
                    words[words.length - 1] = sel.value;
                    setInput(words.join(" ") + " ");
                    setAutocompleteItems([]);
                    return;
                  }
                }

                if (isProcessing && value.trim()) {
                  setQueuedMessages((prev) => [...prev, value.trim()]);
                  setInput("");
                  return;
                }
                handleSubmit(value);
              }}
              placeholder={
                terminalMode
                  ? `Run a command… (Ctrl+T for ${
                      terminalMode
                        ? "standard"
                        : permMode.mode === "standard"
                          ? "plan"
                          : permMode.mode === "plan"
                            ? "turbo"
                            : "terminal"
                    })`
                  : isProcessing
                    ? "Queue another message…"
                    : interruptPrompt
                      ? "Tell mAI CLI what to do instead…"
                      : `Message mAI CLI… (Ctrl+T for ${
                          terminalMode
                            ? "standard"
                            : permMode.mode === "standard"
                              ? "plan"
                              : permMode.mode === "plan"
                                ? "turbo"
                                : "terminal"
                        })`
              }
            />
          </Box>
        </Box>
      )}

      {!permissionPrompt && pickerView !== "none" && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" marginLeft={2} paddingX={1} width={termSize.columns - 4}>
          {pickerView === "settings" && (
            <SettingsMenu
              onClose={() => {
                setPickerView("none");
                setSettings(loadSettings());
              }}
            />
          )}
          {pickerView === "model-selector" && (
            <ModelSelector
              initialSearch={pickerData?.initialSearch}
              onComplete={(providerId, modelId) => {
                setSessionProvider(providerId);
                setSessionModel(modelId);
                setPickerView("none");
                const provider = getProvider(providerId);
                const modelName = provider?.config.models.find((m) => m.id === modelId)?.name || modelId;
                setDisplayMessages((prev) => [
                  ...prev,
                  { role: "system", content: `Model switched to ${provider?.config.name || providerId} / ${modelName} (session only)` },
                ]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "provider-manager" && (
            <ProviderManager
              onComplete={(providerId, modelId) => {
                setPickerView("none");
                setSettings(loadSettings());
                setDisplayMessages((prev) => [
                  ...prev,
                  { role: "system", content: `Default provider set to ${providerId} / ${modelId}` },
                ]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "provider" && (
            <ProviderPicker onComplete={handlePickerComplete} onCancel={handlePickerCancel} />
          )}
          {pickerView === "model" && (
            <ModelPicker onComplete={handlePickerComplete} onCancel={handlePickerCancel} />
          )}
          {pickerView === "reddit" && (
            <RedditSetup
              onComplete={(msg) => {
                setPickerView("none");
                setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "x" && (
            <XSetup
              onComplete={(msg) => {
                setPickerView("none");
                setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "whatsapp" && (
            <WhatsAppSetup
              onComplete={(msg) => {
                setPickerView("none");
                setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "discord" && (
            <DiscordSetup
              onComplete={(msg) => {
                setPickerView("none");
                setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
              }}
              onCancel={handlePickerCancel}
            />
          )}
          {pickerView === "mcp" && (
            <McpStore onClose={handlePickerCancel} />
          )}
          {pickerView === "plugins" && (
            <PluginStore onClose={handlePickerCancel} />
          )}
          {pickerView === "upload" && (
            <UploadView onClose={handlePickerCancel} />
          )}
        </Box>
      )}

      {autocompleteItems.length > 0 && pickerView === "none" && (() => {
        const maxVisible = 10;
        let startIdx = Math.max(0, autocompleteIndex - Math.floor(maxVisible / 2));
        if (startIdx + maxVisible > autocompleteItems.length) {
          startIdx = Math.max(0, autocompleteItems.length - maxVisible);
        }
        const visibleItems = autocompleteItems.slice(startIdx, startIdx + maxVisible);
        
        return (
          <Box flexDirection="column" borderStyle="round" borderColor="gray" marginLeft={2} paddingX={1}>
            {startIdx > 0 && <Text dimColor>↑ {startIdx} more</Text>}
            {visibleItems.map((item, idx) => {
              const actualIdx = startIdx + idx;
              return (
                <Text key={item.value + actualIdx} color={actualIdx === autocompleteIndex ? "black" : "white"} backgroundColor={actualIdx === autocompleteIndex ? "cyan" : undefined}>
                  {item.label} {item.desc ? <Text dimColor>— {item.desc}</Text> : null}
                </Text>
              );
            })}
            {startIdx + maxVisible < autocompleteItems.length && <Text dimColor>↓ {autocompleteItems.length - (startIdx + maxVisible)} more</Text>}
          </Box>
        );
      })()}

      <Box paddingLeft={1} marginTop={1} justifyContent="space-between" width={termSize.columns - 2}>
        <Box>
          {terminalMode ? (
            <Text color="magenta" bold>Terminal Mode</Text>
          ) : permMode.mode === "turbo" ? (
            <Text color="magenta" bold>Turbo [{permMode.symbol}]</Text>
          ) : permMode.mode === "cautious" ? (
            <Text color="yellow">{permMode.label} <Text dimColor>[{permMode.symbol}]</Text></Text>
          ) : (
            <Text color="cyan">{permMode.label} <Text dimColor>[{permMode.symbol}]</Text></Text>
          )}
          {thinking && <Text color="yellow"> • think</Text>}
          {queuedMessages.length > 0 && <Text color="yellow"> • {queuedMessages.length} queued</Text>}
          <Text dimColor> • </Text>
          <Text color="white">{formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}</Text>
          <Text dimColor> tokens • </Text>
          <Text color="green">{tokenUsage.costUsd ? `$${tokenUsage.costUsd.toFixed(4)}` : (tokenUsage.inputTokens + tokenUsage.outputTokens > 0 ? estimateCost(settings.model, tokenUsage).formatted : "$0")}</Text>
          <Text dimColor> • </Text>
          <Text color="cyan">{modelDisplay}</Text>
        </Box>
        <Text>
          {getContextMeter(
            tokenUsage.inputTokens + tokenUsage.outputTokens,
            (() => {
              const p = getProvider(settings.provider);
              return p?.config.models.find((m) => m.id === settings.model)?.contextWindow || 128000;
            })()
          )}
        </Text>
      </Box>
    </Box>
  );
}
