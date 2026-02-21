/**
 * Voice Input Component
 * Speech-to-text input with Web Speech API and visual feedback
 * Using Tailwind CSS + Lucide Icons
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Mic,
  MicOff,
  Square,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

// Types
interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoSubmit?: boolean;
  submitDelay?: number;
  maxDuration?: number;
  showWaveform?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button' | 'full';
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Waveform visualization component
const AudioWaveform: React.FC<{ isActive: boolean; intensity: number }> = ({ isActive, intensity }) => {
  const bars = 5;
  const [heights, setHeights] = useState<number[]>(Array(bars).fill(8));

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(bars).fill(8));
      return;
    }

    const interval = setInterval(() => {
      setHeights(Array(bars).fill(0).map(() => {
        const randomFactor = (0.3 + Math.random() * 0.7) * intensity;
        return 8 + (24 * randomFactor);
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, intensity]);

  return (
    <div className="flex items-center gap-1 h-8">
      {heights.map((height, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full transition-all duration-100',
            isActive ? 'bg-primary' : 'bg-gray-400'
          )}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
};

// Main Component
const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onStart,
  onStop,
  onError,
  language = 'pt-BR',
  continuous = false,
  interimResults = true,
  autoSubmit = true,
  submitDelay = 1500,
  maxDuration = 60000,
  showWaveform = true,
  size = 'medium',
  variant = 'full'
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError('Reconhecimento de voz nao suportado neste navegador');
    }
  }, []);

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      onStart?.();
    };

    recognition.onend = () => {
      setIsListening(false);
      onStop?.();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);

        if (submitTimeoutRef.current) {
          clearTimeout(submitTimeoutRef.current);
        }

        if (autoSubmit) {
          submitTimeoutRef.current = setTimeout(() => {
            const fullTranscript = transcript + finalTranscript;
            if (fullTranscript.trim()) {
              onTranscript(fullTranscript.trim());
              setTranscript('');
              setInterimTranscript('');
            }
          }, submitDelay);
        }
      }

      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Erro no reconhecimento de voz';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Nenhuma fala detectada';
          break;
        case 'audio-capture':
          errorMessage = 'Microfone nao encontrado';
          break;
        case 'not-allowed':
          errorMessage = 'Permissao de microfone negada';
          break;
        case 'network':
          errorMessage = 'Erro de conexao';
          break;
        case 'aborted':
          errorMessage = 'Reconhecimento cancelado';
          break;
        default:
          errorMessage = `Erro: ${event.error}`;
      }

      setError(errorMessage);
      onError?.(errorMessage);
      setIsListening(false);
    };

    return recognition;
  }, [continuous, interimResults, language, autoSubmit, submitDelay, transcript, onStart, onStop, onTranscript, onError]);

  // Audio visualization
  const startAudioVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 32;

      const updateIntensity = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioIntensity(average / 255);

        animationFrameRef.current = requestAnimationFrame(updateIntensity);
      };

      updateIntensity();
    } catch (err) {
      console.error('Audio visualization error:', err);
    }
  }, []);

  const stopAudioVisualization = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setAudioIntensity(0);
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);

    recognitionRef.current = initRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();

        if (showWaveform) {
          startAudioVisualization();
        }

        durationIntervalRef.current = setInterval(() => {
          setDuration(prev => {
            if (prev >= maxDuration) {
              stopListening();
              return prev;
            }
            return prev + 1000;
          });
        }, 1000);
      } catch {
        setError('Erro ao iniciar reconhecimento');
      }
    }
  }, [isSupported, initRecognition, showWaveform, startAudioVisualization, maxDuration]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    stopAudioVisualization();

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
  }, [stopAudioVisualization]);

  // Manual submit
  const handleSubmit = () => {
    const fullTranscript = (transcript + interimTranscript).trim();
    if (fullTranscript) {
      onTranscript(fullTranscript);
      setTranscript('');
      setInterimTranscript('');
    }
    stopListening();
  };

  // Cancel
  const handleCancel = () => {
    setTranscript('');
    setInterimTranscript('');
    stopListening();
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Size configurations
  const sizeConfig = {
    small: { buttonSize: 'w-10 h-10', iconSize: 'w-4 h-4' },
    medium: { buttonSize: 'w-14 h-14', iconSize: 'w-6 h-6' },
    large: { buttonSize: 'w-18 h-18', iconSize: 'w-8 h-8' }
  };

  const config = sizeConfig[size];

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={!isSupported}
        className={cn(
          'p-2 rounded-lg transition-colors',
          isListening
            ? 'bg-danger-500 text-white'
            : 'hover:bg-surface-hover',
          !isSupported && 'opacity-50 cursor-not-allowed'
        )}
        title={isListening ? 'Parar' : 'Falar'}
      >
        {isListening ? (
          <MicOff className={config.iconSize} />
        ) : (
          <Mic className={config.iconSize} />
        )}
      </button>
    );
  }

  // Button variant
  if (variant === 'button') {
    return (
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={!isSupported}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          isListening
            ? 'bg-danger-500 text-white hover:bg-danger-600'
            : 'bg-primary text-white hover:bg-primary-dark',
          !isSupported && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isListening ? (
          <>
            <MicOff className="w-4 h-4" />
            <span>Parar</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            <span>Falar</span>
          </>
        )}
      </button>
    );
  }

  // Full variant
  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all',
      isListening
        ? 'border-primary border-2 shadow-lg'
        : 'border-border'
    )}>
      {!isSupported ? (
        <div className="flex items-center gap-2 p-3 bg-danger-500/10 text-danger-500 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">
            Reconhecimento de voz nao suportado. Use Chrome, Edge ou Safari.
          </span>
        </div>
      ) : (
        <>
          {/* Main control */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                config.buttonSize,
                'rounded-full flex items-center justify-center transition-all',
                isListening
                  ? 'bg-danger-500 text-white scale-110'
                  : 'bg-primary text-white hover:bg-primary-dark'
              )}
            >
              {isListening ? (
                <Square className={config.iconSize} />
              ) : (
                <Mic className={config.iconSize} />
              )}
            </button>

            {showWaveform && isListening && (
              <AudioWaveform isActive={isListening} intensity={audioIntensity} />
            )}
          </div>

          {/* Status */}
          <div className="text-center mt-4">
            {isListening ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
                  <span className="text-sm text-danger-500">
                    Gravando... {formatDuration(duration)}
                  </span>
                </div>

                {/* Transcript preview */}
                {(transcript || interimTranscript) && (
                  <div className="p-3 bg-surface-hover rounded-lg text-left">
                    <p className="text-sm">
                      {transcript}
                      <span className="text-foreground-muted italic">
                        {interimTranscript}
                      </span>
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={!transcript && !interimTranscript}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
                      transcript || interimTranscript
                        ? 'bg-success-500 text-white hover:bg-success-600'
                        : 'bg-surface-hover text-foreground-muted cursor-not-allowed'
                    )}
                  >
                    <Check className="w-4 h-4" />
                    Enviar
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-danger-500 border border-danger-500 rounded-lg hover:bg-danger-500/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">
                Clique para falar
              </p>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-danger-500/10 text-danger-500 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceInput;
