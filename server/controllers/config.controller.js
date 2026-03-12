// GET /api/config — exposes public-facing client configuration
// The Maps JS API key is intentionally public (secured by HTTP referrer in Google Cloud).
exports.getConfig = (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
  });
};
