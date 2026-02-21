import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Loader2, Check, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Password requirements
  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /\d/.test(password) },
    { label: 'Caractere especial', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const isPasswordValid = passwordRequirements.every((req) => req.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!isPasswordValid) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    if (!acceptTerms) {
      return;
    }

    const success = await register(email, password, name);

    if (success) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-surface rounded-2xl p-8 shadow-card border border-border">
        <h2 className="text-2xl font-bold text-foreground mb-2">Criar conta</h2>
        <p className="text-foreground-muted mb-6">
          Preencha seus dados para criar uma nova conta
        </p>

        {error && (
          <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
            <p className="text-danger-500 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password requirements */}
            {password.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      req.met ? 'text-success-500' : 'text-foreground-muted'
                    )}
                  >
                    {req.met ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    {req.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={cn(
                  'w-full pl-10 pr-12 py-3 bg-background border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-success-500 focus:ring-success-500'
                      : 'border-danger-500 focus:ring-danger-500'
                    : 'border-border focus:ring-primary'
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-xs text-danger-500">As senhas não coincidem</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3">
            <input
              id="terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="terms" className="text-sm text-foreground-muted cursor-pointer">
              Li e aceito os{' '}
              <button type="button" className="text-primary hover:text-primary-400">
                Termos de Uso
              </button>{' '}
              e a{' '}
              <button type="button" className="text-primary hover:text-primary-400">
                Política de Privacidade
              </button>
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || !isPasswordValid || !passwordsMatch || !acceptTerms}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
              'bg-primary hover:bg-primary-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-foreground-muted">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:text-primary-400 font-medium transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
