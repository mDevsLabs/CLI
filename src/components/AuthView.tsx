import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import disposableDomains from "disposable-email-domains";
import { apiLogin, apiRegister } from "../services/apiClient.js";
import { loadAuthState } from "../services/authStore.js";

interface AuthViewProps {
  onDone: () => void;
}

type Step = "email" | "password" | "loading";
type Mode = "login" | "register";

export function AuthView({ onDone }: AuthViewProps) {
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmitEmail = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed.includes("@") || trimmed.length < 5) {
      setError("Adresse email invalide. 🚫");
      return;
    }
    const domain = trimmed.split("@")[1];
    if (disposableDomains.includes(domain)) {
      setError("Les domaines d'email temporaires sont bloqués. 🚫");
      return;
    }
    setError("");
    setEmail(trimmed);
    setStep("password");
  };

  const handleSubmitPassword = async (val: string) => {
    if (val.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères. 🔒");
      return;
    }
    setPassword(val);
    setError("");
    setStep("loading");

    try {
      let res;
      if (mode === "login") {
        res = await apiLogin(email, val);
      } else {
        res = await apiRegister(email, val);
      }

      if (res.error) {
        // Si erreur 409 en register → tenter login automatiquement
        if (res.status === 409 && mode === "register") {
          setInfo("Compte existant détecté, connexion en cours...");
          const loginRes = await apiLogin(email, val);
          if (loginRes.error) {
            setError(loginRes.error);
            setStep("password");
            return;
          }
        } else if (res.status === 401 && mode === "login") {
          // Le compte n'existe pas encore → créer
          setInfo("Nouveau compte, création en cours...");
          const regRes = await apiRegister(email, val);
          if (regRes.error) {
            setError(regRes.error);
            setStep("password");
            return;
          }
        } else {
          setError(res.error);
          setStep("password");
          return;
        }
      }

      // Succès
      onDone();
    } catch (err: any) {
      setError("Erreur réseau. Vérifiez votre connexion.");
      setStep("password");
    }
  };

  useInput((ch, key) => {
    if (key.escape && step !== "loading") {
      onDone();
    }
  });

  const isConnected = !!loadAuthState().authToken;

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text color="cyan" bold>🔐 {isConnected ? "Reconnexion à" : "Connexion /"} mAI CLI</Text>
      <Text dimColor>Entrez votre email pour vous connecter ou créer un compte.</Text>

      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}
      {info && !error && (
        <Box marginTop={1}>
          <Text color="yellow">ℹ {info}</Text>
        </Box>
      )}

      {step === "email" && (
        <Box marginTop={1}>
          <Text>Email : </Text>
          <TextInput
            value={email}
            onChange={setEmail}
            onSubmit={handleSubmitEmail}
            placeholder="votre@email.com"
          />
        </Box>
      )}

      {step === "password" && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Email : {email}</Text>
          <Box marginTop={1}>
            <Text>Mot de passe : </Text>
            <TextInput
              value={password}
              onChange={setPassword}
              onSubmit={handleSubmitPassword}
              placeholder="Min. 6 caractères"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              Pas encore de compte ? Entrez votre email + un nouveau mot de passe pour vous inscrire.
            </Text>
          </Box>
        </Box>
      )}

      {step === "loading" && (
        <Box marginTop={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text> {info || "Authentification en cours..."}</Text>
        </Box>
      )}

      {step !== "loading" && (
        <Box marginTop={1}>
          <Text dimColor>Échap pour annuler • Entrée pour valider</Text>
        </Box>
      )}
    </Box>
  );
}
