import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Gradient from "ink-gradient";
import { loadAuthState, updateTier, TIER_LIMITS, type Tier } from "../services/authStore.js";

interface UsageViewProps {
  onDone: () => void;
}

export function UsageView({ onDone }: UsageViewProps) {
  const [authState, setAuthState] = useState(loadAuthState());
  const [view, setView] = useState<"stats" | "select-tier" | "enter-code">("stats");
  const [selectedTier, setSelectedTier] = useState<Tier>("Plus");
  const [code, setCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setAuthState(loadAuthState());
  }, []);

  const limit = TIER_LIMITS[authState.tier];
  const used = authState.tokensUsed;
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
    ? `Réinitialisation dans ${diffDays} jour${diffDays > 1 ? 's' : ''} et ${diffHours} heure${diffHours > 1 ? 's' : ''}.`
    : `Réinitialisation dans ${diffHours} heure${diffHours > 1 ? 's' : ''}.`;

  const handleSelectTier = (item: any) => {
    if (item.value === "back") {
      setView("stats");
    } else {
      setSelectedTier(item.value as Tier);
      setView("enter-code");
    }
  };

  const handleCodeSubmit = async (val: string) => {
    setIsLoading(true);
    setStatusMsg("Vérification en cours... ⏳");
    try {
      // Assuming Val Town proxy is at the URL mentioned
      const res = await fetch("https://mai-usage.val.run/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: val.trim() })
      });
      
      const data = await res.json();
      if (res.ok && data.tier) {
        updateTier(data.tier as Tier);
        setAuthState(loadAuthState());
        setStatusMsg(`Succès ! Tu es maintenant en forfait ${data.tier} 🌟`);
        setTimeout(() => setView("stats"), 2000);
      } else {
        setStatusMsg(`Erreur : ${data.error || "Code invalide"}`);
      }
    } catch (e) {
      setStatusMsg("Erreur réseau lors de la vérification.");
    } finally {
      setIsLoading(false);
    }
  };

  useInput((ch, key) => {
    if (key.escape) {
      if (view === "enter-code") setView("select-tier");
      else if (view === "select-tier") setView("stats");
      else onDone();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Gradient name="pastel">
        <Text bold>📊 Utilisation mAI CLI</Text>
      </Gradient>
      
      {view === "stats" && (
        <>
          <Box marginTop={1} flexDirection="column">
            <Text>Forfait actuel : <Text bold color="yellow">{authState.tier}</Text></Text>
            <Text>Tokens utilisés : {used.toLocaleString()} / {limit.toLocaleString()}</Text>
            <Text color={percentRemaining < 20 ? "red" : "green"}>
              Restant : [{bar}] {percentRemaining.toFixed(1)}%
            </Text>
            <Text dimColor>{resetText}</Text>
          </Box>
          
          <Box marginTop={1} flexDirection="column">
            <SelectInput
              items={[
                { label: "⚡ Obtenir plus de puissance (Upgrade)", value: "upgrade" },
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
              { label: "Plus (5M tokens)", value: "Plus" },
              { label: "Pro (7M tokens)", value: "Pro" },
              { label: "Max (10M tokens)", value: "Max" },
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
            <Text>{"> "} </Text>
            <TextInput value={code} onChange={setCode} onSubmit={handleCodeSubmit} />
          </Box>
          {statusMsg && (
            <Box marginTop={1}>
              <Text color={statusMsg.includes("Succès") ? "green" : "red"}>{statusMsg}</Text>
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
