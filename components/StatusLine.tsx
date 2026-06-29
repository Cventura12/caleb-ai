// Inline status shown while a tool is executing — quiet, on-brand, not a bubble.
// Replaces the typing indicator for the duration of a tool call.
export function StatusLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[7px] px-1" role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span className="text-[13.5px] italic text-gray-3 leading-none">{label}</span>
    </div>
  );
}
