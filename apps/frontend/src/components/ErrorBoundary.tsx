/**
 * Error Boundary Component
 * Catches and displays errors gracefully
 */

import React, { ReactNode, useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(event.error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const reset = () => {
    setError(null);
    setHasError(false);
  };

  if (hasError && error) {
    if (fallback) {
      return <>{fallback(error, reset)}</>;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <AlertCircle className="text-red-600" size={32} />
            <h1 className="text-2xl font-bold text-red-600">Algo deu errado</h1>
          </div>

          <p className="text-gray-700 mb-4">
            Um erro inesperado ocorreu. Por favor, tente novamente.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 text-sm max-h-40 overflow-auto">
              <p className="font-mono text-red-600 text-xs">{error.message}</p>
              {error.stack && (
                <pre className="text-red-500 text-xs mt-2 overflow-x-auto">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={18} />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
