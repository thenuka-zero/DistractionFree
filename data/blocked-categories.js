/**
 * DistractionFree — Blocked site category lists (top ~100 per category)
 * The 6 feed-blocking sites (LinkedIn, Reddit, YouTube, Facebook, Instagram, Twitter/X)
 * are deliberately excluded to avoid confusion with the feed-blocking feature.
 */

/* eslint-disable */
const BLOCKED_CATEGORIES = {

  // ── SOCIAL MEDIA (100) ──
  socialMedia: [
    "tiktok.com","snapchat.com","pinterest.com","tumblr.com","discord.com",
    "threads.net","bsky.app","mastodon.social","mastodon.online",
    "telegram.org","web.telegram.org","t.me","whatsapp.com","web.whatsapp.com",
    "signal.org","viber.com","line.me","wechat.com","kakaotalk.com",
    "quora.com","4chan.org","news.ycombinator.com","slashdot.org",
    "lemmy.world","kbin.social",
    "tinder.com","bumble.com","hinge.co","okcupid.com","match.com",
    "badoo.com","grindr.com","eharmony.com","zoosk.com","pof.com",
    "twitch.tv","kick.com",
    "medium.com","substack.com","wordpress.com","blogger.com","dev.to",
    "vk.com","ok.ru","weibo.com","naver.com","band.us","xing.com",
    "myspace.com","livejournal.com",
    "flickr.com","500px.com","imgur.com","vsco.co","giphy.com",
    "deviantart.com","dribbble.com","behance.net","artstation.com",
    "goodreads.com","letterboxd.com","last.fm","genius.com",
    "nextdoor.com","meetup.com","eventbrite.com",
    "strava.com","myfitnesspal.com",
    "soundcloud.com","bandcamp.com","mixcloud.com",
    "vimeo.com","dailymotion.com","bilibili.com","rumble.com",
    "9gag.com","ifunny.co","knowyourmeme.com","boredpanda.com",
    "fandom.com","myanimelist.net","anilist.co",
    "omegle.com","chatroulette.com",
    "clubhouse.com","producthunt.com","indiehackers.com",
    "researchgate.net","academia.edu",
    "linktree.com","beacons.ai",
    "craigslist.org","offerup.com","poshmark.com","depop.com",
    "stocktwits.com","tradingview.com",
    "change.org","avaaz.org",
    "discord.gg","guilded.gg","element.io","slack.com",
    "github.com","gitlab.com"
  ],

  // ── NEWS (100) ──
  news: [
    // US networks & cable
    "cnn.com","foxnews.com","msnbc.com","nbcnews.com","abcnews.go.com",
    "cbsnews.com","pbs.org","npr.org","newsmax.com",
    // US newspapers
    "nytimes.com","washingtonpost.com","usatoday.com","wsj.com",
    "latimes.com","chicagotribune.com","nypost.com","bostonglobe.com",
    "sfchronicle.com","dallasnews.com","denverpost.com","seattletimes.com",
    "miamiherald.com","startribune.com","inquirer.com","azcentral.com",
    // Wire services
    "reuters.com","apnews.com",
    // UK & Ireland
    "bbc.com","bbc.co.uk","theguardian.com","dailymail.co.uk",
    "telegraph.co.uk","independent.co.uk","sky.com","mirror.co.uk",
    // International
    "aljazeera.com","scmp.com","straitstimes.com","abc.net.au",
    "smh.com.au","cbc.ca","globalnews.ca","thestar.com",
    "spiegel.de","lemonde.fr","elpais.com","corriere.it",
    "hindustantimes.com","ndtv.com","timesofindia.indiatimes.com",
    // News aggregators
    "news.google.com","news.yahoo.com","flipboard.com","smartnews.com",
    // Business & finance
    "bloomberg.com","cnbc.com","fortune.com","forbes.com","ft.com",
    "economist.com","marketwatch.com","businessinsider.com",
    // Tech news
    "techcrunch.com","theverge.com","wired.com","arstechnica.com",
    "engadget.com","cnet.com","zdnet.com","mashable.com",
    // Political & opinion
    "politico.com","thehill.com","vox.com","slate.com",
    "thedailybeast.com","theintercept.com","propublica.org",
    "breitbart.com","dailywire.com",
    // Magazines & long-form
    "time.com","newyorker.com","theatlantic.com","vanityfair.com",
    "rollingstone.com","people.com",
    // Science & health
    "scientificamerican.com","nature.com","sciencedaily.com",
    "statnews.com","livescience.com",
    // Fact-checking
    "snopes.com","politifact.com","factcheck.org",
    // Sports news
    "espn.com","bleacherreport.com","theathletic.com","cbssports.com",
    // Weather
    "weather.com","accuweather.com",
    // Entertainment news
    "hollywoodreporter.com","variety.com","deadline.com","tmz.com",
    "eonline.com","buzzfeed.com","huffpost.com"
  ],

  // ── ENTERTAINMENT (100) ──
  entertainment: [
    // Streaming video
    "netflix.com","hulu.com","disneyplus.com","max.com","hbomax.com",
    "peacocktv.com","paramountplus.com","discoveryplus.com",
    "primevideo.com","appletv.apple.com","crunchyroll.com","funimation.com",
    "britbox.com","curiositystream.com","mubi.com","tubitv.com",
    "pluto.tv","roku.com","sling.com","fubo.tv","philo.com",
    // Music streaming
    "spotify.com","music.apple.com","tidal.com","deezer.com",
    "pandora.com","iheartradio.com","soundcloud.com","bandcamp.com",
    // Live streaming
    "twitch.tv","kick.com",
    // Video platforms
    "vimeo.com","dailymotion.com","rumble.com","odysee.com","bitchute.com",
    // Movies & TV info
    "imdb.com","rottentomatoes.com","metacritic.com","letterboxd.com",
    "justwatch.com","tvguide.com",
    // Entertainment news
    "tmz.com","eonline.com","people.com","usmagazine.com",
    "hollywoodreporter.com","variety.com","deadline.com","indiewire.com",
    "screenrant.com","collider.com","vulture.com","avclub.com",
    // Comics & animation
    "marvel.com","dc.com","webtoons.com","webtoon.com",
    "myanimelist.net","anilist.co","mangadex.org",
    // Podcasts
    "podcasts.apple.com","pocketcasts.com","overcast.fm","stitcher.com",
    // Books & reading
    "goodreads.com","audible.com","scribd.com","wattpad.com",
    "archiveofourown.org","fanfiction.net",
    // Humor & viral
    "9gag.com","theonion.com","cracked.com","boredpanda.com","buzzfeed.com",
    // Radio
    "iheartradio.com","tunein.com",
    // Events & tickets
    "ticketmaster.com","stubhub.com","seatgeek.com","livenation.com",
    "eventbrite.com",
    // Arts & culture
    "artsy.net","dezeen.com","archdaily.com",
    // Fashion & beauty
    "vogue.com","cosmopolitan.com","elle.com","refinery29.com",
    "hypebeast.com","complex.com",
    // Food
    "allrecipes.com","epicurious.com","bonappetit.com","seriouseats.com",
    "food52.com","eater.com","tasty.co","delish.com",
    // Travel
    "tripadvisor.com","lonelyplanet.com","thepointsguy.com",
    // Home & lifestyle
    "architecturaldigest.com","houzz.com","hgtv.com","apartmenttherapy.com"
  ],

  // ── GAMING (100) ──
  gaming: [
    // Storefronts & launchers
    "store.steampowered.com","steampowered.com","steamcommunity.com",
    "epicgames.com","gog.com","humblebundle.com","fanatical.com",
    "greenmangaming.com","g2a.com","kinguin.net","eneba.com",
    "itch.io","gamejolt.com",
    // Console platforms
    "xbox.com","playstation.com","store.playstation.com",
    "nintendo.com",
    // Publishers
    "ea.com","ubisoft.com","activision.com","blizzard.com",
    "bethesda.net","square-enix.com","bandainamcoent.com",
    "capcom.com","konami.com","sega.com","riotgames.com",
    "rockstargames.com","bungie.net","valvesoftware.com",
    "cdprojektred.com",
    // Gaming news & media
    "ign.com","kotaku.com","gamespot.com","polygon.com",
    "pcgamer.com","rockpapershotgun.com","eurogamer.net",
    "gamesradar.com","destructoid.com","dualshockers.com",
    "pushsquare.com","nintendolife.com","toucharcade.com",
    "thegamer.com","dexerto.com","dotesports.com",
    // Game databases & wikis
    "howlongtobeat.com","rawg.io","giantbomb.com",
    "pcgamingwiki.com","fandom.com","gamefaqs.gamespot.com",
    // Esports
    "lolesports.com","hltv.org","liquipedia.net","faceit.com",
    "esea.net","vlr.gg","op.gg","u.gg","blitz.gg","mobalytics.gg",
    "dotabuff.com","tracker.gg",
    // Online games / MMOs
    "leagueoflegends.com","playvalorant.com",
    "worldofwarcraft.blizzard.com","finalfantasyxiv.com",
    "guildwars2.com","runescape.com","oldschool.runescape.com",
    "warframe.com","pathofexile.com","destinythegame.com",
    "fortnite.com","apexlegends.com",
    // Roblox & sandbox
    "roblox.com","minecraft.net",
    // Modding
    "nexusmods.com","moddb.com","curseforge.com","modrinth.com",
    // Board & tabletop
    "boardgamegeek.com","dndbeyond.com","roll20.net",
    "chess.com","lichess.org",
    // Browser games
    "poki.com","crazygames.com","coolmathgames.com",
    "miniclip.com","kongregate.com",
    // Game deals
    "isthereanydeal.com","gg.deals","steamdb.info","cheapshark.com",
    // Gaming hardware
    "razer.com","steelseries.com","corsair.com","logitechg.com",
    "pcpartpicker.com",
    // Game development
    "unity.com","unrealengine.com","godotengine.org","gamedev.net"
  ],

  // ── SHOPPING (100) ──
  shopping: [
    // Mega marketplaces
    "amazon.com","ebay.com","aliexpress.com","etsy.com","wish.com",
    "shein.com","temu.com","alibaba.com","mercadolibre.com",
    "flipkart.com","rakuten.com",
    // US big-box & department
    "walmart.com","target.com","costco.com","samsclub.com","kohls.com",
    "macys.com","nordstrom.com","nordstromrack.com","bloomingdales.com",
    "jcpenney.com","neimanmarcus.com","saksfifthavenue.com",
    // Electronics
    "bestbuy.com","newegg.com","bhphotovideo.com","apple.com",
    "dell.com","samsung.com",
    // Fashion
    "zara.com","hm.com","uniqlo.com","gap.com","asos.com",
    "boohoo.com","prettylittlething.com","fashionnova.com",
    "forever21.com","revolve.com","lulus.com",
    // Luxury
    "gucci.com","louisvuitton.com","prada.com","net-a-porter.com",
    "farfetch.com","ssense.com","mytheresa.com",
    // Sneakers & streetwear
    "nike.com","adidas.com","newbalance.com","stockx.com","goat.com",
    "footlocker.com","finishline.com",
    // Beauty
    "sephora.com","ulta.com","glossier.com",
    // Home & furniture
    "wayfair.com","overstock.com","ikea.com","crateandbarrel.com",
    "potterybarn.com","westelm.com",
    // Home improvement
    "homedepot.com","lowes.com",
    // Groceries
    "instacart.com","freshdirect.com","thrivemarket.com",
    // Pet
    "chewy.com","petco.com","petsmart.com",
    // Sporting goods
    "dickssportinggoods.com","rei.com","backcountry.com",
    // Outdoor & active
    "patagonia.com","lululemon.com","gymshark.com",
    // Auto parts
    "autozone.com","rockauto.com",
    // Office
    "staples.com","officedepot.com",
    // Secondhand & resale
    "poshmark.com","depop.com","mercari.com","threadup.com",
    "therealreal.com","vinted.com","backmarket.com","swappa.com",
    // Deals & coupons
    "slickdeals.net","retailmenot.com","groupon.com","honey.com",
    "rakuten.com","camelcamelcamel.com",
    // Flowers & gifts
    "1800flowers.com",
    // Jewelry
    "tiffany.com","bluenile.com","brilliantearth.com","mejuri.com",
    // International
    "argos.co.uk","johnlewis.com","zalando.com","otto.de","coolblue.nl",
    "bol.com"
  ]
};
