"use client";

import { useState } from "react";
import type { ExerciseField } from "@/lib/exerciseSchema";

const TEXT_INPUT_TYPE: Partial<Record<ExerciseField["type"], string>> = {
  numberAnswerBlock: "number",
  emailAnswerBlock: "email",
  phoneAnswerBlock: "tel",
  linkAnswerBlock: "url",
  dateAnswerBlock: "date",
  timeAnswerBlock: "time",
};

function GpsField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function capture() {
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={capture}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-semibold hover:bg-indigo-200 transition disabled:opacity-50"
      >
        {loading ? "Locating..." : value ? "Update Location" : "Capture Location"}
      </button>
      {value && <span className="text-xs text-zinc-500">{value.lat.toFixed(4)}, {value.lng.toFixed(4)}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function ImageField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result);
        reader.readAsDataURL(file);
      }}
      className="text-sm"
    />
  );
}

function SignatureField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <input
      type="text"
      placeholder="Type your name to sign"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm italic font-serif"
    />
  );
}

export default function ExerciseEntryForm({
  fields,
  onSubmit,
  submitLabel = "Log Entry",
}: {
  fields: ExerciseField[];
  onSubmit: (data: Record<string, any>) => void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  function setValue(id: string, value: any) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const field of fields) {
      if (field.required && (answers[field.id] === undefined || answers[field.id] === "")) {
        alert(`"${field.label}" is required.`);
        return;
      }
    }
    onSubmit(answers);
    setAnswers({});
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.id} className="text-left">
          <label className="block text-sm font-semibold text-zinc-700 mb-1">
            {field.label}
            {field.required && <span className="text-pink-500"> *</span>}
          </label>

          {field.type === "longAnswerBlock" ? (
            <textarea
              value={answers[field.id] || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
              rows={3}
            />
          ) : field.type === "checkboxBlock" ? (
            <div className="flex flex-col gap-1.5">
              {(field.options ?? []).map((opt) => {
                const selected: string[] = answers[field.id] || [];
                const checked = selected.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setValue(field.id, e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt))
                      }
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          ) : field.type === "multipleChoiceBlock" ? (
            <div className="flex flex-col gap-1.5">
              {(field.options ?? []).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name={field.id}
                    checked={answers[field.id] === opt}
                    onChange={() => setValue(field.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : field.type === "gpsAnswerBlock" ? (
            <GpsField value={answers[field.id]} onChange={(v) => setValue(field.id, v)} />
          ) : field.type === "imageAnswerBlock" ? (
            <ImageField value={answers[field.id]} onChange={(v) => setValue(field.id, v)} />
          ) : field.type === "signatureAnswerBlock" ? (
            <SignatureField value={answers[field.id]} onChange={(v) => setValue(field.id, v)} />
          ) : (
            <input
              type={TEXT_INPUT_TYPE[field.type] || "text"}
              value={answers[field.id] || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        className="mt-2 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 hover:scale-[1.02] active:scale-95 transition text-white font-extrabold text-lg px-8 py-4 shadow-xl"
      >
        {submitLabel}
      </button>
    </form>
  );
}
