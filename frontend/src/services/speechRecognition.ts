// Speech Recognition Service using Web Speech API with fallback
import { useCallback, useEffect, useRef, useState } from 'react';

// Declare Web Speech API types for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as IWindow;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export interface VoiceListenerCallbacks {
  onStart?: () => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export class SpeechService {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const win = window as unknown as IWindow;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'id-ID'; // Indonesian
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  public get supported(): boolean {
    return !!this.recognition;
  }

  public startListening(callbacks: VoiceListenerCallbacks): void {
    if (!this.recognition) {
      callbacks.onError?.('Browser ini belum mendukung Web Speech API. Silakan gunakan input teks alternatif.');
      return;
    }

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }

    this.recognition.onstart = () => {
      this.isListening = true;
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText) {
        callbacks.onTranscript?.(activeText, !!finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      let errorMsg = 'Gagal merekam suara.';
      if (event.error === 'not-allowed') {
        errorMsg = 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser Anda.';
      } else if (event.error === 'no-speech') {
        errorMsg = 'Suara tidak terdeteksi. Silakan coba bicara lebih jelas dekat mikrofon.';
      } else if (event.error === 'network') {
        errorMsg = 'Koneksi jaringan terganggu untuk speech recognition online.';
      }
      callbacks.onError?.(errorMsg);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      this.isListening = false;
      callbacks.onError?.(e.message || 'Tidak dapat memulai rekaman suara.');
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
  }
}

export const speechService = new SpeechService();

// ─────────────────────────────────────────────
//  React Hook wrapper
// ─────────────────────────────────────────────

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  onError: (error: string) => void;
}

export function useSpeechRecognition({ onResult, onError }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const startListening = useCallback(() => {
    setInterimText('');
    setIsListening(true);
    speechService.startListening({
      onStart: () => setIsListening(true),
      onTranscript: (text, isFinal) => {
        setInterimText(text);
        if (isFinal) {
          setIsListening(false);
          setInterimText('');
          onResultRef.current(text);
        }
      },
      onError: (err) => {
        setIsListening(false);
        setInterimText('');
        onErrorRef.current(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  }, []);

  const stopListening = useCallback(() => {
    speechService.stopListening();
    setIsListening(false);
  }, []);

  return {
    isSupported: speechService.supported,
    isListening,
    interimText,
    startListening,
    stopListening,
  };
}
