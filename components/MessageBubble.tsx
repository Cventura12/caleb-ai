import type { Message } from "@/lib/types";

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === "them") {
    return (
      <div className="flex justify-start">
        {/* Fraunces serif, no bubble — spoken text sitting on white */}
        <p
          className="message-animate font-serif text-ink max-w-[84%]"
          style={{ fontSize: "17px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}
        >
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      {/* Visitor bubble — Inter, soft background, top-right corner tightened */}
      <p
        className="message-animate max-w-[84%] text-[15.5px] leading-relaxed"
        style={{
          background: "var(--bubble)",
          color: "#3a3f48",
          padding: "11px 16px",
          borderRadius: "15px 4px 15px 15px",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.text}
      </p>
    </div>
  );
}
