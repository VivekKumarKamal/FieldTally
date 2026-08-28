# 📊 FieldTally

> **Build Notion-style forms and collect data from anywhere — powered by AI.**

FieldTally is a **free and open-source** modern form builder and data collection platform. Designed with a Notion-style block editor and conversational AI capabilities, FieldTally enables users to quickly construct forms, apply dynamic branching logic, gather responses, and visualize analytics seamlessly.

🌐 **Live Application:** [https://field-tally.vercel.app/](https://field-tally.vercel.app/)

---

## ✨ Features

- 🆓 **Free & Open Source**: Openly accessible codebase for full transparency, customization, and self-hosting.
- 🤖 **AI Assistant**: Build complex forms conversationally. Describe your form in plain language, and the AI drafts complete question schemas with validation and conditional logic rules in seconds.
- 📝 **Notion-Style Block Editor**: Intuitive slash-command interface (`/`) to insert inputs, text, headings, checklists, file uploads, and structure your form blocks effortesly.
- 🔀 **Conditional Branching Logic**: Show or hide specific questions based on previous answers using an visual, straightforward rule builder.
- 📊 **Real-time Analytics & Dashboard**: Track submission trends, device breakdowns, and completion rates with automatic visual graphs and charts.
- 🕒 **Version History**: Save and manage form publication versions. Compare, review, and restore previous form iterations easily.
- 👥 **Role & Access Controls**: Invite team members and manage granular access roles (Owner, Editor, Viewer, Submitter).
- 📄 **Export & PDF Reports**: Save response summaries directly to formatted PDF reports or export raw data into clean CSV files.
- 🔗 **One-Click Sharing**: Share instant form links with respondents. No respondent registration or account creation required.

---

## 🛠️ Tech Stack & Architecture

FieldTally is structured as a TypeScript monorepo powered by **Turborepo**:

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (Auth, PostgreSQL DB, Realtime)
- **AI Integration**: [Google Gemini AI](https://deepmind.google/technologies/gemini/) / Bedrock API
- **Monorepo Tooling**: [Turborepo](https://turborepo.org/)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `>=18.x`
- **npm** / **pnpm** / **yarn**

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/FieldTally.git
   cd FieldTally
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file inside `apps/web/` with your Supabase and AI keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Access the web app:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Turborepo Commands

- `npm run build` - Build all apps and packages
- `npm run dev` - Run all applications in development mode
- `npm run lint` - Lint all packages across the repository

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check out the issues page or submit a pull request.
