"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      style: { default: "max-width:100%;border-radius:6px;margin:0.5em 0" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const el = node as HTMLElement;
          return {
            src: el.getAttribute("src"),
            controls: el.hasAttribute("controls"),
            style: el.getAttribute("style") || "max-width:100%;border-radius:6px;margin:0.5em 0",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { controls, ...rest } = HTMLAttributes;
    return ["video", mergeAttributes(rest, controls ? { controls: "" } : {})];
  },
});

const TB_BTN = "p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-40";
const TB_ACTIVE = "bg-gray-200 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400";

export default function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-indigo-600 dark:text-indigo-400 underline" } }),
      Image.configure({ inline: false, allowBase64: false }),
      VideoNode,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[160px] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none",
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = "";

    setUploading(true);
    try {
      const res = await fetch("/api/training-materials/upload", {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type, "X-Filename": encodeURIComponent(file.name) },
      });
      const data = await res.json();
      if (!res.ok || !data.url) { alert(data.error || "Upload failed"); return; }

      editor.chain().focus().setImage({ src: data.url }).run();
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${TB_BTN} ${editor.isActive("bold") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${TB_BTN} ${editor.isActive("italic") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${TB_BTN} ${editor.isActive("underline") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </button>
        <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`${TB_BTN} ${editor.isActive("strike") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 6 3.9h.9M21 12H3M8.7 19.1c2.3.6 4.4 1 6.2.9 2.7 0 5.3-.7 5.3-3.6 0-1.5-1.8-3.3-6-3.9"/></svg>
        </button>
        <button type="button" title="Code" onClick={() => editor.chain().focus().toggleCode().run()}
          className={`${TB_BTN} ${editor.isActive("code") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${TB_BTN} ${editor.isActive("bulletList") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${TB_BTN} ${editor.isActive("orderedList") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        <button type="button" title="Link" onClick={setLink}
          className={`${TB_BTN} ${editor.isActive("link") ? TB_ACTIVE : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>

        {/* Image / video upload */}
        <button type="button" title="Insert image or video" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={`${TB_BTN} ${uploading ? "opacity-40 cursor-not-allowed" : ""}`}>
          {uploading ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" opacity=".2"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        <button type="button" title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={TB_BTN}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><line x1="17" y1="7" x2="7" y2="17"/></svg>
        </button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
