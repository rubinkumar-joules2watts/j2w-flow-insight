import React, { useState, useRef, useEffect } from "react";
import { X, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Table as TableIcon, ChevronDown, Check } from "lucide-react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.getAttribute('bgcolor') || element.style.backgroundColor || element.style.background || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

/* ===== Form Input ===== */
export const FormInput = ({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) => (
  <div>
    <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none transition-all hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

/* ===== Form Select ===== */
export const FormSelect = ({
  label,
  value,
  onChange,
  onBlur,
  options,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  options: string[];
  required?: boolean;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onBlur={onBlur}
          className={`w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${
            isOpen 
              ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-blue-600" 
              : "border-gray-300 text-gray-900 hover:border-gray-400 hover:shadow-sm"
          }`}
        >
          <span className={`truncate pr-2 ${!value ? "text-gray-400 font-normal" : ""}`}>
            {value || "Select..."}
          </span>
          <ChevronDown
            size={14}
            className={`flex-shrink-0 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
          />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1.5 w-full animate-in fade-in zoom-in-95 slide-in-from-top-2 origin-top rounded-xl border border-gray-200/50 bg-white/95 backdrop-blur-xl p-1.5 shadow-xl shadow-blue-900/5 ring-1 ring-black/5">
            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1 space-y-0.5">
              {options.map((opt) => {
                const isSelected = value === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all text-left ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    {isSelected && <Check size={14} className="flex-shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ===== Form Range ===== */
export const FormRange = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  unit = "%",
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {label}
      </label>
      <span className="text-xs font-semibold text-blue-600">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className="w-full accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

/* ===== Form Checkbox Group ===== */
export const FormCheckboxGroup = ({
  label,
  items,
  selectedIds,
  onChange,
  maxHeight = "max-h-32",
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: string;
}) => (
  <div>
    <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
      {label}
    </label>
    <div className={`${maxHeight} overflow-y-auto space-y-2 rounded-lg border border-gray-300 bg-gray-50 p-3`}>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">No items available</p>
      ) : (
        items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-2 text-xs text-gray-900 cursor-pointer hover:text-gray-700 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selectedIds, item.id]
                    : selectedIds.filter((id) => id !== item.id)
                )
              }
              className="rounded border-gray-400 accent-blue-500 cursor-pointer"
            />
            {item.name}
          </label>
        ))
      )}
    </div>
  </div>
);

/* ===== Form Textarea ===== */
export const FormTextarea = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
}) => (
  <div>
    <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none transition-all hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
    />
  </div>
);

/* ===== Modal Wrapper ===== */
export const FormModal = ({
  title,
  isOpen,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className={`${maxWidth} w-full max-h-[90vh] flex flex-col rounded-2xl border border-white/20 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white sticky top-0 z-10">
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

/* ===== Form Actions ===== */
export const FormActions = ({
  onSubmit,
  onCancel,
  submitLabel = "Save",
  submitVariant = "primary",
  isLoading = false,
}: {
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  submitVariant?: "primary" | "danger";
  isLoading?: boolean;
}) => (
  <div className="flex gap-3">
    <button
      onClick={onCancel}
      disabled={isLoading}
      className="flex-1 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Cancel
    </button>
    <button
      onClick={onSubmit}
      disabled={isLoading}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        submitVariant === "danger"
          ? "bg-red-500 hover:bg-red-600"
          : "bg-blue-500 hover:bg-blue-600"
      }`}
    >
      {isLoading ? "Processing..." : submitLabel}
    </button>
  </div>
);

/* ===== Divider ===== */
export const FormDivider = ({ label }: { label?: string }) => {
  if (!label) {
    return <div className="h-px bg-gray-300" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-gray-300" />
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );
};

/* ===== Form Section ===== */
export const FormSection = ({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) => (
  <div>
    {title && (
      <h4 className="mb-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {title}
      </h4>
    )}
    <div className="space-y-3">{children}</div>
  </div>
);

/* ===== Form Rich Text Editor ===== */
const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const toggleBtnClass = (isActive: boolean) => 
    `p-1.5 rounded transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg items-center">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={toggleBtnClass(editor.isActive('bold'))} title="Bold">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={toggleBtnClass(editor.isActive('italic'))} title="Italic">
        <Italic size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={toggleBtnClass(editor.isActive('underline'))} title="Underline">
        <UnderlineIcon size={16} />
      </button>
      
      <div className="w-px h-4 bg-gray-300 mx-1"></div>

      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1">
        <Heading1 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2">
        <Heading2 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={toggleBtnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3">
        <Heading3 size={16} />
      </button>

      <div className="w-px h-4 bg-gray-300 mx-1"></div>

      <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={toggleBtnClass(editor.isActive({ textAlign: 'left' }))} title="Align Left">
        <AlignLeft size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={toggleBtnClass(editor.isActive({ textAlign: 'center' }))} title="Align Center">
        <AlignCenter size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={toggleBtnClass(editor.isActive({ textAlign: 'right' }))} title="Align Right">
        <AlignRight size={16} />
      </button>

      <div className="w-px h-4 bg-gray-300 mx-1"></div>

      <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={toggleBtnClass(false)} title="Insert Table">
        <TableIcon size={16} />
      </button>

      {editor.isActive('table') && (
        <div className="flex bg-gray-200/50 p-0.5 rounded gap-1 ml-2">
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="text-[10px] px-1.5 py-0.5 font-bold bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700">
            +Col
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="text-[10px] px-1.5 py-0.5 font-bold bg-red-50 text-red-600 rounded shadow-sm hover:bg-red-100">
            -Col
          </button>
          <div className="w-px h-4 bg-gray-300 mx-0.5 my-auto"></div>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="text-[10px] px-1.5 py-0.5 font-bold bg-white rounded shadow-sm hover:bg-gray-50 text-gray-700">
            +Row
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="text-[10px] px-1.5 py-0.5 font-bold bg-red-50 text-red-600 rounded shadow-sm hover:bg-red-100">
            -Row
          </button>
          <div className="w-px h-4 bg-gray-300 mx-0.5 my-auto"></div>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="text-[10px] px-1.5 py-0.5 font-bold bg-red-100 text-red-700 rounded shadow-sm hover:bg-red-200">
            Del Table
          </button>
        </div>
      )}
    </div>
  );
};

export const FormRichTextEditor = ({
  label,
  value,
  onChange,
  required = false,
  minHeight = "min-h-[150px]",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minHeight?: string;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      CustomTableCell,
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none p-3 ${minHeight} w-full text-xs j2w-rich-text`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    
    if (value === currentHtml) return;
    
    // Tolerate mismatch when parent passes '' and editor defaults to '<p></p>'
    if ((!value || value === '<p></p>') && currentHtml === '<p></p>') {
      return;
    }

    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  return (
    <div className="flex flex-col w-full">
      {label && (
        <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all">
        <MenuBar editor={editor} />
        <div className="overflow-y-auto max-h-[400px] custom-scrollbar text-gray-900 leading-normal">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};

