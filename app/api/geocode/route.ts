import { NextResponse } from "next/server";
import { currencyForCountryCode } from "@/lib/geo";

export const runtime = "nodejs";

// Server-side Mapbox geocoding proxy so the token is never exposed to the
// browser. Two modes:
//   GET /api/geocode?q=...        -> forward search (autocomplete suggestions)
//   GET /api/geocode?lat=&lng=    -> reverse geocode (area from coordinates)
// If MAPBOX_TOKEN is unset, returns { disabled: true } so the client falls back
// to a plain manual text field.

interface MapboxContext {
  id?: string;
  text?: string;
  short_code?: string;
}
interface MapboxFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  properties?: { short_code?: string };
  context?: MapboxContext[];
}

function parseFeature(f: MapboxFeature) {
  let country = "";
  let countryCode = "";
  for (const c of f.context ?? []) {
    if (typeof c.id === "string" && c.id.startsWith("country")) {
      country = c.text ?? "";
      countryCode = c.short_code ?? "";
    }
  }
  if (Array.isArray(f.place_type) && f.place_type.includes("country")) {
    country = f.text ?? country;
    countryCode = f.properties?.short_code ?? countryCode;
  }
  const center = f.center ?? [0, 0];
  return {
    id: f.id ?? f.place_name ?? "",
    label: f.place_name ?? f.text ?? "",
    city_or_area: f.text ?? "",
    country,
    country_code: countryCode,
    currency: currencyForCountryCode(countryCode),
    lng: center[0],
    lat: center[1],
  };
}

export async function GET(req: Request) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ disabled: true, results: [] });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const base = "https://api.mapbox.com/geocoding/v5/mapbox.places";

  try {
    if (lat && lng) {
      const url = `${base}/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${token}&language=ar&types=place,locality,region,district&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`mapbox ${res.status}`);
      const data = (await res.json()) as { features?: MapboxFeature[] };
      const feat = data.features?.[0];
      return NextResponse.json({ result: feat ? parseFeature(feat) : null });
    }

    if (q && q.trim().length >= 2) {
      const url = `${base}/${encodeURIComponent(q.trim())}.json?access_token=${token}&autocomplete=true&language=ar&types=place,locality,region,district,neighborhood&limit=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`mapbox ${res.status}`);
      const data = (await res.json()) as { features?: MapboxFeature[] };
      return NextResponse.json({ results: (data.features ?? []).map(parseFeature) });
    }

    return NextResponse.json({ results: [] });
  } catch (err) {
    return NextResponse.json(
      { error: "geocode_failed", message: (err as Error).message, results: [] },
      { status: 502 },
    );
  }
}
