/**
 * DistractionFree — Block page script
 * Shows which site/category was blocked, displays a motivational quote,
 * and provides a Go Back button.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get("domain");
  const category = params.get("cat");

  // Display the blocked domain or category
  const domainEl = document.getElementById("blocked-domain");
  if (domain) {
    domainEl.textContent = domain;
  } else if (category) {
    const labels = {
      socialMedia: "Social Media",
      news: "News",
      entertainment: "Entertainment",
      gaming: "Gaming",
      shopping: "Shopping"
    };
    domainEl.textContent = labels[category] || category;
  }

  // Pick a random quote
  if (typeof DF_QUOTES !== "undefined" && DF_QUOTES.length > 0) {
    const quote = DF_QUOTES[Math.floor(Math.random() * DF_QUOTES.length)];
    document.getElementById("quote-text").textContent =
      "\u201C" + quote.text + "\u201D";
    document.getElementById("quote-author").textContent =
      "\u2014 " + quote.author;
  }

  // Go Back button
  document.getElementById("go-back-btn").addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "chrome://newtab";
    }
  });
})();
