# Connect with DA

Premium scheduling page for David Alexander — powered by [Cal.com](https://cal.com).

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | HTML / CSS / JS (no frameworks) | Stunning, custom scheduling UI |
| API Proxy | Cloudflare Pages Functions | Keeps Cal.com API key server-side |
| Booking | Cal.com Embed | Handles form, payment, confirmations |
| Hosting | Cloudflare Pages | Global edge delivery |

## Project Structure

```
connect-with-da/
  public/            Static assets served by Cloudflare Pages
    index.html       Main page
    styles.css       Premium dark-theme styles
    app.js           Custom calendar, slots, and booking logic
  functions/
    api/
      slots.js       Cloudflare Pages Function — Cal.com slots proxy
  wrangler.toml      Cloudflare configuration
  package.json       Project metadata and scripts
```

## Setup

### Prerequisites

- Node.js 18+
- A [Cal.com](https://cal.com) API key (v2)
- A Cloudflare account (for deployment)

### Local Development

```bash
npm install

# Set your Cal.com API key for local dev
export CAL_API_KEY="your-cal-api-key"

# Start local dev server with Pages Functions
npm run dev
```

The site will be available at `http://localhost:8788`.

### Deployment to Cloudflare Pages

1. **Connect the GitHub repo** to Cloudflare Pages (or use the CLI).
2. **Set the environment variable** `CAL_API_KEY` in the Cloudflare Pages dashboard
   under Settings > Environment Variables (encrypt it as a secret).
3. **Deploy**:

```bash
npm run deploy
```

Or configure automatic deployments via the Cloudflare Pages GitHub integration.

### Build Settings (if using Cloudflare Pages dashboard)

| Setting | Value |
|---------|-------|
| Build command | _(none — static site)_ |
| Build output directory | `public` |
| Root directory | `/` |

## Cal.com Event Types

| Event | Slug | Duration Options |
|-------|------|-----------------|
| Discovery Call ($25k) | `discovery` | 60 / 120 / 180 min |
| Online Meeting (by Invitation) | `online-meeting` | 60 / 120 min |

## Design

- **Theme**: Premium dark with gold accents
- **Typography**: Inter (sans) + Playfair Display (serif)
- **Effects**: Ambient gradient orbs, smooth transitions, glass-morphism cards
- **Responsive**: Optimized for all screen sizes
- **Accessible**: Full keyboard navigation, ARIA labels, semantic HTML
