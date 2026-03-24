/* ═══════════════════════════════════════════════════════════════════
   Aria — Browser Controller (Chrome APIs)
   Tab management, navigation, screenshots, window control
   ═══════════════════════════════════════════════════════════════════ */
import { MSG_TYPES } from '../shared/constants.js';

// ── Well-Known Sites (instant resolve — no search needed) ──────
const KNOWN_SITES = {
  // ─── Google Services ───
  'google':            'https://www.google.com',
  'gmail':             'https://mail.google.com',
  'google mail':       'https://mail.google.com',
  'youtube':           'https://www.youtube.com',
  'google maps':       'https://maps.google.com',
  'maps':              'https://maps.google.com',
  'google drive':      'https://drive.google.com',
  'drive':             'https://drive.google.com',
  'google docs':       'https://docs.google.com',
  'google sheets':     'https://sheets.google.com',
  'google slides':     'https://slides.google.com',
  'google calendar':   'https://calendar.google.com',
  'google photos':     'https://photos.google.com',
  'google translate':  'https://translate.google.com',
  'google news':       'https://news.google.com',
  'google scholar':    'https://scholar.google.com',
  'google earth':      'https://earth.google.com',
  'google meet':       'https://meet.google.com',
  'google chat':       'https://chat.google.com',
  'google keep':       'https://keep.google.com',
  'google flights':    'https://www.google.com/flights',
  'google finance':    'https://www.google.com/finance',
  'google books':      'https://books.google.com',
  'google classroom':  'https://classroom.google.com',
  'google forms':      'https://docs.google.com/forms',
  'google play':       'https://play.google.com',
  'google ads':        'https://ads.google.com',
  'google analytics':  'https://analytics.google.com',
  'google search console': 'https://search.google.com/search-console',
  'google cloud':      'https://console.cloud.google.com',
  'google colab':      'https://colab.research.google.com',
  'google lens':       'https://lens.google.com',

  // ─── Social Media ───
  'facebook':          'https://www.facebook.com',
  'fb':                'https://www.facebook.com',
  'instagram':         'https://www.instagram.com',
  'insta':             'https://www.instagram.com',
  'twitter':           'https://twitter.com',
  'x':                 'https://x.com',
  'tiktok':            'https://www.tiktok.com',
  'snapchat':          'https://www.snapchat.com',
  'linkedin':          'https://www.linkedin.com',
  'pinterest':         'https://www.pinterest.com',
  'reddit':            'https://www.reddit.com',
  'tumblr':            'https://www.tumblr.com',
  'threads':           'https://www.threads.net',
  'bluesky':           'https://bsky.app',
  'mastodon':          'https://mastodon.social',
  'quora':             'https://www.quora.com',

  // ─── Messaging & Communication ───
  'whatsapp':          'https://web.whatsapp.com',
  'telegram':          'https://web.telegram.org',
  'discord':           'https://discord.com/app',
  'slack':             'https://app.slack.com',
  'signal':            'https://signal.org',
  'zoom':              'https://zoom.us',
  'skype':             'https://web.skype.com',
  'microsoft teams':   'https://teams.microsoft.com',
  'teams':             'https://teams.microsoft.com',
  'messenger':         'https://www.messenger.com',
  'facebook messenger':'https://www.messenger.com',

  // ─── Email ───
  'outlook':           'https://outlook.live.com',
  'hotmail':           'https://outlook.live.com',
  'yahoo mail':        'https://mail.yahoo.com',
  'protonmail':        'https://mail.proton.me',
  'proton mail':       'https://mail.proton.me',
  'icloud mail':       'https://www.icloud.com/mail',
  'zoho mail':         'https://mail.zoho.com',
  'aol mail':          'https://mail.aol.com',
  'fastmail':          'https://www.fastmail.com',
  'tutanota':          'https://app.tuta.com',

  // ─── Video & Streaming ───
  'netflix':           'https://www.netflix.com',
  'hulu':              'https://www.hulu.com',
  'disney plus':       'https://www.disneyplus.com',
  'disney+':           'https://www.disneyplus.com',
  'amazon prime':      'https://www.amazon.com/gp/video/storefront',
  'prime video':       'https://www.amazon.com/gp/video/storefront',
  'hbo max':           'https://www.max.com',
  'max':               'https://www.max.com',
  'peacock':           'https://www.peacocktv.com',
  'paramount plus':    'https://www.paramountplus.com',
  'paramount+':        'https://www.paramountplus.com',
  'apple tv':          'https://tv.apple.com',
  'crunchyroll':       'https://www.crunchyroll.com',
  'vimeo':             'https://vimeo.com',
  'dailymotion':       'https://www.dailymotion.com',
  'twitch':            'https://www.twitch.tv',
  'plex':              'https://app.plex.tv',
  'pluto tv':          'https://pluto.tv',
  'tubi':              'https://tubitv.com',

  // ─── Music & Audio ───
  'spotify':           'https://open.spotify.com',
  'apple music':       'https://music.apple.com',
  'soundcloud':        'https://soundcloud.com',
  'pandora':           'https://www.pandora.com',
  'deezer':            'https://www.deezer.com',
  'tidal':             'https://tidal.com',
  'audible':           'https://www.audible.com',
  'bandcamp':          'https://bandcamp.com',
  'youtube music':     'https://music.youtube.com',

  // ─── Shopping ───
  'amazon':            'https://www.amazon.com',
  'ebay':              'https://www.ebay.com',
  'walmart':           'https://www.walmart.com',
  'target':            'https://www.target.com',
  'etsy':              'https://www.etsy.com',
  'aliexpress':        'https://www.aliexpress.com',
  'alibaba':           'https://www.alibaba.com',
  'best buy':          'https://www.bestbuy.com',
  'bestbuy':           'https://www.bestbuy.com',
  'costco':            'https://www.costco.com',
  'ikea':              'https://www.ikea.com',
  'home depot':        'https://www.homedepot.com',
  'lowes':             'https://www.lowes.com',
  "lowe's":            'https://www.lowes.com',
  'wayfair':           'https://www.wayfair.com',
  'zappos':            'https://www.zappos.com',
  'nordstrom':         'https://www.nordstrom.com',
  'macys':             'https://www.macys.com',
  "macy's":            'https://www.macys.com',
  'newegg':            'https://www.newegg.com',
  'shein':             'https://www.shein.com',
  'asos':              'https://www.asos.com',
  'zara':              'https://www.zara.com',
  'h&m':               'https://www.hm.com',
  'uniqlo':            'https://www.uniqlo.com',
  'nike':              'https://www.nike.com',
  'adidas':            'https://www.adidas.com',
  'wish':              'https://www.wish.com',
  'shopify':           'https://www.shopify.com',
  'temu':              'https://www.temu.com',
  'overstock':         'https://www.overstock.com',
  'sephora':           'https://www.sephora.com',
  'ulta':              'https://www.ulta.com',
  'chewy':             'https://www.chewy.com',
  'gamestop':          'https://www.gamestop.com',
  'b&h':               'https://www.bhphotovideo.com',
  'b&h photo':         'https://www.bhphotovideo.com',

  // ─── NZ / AU Sites ───
  'trade me':          'https://www.trademe.co.nz',
  'trademe':           'https://www.trademe.co.nz',
  'mighty ape':        'https://www.mightyape.co.nz',
  'mightyape':         'https://www.mightyape.co.nz',
  'noel leeming':      'https://www.noelleeming.co.nz',
  'pb tech':           'https://www.pbtech.co.nz',
  'pbtech':            'https://www.pbtech.co.nz',
  'the warehouse':     'https://www.thewarehouse.co.nz',
  'warehouse':         'https://www.thewarehouse.co.nz',
  'countdown':         'https://www.countdown.co.nz',
  'pak n save':        'https://www.paknsave.co.nz',
  'paknsave':          'https://www.paknsave.co.nz',
  'new world':         'https://www.newworld.co.nz',
  'bunnings':          'https://www.bunnings.co.nz',
  'farmers':           'https://www.farmers.co.nz',
  'kmart':             'https://www.kmart.co.nz',
  'briscoes':          'https://www.briscoes.co.nz',
  'mitre 10':          'https://www.mitre10.co.nz',
  'stuff':             'https://www.stuff.co.nz',
  'nz herald':         'https://www.nzherald.co.nz',
  'seek nz':           'https://www.seek.co.nz',
  'trademe jobs':      'https://www.trademe.co.nz/a/jobs',
  'air new zealand':   'https://www.airnewzealand.co.nz',
  'air nz':            'https://www.airnewzealand.co.nz',
  'anz':               'https://www.anz.co.nz',
  'westpac':           'https://www.westpac.co.nz',
  'kiwibank':          'https://www.kiwibank.co.nz',
  'bnz':               'https://www.bnz.co.nz',
  'asb':               'https://www.asb.co.nz',

  // ─── News & Media ───
  'yahoo':             'https://www.yahoo.com',
  'bbc':               'https://www.bbc.com',
  'bbc news':          'https://www.bbc.com/news',
  'cnn':               'https://www.cnn.com',
  'fox news':          'https://www.foxnews.com',
  'nbc news':          'https://www.nbcnews.com',
  'msnbc':             'https://www.msnbc.com',
  'abc news':          'https://abcnews.go.com',
  'reuters':           'https://www.reuters.com',
  'associated press':  'https://apnews.com',
  'ap news':           'https://apnews.com',
  'the guardian':      'https://www.theguardian.com',
  'new york times':    'https://www.nytimes.com',
  'nyt':               'https://www.nytimes.com',
  'washington post':   'https://www.washingtonpost.com',
  'wsj':               'https://www.wsj.com',
  'wall street journal':'https://www.wsj.com',
  'bloomberg':         'https://www.bloomberg.com',
  'forbes':            'https://www.forbes.com',
  'cnbc':              'https://www.cnbc.com',
  'techcrunch':        'https://techcrunch.com',
  'the verge':         'https://www.theverge.com',
  'wired':             'https://www.wired.com',
  'ars technica':      'https://arstechnica.com',
  'engadget':          'https://www.engadget.com',
  'mashable':          'https://mashable.com',
  'vice':              'https://www.vice.com',
  'buzzfeed':          'https://www.buzzfeed.com',
  'huffpost':          'https://www.huffpost.com',
  'huffington post':   'https://www.huffpost.com',
  'usa today':         'https://www.usatoday.com',
  'times':             'https://www.thetimes.co.uk',
  'daily mail':        'https://www.dailymail.co.uk',
  'medium':            'https://medium.com',
  'substack':          'https://substack.com',

  // ─── Search Engines ───
  'bing':              'https://www.bing.com',
  'duckduckgo':        'https://duckduckgo.com',
  'ddg':               'https://duckduckgo.com',
  'brave search':      'https://search.brave.com',
  'ecosia':            'https://www.ecosia.org',
  'startpage':         'https://www.startpage.com',
  'yandex':            'https://yandex.com',
  'baidu':             'https://www.baidu.com',

  // ─── Developer / Tech ───
  'github':            'https://github.com',
  'gitlab':            'https://gitlab.com',
  'bitbucket':         'https://bitbucket.org',
  'stack overflow':    'https://stackoverflow.com',
  'stackoverflow':     'https://stackoverflow.com',
  'npm':               'https://www.npmjs.com',
  'pypi':              'https://pypi.org',
  'docker hub':        'https://hub.docker.com',
  'vercel':            'https://vercel.com',
  'netlify':           'https://www.netlify.com',
  'heroku':            'https://www.heroku.com',
  'aws':               'https://aws.amazon.com',
  'azure':             'https://portal.azure.com',
  'firebase':          'https://console.firebase.google.com',
  'digitalocean':      'https://www.digitalocean.com',
  'codepen':           'https://codepen.io',
  'jsfiddle':          'https://jsfiddle.net',
  'codesandbox':       'https://codesandbox.io',
  'replit':            'https://replit.com',
  'leetcode':          'https://leetcode.com',
  'hackerrank':        'https://www.hackerrank.com',
  'codecademy':        'https://www.codecademy.com',
  'freecodecamp':      'https://www.freecodecamp.org',
  'mdn':               'https://developer.mozilla.org',
  'w3schools':         'https://www.w3schools.com',
  'caniuse':           'https://caniuse.com',
  'dev.to':            'https://dev.to',
  'hashnode':          'https://hashnode.com',
  'hacker news':       'https://news.ycombinator.com',
  'hn':                'https://news.ycombinator.com',
  'product hunt':      'https://www.producthunt.com',
  'kaggle':            'https://www.kaggle.com',
  'hugging face':      'https://huggingface.co',
  'huggingface':       'https://huggingface.co',

  // ─── AI Tools ───
  'chatgpt':           'https://chat.openai.com',
  'openai':            'https://chat.openai.com',
  'claude':            'https://claude.ai',
  'anthropic':         'https://claude.ai',
  'bard':              'https://gemini.google.com',
  'gemini':            'https://gemini.google.com',
  'copilot':           'https://copilot.microsoft.com',
  'perplexity':        'https://www.perplexity.ai',
  'midjourney':        'https://www.midjourney.com',
  'dall-e':            'https://labs.openai.com',
  'stable diffusion':  'https://stablediffusionweb.com',
  'character ai':      'https://character.ai',
  'poe':               'https://poe.com',
  'jasper':            'https://www.jasper.ai',
  'copy ai':           'https://www.copy.ai',
  'grammarly':         'https://www.grammarly.com',
  'deepl':             'https://www.deepl.com',
  'you.com':           'https://you.com',

  // ─── Productivity & Tools ───
  'notion':            'https://www.notion.so',
  'trello':            'https://trello.com',
  'asana':             'https://app.asana.com',
  'monday':            'https://monday.com',
  'monday.com':        'https://monday.com',
  'jira':              'https://www.atlassian.com/software/jira',
  'confluence':        'https://www.atlassian.com/software/confluence',
  'todoist':           'https://todoist.com',
  'evernote':          'https://evernote.com',
  'obsidian':          'https://obsidian.md',
  'airtable':          'https://airtable.com',
  'miro':              'https://miro.com',
  'clickup':           'https://clickup.com',
  'basecamp':          'https://basecamp.com',
  'linear':            'https://linear.app',
  'loom':              'https://www.loom.com',
  'calendly':          'https://calendly.com',
  'doodle':            'https://doodle.com',
  'typeform':          'https://www.typeform.com',
  'surveymonkey':      'https://www.surveymonkey.com',

  // ─── Design & Creative ───
  'figma':             'https://www.figma.com',
  'canva':             'https://www.canva.com',
  'adobe':             'https://www.adobe.com',
  'behance':           'https://www.behance.net',
  'dribbble':          'https://dribbble.com',
  'unsplash':          'https://unsplash.com',
  'pexels':            'https://www.pexels.com',
  'pixabay':           'https://pixabay.com',
  'flaticon':          'https://www.flaticon.com',
  'icons8':            'https://icons8.com',
  'coolors':           'https://coolors.co',
  'remove bg':         'https://www.remove.bg',
  'photopea':          'https://www.photopea.com',
  'invision':          'https://www.invisionapp.com',
  'sketch':            'https://www.sketch.com',

  // ─── Cloud Storage ───
  'dropbox':           'https://www.dropbox.com',
  'onedrive':          'https://onedrive.live.com',
  'one drive':         'https://onedrive.live.com',
  'icloud':            'https://www.icloud.com',
  'box':               'https://www.box.com',
  'mega':              'https://mega.nz',
  'google one':        'https://one.google.com',
  'wetransfer':        'https://wetransfer.com',

  // ─── Finance & Banking ───
  'paypal':            'https://www.paypal.com',
  'stripe':            'https://dashboard.stripe.com',
  'venmo':             'https://venmo.com',
  'cash app':          'https://cash.app',
  'wise':              'https://wise.com',
  'transferwise':      'https://wise.com',
  'robinhood':         'https://robinhood.com',
  'coinbase':          'https://www.coinbase.com',
  'binance':           'https://www.binance.com',
  'kraken':            'https://www.kraken.com',
  'etrade':            'https://us.etrade.com',
  'fidelity':          'https://www.fidelity.com',
  'schwab':            'https://www.schwab.com',
  'mint':              'https://mint.intuit.com',
  'ynab':              'https://www.ynab.com',
  'quickbooks':        'https://quickbooks.intuit.com',
  'xe':                'https://www.xe.com',

  // ─── Education & Learning ───
  'wikipedia':         'https://www.wikipedia.org',
  'khan academy':      'https://www.khanacademy.org',
  'coursera':          'https://www.coursera.org',
  'udemy':             'https://www.udemy.com',
  'edx':               'https://www.edx.org',
  'skillshare':        'https://www.skillshare.com',
  'duolingo':          'https://www.duolingo.com',
  'brilliant':         'https://brilliant.org',
  'masterclass':       'https://www.masterclass.com',
  'mit ocw':           'https://ocw.mit.edu',
  'ted':               'https://www.ted.com',
  'ted talks':         'https://www.ted.com',
  'quizlet':           'https://quizlet.com',
  'anki':              'https://apps.ankiweb.net',
  'goodreads':         'https://www.goodreads.com',

  // ─── Travel & Transport ───
  'booking':           'https://www.booking.com',
  'booking.com':       'https://www.booking.com',
  'airbnb':            'https://www.airbnb.com',
  'expedia':           'https://www.expedia.com',
  'tripadvisor':       'https://www.tripadvisor.com',
  'trip advisor':      'https://www.tripadvisor.com',
  'kayak':             'https://www.kayak.com',
  'skyscanner':        'https://www.skyscanner.com',
  'google flights':    'https://www.google.com/flights',
  'uber':              'https://www.uber.com',
  'lyft':              'https://www.lyft.com',
  'vrbo':              'https://www.vrbo.com',
  'hotels.com':        'https://www.hotels.com',
  'flightradar':       'https://www.flightradar24.com',
  'flightradar24':     'https://www.flightradar24.com',

  // ─── Food & Delivery ───
  'doordash':          'https://www.doordash.com',
  'uber eats':         'https://www.ubereats.com',
  'grubhub':           'https://www.grubhub.com',
  'deliveroo':         'https://deliveroo.com',
  'postmates':         'https://postmates.com',
  'instacart':         'https://www.instacart.com',
  'yelp':              'https://www.yelp.com',
  'allrecipes':        'https://www.allrecipes.com',
  'food network':      'https://www.foodnetwork.com',

  // ─── Health & Fitness ───
  'webmd':             'https://www.webmd.com',
  'mayo clinic':       'https://www.mayoclinic.org',
  'healthline':        'https://www.healthline.com',
  'myfitnesspal':      'https://www.myfitnesspal.com',
  'strava':            'https://www.strava.com',
  'peloton':           'https://www.onepeloton.com',
  'fitbit':            'https://www.fitbit.com',
  'nhs':               'https://www.nhs.uk',
  'drugs.com':         'https://www.drugs.com',

  // ─── Gaming ───
  'steam':             'https://store.steampowered.com',
  'epic games':        'https://store.epicgames.com',
  'epic games store':  'https://store.epicgames.com',
  'playstation':       'https://www.playstation.com',
  'xbox':              'https://www.xbox.com',
  'nintendo':          'https://www.nintendo.com',
  'gog':               'https://www.gog.com',
  'itch.io':           'https://itch.io',
  'humble bundle':     'https://www.humblebundle.com',
  'ign':               'https://www.ign.com',
  'gamespot':          'https://www.gamespot.com',
  'roblox':            'https://www.roblox.com',
  'ea':                'https://www.ea.com',

  // ─── Jobs & Career ───
  'indeed':            'https://www.indeed.com',
  'glassdoor':         'https://www.glassdoor.com',
  'monster':           'https://www.monster.com',
  'ziprecruiter':      'https://www.ziprecruiter.com',
  'seek':              'https://www.seek.com.au',
  'upwork':            'https://www.upwork.com',
  'fiverr':            'https://www.fiverr.com',
  'freelancer':        'https://www.freelancer.com',
  'toptal':            'https://www.toptal.com',
  'angel list':        'https://angel.co',
  'wellfound':         'https://wellfound.com',
  'handshake':         'https://joinhandshake.com',

  // ─── Real Estate ───
  'zillow':            'https://www.zillow.com',
  'redfin':            'https://www.redfin.com',
  'realtor':           'https://www.realtor.com',
  'trulia':            'https://www.trulia.com',
  'apartments.com':    'https://www.apartments.com',
  'rightmove':         'https://www.rightmove.co.uk',
  'zoopla':            'https://www.zoopla.co.uk',
  'domain':            'https://www.domain.com.au',
  'realestate.co.nz':  'https://www.realestate.co.nz',
  'homes.co.nz':       'https://homes.co.nz',

  // ─── Microsoft Services ───
  'microsoft':         'https://www.microsoft.com',
  'office':            'https://www.office.com',
  'microsoft 365':     'https://www.office.com',
  'word online':       'https://www.office.com/launch/word',
  'excel online':      'https://www.office.com/launch/excel',
  'powerpoint online': 'https://www.office.com/launch/powerpoint',
  'sharepoint':        'https://www.sharepoint.com',
  'azure devops':      'https://dev.azure.com',
  'visual studio':     'https://visualstudio.microsoft.com',

  // ─── Apple Services ───
  'apple':             'https://www.apple.com',
  'icloud':            'https://www.icloud.com',
  'apple music':       'https://music.apple.com',
  'app store':         'https://www.apple.com/app-store',

  // ─── Utilities & Reference ───
  'speedtest':         'https://www.speedtest.net',
  'fast.com':          'https://fast.com',
  'weather':           'https://weather.com',
  'weather.com':       'https://weather.com',
  'accuweather':       'https://www.accuweather.com',
  'wolfram alpha':     'https://www.wolframalpha.com',
  'wolframalpha':      'https://www.wolframalpha.com',
  'archive.org':       'https://archive.org',
  'wayback machine':   'https://web.archive.org',
  'snopes':            'https://www.snopes.com',
  'imdb':              'https://www.imdb.com',
  'rotten tomatoes':   'https://www.rottentomatoes.com',
  'craigslist':        'https://www.craigslist.org',
  'nextdoor':          'https://nextdoor.com',
  'imgur':             'https://imgur.com',
  'giphy':             'https://giphy.com',
  'bitly':             'https://bitly.com',
  'pastebin':          'https://pastebin.com',
  'virustotal':        'https://www.virustotal.com',
  'haveibeenpwned':    'https://haveibeenpwned.com',
  'temp mail':         'https://temp-mail.org',
  '10 minute mail':    'https://10minutemail.com',
  'convertio':         'https://convertio.co',
  'smallpdf':          'https://smallpdf.com',
  'ilovepdf':          'https://www.ilovepdf.com',
  'tinypng':           'https://tinypng.com',
  'regex101':          'https://regex101.com',
  'json formatter':    'https://jsonformatter.org',
  'color picker':      'https://htmlcolorcodes.com',
  'what is my ip':     'https://whatismyipaddress.com',
  'down detector':     'https://downdetector.com',
  'downdetector':      'https://downdetector.com',

  // ─── Forums & Communities ───
  'stack exchange':    'https://stackexchange.com',
  '4chan':             'https://www.4chan.org',
  'discourse':         'https://www.discourse.org',
  'fandom':            'https://www.fandom.com',
  'wikia':             'https://www.fandom.com',
};

/** Resolve a plain site name to a known URL, or null. */
function resolveKnownSite(name) {
  const key = name.trim().toLowerCase();
  return KNOWN_SITES[key] || null;
}

// ── Tab Management ──────────────────────────────────────────────

export async function newTab(url) {
  const tab = await chrome.tabs.create({ url: url || 'chrome://newtab' });
  return { success: true, tabId: tab.id, message: 'New tab opened' };
}

export async function closeTab(tabId) {
  if (tabId) {
    await chrome.tabs.remove(tabId);
  } else {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active) await chrome.tabs.remove(active.id);
  }
  return { success: true, message: 'Tab closed' };
}

export async function switchTab(indexOrId) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let tab;

  if (typeof indexOrId === 'number' && indexOrId <= tabs.length) {
    // Treat as 1-based index
    tab = tabs[indexOrId - 1];
  } else {
    tab = tabs.find(t => t.id === indexOrId);
  }

  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    return { success: true, tabId: tab.id, message: `Switched to tab: ${tab.title}` };
  }
  return { success: false, message: 'Tab not found' };
}

export async function listTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map((t, i) => ({
    index: i + 1,
    id: t.id,
    title: t.title,
    url: t.url,
    active: t.active,
    pinned: t.pinned,
    muted: t.mutedInfo?.muted || false,
  }));
}

export async function duplicateTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    const dup = await chrome.tabs.duplicate(active.id);
    return { success: true, tabId: dup.id, message: 'Tab duplicated' };
  }
  return { success: false, message: 'No active tab' };
}

export async function pinTab(tabId) {
  const [active] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    const tab = await chrome.tabs.get(active.id);
    await chrome.tabs.update(active.id, { pinned: !tab.pinned });
    return { success: true, message: tab.pinned ? 'Tab unpinned' : 'Tab pinned' };
  }
  return { success: false, message: 'No active tab' };
}

export async function muteTab(tabId) {
  const [active] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    const tab = await chrome.tabs.get(active.id);
    const muted = tab.mutedInfo?.muted || false;
    await chrome.tabs.update(active.id, { muted: !muted });
    return { success: true, message: muted ? 'Tab unmuted' : 'Tab muted' };
  }
  return { success: false, message: 'No active tab' };
}

// ── Navigation ──────────────────────────────────────────────────

export async function navigateInNewTab(url) {
  const originalQuery = url;
  let isSearch = false;

  if (url && !url.match(/^(https?|chrome|file):\/\//i)) {
    // Check well-known sites first
    const known = resolveKnownSite(url);
    if (known) {
      url = known;
    } else if (url.match(/^[\w-]+(\.[\w-]+)+/)) {
      url = 'https://' + url;
    } else {
      // Unknown plain name — do a proper Google search so the AI can pick the best result
      isSearch = true;
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  }

  const tab = await chrome.tabs.create({ url });
  return { success: true, tabId: tab.id, message: isSearch ? `Searching for "${originalQuery}" in new tab...` : `Opening ${url} in new tab...` };
}

export async function navigate(url) {
  const originalQuery = url;
  let isSearch = false;

  // Ensure URL has a protocol
  if (url && !url.match(/^(https?|chrome|file):\/\//i)) {
    // Check well-known sites first
    const known = resolveKnownSite(url);
    if (known) {
      url = known;
    } else if (url.match(/^[\w-]+(\.[\w-]+)+/)) {
      url = 'https://' + url;
    } else {
      // Unknown plain name — do a proper Google search so the AI can pick the best result
      isSearch = true;
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  }

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = active?.id;

  if (tabId) {
    await chrome.tabs.update(tabId, { url });
    return { success: true, message: isSearch ? `Searching for "${originalQuery}"...` : `Opening ${url}...` };
  }
  return await newTab(url);
}

export async function goBack() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.goBack(active.id);
    return { success: true, message: 'Going back' };
  }
  return { success: false, message: 'No active tab' };
}

export async function goForward() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.goForward(active.id);
    return { success: true, message: 'Going forward' };
  }
  return { success: false, message: 'No active tab' };
}

export async function reload() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.reload(active.id);
    return { success: true, message: 'Page reloaded' };
  }
  return { success: false, message: 'No active tab' };
}

export async function searchGoogle(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.update(active.id, { url });
  } else {
    await chrome.tabs.create({ url });
  }
  return { success: true, message: `Searching Google for "${query}"...` };
}

// ── Screenshots ─────────────────────────────────────────────────

export async function captureScreenshot(retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Ensure we have an active tab that's not a chrome:// page
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active) {
        return { success: false, error: 'No active tab' };
      }

      // Can't capture chrome:// or chrome-extension:// pages
      if (active.url?.startsWith('chrome://') || active.url?.startsWith('chrome-extension://')) {
        return { success: false, error: 'Cannot capture Chrome internal pages' };
      }

      // If tab is still loading, wait for it
      if (active.status === 'loading') {
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 5000); // max 5s wait
          const listener = (tabId, info) => {
            if (tabId === active.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeout);
              setTimeout(resolve, 300); // small extra delay for rendering
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
      const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      return { success: true, imageB64: b64 };
    } catch (e) {
      if (attempt < retries) {
        // Wait and retry — tab might still be settling
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'Screenshot capture failed after retries' };
}

// ── Page Info (via content script) ──────────────────────────────

export async function getPageInfo() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };

  return {
    success: true,
    url: active.url,
    title: active.title,
    tabId: active.id,
  };
}

// ── Execute Content Script Action ───────────────────────────────

export async function executePageAction(action) {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };

  // Can't inject into chrome:// pages
  if (active.url?.startsWith('chrome://') || active.url?.startsWith('chrome-extension://')) {
    return { success: false, message: 'Cannot interact with Chrome internal pages' };
  }

  try {
    const results = await chrome.tabs.sendMessage(active.id, {
      type: MSG_TYPES.PAGE_ACTION,
      action,
    });
    return results || { success: true };
  } catch (e) {
    // Content script might not be injected — try injecting it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: active.id },
        files: ['content/page-reader.js', 'content/page-controller.js'],
      });
      // Retry the action
      const results = await chrome.tabs.sendMessage(active.id, {
        type: MSG_TYPES.PAGE_ACTION,
        action,
      });
      return results || { success: true };
    } catch (e2) {
      return { success: false, message: `Page action failed: ${e2.message}` };
    }
  }
}

// ── Read Page Content (via content script) ──────────────────────

export async function readPageContent(readType = 'full') {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };

  if (active.url?.startsWith('chrome://') || active.url?.startsWith('chrome-extension://')) {
    return { success: true, content: `Chrome page: ${active.title}`, url: active.url };
  }

  try {
    const result = await chrome.tabs.sendMessage(active.id, {
      type: MSG_TYPES.PAGE_READ,
      readType,
    });
    return { success: true, ...result, url: active.url, title: active.title };
  } catch (e) {
    // Try injecting content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: active.id },
        files: ['content/page-reader.js', 'content/page-controller.js'],
      });
      const result = await chrome.tabs.sendMessage(active.id, {
        type: MSG_TYPES.PAGE_READ,
        readType,
      });
      return { success: true, ...result, url: active.url, title: active.title };
    } catch (e2) {
      return { success: false, message: `Cannot read page: ${e2.message}` };
    }
  }
}

// ── Window Management ───────────────────────────────────────────

export async function maximizeWindow() {
  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { state: 'maximized' });
  return { success: true, message: 'Window maximized' };
}

export async function minimizeWindow() {
  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { state: 'minimized' });
  return { success: true, message: 'Window minimized' };
}

export async function fullscreenWindow() {
  const win = await chrome.windows.getCurrent();
  const state = win.state === 'fullscreen' ? 'normal' : 'fullscreen';
  await chrome.windows.update(win.id, { state });
  return { success: true, message: state === 'fullscreen' ? 'Window fullscreen' : 'Exited fullscreen' };
}

export async function resizeWindow(width, height) {
  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { width, height, state: 'normal' });
  return { success: true, message: `Window resized to ${width}×${height}` };
}

export async function moveWindow(left, top) {
  const win = await chrome.windows.getCurrent();
  await chrome.windows.update(win.id, { left, top });
  return { success: true, message: `Window moved to (${left}, ${top})` };
}

export async function newWindow(url) {
  const opts = url ? { url } : {};
  await chrome.windows.create(opts);
  return { success: true, message: 'New window opened' };
}

export async function closeWindow() {
  const win = await chrome.windows.getCurrent();
  await chrome.windows.remove(win.id);
  return { success: true, message: 'Window closed' };
}

// ── Zoom ────────────────────────────────────────────────────────

export async function zoomIn() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  const current = await chrome.tabs.getZoom(active.id);
  const next = Math.min(current + 0.25, 5);
  await chrome.tabs.setZoom(active.id, next);
  return { success: true, message: `Zoomed to ${Math.round(next * 100)}%` };
}

export async function zoomOut() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  const current = await chrome.tabs.getZoom(active.id);
  const next = Math.max(current - 0.25, 0.25);
  await chrome.tabs.setZoom(active.id, next);
  return { success: true, message: `Zoomed to ${Math.round(next * 100)}%` };
}

export async function zoomReset() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  await chrome.tabs.setZoom(active.id, 0); // 0 = default zoom
  return { success: true, message: 'Zoom reset to default' };
}

// ── Tab Groups ──────────────────────────────────────────────────

export async function groupTabs(tabIds, title, color) {
  if (!tabIds || !tabIds.length) {
    // Group all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    tabIds = tabs.map(t => t.id);
  }
  const groupId = await chrome.tabs.group({ tabIds });
  const opts = {};
  if (title) opts.title = title;
  if (color) opts.color = color;
  if (Object.keys(opts).length) await chrome.tabGroups.update(groupId, opts);
  return { success: true, message: `Grouped ${tabIds.length} tabs${title ? ': ' + title : ''}` };
}

export async function ungroupTab(tabId) {
  const [active] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.ungroup(active.id);
    return { success: true, message: 'Tab removed from group' };
  }
  return { success: false, message: 'No active tab' };
}

// ── History ─────────────────────────────────────────────────────

export async function searchHistory(query, maxResults = 20) {
  const results = await chrome.history.search({ text: query, maxResults });
  return results.map(r => ({
    title: r.title,
    url: r.url,
    lastVisit: r.lastVisitTime ? new Date(r.lastVisitTime).toISOString() : null,
    visitCount: r.visitCount,
  }));
}

export async function deleteHistoryUrl(url) {
  await chrome.history.deleteUrl({ url });
  return { success: true, message: `Deleted from history: ${url}` };
}

export async function clearRecentHistory(hours = 1) {
  const startTime = Date.now() - (hours * 3600000);
  await chrome.history.deleteRange({ startTime, endTime: Date.now() });
  return { success: true, message: `Cleared last ${hours} hour(s) of history` };
}

// ── Bookmarks ───────────────────────────────────────────────────

export async function searchBookmarks(query) {
  const results = await chrome.bookmarks.search(query);
  return results.slice(0, 20).map(b => ({
    id: b.id,
    title: b.title,
    url: b.url,
    dateAdded: b.dateAdded ? new Date(b.dateAdded).toISOString() : null,
  }));
}

export async function addBookmark(title, url) {
  if (!url) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!active) return { success: false, message: 'No active tab' };
    url = active.url;
    title = title || active.title;
  }
  const bm = await chrome.bookmarks.create({ title, url });
  return { success: true, message: `Bookmarked: ${bm.title}`, id: bm.id };
}

export async function removeBookmark(id) {
  await chrome.bookmarks.remove(id);
  return { success: true, message: 'Bookmark removed' };
}

// ── Downloads ───────────────────────────────────────────────────

export async function startDownload(url, filename) {
  const opts = { url };
  if (filename) opts.filename = filename;
  const dlId = await chrome.downloads.download(opts);
  return { success: true, downloadId: dlId, message: `Download started: ${url}` };
}

export async function searchDownloads(query, limit = 10) {
  const results = await chrome.downloads.search({ query: query ? [query] : [], limit, orderBy: ['-startTime'] });
  return results.map(d => ({
    id: d.id,
    filename: d.filename,
    url: d.url,
    state: d.state,
    totalBytes: d.totalBytes,
    startTime: d.startTime,
  }));
}

export async function pauseDownload(dlId) {
  await chrome.downloads.pause(dlId);
  return { success: true, message: 'Download paused' };
}

export async function resumeDownload(dlId) {
  await chrome.downloads.resume(dlId);
  return { success: true, message: 'Download resumed' };
}

export async function cancelDownload(dlId) {
  await chrome.downloads.cancel(dlId);
  return { success: true, message: 'Download cancelled' };
}

// ── Print ────────────────────────────────────────────────────────

export async function printPage() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  await chrome.scripting.executeScript({
    target: { tabId: active.id },
    func: () => window.print(),
  });
  return { success: true, message: 'Print dialog opened' };
}

// ── Clear Browsing Data ─────────────────────────────────────────

export async function clearBrowsingData(dataTypes, hours = 1) {
  const since = Date.now() - (hours * 3600000);
  const types = {};
  const allowed = ['cache', 'cookies', 'history', 'formData', 'downloads', 'localStorage', 'passwords'];
  if (dataTypes && dataTypes.length) {
    for (const t of dataTypes) {
      if (allowed.includes(t)) types[t] = true;
    }
  } else {
    types.cache = true;
    types.cookies = true;
  }
  await chrome.browsingData.remove({ since }, types);
  const cleared = Object.keys(types).join(', ');
  return { success: true, message: `Cleared ${cleared} (last ${hours}h)` };
}

// ── Notifications ───────────────────────────────────────────────

export async function createNotification(title, message) {
  const id = 'aria-' + Date.now();
  await chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title || 'Aria',
    message: message || '',
  });
  return { success: true, message: `Notification shown: ${title}` };
}

export async function clearNotifications() {
  await chrome.notifications.getAll(all => {
    for (const id of Object.keys(all)) {
      chrome.notifications.clear(id);
    }
  });
  return { success: true, message: 'Notifications cleared' };
}

// ── Tab Discard ─────────────────────────────────────────────────

export async function discardTab(tabId) {
  const [active] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) {
    await chrome.tabs.discard(active.id);
    return { success: true, message: 'Tab discarded (memory freed)' };
  }
  return { success: false, message: 'No tab to discard' };
}

// ── Close Other / Right Tabs ────────────────────────────────────

export async function closeOtherTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  const toClose = tabs.filter(t => t.id !== active.id && !t.pinned).map(t => t.id);
  if (toClose.length) await chrome.tabs.remove(toClose);
  return { success: true, message: `Closed ${toClose.length} other tab(s)` };
}

export async function closeTabsToRight() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  const activeIdx = tabs.findIndex(t => t.id === active.id);
  const toClose = tabs.slice(activeIdx + 1).filter(t => !t.pinned).map(t => t.id);
  if (toClose.length) await chrome.tabs.remove(toClose);
  return { success: true, message: `Closed ${toClose.length} tab(s) to the right` };
}

// ── Reopen Closed Tab ───────────────────────────────────────────

export async function reopenClosedTab() {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
  if (sessions.length && sessions[0].tab) {
    await chrome.sessions.restore(sessions[0].tab.sessionId);
    return { success: true, message: 'Reopened closed tab' };
  }
  return { success: false, message: 'No recently closed tabs' };
}

// ── Sort Tabs ───────────────────────────────────────────────────

export async function sortTabs(by = 'title') {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const sorted = [...tabs].sort((a, b) => {
    const aVal = by === 'url' ? (a.url || '') : (a.title || '');
    const bVal = by === 'url' ? (b.url || '') : (b.title || '');
    return aVal.localeCompare(bVal);
  });
  for (let i = 0; i < sorted.length; i++) {
    await chrome.tabs.move(sorted[i].id, { index: i });
  }
  return { success: true, message: `Tabs sorted by ${by}` };
}

// ── Move Tab to Window ──────────────────────────────────────────

export async function moveTabToWindow(tabId, windowId) {
  const [active] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return { success: false, message: 'No active tab' };
  if (windowId) {
    await chrome.tabs.move(active.id, { windowId, index: -1 });
    return { success: true, message: 'Tab moved to another window' };
  }
  // Move to a new window
  await chrome.windows.create({ tabId: active.id });
  return { success: true, message: 'Tab moved to new window' };
}

// ── List / Focus Windows ────────────────────────────────────────

export async function listWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  return windows.map((w, i) => ({
    index: i + 1,
    id: w.id,
    focused: w.focused,
    state: w.state,
    tabCount: w.tabs ? w.tabs.length : 0,
    type: w.type,
  }));
}

export async function focusWindow(windowId) {
  await chrome.windows.update(windowId, { focused: true });
  return { success: true, message: 'Window focused' };
}

// ── Scroll via Content Script ───────────────────────────────────

export async function scrollPage(direction, amount = 500) {
  return await executePageAction({
    type: 'scroll',
    direction,
    amount,
  });
}

export async function scrollSlowly(direction = 'down') {
  return await executePageAction({
    type: 'scrollSlowly',
    direction,
  });
}

export async function scrollTo(position) {
  return await executePageAction({
    type: 'scrollTo',
    position, // 'top' or 'bottom'
  });
}

// ── Click & Type via Content Script ─────────────────────────────

export async function clickAt(x, y) {
  return await executePageAction({ type: 'click', x, y });
}

export async function clickSelector(selector) {
  return await executePageAction({ type: 'clickSelector', selector });
}

export async function typeText(text, selector) {
  return await executePageAction({ type: 'type', text, selector });
}

export async function pressKey(key) {
  return await executePageAction({ type: 'press', key });
}

// ── Dispatch action object from AI ──────────────────────────────

export async function dispatchAction(action) {
  if (!action || !action.type) return { success: false, message: 'No action' };

  switch (action.type) {
    case 'click':
      if (action.selector) return await clickSelector(action.selector);
      return await clickAt(action.x, action.y);

    case 'type':
      return await typeText(action.text, action.selector);

    case 'scroll':
      return await scrollPage(action.direction || 'down', action.amount || 500);

    case 'scrollSlowly':
      return await scrollSlowly(action.direction || 'down');

    case 'scrollTo':
      return await scrollTo(action.position || 'top');

    case 'navigateNewTab':
      return await navigateInNewTab(action.url);

    case 'navigate':
      return await navigate(action.url);

    case 'back':
      return await goBack();

    case 'forward':
      return await goForward();

    case 'press':
      return await pressKey(action.key);

    case 'search':
    case 'searchGoogle':
      return await searchGoogle(action.query || action.url);

    case 'newTab':
      return await newTab(action.url);

    case 'closeTab':
      return await closeTab(action.tabId);

    case 'switchTab':
      return await switchTab(action.index || action.tabIndex || action.tabId);

    case 'reload':
      return await reload();

    case 'duplicateTab':
      return await duplicateTab();

    case 'pinTab':
      return await pinTab();

    case 'muteTab':
      return await muteTab();

    case 'goBack':
      return await goBack();

    case 'goForward':
      return await goForward();

    case 'maximizeWindow':
      return await maximizeWindow();

    case 'minimizeWindow':
      return await minimizeWindow();

    case 'fullscreenWindow':
      return await fullscreenWindow();

    case 'resizeWindow':
      return await resizeWindow(action.width || 1280, action.height || 800);

    case 'moveWindow':
      return await moveWindow(action.left || 0, action.top || 0);

    case 'newWindow':
      return await newWindow(action.url);

    case 'closeWindow':
      return await closeWindow();

    case 'zoomIn':
      return await zoomIn();

    case 'zoomOut':
      return await zoomOut();

    case 'zoomReset':
      return await zoomReset();

    case 'groupTabs':
      return await groupTabs(action.tabIds, action.title, action.color);

    case 'ungroupTab':
      return await ungroupTab(action.tabId);

    case 'searchHistory':
      return { success: true, results: await searchHistory(action.query || '', action.maxResults) };

    case 'deleteHistoryUrl':
      return await deleteHistoryUrl(action.url);

    case 'clearRecentHistory':
      return await clearRecentHistory(action.hours);

    case 'searchBookmarks':
      return { success: true, results: await searchBookmarks(action.query || '') };

    case 'addBookmark':
      return await addBookmark(action.title, action.url);

    case 'removeBookmark':
      return await removeBookmark(action.id);

    case 'startDownload':
      return await startDownload(action.url, action.filename);

    case 'searchDownloads':
      return { success: true, results: await searchDownloads(action.query) };

    case 'pauseDownload':
      return await pauseDownload(action.downloadId);

    case 'resumeDownload':
      return await resumeDownload(action.downloadId);

    case 'cancelDownload':
      return await cancelDownload(action.downloadId);

    case 'printPage':
      return await printPage();

    case 'clearBrowsingData':
      return await clearBrowsingData(action.dataTypes, action.hours);

    case 'createNotification':
      return await createNotification(action.title, action.message);

    case 'clearNotifications':
      return await clearNotifications();

    case 'discardTab':
      return await discardTab(action.tabId);

    case 'closeOtherTabs':
      return await closeOtherTabs();

    case 'closeTabsToRight':
      return await closeTabsToRight();

    case 'reopenClosedTab':
      return await reopenClosedTab();

    case 'sortTabs':
      return await sortTabs(action.by);

    case 'moveTabToWindow':
      return await moveTabToWindow(action.tabId, action.windowId);

    case 'listWindows':
      return { success: true, results: await listWindows() };

    case 'focusWindow':
      return await focusWindow(action.windowId);

    // Page actions dispatched to content script
    case 'hover':
      return await executePageAction({ type: 'hover', selector: action.selector, x: action.x, y: action.y });

    case 'doubleClick':
      return await executePageAction({ type: 'doubleClick', selector: action.selector, x: action.x, y: action.y });

    case 'rightClick':
      return await executePageAction({ type: 'rightClick', selector: action.selector, x: action.x, y: action.y });

    case 'toggleCheckbox':
      return await executePageAction({ type: 'toggleCheckbox', selector: action.selector });

    case 'selectOption':
      return await executePageAction({ type: 'selectOption', selector: action.selector, value: action.value });

    case 'submitForm':
      return await executePageAction({ type: 'submitForm', selector: action.selector });

    case 'clearInput':
      return await executePageAction({ type: 'clearInput', selector: action.selector });

    case 'extractTable':
      return await executePageAction({ type: 'extractTable', selector: action.selector });

    case 'countElements':
      return await executePageAction({ type: 'countElements', selector: action.selector });

    case 'scrollIntoView':
      return await executePageAction({ type: 'scrollIntoView', selector: action.selector });

    case 'getElementInfo':
      return await executePageAction({ type: 'getElementInfo', selector: action.selector });

    case 'wait':
      await new Promise(r => setTimeout(r, action.ms || 2000));
      return { success: true, message: `Waited ${action.ms || 2000}ms` };

    // Clipboard actions
    case 'copyText':
      return await executePageAction({ type: 'copyText', text: action.text });

    case 'copySelection':
      return await executePageAction({ type: 'copySelection' });

    case 'pasteText':
      return await executePageAction({ type: 'pasteText', selector: action.selector });

    // Popup & modal management
    case 'closePopups':
      return await executePageAction({ type: 'closePopups' });

    // Google sign-in
    case 'signInWithGoogle':
      return await executePageAction({ type: 'signInWithGoogle', accountIndex: action.accountIndex || 0 });

    case 'none':
      return { success: true, message: 'No action needed' };

    default:
      return { success: false, message: `Unknown action type: ${action.type}` };
  }
}

// ── Smart Page-Load Waiting ─────────────────────────────────────

/**
 * Wait for the page to finish loading — checks tab status, loading indicators,
 * and skeleton screens. Returns when page is ready or timeout reached.
 */
export async function waitForPageReady(tabId, timeoutMs = 8000) {
  const start = Date.now();

  // Phase 1: Wait for Chrome tab status to be 'complete'
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = tabId ? await chrome.tabs.get(tabId) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      if (tab && tab.status === 'complete') break;
    } catch { break; }
    await new Promise(r => setTimeout(r, 300));
  }

  // Extra settle time for JS-heavy pages
  await new Promise(r => setTimeout(r, 500));

  // Phase 2: Check for loading spinners/skeletons via content script
  try {
    const pageState = await executePageAction({ type: 'detectPageState' });
    if (pageState && pageState.loading) {
      // Page has spinners/skeletons — wait a bit more
      const remaining = timeoutMs - (Date.now() - start);
      if (remaining > 1000) {
        await new Promise(r => setTimeout(r, Math.min(remaining - 500, 3000)));
      }
    }
    return pageState || { success: true, message: 'Page ready' };
  } catch {
    return { success: true, message: 'Page ready (no content script)' };
  }
}

// ── CAPTCHA Detection ───────────────────────────────────────────

/**
 * Check if the current page has a CAPTCHA challenge.
 * Returns { hasCaptcha: bool, signals: string[] }
 */
export async function detectCaptcha() {
  try {
    return await executePageAction({ type: 'detectCaptcha' });
  } catch {
    return { success: true, hasCaptcha: false, signals: [], message: 'Cannot check (no content script)' };
  }
}

// ── Multi-Tab Context ───────────────────────────────────────────

/**
 * Get a compact summary of all open tabs for AI context.
 */
export async function getTabContext() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map((t, i) => ({
    index: i + 1,
    active: t.active,
    title: (t.title || '').substring(0, 60),
    url: t.url || '',
    pinned: t.pinned,
  }));
}
