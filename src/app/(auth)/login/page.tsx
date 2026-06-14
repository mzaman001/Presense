"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Globe2, Mail, Loader2, Sparkles, ArrowRight, Brain, Zap, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [initError, setInitError] = useState<string | null>(null);
  
  const [supabase] = useState(() => {
    try {
      return createClient();
    } catch (err: any) {
      console.error("Supabase init error:", err);
      return null as any;
    }
  });

  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    console.log("🚀 LOGIN PAGE FULLY HYDRATED AND MOUNTED");
    if (!supabase) {
      setInitError("Supabase failed to initialize. If you recently added .env.local, please restart your Next.js dev server.");
    }
  }, [supabase]);

  const handleGoogle = async () => {
    if (!supabase) {
      setError("Supabase not initialized");
      return;
    }
    setLoading("google");
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase not initialized");
      return;
    }
    if (!email.trim()) return;
    setLoading("email");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
    }
    setLoading(null);
  };

  const slides = [
    {
      title: "Your brain is for thinking.",
      desc: "Not for storing. Presense offloads your memory so you can focus on the present. Tasks, thoughts, and what people said — captured instantly.",
      icon: <Brain className="w-10 h-10 text-[#8B7CF8]" />,
      color: "#8B7CF8",
    },
    {
      title: "The app comes to you.",
      desc: "No more forgetting to check your lists. Presense reaches out to you with smart nudges, meeting briefings, and deadline escalations.",
      icon: <BellRing className="w-10 h-10 text-[#F472B6]" />,
      color: "#F472B6",
    },
    {
      title: "One step, not the mountain.",
      desc: "Stop procrastinating. Presense breaks down tasks into single physical actions and uses 10-minute timers to build momentum instantly.",
      icon: <Zap className="w-10 h-10 text-[#2DD4BF]" />,
      color: "#2DD4BF",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0914] relative overflow-hidden font-sans">
      {/* Ambient Orbs - replaced motion.div with pure CSS animations to prevent hydration crash */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute rounded-full animate-pulse"
          style={{ width: 800, height: 800, top: "-20%", left: "-10%", backgroundColor: "#5B21B6", filter: "blur(120px)", opacity: 0.5, animationDuration: '12s' }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{ width: 600, height: 600, bottom: "-20%", right: "-10%", backgroundColor: "#0D9488", filter: "blur(120px)", opacity: 0.4, animationDuration: '15s' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {initError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-200 text-sm font-medium">
            ⚠️ {initError}
          </div>
        )}
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B7CF8] to-[#DB2777] flex items-center justify-center shadow-lg shadow-purple-500/20">
            <div className="w-5 h-5 bg-white rounded-full" />
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-white tracking-tight">Presense</span>
            <p className="text-[11px] text-[rgba(255,255,255,0.4)] tracking-widest uppercase mt-1 font-semibold">Your External Brain</p>
          </div>
        </div>

        <div className="relative transition-all duration-300">
          {step < slides.length ? (
            /* Onboarding Slides */
            <div
              key={`slide-${step}`}
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 text-center shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 32px 64px rgba(0,0,0,0.5)" }}
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] flex items-center justify-center mb-6 transition-all duration-300"
                style={{ boxShadow: `inset 0 0 40px ${slides[step].color}20` }}>
                {slides[step].icon}
              </div>
              <h1 className="text-[22px] font-semibold text-white tracking-tight mb-3 transition-all duration-300">
                {slides[step].title}
              </h1>
              <p className="text-[15px] text-[rgba(255,255,255,0.6)] leading-relaxed mb-10 transition-all duration-300">
                {slides[step].desc}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {slides.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-300 ${i === step ? "bg-white" : "bg-[rgba(255,255,255,0.15)]"}`} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      setStep((prev) => prev + 1);
                    } catch (err: any) {
                      alert("Error: " + err.message);
                    }
                  }}
                  className="relative z-50 pointer-events-auto flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold hover:bg-gray-200 active:scale-95 transition-all cursor-pointer shadow-xl"
                >
                  {step === slides.length - 1 ? "Get Started" : "Next"} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <div
              key="login"
              className="bg-[rgba(255,255,255,0.03)] backdrop-blur-3xl border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 32px 64px rgba(0,0,0,0.5)" }}
            >
              <div className="text-center mb-8">
                <h1 className="text-[22px] font-semibold text-white tracking-tight mb-2">Welcome to Presense.</h1>
                <p className="text-[14px] text-[rgba(255,255,255,0.5)]">Sign in to access your spaces.</p>
              </div>

              {emailSent ? (
                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-16 h-16 rounded-full bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.2)] flex items-center justify-center mx-auto mb-5">
                    <Mail className="w-8 h-8 text-[#2DD4BF]" />
                  </div>
                  <p className="text-white font-medium text-lg mb-2">Check your email</p>
                  <p className="text-[14px] text-[rgba(255,255,255,0.5)]">We sent a secure magic link to <span className="text-white">{email}</span></p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <button
                    onClick={handleGoogle}
                    disabled={!!loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-60 shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.15)]"
                  >
                    {loading === "google" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe2 className="w-5 h-5" />}
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[rgba(255,255,255,0.1)]" />
                    <span className="text-[10px] text-[rgba(255,255,255,0.3)] uppercase tracking-widest font-semibold">or email</span>
                    <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[rgba(255,255,255,0.1)]" />
                  </div>

                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3.5 text-white placeholder:text-[rgba(255,255,255,0.3)] outline-none focus:border-[#8B7CF8] focus:bg-[rgba(139,124,248,0.05)] transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!!loading || !email.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[rgba(139,124,248,0.15)] border border-[rgba(139,124,248,0.3)] text-[#8B7CF8] font-semibold py-3.5 px-4 rounded-xl hover:bg-[rgba(139,124,248,0.25)] transition-all disabled:opacity-50"
                    >
                      {loading === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Send Magic Link
                    </button>
                  </form>

                  {error && <p className="text-sm text-[#F87171] text-center mt-4 bg-[rgba(248,113,113,0.1)] p-3 rounded-lg border border-[rgba(248,113,113,0.2)]">{error}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[rgba(255,255,255,0.25)] mt-8">
          100% Free forever. No subscriptions. No ads.
        </p>
      </div>
    </div>
  );
}
