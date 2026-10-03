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
 * Safari). Speaking was about 3x faster than typing on a phone in Ruan et
 * al.; voice sits next to the keyboard, never instead of it.
 *
 * Firefox has no recognition API, Brave and Edge on Android ship one with
 * no service behind it, Safari's breaks inside an installed iOS home-screen
 * app, and the microphone needs https or localhost. `supported` is false
 * in all of those and callers hide the button (the iOS keyboard's own
 * dictation key still works). Chrome recognises on the device when the
 * language pack is already installed;
 * otherwise it sends audio to Google, and Safari to Apple. Nothing is
 * recorded or stored by Presense.
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
  processLocally?: boolean;
  phrases?: unknown[];
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Availability =
  "available" | "downloadable" | "downloading" | "unavailable";
interface RecognitionCtor {
  new (): Recognition;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<Availability>;
}
type PhraseCtor = new (phrase: string, boost: number) => unknown;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** An installed home-screen app on iPhone/iPad, where recognition breaks. */
function isIosStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iP(?:hone|ad|od)/.test(nav.userAgent) ||
    (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
  if (!ios) return false;
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/**
 * Browsers that expose the recognition API with no speech service behind
 * it, so start() fails at once with no microphone prompt: Brave switches
 * Google's off, and Edge on Android ships none.
 */
function hasNoSpeechService(): boolean {
  const nav = navigator as Navigator & { brave?: unknown };
  return nav.brave !== undefined || /\bEdgA\//.test(nav.userAgent);
}

/**
 * "not-allowed" is also what a browser with no speech service says, so it
 * only means a blocked microphone when the permission really is blocked.
 * Without the Permissions API, assume it is.
 */
async function micBlocked(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    return status ? status.state === "denied" : true;
  } catch {
    return true;
  }
}

const recognitionLang = () => navigator.language || "en-US";

/** Whether on-device recognition is installed for `lang`; asked once. */
const localReady = new WeakMap<object, Map<string, Promise<boolean>>>();
function isLocalReady(Ctor: RecognitionCtor, lang: string): Promise<boolean> {
  const available = Ctor.available;
  if (!available) return Promise.resolve(false);
  const byLang = localReady.get(available) ?? new Map();
  localReady.set(available, byLang);
  let ready = byLang.get(lang);
  if (!ready) {
    ready = available.call(Ctor, { langs: [lang], processLocally: true }).then(
      (status) => status === "available",
      () => false,
    );
    byLang.set(lang, ready);
  }
  return ready;
}

/** Stop after this long with nothing new heard. */
export const SILENCE_MS = 8000;
/** How strongly the user's own words (categories) are preferred, 0–10. */
const PHRASE_BOOST = 3;

/**
 * One string per pause, in order; the last may still be in progress.
 * Android Chrome restates earlier results in continuous mode ("buy",
 * "buy milk"), so a result that starts with the previous one replaces it.
 */
export function readSegments(results: ArrayLike<RecognitionResult>): string[] {
  const segments: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0].transcript.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const prev = segments[segments.length - 1];
    if (prev !== undefined && text.toLowerCase().startsWith(prev.toLowerCase()))
      segments[segments.length - 1] = text;
    else segments.push(text);
  }
  return segments;
}

const noopSubscribe = () => () => {};

/**
 * "denied": the microphone is blocked. "unavailable": the browser has no
 * working speech service (its own setting, a language it can't do, or
 * offline), so asking the user to allow the microphone wouldn't help.
 */
export type SpeechError = "denied" | "unavailable" | "no-speech" | "failed";

/** The browser has no speech service; retrying this session won't help. */
const NO_SERVICE = new Set(["service-not-allowed", "language-not-supported"]);

export function useSpeechCapture({
  onSegments,
  onError,
  phrases = [],
}: {
  /** Everything heard so far, one string per pause. */
  onSegments: (segments: string[]) => void;
  onError?: (error: SpeechError) => void;
  /** Words to listen out for, such as the user's category names. */
  phrases?: string[];
}) {
  const usable = useSyncExternalStore(
    noopSubscribe,
    () =>
      recognitionCtor() !== undefined &&
      // The microphone only works on https or localhost.
      window.isSecureContext !== false &&
      !isIosStandalone() &&
      !hasNoSpeechService(),
    () => false,
  );
  const [noService, setNoService] = useState(false);
  const supported = usable && !noService;
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const localRef = useRef(false);
  const phrasesOkRef = useRef(true);
  const callbacks = useRef({ onSegments, onError, phrases });
  useEffect(() => {
    callbacks.current = { onSegments, onError, phrases };
  }, [onSegments, onError, phrases]);

  // Ask ahead of time, so start() never waits on it inside the tap.
  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!supported || !Ctor) return;
    let live = true;
    void isLocalReady(Ctor, recognitionLang()).then((ok) => {
      if (live) localRef.current = ok;
    });
    return () => {
      live = false;
    };
  }, [supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const open = () => {
      const recognition = new Ctor();
      recognition.lang = recognitionLang();
      recognition.continuous = true;
      recognition.interimResults = true;
      if (localRef.current) recognition.processLocally = true;

      const Phrase = (
        window as unknown as { SpeechRecognitionPhrase?: PhraseCtor }
      ).SpeechRecognitionPhrase;
      const words = callbacks.current.phrases;
      if (
        phrasesOkRef.current &&
        Phrase &&
        words.length &&
        "phrases" in recognition
      ) {
        try {
          recognition.phrases = words.map((w) => new Phrase(w, PHRASE_BOOST));
        } catch {
          phrasesOkRef.current = false;
        }
      }

      let idle: ReturnType<typeof setTimeout> | undefined;
      const armSilence = () => {
        clearTimeout(idle);
        idle = setTimeout(() => recognition.stop(), SILENCE_MS);
      };
      let retryWithoutPhrases = false;

      recognition.onresult = (e) => {
        armSilence();
        callbacks.current.onSegments(readSegments(e.results));
      };
      recognition.onerror = (e) => {
        if (e.error === "phrases-not-supported") {
          retryWithoutPhrases = true;
          return;
        }
        if (e.error === "not-allowed") {
          void micBlocked().then((blocked) => {
            if (!blocked) setNoService(true);
            callbacks.current.onError?.(blocked ? "denied" : "unavailable");
          });
          return;
        }
        if (NO_SERVICE.has(e.error)) setNoService(true);
        const error: SpeechError =
          NO_SERVICE.has(e.error) || e.error === "network"
            ? "unavailable"
            : e.error === "no-speech"
              ? "no-speech"
              : "failed";
        // "aborted" is our own stop on unmount; not worth reporting.
        if (e.error !== "aborted") callbacks.current.onError?.(error);
      };
      recognition.onend = () => {
        clearTimeout(idle);
        recognitionRef.current = null;
        if (retryWithoutPhrases) {
          phrasesOkRef.current = false;
          open();
          return;
        }
        setListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        armSilence();
        setListening(true);
      } catch {
        clearTimeout(idle);
        recognitionRef.current = null;
        setListening(false);
        callbacks.current.onError?.("failed");
      }
    };
    open();
  }, []);

  // Never leave the microphone on after the capture closes.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
