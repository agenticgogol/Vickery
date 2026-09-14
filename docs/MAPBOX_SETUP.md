# Mapbox setup

The advertiser marketplace uses Mapbox when `NEXT_PUBLIC_MAPBOX_TOKEN` is available.

1. Create a public Mapbox access token at [account.mapbox.com](https://account.mapbox.com/).
2. Add it to `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
```

3. Restart the Next.js server.

If the variable is absent, the marketplace keeps working with its lightweight coordinate-based interactive preview and clearly indicates that Mapbox setup is pending.
