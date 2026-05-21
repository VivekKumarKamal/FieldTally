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
  const currentBorder = 7  + (14 - 7)  * scrollProgress;
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
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-full text-[11px] font-medium text-zinc-500 mb-10 tracking-wide">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Modern Field Data Collection
          </div>

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
            A block-based editor inspired by Notion. Build advanced surveys, conditional workflows, and share a live link — all from your browser.
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
                borderStyle: "solid",
                borderColor,
                background: "#ffffff",
                boxShadow: "0 20px 60px -10px rgba(0,0,0,0.12), 0 4px 20px -4px rgba(0,0,0,0.08)",
                transition: "box-shadow 0.15s ease",
              }}
            >
              {/* ── Desktop: Builder UI ── */}
              <div
                className="absolute inset-0 flex flex-col select-none"
                style={{ opacity: desktopOpacity }}
              >
                {/* Titlebar */}
                <div className="h-9 bg-zinc-50 border-b border-zinc-100 px-4 flex items-center gap-2 flex-shrink-0">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-0.5 rounded text-[11px] font-medium text-zinc-400 bg-zinc-100/80 max-w-[180px] truncate">
                      Customer Feedback · Editor
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-zinc-400">Saved</span>
                  </div>
                </div>

                {/* Editor body */}
                <div className="flex-1 flex overflow-hidden text-left">
                  {/* Sidebar */}
                  <div className="w-36 border-r border-zinc-100 bg-zinc-50/60 p-2 flex flex-col gap-0.5 flex-shrink-0">
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1.5">Blocks</div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-zinc-700 bg-white rounded-lg border border-zinc-200/80 shadow-sm">
                      <Command className="w-3 h-3 text-zinc-400 shrink-0" /> Text
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-zinc-500 rounded-lg hover:bg-white">
                      <Smartphone className="w-3 h-3 text-zinc-400 shrink-0" /> Phone
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-zinc-500 rounded-lg hover:bg-white">
                      <HelpCircle className="w-3 h-3 text-zinc-400 shrink-0" /> Checkbox
                    </div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 pt-4 pb-1.5">Logic</div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-zinc-500 rounded-lg hover:bg-white">
                      <Settings className="w-3 h-3 text-zinc-400 shrink-0" /> Conditions
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="flex-1 p-7 overflow-y-auto relative">
                    <div className="max-w-lg">
                      <div className="text-xl font-bold text-zinc-900 mb-5 pb-2 border-b border-zinc-100">Customer Feedback</div>

                      {/* Selected block */}
                      <div className="relative pl-4 py-2 my-4 border-l-2 border-violet-400 bg-violet-50/30 rounded-r-lg">
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">⠿</div>
                        <div className="text-xs font-semibold text-zinc-800 mb-1.5">
                          1. How satisfied are you with our service?{" "}
                          <span className="text-red-400">*</span>
                        </div>
                        <div className="h-7 border border-zinc-200 rounded-lg bg-white px-3 flex items-center text-[11px] text-zinc-300">
                          Short text answer…
                        </div>
                      </div>

                      {/* Regular block */}
                      <div className="pl-4 py-2 my-4 border-l-2 border-transparent">
                        <div className="text-xs font-semibold text-zinc-700 mb-1.5">
                          2. What could we improve?
                        </div>
                        <div className="h-14 border border-zinc-200 rounded-lg bg-white p-2 text-[11px] text-zinc-300">
                          Long text answer…
                        </div>
                      </div>

                      {/* Slash command popup */}
                      <div className="absolute top-28 right-6 w-44 bg-white border border-zinc-200 shadow-2xl rounded-xl p-1.5 z-20">
                        <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest px-2 py-1">Turn into</div>
                        <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-white bg-violet-500 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 shrink-0" /> Checkbox
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-600 rounded-lg">
                          <Smartphone className="w-3 h-3 text-zinc-400 shrink-0" /> Phone Input
                        </div>
                      </div>
                    </div>
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
                <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Step 1 / 2</span>
                    <div className="w-20 h-1 bg-zinc-200 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-zinc-900 rounded-full" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 mb-5">Customer Feedback</h3>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-700">
                        How satisfied are you? <span className="text-red-400">*</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 bg-white border border-violet-200 rounded-xl cursor-pointer ring-1 ring-violet-200">
                        <input type="radio" name="sat" defaultChecked className="accent-violet-500" />
                        <span className="text-xs text-zinc-800 font-medium">Very Satisfied</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 bg-white border border-zinc-200 rounded-xl cursor-pointer">
                        <input type="radio" name="sat" className="accent-zinc-900" />
                        <span className="text-xs text-zinc-600">Neutral</span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-zinc-700">Any additional notes?</label>
                      <textarea
                        placeholder="Type your answer…"
                        rows={2}
                        className="w-full text-xs p-2.5 bg-white border border-zinc-200 rounded-xl outline-none resize-none"
                      />
                    </div>

                    <button className="mt-1 w-full py-2.5 bg-zinc-950 text-white rounded-xl text-xs font-bold shadow-sm">
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

            {/* MacBook chin */}
            <div
              className="absolute bottom-[-12px] left-1/2 -translate-x-1/2 h-3 rounded-b-lg transition-all duration-75"
              style={{
                width: `${currentWidth * 1.05}px`,
                background: "linear-gradient(180deg, #d1d5db, #e5e7eb)",
                opacity: desktopOpacity,
              }}
            />
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
              { icon: <Eye className="w-4 h-4" />, title: "Instant Preview", body: "Switch between edit and preview mode to test your form exactly as respondents see it." },
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
            No design skills needed. Start with a blank canvas and launch in minutes.
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
