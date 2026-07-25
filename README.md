<h1 align="center">🤖 mAI CLI</h1>

<p align="center">
  <strong>Le CLI open-source multi-fournisseurs pour le coding agentique, directement dans votre terminal.</strong><br>
  Utilisez votre abonnement Claude Max, GPT-5, Gemini, Grok, ou lancez des modèles locaux (Ollama, MLX, LM Studio) gratuitement.
</p>

<p align="center">
  <a href="https://github.com/mDevsLabs/mAI-CLI/stargazers"><img src="https://img.shields.io/github/stars/mDevsLabs/mAI-CLI?style=for-the-badge&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/mDevsLabs/mAI-CLI/releases"><img src="https://img.shields.io/github/v/release/mDevsLabs/mAI-CLI?style=for-the-badge&color=green&label=version" alt="Latest release" /></a>
  <a href="https://github.com/mDevsLabs/mAI-CLI/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mDevsLabs/mAI-CLI?style=for-the-badge&color=blue" alt="Apache 2.0 License" /></a>
</p>

---

## ✨ Résumé

**mAI CLI** est un assistant de coding agentique open-source qui apporte la programmation assistée par IA directement dans votre terminal. Compatible avec **12+ fournisseurs d’IA** : Claude (y compris l’abonnement Claude Max en direct), OpenAI, Google Gemini, xAI Grok, DeepSeek, Mistral, Groq, AWS Bedrock, ainsi que les modèles locaux via Ollama, LM Studio et MLX sur Apple Silicon.

---

## 📦 Installation

### 🍎 macOS (Homebrew)
```bash
brew install mDevsLabs/mAI-CLI/mai
```

### 🐧 Linux / WSL

**Stable (branche main)** :
```bash
curl -fsSL https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/main/scripts/install-remote.sh | bash
```

**Canary (branche canary)** :
```bash
curl -fsSL https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/canary/scripts/install-canary.sh | bash
```

### 🪟 Windows 10 / 11

**Stable (branche main)** :
```cmd
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/main/scripts/install-remote.ps1 | iex"
```

**Canary (branche canary)** :
```cmd
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/mDevsLabs/mAI-CLI/canary/scripts/install-canary.ps1 | iex"
```

### 🛠️ Depuis les sources (toutes plateformes)
```bash
git clone https://github.com/mDevsLabs/mAI-CLI.git
cd mAI-CLI
bash scripts/install-user.sh       # macOS / Linux / WSL
powershell -ExecutionPolicy Bypass -File scripts\install-user.ps1   # Windows
```

### 🔄 Mise à jour
```bash
mai --update
```

---

## 📄 Licence

Ce projet est sous licence **Apache 2.0**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
