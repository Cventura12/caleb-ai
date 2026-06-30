"use client";

import { useState, useRef } from "react";
import { SUGGESTED_QUESTIONS } from "@/lib/knowledge";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  showChips: boolean;
}

export function Composer({ onSend, disabled, showChips }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div
      className="shrink-0 bg-bg/95 backdrop-blur-sm"
      style={{ borderTop: "0.5px solid var(--line)" }}
    >
      {showChips && (
        <div className="flex flex-wrap gap-2 px-4 sm:px-6 pt-3 pb-1">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={disabled}
              className="
                px-3 py-[6px] rounded-full text-[13px]
                border border-line-2 text-gray-1
                hover:border-navy hover:text-navy
                transition-colors motion-reduce:transition-none
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3 px-4 sm:px-6 py-3">
        <label htmlFor="chat-input" className="sr-only">
          Ask me anything
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="ask me anything..."
          rows={1}
          disabled={disabled}
          className="
            flex-1 resize-none bg-bubble rounded-xl px-4 py-[11px]
            text-[15px] text-ink placeholder:text-gray-2 leading-relaxed
            overflow-y-auto focus:outline-none focus:ring-1 focus:ring-navy/50
            transition-[box-shadow] motion-reduce:transition-none
            disabled:opacity-50
          "
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={() => send(input)}
          disabled={disabled}
          aria-label="Send message"
          className="
            w-[50px] h-[50px] rounded-xl bg-navy shrink-0
            flex items-center justify-center
            hover:bg-navy-soft
            transition-colors motion-reduce:transition-none
            focus-visible:outline focus-visible:outline-2
            focus-visible:outline-navy focus-visible:outline-offset-2
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M3 9h12M10 4l5 5-5 5"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
