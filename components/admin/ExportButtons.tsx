"use client";

import { UI } from "@/lib/i18n";

type ExportType = "sessions" | "listings";

const EXPORTS: Array<{ type: ExportType; label: string }> = [
  { type: "sessions", label: "الجلسات" },
  { type: "listings", label: "الأجهزة" },
];

// Client component: triggers a CSV download per table via the export API.
export function ExportButtons() {
  function handleExport(type: ExportType) {
    window.location.href = `/api/admin/export?type=${type}`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EXPORTS.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => handleExport(type)}
        >
          {UI.exportCsv}: {label}
        </button>
      ))}
    </div>
  );
}
