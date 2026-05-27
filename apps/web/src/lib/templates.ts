import { supabase } from "./supabase";

export interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  iconName: string; // Lucide icon name to render visually
  schema: any;
}

export const TEMPLATES: Template[] = [
  {
    id: "contact-form",
    title: "1. Simple Registration Form",
    description: "A minimal, complexity 1/3 form containing headers, dividers, bold/italic texts, and basic text inputs.",
    category: "Basic",
    iconName: "FileText",
    schema: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Community Event Registration" }]
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Welcome to the sign-up page! This is a " },
            { type: "text", text: "simple, beginner-level form", marks: [{ type: "bold" }] },
            { type: "text", text: " with " },
            { type: "text", text: "no conditional logic", marks: [{ type: "italic" }] },
            { type: "text", text: ". Learn more on our " },
            { type: "text", text: "website guidelines", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
            { type: "text", text: "." }
          ]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Contact Details" }]
        },
        {
          type: "shortAnswerBlock",
          attrs: { id: "rsvp_name", required: true, placeholder: "e.g. Jane Doe" },
          content: [{ type: "text", text: "Full Name" }]
        },
        {
          type: "emailAnswerBlock",
          attrs: { id: "rsvp_email", required: true, placeholder: "name@company.com" },
          content: [{ type: "text", text: "Email Address" }]
        },
        {
          type: "numberAnswerBlock",
          attrs: { id: "rsvp_guests", required: false, placeholder: "0" },
          content: [{ type: "text", text: "Number of Guests" }]
        },
        {
          type: "longAnswerBlock",
          attrs: { id: "rsvp_dietary", required: false, placeholder: "List any allergies or requests..." },
          content: [{ type: "text", text: "Special Dietary / Seating Requests" }]
        }
      ]
    }
  },
  {
    id: "product-survey",
    title: "2. Customer Experience Survey",
    description: "A mid-complexity 2/3 form utilizing multiple choice, checkboxes, phone inputs, dates, bold/italic styling, and dividers.",
    category: "Intermediate",
    iconName: "ClipboardList",
    schema: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Product Experience & Feedback" }]
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "We value your input! This " },
            { type: "text", text: "medium-complexity", marks: [{ type: "bold" }] },
            { type: "text", text: " survey collects rating selections, date of purchase, and feature usage. Check out our " },
            { type: "text", text: "Privacy Policy", marks: [{ type: "link", attrs: { href: "https://example.com/privacy" } }] },
            { type: "text", text: " before submitting." }
          ]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Service Rating" }]
        },
        {
          type: "multipleChoiceBlock",
          attrs: { id: "rating", required: true },
          content: [
            {
              type: "multipleChoiceTitle",
              content: [{ type: "text", text: "How would you rate your overall experience?" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "Excellent" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "Good" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "Average" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "Poor" }]
            }
          ]
        },
        {
          type: "checkboxBlock",
          attrs: { id: "features_used", required: false },
          content: [
            {
              type: "checkboxTitle",
              content: [{ type: "text", text: "Which features do you use most frequently? (Select all)" }]
            },
            {
              type: "checkboxOption",
              content: [{ type: "text", text: "Form Builder" }]
            },
            {
              type: "checkboxOption",
              content: [{ type: "text", text: "PDF Formatting & Export" }]
            },
            {
              type: "checkboxOption",
              content: [{ type: "text", text: "Submissions Analytics" }]
            },
            {
              type: "checkboxOption",
              content: [{ type: "text", text: "Third-party Integrations" }]
            }
          ]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Follow-up Contact" }]
        },
        {
          type: "dateAnswerBlock",
          attrs: { id: "service_date", required: true },
          content: [{ type: "text", text: "Date of Purchase / Service" }]
        },
        {
          type: "phoneAnswerBlock",
          attrs: { id: "contact_phone", required: false },
          content: [{ type: "text", text: "Contact Phone Number (Optional)" }]
        },
        {
          type: "longAnswerBlock",
          attrs: { id: "additional_comments", required: false, placeholder: "Type here..." },
          content: [{ type: "text", text: "Any additional suggestions?" }]
        }
      ]
    }
  },
  {
    id: "site-safety-audit",
    title: "3. Advanced Safety Audit Dispatch",
    description: "Maximum complexity 3/3 form. Uses GPS coordinates, images, signature, headings, bold/italic/links, and active conditional logic blocks.",
    category: "Advanced",
    iconName: "AlertCircle",
    schema: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Advanced Safety Audit Report" }]
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is a " },
            { type: "text", text: "maximum-complexity", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: " report. It uses " },
            { type: "text", text: "conditional logic rules", marks: [{ type: "bold" }] },
            { type: "text", text: " to dynamically toggle inspection fields, captures exact GPS mapping coordinates, uploads photos, and requires a retina signature. Review the official " },
            { type: "text", text: "Safety Code Manual", marks: [{ type: "link", attrs: { href: "https://example.com/safety" } }] },
            { type: "text", text: " before submitting." }
          ]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "1. Auditor Profile" }]
        },
        {
          type: "shortAnswerBlock",
          attrs: { id: "audit_inspector", required: true, placeholder: "Auditor Full Name" },
          content: [{ type: "text", text: "Lead Auditor Name" }]
        },
        {
          type: "dateAnswerBlock",
          attrs: { id: "audit_date", required: true },
          content: [{ type: "text", text: "Audit Inspection Date" }]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "2. Incident Reporting" }]
        },
        {
          type: "multipleChoiceBlock",
          attrs: { id: "site_hazards", required: true },
          content: [
            {
              type: "multipleChoiceTitle",
              content: [{ type: "text", text: "Did you detect any safety hazards or incidents today?" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "Yes, hazards were detected" }]
            },
            {
              type: "multipleChoiceOption",
              content: [{ type: "text", text: "No, site is safe" }]
            }
          ]
        },
        {
          type: "logicBlock",
          attrs: {
            rule: {
              id: "logic_safety_hazard",
              conditionOperator: "AND",
              conditions: [
                {
                  id: "cond_safety_check",
                  field: "site_hazards",
                  operator: "equals",
                  value: "Yes, hazards were detected"
                }
              ],
              action: {
                type: "show",
                targets: ["hazard_heading", "hazard_location", "hazard_photo", "hazard_description"]
              }
            }
          }
        },
        {
          type: "heading",
          attrs: { level: 3, id: "hazard_heading" },
          content: [{ type: "text", text: "Hazard Details (Conditional)" }]
        },
        {
          type: "gpsAnswerBlock",
          attrs: { id: "hazard_location", required: true },
          content: [{ type: "text", text: "GPS Coordinates of Safety Hazard" }]
        },
        {
          type: "imageAnswerBlock",
          attrs: { id: "hazard_photo", required: true },
          content: [{ type: "text", text: "Photograph Proof of Safety Incident" }]
        },
        {
          type: "longAnswerBlock",
          attrs: { id: "hazard_description", required: true, placeholder: "Describe the hazard and actions required..." },
          content: [{ type: "text", text: "Detailed Hazard Description" }]
        },
        {
          type: "horizontalRule"
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "3. Auditor Sign-off" }]
        },
        {
          type: "signatureAnswerBlock",
          attrs: { id: "audit_signature", required: true },
          content: [{ type: "text", text: "Lead Auditor Sign-off Signature" }]
        }
      ]
    }
  }
];

const BLOCK_TYPES_WITH_IDS = new Set([
  "shortAnswerBlock",
  "longAnswerBlock",
  "numberAnswerBlock",
  "emailAnswerBlock",
  "phoneAnswerBlock",
  "linkAnswerBlock",
  "dateAnswerBlock",
  "timeAnswerBlock",
  "checkboxBlock",
  "multipleChoiceBlock",
  "logicBlock",
  "gpsAnswerBlock",
  "imageAnswerBlock",
  "signatureAnswerBlock",
]);

/**
 * Utility to deep-clone template schema and assign unique IDs to all form blocks.
 */
export function getClonedTemplateSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const cloned = {
    ...schema,
    attrs: schema.attrs ? { ...schema.attrs } : schema.attrs,
    content: Array.isArray(schema.content)
      ? schema.content.map((child: any) => getClonedTemplateSchema(child))
      : schema.content,
  };

  if (BLOCK_TYPES_WITH_IDS.has(cloned.type)) {
    cloned.attrs = { ...(cloned.attrs || {}), id: crypto.randomUUID() };
  }

  return cloned;
}

/**
 * Creates a new form draft from a template in both localStorage and Supabase,
 * and returns the path to navigate to.
 */
export async function createFormFromTemplate(template: Template, userId: string | null): Promise<string> {
  const newFormId = crypto.randomUUID();
  const clonedSchema = getClonedTemplateSchema(template.schema);
  const now = new Date().toISOString();

  // Save to localStorage
  localStorage.setItem(`draft_schema_${newFormId}`, JSON.stringify({
    schema: clonedSchema,
    title: template.title.replace(/^\d+\.\s*/, ""), // Strip complexity number prefix from title
    updated_at: now,
  }));
  localStorage.setItem("current_draft_form_id", newFormId);

  // If logged in, save to Supabase
  if (userId) {
    try {
      await supabase.from("forms").insert({
        id: newFormId,
        draft_schema: { title: template.title.replace(/^\d+\.\s*/, ""), content: clonedSchema },
        created_by: userId,
        updated_at: now,
      });
    } catch (err) {
      console.error("Failed to insert template form in Supabase:", err);
    }
  }

  return `/create-form?form=${newFormId}`;
}
