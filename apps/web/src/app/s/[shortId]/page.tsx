"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { decodeShortIdToUuid } from "../../../lib/shortid";
import FormRenderer from "../../../components/FormRenderer";

export default function SubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const shortId = params.shortId as string;
  
  const [formSchema, setFormSchema] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formVersionId, setFormVersionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadForm() {
      if (!shortId) return;
      
      try {
        const formId = decodeShortIdToUuid(shortId);
        
        // Fetch form status and latest version concurrently to reduce network latency
        const [formResult, versionResult] = await Promise.all([
          supabase.from('forms').select('id, status').eq('id', formId).single(),
          supabase.from('form_versions')
            .select('id, title, content, version')
            .eq('form_id', formId)
            .order('version', { ascending: false })
            .limit(1)
            .single()
        ]);
          
        if (formResult.error || !formResult.data) {
          setError("Form not found.");
          setLoading(false);
          return;
        }
        
        if (formResult.data.status !== 'published') {
          setError("This form is not currently published.");
          setLoading(false);
          return;
        }

        if (versionResult.error || !versionResult.data) {
          setError("Form content not found.");
          setLoading(false);
          return;
        }

        const latestVersion = versionResult.data;

        setFormSchema(latestVersion.content);
        setFormTitle(latestVersion.title);
        setFormVersionId(latestVersion.id);
        setLoading(false);
      } catch (err) {
        setError("Error loading form.");
        setLoading(false);
      }
    }
    
    loadForm();
  }, [shortId]);

  const handleSubmit = async (answers: any) => {
    try {
      const formId = decodeShortIdToUuid(shortId);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('submissions').insert({
        form_id: formId,
        form_version_id: formVersionId,
        submitted_by: user ? user.id : null,
        data: answers,
        filled_at: new Date().toISOString()
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert("Failed to submit form. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 animate-pulse font-medium">Loading form...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Oops!</h2>
          <p className="text-zinc-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">Response Submitted!</h2>
          <p className="text-zinc-600 mb-8 text-lg">Thank you for completing this form.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="pt-12 pb-20 px-4 sm:px-6 max-w-3xl mx-auto">
        <FormRenderer
          schema={formSchema}
          title={formTitle}
          progressBarOffset={0}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
