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
  const [step, setStep] = React.useState<'email' | 'username' | 'password'>('email');
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  useInput((input, key) => {
    if (loading) return;

    if (mode === 'select') {
      if (input === '1') {
        setMode('login');
        setStep('email');
        setErrorMsg(null);
      } else if (input === '2') {
        setMode('register');
        setStep('email');
        setErrorMsg(null);
      }
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
      }
    } else if (key.backspace || key.delete) {
      if (step === 'email') {
        setEmail(prev => prev.slice(0, -1));
      } else if (step === 'username') {
        setUsername(prev => prev.slice(0, -1));
      } else {
        setPassword(prev => prev.slice(0, -1));
      }
      setErrorMsg(null);
    } else if (input.length === 1 && !key.ctrl && !key.meta) {
      if (step === 'email') {
        setEmail(prev => prev + input);
      } else if (step === 'username') {
        setUsername(prev => prev + input);
      } else {
        setPassword(prev => prev + input);
      }
      setErrorMsg(null);
    }
  });

  async function submitForm() {
    setLoading(true);
    setErrorMsg(null);
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
      if (res.ok && data.token) {
        updateSettingsForSource('userSettings', {
          env: {
            MAI_TOKEN: data.token,
            OPENAI_API_KEY: data.token,
            OPENAI_BASE_URL: 'https://mprojects.val.run',
            CLAUDE_CODE_USE_OPENAI: '1',
          },
          modelType: 'openai',
        });
        process.env.MAI_TOKEN = data.token;
        process.env.OPENAI_API_KEY = data.token;
        process.env.OPENAI_BASE_URL = 'https://mprojects.val.run';
        process.env.CLAUDE_CODE_USE_OPENAI = '1';
        delete process.env.CLAUDE_CODE_USE_BEDROCK;
        delete process.env.AWS_BEARER_TOKEN_BEDROCK;
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
            <Text>{step === 'email' ? 'Email: ' : step === 'username' ? 'Username: ' : 'Password: '}</Text>
            <Text>
              {'> '}
              {step === 'email' ? email : step === 'username' ? username : '*'.repeat(password.length)}
            </Text>
          </Box>
        )}

        {errorMsg && (
          <Box marginTop={1}>
            <Text color={'red' as keyof Theme}>{errorMsg}</Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text color={'gray' as keyof Theme}>(Enter to submit, Esc to cancel)</Text>
        </Box>
      </Box>
    </Dialog>
  );
}
