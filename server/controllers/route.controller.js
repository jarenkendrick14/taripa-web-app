// ─── route.controller.js ──────────────────────────────────────────
// GET /api/route?origin_lat=&origin_lng=&dest_lat=&dest_lng=
// Tries Google Maps Directions API first; falls back to OSRM.
// Returns a unified response so the frontend doesn't care which source won.

/**
 * Decodes a Google Maps encoded polyline into [[lat, lng], ...] pairs.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

exports.getRoute = async (req, res, next) => {
  try {
    const { origin_lat, origin_lng, dest_lat, dest_lng } = req.query;
    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      return res.status(400).json({ error: 'origin_lat, origin_lng, dest_lat, dest_lng are required.' });
    }

    const oLat = parseFloat(origin_lat);
    const oLng = parseFloat(origin_lng);
    const dLat = parseFloat(dest_lat);
    const dLng = parseFloat(dest_lng);

    // ── 1. Try Google Maps Directions API ──────────────────────────
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleKey) {
      try {
        const url =
          `https://maps.googleapis.com/maps/api/directions/json` +
          `?origin=${oLat},${oLng}&destination=${dLat},${dLng}` +
          `&mode=driving&key=${googleKey}`;
        const r    = await fetch(url);
        const data = await r.json();

        if (data.status === 'OK' && data.routes?.length) {
          const route = data.routes[0];
          const leg   = route.legs[0];
          return res.json({
            source:         'google',
            distance_m:     leg.distance.value,
            duration_s:     leg.duration.value,
            polyline:       decodePolyline(route.overview_polyline.points),
            origin_snapped: [leg.start_location.lat, leg.start_location.lng],
            dest_snapped:   [leg.end_location.lat,   leg.end_location.lng],
          });
        }
        // Non-OK status (ZERO_RESULTS, REQUEST_DENIED, etc.) → fall through
      } catch {
        // Network error or parse failure → fall through to OSRM
      }
    }

    // ── 2. Fall back to OSRM ───────────────────────────────────────
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${oLng},${oLat};${dLng},${dLat}` +
      `?overview=full&geometries=geojson`;

    const r    = await fetch(osrmUrl);
    const data = await r.json();
    const route = data.routes?.[0];
    if (!route) return res.status(502).json({ error: 'Routing service unavailable.' });

    const wp = data.waypoints;
    return res.json({
      source:         'osrm',
      distance_m:     route.distance,
      duration_s:     route.duration,
      // GeoJSON is [lng, lat] — swap to [lat, lng]
      polyline:       route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      origin_snapped: wp?.[0] ? [wp[0].location[1], wp[0].location[0]] : null,
      dest_snapped:   wp?.[1] ? [wp[1].location[1], wp[1].location[0]] : null,
    });
  } catch (err) { next(err); }
};
