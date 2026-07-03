"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import Lenis from "lenis";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

interface LenisProviderProps {
  children: ReactNode;
  root?: boolean;
  options?: Partial<Lenis["options"]>;
}

export function LenisProvider({ children, root = false, options }: LenisProviderProps) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    const lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    setLenis(lenisInstance);

    let rafId: number;
    function raf(time: number) {
      if (document.documentElement.dataset.overlayOpen === "true") {
        lenisInstance.stop();
      } else {
        lenisInstance.start();
        lenisInstance.raf(time);
      }
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenisInstance.destroy();
      setLenis(null);
    };
  }, []);

  return (
    <LenisContext.Provider value={lenis}>
      {children}
    </LenisContext.Provider>
  );
}
