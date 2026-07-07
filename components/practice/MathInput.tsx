"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { renderMath } from "@/lib/content/miniMarkdown";

interface MathInputProps {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly disabled: boolean;
  readonly startingExpression?: string | null;
  readonly placeholder?: string;
}

export function MathInput({
  value,
  setValue,
  disabled,
  startingExpression,
  placeholder,
}: MathInputProps) {
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = useCallback(
    (format: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setValue(value + format);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      setValue(before + format + after);
      requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + format.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [value, setValue]
  );

  const previewText = value.trim().length > 0
    ? value
        .replace(/\\\(/g, "$")
        .replace(/\\\)/g, "$")
        .replace(/\\\[/g, "$$")
        .replace(/\\\]/g, "$$")
    : "";

  return (
    <div className="flex flex-col gap-2">
      {startingExpression && (
        <div className="rounded-lg border border-border bg-surface-elevated px-3.5 py-2.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Starting expression
          </span>
          <p className="mt-1 font-mono text-[13.5px] leading-relaxed text-foreground">
            {startingExpression}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mr-1">
          Insert:
        </span>
        <MathToolbarButton label="Fraction" insert="\\frac{}{}" onClick={handleInsert} disabled={disabled} />
        <MathToolbarButton label="Sqrt" insert="\\sqrt{}" onClick={handleInsert} disabled={disabled} />
        <MathToolbarButton label="Power" insert="^{}" onClick={handleInsert} disabled={disabled} />
        <MathToolbarButton label="Subscript" insert="_{}" onClick={handleInsert} disabled={disabled} />
        <MathToolbarButton label="Inline math" insert="\\(\\)" onClick={handleInsert} disabled={disabled} />
        <MathToolbarButton label="Display math" insert="\\[\\]" onClick={handleInsert} disabled={disabled} />
        <span className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowPreview(!showPreview)}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors",
            showPreview
              ? "bg-accent-subtle/30 text-accent"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Preview
        </button>
      </div>

      <div className={showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-3" : ""}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          rows={8}
          maxLength={3000}
          placeholder={placeholder ?? "Derive step by step. Use \\\\( ... \\\\) for inline math and \\\\[ ... \\\\] for display math."}
          className="min-h-[6rem] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40 disabled:opacity-60"
        />

        {showPreview && previewText.length > 0 && (
          <div className="rounded-lg border border-accent-border/30 bg-accent-subtle/10 px-3.5 py-3 overflow-auto max-h-[16rem]">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Preview
            </span>
            <div className="mt-1.5 font-mono text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
              {renderMath(previewText)}
            </div>
          </div>
        )}
        {showPreview && previewText.length === 0 && (
          <div className="rounded-lg border border-border/30 bg-surface-elevated/20 px-3.5 py-3 flex items-center justify-center">
            <span className="text-[11.5px] text-muted-foreground">
              Type LaTeX to see a preview
            </span>
          </div>
        )}
      </div>

      <span className="text-[11px] text-muted-foreground">
        Use \\\\( ... \\\\) for inline math, \\\\[ ... \\\\] for display math.
        Fractions: \\frac&#123;num&#125;&#123;den&#125;,
        Powers: x^&#123;2&#125;,
        Subscripts: x_&#123;1&#125;,
        Square roots: \\sqrt&#123;x&#125;
      </span>
    </div>
  );
}

function MathToolbarButton({
  label,
  insert,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly insert: string;
  readonly onClick: (text: string) => void;
  readonly disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(insert)}
      className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
    >
      {label}
    </button>
  );
}
