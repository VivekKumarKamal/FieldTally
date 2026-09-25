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
        className="px-3 py-2 rounded-md border border-(--de-ink) bg-(--de-surface) text-(--de-ink) text-sm font-medium hover:bg-(--de-ink) hover:text-(--de-paper) transition-colors disabled:opacity-50"
      >
        {loading ? "Locating..." : value ? "Update Location" : "Capture Location"}
      </button>
      {value && <span className="text-xs font-mono text-(--de-muted)">{value.lat.toFixed(4)}, {value.lng.toFixed(4)}</span>}
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
      className="w-full px-3 py-2.5 bg-(--de-surface) border border-(--de-line) rounded-md text-base italic font-serif text-(--de-ink) outline-none focus:border-(--de-ink)"
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
          <label className="block text-sm font-medium text-(--de-ink) mb-1.5">
            {field.label}
            {field.required && <span className="text-(--de-accent)"> *</span>}
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
                        ? "bg-(--de-ink) border-(--de-ink) text-(--de-paper)"
                        : "bg-(--de-surface) border-(--de-line) text-(--de-ink) hover:border-(--de-ink)"
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
        className="mt-1 w-full rounded-lg bg-(--de-accent) text-(--de-on-accent) font-semibold text-lg py-4 border-2 border-(--de-edge) shadow-[0_5px_0_var(--de-edge)] active:translate-y-[5px] active:shadow-none transition-[transform,box-shadow] duration-75"
      >
        {submitLabel}
      </button>
    </form>
  );
}

const INPUT_CLASS =
  "w-full px-3 py-2.5 bg-(--de-surface) border border-(--de-line) rounded-md text-sm text-(--de-ink) outline-none focus:border-(--de-ink) focus:ring-2 focus:ring-(--de-ink)/10";
