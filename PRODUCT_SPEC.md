# DistractionFree — LinkedIn Product Specification

**Version:** 2.0 (Proposed)
**Status:** Draft
**Date:** 2026-03-05
**Author:** PM

---

## Table of Contents

1. [Overview](#overview)
2. [Current Implementation (v1.0)](#current-implementation-v10)
3. [Architecture Reference](#architecture-reference)
4. [Problem Statement](#problem-statement)
5. [Proposed Features — Prioritized by Category](#proposed-features--prioritized-by-category)
   - [Category A: Feed & Content](#category-a-feed--content-priority-1--2)
   - [Category B: Right Sidebar](#category-b-right-sidebar-priority-1--2)
   - [Category C: Upsell & Monetization Nags](#category-c-upsell--monetization-nags-priority-2--3)
   - [Category D: Notification & Messaging Badges](#category-d-notification--messaging-badges-priority-2)
   - [Category E: Profile Page Clutter](#category-e-profile-page-clutter-priority-3)
   - [Category F: Social Validation Metrics](#category-f-social-validation-metrics-priority-3)
6. [Toggle Reference Table](#toggle-reference-table)
7. [Default State Rationale](#default-state-rationale)
8. [Technical Notes — Frontend (Popup UI)](#technical-notes--frontend-popup-ui)
9. [Technical Notes — Backend (Content Script)](#technical-notes--backend-content-script)
10. [Storage Schema](#storage-schema)
11. [Out of Scope](#out-of-scope)

---

## Overview

DistractionFree is a Chrome extension focused on making LinkedIn a productive tool rather than a social media time-sink. Version 1.0 shipped a single toggle that hides the home feed and replaces it with a motivational quote. This spec defines the full v2.0 feature set: 16 new granular toggles organized into 6 categories covering every major distraction vector on LinkedIn.

---

## Current Implementation (v1.0)

### Feature: Hide Feed

| Property         | Value                                                                 |
|------------------|-----------------------------------------------------------------------|
| Toggle Name      | Hide Feed                                                             |
| Storage Key      | `linkedin.feedEnabled`                                                |
| Default State    | ON (feed is hidden)                                                   |
| What It Does     | Hides all home feed posts and replaces them with a motivational quote |
| CSS Classes      | `.feed-shared-update-v2`, `div[data-id^="urn:li:activity:"]`, `.feed-sort-toggle`, `.feed-follows-module` |
| Class Toggle     | `df-linkedin-disabled` on `<html>` (present = feed visible)          |

### Architecture (v1.0)

- **`content/linkedin.js`** — Content script. Reads settings via `DistractionFree.getSettings()`, applies a CSS class to `<html>`, injects the quote, re-applies on SPA navigation and DOM mutations.
- **`content/linkedin.css`** — All hide rules. Uses `html:not(.df-linkedin-disabled) .selector { display: none !important }` pattern (inverted: default hidden, class re-enables).
- **`content/shared.js`** — Shared utilities: `toggleFeature()`, `getSettings()`, `onSettingsChanged()`, `observeDOM()`, `detectSPANavigation()`, `createQuoteElement()`.
- **`popup/popup.html`** — Renders toggle rows. Each `<div class="toggle-row">` carries `data-site` and `data-key` attributes that `popup.js` uses to read/write settings automatically.
- **`popup/popup.js`** — Generic: iterates all `.toggle-row` elements and binds `chrome.storage.sync` reads/writes by `data-site` + `data-key`.
- **`background/service-worker.js`** — Sets default settings on install.
- **Storage** — `chrome.storage.sync`, key `"settings"`, object shape `{ linkedin: { feedEnabled: true } }`.

---

## Architecture Reference

The CSS toggle pattern used throughout v1.0 (and to be extended in v2.0):

```
/* Default state: element is hidden */
.linkedin-selector { display: none !important; }

/* When toggle is OFF, <html> gets the disabled class, which un-hides */
html.df-{featureName}-disabled .linkedin-selector { display: revert !important; }
```

`DistractionFree.toggleFeature(className, enabled)` adds/removes the class on `<html>`. When `enabled = true`, the class is removed (hide is active). When `enabled = false`, the class is added (hide is inactive, element visible).

Each new toggle follows this exact same pattern. The `data-key` on the popup toggle row maps directly to the storage key. `popup.js` is already generic — it requires zero changes to support new toggles.

---

## Problem Statement

LinkedIn has evolved from a professional networking tool into a full social media platform with aggressive engagement mechanics. The specific distraction vectors are:

1. **Infinite feed** — Already addressed in v1.0, but sponsored and suggested posts still bleed through.
2. **Right sidebar** — Up to 5 distinct widget modules compete for attention on every page load.
3. **Upsell nags** — Premium upgrade prompts, AI upsell banners, and "who viewed your profile" teasers create anxiety and FOMO.
4. **Badge anxiety** — Notification and message count badges trigger dopamine-driven checking behavior.
5. **Profile page noise** — "Open to Work" banners, "People Also Viewed" carousels, and Learning recommendations distract from what the user came to do.
6. **Vanity metrics** — "You appeared in X searches this week" and connection count displays encourage compulsive checking.

---

## Proposed Features — Prioritized by Category

Priority tiers:
- **P1** — High user value, technically straightforward, ships in v2.0
- **P2** — High value, moderate complexity (dynamic injection), ships in v2.0
- **P3** — Moderate value or page-specific, ships in v2.1

---

### Category A: Feed & Content (Priority 1 & 2)

These toggles operate on the home feed (`linkedin.com/feed/`) and refine the existing feed-hiding behavior.

---

#### A1. Hide Sponsored / Promoted Posts

**Priority:** P1

**Problem:** Even with the main feed hidden, sponsored posts can render before the hide CSS is applied (FOUC). More importantly, users who keep the feed visible still want to suppress ads.

**What it hides:**
- In-feed "Promoted" posts identified by the label text or the `data-control-name` attribute on the post action bar.
- The post card container rendered as `div[data-id^="urn:li:activity:"]` that contains a "Promoted" span child.
- Legacy class `.linkedin-sponsor` for older render paths.

**Implementation note:** CSS-only selectors cannot reliably target "Promoted" text content. The content script must use a MutationObserver (already in place via `DistractionFree.observeDOM()`) to scan for `<span>` elements whose text is "Promoted" and walk up the DOM tree ~5 levels to the card container, then add a `df-hide` attribute that CSS targets. This is the approach used by the open-source `mottosso` LinkedIn ad-blocker gist.

| Property       | Value                          |
|----------------|--------------------------------|
| Toggle Name    | Hide Sponsored Posts           |
| Storage Key    | `linkedin.hideSponsored`       |
| Default State  | ON                             |
| CSS Class      | `df-linkedin-hide-sponsored`   |

---

#### A2. Hide "Suggested" / Algorithmic Posts

**Priority:** P1

**Problem:** LinkedIn injects "Suggested for you" posts into the feed that are effectively organic ads — posts from people the user does not follow. These are distinct from the actual followed-connection feed.

**What it hides:**
- Posts with a "Suggested" label (same DOM-scanning approach as A1 — scan for span text "Suggested").
- Any `feed-shared-update-v2` card whose actor line includes "Suggested" or "Follows" sub-label rather than a direct connection.

| Property       | Value                           |
|----------------|---------------------------------|
| Toggle Name    | Hide Suggested Posts            |
| Storage Key    | `linkedin.hideSuggested`        |
| Default State  | ON                              |
| CSS Class      | `df-linkedin-hide-suggested`    |

---

#### A3. Hide "Add to your feed" Widget (Follow Suggestions in Feed)

**Priority:** P1

**Problem:** A widget embedded directly in the feed scroll area prompts users to follow new pages and people, derailing focus.

**What it hides:**
- `.feed-follows-module` — the "Add to your feed" follow-suggestion card already partially covered by v1.0's feed CSS, but needs its own toggle so users with the feed ON can still suppress it.
- `.feed-follows-module--v2` (variant class name observed in some render paths).

| Property       | Value                               |
|----------------|-------------------------------------|
| Toggle Name    | Hide "Add to Your Feed" Widget      |
| Storage Key    | `linkedin.hideFollowSuggestions`    |
| Default State  | ON                                  |
| CSS Class      | `df-linkedin-hide-follow-widget`    |

---

#### A4. Hide Trending News in Feed (Shared News Module)

**Priority:** P2

**Problem:** LinkedIn injects "trending on LinkedIn" news cards directly into the feed scroll. These are optimized for clicks, not for the user's professional goals.

**What it hides:**
- `.feed-shared-news-module` — the trending/shared news card that appears inline in the feed.
- `.feed-shared-navigation-module`, `.feed-shared-navigation-module--v2` — the "Discover more" recommendation block.

| Property       | Value                            |
|----------------|----------------------------------|
| Toggle Name    | Hide Trending News Cards         |
| Storage Key    | `linkedin.hideTrendingNews`      |
| Default State  | ON                               |
| CSS Class      | `df-linkedin-hide-trending-news` |

---

### Category B: Right Sidebar (Priority 1 & 2)

The right sidebar on `linkedin.com/feed/` contains 4–6 distinct modules. Each should be independently toggleable because some users want job recommendations but not PYMK, etc.

---

#### B1. Hide "People You May Know" (PYMK) Sidebar Widget

**Priority:** P1

**Problem:** The PYMK module is the most prominent sidebar widget on the home feed. It promotes endless connection-adding behavior and produces anxiety about who LinkedIn thinks you should know.

**What it hides:**
- The sidebar card containing "People You May Know" or "Grow your network" heading.
- Legacy selector: `#pymk-container`, `.linkedin-recommend-pymk`.
- Modern selector: `aside` section cards whose heading text matches "People you may know" or "Grow your network" (requires JS DOM text scan + `data-df-hide` attribute CSS hook, since LinkedIn's class names on this module change frequently with their Ember/React re-renders).

| Property       | Value                          |
|----------------|--------------------------------|
| Toggle Name    | Hide People You May Know       |
| Storage Key    | `linkedin.hidePYMK`            |
| Default State  | ON                             |
| CSS Class      | `df-linkedin-hide-pymk`        |

---

#### B2. Hide "LinkedIn News" / Trending Topics Sidebar

**Priority:** P1

**Problem:** The "LinkedIn News" widget in the right sidebar lists trending topics curated to maximize engagement clicks, not professional productivity.

**What it hides:**
- `.feed-shared-news-module` when rendered in the sidebar context.
- The aside card with heading "LinkedIn News" or "Today's news and views".
- `.news-module` (legacy class from the AdBlock filter gist).

| Property       | Value                             |
|----------------|-----------------------------------|
| Toggle Name    | Hide LinkedIn News Sidebar        |
| Storage Key    | `linkedin.hideNewsSidebar`        |
| Default State  | ON                                |
| CSS Class      | `df-linkedin-hide-news-sidebar`   |

---

#### B3. Hide Job Recommendations Sidebar Widget

**Priority:** P2

**Problem:** The "Jobs you may be interested in" sidebar widget creates "grass is greener" distraction for users who are not actively job-hunting.

**What it hides:**
- Sidebar card with heading "Jobs you may be interested in" or "Recommended jobs for you".
- Legacy selector: `#jobsForYou`, `.jymbii-update`.
- `.jobs-home-module` when rendered in sidebar context.

| Property       | Value                           |
|-----------------|--------------------------------|
| Toggle Name    | Hide Job Recommendations        |
| Storage Key    | `linkedin.hideJobRecommendations` |
| Default State  | OFF (users may want this)       |
| CSS Class      | `df-linkedin-hide-job-recs`     |

---

#### B4. Hide LinkedIn Learning Recommendations Sidebar

**Priority:** P2

**Problem:** The "Learning for you" sidebar widget surfaces LinkedIn Learning course recommendations. While educational, it drives users away from their current task.

**What it hides:**
- Sidebar card with heading "Learning for you" or "Suggested courses".
- Legacy selectors: `#course-recommendations`, `.lyndaCourse-singleton`.
- Any aside card referencing `learning.linkedin.com` links.

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Learning Recommendations      |
| Storage Key    | `linkedin.hideLearningRecs`        |
| Default State  | OFF                                |
| CSS Class      | `df-linkedin-hide-learning-recs`   |

---

#### B5. Hide "Followed Hashtags" / "Groups" Sidebar Widgets

**Priority:** P2

**Problem:** Hashtag activity and group update widgets in the sidebar are low-value engagement traps that pull users into tangential browsing.

**What it hides:**
- Sidebar cards with headings "Groups" or "Followed Hashtags" or "Pages".
- `#groupsForYou`, `#companiesForYou` (legacy selectors from the AdBlock filter gist).
- `#recent-activities-widget` (recently visited).

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Groups & Hashtag Widgets      |
| Storage Key    | `linkedin.hideGroupsWidget`        |
| Default State  | OFF                                |
| CSS Class      | `df-linkedin-hide-groups-widget`   |

---

### Category C: Upsell & Monetization Nags (Priority 2 & 3)

---

#### C1. Hide LinkedIn Premium Upsell Banners

**Priority:** P2

**Problem:** LinkedIn surfaces "Try Premium for free" banners persistently across the feed, sidebar, and profile pages. These interrupt focus and create financial anxiety for users who cannot or do not want to upgrade.

**What it hides:**
- Navigation bar "Try Premium" link: `.nav-item__try-premium`.
- Upsell links: `.premium-upsell-link`, `.upsell`.
- In-feed Premium upsell cards and "Unlock your full potential" banners.
- Sidebar Premium promotion cards (identified by heading text "Unlock Premium features" or "Get hired faster").
- Profile page Premium upgrade prompt section.
- The gold "Premium" icon/badge next to other users' names in feed posts and connection lists (the `<svg>` with the LinkedIn gold star, identified by its aria-label "LinkedIn Premium icon").

**Implementation note:** Premium upsell elements render across many page contexts. The JS observer must run globally (not just on `/feed/`) and re-scan on every SPA navigation. The Premium icon on other users' names should be a separate sub-toggle (C1b) since some users want to see it.

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Premium Upsell Banners        |
| Storage Key    | `linkedin.hidePremiumUpsell`       |
| Default State  | ON                                 |
| CSS Class      | `df-linkedin-hide-premium-upsell`  |

---

#### C2. Hide "Who Viewed Your Profile" Teaser

**Priority:** P2

**Problem:** LinkedIn shows a blurred/partial list of profile viewers with a "Upgrade to see all X viewers" prompt. The teaser is designed to create FOMO and drive Premium conversions. Even non-Premium users see a "X people viewed your profile" stat, which prompts compulsive checking.

**What it hides:**
- The "Who's viewed your profile" widget/card on the home feed left rail and profile sidebar.
- The "X people viewed your profile" stat in the feed left sidebar panel (`.profile-rail-card__member-nav-item`).
- Profile view count in the left sidebar: the card that links to `linkedin.com/me/profile-views/`.

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Profile View Teaser           |
| Storage Key    | `linkedin.hideProfileViewTeaser`   |
| Default State  | ON                                 |
| CSS Class      | `df-linkedin-hide-profile-views`   |

---

#### C3. Hide "You Appeared in X Searches" Vanity Metric

**Priority:** P3

**Problem:** LinkedIn shows "You appeared in X searches this week" in the left rail sidebar. This metric serves no actionable purpose and encourages compulsive session-starting to check the number.

**What it hides:**
- The left rail sidebar card that shows search appearance count.
- Links to `linkedin.com/me/search-appearances/`.

| Property       | Value                                 |
|----------------|---------------------------------------|
| Toggle Name    | Hide Search Appearance Count          |
| Storage Key    | `linkedin.hideSearchAppearances`      |
| Default State  | ON                                    |
| CSS Class      | `df-linkedin-hide-search-appearances` |

---

#### C4. Hide LinkedIn AI Feature Upsell (Collaborative Articles / AI Suggestions)

**Priority:** P3

**Problem:** LinkedIn injects AI-generated "Collaborative Article" prompts and AI writing assistant banners into the feed and compose flows. These are designed to increase content generation and Premium conversions, not to serve the user's current task.

**What it hides:**
- Collaborative Articles prompt cards in the feed.
- "Write with AI" banners on the post compose interface.
- "AI-powered suggestions" widgets.
- Identified primarily by text content scanning ("Collaborative article", "Write with AI") since LinkedIn's class names for these features rotate frequently.

| Property       | Value                           |
|----------------|---------------------------------|
| Toggle Name    | Hide AI Feature Upsells         |
| Storage Key    | `linkedin.hideAIUpsell`         |
| Default State  | ON                              |
| CSS Class      | `df-linkedin-hide-ai-upsell`    |

---

### Category D: Notification & Messaging Badges (Priority 2)

---

#### D1. Hide Notification Bell Badge Count

**Priority:** P2

**Problem:** The red/orange number badge on the notification bell in the global navigation bar is a Pavlovian trigger — it is designed to interrupt whatever the user is doing and redirect attention to LinkedIn's engagement feed. Hiding the count (not the bell itself) removes the urgency signal while preserving the ability to check notifications intentionally.

**What it hides:**
- The numeric badge on the notifications nav icon.
- Selector: the `<span>` with `aria-label` matching "X new notifications" inside the notifications nav item. Also targets `.notification-badge`, `.artdeco-notification-badge` (design system class used across nav icons).
- Does NOT hide the bell icon itself — users can still navigate to notifications intentionally.

| Property       | Value                               |
|----------------|-------------------------------------|
| Toggle Name    | Hide Notification Badge             |
| Storage Key    | `linkedin.hideNotificationBadge`    |
| Default State  | ON                                  |
| CSS Class      | `df-linkedin-hide-notif-badge`      |

---

#### D2. Hide Messaging Badge Count

**Priority:** P2

**Problem:** The unread message count badge on the messaging icon creates the same compulsive checking loop as the notification badge, but for DMs. Users should be able to respond to messages at a time of their choosing, not be summoned by the badge.

**What it hides:**
- The numeric badge on the messaging (chat bubble) nav icon.
- The `.msg-overlay-bubble-header__badge` count on any open messaging overlays.
- The "Active" green dot indicators on messaging lists (these signal who is online and add social pressure).

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Messaging Badge               |
| Storage Key    | `linkedin.hideMessagingBadge`      |
| Default State  | OFF (messages are important)       |
| CSS Class      | `df-linkedin-hide-msg-badge`       |

---

### Category E: Profile Page Clutter (Priority 3)

These toggles apply specifically to profile pages (`linkedin.com/in/*`).

---

#### E1. Hide "Open to Work" / "Hiring" Banners on Profiles

**Priority:** P3

**Problem:** When browsing profiles, the "Open to Work" green frame and "Hiring" blue banner overlaid on profile photos are visual noise for users who are not recruiters or job-seekers. They distract from reading the person's actual professional content.

**What it hides:**
- The green "#OPENTOWORK" ring overlay on profile photo thumbnails.
- The "Open to Work" card/banner that appears below the profile header.
- The "I'm hiring" blue badge overlay on profile photos.
- Identified by: `.open-to-work-badge`, `[data-test-id="open-to-work-signal"]`, and the `<img>` overlay `<span>` with aria-label containing "Open to work".

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Open to Work / Hiring Banners |
| Storage Key    | `linkedin.hideOTWBanners`          |
| Default State  | OFF (contextually useful)          |
| CSS Class      | `df-linkedin-hide-otw-banners`     |

---

#### E2. Hide "People Also Viewed" Sidebar on Profiles

**Priority:** P3

**Problem:** The "People Also Viewed" sidebar on profile pages is LinkedIn's recommendation engine in disguise — it pulls you away from the profile you came to read and into a rabbit hole of profile-browsing.

**What it hides:**
- The right-rail aside card on profile pages with heading "People also viewed".
- Selector: `section` or `aside` card with heading text "People also viewed" (JS text scan) or legacy `#browsemap` container.

| Property       | Value                               |
|----------------|-------------------------------------|
| Toggle Name    | Hide "People Also Viewed"           |
| Storage Key    | `linkedin.hidePeopleAlsoViewed`     |
| Default State  | ON                                  |
| CSS Class      | `df-linkedin-hide-people-also-viewed` |

---

#### E3. Hide Birthdays & Work Anniversaries Panel

**Priority:** P3

**Problem:** The "Celebrations" / birthday and work anniversary notification panel in the left rail drives engagement-for-its-own-sake — users feel social obligation to send congratulatory messages, fragmenting focus.

**What it hides:**
- The "Celebrations" panel on the home feed left sidebar.
- Individual birthday/work-anniversary notification cards in the feed.
- `.share-celebration-module` and `[data-test-id="celebrations"]`.

| Property       | Value                                |
|----------------|--------------------------------------|
| Toggle Name    | Hide Birthdays & Anniversaries       |
| Storage Key    | `linkedin.hideCelebrations`          |
| Default State  | OFF (some users value this)          |
| CSS Class      | `df-linkedin-hide-celebrations`      |

---

### Category F: Social Validation Metrics (Priority 3)

---

#### F1. Hide Connection Count / Network Size

**Priority:** P3

**Problem:** Displaying follower/connection counts on profiles (including your own) encourages treating LinkedIn as a vanity metric game rather than a professional tool. Hiding counts reduces social comparison anxiety.

**What it hides:**
- The "X connections" and "X followers" stat lines on profile pages.
- Your own connection count in the left rail sidebar card.
- `.profile-rail-card__member-nav-item` items linking to your network stats.

| Property       | Value                              |
|----------------|------------------------------------|
| Toggle Name    | Hide Connection & Follower Counts  |
| Storage Key    | `linkedin.hideConnectionCounts`    |
| Default State  | OFF                                |
| CSS Class      | `df-linkedin-hide-connection-counts` |

---

## Toggle Reference Table

This is the single source of truth for all toggles, current and proposed.

| # | Toggle Name | Storage Key | Category | Default | Priority |
|---|-------------|-------------|----------|---------|----------|
| 0 | Hide Feed | `feedEnabled` | Feed | ON | Shipped |
| 1 | Hide Sponsored Posts | `hideSponsored` | Feed | ON | P1 |
| 2 | Hide Suggested Posts | `hideSuggested` | Feed | ON | P1 |
| 3 | Hide "Add to Your Feed" Widget | `hideFollowSuggestions` | Feed | ON | P1 |
| 4 | Hide Trending News Cards | `hideTrendingNews` | Feed | ON | P2 |
| 5 | Hide People You May Know | `hidePYMK` | Sidebar | ON | P1 |
| 6 | Hide LinkedIn News Sidebar | `hideNewsSidebar` | Sidebar | ON | P1 |
| 7 | Hide Job Recommendations | `hideJobRecommendations` | Sidebar | OFF | P2 |
| 8 | Hide Learning Recommendations | `hideLearningRecs` | Sidebar | OFF | P2 |
| 9 | Hide Groups & Hashtag Widgets | `hideGroupsWidget` | Sidebar | OFF | P2 |
| 10 | Hide Premium Upsell Banners | `hidePremiumUpsell` | Upsell | ON | P2 |
| 11 | Hide Profile View Teaser | `hideProfileViewTeaser` | Upsell | ON | P2 |
| 12 | Hide Search Appearance Count | `hideSearchAppearances` | Upsell | ON | P3 |
| 13 | Hide AI Feature Upsells | `hideAIUpsell` | Upsell | ON | P3 |
| 14 | Hide Notification Badge | `hideNotificationBadge` | Badges | ON | P2 |
| 15 | Hide Messaging Badge | `hideMessagingBadge` | Badges | OFF | P2 |
| 16 | Hide Open to Work / Hiring Banners | `hideOTWBanners` | Profiles | OFF | P3 |
| 17 | Hide "People Also Viewed" | `hidePeopleAlsoViewed` | Profiles | ON | P3 |
| 18 | Hide Birthdays & Anniversaries | `hideCelebrations` | Profiles | OFF | P3 |
| 19 | Hide Connection & Follower Counts | `hideConnectionCounts` | Profiles | OFF | P3 |

All storage keys live under the `linkedin` namespace in `chrome.storage.sync`:
```json
{ "settings": { "linkedin": { "feedEnabled": true, "hideSponsored": true, ... } } }
```

---

## Default State Rationale

**Default ON (hiding active)** — These are nearly universally distracting with no legitimate daily-use value:
- Feed (existing), Sponsored Posts, Suggested Posts, Add to Feed Widget, PYMK, LinkedIn News Sidebar, Premium Upsell, Profile View Teaser, Search Appearances, AI Upsell, Notification Badge, People Also Viewed, Trending News.

**Default OFF (showing active)** — These have legitimate use cases or are highly personal:
- Job Recommendations (useful if actively job-hunting)
- Learning Recommendations (useful for L&D goals)
- Groups & Hashtag Widgets (used by community managers)
- Messaging Badge (messages are often time-sensitive professional communications)
- Open to Work / Hiring Banners (useful for recruiters)
- Birthdays & Anniversaries (relationship maintenance)
- Connection & Follower Counts (genuinely needed for some professional contexts)

---

## Technical Notes — Frontend (Popup UI)

### Grouping

The popup should organize toggles into collapsible section groups, matching the categories above. The `.section` component already exists in `popup.css`. Proposed section labels:

```
Feed & Content
Right Sidebar
Upsell & Nags
Badges
Profiles
```

### Toggle Row Implementation

No changes required to `popup.js` — it is fully generic and driven by `data-site` and `data-key` attributes. Adding a new toggle to the UI requires only a new `<div class="toggle-row">` block in `popup.html`:

```html
<div class="toggle-row" data-site="linkedin" data-key="hideSponsored">
  <div class="toggle-info">
    <span class="site-name">Hide Sponsored Posts</span>
  </div>
  <label class="toggle-switch">
    <input type="checkbox" checked>
    <span class="slider"></span>
  </label>
</div>
```

### Sub-toggle Styling

For visually grouping related toggles (e.g., the three feed content toggles), use the existing `.sub-toggle` class on `.toggle-row`. This indents the toggle slightly and reduces font weight, signaling hierarchy without adding complexity.

### Popup Height

At 320px wide, the popup will become very tall with 20 toggles. Recommended UX: implement collapsible sections. Each `.section` div should be toggleable open/closed via a chevron, with the section state persisted in `sessionStorage` (not `chrome.storage` — this is view preference, not user data). By default, all sections are expanded.

### Checkbox Initial State

`popup.js`'s `updateTogglesFromSettings()` defaults to `true` for any key not found in storage (`siteSettings[key] !== undefined ? siteSettings[key] : true`). For toggles that should default OFF, set `checked` to `false` on the `<input>` and ensure the service worker's `DEFAULT_SETTINGS` includes the key explicitly as `false`. This is critical for correct first-run behavior.

---

## Technical Notes — Backend (Content Script)

### CSS-only vs. JS-assisted hiding

There are two classes of elements by hiding strategy:

**1. CSS-only (stable class names):**
Use a new CSS class toggled on `<html>` via `DistractionFree.toggleFeature()`. Reliable for elements with stable class names. Applies immediately at `document_start` before any paint, preventing flash of unhidden content.

Examples: `.ad-banner-container`, `.feed-follows-module`, `.nav-item__try-premium`, `.notification-badge`, `.msg-overlay-bubble-header__badge`.

**2. JS-assisted (text-content-based identification):**
LinkedIn's component class names for several modules are generated, obfuscated, or frequently rotated. For these, the content script must use the existing `DistractionFree.observeDOM()` MutationObserver to scan new nodes, identify elements by their visible text content (heading text, label text), and add a stable `data-df-*` attribute that CSS then targets.

```javascript
// Pattern for JS-assisted hiding
function tagElementByHeadingText(headingText, dataAttr) {
  document.querySelectorAll('h2, h3, .artdeco-card__header').forEach(el => {
    if (el.textContent.trim().includes(headingText)) {
      const card = el.closest('.artdeco-card, aside, section');
      if (card) card.dataset[dataAttr] = 'true';
    }
  });
}
// Called on init and inside observeDOM callback
tagElementByHeadingText('People you may know', 'dfHidePymk');
tagElementByHeadingText('LinkedIn News', 'dfHideNews');
```

CSS then targets:
```css
[data-df-hide-pymk="true"] { display: none !important; }
html.df-linkedin-hide-pymk-disabled [data-df-hide-pymk="true"] { display: revert !important; }
```

Elements requiring JS-assisted hiding: PYMK, LinkedIn News sidebar, Job Recs sidebar, Learning Recs sidebar, Groups widget, Collaborative Articles, Celebrations panel, People Also Viewed.

Elements with known stable-enough selectors for CSS-only: sponsored posts (`.ad-banner-container`), add-to-feed (`.feed-follows-module`), trending news (`.feed-shared-news-module`), premium nav link (`.nav-item__try-premium`), notification badge (`.artdeco-notification-badge`), profile view counter link.

**For "Promoted" / "Suggested" post detection specifically:** The MutationObserver must scan each added `div[data-id^="urn:li:activity:"]` for a child `<span>` containing the text "Promoted" or "Suggested". When found, add `data-df-promoted="true"` to the card root for CSS targeting. This approach is resilient to class name changes and matches the pattern used by open-source solutions.

### SPA Navigation Handling

LinkedIn is a React SPA. The existing `DistractionFree.detectSPANavigation()` intercepts `pushState` and `replaceState`. The new content script must call the JS-assisted tagging functions inside the SPA navigation callback AND inside the MutationObserver callback to catch lazily rendered elements. The current `observeDOM` debounces at 300ms which is appropriate.

### Per-page Context

Some toggles only apply on specific URL paths:
- Profile page toggles (E1, E2, E3, F1): apply only when `window.location.pathname.startsWith('/in/')`.
- Feed toggles (A1–A4, B1–B6): apply only on `window.location.pathname === '/feed/'` or `/`.
- Upsell and badge toggles (C, D): apply globally across all `linkedin.com` pages.

The content script should check `window.location.pathname` on init and on every SPA navigation event to apply only the relevant subset of hiding logic.

### CSS File Structure

Extend `content/linkedin.css` with one block per feature toggle, clearly commented:

```css
/* === A1: Hide Sponsored Posts === */
[data-df-promoted="true"] { display: none !important; }
html.df-linkedin-hide-sponsored-disabled [data-df-promoted="true"] { display: revert !important; }

/* === B1: Hide PYMK === */
[data-df-hide-pymk="true"] { display: none !important; }
html.df-linkedin-hide-pymk-disabled [data-df-hide-pymk="true"] { display: revert !important; }
```

### Service Worker Default Settings

`background/service-worker.js` must be updated to include all new keys in `DEFAULT_SETTINGS`:

```javascript
const DEFAULT_SETTINGS = {
  linkedin: {
    feedEnabled: true,
    hideSponsored: true,
    hideSuggested: true,
    hideFollowSuggestions: true,
    hideTrendingNews: true,
    hidePYMK: true,
    hideNewsSidebar: true,
    hideJobRecommendations: false,
    hideLearningRecs: false,
    hideGroupsWidget: false,
    hidePremiumUpsell: true,
    hideProfileViewTeaser: true,
    hideSearchAppearances: true,
    hideAIUpsell: true,
    hideNotificationBadge: true,
    hideMessagingBadge: false,
    hideOTWBanners: false,
    hidePeopleAlsoViewed: true,
    hideCelebrations: false,
    hideConnectionCounts: false,
  }
};
```

### `chrome.storage.sync` Quota

`chrome.storage.sync` allows 8KB per item and 512 items max. The `settings` object with 20 boolean keys for one site is approximately 600 bytes — well within quota. No sharding required.

---

## Storage Schema

```json
{
  "settings": {
    "linkedin": {
      "feedEnabled": true,
      "hideSponsored": true,
      "hideSuggested": true,
      "hideFollowSuggestions": true,
      "hideTrendingNews": true,
      "hidePYMK": true,
      "hideNewsSidebar": true,
      "hideJobRecommendations": false,
      "hideLearningRecs": false,
      "hideGroupsWidget": false,
      "hidePremiumUpsell": true,
      "hideProfileViewTeaser": true,
      "hideSearchAppearances": true,
      "hideAIUpsell": true,
      "hideNotificationBadge": true,
      "hideMessagingBadge": false,
      "hideOTWBanners": false,
      "hidePeopleAlsoViewed": true,
      "hideCelebrations": false,
      "hideConnectionCounts": false
    }
  }
}
```

---

## Out of Scope

The following were considered and explicitly excluded from this spec:

- **Hiding the global navigation bar** — Too disruptive; users need navigation to use LinkedIn intentionally.
- **Blocking LinkedIn entirely** — The existing blocked-site system (`/blocked/`) handles this use case separately.
- **Modifying LinkedIn's notification system server-side** — Extension cannot interact with LinkedIn's backend.
- **Hiding the messaging compose window** — Messaging is intentional professional communication.
- **Filtering feed posts by keyword** — Valuable feature but requires a separate NLP/keyword-matching engine; scope for v3.0.
- **Support for LinkedIn mobile app** — Chrome extension cannot reach native apps.
- **LinkedIn Premium page (/premium/)** — Users who navigate there intentionally want to be there.
- **Hiding LinkedIn's own ads on external sites** (LinkedIn Audience Network) — Out of the extension's host permission scope (`*://*.linkedin.com/*` only).

---

---

## Self-Healing Selector System

**Status:** Proposed
**Target:** Engineering v2.1
**Owner:** Platform Engineering

---

### 1. System Overview

LinkedIn rotates its DOM class names and structure as a side-effect of regular React/Ember front-end deployments, typically every 2–6 weeks. The extension's CSS selectors break silently: users see the feed again, no error is thrown, and the issue is only discovered when someone files a bug report. The Self-Healing Selector System eliminates this class of regression entirely.

The system is a **standalone Node.js automation script** that lives outside the extension directory. It is never bundled into the Chrome extension and never runs in the browser's extension sandbox. It runs on the developer's machine (or a CI machine) on a scheduled cron job.

#### High-Level Flow

```
[Cron / CLI trigger]
        |
        v
  healer.js (orchestrator)
        |
        |-- 1. Launch Playwright (Chrome, headful or headless)
        |-- 2. Inject LinkedIn session cookies from session.json
        |-- 3. Navigate to linkedin.com/feed/
        |-- 4. health-check.js: query each selector -> HEALTHY / BROKEN / INEFFECTIVE
        |
        |-- If all HEALTHY: write report, exit 0
        |
        |-- If any BROKEN / INEFFECTIVE:
              |
              |-- selector-ai.js: capture feed container outerHTML
              |-- Call Claude API (claude-sonnet-4-6) with broken selector + HTML
              |-- Claude returns { newSelectors, confidence, reasoning }
              |
              |-- If confidence == 'low': log warning, send desktop notification, exit 1
              |
              |-- Validate new selectors against live DOM (Playwright querySelector)
              |
              |-- extension-updater.js: rewrite linkedin.css and linkedin.js
              |-- git commit locally ("fix: auto-update LinkedIn selectors via healer [date]")
              |
              |-- Playwright CDP: reload extension
              |-- Re-run health-check.js (confirmation pass)
              |
              |-- If still broken: increment retry counter
                    |-- If counter >= 3: send desktop notification, exit 1
                    |-- Else: loop back to selector-ai.js
              |
              |-- Write healer.log diff entry
```

The system requires no human involvement for the common case (high-confidence fix, selectors validate). Human attention is only required for low-confidence suggestions or after 3 consecutive failed fix attempts.

---

### 2. File Structure

All healer files live under a new top-level directory:

```
/Users/thenukakarunaratne/distractionfree/
├── healer/
│   ├── healer.js               # Main entry point and orchestrator
│   ├── health-check.js         # Selector validation logic
│   ├── selector-ai.js          # Claude API integration
│   ├── extension-updater.js    # Rewrites linkedin.css / linkedin.js, git commit
│   ├── notifier.js             # macOS desktop notification helper
│   ├── session.json            # LinkedIn session cookies (MUST be gitignored)
│   ├── healer.log              # Rolling append-only log of all healer runs
│   ├── package.json            # Node dependencies
│   ├── package-lock.json
│   └── com.distractionfree.healer.plist   # macOS launchd plist for scheduling
```

Add the following lines to the root `.gitignore` (or create one if absent):

```
healer/session.json
healer/healer.log
healer/node_modules/
```

#### `healer/package.json`

```json
{
  "name": "distractionfree-healer",
  "version": "1.0.0",
  "description": "Self-healing selector system for DistractionFree Chrome extension",
  "type": "module",
  "main": "healer.js",
  "scripts": {
    "check":  "node healer.js --check",
    "fix":    "node healer.js --fix",
    "login":  "node healer.js --login"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "node-cron":         "^3.0.3",
    "playwright":        "^1.50.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

### 3. Selector Registry

The healer needs a machine-readable registry of every selector the extension uses, the feature name it corresponds to, the CSS class toggle pattern, and the URL context where it applies. This registry is the single source of truth for the health check and the updater.

Define it as a plain JS constant exported from `healer.js` (or a separate `registry.js`):

```js
// healer/registry.js
export const SELECTOR_REGISTRY = [
  {
    feature:       'feed',
    description:   'Home feed post cards',
    urlPattern:    /linkedin\.com\/(feed\/?)?$/,
    cssDisabledClass: 'df-linkedin-disabled',
    selectors: [
      '.feed-shared-update-v2',
      'div[data-id^="urn:li:activity:"]',
      '.feed-sort-toggle',
      '.feed-follows-module',
    ],
    // The JS selector used to find the feed container for quote injection.
    // Tracked separately because it lives in linkedin.js, not linkedin.css.
    jsSelectors: [
      { symbol: 'feedContainer', selector: '.scaffold-finite-scroll__content' },
    ],
  },
  // Future entries for A1–F1 toggles will be added here as they ship.
  // Each entry follows the same shape so health-check.js and selector-ai.js
  // can iterate the registry without feature-specific branching.
];
```

When new toggles ship (v2.0 features A1–F1), each one gets an entry added to this registry. The healer immediately starts monitoring the new selectors with zero additional code changes.

---

### 4. Health Check Logic (`health-check.js`)

The health check runs inside an active Playwright page context (the browser is already on `linkedin.com/feed/`).

#### Function Signature

```js
// health-check.js
export async function runHealthCheck(page, registry) {
  const results = [];
  for (const feature of registry) {
    for (const selector of feature.selectors) {
      const result = await checkSelector(page, selector, feature);
      results.push(result);
    }
    for (const jsEntry of (feature.jsSelectors || [])) {
      const result = await checkJsSelector(page, jsEntry, feature);
      results.push(result);
    }
  }
  return results;
}
```

#### Per-Selector Check Logic

For each selector, the health check performs two independent tests:

**Existence Check:** Does the selector match at least one element in the live DOM?

```js
const count = await page.evaluate((sel) => {
  return document.querySelectorAll(sel).length;
}, selector);
```

- `count === 0` → status `BROKEN` (selector matches nothing; LinkedIn changed the DOM)
- `count > 0` → proceed to effectiveness check

**Effectiveness Check:** If the feature's blocking is active (i.e., the CSS disabled class is NOT on `<html>`), are the matched elements actually hidden?

```js
const isHidden = await page.evaluate((sel) => {
  const els = document.querySelectorAll(sel);
  if (els.length === 0) return null;
  // Check computed style on first matched element
  return window.getComputedStyle(els[0]).display === 'none';
}, selector);
```

- `isHidden === true` → status `HEALTHY`
- `isHidden === false` → status `INEFFECTIVE` (element exists and is rendered; CSS rule not applying)
- `isHidden === null` → status `BROKEN` (already caught above, defensive)

#### Result Shape

```js
{
  feature:   'feed',
  selector:  '.feed-shared-update-v2',
  status:    'HEALTHY' | 'BROKEN' | 'INEFFECTIVE',
  count:     number,    // elements found (0 if BROKEN)
  isHidden:  boolean | null,
  checkedAt: ISO8601 string,
}
```

#### Reporting

`runHealthCheck` returns the full results array. `healer.js` prints a summary table to stdout and appends a JSON summary line to `healer.log`. If all results are `HEALTHY`, the run exits 0 without triggering the AI repair flow.

**Wait strategy:** LinkedIn's feed renders asynchronously. Before running the health check, Playwright must wait for at least one feed post to appear:

```js
await page.waitForSelector(
  '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
  { timeout: 30_000 }
).catch(() => {
  // If neither selector appears within 30s, all feed selectors are likely BROKEN.
  // Proceed anyway; health check will report BROKEN for each.
});
```

---

### 5. Claude API Integration (`selector-ai.js`)

This module is invoked only when the health check finds at least one `BROKEN` or `INEFFECTIVE` selector.

#### DOM Snapshot Capture

Before calling Claude, capture the outerHTML of the feed container so Claude has concrete HTML to analyze:

```js
export async function captureFeedSnapshot(page) {
  const html = await page.evaluate(() => {
    // Try to find the main feed scroll container.
    // Fall back to the full <main> element if the preferred selector is broken.
    const container =
      document.querySelector('.scaffold-finite-scroll__content') ||
      document.querySelector('main') ||
      document.body;
    const raw = container.outerHTML;
    // Cap at 50KB to stay within Claude's practical context window for this task.
    return raw.length > 51_200 ? raw.slice(0, 51_200) + '\n<!-- TRUNCATED -->' : raw;
  });
  return html;
}
```

#### Claude API Call

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function discoverReplacementSelector(brokenSelector, featureName, htmlSnapshot) {
  const prompt = `
You are a CSS selector expert helping maintain a Chrome extension called DistractionFree.

The extension hides distracting LinkedIn UI elements using CSS selectors injected at document_start.

PROBLEM:
The CSS selector \`${brokenSelector}\` was used to hide LinkedIn's "${featureName}" but it no longer
matches any elements. LinkedIn has updated their DOM structure.

CURRENT LINKEDIN FEED HTML (up to 50KB):
\`\`\`html
${htmlSnapshot}
\`\`\`

TASK:
Analyze the HTML and find the new CSS selector(s) that would target the same content that
\`${brokenSelector}\` used to target.

REQUIREMENTS:
- Selectors must be valid CSS (usable with document.querySelectorAll)
- Prefer stable attributes (data-* attributes, aria-* attributes, id attributes) over
  generated class names (e.g. classes that look like "feed-shared-update-v2__dPwkl")
- If multiple selectors are needed for full coverage, list all of them
- Do NOT suggest selectors that would hide the entire page or large layout containers

Return ONLY valid JSON in exactly this shape, with no markdown fencing:
{
  "newSelectors": ["selector1", "selector2"],
  "confidence": "high" | "medium" | "low",
  "reasoning": "one or two sentences explaining what changed and why these selectors work"
}

confidence guide:
- "high": you found a clear stable attribute or id that definitively identifies the element
- "medium": you found class names that look stable but may be partially generated
- "low": you are guessing based on structural position; human review is needed
`.trim();

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed.newSelectors) || parsed.newSelectors.length === 0) {
    throw new Error('Claude response missing newSelectors array');
  }
  if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
    throw new Error(`Claude returned unknown confidence value: ${parsed.confidence}`);
  }

  return parsed; // { newSelectors, confidence, reasoning }
}
```

#### Pre-Write Validation

Before any file is modified, validate that Claude's proposed selectors actually match elements in the live DOM:

```js
export async function validateSelectors(page, selectors) {
  const results = [];
  for (const sel of selectors) {
    let count = 0;
    try {
      count = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
    } catch {
      count = -1; // invalid CSS syntax
    }
    results.push({ selector: sel, matchCount: count, valid: count > 0 });
  }
  return results;
}
```

If any proposed selector has `matchCount === -1` (invalid syntax), discard the entire Claude response and log an error. If all selectors return `matchCount === 0` even after a 5-second wait, also discard and log. Only proceed to file updates when at least one proposed selector matches live elements.

---

### 6. Extension File Updater (`extension-updater.js`)

This module rewrites `content/linkedin.css` and (when JS selectors change) `content/linkedin.js`, then creates a local git commit.

#### CSS Updater

The updater must parse the existing CSS file, locate the block owned by the affected feature, replace old selectors with new ones, and preserve the un-hide rule that uses the `html.df-{feature}-disabled` pattern.

The CSS file uses a consistent two-rule pattern per feature:

```css
/* Block 1: hide rule */
.old-selector-a,
.old-selector-b {
  display: none !important;
}

/* Block 2: un-hide rule (toggled off state) */
html.df-linkedin-disabled .old-selector-a,
html.df-linkedin-disabled .old-selector-b {
  display: revert !important;
}
```

The updater reads the CSS as a string, uses regex or simple string splitting to locate the two blocks for the target feature, rebuilds them with the new selectors, and writes the file back. No CSS AST parser is required.

```js
// extension-updater.js
import fs from 'fs';
import path from 'path';

const CSS_FILE = path.resolve(
  import.meta.dirname, '../../content/linkedin.css'
);

export function updateCSSSelectors(feature, oldSelectors, newSelectors, disabledClass) {
  let css = fs.readFileSync(CSS_FILE, 'utf8');

  // Build the hide block
  const hideBlock =
    newSelectors.map(s => s).join(',\n') +
    ' {\n  display: none !important;\n}';

  // Build the un-hide block
  const unHideBlock =
    newSelectors.map(s => `html.${disabledClass} ${s}`).join(',\n') +
    ' {\n  display: revert !important;\n}';

  // Replace old selectors in both blocks.
  // Strategy: replace each old selector string literally in the file.
  // This is safe because selectors are unique per feature.
  for (const oldSel of oldSelectors) {
    // In the un-hide block the selector is prefixed with the disabled class
    const oldUnHide = `html.${disabledClass} ${oldSel}`;
    css = css.replaceAll(oldSel, newSelectors[0]); // naive first pass
    // Full block replacement is safer; see implementation note below.
  }

  fs.writeFileSync(CSS_FILE, css, 'utf8');
}
```

**Implementation note:** The naive `replaceAll` above is a starting scaffold. The production implementation should use a block-aware replacement:

1. Split the CSS string on the feature's section comment (e.g., `/* DistractionFree — LinkedIn feed hiding */`).
2. Reconstruct the hide block from scratch using `newSelectors`.
3. Reconstruct the un-hide block from scratch using `html.${disabledClass} ${newSelector}` for each new selector.
4. Rejoin the CSS string and write.

This avoids the risk of accidentally replacing a selector string that appears in a comment or another feature's block.

#### JS Updater

When a JS selector changes (e.g., `.scaffold-finite-scroll__content`), the updater must find the literal string in `content/linkedin.js` and replace it:

```js
const JS_FILE = path.resolve(
  import.meta.dirname, '../../content/linkedin.js'
);

export function updateJSSelector(oldSelector, newSelector) {
  let js = fs.readFileSync(JS_FILE, 'utf8');
  if (!js.includes(`"${oldSelector}"`) && !js.includes(`'${oldSelector}'`)) {
    throw new Error(`Selector "${oldSelector}" not found in linkedin.js`);
  }
  js = js.replaceAll(`"${oldSelector}"`, `"${newSelector}"`);
  js = js.replaceAll(`'${oldSelector}'`, `'${newSelector}'`);
  fs.writeFileSync(JS_FILE, js, 'utf8');
}
```

#### Git Commit

After all file writes succeed:

```js
import { execSync } from 'child_process';

export function commitChanges(changedFiles, dateStr) {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const filePaths = changedFiles.join(' ');
  execSync(`git -C "${repoRoot}" add ${filePaths}`);
  execSync(
    `git -C "${repoRoot}" commit -m "fix: auto-update LinkedIn selectors via healer [${dateStr}]"`,
    { stdio: 'inherit' }
  );
}
```

`changedFiles` is the list of absolute paths that were modified (e.g., `['content/linkedin.css']`). The commit is local only — **never push to remote automatically**.

---

### 7. Main Orchestrator (`healer.js`)

`healer.js` wires all modules together and handles the CLI and cron entry points.

#### CLI Interface

```
node healer/healer.js --login   # One-time: open browser, log in, save session.json
node healer/healer.js --check   # Health check only, no writes, exit 0 if healthy
node healer/healer.js --fix     # Health check + auto-fix if needed
node healer/healer.js           # Same as --fix (default for cron)
```

#### Orchestration Logic (--fix mode)

```js
// healer.js (pseudocode)
import cron from 'node-cron';
import { chromium } from 'playwright';
import { SELECTOR_REGISTRY } from './registry.js';
import { runHealthCheck } from './health-check.js';
import { captureFeedSnapshot, discoverReplacementSelector, validateSelectors }
  from './selector-ai.js';
import { updateCSSSelectors, updateJSSelector, commitChanges }
  from './extension-updater.js';
import { sendDesktopNotification } from './notifier.js';
import fs from 'fs';
import path from 'path';

const SESSION_FILE   = new URL('./session.json',   import.meta.url).pathname;
const LOG_FILE       = new URL('./healer.log',      import.meta.url).pathname;
const MAX_RETRIES    = 3;
const EXTENSION_PATH = path.resolve(import.meta.dirname, '..');

async function runHealer() {
  const browser = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  const page = await browser.newPage();

  // Inject saved session cookies
  const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  await browser.addCookies(cookies);

  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle' });

  // Wait up to 30s for any feed post to render
  await page.waitForSelector(
    '.feed-shared-update-v2, div[data-id^="urn:li:activity:"]',
    { timeout: 30_000 }
  ).catch(() => {});

  let retryCount = 0;
  let results = await runHealthCheck(page, SELECTOR_REGISTRY);

  while (retryCount < MAX_RETRIES) {
    const broken = results.filter(r => r.status !== 'HEALTHY');
    if (broken.length === 0) break;

    log(`[healer] Found ${broken.length} broken/ineffective selector(s). Attempt ${retryCount + 1}/${MAX_RETRIES}.`);

    const htmlSnapshot = await captureFeedSnapshot(page);
    const changedFiles = new Set();
    const commitDate   = new Date().toISOString().slice(0, 10);

    for (const item of broken) {
      log(`[healer] Repairing: ${item.selector} (${item.status})`);

      const feature = SELECTOR_REGISTRY.find(f =>
        f.selectors.includes(item.selector) ||
        (f.jsSelectors || []).some(j => j.selector === item.selector)
      );

      const aiResult = await discoverReplacementSelector(
        item.selector, feature.description, htmlSnapshot
      );

      log(`[healer] Claude suggestion (confidence=${aiResult.confidence}): ${aiResult.newSelectors.join(', ')}`);
      log(`[healer] Reasoning: ${aiResult.reasoning}`);

      if (aiResult.confidence === 'low') {
        log(`[healer] WARN: Confidence is low. Skipping auto-fix. Human review required.`);
        await sendDesktopNotification(
          'DistractionFree Healer',
          `Low-confidence selector fix needed for "${feature.description}". Check healer.log.`
        );
        continue;
      }

      const validation = await validateSelectors(page, aiResult.newSelectors);
      const allValid = validation.every(v => v.valid);

      if (!allValid) {
        log(`[healer] WARN: Proposed selectors did not match live DOM. Skipping.`);
        log(JSON.stringify(validation));
        continue;
      }

      // Determine whether this is a CSS or JS selector
      const isCSSSelector  = feature.selectors.includes(item.selector);
      const isJSSelectorEntry = (feature.jsSelectors || []).find(j => j.selector === item.selector);

      if (isCSSSelector) {
        updateCSSSelectors(
          feature.feature,
          [item.selector],
          aiResult.newSelectors,
          feature.cssDisabledClass
        );
        changedFiles.add('content/linkedin.css');
      }
      if (isJSSelectorEntry) {
        updateJSSelector(item.selector, aiResult.newSelectors[0]);
        changedFiles.add('content/linkedin.js');
      }

      // Update registry in memory for the re-check
      if (isCSSSelector) {
        const idx = feature.selectors.indexOf(item.selector);
        feature.selectors.splice(idx, 1, ...aiResult.newSelectors);
      }
    }

    if (changedFiles.size > 0) {
      commitChanges([...changedFiles], commitDate);
      log(`[healer] Committed changes: ${[...changedFiles].join(', ')}`);

      // Reload extension via CDP
      await reloadExtension(browser);
      await page.waitForTimeout(3000);
    }

    // Confirmation pass
    results = await runHealthCheck(page, SELECTOR_REGISTRY);
    retryCount++;
  }

  const stillBroken = results.filter(r => r.status !== 'HEALTHY');
  if (stillBroken.length > 0 && retryCount >= MAX_RETRIES) {
    log(`[healer] ERROR: Failed to repair selectors after ${MAX_RETRIES} attempts.`);
    await sendDesktopNotification(
      'DistractionFree Healer — Action Required',
      `${stillBroken.length} selector(s) could not be auto-fixed after ${MAX_RETRIES} attempts. Manual intervention required.`
    );
  }

  await browser.close();
  writeLogSummary(results);
}
```

#### Extension Reload via CDP

```js
async function reloadExtension(browserContext) {
  // Use Chrome DevTools Protocol to reload the extension's service worker
  // and force the browser to re-inject the updated content script on next navigation.
  const page = await browserContext.newPage();
  await page.goto('chrome://extensions/');
  // CDP approach: find extension ID from the page, click reload button.
  // Playwright's CDP session can send Runtime.evaluate to the extensions page.
  // Simpler alternative: navigate away and back to re-trigger content script injection.
  await page.close();
}
```

**Implementation note:** Chrome does not expose a simple CDP command to reload a specific extension. The two reliable approaches are:

1. Navigate the extensions management page (`chrome://extensions/`) and programmatically click the extension's reload button via Playwright locators.
2. Simply navigate to a fresh `linkedin.com/feed/` page — the updated CSS file is read from disk at next injection, so the new content script rules take effect on the next page load without a full extension reload.

Approach 2 is simpler and sufficient for this use case. The confirmation health check run opens a new page navigate, which automatically uses the updated CSS.

---

### 8. LinkedIn Authentication Strategy (`--login` mode)

Session cookies must be obtained once manually and then reused for all subsequent automated runs.

#### One-Time Login Flow

```js
// Inside healer.js, --login branch
async function doLogin() {
  const browser = await chromium.launch({ headless: false }); // Must be headful
  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login');

  console.log('[healer] Browser opened. Please log in to LinkedIn manually.');
  console.log('[healer] The script will save your session when you reach the feed.');

  // Wait until the user reaches /feed/ (up to 5 minutes)
  await page.waitForURL('**/feed/**', { timeout: 300_000 });

  const cookies = await browser.contexts()[0].cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log(`[healer] Session saved to ${SESSION_FILE}`);

  await browser.close();
}
```

#### Cookie Refresh

LinkedIn session cookies typically remain valid for weeks. The healer detects session expiry by checking whether the post-navigation URL ends up on `linkedin.com/login` or `linkedin.com/checkpoint/`:

```js
const currentUrl = page.url();
if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint/')) {
  log('[healer] ERROR: LinkedIn session expired. Run: node healer/healer.js --login');
  await sendDesktopNotification(
    'DistractionFree Healer',
    'LinkedIn session expired. Run: node healer/healer.js --login'
  );
  await browser.close();
  process.exit(1);
}
```

There is no automatic cookie refresh — LinkedIn's re-authentication requires 2FA, which cannot be automated safely. When session expiry is detected, the healer exits with a desktop notification and a clear log message.

---

### 9. Desktop Notifier (`notifier.js`)

macOS desktop notifications are sent via the `osascript` command. No npm dependency is needed.

```js
// notifier.js
import { execSync } from 'child_process';

export function sendDesktopNotification(title, message) {
  const escaped = message.replace(/"/g, '\\"');
  try {
    execSync(
      `osascript -e 'display notification "${escaped}" with title "${title}"'`
    );
  } catch {
    // Non-fatal: notification failure should not abort the healer run
    console.warn('[healer] Could not send desktop notification (osascript failed)');
  }
}
```

---

### 10. Cron Job Setup

#### Option A: `node-cron` (in-process, requires `healer.js` to stay running)

```js
// At the bottom of healer.js
import cron from 'node-cron';

const args = process.argv.slice(2);

if (args.includes('--login')) {
  await doLogin();
} else if (args.includes('--check')) {
  await runHealthCheckOnly();
} else if (args.includes('--fix') || args.length === 0) {
  if (process.env.HEALER_CRON === '1') {
    // Running as a persistent daemon — schedule
    cron.schedule('0 3 * * *', runHealer, { timezone: 'America/Los_Angeles' });
    console.log('[healer] Cron daemon started. Health check runs daily at 3:00 AM PT.');
  } else {
    // Single run (CLI --fix or bare invocation)
    await runHealer();
    process.exit(0);
  }
}
```

Start the daemon with: `HEALER_CRON=1 node healer/healer.js`

#### Option B: macOS launchd plist (preferred for reliability)

launchd runs even after a reboot, does not require a persistent Node process, and is the standard macOS approach for background jobs. Create `healer/com.distractionfree.healer.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.distractionfree.healer</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/thenukakarunaratne/distractionfree/healer/healer.js</string>
    <string>--fix</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>WorkingDirectory</key>
  <string>/Users/thenukakarunaratne/distractionfree/healer</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>ANTHROPIC_API_KEY</key>
    <string>YOUR_KEY_HERE</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/thenukakarunaratne/distractionfree/healer/healer.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/thenukakarunaratne/distractionfree/healer/healer.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
```

**Installation:**

```bash
cp healer/com.distractionfree.healer.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.distractionfree.healer.plist
```

**Uninstall:**

```bash
launchctl unload ~/Library/LaunchAgents/com.distractionfree.healer.plist
rm ~/Library/LaunchAgents/com.distractionfree.healer.plist
```

**Manual trigger (for testing):**

```bash
launchctl start com.distractionfree.healer
```

**Note:** Replace `YOUR_KEY_HERE` with the actual API key, or better, reference it from a separate env file by having the plist source a shell profile. Do not commit the plist if it contains the actual key value.

---

### 11. Safety and Guardrails

The following constraints are non-negotiable and must be enforced in code, not just policy:

| Guardrail | Implementation |
|---|---|
| Never auto-push to git | `commitChanges()` calls `git commit` only; no `git push` command exists anywhere in the codebase |
| Skip auto-fix on low confidence | `if (aiResult.confidence === 'low') continue;` before any file write |
| Cap retries at 3 | `MAX_RETRIES = 3` constant; loop exits and sends desktop notification on breach |
| Validate selectors before writing | `validateSelectors()` must return `valid: true` for at least all proposed selectors; no file write otherwise |
| Never write if Claude returns invalid JSON | JSON.parse wrapped in try/catch; throws before reaching updater |
| Never write if selector matches 0 elements | Validation check: `matchCount > 0` required |
| Session cookie file is gitignored | `.gitignore` entry for `healer/session.json` is a required setup step, enforced by a startup check in `healer.js` |
| Startup gitignore check | On startup, `healer.js` verifies `healer/session.json` is listed in `.gitignore`. If not, logs a warning and refuses to run in `--fix` mode |
| Log all changes | Every selector replacement is logged with before/after values in `healer.log` |

#### `healer.log` Entry Format

Each run appends a structured JSON line:

```json
{
  "runAt": "2026-03-05T03:00:12.000Z",
  "mode": "fix",
  "results": [
    {
      "feature": "feed",
      "selector": ".feed-shared-update-v2",
      "status": "BROKEN",
      "action": "replaced",
      "oldSelector": ".feed-shared-update-v2",
      "newSelectors": [".feed-shared-update-v3", "div[data-view-name='feed-full-update']"],
      "confidence": "high",
      "reasoning": "LinkedIn renamed the class and added a data-view-name attribute."
    }
  ],
  "commitSha": "a1b2c3d",
  "durationMs": 18420
}
```

---

### 12. Environment Variables

The healer reads configuration from environment variables (not hardcoded):

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key. Set in shell profile or launchd plist. |
| `HEALER_CRON` | No | Set to `1` to run as persistent cron daemon instead of single-shot. |
| `HEALER_HEADLESS` | No | Set to `0` to run Playwright in headful mode (useful for debugging). Default: `1` (headless). |
| `HEALER_MAX_RETRIES` | No | Override default retry cap of 3. |

---

### 13. Implementation Checklist

The following tasks are broken into four sequential phases. Each phase is independently releasable and testable. Do not start Phase 2 until Phase 1 passes end-to-end.

---

#### Phase 1 — Health Check Script (no AI, no file writes)

Goal: A script an engineer can run locally to get a pass/fail report on all extension selectors.

- [ ] **1.1** Create `healer/` directory and `package.json` with `playwright` dependency only. Run `npm install`.
- [ ] **1.2** Create `healer/registry.js` with the `SELECTOR_REGISTRY` constant. Populate with all four current CSS selectors from `linkedin.css` and the one JS selector (`.scaffold-finite-scroll__content`) from `linkedin.js`.
- [ ] **1.3** Implement `--login` mode in `healer.js`: launch headful Chromium, navigate to LinkedIn login, wait for `/feed/` URL, save cookies to `session.json`, close browser.
- [ ] **1.4** Add startup gitignore check: read `.gitignore`, verify `healer/session.json` is listed, warn and exit if not.
- [ ] **1.5** Implement `health-check.js` with `runHealthCheck(page, registry)`. Implement existence check and effectiveness check. Return structured results array.
- [ ] **1.6** Implement `--check` mode in `healer.js`: launch headless Chromium, load cookies, navigate to feed, wait for feed element, run health check, print results table to stdout, exit 0 if all healthy / exit 1 if any broken.
- [ ] **1.7** Implement session expiry detection: check post-navigation URL for `/login` or `/checkpoint/`, log error and exit 1 if detected.
- [ ] **1.8** Test Phase 1 end-to-end: run `--login`, then `--check`. Confirm all 5 current selectors report HEALTHY. Temporarily rename a selector in the registry to simulate breakage and confirm it reports BROKEN.
- [ ] **1.9** Add `healer/session.json` and `healer/healer.log` to root `.gitignore`.

---

#### Phase 2 — Claude API Integration for Selector Discovery

Goal: When a selector is BROKEN, call Claude and get a proposed replacement. No file writes yet.

- [ ] **2.1** Add `@anthropic-ai/sdk` to `package.json` and run `npm install`.
- [ ] **2.2** Implement `captureFeedSnapshot(page)` in `selector-ai.js`. Test that it captures and truncates to 50KB correctly.
- [ ] **2.3** Implement `discoverReplacementSelector(brokenSelector, featureName, htmlSnapshot)` in `selector-ai.js`. Wire up the Claude API call with the exact prompt from Section 5. Parse and validate the JSON response shape.
- [ ] **2.4** Implement `validateSelectors(page, selectors)` in `selector-ai.js`. Test with known-good and known-bad selectors.
- [ ] **2.5** Add a `--dry-run` flag to `healer.js` that runs the full AI discovery flow but prints proposed changes to stdout instead of writing files. This lets engineers review Claude's suggestions before enabling auto-write.
- [ ] **2.6** Test Phase 2 end-to-end: artificially mark a selector as BROKEN (by temporarily using a wrong selector in the registry), run `--dry-run`, and verify Claude's response is logged.
- [ ] **2.7** Handle error cases: Claude API timeout (30s timeout on the API call), JSON parse failure, empty `newSelectors` array. All should log an error and continue to the next broken selector without crashing.

---

#### Phase 3 — Auto-Updater and Git Commit

Goal: Validated new selectors are written to the CSS/JS files and committed locally.

- [ ] **3.1** Implement `updateCSSSelectors(feature, oldSelectors, newSelectors, disabledClass)` in `extension-updater.js` using the block-aware replacement strategy (locate section comment, reconstruct both the hide block and un-hide block from scratch with new selectors).
- [ ] **3.2** Implement `updateJSSelector(oldSelector, newSelector)` in `extension-updater.js`. Handle both single-quoted and double-quoted string literals.
- [ ] **3.3** Implement `commitChanges(changedFiles, dateStr)` in `extension-updater.js`. Use `execSync('git -C ... commit ...')`. Capture stdout/stderr and log them.
- [ ] **3.4** Implement `notifier.js` with `sendDesktopNotification(title, message)` using `osascript`.
- [ ] **3.5** Wire together the full `--fix` orchestration in `healer.js`: health check → AI discovery → validation → file update → git commit → extension reload (navigate fresh page) → confirmation health check → retry loop → desktop notification on max retries.
- [ ] **3.6** Implement all guardrails from Section 11: confidence gate, retry cap, validate-before-write, gitignore check.
- [ ] **3.7** Implement `healer.log` append with structured JSON format.
- [ ] **3.8** Test Phase 3 end-to-end with a simulated broken selector: confirm `linkedin.css` is updated, git log shows the auto-commit, confirmation health check passes.
- [ ] **3.9** Review git diff of updated `linkedin.css` manually to confirm the un-hide pattern (`html.df-linkedin-disabled .selector { display: revert }`) is preserved correctly.

---

#### Phase 4 — Cron Job and launchd Plist

Goal: The healer runs automatically every night with no manual invocation.

- [ ] **4.1** Add `node-cron` to `package.json` and run `npm install`.
- [ ] **4.2** Implement the `HEALER_CRON=1` daemon mode in `healer.js` using `node-cron` for in-process scheduling (3:00 AM daily).
- [ ] **4.3** Create `healer/com.distractionfree.healer.plist` with the content from Section 10. Leave `ANTHROPIC_API_KEY` as a placeholder.
- [ ] **4.4** Document the launchd installation steps in a comment block at the top of `healer.js` (not in a separate README file).
- [ ] **4.5** Test the launchd plist: install it, use `launchctl start com.distractionfree.healer` to trigger a manual run, verify the log file is written and output is captured.
- [ ] **4.6** Verify `healer.log` rotates or does not grow unbounded: implement a log rotation strategy (cap at 1000 lines, truncate oldest entries on each append), or document the manual `truncate` command.
- [ ] **4.7** Final end-to-end smoke test: let the launchd job run at its scheduled time (or trigger manually), confirm a healthy run produces a log entry with all-HEALTHY results, confirm a simulated broken run produces a committed fix and a log entry with before/after diff.

---

### 14. Open Questions for Engineering

The following decisions are intentionally left to the implementing engineer and should be resolved before Phase 3 begins:

1. **CSS block delimiter strategy**: The current `linkedin.css` does not have per-feature section comments. Phase 3 requires them for reliable block-aware replacement. Engineering must decide: (a) add comment delimiters to `linkedin.css` as part of Phase 1 setup, or (b) use line-number-based replacement with a parsed CSS structure. Option (a) is strongly preferred.

2. **Headless vs. headful for production**: Some LinkedIn anti-bot measures may block headless Chromium. If the healer is consistently redirected to login despite valid cookies, switch `HEALER_HEADLESS` to `0` (headful) and run the launchd job only when the machine's display is active.

3. **Extension ID for CDP reload**: Chrome assigns a different extension ID in developer mode vs. production. If the CDP-based reload approach is pursued (rather than the simpler page-navigate approach), the extension ID must be read dynamically. `playwright`'s `browser.contexts()[0].serviceWorkers()` can enumerate service workers to find the extension's ID at runtime.

4. **Multi-selector confidence**: When Claude returns multiple new selectors (e.g., three variants for different LinkedIn render paths), the updater adds all of them. This may cause the CSS file to grow over time as LinkedIn cycles through variants. Define a policy: keep only the most recently confirmed-working set, or keep all ever-discovered selectors as an OR list. The latter is more resilient; the former is cleaner.

---

*End of Self-Healing Selector System specification.*

---

*End of specification.*
