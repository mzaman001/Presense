import React from "react";

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Background base */}
      <div className="absolute inset-0 bg-[var(--color-background)] transition-colors duration-500" />

      {/* Orbs */}
      <div 
        className="absolute rounded-full mix-blend-screen opacity-45 animate-orb-breathe"
        style={{
          width: '700px', height: '700px', top: '-200px', left: '-200px',
          background: 'radial-gradient(circle, var(--orb-1) 0%, transparent 70%)', filter: 'blur(90px)',
          animationDuration: '12s'
        }}
      />
      <div 
        className="absolute rounded-full mix-blend-screen opacity-35 animate-orb-breathe"
        style={{
          width: '500px', height: '500px', top: '200px', right: '-150px',
          background: 'radial-gradient(circle, var(--orb-2) 0%, transparent 70%)', filter: 'blur(90px)',
          animationDuration: '14s'
        }}
      />
      <div 
        className="absolute rounded-full mix-blend-screen opacity-30 animate-orb-breathe"
        style={{
          width: '400px', height: '400px', bottom: '-100px', left: '30%',
          background: 'radial-gradient(circle, var(--orb-3) 0%, transparent 70%)', filter: 'blur(90px)',
          animationDuration: '16s'
        }}
      />
      <div 
        className="absolute rounded-full mix-blend-screen opacity-50 animate-orb-breathe"
        style={{
          width: '300px', height: '300px', bottom: '100px', right: '10%',
          background: 'radial-gradient(circle, var(--orb-4) 0%, transparent 70%)', filter: 'blur(90px)',
          animationDuration: '10s'
        }}
      />

      {/* Noise Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
