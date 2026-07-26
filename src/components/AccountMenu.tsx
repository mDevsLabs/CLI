import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { loadAuthState, updateProfile, verifyPassword, hashPassword, type AuthState } from "../services/authStore.js";

interface AccountMenuProps {
  authState: AuthState;
  onBack: () => void;
  onUpdate: (updatedState: AuthState) => void;
}

type EditField = "username" | "email" | "password";

export const AccountMenu: React.FC<AccountMenuProps> = ({ authState, onBack, onUpdate }) => {
  const [step, setStep] = useState<"select" | "new-value" | "current-password" | "submitting">("select");
  const [fieldToEdit, setFieldToEdit] = useState<EditField | null>(null);
  const [newValue, setNewValue] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      if (step === "select") {
        onBack();
      } else {
        setStep("select");
        setNewValue("");
        setCurrentPassword("");
        setError(null);
        setSuccessMsg(null);
      }
    }
  });

  const handleSelect = (item: { value: string }) => {
    if (item.value === "back") {
      onBack();
    } else {
      setFieldToEdit(item.value as EditField);
      setStep("new-value");
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleNewValueSubmit = () => {
    if (!newValue.trim()) {
      setError("La nouvelle valeur ne peut pas être vide.");
      return;
    }
    if (fieldToEdit === "email" && !newValue.includes("@")) {
      setError("Adresse e-mail invalide.");
      return;
    }
    if (fieldToEdit === "password" && newValue.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    setError(null);
    setStep("current-password");
  };

  const handlePasswordSubmit = async () => {
    if (!currentPassword) {
      setError("Veuillez entrer votre mot de passe actuel.");
      return;
    }
    setStep("submitting");
    setError(null);

    // Simulation of network delay or just to show the spinner briefly
    await new Promise(r => setTimeout(r, 500));

    if (!verifyPassword(currentPassword)) {
      setError("Mot de passe actuel incorrect.");
      setStep("current-password");
      return;
    }

    try {
      const updates: Partial<AuthState> = {};
      if (fieldToEdit === "email") updates.email = newValue.trim();
      if (fieldToEdit === "username") updates.username = newValue.trim();
      if (fieldToEdit === "password") updates.passwordHash = hashPassword(newValue);

      updateProfile(updates);
      const updatedState = loadAuthState();
      onUpdate(updatedState);

      setSuccessMsg("Profil mis à jour avec succès ! ✅");
      setStep("select");
      setNewValue("");
      setCurrentPassword("");
    } catch (err: any) {
      setError(err.message || "Erreur.");
      setStep("current-password");
    }
  };

  if (step === "select") {
    const items = [
      { label: `Nom d'utilisateur: ${authState.username || "Non défini"}`, value: "username" },
      { label: `E-mail: ${authState.email || "Non défini"}`, value: "email" },
      { label: `Mot de passe: ********`, value: "password" },
      { label: `🔙 Retour`, value: "back" }
    ];

    return (
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
        <Text bold>👤 Mon Profil (Sélectionnez un champ pour le modifier) :</Text>
        {successMsg && <Text color="green">{successMsg}</Text>}
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={handleSelect} />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">Modification de: {fieldToEdit}</Text>
      
      {step === "new-value" && (
        <Box marginTop={1}>
          <Text color="green">Nouvelle valeur : </Text>
          <TextInput
            value={newValue}
            onChange={setNewValue}
            onSubmit={handleNewValueSubmit}
            mask={fieldToEdit === "password" ? "*" : undefined}
          />
        </Box>
      )}

      {(step === "current-password" || step === "submitting") && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Nouvelle valeur : {fieldToEdit === "password" ? "****" : newValue}</Text>
          <Box marginTop={1}>
            <Text color="green">Mot de passe ACTUEL : </Text>
            <TextInput
              value={currentPassword}
              onChange={setCurrentPassword}
              onSubmit={handlePasswordSubmit}
              mask="*"
            />
          </Box>
        </Box>
      )}

      {step === "submitting" && (
        <Box marginTop={1}>
          <Text color="yellow"><Spinner type="dots" /> Mise à jour en cours...</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text dimColor>Échap pour annuler</Text>
      </Box>
    </Box>
  );
}
