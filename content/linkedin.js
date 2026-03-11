/**
 * DistractionFree — LinkedIn content script (v2.0)
 */
(function () {
  const SITE = "linkedin";

  // ---------------------------------------------------------------------------
  // CSS — injected via JS so changes are picked up on page refresh without
  // requiring an extension reload (manifest-declared CSS files are cached;
  // JS files are re-read from disk on every page load).
  // ---------------------------------------------------------------------------

  DistractionFree.injectCSS(`
/* DistractionFree — LinkedIn feed hiding (active by default) */

/* Feed hiding — position-based, durable against LinkedIn rendering changes.
   The mainFeed container structure is always:
     Child[0]  = "Start a post" composer  — always show
     Child[1]  = .df-quote-container      — always show (after our injection)
     Child[2+] = sort toggle, posts, pill — hide all
   No LinkedIn-specific class or attribute selectors needed. */

/* Hide all mainFeed direct children when feed blocking is active */
html.df-linkedin-is-feed [data-testid='mainFeed'] > * {
  display: none !important;
}
/* Always show the first child (the "Start a post" composer) */
html.df-linkedin-is-feed [data-testid='mainFeed'] > *:first-child {
  display: revert !important;
}
/* Always show our injected motivational quote */
html.df-linkedin-is-feed [data-testid='mainFeed'] > .df-quote-container {
  display: block !important;
}
/* Prevent infinite-scroll */
html.df-linkedin-is-feed [data-testid='mainFeed'] {
  overflow: hidden !important;
}

/* Notification page (/feed/?highlightedUpdateUrn=…):
   ALL feed posts now have data-display-contents + data-view-tracking-scope —
   including the highlighted one.  JS tags the first post with df-highlighted-post
   so CSS can show it while hiding the rest. */
html.df-linkedin-is-notif [data-testid='mainFeed'] > [data-display-contents][data-view-tracking-scope] {
  display: none !important;
}
html.df-linkedin-is-notif [data-testid='mainFeed'] > [data-display-contents][data-view-tracking-scope].df-highlighted-post {
  display: contents !important;
}

/* Disabled state — restore all hidden children.
   Feed page: display:revert restores UA default (block), but LinkedIn's post
   wrappers use display:contents — the [data-display-contents] rule restores
   those explicitly (same specificity, later in source → wins).
   Notification page: the [data-display-contents][data-view-tracking-scope] rule
   has higher specificity (0,4,1) than the generic rule (0,3,1) — needs its own
   explicit override to win. */
html.df-linkedin-disabled [data-testid='mainFeed'] > *:not(:first-child) {
  display: revert !important;
}
html.df-linkedin-disabled [data-testid='mainFeed'] > [data-display-contents] {
  display: contents !important;
}
html.df-linkedin-disabled [data-testid='mainFeed'] > [data-display-contents][data-view-tracking-scope] {
  display: contents !important;
}
html.df-linkedin-disabled [data-testid='mainFeed'] {
  overflow: revert !important;
}

/* === B1: Hide PYMK (JS-tagged) === */

[data-df-hide-pymk="true"] { display: none !important; }
html.df-linkedin-hide-pymk-disabled [data-df-hide-pymk="true"] { display: revert !important; }

/* === B2: Hide LinkedIn News Sidebar (JS-tagged) === */

[data-df-hide-news-sidebar="true"] { display: none !important; }
html.df-linkedin-hide-news-sidebar-disabled [data-df-hide-news-sidebar="true"] { display: revert !important; }

/* === B2b: Hide "Start a post" composer (independently of feed toggle) === */
/* Placed AFTER the first-child revert rule above. Both rules have the same
   specificity (0,3,1); later in source wins, so this hide takes precedence
   when the feature is active. The disabled-show rule is placed last so it
   overrides the hide when the toggle is off. */
html.df-linkedin-is-feed [data-testid='mainFeed'] > [data-df-hide-start-post="true"] {
  display: none !important;
}
html.df-linkedin-hide-start-post-disabled [data-testid='mainFeed'] > [data-df-hide-start-post="true"] {
  display: revert !important;
}

/* === B2c: Hide "My Pages" left-sidebar widget section === */
[data-df-hide-my-pages="true"] { display: none !important; }
html.df-linkedin-hide-my-pages-disabled [data-df-hide-my-pages="true"] { display: revert !important; }

/* === B2e: Hide stats dashboard (Profile viewers + Post impressions) === */
[data-df-hide-stats-dashboard="true"] { display: none !important; }
html.df-linkedin-hide-stats-dashboard-disabled [data-df-hide-stats-dashboard="true"] { display: revert !important; }

/* === B2d: Hide promoted "Follow" suggestions feed cards + right-sidebar Follow ads + banner ad iframes === */
[data-df-hide-follow-pages="true"],
iframe[title="advertisement"],
iframe[componentkey="MainFeedDesktopNav_feed_ad"] {
  display: none !important;
}
html.df-linkedin-hide-follow-pages-disabled [data-df-hide-follow-pages="true"],
html.df-linkedin-hide-follow-pages-disabled iframe[title="advertisement"],
html.df-linkedin-hide-follow-pages-disabled iframe[componentkey="MainFeedDesktopNav_feed_ad"] {
  display: revert !important;
}

/* === B3: Hide Job Recommendations (JS-tagged + legacy selectors) === */

[data-df-hide-job-recs="true"],
#jobsForYou,
.jymbii-update {
  display: none !important;
}

html.df-linkedin-hide-job-recs-disabled [data-df-hide-job-recs="true"],
html.df-linkedin-hide-job-recs-disabled #jobsForYou,
html.df-linkedin-hide-job-recs-disabled .jymbii-update {
  display: revert !important;
}

/* === B4: Hide Learning Recommendations (JS-tagged + legacy selectors) === */

[data-df-hide-learning-recs="true"],
#course-recommendations,
.lyndaCourse-singleton {
  display: none !important;
}

html.df-linkedin-hide-learning-recs-disabled [data-df-hide-learning-recs="true"],
html.df-linkedin-hide-learning-recs-disabled #course-recommendations,
html.df-linkedin-hide-learning-recs-disabled .lyndaCourse-singleton {
  display: revert !important;
}

/* === B5: Hide Groups & Hashtag Widgets (JS-tagged + legacy selectors) === */

[data-df-hide-groups="true"],
#groupsForYou,
#companiesForYou,
#recent-activities-widget {
  display: none !important;
}

html.df-linkedin-hide-groups-widget-disabled [data-df-hide-groups="true"],
html.df-linkedin-hide-groups-widget-disabled #groupsForYou,
html.df-linkedin-hide-groups-widget-disabled #companiesForYou,
html.df-linkedin-hide-groups-widget-disabled #recent-activities-widget {
  display: revert !important;
}

/* === C1: Hide Premium Upsell Banners === */

[data-view-name='home-nav-left-rail-growth-widgets-my-premium'],
[data-view-name='home-nav-left-rail-page-premium-upsell-cta'],
.nav-item__try-premium,
.premium-upsell-link,
.upsell,
[data-df-hide-premium="true"] {
  display: none !important;
}

html.df-linkedin-hide-premium-upsell-disabled [data-view-name='home-nav-left-rail-growth-widgets-my-premium'],
html.df-linkedin-hide-premium-upsell-disabled [data-view-name='home-nav-left-rail-page-premium-upsell-cta'],
html.df-linkedin-hide-premium-upsell-disabled .nav-item__try-premium,
html.df-linkedin-hide-premium-upsell-disabled .premium-upsell-link,
html.df-linkedin-hide-premium-upsell-disabled .upsell,
html.df-linkedin-hide-premium-upsell-disabled [data-df-hide-premium="true"] {
  display: revert !important;
}

/* === C2: Hide Profile View Teaser === */

[data-view-name='home-nav-left-rail-growth-widgets-profile-views'],
.profile-rail-card__member-nav-item:has(a[href*="profile-views"]),
[data-df-hide-profile-views="true"] {
  display: none !important;
}

html.df-linkedin-hide-profile-views-disabled [data-view-name='home-nav-left-rail-growth-widgets-profile-views'],
html.df-linkedin-hide-profile-views-disabled .profile-rail-card__member-nav-item:has(a[href*="profile-views"]),
html.df-linkedin-hide-profile-views-disabled [data-df-hide-profile-views="true"] {
  display: revert !important;
}

/* === C3: Hide Search Appearance Count === */

.profile-rail-card__member-nav-item:has(a[href*="search-appearances"]),
a[href*="search-appearances"],
[data-df-hide-search-appearances="true"] {
  display: none !important;
}

html.df-linkedin-hide-search-appearances-disabled .profile-rail-card__member-nav-item:has(a[href*="search-appearances"]),
html.df-linkedin-hide-search-appearances-disabled a[href*="search-appearances"],
html.df-linkedin-hide-search-appearances-disabled [data-df-hide-search-appearances="true"] {
  display: revert !important;
}

/* === C4: Hide AI Feature Upsells (JS-tagged) === */

[data-df-hide-ai-upsell="true"] { display: none !important; }
html.df-linkedin-hide-ai-upsell-disabled [data-df-hide-ai-upsell="true"] { display: revert !important; }

/* === D1: Hide Notification Badge === */

.notification-badge,
.artdeco-notification-badge {
  display: none !important;
}

html.df-linkedin-hide-notif-badge-disabled .notification-badge,
html.df-linkedin-hide-notif-badge-disabled .artdeco-notification-badge {
  display: revert !important;
}

/* === D2: Hide Messaging Badge === */

.msg-overlay-bubble-header__badge,
.msg-conversations-container__badge-count,
.presence-entity__indicator {
  display: none !important;
}

html.df-linkedin-hide-msg-badge-disabled .msg-overlay-bubble-header__badge,
html.df-linkedin-hide-msg-badge-disabled .msg-conversations-container__badge-count,
html.df-linkedin-hide-msg-badge-disabled .presence-entity__indicator {
  display: revert !important;
}

/* === E1: Hide Open to Work / Hiring Banners === */

.open-to-work-badge,
[data-test-id="open-to-work-signal"],
[data-df-hide-otw="true"] {
  display: none !important;
}

html.df-linkedin-hide-otw-banners-disabled .open-to-work-badge,
html.df-linkedin-hide-otw-banners-disabled [data-test-id="open-to-work-signal"],
html.df-linkedin-hide-otw-banners-disabled [data-df-hide-otw="true"] {
  display: revert !important;
}

/* === E2: Hide "People Also Viewed" (JS-tagged) === */

[data-df-hide-people-also-viewed="true"],
#browsemap {
  display: none !important;
}

html.df-linkedin-hide-people-also-viewed-disabled [data-df-hide-people-also-viewed="true"],
html.df-linkedin-hide-people-also-viewed-disabled #browsemap {
  display: revert !important;
}

/* === E3: Hide Birthdays & Anniversaries === */

.share-celebration-module,
[data-test-id="celebrations"],
[data-df-hide-celebrations="true"] {
  display: none !important;
}

html.df-linkedin-hide-celebrations-disabled .share-celebration-module,
html.df-linkedin-hide-celebrations-disabled [data-test-id="celebrations"],
html.df-linkedin-hide-celebrations-disabled [data-df-hide-celebrations="true"] {
  display: revert !important;
}

/* === F1: Hide Connection & Follower Counts (JS-tagged) === */

[data-df-hide-connection-counts="true"] { display: none !important; }
html.df-linkedin-hide-connection-counts-disabled [data-df-hide-connection-counts="true"] { display: revert !important; }

/* Quote styling */
.df-quote-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 48px 24px;
}

html.df-linkedin-disabled .df-quote-container { display: none !important; }

.df-quote-inner {
  text-align: center;
  max-width: 480px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.df-quote-mascot { margin-bottom: 16px; }

.df-quote-text {
  font-size: 20px;
  line-height: 1.5;
  color: #2D1B69;
  margin: 0 0 12px;
  font-weight: 500;
}

.df-quote-author {
  font-size: 14px;
  color: #7C5CFC;
  margin: 0 0 8px;
  font-weight: 600;
}

.df-quote-tagline {
  font-size: 13px;
  color: #999;
  margin: 0;
}
  `);

  function isFeedPage() {
    const p = window.location.pathname;
    return (p === "/" || p === "/feed/") && window.location.search === "";
  }

  function isNotifPage() {
    const p = window.location.pathname;
    return (p === "/" || p === "/feed/") &&
      new URLSearchParams(window.location.search).has("highlightedUpdateUrn");
  }

  function updateFeedPageClass() {
    document.documentElement.classList.toggle("df-linkedin-is-feed",  isFeedPage());
    document.documentElement.classList.toggle("df-linkedin-is-notif", isNotifPage());
  }

  const DEFAULTS = {
    feedEnabled:            true,
    hidePYMK:               true,
    hideNewsSidebar:        true,
    hideStartPost:          false,
    hideMyPages:            false,
    hideFollowPages:        false,
    hideStatsDashboard:     true,
    hideJobRecommendations: false,
    hideLearningRecs:       false,
    hideGroupsWidget:       false,
    hidePremiumUpsell:      true,
    hideProfileViewTeaser:  true,
    hideSearchAppearances:  true,
    hideAIUpsell:           true,
    hideNotificationBadge:  true,
    hideMessagingBadge:     false,
    hideOTWBanners:         false,
    hidePeopleAlsoViewed:   true,
    hideCelebrations:       false,
    hideConnectionCounts:   false,
  };

  // ---------------------------------------------------------------------------
  // CSS class toggles
  // ---------------------------------------------------------------------------

  function applySettings(cfg) {
    const c = Object.assign({}, DEFAULTS, cfg);

    // v1: Feed hiding + quote
    DistractionFree.toggleFeature("df-linkedin-disabled", c.feedEnabled);
    if (c.feedEnabled) {
      tryInjectQuote();
      startFeedClamp();
    } else {
      DistractionFree.removeAllQuotes();
      stopFeedClamp();
    }

    // B1: PYMK sidebar
    DistractionFree.toggleFeature("df-linkedin-hide-pymk-disabled",               c.hidePYMK);
    // B2: LinkedIn News sidebar
    DistractionFree.toggleFeature("df-linkedin-hide-news-sidebar-disabled",       c.hideNewsSidebar);
    // B2b: Start a post composer
    DistractionFree.toggleFeature("df-linkedin-hide-start-post-disabled",         c.hideStartPost);
    // B2c: My Pages nav item
    DistractionFree.toggleFeature("df-linkedin-hide-my-pages-disabled",           c.hideMyPages);
    // B2d: Promoted Follow suggestions
    DistractionFree.toggleFeature("df-linkedin-hide-follow-pages-disabled",       c.hideFollowPages);
    // B2e: Stats dashboard
    DistractionFree.toggleFeature("df-linkedin-hide-stats-dashboard-disabled",    c.hideStatsDashboard);
    // B3: Job recommendations
    DistractionFree.toggleFeature("df-linkedin-hide-job-recs-disabled",           c.hideJobRecommendations);
    // B4: Learning recommendations
    DistractionFree.toggleFeature("df-linkedin-hide-learning-recs-disabled",      c.hideLearningRecs);
    // B5: Groups & hashtag widgets
    DistractionFree.toggleFeature("df-linkedin-hide-groups-widget-disabled",      c.hideGroupsWidget);

    // C1: Premium upsell banners
    DistractionFree.toggleFeature("df-linkedin-hide-premium-upsell-disabled",     c.hidePremiumUpsell);
    // C2: Profile view teaser
    DistractionFree.toggleFeature("df-linkedin-hide-profile-views-disabled",      c.hideProfileViewTeaser);
    // C3: Search appearance count
    DistractionFree.toggleFeature("df-linkedin-hide-search-appearances-disabled", c.hideSearchAppearances);
    // C4: AI feature upsells
    DistractionFree.toggleFeature("df-linkedin-hide-ai-upsell-disabled",          c.hideAIUpsell);

    // D1: Notification badge
    DistractionFree.toggleFeature("df-linkedin-hide-notif-badge-disabled",        c.hideNotificationBadge);
    // D2: Messaging badge
    DistractionFree.toggleFeature("df-linkedin-hide-msg-badge-disabled",          c.hideMessagingBadge);

    // E1: Open to Work / Hiring banners
    DistractionFree.toggleFeature("df-linkedin-hide-otw-banners-disabled",        c.hideOTWBanners);
    // E2: People Also Viewed
    DistractionFree.toggleFeature("df-linkedin-hide-people-also-viewed-disabled", c.hidePeopleAlsoViewed);
    // E3: Birthdays & Anniversaries
    DistractionFree.toggleFeature("df-linkedin-hide-celebrations-disabled",       c.hideCelebrations);

    // F1: Connection & follower counts
    DistractionFree.toggleFeature("df-linkedin-hide-connection-counts-disabled",  c.hideConnectionCounts);

    tagDynamicElements(c);
  }

  // ---------------------------------------------------------------------------
  // JS-assisted element tagging
  // ---------------------------------------------------------------------------

  /**
   * Find elements by heading text and tag their nearest card ancestor.
   * @param {string} headingText
   * @param {string} dataAttr  - camelCase key for element.dataset
   */
  function tagByHeading(headingText, dataAttr) {
    document.querySelectorAll("h2, h3, .artdeco-card__header, .feed-shared-update-v2__description").forEach(el => {
      if (el.textContent.trim().includes(headingText)) {
        const card = el.closest(".artdeco-card, aside, section");
        if (card) card.dataset[dataAttr] = "true";
      }
    });
  }

  /**
   * Tag the LinkedIn News / Top Stories sidebar widget.
   * LinkedIn now renders the section heading as a <p> element (not h2/h3),
   * so tagByHeading() misses it.  This function searches p/span/h2/h3 elements
   * for the exact heading text and walks up to the nearest stable container.
   */
  function tagNewsSidebar() {
    document.querySelectorAll('p, span, h2, h3').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^(linkedin news|top stories)$/i.test(t) || /^today.s news/i.test(t)) {
        const card = el.closest('[componentkey], .artdeco-card, aside, section');
        if (!card) return;

        // LinkedIn wraps the componentkey element in a [data-display-contents] div,
        // inside a grid container, inside the visible artdeco-card wrapper.
        // Tagging just the componentkey element leaves the outer card's white
        // background + padding visible as a white box.
        // Fix: find the [data-display-contents] ancestor and tag its grandparent,
        // which is the full card wrapper (includes background + padding).
        const wrapper = card.closest('[data-display-contents]');
        const target  = wrapper
          ? (wrapper.parentElement?.parentElement || wrapper.parentElement || card)
          : card;
        target.dataset.dfHideNewsSidebar = 'true';
      }
    });
  }

  /**
   * Tag the "Start a post" composer (first child of mainFeed).
   * CSS rule (B2b) hides it when the toggle is on; same specificity as the
   * existing first-child revert rule but placed later in the stylesheet so it wins.
   */
  function tagComposer() {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed || !mainFeed.children[0]) return;
    const composer = mainFeed.children[0];
    if (!composer.classList.contains('df-quote-container')) {
      composer.dataset.dfHideStartPost = 'true';
    }
  }

  /**
   * Tag the "My Pages" left-sidebar widget section.
   * The widget contains the pages list (with Activity counts) and the
   * "Grow your business faster" footer.  The entire section is wrapped in a
   * [data-display-contents] div (one of ~4 sections in the left sidebar).
   * Tagging that wrapper hides the full section without leaving a white box,
   * because [data-display-contents] has display:contents and no own background.
   */
  function tagMyPages() {
    document.querySelectorAll('p, span, h2, h3').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^my pages(\s*\(\d+\))?$/i.test(t)) {
        // Walk up to the [data-display-contents] section wrapper —
        // this contains the componentkey card plus all its ancestor wrappers
        // up to (but not including) the full left sidebar.
        const section = el.closest('[data-display-contents]');
        if (section) section.dataset.dfHideMyPages = 'true';
      }
    });
  }

  /**
   * Tag the stats dashboard section in the left sidebar
   * (Profile viewers + Post impressions + search appearances summary).
   *
   * The section is identified by the analytics/creator or profile-views anchor,
   * which sits inside a [data-display-contents] wrapper.  Walking 3 levels up
   * from that wrapper reaches the outer section div (one of ~4 sections in the
   * left sidebar card, h≈125, sibs≈4).  Hiding that div removes the entire
   * stats block cleanly.
   */
  function tagStatsDashboard() {
    const anchor = document.querySelector(
      'a[href*="/analytics/creator/content"], a[href*="profile-views"]'
    );
    if (!anchor) return;
    const wrapper = anchor.closest('[data-display-contents]');
    if (!wrapper) return;
    const section = wrapper.parentElement?.parentElement?.parentElement;
    if (section) section.dataset.dfHideStatsDashboard = 'true';
  }

  /**
   * Tag promoted "Follow" suggestion cards embedded in the feed.
   *
   * Strategy A: Regular suggestion cards — find mainFeed direct children that
   * contain a button with text "Follow".
   *
   * Strategy B: Promoted/sponsored cards — LinkedIn renders a "Promoted" badge
   * as a <p> with text "Promoted".  The Follow button inside those cards has
   * an aria-label="Follow …" but its textContent may be empty (icon-only button),
   * so Strategy A misses them.  We detect the "Promoted" badge and check that
   * the card contains a Follow-type button before tagging.
   */
  function tagFollowPages() {
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (!mainFeed) return;
    const seen = new WeakSet();

    // Helper: walk up from el to mainFeed's direct child
    function feedChild(el) {
      let node = el;
      while (node && node.parentElement !== mainFeed) node = node.parentElement;
      return (node && node !== mainFeed) ? node : null;
    }

    // Strategy A: regular suggestion cards via Follow button text
    mainFeed.querySelectorAll('button').forEach(btn => {
      if ((btn.textContent || '').trim() !== 'Follow') return;
      const child = feedChild(btn);
      if (!child || seen.has(child)) return;
      if (child.classList.contains('df-quote-container')) return;
      seen.add(child);
      child.dataset.dfHideFollowPages = 'true';
    });

    // Strategy B: promoted / sponsored cards ("Promoted" badge in the feed).
    // These are company follow-ad cards injected by LinkedIn.  Their Follow
    // button often has no aria-label (only visible text inside spans), so we
    // can't rely on aria-label selectors.  Instead we check that the card
    // contains a <button> AND the word "Follow" appears in the card's text.
    mainFeed.querySelectorAll('p, span').forEach(el => {
      if ((el.textContent || '').trim() !== 'Promoted') return;
      const child = feedChild(el);
      if (!child || seen.has(child)) return;
      if (child.classList.contains('df-quote-container')) return;
      // Only tag if the promoted card contains a button and mentions "Follow"
      if (!child.querySelector('button') || !(child.textContent || '').includes('Follow')) return;
      seen.add(child);
      child.dataset.dfHideFollowPages = 'true';
    });

    // Strategy C: promoted Follow cards in the RIGHT SIDEBAR (outside mainFeed).
    // LinkedIn occasionally renders a native "Follow us" company card in the top
    // slot of the right rail.  Because the ad rotates in/out, we search the
    // whole document for "Promoted" text that is outside mainFeed and walk up
    // to the nearest componentkey card.
    document.querySelectorAll('p, span').forEach(el => {
      if ((el.textContent || '').trim() !== 'Promoted') return;
      if (mainFeed && mainFeed.contains(el)) return; // already handled above
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      const card = el.closest('[componentkey], .artdeco-card') || el.parentElement;
      if (!card || seen.has(card)) return;
      if (!(card.textContent || '').includes('Follow')) return;
      seen.add(card);
      card.dataset.dfHideFollowPages = 'true';
    });
  }

  /** Tag profile connection/follower count sections by text content. */
  function tagConnectionCounts() {
    document.querySelectorAll("span, a").forEach(el => {
      const text = el.textContent.trim();
      if (/\d[\d,]*\s+(connections|followers)/i.test(text)) {
        const card = el.closest(".artdeco-card, section, li");
        if (card && !card.dataset.dfHideConnectionCounts) {
          card.dataset.dfHideConnectionCounts = "true";
        }
      }
    });
  }

  /**
   * Run all JS-assisted tagging passes.
   * Called on init, every DOM mutation, and every SPA navigation.
   */
  function tagDynamicElements(cfg) {
    const path = window.location.pathname;
    const isFeed    = path === "/feed/" || path === "/";
    const isProfile = path.startsWith("/in/");

    if (isFeed) {
      // B1: PYMK
      tagByHeading("People you may know", "dfHidePymk");
      tagByHeading("Grow your network",   "dfHidePymk");
      // B2: LinkedIn News / Top Stories sidebar
      tagNewsSidebar();
      // B2b: Start a post composer
      tagComposer();
      // B2c: My Pages nav item
      tagMyPages();
      // B2d: Promoted Follow suggestions
      tagFollowPages();
      // B2e: Stats dashboard
      tagStatsDashboard();
      // B3: Job recommendations
      tagByHeading("Jobs you may be interested in", "dfHideJobRecs");
      tagByHeading("Recommended jobs for you",      "dfHideJobRecs");
      // B4: Learning recommendations
      tagByHeading("Learning for you",   "dfHideLearningRecs");
      tagByHeading("Suggested courses",  "dfHideLearningRecs");
      // B5: Groups & hashtags
      tagByHeading("Groups",            "dfHideGroups");
      tagByHeading("Followed Hashtags", "dfHideGroups");
      tagByHeading("Pages",             "dfHideGroups");
    }

    // C4: AI upsells (global — appear on feed and profile pages)
    tagByHeading("Collaborative article", "dfHideAiUpsell");
    tagByHeading("Write with AI",         "dfHideAiUpsell");

    if (isProfile) {
      // E2: People Also Viewed
      tagByHeading("People also viewed", "dfHidePeopleAlsoViewed");
      // E3: Celebrations
      tagByHeading("Celebrations", "dfHideCelebrations");
      // F1: Connection & follower counts
      tagConnectionCounts();
    }
  }

  // ---------------------------------------------------------------------------
  // Immediate feed clamping (non-debounced)
  // ---------------------------------------------------------------------------

  // Last URL seen by the fast tag observer — parallel to _lastSeenUrl.
  let _sidebarTagged       = false;
  let _composerTagged      = false;
  let _myPagesTagged       = false;
  let _statsDashboardTagged = false;
  let _sidebarTagUrl       = '';

  // Last URL seen by clampFeed — used to detect SPA navigations.
  // detectSPANavigation wraps history.pushState in the extension's isolated
  // world, which does NOT intercept the page's own pushState calls (they run
  // in the main world).  Tracking the URL here makes clampFeed() self-healing:
  // the next DOM mutation after any navigation fires this check for free.
  let _lastSeenUrl = '';

  /**
   * Handles elements that CSS cannot cover alone.
   *
   * Also acts as the SPA-navigation detector: checks window.location.href on
   * every call and, if the URL has changed, syncs the CSS page-class and
   * removes any stale quote so it can be re-injected for the new context.
   *
   * Feed page (/feed/, no params):
   *   - Injects the motivational quote with zero debounce
   *   - Hides the "Load more" button by text match (no data-view-name)
   *
   * Notification page (/feed/?highlightedUpdateUrn=...):
   *   - Tags the first post wrapper with df-highlighted-post (CSS shows it)
   *   - Injects the motivational quote below the highlighted post
   *   - Hides the "Load more" button to prevent loading more feed posts
   */
  function clampFeed() {
    // Sync CSS page-class with actual URL on every DOM mutation.
    // This catches SPA navigations that bypass detectSPANavigation.
    const currentUrl = window.location.href;
    if (currentUrl !== _lastSeenUrl) {
      _lastSeenUrl = currentUrl;
      updateFeedPageClass();
      DistractionFree.removeAllQuotes();
    }

    const onFeed  = isFeedPage();
    const onNotif = isNotifPage();
    if (!onFeed && !onNotif) return;

    const mainFeed = document.querySelector("[data-testid='mainFeed']");

    // Hide "Load more" on both feed and notification pages
    if (mainFeed) {
      mainFeed.querySelectorAll("button").forEach(btn => {
        if ((btn.textContent || "").trim().toLowerCase() === "load more") {
          let container = btn;
          while (container.parentElement && container.parentElement !== mainFeed) {
            container = container.parentElement;
          }
          if (container !== mainFeed && container.style.display !== "none") {
            container.style.display = "none";
          }
        }
      });
    }

    if (onFeed) {
      tryInjectQuote();
      return;
    }

    // Notification page: tag the first post wrapper as df-highlighted-post so
    // CSS can show it while hiding the rest.  Must tag before tryInjectQuote()
    // so the quote insertion can find the tagged element.
    if (mainFeed) {
      const posts = [...mainFeed.children].filter(
        child => child.hasAttribute('data-display-contents') &&
                 child.hasAttribute('data-view-tracking-scope')
      );
      posts.forEach((child, i) => {
        if (i === 0) child.classList.add('df-highlighted-post');
        else         child.classList.remove('df-highlighted-post');
      });
    }
    tryInjectQuote();
  }

  let feedClampObserver = null;

  function startFeedClamp() {
    if (feedClampObserver) return;
    clampFeed(); // run once immediately in case elements already exist
    feedClampObserver = new MutationObserver(clampFeed);
    feedClampObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopFeedClamp() {
    if (!feedClampObserver) return;
    feedClampObserver.disconnect();
    feedClampObserver = null;
    const mainFeed = document.querySelector("[data-testid='mainFeed']");
    if (mainFeed) {
      // Clear load more button inline hide
      mainFeed.querySelectorAll("button").forEach(btn => {
        if ((btn.textContent || "").trim().toLowerCase() === "load more") {
          let container = btn;
          while (container.parentElement && container.parentElement !== mainFeed) {
            container = container.parentElement;
          }
          if (container !== mainFeed) container.style.display = "";
        }
      });
      // Clear df-highlighted-post tag applied by notification-page handling
      mainFeed.querySelectorAll('.df-highlighted-post').forEach(el => {
        el.classList.remove('df-highlighted-post');
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Quote injection
  // ---------------------------------------------------------------------------

  function tryInjectQuote() {
    if (!isFeedPage() && !isNotifPage()) return;
    if (document.querySelector(".df-quote-container")) return;
    const feedContainer = document.querySelector("[data-testid='mainFeed']");
    if (!feedContainer) return;
    const el = DistractionFree.createQuoteElement(feedContainer);
    if (!el) return;

    if (isFeedPage()) {
      // Insert after the first child (composer) so the quote appears between
      // the "Start a post" box and the hidden feed posts.
      const composer = feedContainer.children[0];
      if (composer) {
        composer.insertAdjacentElement('afterend', el);
      } else {
        feedContainer.appendChild(el);
      }
    } else {
      // Notification page: insert after the highlighted post.
      // clampFeed() tags the first post with df-highlighted-post before calling
      // tryInjectQuote(), so we can reliably find it here.
      const highlightedPost = feedContainer.querySelector(':scope > .df-highlighted-post');
      if (highlightedPost) {
        highlightedPost.insertAdjacentElement('afterend', el);
      } else {
        feedContainer.appendChild(el);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    // Set feed-page class immediately so CSS rules activate on the right pages.
    updateFeedPageClass();

    // Pre-apply settings synchronously from sessionStorage cache so CSS classes
    // are set BEFORE any DOM element is rendered (zero-flash for all toggles).
    // On first load the cache is empty and defaults apply; on subsequent loads
    // the cached user settings are applied at document_start, before any paint.
    const cached = DistractionFree.getSettingsSync();
    if (cached) applySettings(cached[SITE] || {});

    // Non-debounced sidebar tag observer.
    // The 300ms debounce in observeDOM causes a visible flash: the LinkedIn News
    // card renders, the user sees it, then 300ms later JS hides it.
    // This observer fires on every DOM mutation with ZERO debounce, tagging the
    // news sidebar the moment its heading appears — before the browser paints.
    // The _sidebarTagged guard makes post-tagging iterations O(1).
    new MutationObserver((mutations) => {
      const url = window.location.href;
      if (url !== _sidebarTagUrl) {
        _sidebarTagUrl        = url;
        _sidebarTagged        = false;
        _composerTagged       = false;
        _myPagesTagged        = false;
        _statsDashboardTagged = false;
      }
      if (!isFeedPage()) return;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          if (!_sidebarTagged) {
            tagNewsSidebar();
            _sidebarTagged = !!document.querySelector('[data-df-hide-news-sidebar="true"]');
          }
          if (!_composerTagged) {
            tagComposer();
            _composerTagged = !!document.querySelector('[data-df-hide-start-post="true"]');
          }
          if (!_myPagesTagged) {
            tagMyPages();
            _myPagesTagged = !!document.querySelector('[data-df-hide-my-pages="true"]');
          }
          if (!_statsDashboardTagged) {
            tagStatsDashboard();
            _statsDashboardTagged = !!document.querySelector('[data-df-hide-stats-dashboard="true"]');
          }
          break;
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    tagNewsSidebar(); // immediate first runs before any mutations fire
    tagComposer();
    tagMyPages();
    tagStatsDashboard();

    // Start clamping immediately — don't wait for the async storage read.
    // Default is feedEnabled:true, so clamp right away and stop only if
    // settings come back with feedEnabled:false.
    startFeedClamp();

    DistractionFree.getSettings((settings) => {
      applySettings(settings[SITE] || {});
    });

    DistractionFree.onSettingsChanged(SITE, applySettings);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryInjectQuote);
    } else {
      tryInjectQuote();
    }

    DistractionFree.observeDOM(() => {
      DistractionFree.getSettings((settings) => {
        const cfg = settings[SITE] || {};
        const c   = Object.assign({}, DEFAULTS, cfg);
        if (c.feedEnabled) tryInjectQuote();
        tagDynamicElements(c);
      });
    });

    DistractionFree.detectSPANavigation(() => {
      updateFeedPageClass();
      DistractionFree.removeAllQuotes();
      DistractionFree.getSettings((settings) => {
        applySettings(settings[SITE] || {});
      });
    });
  }

  init();
})();
