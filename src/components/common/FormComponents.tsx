import React from "react";
import { X } from "lucide-react";

/* ===== Form Input ===== */
export const FormInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) => (
  <div>
    <label className="mb-2 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

/* ===== Form Select ===== */
export const FormSelect = ({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
  disabled?: boolean;
}) => (
  <div>
    <label className="mb-2 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

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
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
        {label}
      </label>
      <span className="text-xs font-semibold text-blue-400">
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
    <label className="mb-2 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
      {label}
    </label>
    <div className={`${maxHeight} overflow-y-auto space-y-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3`}>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No items available</p>
      ) : (
        items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-2 text-xs text-slate-100 cursor-pointer hover:text-slate-50 transition-colors"
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
              className="rounded border-slate-600 accent-blue-500 cursor-pointer"
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
    <label className="mb-2 block text-xs font-semibold text-slate-300 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 outline-none transition-all hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`${maxWidth} w-full rounded-lg border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800 p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
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
      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    return <div className="h-px bg-slate-700" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-slate-700" />
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-700" />
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
      <h4 className="mb-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
        {title}
      </h4>
    )}
    <div className="space-y-3">{children}</div>
  </div>
);
