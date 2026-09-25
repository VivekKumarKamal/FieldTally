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
        className="px-3 py-2 rounded-md border border-[#16140F] bg-white text-[#16140F] text-sm font-medium hover:bg-[#16140F] hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? "Locating..." : value ? "Update Location" : "Capture Location"}
      </button>
      {value && <span className="text-xs font-mono text-[#6B665C]">{value.lat.toFixed(4)}, {value.lng.toFixed(4)}</span>}
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
      className="w-full px-3 py-2.5 bg-white border border-[#DDD8CC] rounded-md text-base italic font-serif text-[#16140F] outline-none focus:border-[#16140F]"
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {fields.map((field) => (
        <div key={field.id} className="text-left">
          <label className="block text-sm font-medium text-[#16140F] mb-1.5">
            {field.label}
            {field.required && <span className="text-[#FF5B1F]"> *</span>}
          </label>

          {field.type === "longAnswerBlock" ? (
            <textarea
              value={answers[field.id] || ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={INPUT_CLASS}
              rows={3}
            />
          ) : field.type === "checkboxBlock" || field.type === "multipleChoiceBlock" ? (
            <div className="flex flex-wrap gap-2">
              {(field.options ?? []).map((opt) => {
                const multi = field.type === "checkboxBlock";
                const selected: string[] = multi ? answers[field.id] || [] : [];
                const checked = multi ? selected.includes(opt) : answers[field.id] === opt;
                return (
                  <label
                    key={opt}
                    className={`cursor-pointer select-none px-3.5 py-2 rounded-md border text-sm transition-colors ${
                      checked
                        ? "bg-[#16140F] border-[#16140F] text-white"
                        : "bg-white border-[#DDD8CC] text-[#16140F] hover:border-[#16140F]"
                    }`}
                  >
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={field.id}
                      className="sr-only"
                      checked={checked}
                      onChange={(e) =>
                        multi
                          ? setValue(field.id, e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt))
                          : setValue(field.id, opt)
                      }
                    />
                    {opt}
                  </label>
                );
              })}
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
              className={INPUT_CLASS}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        className="mt-1 w-full rounded-lg bg-[#FF5B1F] text-[#16140F] font-semibold text-lg py-4 border-2 border-[#16140F] shadow-[0_5px_0_#16140F] active:translate-y-[5px] active:shadow-none transition-[transform,box-shadow] duration-75"
      >
        {submitLabel}
      </button>
    </form>
  );
}

const INPUT_CLASS =
  "w-full px-3 py-2.5 bg-white border border-[#DDD8CC] rounded-md text-sm text-[#16140F] outline-none focus:border-[#16140F] focus:ring-2 focus:ring-[#16140F]/10";
