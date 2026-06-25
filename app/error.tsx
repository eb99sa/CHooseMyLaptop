"use client";

import { useEffect } from "react";

// Route-level error boundary (App Router). Shows a friendly Arabic message
// and lets the user retry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to logs for debugging.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-extrabold">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-[var(--color-muted)]">
        نعتذر، حصل خطأ أثناء تنفيذ العملية. يمكنك إعادة المحاولة.
      </p>
      <button onClick={reset} className="btn btn-primary">
        إعادة المحاولة
      </button>
    </main>
  );
}
