import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  currentText: string;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export function VoiceInput({ onTranscript, currentText }: VoiceInputProps) {
  const { bcp47, t } = useLang();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<unknown>(null);

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SR) {
      setSupported(false);
      return;
    }

    const rec = new SR();
    const recObj = rec as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: SpeechRecognitionEvent) => void) | null;
      onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    recObj.continuous = false;
    recObj.interimResults = true;
    recObj.lang = bcp47;

    recObj.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) {
        const base = currentText && !currentText.endsWith(' ') ? currentText + ' ' : currentText || '';
        onTranscript(base + finalText.trim());
      } else if (interimText) {
        const base = currentText && !currentText.endsWith(' ') ? currentText + ' ' : currentText || '';
        onTranscript(base + interimText);
      }
    };

    recObj.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(t('send.voiceError'));
      setListening(false);
    };

    recObj.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recObj;

    return () => {
      try {
        recObj.stop();
      } catch {
        // ignore
      }
    };
  }, [bcp47, onTranscript, currentText, t]);

  const toggleListening = useCallback(() => {
    if (!supported) {
      setError(t('send.voiceNotSupported'));
      return;
    }
    setError(null);
    const rec = recognitionRef.current as { start: () => void; stop: () => void } | null;
    if (!rec) return;

    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        setError(t('send.voiceError'));
      }
    }
  }, [listening, supported, t]);

  if (!supported && !error) {
    return (
      <button
        onClick={() => setError(t('send.voiceNotSupported'))}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-800/40 border border-ink-700/50 text-ink-500 text-sm cursor-not-allowed"
        title={t('send.voiceNotSupported')}
      >
        <MicOff size={16} />
        {!listening && <span className="hidden sm:inline">{t('send.tapToSpeak')}</span>}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={toggleListening}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${
          listening
            ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
            : 'bg-sui-500/10 border-sui-500/20 text-sui-400 hover:bg-sui-500/20'
        }`}
        title={listening ? t('send.listening') : t('send.tapToSpeak')}
      >
        {listening ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        <span className="hidden sm:inline">{listening ? t('send.listening') : t('send.tapToSpeak')}</span>
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
