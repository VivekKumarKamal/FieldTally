import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "novel",
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/pm",
    "@tiptap/starter-kit",
    "@tiptap/extension-placeholder",
    "@tiptap/extension-highlight",
    "@tiptap/extension-horizontal-rule",
    "@tiptap/extension-image",
    "@tiptap/extension-link",
    "@tiptap/extension-code-block-lowlight",
    "@tiptap/extension-color",
    "@tiptap/extension-text-style",
    "@tiptap/extension-underline",
    "@tiptap/extension-youtube",
    "@tiptap/extension-task-item",
    "@tiptap/extension-task-list",
    "@tiptap/extension-character-count",
    "@tiptap/suggestion",
  ],
};

export default nextConfig;
