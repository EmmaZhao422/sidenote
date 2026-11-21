// Site-wide settings. This is the one file you edit to turn things on.
// Everything here is public (it ships to the browser), so never put a secret
// API key in this file. Secret keys live in the Cloudflare Worker (see /worker).

export const CONFIG = {
  siteName: 'Sidenote',
  siteNameZh: '走神本',
  siteUrl: 'https://emmazhao422.github.io/sidenote/',
  repoUrl: 'https://github.com/EmmaZhao422/sidenote',
  contactUrl: 'https://github.com/EmmaZhao422/sidenote/issues',

  ai: {
    // URL of your deployed Cloudflare Worker, e.g. 'https://sidenote-ai.yourname.workers.dev'.
    // Leave empty and the site still works: visitors get the built-in offline
    // helper, or can paste their own API key in Settings.
    proxyUrl: '',
  },

  ads: {
    // Your AdSense publisher id, e.g. 'ca-pub-1234567890123456'.
    // Leave empty and no ad code is loaded at all.
    adsenseClient: '',
    // Ad unit ids from AdSense (Ads > By ad unit > Display ads), one per placement.
    slots: {
      home: '',
      lot: '',
      insights: '',
      guide: '',
    },
  },

  analytics: {
    // Optional visit counter. Paste the token from Cloudflare Web Analytics
    // (dash.cloudflare.com > Analytics & Logs > Web Analytics) to switch it on.
    cloudflareToken: '',
  },

  // Optional "Support this project" link (Ko-fi, Buy Me a Coffee, 爱发电...).
  supportUrl: '',
};
