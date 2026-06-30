"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, ApiMessage } from "@/lib/types";
import { getReply, ApiError } from "@/lib/getReply";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

type PageState = "gate" | "chat";

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Map UI messages + the invisible seed into the wire format /api/chat expects.
// Skips isError bubbles so a failed reply is never sent back as assistant context.
function buildApiHistory(seed: ApiMessage | null, msgs: Message[]): ApiMessage[] {
  const history: ApiMessage[] = seed ? [seed] : [];
  for (const m of msgs) {
    if (m.isError) continue;
    history.push({
      role: m.role === "me" ? "user" : "assistant",
      content: m.text,
    });
  }
  return history;
}

// In-voice fallback text — stays in Caleb's register even when things break.
function errorBubble(err: unknown): Message {
  const text =
    err instanceof ApiError && err.status === 429
      ? "ay you're going fast lol — give it a sec and ask again"
      : "ah something glitched on my end — try again in a sec";
  return { id: newId(), role: "them", text, isError: true };
}

// Generate a stable session ID per browser session (survives React re-renders,
// resets on tab close). useRef + useEffect avoids SSR hydration mismatch.
function useSessionId(): string | undefined {
  const ref = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const KEY = "caleb_ai_sid";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    ref.current = id;
    setReady(true);
  }, []);
  return ready ? ref.current : undefined;
}

function useIsOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    fetch("/api/owner/me")
      .then((r) => r.json())
      .then((d: { isOwner?: boolean }) => setIsOwner(d.isOwner === true))
      .catch(() => {});
  }, []);
  return isOwner;
}

export default function ChatPage() {
  const sessionId = useSessionId();
  const isOwner = useIsOwner();

  // ── Gate state ────────────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>("gate");
  const [gateInput, setGateInput] = useState("");
  const gateTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  // Invisible seed — framing sent to the API on every turn but never rendered
  const [apiSeed, setApiSeed] = useState<ApiMessage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  const isGate = pageState === "gate";

  // ── Gate submit — transitions to chat and fetches the personalized greeting ─
  const handleGateSubmit = async () => {
    const trimmed = gateInput.trim();
    if (!trimmed) return;

    // Build the invisible seed: tells the model who the visitor is and what
    // kind of opening to give, without showing any of this text in the thread.
    const seed: ApiMessage = {
      role: "user",
      content:
        `[The visitor was asked "how do you know me?" and replied with the following. ` +
        `Greet them warmly in character, gauging who they are from it, then invite their question.]\n\n` +
        trimmed,
    };

    setGateInput("");
    if (gateTextareaRef.current) gateTextareaRef.current.style.height = "auto";
    setApiSeed(seed);
    setPageState("chat");
    setIsTyping(true);

    // Fetch the personalized greeting immediately — first visible message in thread
    try {
      const reply = await getReply(
        [seed],
        (label) => setToolStatus(label),
        { sessionId, gateAnswer: trimmed }
      );
      setToolStatus(null);
      setMessages([{ id: newId(), role: "them", text: reply }]);
    } catch (err) {
      setToolStatus(null);
      setMessages([errorBubble(err)]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleGateSubmit();
    }
  };

  const handleGateTextareaInput = () => {
    const el = gateTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // ── Chat send handler ─────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    // Drop any lingering error bubble before appending the new user message.
    // This keeps the API history clean and clears the error from the UI.
    const base = messages.filter((m) => !m.isError);
    const userMsg: Message = { id: newId(), role: "me", text };
    const next = [...base, userMsg];

    setMessages(next);
    setHasSentMessage(true);
    setIsTyping(true);

    try {
      const reply = await getReply(
        buildApiHistory(apiSeed, next),
        (label) => setToolStatus(label),
        { sessionId }
      );
      setToolStatus(null);
      setMessages((prev) => [
        ...prev.filter((m) => !m.isError),
        { id: newId(), role: "them", text: reply },
      ]);
    } catch (err) {
      setToolStatus(null);
      setMessages((prev) => [
        ...prev.filter((m) => !m.isError),
        errorBubble(err),
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh">

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header
        className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-sm z-10"
        style={{ borderBottom: "0.5px solid var(--line)" }}
      >
        <div className="flex items-center gap-3">
          {/*
            AVATAR — swap this div for an <Image> to replace initials with a photo.
            Keep the same w-[38px] h-[38px] rounded-full wrapper.
          */}
          <div
            className="w-[38px] h-[38px] rounded-full bg-navy flex items-center justify-center shrink-0 select-none"
            aria-hidden="true"
          >
            <span className="text-white text-[13px] font-medium tracking-wide">
              CV
            </span>
          </div>

          <div>
            <p className="text-[14px] font-medium text-ink leading-none mb-[3px]">
              Caleb Ventura
            </p>
            <div className="flex items-center gap-[5px]">
              <span
                className="w-[6px] h-[6px] rounded-full bg-green shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11.5px] text-gray-2 leading-none">
                {isGate ? "the AI version of me" : "online"}
              </span>
            </div>
          </div>
        </div>

        {isOwner ? (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-medium text-navy/70 bg-navy/8 px-2 py-0.5 rounded-full leading-none">
              owner
            </span>
            <a
              href="/owner"
              className="text-[11px] text-gray-2 hover:text-ink transition-colors"
              title="Control panel"
            >
              panel ↗
            </a>
          </div>
        ) : (
          <span className="text-[11px] text-gray-3 shrink-0">
            Chattanooga&nbsp;·&nbsp;18
          </span>
        )}
      </header>

      {/* ── STAGE ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {isGate ? (
          <div className="flex flex-col min-h-full px-4 sm:px-8 pt-12 sm:pt-14 pb-5">
            <div>
              <h1 className="font-serif text-[25px] sm:text-[29px] text-ink leading-[1.3] max-w-[440px] mb-4">
                Hey — I'm Caleb. The AI trained to be me.
              </h1>
              <p className="text-[16px] text-gray-1 max-w-[410px] mb-6 leading-relaxed">
                Ask me what I'm building, where I'm from, what I believe. But
                first —
              </p>
              <p className="text-[12px] text-gray-3 uppercase tracking-[0.05em]">
                How do you know me?
              </p>
            </div>
            <p className="mt-auto pt-8 text-[11.5px] text-gray-3">caleb.ai</p>
          </div>
        ) : (
          <MessageList messages={messages} isTyping={isTyping} toolStatus={toolStatus} />
        )}
      </main>

      {/* ── DOCK ─────────────────────────────────────────────────────────── */}
      {isGate ? (
        <div
          className="shrink-0 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-sm"
          style={{ borderTop: "0.5px solid var(--line)" }}
        >
          <div className="flex items-end gap-3">
            <label htmlFor="gate-input" className="sr-only">
              How do you know me?
            </label>
            <textarea
              id="gate-input"
              ref={gateTextareaRef}
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              onInput={handleGateTextareaInput}
              onKeyDown={handleGateKeyDown}
              placeholder="a follower, a friend, someone new..."
              rows={1}
              className="
                flex-1 resize-none bg-bubble rounded-xl px-4 py-[11px]
                text-[15px] text-ink placeholder:text-gray-3 leading-relaxed
                overflow-y-auto focus:outline-none focus:ring-2 focus:ring-navy
                transition-[box-shadow] motion-reduce:transition-none
              "
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={() => void handleGateSubmit()}
              aria-label="Send message"
              className="
                w-[50px] h-[50px] rounded-xl bg-navy shrink-0
                flex items-center justify-center
                hover:bg-navy-soft
                transition-colors motion-reduce:transition-none
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-navy focus-visible:outline-offset-2
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
      ) : (
        <Composer
          onSend={(text) => void handleSendMessage(text)}
          disabled={isTyping}
          showChips={!hasSentMessage}
        />
      )}

    </div>
  );
}
