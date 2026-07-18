'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useEffect, useState } from 'react';
import {
  FaBold,
  FaEraser,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaQuoteRight,
  FaRedo,
  FaRemoveFormat,
  FaUnderline,
  FaUndo,
  FaUnlink
} from 'react-icons/fa';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  describedBy?: string;
  placeholder?: string;
};

type ToolbarButtonProps = {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

const editorContentClass =
  'min-h-56 rounded-b-md border-x border-b bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 [&_.ProseMirror]:min-h-48 [&_.ProseMirror]:outline-none [&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5';

function ToolbarButton({ label, title, active = false, disabled = false, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-accent bg-accent text-foreground'
          : 'border-border bg-card text-foreground hover:border-accent/60 hover:bg-accent/10'
      }`}
    >
      {children}
    </button>
  );
}

function isEmptyDocument(html: string) {
  return !html || html === '<p></p>' || html === '<p><br></p>';
}

function normalizeEditorValue(value: string) {
  return value.trim() || '<p></p>';
}

function getSafeEditorUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function setLink(editor: Editor) {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }

  const href = window.prompt('Вставте посилання');
  if (href === null) {
    return;
  }

  const safeUrl = getSafeEditorUrl(href);
  if (!safeUrl) {
    return;
  }

  editor
    .chain()
    .focus()
    .setLink({ href: safeUrl, target: '_blank', rel: 'noopener noreferrer' })
    .run();
}

export function RichTextEditor({
  value,
  onChange,
  error,
  describedBy,
  placeholder = 'Опишіть стан техніки, комплектацію, напрацювання, виконані роботи та інші важливі деталі.'
}: RichTextEditorProps) {
  const [isEmpty, setIsEmpty] = useState(isEmptyDocument(value));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      Underline,
      Link.configure({
        autolink: false,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto', 'tel']
      })
    ],
    content: normalizeEditorValue(value),
    editorProps: {
      attributes: {
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': describedBy ?? '',
        class: 'min-h-48 outline-none'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      setIsEmpty(currentEditor.isEmpty);
      onChange(isEmptyDocument(html) ? '' : html);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextValue = normalizeEditorValue(value);
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
      setIsEmpty(editor.isEmpty);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={`min-h-56 rounded-md border bg-card px-4 py-3 text-sm text-muted ${error ? 'border-danger/50' : 'border-border'}`}>
        Завантаження редактора...
      </div>
    );
  }

  return (
    <div className={error ? 'rounded-md ring-1 ring-danger/50' : ''}>
      <div className="flex flex-wrap gap-2 rounded-t-md border border-border bg-surface-muted p-2">
        <ToolbarButton label="Абзац" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          P
        </ToolbarButton>
        <ToolbarButton label="Заголовок 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </ToolbarButton>
        <ToolbarButton label="Заголовок 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </ToolbarButton>
        <ToolbarButton label="Жирний" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FaBold aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Курсив" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FaItalic aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Підкреслення" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FaUnderline aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Маркований список" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FaListUl aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Нумерований список" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FaListOl aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Цитата" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <FaQuoteRight aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Додати або прибрати посилання" active={editor.isActive('link')} onClick={() => setLink(editor)}>
          {editor.isActive('link') ? <FaUnlink aria-hidden="true" /> : <FaLink aria-hidden="true" />}
        </ToolbarButton>
        <ToolbarButton label="Очистити форматування" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <FaRemoveFormat aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Очистити опис" onClick={() => editor.chain().focus().clearContent().run()}>
          <FaEraser aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Скасувати" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <FaUndo aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Повторити" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <FaRedo aria-hidden="true" />
        </ToolbarButton>
      </div>
      <div className="relative">
        {isEmpty ? <p className="pointer-events-none absolute left-4 top-3 z-10 max-w-2xl text-sm leading-6 text-muted/70">{placeholder}</p> : null}
        <EditorContent editor={editor} className={`${editorContentClass} ${error ? 'border-danger/50' : 'border-border'}`} />
      </div>
    </div>
  );
}
