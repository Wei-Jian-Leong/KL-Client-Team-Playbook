"use client";

import { useState, useRef, useEffect } from "react";

interface Mentor {
  id: string;
  name: string;
}

interface Props {
  mentors: Mentor[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function MentorCombobox({
  mentors,
  value,
  onChange,
  multiple = false,
  placeholder = "Search mentor...",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedMentors = value.map((id) => mentors.find((m) => m.id === id)).filter(Boolean) as Mentor[];

  const available = mentors.filter((m) => !value.includes(m.id));
  const filtered = query.trim()
    ? available.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  function handleSelect(mentor: Mentor) {
    if (multiple) {
      onChange([...value, mentor.id]);
      setQuery("");
      inputRef.current?.focus();
    } else {
      onChange([mentor.id]);
      setQuery("");
      setOpen(false);
    }
  }

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((v) => v !== id));
  }

  function handleClearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
    setQuery("");
    setOpen(false);
  }

  function handleFocus() {
    if (!multiple && value.length > 0) setQuery("");
    setOpen(true);
  }

  const singleSelected = !multiple && value.length > 0 ? mentors.find((m) => m.id === value[0]) : null;
  const singleDisplayQuery = !multiple ? (open ? query : (singleSelected?.name ?? "")) : query;

  if (multiple) {
    return (
      <div ref={containerRef} className="relative">
        <div
          className={`flex flex-wrap gap-1.5 items-center min-h-[38px] border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 cursor-text transition-shadow ${
            open ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-gray-300 dark:border-gray-600"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
        >
          {selectedMentors.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2 py-0.5 rounded-full"
            >
              {m.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(m.id, e)}
                  className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 leading-none ml-0.5"
                  tabIndex={-1}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={handleFocus}
            disabled={disabled}
            placeholder={selectedMentors.length === 0 ? placeholder : "Add mentor..."}
            className="flex-1 min-w-[100px] text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none placeholder-gray-400 disabled:cursor-not-allowed"
          />
          {value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs ml-1"
              tabIndex={-1}
            >
              ✕
            </button>
          )}
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                {available.length === 0 ? "All mentors selected" : "No mentors found"}
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-gray-800 dark:text-gray-200"
                >
                  {m.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Single-select mode (legacy)
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={singleDisplayQuery}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={singleSelected ? "" : placeholder}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
        {value.length === 0 && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▾</span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">No mentors found</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
                  value.includes(m.id)
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {m.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
