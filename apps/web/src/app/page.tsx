import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Nav */}
      <nav className="w-full border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-zinc-800 to-zinc-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold tracking-tighter">FT</span>
            </div>
            <span className="font-semibold text-zinc-900 tracking-tight text-lg">FieldTally</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium px-4 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center -mt-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-full text-xs font-medium text-zinc-500 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Work in progress
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 tracking-tight leading-tight mb-4">
            Build forms that<br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">work in the field</span>
          </h1>

          <p className="text-lg text-zinc-500 mb-10 max-w-md mx-auto leading-relaxed">
            A block-based form builder designed for field data collection. Create, publish, and collect responses — all from your browser.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/create-form"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create a Form
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-zinc-700 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 rounded-xl transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-zinc-400">
        Built with FieldTally
      </footer>
    </div>
  );
}
