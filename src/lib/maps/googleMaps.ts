import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export async function loadGoogleMaps(input?: {
  apiKey?: string;
  language?: string;
  region?: string;
}) {
  if (typeof window === "undefined") return null;
  const apiKey =
    input?.apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!apiKey) return null;

  if (loaderPromise) return loaderPromise;
  const loader = new Loader({
    apiKey,
    version: "weekly",
    language: input?.language ?? "vi",
    region: input?.region ?? "VN",
  });
  loaderPromise = (async () => {
    // Loader API differs by version; use runtime capability.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyLoader = loader as any;
    if (typeof anyLoader.importLibrary === "function") {
      await anyLoader.importLibrary("places");
    } else if (typeof anyLoader.load === "function") {
      await anyLoader.load();
    } else {
      throw new Error("google_maps_loader_missing_api");
    }
    return window.google as any;
  })();
  return loaderPromise;
}

export function hasGoogleMapsKey() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

