"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import FormRenderer from "../../../components/FormRenderer";

export default function SubmissionPage() {
  const router = useRouter();
  const params = useParams()!;
  const versionId = params?.versionId as string;
  
  const [formSchema, setFormSchema] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formId, setFormId] = useState<string>("");
  const [formVersionNum, setFormVersionNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isLatestVersion, setIsLatestVersion] = useState(true);

  useEffect(() => {
    async function loadForm() {
      if (!versionId) return;
      
      try {
        // Fetch the specific version requested
        const { data: currentVersion, error: versionError } = await supabase
          .from('form_versions')
          .select('id, form_id, title, content, version')
          .eq('id', versionId)
          .single();

        if (versionError || !currentVersion) {
          setError("Form version not found.");
          setLoading(false);
          return;
        }

        // Fetch form status and latest version info concurrently
        const [formResult, latestVersionResult] = await Promise.all([
          supabase.from('forms').select('id, status, access_open, created_by').eq('id', currentVersion.form_id).single(),
          supabase.from('form_versions')
            .select('version')
            .eq('form_id', currentVersion.form_id)
            .order('version', { ascending: false })
            .limit(1)
            .single()
        ]);
          
        if (formResult.error || !formResult.data) {
          setError("Parent form not found or you do not have permission to view it.");
          setLoading(false);
          return;
        }
        
        const form = formResult.data;

        if (form.status !== 'published') {
          setError("This form is not currently published.");
          setLoading(false);
          return;
        }

        // Access Control Logic
        if (!form.access_open) {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) {
            setError("restricted");
            setLoading(false);
            return;
          }

          if (user.id !== form.created_by) {
            // Check form_members
            const { data: member, error: memberError } = await supabase
              .from('form_members')
              .select('role')
              .eq('form_id', form.id)
              .eq('user_id', user.id)
              .single();

            if (memberError || !member) {
              setError("You do not have permission to access this form.");
              setLoading(false);
              return;
            }
          }
        }

        if (latestVersionResult.data && latestVersionResult.data.version > currentVersion.version) {
          setIsLatestVersion(false);
        }

        setFormId(currentVersion.form_id);
        setFormSchema(currentVersion.content);
        setFormTitle(currentVersion.title);
        setFormVersionNum(currentVersion.version);
        setLoading(false);
      } catch {
        setError("Error loading form.");
        setLoading(false);
      }
    }
    
    loadForm();
  }, [versionId]);

  const handleSubmit = async (answers: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('submissions').insert({
        form_id: formId,
        form_version_id: formVersionNum ?? versionId, // Fallback to versionId if num isn't set, but types.ts allows either
        submitted_by: user ? user.id : null,
        data: answers,
        filled_at: new Date().toISOString()
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert(`Failed to submit form: ${err.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-400 animate-pulse font-medium">Loading form...</div>
      </div>
    );
  }

  if (error === "restricted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-md">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Restricted Form</h2>
          <p className="text-zinc-600 mb-6">This form requires you to be logged in and have permission to access it.</p>
          <Link href={`/login?redirect=/s/${versionId}`} className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2">
            Sign In to Access
          </Link>
        </div>
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
    <div className="min-h-screen bg-zinc-50 relative">
      {!isLatestVersion && (
        <div className="bg-amber-100 text-amber-800 px-4 py-3 text-sm text-center font-medium sticky top-0 z-50">
          Note: You are viewing an older version of this form.
        </div>
      )}
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
