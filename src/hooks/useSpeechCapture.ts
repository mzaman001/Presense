"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Voice capture through the browser's own speech recognition (Chrome, Edge,
 * Safari on iOS/macOS). Speaking was about 3x faster than typing on a phone
 * in Ruan et al.; voice sits next to the keyboard, never instead of it.
 *
 * Firefox has no recognition API, so `supported` is false there and callers
 * hide the button. Chrome sends the audio to Google's servers to transcribe;
 * Safari uses Apple's. Nothing is recorded or stored by Presense.
 */

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

export type SpeechError = "denied" | "no-speech" | "failed";

export function useSpeechCapture({
  onTranscript,
  onError,
}: {
  /** The full transcript so far (final + in-progress words). */
  onTranscript: (text: string) => void;
  onError?: (error: SpeechError) => void;
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => recognitionCtor() !== undefined,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const callbacks = useRef({ onTranscript, onError });
  useEffect(() => {
    callbacks.current = { onTranscript, onError };
  }, [onTranscript, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      callbacks.current.onTranscript(
        `${finalText}${interim}`.replace(/\s+/g, " ").trim(),
      );
    };
    recognition.onerror = (e) => {
      const error: SpeechError =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "denied"
          : e.error === "no-speech"
            ? "no-speech"
            : "failed";
      // "aborted" is our own stop on unmount; not worth reporting.
      if (e.error !== "aborted") callbacks.current.onError?.(error);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      callbacks.current.onError?.("failed");
    }
  }, []);

  // Never leave the microphone on after the capture closes.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
