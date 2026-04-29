import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  label?: string;
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  label,
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

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="flex flex-col gap-1" ref={dropdownRef}>
      {label && (
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 h-[42px] ${
            isOpen 
              ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-blue-600" 
              : "border-gray-300 text-gray-900 hover:border-blue-400 hover:shadow-sm"
          }`}
        >
          <span className={`truncate pr-2 ${!selectedOption ? "text-gray-400 font-normal" : ""}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`flex-shrink-0 text-gray-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full animate-in fade-in zoom-in-95 slide-in-from-top-2 origin-top rounded-xl border border-gray-200/50 bg-white/95 backdrop-blur-xl p-1.5 shadow-xl shadow-blue-900/5 ring-1 ring-black/5">
            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1 space-y-0.5">
              {options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <span className="truncate pr-2">{option.label}</span>
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

export default FilterSelect;
