# DistractionFree — Product Requirements Document

## Overview

DistractionFree is a Chrome extension that serves as an all-in-one tool for staying focused on the web. It eliminates the most common sources of digital distraction — social media feeds, recommendation algorithms, and attention-grabbing UI elements — and replaces them with a calmer, more intentional browsing experience.

The extension ships with two core modules and one experimental module:

1. **Newsfeed Eradicator** — Blocks algorithmic feeds across major social platforms.
2. **YouTube Focus Mode** — Granular controls to hide distracting parts of YouTube.
3. **Google News Removal (Experimental)** — Strips news content from Google surfaces.

A companion website will serve as the landing page, documentation hub, and distribution point for the extension.

---

## Goals

- Help users reclaim their attention by removing the most addictive parts of the web.
- Provide a single extension that replaces multiple single-purpose blockers.
- Offer sensible defaults that work out of the box, with granular controls for power users.
- Keep the extension lightweight, privacy-respecting, and fully client-side (no data leaves the browser).

---

## Target Users

- Knowledge workers and students who lose time to social media feeds.
- YouTube users who want to watch specific content without falling into recommendation rabbit holes.
- Anyone looking to reduce passive browsing and build more intentional internet habits.

---

## Module 1: Newsfeed Eradicator

### Supported Platforms

| Platform   | Feed(s) Blocked                            |
|------------|--------------------------------------------|
| LinkedIn   | Main feed on the home page                 |
| Reddit     | Home feed and popular feed                 |
| YouTube    | Home page recommendation feed              |
| Facebook   | News Feed                                  |
| Instagram  | Main feed and Explore page                 |
| Twitter/X  | Timeline feed                              |

### Behavior

- When a user navigates to a supported platform, the extension detects the feed container in the DOM and replaces it with a **motivational quote panel**.
- The quote panel displays a randomly selected quote from a built-in library of curated quotes.
- Users can optionally add their own custom quotes.
- A small, unobtrusive DistractionFree badge is shown so the user knows the extension is active.
- Each platform can be individually toggled on or off from the extension popup.

### Quote Panel Requirements

- Clean, centered design with large readable typography.
- Displays the quote text and attribution.
- A "New Quote" button to cycle to another quote.
- Visually adapts to light/dark mode of the underlying platform where possible.

---

## Module 2: YouTube Focus Mode

YouTube is one of the largest sources of distraction on the web. Beyond blocking the home feed (covered by the Newsfeed Eradicator), YouTube Focus Mode provides granular control over individual UI elements on YouTube.

### Configurable Elements

Each element below can be independently toggled on or off:

| Element               | Description                                                        | Default |
|-----------------------|--------------------------------------------------------------------|---------|
| Home Feed             | The recommendation grid on youtube.com (also covered by Module 1)  | Hidden  |
| Related Videos        | The "Up next" sidebar and end-screen recommendations               | Hidden  |
| Comments              | The entire comments section below a video                          | Hidden  |
| Shorts Shelf          | Shorts carousels that appear in search results and the sidebar     | Hidden  |
| Trending / Explore    | The Trending and Explore pages                                     | Visible |
| Notification Bell     | The notification bell icon in the header                           | Visible |
| End Screen Cards      | Clickable overlay cards shown in the last seconds of a video       | Visible |
| Autoplay Toggle       | Force-disable autoplay for the next video                          | On      |
| Live Chat             | Live chat panel on livestreams                                     | Visible |

### Behavior

- Elements are hidden via CSS injection and, where necessary, DOM mutation observers to handle dynamically loaded content.
- When an element is hidden, the page layout should reflow naturally — no blank gaps or broken layouts.
- Settings are accessible from the extension popup under a dedicated "YouTube" section.

---

## Module 3: Google News Removal (Experimental)

### Scope

This module is experimental and may require iterative development as Google frequently changes its UI.

### Target Surfaces

| Surface                    | Description                                                      |
|----------------------------|------------------------------------------------------------------|
| Google Search Results      | "Top stories" carousel, "News" tab results inlined in main results |
| Google Discover            | News feed on the Google mobile new-tab page (if applicable to Chrome desktop) |
| Google News (news.google.com) | Full redirect or replacement with a quote panel                |

### Behavior

- On Google Search: hide the "Top stories" / "News" cards that appear in the main search results page.
- On Google News: replace the entire page content with the DistractionFree quote panel.
- Clearly labeled as **Experimental** in the UI with a note that behavior may break if Google changes its layout.

---

## Extension Popup UI

The popup is the primary interface for configuring DistractionFree.

### Structure

```
┌──────────────────────────────┐
│  DistractionFree             │
│  ─────────────────────────── │
│                              │
│  ● Newsfeed Eradicator       │
│    ☑ LinkedIn                │
│    ☑ Reddit                  │
│    ☑ YouTube                 │
│    ☑ Facebook                │
│    ☑ Instagram               │
│    ☑ Twitter/X               │
│                              │
│  ● YouTube Focus Mode        │
│    ☑ Hide Related Videos     │
│    ☑ Hide Comments           │
│    ☑ Hide Shorts             │
│    ☐ Hide Trending           │
│    ☐ Hide Notifications      │
│    ☐ Hide End Cards          │
│    ☑ Disable Autoplay        │
│    ☐ Hide Live Chat          │
│                              │
│  ● Google News Removal  ⚗️   │
│    ☑ Search Results          │
│    ☑ Google News site        │
│                              │
│  ─────────────────────────── │
│  ⚙ Settings                  │
└──────────────────────────────┘
```

### Settings Page

- **Custom Quotes**: Add, edit, or remove custom quotes.
- **Quote Source**: Toggle between built-in quotes only, custom quotes only, or both.
- **Theme**: Auto (match system), Light, Dark.
- **Allowlist**: Temporarily disable DistractionFree on specific URLs or for a set duration (e.g., "Pause for 15 minutes").

---

## Companion Website

### Purpose

The website serves as the public-facing home for DistractionFree — a landing page, documentation site, and download funnel for the Chrome extension.

### Pages

| Page         | Content                                                                                   |
|--------------|-------------------------------------------------------------------------------------------|
| Home         | Hero section, value proposition, feature highlights, CTA to Chrome Web Store              |
| Features     | Detailed breakdown of each module with screenshots/GIFs                                   |
| FAQ          | Common questions (privacy, permissions, platform support, etc.)                           |
| Privacy      | Privacy policy — emphasize that no data is collected or transmitted                       |
| Changelog    | Version history and release notes                                                         |

### Technical Considerations

- Static site (e.g., Next.js static export, Astro, or plain HTML/CSS/JS).
- Hosted on a platform like Vercel or GitHub Pages.
- Minimal dependencies, fast load times, accessible.

---

## Technical Architecture (Extension)

### Manifest

- **Manifest Version**: V3 (required for current Chrome Web Store submissions).
- **Permissions**: `activeTab`, `storage`, `scripting`.
- **Host Permissions**: Scoped to supported platforms only (linkedin.com, reddit.com, youtube.com, facebook.com, instagram.com, x.com, google.com).

### Components

| Component              | Role                                                                 |
|------------------------|----------------------------------------------------------------------|
| Background Service Worker | Manages extension lifecycle, listens for tab navigation events    |
| Content Scripts        | Injected per-site; handle DOM manipulation, feed replacement, element hiding |
| Popup (UI)             | Settings interface rendered in the extension popup                   |
| Storage (chrome.storage.sync) | Persists user preferences across devices                      |

### Content Script Strategy

- Each supported platform gets its own content script module with platform-specific selectors.
- A shared utility layer provides common functions: DOM observation (MutationObserver), quote rendering, preference reading.
- Selectors should be maintained in a centralized config to simplify updates when platforms change their markup.

---

## Non-Functional Requirements

| Requirement      | Detail                                                                                    |
|------------------|-------------------------------------------------------------------------------------------|
| Performance      | Extension must not degrade page load time by more than 50ms on any supported site         |
| Privacy          | Zero data collection. No analytics, no tracking, no network requests beyond Chrome APIs   |
| Size             | Total extension package under 500KB                                                       |
| Compatibility    | Chrome 120+ (Manifest V3 baseline)                                                       |
| Accessibility    | Quote panel and popup UI must meet WCAG 2.1 AA                                           |
| Update Resilience| Selector-based hiding should be designed for easy updates when platforms change their DOM  |

---

## Success Metrics

- **Install base**: Track via Chrome Web Store dashboard.
- **Rating**: Maintain 4.5+ star average.
- **Uninstall rate**: Keep below 20% within 7 days of install.
- **Selector breakage**: Time-to-fix when a platform changes its DOM and a feature stops working — target under 48 hours.

---

## Future Considerations (Out of Scope for V1)

- Firefox and Edge support.
- Scheduled focus sessions (e.g., "Block feeds from 9am–5pm on weekdays").
- Usage statistics dashboard (local-only) showing time saved.
- Integration with website blockers for a complete focus toolkit.
- Mobile companion app or integration with mobile browsers that support extensions.

---

## Open Questions

1. Should the quote panel include a "Go to [Platform] anyway" bypass link, or should feeds be fully blocked with no override from the quote panel?
2. For YouTube Focus Mode, should the extension also offer a "Distraction-Free Player" mode that shows only the video player at full width with no surrounding UI?
3. What is the right default behavior for the experimental Google News module — opt-in or opt-out?
