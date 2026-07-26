# Changelog

Toutes les modifications notables apportées au projet **mAI CLI** sont documentées dans ce fichier.

---

## [Version 0.3.1](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.3.1) - 2026-07-26

### Bugs
- **Install** : Nous avons corrigé un bug qui vous empêchaient d'installer le CLI

## [Version 0.3.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.3.0) - 2026-07-26

### Introducing mAI Provider 2.0
- **Discorver mAI** : Prenez nos modèles avec 2M tokens confondus offerts chaque semaine !
- **Unification** : Nous avons regouper l'API de discussion de nos modèles, de l'usage et de connexion !

### Comptes
- **Database** : Nous avons connectés vos comptes avec une base de données européenne pour sauvegarder plus facilement vos données et nous permettre de vous offrir des récompenses !

### Performance & bugs
- **Fixes** : Nous avons corriger divers bugs et améliorer les performances !

## [Version 0.2.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.2.0) - 2026-07-26

### Introducing mAI Provider
- **Discorver mAI** : Prenez nos modèles avec 2M tokens confondus offerts chaque semaine !

## [Version 0.1.0](https://github.com/mDevsLabs/mAI-CLI/releases/tag/v0.1.0) - 2026-07-25

### Rebranding & Installation
- **Nom du CLI** : Remplacement complet d'OpenAgent par **mAI CLI** (sur l'interface, les documentations et le prompt système).
- **Executable `mai`** : Le CLI s'exécute désormais avec la commande `mai` (shim `mai.cmd` sous Windows).
- **Dossier de configuration `.mai`** : Migration du dossier de configuration et d'installation vers `~/.mai/` (`%USERPROFILE%\.mai` sous Windows).
- **Nouveau logo ASCII** : Affichage d'un logo ASCII moderne mAI CLI au lancement du terminal.
- **Scripts d'installation Stable & Canary** : Ajout et mise à jour des scripts d'installation automatique pour Linux, macOS et Windows (`install-remote.sh`, `install-remote.ps1`, `install-canary.sh`, `install-canary.ps1`).

### Commandes & Reglages
- **Nouvelle commande `/settings`** : Menu interactif TUI permettant de configurer :
  - Le provider et le modèle par défaut.
  - Les instructions personnalisées envoyées à l'IA (texte libre jusqu'à 1000 caractères ou sélection d'un fichier du projet via recherche autocomplétée).
  - Les dossiers ignorés pour l'autocomplétion `@` (ex: `dist, build, temp, .cache`).
  - Le canal de mise à jour (`Stable` ou `Canary`).
- **Extraction des Modèles d'IA (`src/providers/aiModels/*.json`)** : Découplage de la définition des modèles d'IA des fichiers providers `.ts` vers des fichiers JSON indépendants sous `src/providers/aiModels/`.
- **Nouveaux Providers Cloud** :
  - **Ollama Cloud** (`https://ollama.com/api` - `OLLAMA_API_KEY`)
  - **HuggingFace** (`https://api-inference.huggingface.co/v1` - `HF_TOKEN`)
  - **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1` - `NVIDIA_API_KEY`)
- **Documentation `/help` modernisée** : Génération et ouverture d'une page HTML interactive complète avec recherche en temps réel (`src/assets/help.html`).
- **Commande `/config`** : Affichage concis du provider, du modèle et du dossier de configuration.
- **Commandes `/version` et `mai --version`** : Affiche uniquement le numéro de version exact (`package.json`).
- **Commandes `/update` et `mai --update`** : Quitte l'application et fournit la commande exacte selon le système d'exploitation et le canal pour mettre à jour l'application.
- **Suppression de `/plan`** : Remplacée par le mode Plan directement accessible via `Ctrl+T`.
- **Maintien des passerelles `/discord` et `/whatsapp`** : Prise en charge des bots Discord et webhooks WhatsApp.

### Interface Utilisateur & Navigation
- **Navigation dans l'autocomplétion (`/` et `@`)** : Défilement fluide de la liste des commandes et des fichiers avec fenêtre glissante suivant le curseur de sélection.
- **Touche Échap (`Esc`)** : Permet de fermer le menu d'autocomplétion déroulant et d'effacer le symbole `/` ou `@` saisi.
- **Suppression du texte d'aide au-dessus du champ** : Conservation uniquement du menu déroulant sous la boîte de saisie pour une UI plus propre.
- **Cycle des modes (Ctrl+T)** : Alternance entre Standard -> Plan -> Turbo -> Terminal -> Standard.
- **Format des modes** : Suppression des emojis sur les modes Plan (`P`) et Turbo (`*`).
- **Placeholder dynamique** : La zone de texte indique la touche et le mode suivant (`Ctrl+T for {MODE_SUIVANT}`).
- **Message d'ouverture `/exit`** : Affiche la consigne *"Resume your conversation using the /resume command."* avant de quitter.

### README.md
- **Refonte épurée du `README.md`** : Structure simplifiée en 3 sections principales (Résumé, Instructions d'installation et Licence Apache 2.0).

### Commandes `/model` et `/provider` séparées
- **`/model`** : Nouvelle interface de sélection de modèle simple, groupée par provider avec navigation clavier. La sélection s'applique **uniquement pour la session en cours** (pas de sauvegarde sur le disque). Utiliser `/settings` pour changer le modèle par défaut.
- **`/provider`** : Ouvre désormais le **Provider Manager** complet — configure les clés API, ajoute des modèles et crée des providers personnalisés.
- **Session override** : `runQueryLoop` accepte désormais un `modelOverride` optionnel pour les sélections de session, sans écraser la config.

### Corrections de bugs & UX UI
- **Nouveau composant `PaginatedSelect`** : Fenêtre de défilement fixe de 5 éléments pour la sélection de modèle (`/model`) et de provider (`/provider`). Affiche automatiquement `(↑ X More)` en haut et `(↓ Y More)` en bas selon la position.
- **Curseur `>` suivi dynamiquement** : Le curseur `>` reste désormais toujours visible dans la fenêtre de 5 choix et suit parfaitement les touches haut/bas.
- **Suppression du débordement de buffer** : La hauteur contrôlée (8 lignes max) empêche la poussée du terminal et résout le problème de défilement vers le haut du CLI.
- **Nettoyage de l'écran lors de la sortie** : Effacement propre de l'interface (`\x1B[2J\x1B[H`) lors de la fermeture/annulation de n'importe quelle commande (`/model`, `/provider`, `/settings`).

### Custom Providers
- **Ajout de providers personnalisés** : Via `/provider` → "Add custom provider", flux en 4 étapes (Nom → Format SDK → Base URL → Clé API), puis ajout illimité de modèles.
- **Formats SDK supportés** : OpenAI-compatible, Anthropic, Google.
- **Persistance** : Les providers personnalisés sont sauvegardés dans `~/.mai/config.json` (champ `customProviders[]`).
- **Intégration complète** : Apparaissent dans `/model`, `/provider`, `/settings` et sont disponibles pour les conversations.
- **Suppression** : Option de suppression d'un provider custom depuis `/provider`.

### Système de permissions amélioré
- **Nouveau composant `PermissionPrompt`** : Affichage interactif avec navigation clavier lors des demandes de permission outil (Allow / Deny / Always approve).
- **"Always approve this tool"** : Enregistre une règle permanente dans `~/.mai/permissions.json` via `addRule({ behavior: "allow" })` — élimine les confirmations futures pour ce type d'outil.
- **Confirmation visuelle** : Message affiché dans le chat après "toujours approuver".

### Paramètres
- **`/settings`** : Affiche le nombre de providers custom configurés. Bouton "Custom Providers" pour accéder à `/provider`.
- **`src/config/settings.ts`** : Ajout du type `CustomProvider` et des helpers CRUD (`addCustomProvider`, `removeCustomProvider`, `addModelToCustomProvider`, `getCustomProviders`).