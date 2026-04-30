"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { loadGoogleMaps } from "@/lib/maps/googleMaps";

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  onPlaceSelected?: (place: {
    placeId: string;
    label: string;
    latLng: { lat: number; lng: number } | null;
  }) => void;
  placeholder?: string;
};

export function PlaceAutocompleteInput({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder,
}: Props) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  const acRef = React.useRef<google.maps.places.Autocomplete | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const g = await loadGoogleMaps();
      if (cancelled) return;
      if (!g) return;
      if (!ref.current) return;
      if (acRef.current) return;
      const ac = new g.maps.places.Autocomplete(ref.current, {
        fields: ["place_id", "formatted_address", "name", "geometry"],
        types: ["geocode"],
      });
      acRef.current = ac;
      ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        const label = String(p.formatted_address || p.name || "").trim();
        const placeId = String(p.place_id || "").trim();
        const loc = p.geometry?.location ?? null;
        const latLng = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
        if (label) onChangeText(label);
        if (onPlaceSelected && placeId && label) {
          onPlaceSelected({ placeId, label, latLng });
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [onChangeText, onPlaceSelected]);

  return (
    <Input
      ref={ref}
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}

