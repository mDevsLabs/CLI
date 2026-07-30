import * as React from 'react';
import { Box, Dialog, Text, useInput } from '@anthropic/ink';
import { updateSettingsForSource } from '../../utils/settings/settings.js';
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js';
import type { Theme } from '@anthropic/ink';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import type { LocalJSXCommandContext } from '../../commands.js';

export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return (
    <Login
      onDone={async success => {
        if (success) {
          applyConfigEnvironmentVariables();
          context.setAppState(prev => ({
            ...prev,
            authVersion: prev.authVersion + 1,
          }));
        }
        onDone(success ? 'Login successful' : 'Login cancelled');
      }}
    />
  );
}

export function Login(props: { onDone: (success: boolean) => void }): React.ReactNode {
  const [mode, setMode] = React.useState<'select' | 'login' | 'register'>('select');
  const [step, setStep] = React.useState<'email' | 'username' | 'password' | 'code'>('email');
  const [email, setEmail] = React.useState('');
  const [verifiedEmail, setVerifiedEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  useInput((input, key) => {
    if (loading) return;

    if (mode === 'select') {
      if (input === '1') {
        setMode('login');
        setStep('email');
        setErrorMsg(null);
        setInfoMsg(null);
      } else if (input === '2') {
        setMode('register');
        setStep('email');
        setErrorMsg(null);
        setInfoMsg(null);
      }
      return;
    }

    if (key.ctrl && (input === 'r' || input === 'R') && step === 'code') {
      void resendCode();
      return;
    }

    if (key.return) {
      if (step === 'email') {
        if (!email.trim()) {
          setErrorMsg('Email cannot be empty');
          return;
        }
        setErrorMsg(null);
        setStep(mode === 'register' ? 'username' : 'password');
      } else if (step === 'username') {
        if (!username.trim()) {
          setErrorMsg('Username cannot be empty');
          return;
        }
        setErrorMsg(null);
        setStep('password');
      } else if (step === 'password') {
        if (!password) {
          setErrorMsg('Password cannot be empty');
          return;
        }
        void submitForm();
      } else if (step === 'code') {
        if (!code.trim() || code.trim().length !== 6) {
          setErrorMsg('Please enter a valid 6-digit code');
          return;
        }
        void submitVerificationCode();
      }
    } else if (key.backspace || key.delete) {
      if (step === 'email') {
        setEmail(prev => prev.slice(0, -1));
      } else if (step === 'username') {
        setUsername(prev => prev.slice(0, -1));
      } else if (step === 'password') {
        setPassword(prev => prev.slice(0, -1));
      } else if (step === 'code') {
        setCode(prev => prev.slice(0, -1));
      }
      setErrorMsg(null);
    } else if (input.length === 1 && !key.ctrl && !key.meta) {
      if (step === 'email') {
        setEmail(prev => prev + input);
      } else if (step === 'username') {
        setUsername(prev => prev + input);
      } else if (step === 'password') {
        setPassword(prev => prev + input);
      } else if (step === 'code') {
        if (/[0-9]/.test(input) && code.length < 6) {
          setCode(prev => prev + input);
        }
      }
      setErrorMsg(null);
    }
  });

  function handleSaveToken(token: string) {
    updateSettingsForSource('userSettings', {
      env: {
        MAI_TOKEN: token,
        OPENAI_API_KEY: token,
        OPENAI_BASE_URL: 'https://mprojects.val.run',
        CLAUDE_CODE_USE_OPENAI: '1',
      },
      modelType: 'openai',
    });
    process.env.MAI_TOKEN = token;
    process.env.OPENAI_API_KEY = token;
    process.env.OPENAI_BASE_URL = 'https://mprojects.val.run';
    process.env.CLAUDE_CODE_USE_OPENAI = '1';
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
  }

  async function submitForm() {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const endpoint = mode === 'login' ? 'https://mprojects.val.run/login' : 'https://mprojects.val.run/register';
      const body =
        mode === 'login'
          ? { email: email.trim(), password }
          : { email: email.trim(), username: username.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.status === 'verification_required') {
        const targetEmail = data.email || email.trim();
        setVerifiedEmail(targetEmail);
        setStep('code');
        setInfoMsg(`A 6-digit code has been sent to ${targetEmail}.`);
        setLoading(false);
      } else if (res.ok && data.token) {
        handleSaveToken(data.token);
        props.onDone(true);
      } else {
        setErrorMsg(data.error || (mode === 'login' ? 'Login failed' : 'Registration failed'));
        setStep('email');
        setPassword('');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg('Network error');
      setStep('email');
      setPassword('');
      setLoading(false);
    }
  }

  async function submitVerificationCode() {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const targetEmail = verifiedEmail || email.trim();
      const endpoint =
        mode === 'login' ? 'https://mprojects.val.run/verify-login' : 'https://mprojects.val.run/verify-register';
      const body =
        mode === 'login'
          ? { email: targetEmail, code: code.trim() }
          : { email: targetEmail, username: username.trim(), password, code: code.trim() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        handleSaveToken(data.token);
        props.onDone(true);
      } else {
        setErrorMsg(data.error || 'Code verification failed');
        setCode('');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg('Network error');
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const targetEmail = verifiedEmail || email.trim();
      const res = await fetch('https://mprojects.val.run/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, action: mode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInfoMsg(`A new code was sent to ${targetEmail}`);
      } else {
        setErrorMsg(data.error || 'Failed to resend code');
      }
    } catch (err) {
      setErrorMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog title="mAI Authentication" onCancel={() => props.onDone(false)} color="permission">
      <Box flexDirection="column">
        {loading ? (
          <Box marginTop={1}>
            <Text>Processing...</Text>
          </Box>
        ) : mode === 'select' ? (
          <Box flexDirection="column" marginTop={1}>
            <Text>Choose an option:</Text>
            <Text>1. Log in</Text>
            <Text>2. Register</Text>
            <Box marginTop={1}>
              <Text>{'> '}</Text>
            </Box>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column">
            <Text bold>{mode === 'login' ? 'Login' : 'Register'}</Text>
            {step === 'code' ? (
              <>
                <Text>Verification Code (6 digits): </Text>
                <Text>
                  {'> '}
                  {code}
                </Text>
              </>
            ) : (
              <>
                <Text>{step === 'email' ? 'Email: ' : step === 'username' ? 'Username: ' : 'Password: '}</Text>
                <Text>
                  {'> '}
                  {step === 'email' ? email : step === 'username' ? username : '*'.repeat(password.length)}
                </Text>
              </>
            )}
          </Box>
        )}

        {infoMsg && (
          <Box marginTop={1}>
            <Text color={'green' as keyof Theme}>{infoMsg}</Text>
          </Box>
        )}

        {errorMsg && (
          <Box marginTop={1}>
            <Text color={'red' as keyof Theme}>{errorMsg}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text color={'gray' as keyof Theme}>
            {step === 'code'
              ? '(Enter to verify code, Ctrl+R to resend code, Esc to cancel)'
              : '(Enter to submit, Esc to cancel)'}
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}
