import type { Message } from "@/lib/types";

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === "them") {
    return (
      <div className="flex justify-start">
        <p
          className="message-animate font-serif text-ink max-w-[84%]"
          style={{ fontSize: "17px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
        >
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <p
        className="message-animate max-w-[84%] text-[15px] leading-relaxed text-ink/80"
        style={{
          background: "var(--bubble)",
          padding: "11px 16px",
          borderRadius: "15px 4px 15px 15px",
          whiteSpace: "pre-wrap",
          border: "0.5px solid var(--line-2)",
        }}
      >
        {message.text}
      </p>
    </div>
  );
}
