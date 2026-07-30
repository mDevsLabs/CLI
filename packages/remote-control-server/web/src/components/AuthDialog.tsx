import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { apiLogin, apiRegister, type AuthResult } from '../api/client';
import { Phone, Mail, User, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the auth token once login/register succeeds. */
  onSuccess?: (result: AuthResult) => void;
}

type Mode = 'login' | 'register';

interface FieldState {
  username: string;
  email: string;
  phone: string;
  password: string;
}

const EMPTY: FieldState = { username: '', email: '', phone: '', password: '' };

export function AuthDialog({ open, onClose, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [fields, setFields] = useState<FieldState>(EMPTY);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = (key: keyof FieldState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, [key]: e.target.value }));
    setError(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setFields(EMPTY);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let result: AuthResult;
      if (mode === 'register') {
        result = await apiRegister({
          username: fields.username.trim(),
          email: fields.email.trim(),
          phone: fields.phone.trim() || undefined,
          password: fields.password,
        });
        setSuccess(`Compte créé ! Bienvenue, ${result.username} 🎉`);
      } else {
        // Login accepts username OR email
        const isEmail = fields.username.includes('@');
        result = await apiLogin({
          [isEmail ? 'email' : 'username']: fields.username.trim(),
          password: fields.password,
        });
        setSuccess(`Connecté en tant que ${result.username} ✓`);
      }
      onSuccess?.(result);
      setTimeout(() => {
        setFields(EMPTY);
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl border-border bg-surface-1 p-0 shadow-2xl overflow-hidden">
        {/* Header gradient strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand via-[#5769F7] to-brand" />

        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-text-primary">
              {isRegister ? 'Créer un compte' : 'Connexion'}
            </DialogTitle>
            <p className="text-sm text-text-muted">
              {isRegister ? 'Rejoignez mAI CLI Remote Control' : 'Accédez à votre tableau de bord'}
            </p>
          </DialogHeader>

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-surface-2 p-1 gap-1">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-200',
                  mode === m ? 'bg-surface-1 text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {m === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username / Email (shared field) */}
            <InputField
              id="auth-username"
              icon={<User className="h-4 w-4" />}
              type="text"
              placeholder={isRegister ? "Nom d'utilisateur" : "Nom d'utilisateur ou email"}
              value={fields.username}
              onChange={set('username')}
              required
            />

            {/* Email — register only */}
            {isRegister && (
              <InputField
                id="auth-email"
                icon={<Mail className="h-4 w-4" />}
                type="email"
                placeholder="Adresse email"
                value={fields.email}
                onChange={set('email')}
                required
              />
            )}

            {/* Phone — register only (optional) */}
            {isRegister && (
              <InputField
                id="auth-phone"
                icon={<Phone className="h-4 w-4" />}
                type="tel"
                placeholder="Téléphone (optionnel)"
                value={fields.phone}
                onChange={set('phone')}
              />
            )}

            {/* Password */}
            <div className="relative">
              <InputField
                id="auth-password"
                icon={<Lock className="h-4 w-4" />}
                type={showPwd ? 'text' : 'password'}
                placeholder="Mot de passe"
                value={fields.password}
                onChange={set('password')}
                required
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Error / Success banners */}
            {error && (
              <div className="rounded-lg bg-status-error/10 border border-status-error/20 px-3 py-2 text-sm text-status-error animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-status-active/10 border border-status-active/20 px-3 py-2 text-sm text-status-active animate-in fade-in slide-in-from-top-1 duration-200">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold',
                'bg-brand text-white hover:bg-brand-light transition-all duration-200',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'shadow-sm hover:shadow-md active:scale-[0.98]',
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isRegister ? "S'inscrire" : 'Se connecter'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shared input field with left icon
// ---------------------------------------------------------------------------
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  icon: React.ReactNode;
}

function InputField({ id, icon, className, ...props }: InputFieldProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{icon}</span>
      <input
        id={id}
        {...props}
        className={cn(
          'w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 py-2.5',
          'text-sm text-text-primary placeholder:text-text-muted',
          'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30',
          'transition-all duration-150',
          className,
        )}
      />
    </div>
  );
}
