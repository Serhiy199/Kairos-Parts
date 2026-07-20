'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaBold,
  FaEraser,
  FaImage,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaQuoteRight,
  FaRedo,
  FaRemoveFormat,
  FaTable,
  FaTrashAlt,
  FaUnderline,
  FaUndo,
  FaUnlink
} from 'react-icons/fa';

import { normalizeRichTextHtml } from '@/lib/rich-text/normalize';
import { applyHeading } from '@/lib/rich-text/heading';

type AdminRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  className?: string;
  error?: string;
  describedBy?: string;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, active = false, disabled = false, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-accent bg-accent text-foreground'
          : 'border-border bg-card text-foreground hover:border-accent/60 hover:bg-accent/10'
      }`}
    >
      {children}
    </button>
  );
}

function normalizeEditorValue(value: string) {
  return normalizeRichTextHtml(value) || '<p></p>';
}

function isEmptyDocument(html: string) {
  return !html || html === '<p></p>' || html === '<p><br></p>';
}

function getSafeEditorUrl(input: string, allowedProtocols: string[]) {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (allowedProtocols.some((protocol) => trimmed.toLowerCase().startsWith(`${protocol}:`))) {
    return trimmed;
  }

  const withProtocol = `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return allowedProtocols.includes(url.protocol.replace(':', '')) ? url.toString() : null;
  } catch {
    return null;
  }
}

function setLink(editor: Editor) {
  const currentHref = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt('Вставте або змініть посилання', currentHref ?? '');

  if (href === null) {
    return;
  }

  if (!href.trim()) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  const safeUrl = getSafeEditorUrl(href, ['http', 'https', 'mailto', 'tel']);
  if (!safeUrl) {
    window.alert('Вкажіть коректне посилання.');
    return;
  }

  editor
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: safeUrl, target: '_blank', rel: 'noopener noreferrer' })
    .run();
}

function insertImage(editor: Editor) {
  const src = window.prompt('Вставте HTTPS URL зображення');

  if (src === null) {
    return;
  }

  const safeUrl = getSafeEditorUrl(src, ['http', 'https']);
  if (!safeUrl) {
    window.alert('Вкажіть коректний HTTP або HTTPS URL зображення.');
    return;
  }

  const alt = window.prompt('Альтернативний опис зображення', '') ?? '';
  editor.chain().focus().setImage({ src: safeUrl, alt: alt.trim() }).run();
}

export function AdminRichTextEditor({
  value,
  onChange,
  placeholder = 'Опишіть стан техніки, комплектацію, напрацювання, виконані роботи та інші важливі деталі.',
  disabled = false,
  minHeight = 224,
  className = '',
  error,
  describedBy
}: AdminRichTextEditorProps) {
  const [isEmpty, setIsEmpty] = useState(isEmptyDocument(normalizeEditorValue(value)));
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false
      }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ['http', 'https', 'mailto', 'tel']
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { loading: 'lazy' }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right']
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: normalizeEditorValue(value),
    editorProps: {
      attributes: {
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': describedBy ?? '',
        class: 'min-h-[inherit] outline-none'
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

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className={`rounded-md border bg-card px-4 py-3 text-sm text-muted ${error ? 'border-danger/50' : 'border-border'} ${className}`}
        style={{ minHeight }}
      >
        Завантаження редактора...
      </div>
    );
  }

  const controlsDisabled = disabled || !editor.isEditable;

  return (
    <div className={`${error ? 'rounded-md ring-1 ring-danger/50' : ''} ${className}`}>
      <div className="flex flex-wrap gap-2 rounded-t-md border border-border bg-surface-muted p-2">
        <ToolbarButton label="Абзац" disabled={controlsDisabled} active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          P
        </ToolbarButton>
        <ToolbarButton label="Заголовок 2" disabled={controlsDisabled} active={editor.isActive('heading', { level: 2 })} onClick={() => applyHeading(editor, 2)}>
          H2
        </ToolbarButton>
        <ToolbarButton label="Заголовок 3" disabled={controlsDisabled} active={editor.isActive('heading', { level: 3 })} onClick={() => applyHeading(editor, 3)}>
          H3
        </ToolbarButton>
        <ToolbarButton label="Жирний" disabled={controlsDisabled} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FaBold aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Курсив" disabled={controlsDisabled} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FaItalic aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Підкреслення" disabled={controlsDisabled} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FaUnderline aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Маркований список" disabled={controlsDisabled} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FaListUl aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Нумерований список" disabled={controlsDisabled} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FaListOl aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Цитата" disabled={controlsDisabled} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <FaQuoteRight aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Вирівняти ліворуч" disabled={controlsDisabled} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <FaAlignLeft aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Вирівняти по центру" disabled={controlsDisabled} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <FaAlignCenter aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Вирівняти праворуч" disabled={controlsDisabled} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <FaAlignRight aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Додати або змінити посилання" disabled={controlsDisabled} active={editor.isActive('link')} onClick={() => setLink(editor)}>
          <FaLink aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Прибрати посилання" disabled={controlsDisabled || !editor.isActive('link')} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>
          <FaUnlink aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Вставити зображення за URL" disabled={controlsDisabled} onClick={() => insertImage(editor)}>
          <FaImage aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Вставити таблицю" disabled={controlsDisabled} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <FaTable aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Додати рядок" disabled={controlsDisabled || !editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}>
          Р+
        </ToolbarButton>
        <ToolbarButton label="Видалити рядок" disabled={controlsDisabled || !editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}>
          Р-
        </ToolbarButton>
        <ToolbarButton label="Додати колонку" disabled={controlsDisabled || !editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}>
          К+
        </ToolbarButton>
        <ToolbarButton label="Видалити колонку" disabled={controlsDisabled || !editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}>
          К-
        </ToolbarButton>
        <ToolbarButton label="Видалити таблицю" disabled={controlsDisabled || !editor.can().deleteTable()} onClick={() => editor.chain().focus().deleteTable().run()}>
          <FaTrashAlt aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Очистити форматування" disabled={controlsDisabled} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <FaRemoveFormat aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Очистити опис" disabled={controlsDisabled} onClick={() => editor.chain().focus().clearContent().run()}>
          <FaEraser aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Скасувати" disabled={controlsDisabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <FaUndo aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Повторити" disabled={controlsDisabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <FaRedo aria-hidden="true" />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty ? <p className="pointer-events-none absolute left-4 top-3 z-10 max-w-2xl text-sm leading-6 text-muted/70">{placeholder}</p> : null}
        <EditorContent
          editor={editor}
          className={`overflow-x-auto rounded-b-md border-x border-b bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none [&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:my-4 [&_table]:min-w-[640px] [&_table]:border-collapse [&_table]:table-fixed [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-muted [&_th]:p-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 ${error ? 'border-danger/50' : 'border-border'}`}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
