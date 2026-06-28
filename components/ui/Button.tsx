import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "quiet";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary", // carbon pill — the single confident action
  ghost: "btn-ghost", // outlined secondary
  quiet: "btn-quiet", // text only
};
const SIZE: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export function Button({
  variant = "primary",
  size = "md",
  block,
  iconStart,
  iconEnd,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("btn", VARIANT[variant], SIZE[size], block && "w-full", className)}
      {...props}
    >
      {iconStart}
      {children}
      {iconEnd}
    </button>
  );
}
