"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Command,
  Smartphone,
  CheckCircle2,
  Settings,
  History,
  UserCheck,
  Eye,
  Share2,
  ArrowRight,
  HelpCircle,
  Bot,
  BarChart3,
  TrendingUp,
  Trash2,
  Plus,
  GripVertical,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { supabase } from "../lib/supabase";

function getAnimalAvatar(email: string | undefined) {
  if (!email) return "/avatars/panda.png";
  const animals = ["cat", "fox", "panda"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % animals.length;
  return `/avatars/${animals[index]}.png`;
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ email?: string } | null>(null);

  const [typingProgress, setTypingProgress] = useState<{
    title: string;
    intro: string;
    question: string;
    options: string[];
  }>({
    title: "",
    intro: "",
    question: "",
    options: []
  });

  const fullContent = {
    title: "Breaking Bad Review Extravaganza!",
    intro: "Hey friends! Let's settle this once and for all: how much did you REALLY love Breaking Bad? Spill the beans!",
    question: "Who was your absolute favorite character? (No wrong answers, but some are more right than others 😉) *",
    options: [
      "Walter White (Heisenberg, yo!)",
      "Jesse Pinkman (Yeah, science!)",
      "Saul Goodman (Better Call Saul!)",
      "Skyler White (Someone had to keep things together...ish)",
      "Hank Schrader (ASAC Schrader, reporting for duty!)",
      "Gus Fring (Cool, calm, collected... and terrifying)",
      "Other (Tell us who in the next question!)"
    ]
  };

  useEffect(() => {
    let active = true;

    const startTyping = async () => {
      while (active) {
        // Reset
        setTypingProgress({ title: "", intro: "", question: "", options: [] });
        await new Promise((r) => setTimeout(r, 1000));
        if (!active) break;

        // Type Title
        for (let i = 0; i <= fullContent.title.length; i++) {
          setTypingProgress(prev => ({ ...prev, title: fullContent.title.slice(0, i) }));
          await new Promise((r) => setTimeout(r, 30));
          if (!active) break;
        }
        await new Promise((r) => setTimeout(r, 500));
        if (!active) break;

        // Type Intro
        for (let i = 0; i <= fullContent.intro.length; i++) {
          setTypingProgress(prev => ({ ...prev, intro: fullContent.intro.slice(0, i) }));
          await new Promise((r) => setTimeout(r, 15));
          if (!active) break;
        }
        await new Promise((r) => setTimeout(r, 500));
        if (!active) break;

        // Type Question
        for (let i = 0; i <= fullContent.question.length; i++) {
          setTypingProgress(prev => ({ ...prev, question: fullContent.question.slice(0, i) }));
          await new Promise((r) => setTimeout(r, 20));
          if (!active) break;
        }
        await new Promise((r) => setTimeout(r, 500));
        if (!active) break;

        // Render Options one by one
        for (let optIdx = 0; optIdx < fullContent.options.length; optIdx++) {
          const opt = fullContent.options[optIdx];
          for (let i = 0; i <= opt.length; i++) {
            setTypingProgress(prev => {
              const newOpts = [...prev.options];
              newOpts[optIdx] = opt.slice(0, i);
              return { ...prev, options: newOpts };
            });
            await new Promise((r) => setTimeout(r, 15));
            if (!active) break;
          }
          await new Promise((r) => setTimeout(r, 200));
          if (!active) break;
        }

        // Pause at the end before restarting
        await new Promise((r) => setTimeout(r, 6000));
      }
    };

    startTyping();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        setUserProfile({
          email: data.user.email,
        });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setUserProfile(null);
  };


  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;
      if (totalScrollable <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / totalScrollable));
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Device morph interpolations
  const currentWidth  = 900 - (900 - 300) * scrollProgress;
  const currentHeight = 540 - (540 - 620) * scrollProgress;
  const currentRadius = 10 + (44 - 10) * scrollProgress;
  const currentBorder = 12  - (12 - 6)  * scrollProgress;
  const desktopOpacity = Math.max(0, 1 - scrollProgress * 2.4);
  const mobileOpacity  = Math.max(0, (scrollProgress - 0.42) * 2.4);
  // Border colour blends from silver (desktop) to near-black (phone)
  const borderGray = Math.round(180 - 170 * scrollProgress);
  const borderColor = `rgb(${borderGray},${borderGray},${borderGray})`;

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">

      {/* ── Nav ─────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-2xl">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-md flex items-center justify-center">
              <span className="text-white text-[10px] font-black tracking-tighter">FT</span>
            </div>
            <span className="font-semibold text-zinc-900 text-base tracking-tight">FieldTally</span>
          </div>

          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors tracking-wide">Features</a>
            <a href="#interactive-demo" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors tracking-wide">Demo</a>
            <a href="#workflow" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors tracking-wide">How it works</a>
          </div>

          <div className="flex items-center gap-4">
            {userId ? (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="relative w-7 h-7 rounded-full border border-zinc-200 overflow-hidden hover:ring-2 hover:ring-zinc-200 transition-all group focus:outline-none" title={userProfile?.email}>
                    <img src={getAnimalAvatar(userProfile?.email)} alt="Profile" className="w-full h-full object-cover bg-zinc-50" />
                  </button>
                </Popover.Trigger>
                <Popover.Content align="end" sideOffset={8} className="w-56 p-2 rounded-xl border border-zinc-200 bg-white shadow-xl z-[150] outline-none">
                  <div className="px-3 py-2 border-b border-zinc-100 mb-2">
                    <p className="text-xs font-medium text-zinc-900 truncate">{userProfile?.email || 'Logged in'}</p>
                  </div>
                  <Link 
                    href="/dashboard" 
                    className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors block"
                  >
                    My Forms
                  </Link>
                  <button 
                    onClick={handleLogout} 
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </Popover.Content>
              </Popover.Root>
            ) : (
              <Link href="/login" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors">
                Log In
              </Link>
            )}
            <Link
              href="/create-form"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              Create a Form
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <header className="relative pt-40 pb-32 flex flex-col items-center px-8 overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        {/* Soft radial glow from top */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-64 bg-gradient-to-b from-violet-100/60 to-blue-500 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-full h-[65vh] text-center flex flex-col items-center justify-center">

          {/* Headline */}
          <h1 className="text-[2.75rem] sm:text-5xl font-bold text-zinc-950 tracking-tight leading-[1.1] mb-5">
            Build{" "}
            {/* "beautiful" — handwritten-italic serif, larger, with coloured underline */}
            <span
              className="relative inline-block"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic", fontWeight: 700 }}
            >
              <span
                className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent"
              >
                beautiful
              </span>
              {/* Hand-drawn underline SVG */}
              <svg
                viewBox="0 0 160 10"
                className="absolute left-0 -bottom-1 w-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 7 Q40 2 80 6 Q120 10 158 4"
                  fill="none"
                  stroke="url(#ug)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="ug" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="50%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            {" "}forms<br className="hidden sm:inline" />
            <span className="text-zinc-400 font-medium"> and collect data from anywhere.</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-500 mb-12 max-w-lg mx-auto leading-relaxed font-normal">
            A Notion-style block editor powered by AI. Create unlimited forms and run unlimited collections — all built from scratch or generated conversationally.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/create-form"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-zinc-900/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              Create a Form
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Interactive Morphing Device ───────────────── */}
      <section
        id="interactive-demo"
        ref={containerRef}
        className="relative h-[220vh] w-full"
        style={{ background: "linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)" }}
      >
        <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden py-12">

          {/* Very subtle ambient glow behind device */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(ellipse, rgba(139,92,246,${0.06 - scrollProgress * 0.04}), transparent 70%)`,
              filter: "blur(60px)",
            }}
          />

          {/* Label above device */}
          <div className="text-center mb-10 z-10 max-w-sm px-6">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Interactive Demo
            </p>
            <div className="h-6 overflow-hidden relative">
              <div
                className="flex flex-col transition-transform duration-500 ease-in-out"
                style={{ transform: `translateY(-${scrollProgress >= 0.5 ? 100 : 0}%)` }}
              >
                <span className="text-sm font-medium text-zinc-700 h-6 leading-6">Notion-style form builder — on desktop</span>
                <span className="text-sm font-medium text-zinc-700 h-6 leading-6">Respondent view — on mobile</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5">Scroll down to watch the device transform</p>
          </div>

          {/* Device shell */}
          <div className="relative flex items-center justify-center w-full flex-1 max-h-[640px] px-6">
            <div
              className="relative flex flex-col overflow-hidden"
              style={{
                width: `${currentWidth}px`,
                height: `${currentHeight}px`,
                borderRadius: `${currentRadius}px`,
                borderWidth: `${currentBorder}px`,
                borderColor: "#000",
                background: "#ffffff",
                transition: "box-shadow 0.15s ease",
              }}
            >
              {/* Laptop Bezel Overlay (Black bezel with MacBook Pro-style Notch) */}
              <div 
                className="absolute inset-0 pointer-events-none z-30 rounded-[8px]"
                style={{ opacity: desktopOpacity }}
              >
                {/* MacBook Pro-style Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-3 bg-zinc-950 rounded-b-md flex items-center justify-center gap-1.5 pointer-events-none">
                  {/* Camera lens */}
                  <span className="w-1 h-1 rounded-full bg-zinc-800 border border-zinc-800" />
                  {/* Green LED indicator */}
                  <span className="w-0.5 h-0.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              {/* ── Desktop: Builder UI ── */}
              <div
                className="absolute inset-0 flex flex-col select-none bg-white"
                style={{ opacity: desktopOpacity }}
              >
                {/* Mockup Header (from screenshot) */}
                <div className="h-10 bg-white border-b border-zinc-100 px-4 flex items-center justify-between flex-shrink-0">
                  {/* Left: Logo */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-zinc-950 rounded flex items-center justify-center">
                      <span className="text-white text-[7px] font-black tracking-tighter">FT</span>
                    </div>
                    <span className="font-bold text-zinc-950 text-xs tracking-tight">FieldTally</span>
                  </div>
                  {/* Right: Controls */}
                  <div className="flex items-center gap-1.5">
                    {/* Cloud save */}
                    <span className="text-[10.5px] text-zinc-400 mr-1.5">☁️</span>
                    {/* AI Assistant button */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-md text-[9px] font-bold">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                      <span>AI Assistant</span>
                    </div>
                    <div className="px-2 py-1 bg-zinc-50 border border-zinc-100 rounded-md text-[9px] text-zinc-500 font-medium">Preview</div>
                    <div className="px-2 py-1 bg-zinc-50 border border-zinc-100 rounded-md text-[9px] text-zinc-500 font-medium">Export PDF</div>
                    <div className="px-2 py-1 bg-zinc-50 border border-zinc-100 rounded-md text-[9px] text-zinc-500 font-medium">Share</div>
                    <div className="px-2 py-1 bg-blue-600 text-white rounded-md text-[9px] font-bold">Publish</div>
                    {/* Avatar */}
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-zinc-200">
                      <img src="/avatars/panda.png" alt="Profile" className="w-full h-full object-cover bg-zinc-50" />
                    </div>
                  </div>
                </div>

                {/* Editor body (Centered clean canvas, no sidebar) */}
                <div className="flex-1 overflow-y-auto text-left bg-white p-6">
                  <div className="max-w-xl mx-auto space-y-6">
                    {/* Document title (dynamic typewriter) */}
                    <div className="text-base font-bold text-zinc-950 mb-1 flex items-center gap-1">
                      <span>{typingProgress.title}</span>
                      {typingProgress.title.length < fullContent.title.length && (
                        <span className="w-0.5 h-4 bg-violet-600 animate-pulse inline-block" />
                      )}
                    </div>

                    {/* Document paragraph (dynamic typewriter) */}
                    {typingProgress.intro && (
                      <p className="text-[10px] text-zinc-500 leading-relaxed flex items-center">
                        <span>{typingProgress.intro}</span>
                        {typingProgress.intro.length < fullContent.intro.length && (
                          <span className="w-0.5 h-3 bg-violet-600 animate-pulse inline-block ml-0.5" />
                        )}
                      </p>
                    )}

                    {/* Question block 1 (dynamic typewriter, active style with side icons) */}
                    {typingProgress.question && (
                      <div className="relative pl-2 py-1 my-2">
                        {/* Hover controls on the left */}
                        <div className="absolute -left-10 top-1 flex items-center gap-1 text-zinc-300">
                          <Trash2 className="w-3 h-3 hover:text-zinc-500 cursor-pointer" />
                          <Plus className="w-3 h-3 hover:text-zinc-500 cursor-pointer" />
                          <GripVertical className="w-3 h-3 hover:text-zinc-500 cursor-grab" />
                        </div>

                        <div className="text-[11px] font-bold text-zinc-900 mb-2 flex items-center leading-snug">
                          <span>{typingProgress.question}</span>
                          {typingProgress.question.length < fullContent.question.length && (
                            <span className="w-0.5 h-3 bg-violet-600 animate-pulse inline-block ml-0.5" />
                          )}
                        </div>
                        
                        {/* Options */}
                        <div className="space-y-1">
                          {typingProgress.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-1.5 p-1 bg-white rounded text-[9.5px] text-zinc-700">
                              <span className="w-2.5 h-2.5 rounded-full border border-zinc-300 flex-shrink-0" />
                              <span>{opt}</span>
                              {oIdx === typingProgress.options.length - 1 && opt.length < fullContent.options[oIdx].length && (
                                <span className="w-0.5 h-2.5 bg-violet-600 animate-pulse inline-block ml-0.5" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Static subsequent blocks (from screenshot) - fade in only when Question 1 has finished typing */}
                    {typingProgress.options.length === fullContent.options.length && 
                     typingProgress.options[typingProgress.options.length - 1] === fullContent.options[fullContent.options.length - 1] && (
                      <div className="mt-8 space-y-4 border-t border-zinc-100 pt-5 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        {/* Question 2 */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10.5px] font-semibold text-zinc-800 leading-snug">
                            What&apos;s one scene or moment that lives rent-free in your head? <span className="text-red-400">*</span>
                          </label>
                          <div className="w-full text-[9.5px] p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-300 pointer-events-none">
                            Was it the pizza on the roof? The train heist? The &apos;I am the danger&apos; speech?
                          </div>
                        </div>

                        {/* Question 3 */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10.5px] font-semibold text-zinc-800 leading-snug">
                            On a scale of 1 (meh) to 10 (OMG BEST SHOW EVER), how would you rate the series overall? <span className="text-red-400">*</span>
                          </label>
                          <div className="w-full text-[9.5px] p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-300 pointer-events-none">
                            1-10, how epic was it?
                          </div>
                        </div>

                        {/* Question 4 */}
                        <div className="space-y-1 text-left">
                          <label className="text-[10.5px] font-semibold text-zinc-800 leading-snug">
                            Any final thoughts, rants, or raves about the series?
                          </label>
                          <div className="w-full h-10 text-[9.5px] p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-300 pointer-events-none">
                            Did it stick the landing? Any lingering questions? Just general gushing is fine too!
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Mobile: Published form ── */}
              <div
                className="absolute inset-0 flex flex-col bg-zinc-50"
                style={{ opacity: mobileOpacity }}
              >
                {/* Dynamic island */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-950 rounded-full z-20" />

                {/* Status bar */}
                <div className="h-9 bg-white flex items-end justify-between px-5 pb-1">
                  <span className="text-[11px] font-bold text-zinc-800">9:41</span>
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 h-2 bg-zinc-800 rounded-sm" />
                    <span className="w-0.5 h-3 bg-zinc-800 rounded-sm" />
                    <span className="w-0.5 h-4 bg-zinc-800 rounded-sm" />
                  </div>
                </div>

                {/* Form content */}
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Step 1 / 2</span>
                    <div className="w-16 h-1 bg-zinc-200 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-zinc-900 rounded-full" />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 mb-3">Breaking Bad Review</h3>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-700 leading-snug">
                        Who was your absolute favorite character? (No wrong answers) <span className="text-red-400">*</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-xl cursor-pointer">
                        <input type="radio" name="sat" className="accent-zinc-900" />
                        <span className="text-[10px] text-zinc-600">Walter White (Heisenberg, yo!)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-xl cursor-pointer">
                        <input type="radio" name="sat" className="accent-zinc-900" />
                        <span className="text-[10px] text-zinc-600">Jesse Pinkman (Yeah, science!)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white border border-violet-200 rounded-xl cursor-pointer ring-1 ring-violet-200">
                        <input type="radio" name="sat" defaultChecked className="accent-violet-500" />
                        <span className="text-[10px] text-zinc-800 font-medium">Saul Goodman (Better Call Saul!)</span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-zinc-700">What&apos;s one scene that lives rent-free in your head?</label>
                      <input
                        type="text"
                        placeholder="Was it the pizza on the roof? The train heist?..."
                        readOnly
                        className="w-full text-[10px] p-2 bg-white border border-zinc-200 rounded-xl outline-none"
                      />
                    </div>

                    <button className="mt-1 w-full py-2 bg-zinc-950 text-white rounded-xl text-xs font-bold shadow-sm">
                      Next →
                    </button>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="h-5 flex items-center justify-center bg-zinc-50">
                  <div className="w-20 h-[3px] bg-zinc-300 rounded-full" />
                </div>
              </div>
            </div>

            {/* Laptop Keyboard Base & Hinge (Matching user screenshot) */}
            <div
              className="absolute bottom-[28px] left-1/2 -translate-x-1/2 h-[22px] transition-all duration-75 shadow-lg border-t border-zinc-300 z-10 flex flex-col justify-between"
              style={{
                width: `${currentWidth * 1.14}px`,
                background: "linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)",
                borderColor: "#94a3b8",
                borderRadius: "0 0 10px 10px",
                opacity: desktopOpacity,
              }}
            >
              {/* Center thumb groove/notch to open the lid */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-2 bg-zinc-400/40 border-x border-b border-zinc-400/50 rounded-b-md border-t-gray" />
              
              {/* Left Foot */}
              <div className="absolute bottom-[-2.5px] left-[8%] w-10 h-[3px] bg-zinc-800/70 rounded-full" />
              {/* Right Foot */}
              <div className="absolute bottom-[-2.5px] right-[8%] w-10 h-[3px] bg-zinc-800/70 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Feature Showcase ──────────────────────── */}
      <section className="py-24 bg-white text-zinc-900 border-b border-zinc-100 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            {/* Left Column: Visual AI Agent Chat Mockup */}
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl blur-lg opacity-15 animate-pulse" />
              
              <div className="relative bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xl">
                {/* Window header */}
                <div className="h-10 bg-zinc-50 border-b border-zinc-100 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-800">FieldTally AI Assistant</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-200" />
                    <span className="w-2 h-2 rounded-full bg-zinc-200" />
                    <span className="w-2 h-2 rounded-full bg-zinc-200" />
                  </div>
                </div>

                {/* Chat content mockup */}
                <div className="p-5 space-y-4 font-sans text-xs">
                  {/* User message */}
                  <div className="flex items-start gap-3 justify-end">
                    <div className="bg-zinc-100 text-zinc-800 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] shadow-sm">
                      I need a customer feedback survey with satisfaction ratings and conditional questions.
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-none p-4 max-w-[85%] space-y-2 text-zinc-600">
                      <p>I can help you build that! Let&apos;s refine the details:</p>
                      <ul className="list-disc pl-4 space-y-1 text-zinc-500">
                        <li>Do you want safety checkboxes for PPE?</li>
                        <li>Should the GPS capture automatically on load?</li>
                      </ul>
                    </div>
                  </div>

                  {/* Generation status */}
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-blue-600">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[10px] uppercase tracking-wider text-blue-800">Schema Generated</p>
                      <p className="text-[10px] text-blue-500 truncate">12 questions · 3 conditional logic rules</p>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-all shadow-sm shrink-0">
                      Apply to Builder
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Title and details */}
            <div className="w-full lg:w-1/2 space-y-6">
              
              
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 leading-tight">
                Create complex forms <br />
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  with simple conversation.
                </span>
              </h2>

              <p className="text-zinc-500 text-sm sm:text-base leading-relaxed">
                Describe the form you need in plain English. The AI Form Assistant will guide you through the process, ask clarifying questions, and generate a fully-featured schema with conditional rules and validation in seconds.
              </p>

              <div className="pt-4 grid grid-cols-2 gap-6 border-t border-zinc-100">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-800 mb-1">Tone Personalities</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Set a Friendly, Professional, or Casual tone to match your brand and audience.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-800 mb-1">Dynamic Rules</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Generates conditional showing/hiding rules based on user input automatically.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Analytics Showcase ────────────────────────── */}
      <section className="py-24 bg-zinc-50 border-b border-zinc-100 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        />
        <div className="absolute top-1/2 right-1/4 w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            
            {/* Right Column: Visual Dashboard Mockup */}
            <div className="w-full lg:w-1/2 relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl blur-lg opacity-10 animate-pulse" />
              
              <div className="relative bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
                {/* Header Mockup */}
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4 text-left">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Responses Overview</span>
                    <h3 className="text-sm font-bold text-zinc-800">Customer Satisfaction Survey</h3>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Collecting
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-50/50 border border-zinc-100 rounded-xl p-3 text-left">
                    <span className="text-[9px] font-medium text-zinc-400">Total Submissions</span>
                    <p className="text-base font-bold text-zinc-800 mt-0.5">1,248</p>
                    <span className="text-[8px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                      <TrendingUp className="w-2 h-2" /> +12% today
                    </span>
                  </div>
                  <div className="bg-zinc-50/50 border border-zinc-100 rounded-xl p-3 text-left">
                    <span className="text-[9px] font-medium text-zinc-400">Completion Rate</span>
                    <p className="text-base font-bold text-zinc-800 mt-0.5">87.4%</p>
                    <span className="text-[8px] text-zinc-400 mt-1 block">Avg. 3m 45s</span>
                  </div>
                  <div className="bg-zinc-50/50 border border-zinc-100 rounded-xl p-3 text-left">
                    <span className="text-[9px] font-medium text-zinc-400">Active Shares</span>
                    <p className="text-base font-bold text-zinc-800 mt-0.5">4 Links</p>
                    <span className="text-[8px] text-blue-600 font-semibold mt-1 block">Public Access</span>
                  </div>
                </div>

                {/* CSS Bar Chart Graphics Mockup */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                    <span className="font-semibold text-zinc-600">Submissions Trend (Last 7 Days)</span>
                    <span>1.2k total</span>
                  </div>
                  <div className="h-32 flex items-end gap-3.5 pt-4 border-b border-zinc-100 px-2">
                    {/* Bars */}
                    {[
                      { day: "Mon", val: "h-[30%]" },
                      { day: "Tue", val: "h-[45%]" },
                      { day: "Wed", val: "h-[70%]" },
                      { day: "Thu", val: "h-[55%]" },
                      { day: "Fri", val: "h-[90%]" },
                      { day: "Sat", val: "h-[35%]" },
                      { day: "Sun", val: "h-[60%]" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <div className="w-full bg-zinc-100 group-hover:bg-zinc-200 rounded-t-md relative transition-all duration-300 h-full overflow-hidden">
                          <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-500 ${item.val}`} />
                        </div>
                        <span className="text-[9px] font-medium text-zinc-400">{item.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CSS Pie Chart / Distribution Mockup */}
                <div className="grid grid-cols-2 gap-4 text-left pt-2">
                  <div className="border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Device Breakdown</span>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Mobile</span>
                        <span className="font-semibold text-zinc-700">72%</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Desktop</span>
                        <span className="font-semibold text-zinc-700">24%</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-300" /> Tablet</span>
                        <span className="font-semibold text-zinc-700">4%</span>
                      </div>
                    </div>
                  </div>
                  <div className="border border-zinc-100 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Satisfaction Score</span>
                    <div className="flex items-center gap-3">
                      {/* Simulated Circle Chart */}
                      <div className="w-10 h-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center text-[10px] font-bold text-zinc-700 rotate-[45deg]">
                        <span className="-rotate-[45deg]">4.8</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] text-zinc-400 block">Out of 5.0</span>
                        <span className="text-[10px] font-bold text-emerald-600 block">Excellent rating</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Column: Title and details */}
            <div className="w-full lg:w-1/2 space-y-6 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">
                <BarChart3 className="w-3.5 h-3.5" />
                Real-time Analytics
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 leading-tight">
                Turn responses into <br />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  actionable insights.
                </span>
              </h2>

              <p className="text-zinc-500 text-sm sm:text-base leading-relaxed">
                Watch submissions roll in with live updates. FieldTally automatically compiles response data into clean, visual graphics and charts, saving you hours of manual reporting.
              </p>

              <div className="pt-6 border-t border-zinc-200 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-800">Unlimited Collections & Forms</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                      Create unlimited forms and run unlimited collections without caps. Gather all the data you need.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-800">Export & PDF Reporting</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                      Generate beautiful summaries, save summaries to PDF reports, or export clean CSV files for spreadsheet work.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section id="features" className="py-32 bg-white">
        <div className="max-w-5xl mx-auto px-8">
          <div className="mb-20">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-4">Capabilities</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight leading-snug max-w-sm">
              Everything you need to collect field data.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { icon: <Command className="w-4 h-4" />, title: "Slash Commands", body: "Type / anywhere to insert inputs, headings, checklists, and more — just like Notion." },
              { icon: <Settings className="w-4 h-4" />, title: "Conditional Logic", body: "Show or hide questions based on previous answers with a simple visual rule builder." },
              { icon: <History className="w-4 h-4" />, title: "Version History", body: "Every publish is saved as a version. Browse, compare, and restore any snapshot." },
              { icon: <UserCheck className="w-4 h-4" />, title: "Role Permissions", body: "Invite collaborators via email and assign Owner, Editor, Viewer, or Submitter roles." },
              { icon: <Bot className="w-4 h-4" />, title: "AI Assistant", body: "Generate ready-to-use forms conversationally using Gemini-powered logic and question drafting." },
              { icon: <Share2 className="w-4 h-4" />, title: "One-click Sharing", body: "Publish and share a permanent link. Respondents need no account to fill it in." },
            ].map((f) => (
              <div key={f.title} className="group">
                <div className="w-8 h-8 bg-zinc-100 group-hover:bg-zinc-900 text-zinc-500 group-hover:text-white rounded-lg flex items-center justify-center mb-5 transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────── */}
      <section id="workflow" className="py-32 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-20">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-4">Process</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">Three steps to launch.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              { n: "01", title: "Design your form", body: "Write questions, add fields, group sections, and mark required inputs — all in one canvas." },
              { n: "02", title: "Set logic rules", body: "Define branching paths so respondents only see what's relevant to their previous answers." },
              { n: "03", title: "Publish & collect", body: "Hit Publish. Copy the link and share it anywhere. Responses appear in your dashboard." },
            ].map((s) => (
              <div key={s.n}>
                <div className="text-[11px] font-bold text-zinc-300 mb-4 tracking-wider">{s.n}</div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="py-36 bg-zinc-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-72 bg-violet-500/8 blur-[100px] rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto px-8 text-center relative z-10">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-6">Get started</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5 leading-snug">
            Ready to build your first form?
          </h2>
          <p className="text-sm text-zinc-400 mb-10 max-w-sm mx-auto leading-relaxed">
            No design skills or collection limits. Build unlimited forms and run unlimited collections for free, starting from a blank canvas or with AI assistant support.
          </p>
          <Link
            href="/create-form"
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-100 rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            Create a Form
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-10">
        <div className="max-w-5xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="font-bold text-white">FieldTally</span>
            <span>· Field data collection, simplified.</span>
          </div>
          <div className="text-[11px] text-zinc-600">
            © {new Date().getFullYear()} FieldTally
          </div>
        </div>
      </footer>
    </div>
  );
}
