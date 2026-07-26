import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Gradient from "ink-gradient";
import Spinner from "ink-spinner";
import { loadAuthState, saveAuthState, updateProfile, verifyPassword, hashPassword, type AuthState } from "../services/authStore.js";
import { apiGetUsage, apiVerifyCode, type UsageData } from "../services/apiClient.js";
import type { Tier } from "../services/authStore.js";

interface UsageViewProps {
  onDone: () => void;
}

export function UsageView({ onDone }: UsageViewProps) {
  const [authState, setAuthState] = useState(loadAuthState());
  const [view, setView] = useState<"stats" | "loading" | "select-tier" | "enter-code">("loading");
  const [selectedTier, setSelectedTier] = useState<Tier>("Plus");
  const [code, setCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Charger les données réelles depuis l'API
  useEffect(() => {
    const fetchUsage = async () => {
      const state = loadAuthState();

      // Pas connecté ou pas de token → utiliser les données locales
      if (!state.authToken) {
        setUsageData({
          tier: state.tier,
          email: state.email || "",
          username: state.username,
          tokensUsed: state.tokensUsed,
          limit: { Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000 }[state.tier],
          weekStart: state.weekStart,
        });
        setView("stats");
        return;
      }

      const res = await apiGetUsage();

      if (res.error) {
        // Fallback sur les données locales si l'API est inaccessible
        setLoadError(res.status === 0 ? "Hors ligne — données locales." : res.error);
        setUsageData({
          tier: state.tier,
          email: state.email || "",
          username: state.username,
          tokensUsed: state.tokensUsed,
          limit: { Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000 }[state.tier],
          weekStart: state.weekStart,
        });
      } else if (res.data) {
        setUsageData(res.data);
        // Sync local avec données serveur
        const updatedState = loadAuthState();
        updatedState.tier = res.data.tier;
        updatedState.tokensUsed = res.data.tokensUsed;
        setAuthState(updatedState);
        saveAuthState(updatedState);
      }
      setView("stats");
    };

    fetchUsage();
  }, []);

  const limit = usageData?.limit || 2_000_000;
  const used = usageData?.tokensUsed || 0;
  const remaining = Math.max(0, limit - used);
  const percentRemaining = Math.max(0, Math.min(100, (remaining / limit) * 100));

  const barLength = 20;
  const filledBlocks = Math.round((percentRemaining / 100) * barLength);
  const bar = "█".repeat(filledBlocks) + "░".repeat(barLength - filledBlocks);

  const now = new Date();
  const nextMonday = new Date();
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const diffMs = nextMonday.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const resetText = diffDays > 0
    ? `Réinitialisation dans ${diffDays} jour${diffDays > 1 ? "s" : ""} et ${diffHours}h.`
    : `Réinitialisation dans ${diffHours} heure${diffHours > 1 ? "s" : ""}.`;

  const handleSelectTier = (item: any) => {
    if (item.value === "back") {
      setView("stats");
    } else {
      setSelectedTier(item.value as Tier);
      setCode("");
      setStatusMsg("");
      setView("enter-code");
    }
  };

  const handleCodeSubmit = async (val: string) => {
    setStatusMsg("Vérification en cours... ⏳");

    const res = await apiVerifyCode(val.trim());

    if (res.error) {
      setStatusMsg(`Erreur : ${res.error}`);
    } else if (res.data?.tier) {
      setStatusMsg(`Succès ! Tu es maintenant en forfait ${res.data.tier} 🌟`);
      // Rafraîchir le tier ET la limite correspondante
      const LIMITS: Record<string, number> = { Free: 2_000_000, Plus: 5_000_000, Pro: 7_000_000, Max: 10_000_000 };
      const updatedState = loadAuthState();
      setAuthState(updatedState);
      setUsageData(prev => prev ? { 
        ...prev, 
        tier: res.data!.tier,
        limit: LIMITS[res.data!.tier] || prev.limit,
      } : prev);
      setTimeout(() => setView("stats"), 2000);
    }
  };

  useInput((ch, key) => {
    if (key.escape) {
      if (view === "enter-code") setView("select-tier");
      else if (view === "select-tier") setView("stats");
      else if (view !== "loading") onDone();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="pastel">
        <Text bold>📊 Utilisation mAI CLI</Text>
      </Gradient>

      {view === "loading" && (
        <Box marginTop={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text dimColor> Chargement des données...</Text>
        </Box>
      )}

      {view === "stats" && usageData && (
        <>
          {loadError && (
            <Box marginTop={1}>
              <Text color="yellow">⚠ {loadError}</Text>
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text>Forfait actuel : <Text bold color="yellow">{usageData.tier}</Text></Text>
            <Text>Tokens utilisés : {used.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")}</Text>
            <Text color={percentRemaining < 20 ? "red" : "green"}>
              Restant : [{bar}] {percentRemaining.toFixed(1)}%
            </Text>
            <Text dimColor>{resetText}</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <SelectInput
              items={[
                ...(usageData.tier !== "Max" ? [{ label: "⚡ Obtenir plus de puissance (Upgrade)", value: "upgrade" }] : []),
                { label: "🔙 Retour", value: "back" }
              ]}
              onSelect={(item) => {
                if (item.value === "back") onDone();
                else setView("select-tier");
              }}
            />
          </Box>
        </>
      )}

      {view === "select-tier" && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="cyan">Sélectionne le forfait à débloquer :</Text>
          <SelectInput
            items={[
              { label: "Plus — 5M tokens / semaine", value: "Plus" },
              { label: "Pro — 7M tokens / semaine", value: "Pro" },
              { label: "Max — 10M tokens / semaine", value: "Max" },
              { label: "🔙 Annuler", value: "back" }
            ]}
            onSelect={handleSelectTier}
          />
        </Box>
      )}

      {view === "enter-code" && (
        <Box marginTop={1} flexDirection="column">
          <Text>Entre ton code d'activation pour le forfait <Text bold color="yellow">{selectedTier}</Text> :</Text>
          <Box marginTop={1}>
            <Text>{">"} </Text>
            <TextInput value={code} onChange={setCode} onSubmit={handleCodeSubmit} />
          </Box>
          {statusMsg && (
            <Box marginTop={1}>
              <Text color={statusMsg.includes("Succès") ? "green" : statusMsg.includes("cours") ? "yellow" : "red"}>
                {statusMsg}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>Échap pour annuler</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
