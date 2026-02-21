import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const success = await login(email, password, requires2FA ? twoFactorCode : undefined);

    if (success === false && !error) {
      // 2FA required
      setRequires2FA(true);
      return;
    }

    if (success) {
      navigate(from, { replace: true });
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTwoFactorCode('');
    clearError();
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-surface rounded-2xl p-8 shadow-card border border-border">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {requires2FA ? 'Verificação em duas etapas' : 'Bem-vindo de volta'}
        </h2>
        <p className="text-foreground-muted mb-6">
          {requires2FA
            ? 'Digite o código do seu aplicativo autenticador'
            : 'Entre com suas credenciais para acessar o sistema'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg">
            <p className="text-danger-500 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!requires2FA ? (
            <>
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
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <button type="button" className="text-sm text-primary hover:text-primary-400 transition-colors">
                  Esqueceu a senha?
                </button>
              </div>
            </>
          ) : (
            /* 2FA Code */
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
                Código de verificação
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                <input
                  id="code"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  maxLength={6}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <p className="mt-2 text-sm text-foreground-muted">
                Abra o aplicativo Google Authenticator ou similar e digite o código de 6 dígitos.
              </p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
              'bg-primary hover:bg-primary-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Entrando...
              </>
            ) : requires2FA ? (
              'Verificar'
            ) : (
              'Entrar'
            )}
          </button>

          {requires2FA && (
            <button
              type="button"
              onClick={handleBack}
              className="w-full py-3 px-4 rounded-lg font-medium text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-all"
            >
              Voltar
            </button>
          )}
        </form>

        {!requires2FA && (
          <div className="mt-6 text-center">
            <p className="text-foreground-muted">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-primary hover:text-primary-400 font-medium transition-colors">
                Cadastre-se
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
