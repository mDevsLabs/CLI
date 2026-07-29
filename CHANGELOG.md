# Changelog

All notable changes to the **mAI CLI** project are documented in this file.

---

## [0.5.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/0.5.0) - 2026-07-29

### Introducing a new mAI CLI !
- **News**: mAI CLI is now based on Claude Code
- **API**: the mAI provider is still available and offers you the best free models for 2M tokens per week!
- **Features**: you get roughly the same features as in Claude Code!
- **Modes**: discover more AI agent modes!

## [0.4.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.4.0) - 2026-07-26

### Permission Modes
- **Plan (P)**: true read-only mode — only FileRead, Glob, Grep, WebSearch, WebFetch, and TodoWrite are exposed. Dedicated system prompt (architecture + action plan).
- **Turbo (*)**: full autonomy — all tools and commands auto-approved, `deny` rules ignored.
- **System Prompts** per mode (Standard, Plan, Turbo, Cautious).
- **UI**: colored footer per mode, toggle messages with description, Ctrl+T placeholders via `getNextCtrlTModeLabel`.
- **Settings / help**: descriptions aligned with real behavior.

### mAI Provider 2.1
- **Reset**: Now we can reset your limits whenever we want!
- **Performance**: We have improved API performance

## [Version 0.3.1](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.3.0) - 2026-07-26

### Bugs
- **Install**: We fixed a bug that prevented you from installing the CLI

## [Version 0.3.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.3.0) - 2026-07-26

### Introducing mAI Provider 2.0
- **Discover mAI**: Get our models with 2M combined tokens offered every week!
- **Unification**: We unified our chat models API, usage tracking, and connection!

### Accounts
- **Database**: We connected your accounts to a European database to save your data more easily and allow us to offer you rewards!

### Performance & bugs
- **Fixes**: We fixed various bugs and improved performance!

## [Version 0.2.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.2.0) - 2026-07-26

### Introducing mAI Provider
- **Discover mAI**: Get our models with 2M combined tokens offered every week!

## [Version 0.1.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.1.0) - 2026-07-25

### Rebranding & Installation
- **CLI Name**: Complete replacement of OpenAgent with **mAI CLI** (in UI, documentation, and system prompt).
- **Executable `mai`**: The CLI now executes with the `mai` command (`mai.cmd` shim on Windows).
- **Configuration directory `.mai`**: Migration of the configuration and installation folder to `~/.mai/` (`%USERPROFILE%\.mai` on Windows).
- **New ASCII logo**: Display of a modern mAI CLI ASCII logo when launching the terminal.
- **Stable & Canary Installation Scripts**: Added and updated automatic installation scripts for Linux, macOS, and Windows (`install-remote.sh`, `install-remote.ps1`, `install-canary.sh`, `install-canary.ps1`).

### Commands & Settings
- **New `/settings` command**: Interactive TUI menu allowing configuration of:
  - Default provider and model.
  - Custom instructions sent to the AI (free text up to 1000 characters or selecting a project file via autocomplete search).
  - Ignored folders for `@` autocomplete (e.g. `dist, build, temp, .cache`).
  - Update channel (`Stable` or `Canary`).
- **AI Models Extraction (`src/providers/aiModels/*.json`)**: Decoupled AI model definitions from provider `.ts` files into independent JSON files under `src/providers/aiModels/`.
- **New Cloud Providers**:
  - **Ollama Cloud** (`https://ollama.com/api` - `OLLAMA_API_KEY`)
  - **HuggingFace** (`https://api-inference.huggingface.co/v1` - `HF_TOKEN`)
  - **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1` - `NVIDIA_API_KEY`)
- **Modernized `/help` Documentation**: Generation and opening of a complete interactive HTML page with real-time search (`src/assets/help.html`).
- **`/config` Command**: Concise display of provider, model, and configuration directory.
- **`/version` and `mai --version` Commands**: Displays only the exact version number (`package.json`).
- **`/update` and `mai --update` Commands**: Exits the application and provides the exact command according to the operating system and channel to update the application.
- **Removal of `/plan`**: Replaced by Plan mode directly accessible via `Ctrl+T`.
- **Maintained `/discord` and `/whatsapp` gateways**: Support for Discord bots and WhatsApp webhooks.

### User Interface & Navigation
- **Autocomplete Navigation (`/` and `@`)**: Smooth scrolling through command and file lists with a sliding window following the selection cursor.
- **Escape Key (`Esc`)**: Closes the dropdown autocomplete menu and clears the typed `/` or `@` symbol.
- **Removed help text above prompt**: Kept only the dropdown menu below the input box for a cleaner UI.
- **Mode Cycle (Ctrl+T)**: Cycling between Standard -> Plan -> Turbo -> Terminal -> Standard.
- **Mode Formatting**: Removed emojis on Plan (`P`) and Turbo (`*`) modes.
- **Dynamic Placeholder**: Input area indicates the key and the next mode (`Ctrl+T for {NEXT_MODE}`).
- **`/exit` Closing Message**: Displays the prompt *"Resume your conversation using the /resume command."* before exiting.

### README.md
- **Streamlined `README.md` redesign**: Simplified structure into 3 main sections (Summary, Installation Instructions, and Apache 2.0 License).

### Separate `/model` and `/provider` Commands
- **`/model`**: New simple model selection interface grouped by provider with keyboard navigation. Selection applies **only for the current session** (not saved to disk). Use `/settings` to change default model.
- **`/provider`**: Now opens the full **Provider Manager** — configure API keys, add models, and create custom providers.
- **Session override**: `runQueryLoop` now accepts an optional `modelOverride` for session selections without overwriting config.

### Bug Fixes & UI/UX
- **New `PaginatedSelect` component**: Fixed 5-item scrolling window for model (`/model`) and provider (`/provider`) selection. Automatically displays `(↑ X More)` at the top and `(↓ Y More)` at the bottom based on position.
- **Dynamically tracked `>` cursor**: The `>` cursor now stays visible in the 5-choice window and follows up/down arrow keys smoothly.
- **Buffer overflow fix**: Controlled height (8 lines max) prevents terminal pushing and resolves CLI scrolling up issue.
- **Screen cleanup on exit**: Clean screen clearing (`\x1B[2J\x1B[H`) upon closing/canceling any command (`/model`, `/provider`, `/settings`).

### Custom Providers
- **Adding custom providers**: Via `/provider` → "Add custom provider", 4-step flow (Name → SDK Format → Base URL → API Key), then unlimited model additions.
- **Supported SDK Formats**: OpenAI-compatible, Anthropic, Google.
- **Persistence**: Custom providers are saved in `~/.mai/config.json` (`customProviders[]` field).
- **Full Integration**: Appear in `/model`, `/provider`, `/settings` and are available for conversations.
- **Deletion**: Option to remove a custom provider from `/provider`.

### Improved Permission System
- **New `PermissionPrompt` component**: Interactive display with keyboard navigation during tool permission prompts (Allow / Deny / Always approve).
- **"Always approve this tool"**: Saves a permanent rule in `~/.mai/permissions.json` via `addRule({ behavior: "allow" })` — eliminates future confirmations for this tool type.
- **Visual confirmation**: Message displayed in chat after "always approve".

### Settings
- **`/settings`**: Displays the number of configured custom providers. "Custom Providers" button to access `/provider`.
- **`src/config/settings.ts`**: Added `CustomProvider` type and CRUD helpers (`addCustomProvider`, `removeCustomProvider`, `addModelToCustomProvider`, `getCustomProviders`).