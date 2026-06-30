import { useState, useEffect } from 'react';

export function useVisualViewport() {
  const [vp, setVp] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => {
      if (window.visualViewport) {
        setVp({ width: window.visualViewport.width, height: window.visualViewport.height });
      } else {
        setVp({ width: window.innerWidth, height: window.innerHeight });
      }
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    return () => window.visualViewport?.removeEventListener('resize', update);
  }, []);
  return vp;
}
