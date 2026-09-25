import { redirect } from "next/navigation";

// Superseded by the general Data Exercises system: this template now lives as
// a seeded exercise_template row (supabase/migrations/0002_data_exercises.sql)
// and runs through /data-exercises/run/[runId] like any other template.
export default function LegacyClassEntryTrackerRedirect() {
  redirect("/data-exercises");
}
