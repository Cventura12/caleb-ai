"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { StatusLine } from "./StatusLine";

interface Props {
  messages: Message[];
  isTyping: boolean;
  toolStatus: string | null;
}

export function MessageList({ messages, isTyping, toolStatus }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping, toolStatus]);

  return (
    <div className="flex flex-col gap-[22px] px-4 sm:px-8 pt-7 pb-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isTyping && (
        toolStatus ? <StatusLine label={toolStatus} /> : <TypingIndicator />
      )}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
