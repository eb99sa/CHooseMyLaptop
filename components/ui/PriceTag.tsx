import { cn } from "@/lib/utils";

const THREE_DECIMAL = new Set(["KWD", "BHD", "OMR"]);

function amount(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  const max = THREE_DECIMAL.has(currency.toUpperCase()) ? 3 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: max });
}

interface PriceTagProps {
  price: number;
  currency: string;
  max?: number; // render a min–max range
  size?: "sm" | "md";
  className?: string;
}

// KWD price, always LTR so the Latin number + currency read correctly in RTL.
export function PriceTag({ price, currency, max, size = "md", className }: PriceTagProps) {
  const num = cn(
    "font-bold leading-none text-[var(--color-ink)]",
    size === "sm" ? "text-lg" : "text-2xl",
  );
  return (
    <span dir="ltr" className={cn("inline-flex items-baseline gap-1.5 tabular-nums", className)}>
      <span className="font-mono text-sm font-semibold tracking-[0.06em] text-[var(--color-muted)]">
        {currency}
      </span>
      <span className={num}>{amount(price, currency)}</span>
      {max != null && (
        <>
          <span className="font-medium text-[var(--color-faint)]">–</span>
          <span className={num}>{amount(max, currency)}</span>
        </>
      )}
    </span>
  );
}
