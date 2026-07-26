import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { login, loadAuthState, hashPassword, verifyPassword } from "../services/authStore.js";
import disposableDomains from "disposable-email-domains";

interface AuthViewProps {
  onDone: () => void;
}

export function AuthView({ onDone }: AuthViewProps) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmitEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed.includes("@")) {
      setError("Adresse email invalide. 🚫");
      return;
    }
    const domain = trimmed.split("@")[1];
    if (disposableDomains.includes(domain)) {
      setError("Les domaines d'email temporaires sont bloqués. 🚫");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleSubmitPassword = (val: string) => {
    if (val.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères. 🔒");
      return;
    }
    const state = loadAuthState();
    if (state.email && state.email === email.trim()) {
      if (!verifyPassword(val)) {
        setError("Mot de passe incorrect. 🚫");
        return;
      }
      login(email.trim(), state.passwordHash || hashPassword(val));
    } else {
      login(email.trim(), hashPassword(val));
    }
    onDone();
  };

  useInput((ch, key) => {
    if (key.escape) {
      onDone();
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text color="cyan" bold>🔐 Connexion / Inscription à mAI CLI</Text>
      
      {error && <Text color="red">{error}</Text>}
      
      {step === "email" && (
        <Box marginTop={1}>
          <Text>Email : </Text>
          <TextInput
            value={email}
            onChange={setEmail}
            onSubmit={handleSubmitEmail}
          />
        </Box>
      )}

      {step === "password" && (
        <Box marginTop={1}>
          <Text>Mot de passe : </Text>
          <TextInput
            value={password}
            onChange={setPassword}
            onSubmit={handleSubmitPassword}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Échap pour annuler • Entrée pour valider</Text>
      </Box>
    </Box>
  );
}
