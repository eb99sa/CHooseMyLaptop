"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UI } from "@/lib/i18n";
import { formatArea } from "@/lib/geo";
import type { LocationInfo } from "@/lib/types";

// Small, non-intrusive location picker for Page 1. Anonymous: the browser
// never talks to Mapbox directly — it proxies through /api/geocode. Exact
// coordinates are used only transiently for a reverse-geocode lookup and are
// never persisted.

interface LocationPickerProps {
  value: LocationInfo;
  onChange: (loc: LocationInfo) => void;
}

// One forward-search suggestion from /api/geocode?q=...
interface GeocodeResult {
  id: string;
  label: string;
  city_or_area: string;
  country: string;
  country_code: string;
  currency: string;
  lat: number;
  lng: number;
}

// Internal mode of the picker.
type Mode = "default" | "locating" | "search" | "set";

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  // When the parent already has a resolved (non-skipped, non-empty) area we
  // start in the "set" view; otherwise the default chooser.
  const hasArea = value.city_or_area.trim().length > 0;
  const [mode, setMode] = useState<Mode>(hasArea ? "set" : "default");

  // Manual-search state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  // When Mapbox is not configured the geocode endpoint returns disabled:true.
  // We then degrade to a plain text input (no dropdown / autocomplete).
  const [autocompleteDisabled, setAutocompleteDisabled] = useState(false);

  // Error / info message shown under the buttons (geolocation failures etc.).
  const [message, setMessage] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the view in sync if the parent resets the value to an area.
  useEffect(() => {
    if (value.city_or_area.trim().length > 0) {
      setMode((m) => (m === "search" || m === "locating" ? m : "set"));
    }
  }, [value.city_or_area]);

  // --- Geolocation -------------------------------------------------------
  const handleUseMyLocation = useCallback(() => {
    setMessage(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMessage(UI.locationUnavailable);
      setMode("search");
      return;
    }

    setMode("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `/api/geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
          );
          const data: {
            result?: GeocodeResult | null;
            disabled?: boolean;
          } = await res.json();

          if (data.disabled) {
            setAutocompleteDisabled(true);
            setMessage(UI.locationUnavailable);
            setMode("search");
            return;
          }

          if (data.result) {
            onChange({
              country: data.result.country,
              city_or_area: data.result.city_or_area,
              currency: data.result.currency || value.currency,
              source: "browser_geolocation",
            });
            setMode("set");
          } else {
            setMessage(UI.locationUnavailable);
            setMode("search");
          }
        } catch {
          setMessage(UI.locationUnavailable);
          setMode("search");
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setMessage(UI.locationDenied);
        } else if (err.code === err.TIMEOUT) {
          setMessage(UI.locationTimeout);
        } else {
          setMessage(UI.locationUnavailable);
        }
        // Reveal the manual search so the user can still continue.
        setMode("search");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, [onChange, value.currency]);

  // --- Manual search (debounced) -----------------------------------------
  const runSearch = useCallback(async (text: string) => {
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`, {
        signal: controller.signal,
      });
      const data: { results?: GeocodeResult[]; disabled?: boolean } = await res.json();
      if (data.disabled) {
        setAutocompleteDisabled(true);
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
    } catch {
      // Ignore aborts and transient failures; the dropdown just stays empty.
    } finally {
      setSearching(false);
    }
  }, []);

  function onQueryChange(text: string) {
    setQuery(text);
    if (autocompleteDisabled) return; // plain text input, no dropdown
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 300);
  }

  function selectResult(r: GeocodeResult) {
    onChange({
      country: r.country,
      city_or_area: r.city_or_area,
      currency: r.currency || value.currency,
      source: "manual_search",
    });
    setQuery("");
    setResults([]);
    setMode("set");
  }

  // Plain-text confirm when autocomplete is disabled.
  function confirmPlainText() {
    const text = query.trim();
    if (!text) return;
    onChange({
      country: "",
      city_or_area: text,
      currency: value.currency,
      source: "manual_search",
    });
    setQuery("");
    setMode("set");
  }

  function handleSkip() {
    onChange({
      country: "",
      city_or_area: "",
      currency: value.currency,
      source: "skipped",
    });
    setResults([]);
    setQuery("");
    setMessage(null);
    setMode("set");
  }

  function reopen() {
    setMessage(null);
    setMode("default");
  }

  // Clean up timers/aborts on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // --- Render ------------------------------------------------------------
  // "set" view: location resolved or explicitly skipped.
  if (mode === "set") {
    const skipped = value.source === "skipped";
    const areaLabel = formatArea(value.city_or_area, value.country);
    return (
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-bold text-[var(--color-ink)]">{UI.locationTitle}</p>
            {skipped || !areaLabel ? (
              <p className="text-sm text-[var(--color-muted)]">{UI.skipLocation}</p>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-ink)]">{UI.detectedArea}:</span>{" "}
                {areaLabel}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" onClick={reopen}>
            {UI.changeLocation}
          </Button>
        </div>
      </Card>
    );
  }

  // "locating" view: waiting for geolocation.
  if (mode === "locating") {
    return (
      <Card className="space-y-3">
        <p className="text-sm font-bold text-[var(--color-ink)]">{UI.locationTitle}</p>
        <div className="flex items-center gap-3">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-brand-600)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--color-muted)]">{UI.locating}</p>
        </div>
      </Card>
    );
  }

  // "search" view: manual area search (autocomplete or plain text).
  if (mode === "search") {
    return (
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--color-ink)]">{UI.locationTitle}</p>
        </div>
        {message && <p className="text-xs text-[var(--color-muted)] leading-relaxed">{message}</p>}

        {autocompleteDisabled ? (
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder={UI.searchCityArea}
              aria-label={UI.searchCityArea}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPlainText();
                }
              }}
            />
            <Button type="button" variant="primary" onClick={confirmPlainText}>
              {UI.changeLocation}
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              className="input"
              placeholder={UI.searchCityArea}
              aria-label={UI.searchCityArea}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              autoComplete="off"
            />
            {(results.length > 0 || searching) && query.trim().length >= 2 && (
              <ul
                className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-lg"
                role="listbox"
              >
                {searching && results.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--color-muted)]">{UI.locating}</li>
                ) : (
                  results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => selectResult(r)}
                        className="block w-full px-3 py-2 text-start text-sm text-[var(--color-ink)] hover:bg-[var(--color-brand-50)]"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            {UI.continueWithoutLocation}
          </Button>
        </div>
      </Card>
    );
  }

  // "default" view: the three primary choices.
  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-bold text-[var(--color-ink)]">{UI.locationTitle}</p>
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">{UI.locationHelp}</p>
      </div>
      {message && <p className="text-xs text-[var(--color-muted)] leading-relaxed">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" onClick={handleUseMyLocation}>
          {UI.useMyLocation}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMessage(null);
            setMode("search");
          }}
        >
          {UI.chooseAnotherArea}
        </Button>
        <Button type="button" variant="ghost" onClick={handleSkip}>
          {UI.skipLocation}
        </Button>
      </div>
    </Card>
  );
}
