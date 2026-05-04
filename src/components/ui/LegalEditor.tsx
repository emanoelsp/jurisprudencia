'use client'
import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import {
  Bold, Italic, UnderlineIcon, Heading1, Heading2,
  Quote, List, ListOrdered, Undo2, Redo2, Printer,
} from 'lucide-react'

export interface LegalEditorRef {
  insertContent: (text: string) => void
  getHTML: () => string
  getText: () => string
  getWordCount: () => number
  isEmpty: () => boolean
  setHTML: (html: string) => void
}

interface Props {
  initialContent?: string
  placeholder?: string
  onChange?: (html: string) => void
  className?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const LegalEditor = forwardRef<LegalEditorRef, Props>(
  ({ initialContent = '', placeholder = 'Comece a redigir seu parecer…', onChange, className }, ref) => {
    const flashRef = useRef<HTMLDivElement>(null)

    const editor = useEditor({
      extensions: [
        StarterKit,
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder }),
        CharacterCount,
      ],
      content: initialContent || undefined,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: 'focus:outline-none' },
      },
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    })

    useImperativeHandle(ref, () => ({
      insertContent: (text: string) => {
        if (!editor) return

        // Visual feedback — flash ring via CSS class (not dynamic Tailwind class)
        if (flashRef.current) {
          flashRef.current.classList.add('editor-insert-flash')
          setTimeout(() => flashRef.current?.classList.remove('editor-insert-flash'), 500)
        }

        // Format as legal citation: header bold + body as blockquote
        const lines = text.split('\n').filter(l => l.trim())
        if (!lines.length) return

        const [header, ...rest] = lines
        const bodyHtml = rest.length
          ? `<blockquote>${rest.map(l => `<p>${escapeHtml(l)}</p>`).join('')}</blockquote>`
          : ''
        const html = `<p><strong>${escapeHtml(header)}</strong></p>${bodyHtml}`

        editor.chain().focus().insertContent(html).run()
      },
      getHTML:       () => editor?.getHTML() ?? '',
      getText:       () => editor?.getText() ?? '',
      getWordCount:  () => {
        const t = editor?.getText().trim() ?? ''
        return t ? t.split(/\s+/).length : 0
      },
      isEmpty: () => editor?.isEmpty ?? true,
      setHTML: (html: string) => editor?.commands.setContent(html),
    }), [editor])

    // Load Firestore content after editor mounts (only if editor is still empty)
    useEffect(() => {
      if (editor && initialContent && editor.isEmpty) {
        editor.commands.setContent(initialContent)
      }
    }, [editor, initialContent])

    if (!editor) return null

    const words = (() => { const t = editor.getText().trim(); return t ? t.split(/\s+/).length : 0 })()
    const chars = (editor.storage.characterCount?.characters?.() as number | undefined) ?? 0

    const Btn = ({
      onClick, active = false, title, children,
    }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onClick() }}
        title={title}
        className={`p-1.5 rounded-md transition-colors ${
          active
            ? 'bg-brand-indigo/25 text-brand-indigo'
            : 'text-brand-slate hover:text-brand-cream hover:bg-brand-navylt'
        }`}
      >
        {children}
      </button>
    )

    const Sep = () => <div className="w-px h-4 bg-brand-border mx-1 flex-shrink-0" />

    const handlePrint = () => {
      const html = editor.getHTML()
      const win = window.open('', '_blank', 'width=820,height=960')
      if (!win) return
      win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Parecer Jurídico — IurisPrudentIA</title>
  <style>
    body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.7;
           max-width: 740px; margin: 40px auto; color: #111; }
    h1   { font-size: 15pt; margin-top: 1.4em; }
    h2   { font-size: 13pt; margin-top: 1.2em; }
    blockquote { border-left: 3px solid #888; padding-left: 1em;
                 color: #444; margin: 0.8em 0; font-style: italic; }
    ul, ol { padding-left: 1.5em; }
    strong { font-weight: 600; }
    @media print { body { margin: 20mm; } }
  </style>
</head>
<body>${html}</body>
</html>`)
      win.document.close()
      win.focus()
      win.print()
    }

    return (
      <div
        className={`flex flex-col border border-brand-border rounded-xl overflow-hidden bg-brand-navy ${className ?? ''}`}
      >
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-brand-border bg-brand-navylt/70 flex-wrap">
          <Btn onClick={() => editor.chain().focus().toggleBold().run()}
               active={editor.isActive('bold')} title="Negrito (Ctrl+B)">
            <Bold size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()}
               active={editor.isActive('italic')} title="Itálico (Ctrl+I)">
            <Italic size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()}
               active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
            <UnderlineIcon size={13} />
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
               active={editor.isActive('heading', { level: 1 })} title="Título 1">
            <Heading1 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
               active={editor.isActive('heading', { level: 2 })} title="Título 2">
            <Heading2 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()}
               active={editor.isActive('blockquote')} title="Citação jurídica">
            <Quote size={13} />
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}
               active={editor.isActive('bulletList')} title="Lista">
            <List size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}
               active={editor.isActive('orderedList')} title="Lista numerada">
            <ListOrdered size={13} />
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)">
            <Undo2 size={13} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)">
            <Redo2 size={13} />
          </Btn>

          {/* spacer */}
          <div className="flex-1" />

          <button
            type="button"
            onClick={handlePrint}
            title="Exportar / Imprimir como PDF"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-brand-slate hover:text-brand-cream hover:bg-brand-navylt transition-colors"
          >
            <Printer size={12} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>

        {/* ── Editor area ── */}
        <div ref={flashRef} className="flex-1 cursor-text transition-[box-shadow] duration-500"
             onClick={() => editor.commands.focus()}>
          <EditorContent editor={editor} />
        </div>

        {/* ── Footer: counters ── */}
        <div className="flex items-center justify-end px-4 py-1.5 border-t border-brand-border bg-brand-navylt/40">
          <span className="text-[10px] text-brand-slate/50 font-mono tabular-nums">
            {words} {words === 1 ? 'palavra' : 'palavras'} · {chars} caracteres
          </span>
        </div>
      </div>
    )
  }
)

LegalEditor.displayName = 'LegalEditor'
export default LegalEditor
