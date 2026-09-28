import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { SearchResponse } from "shared";

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  results: SearchResponse | null;
  onClear: () => void;
}

const EXAMPLE_QUERIES = [
  "Priya Sharma",
  "sharam",
  "in interview",
  "stuck in screening more than a week",
  "moved to interview since monday",
  "reached offer not hired",
  "except rejected",
];

export default function SearchBar({ value, onSearch, results, onClear }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showExamples, setShowExamples] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowExamples(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onSearch(newValue);
    setShowExamples(true);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showExamples) return;

    const examples = EXAMPLE_QUERIES;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, examples.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const selected = examples[focusedIndex];
      setLocalValue(selected);
      onSearch(selected);
      setShowExamples(false);
      setFocusedIndex(-1);
    } else if (e.key === "Escape") {
      setShowExamples(false);
      setFocusedIndex(-1);
    }
  };

  const handleFocus = () => {
    if (localValue.trim() === "") {
      setShowExamples(true);
    }
  };

  const handleExampleClick = (query: string) => {
    setLocalValue(query);
    onSearch(query);
    setShowExamples(false);
    inputRef.current?.focus();
  };

  const hasError = results?.error && (!results.results || results.results.length === 0);

  return (
    <div className="search-bar" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className={`search-input ${hasError ? "error" : ""}`}
          placeholder="Search candidates... (e.g., 'stuck in screening more than a week')"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {localValue && (
          <button className="clear-search" onClick={onClear} aria-label="Clear search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {results?.error && (
        <div className="search-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {results.error}
        </div>
      )}

      {results?.interpretation && !hasError && (
        <div className="interpretation-chips">
          <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>Interpreted as:</span>
          <span className="interpretation-chip">{results.interpretation}</span>
          {results.results && results.results.length === 0 && (
            <span style={{ fontSize: 12, color: "#d97706", marginLeft: 8 }}>
              No matches. Try relaxing a filter.
            </span>
          )}
        </div>
      )}

      {showExamples && localValue.trim() === "" && (
        <div className="search-examples">
          {EXAMPLE_QUERIES.map((query, index) => (
            <button
              key={query}
              className={`example-chip ${index === focusedIndex ? "focused" : ""}`}
              onClick={() => handleExampleClick(query)}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}