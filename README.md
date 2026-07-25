<h1 align="center">mAI CLI</h1>

<p align="center">
  <strong>The open-source multi-provider agentic coding CLI for your terminal.</strong><br>
  Use your Claude Max subscription, GPT-5, Gemini, Grok, or run local models (Ollama, MLX, LM Studio) for free.
</p>

<p align="center">
  <a href="https://github.com/mDevsLabs/mAI-CLI/stargazers"><img src="https://img.shields.io/github/stars/mDevsLabs/mAI-CLI?style=for-the-badge&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/mDevsLabs/mAI-CLI/releases"><img src="https://img.shields.io/github/v/release/mDevsLabs/mAI-CLI?style=for-the-badge&color=green&label=version" alt="Latest release" /></a>
  <a href="https://github.com/mDevsLabs/mAI-CLI/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mDevsLabs/mAI-CLI?style=for-the-badge&color=blue" alt="Apache 2.0 License" /></a>
</p>

---

## Summary

**mAI CLI** is an open-source agentic coding assistant that brings powerful AI pair programming directly into your terminal. Works with **12+ AI providers**: Claude (including direct Claude Max subscription support), OpenAI, Google Gemini, xAI Grok, DeepSeek, Mistral, Groq, AWS Bedrock, and local models via Ollama, LM Studio, and Apple Silicon MLX.

---

## Installation

### macOS (Homebrew)
```bash
brew install mDevsLabs/mAI-CLI/mai
```

### Linux / WSL

**Stable (main branch)**:
```bash
curl -fsSL https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/main/scripts/install-remote.sh | bash
```

**Canary (canary branch)**:
```bash
curl -fsSL https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/canary/scripts/install-canary.sh | bash
```

### Windows 10 / 11

**Stable (main branch)**:
```cmd
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/main/scripts/install-remote.ps1 | iex"
```

**Canary (canary branch)**:
```cmd
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/canary/scripts/install-canary.ps1 | iex"
```

### From Source (All Platforms)
```bash
git clone https://github.com/mDevsLabs/mAI-CLI.git
cd mAI-CLI
bash scripts/install-user.sh       # macOS / Linux / WSL
powershell -ExecutionPolicy Bypass -File scripts\install-user.ps1   # Windows
```

### Update
```bash
mai --update
```

---

## License

This project is licensed under the **Apache 2.0 License**. See the [LICENSE](LICENSE) file for details.
