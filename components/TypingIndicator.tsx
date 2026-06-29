// Rendered in a "them"-style row while the AI is generating a reply
export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-[5px] py-[6px]">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
        <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
