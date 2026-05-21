"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormRenderer from "../../components/FormRenderer";

export default function PreviewPage() {
  const router = useRouter();
  const [formSchema, setFormSchema] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("preview_form_schema");
    const title = localStorage.getItem("preview_form_title") || "";
    if (raw) {
      try { setFormSchema(JSON.parse(raw)); setFormTitle(title); } catch { router.push("/create-form"); }
    } else { router.push("/create-form"); }
  }, [router]);

  if (!formSchema) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ marginLeft: "-64px" }}>
        <div className="text-zinc-400 animate-pulse">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ marginLeft: "-64px" }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-zinc-200 z-50 px-6 flex items-center gap-4">
        <button
          onClick={() => router.push("/create-form")}
          className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to editor
        </button>
        <div className="h-4 w-px bg-zinc-300" />
        <span className="text-sm text-zinc-400 font-medium">Preview Mode</span>
      </div>

      {/* Form */}
      <div className="pt-28 pb-20 px-12 max-w-4xl mx-auto">
        <FormRenderer
          schema={formSchema}
          title={formTitle}
          progressBarOffset={56} // Height of the h-14 top bar
          onSubmit={(answers) => {
            console.log("Preview submission:", answers);
          }}
        />
      </div>
    </div>
  );
}
