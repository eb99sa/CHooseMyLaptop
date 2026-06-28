"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StateView } from "@/components/ui/StateView";
import { Icon } from "@/components/ui/Icon";

// Route-level error boundary (App Router). Honest message + retry, in the
// Chrome Spec Navigator state pattern.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <StateView
        tone="danger"
        icon="alert"
        title="صار خطأ غير متوقع"
        body="ما قدرنا نكمّل العملية الحين. تأكد من اتصالك وأعد المحاولة."
      >
        <button onClick={reset} className="btn btn-primary">
          <Icon name="refresh" size={16} />
          أعد المحاولة
        </button>
        <Link href="/" className="btn btn-quiet">
          الرئيسية
        </Link>
      </StateView>
    </main>
  );
}
