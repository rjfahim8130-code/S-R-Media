// ads.js - NnowQuiz Ad Manager (Monetag + Adsterra + HilltopAds)

const AdManager = {
  // রোটেশন কাউন্টার
  interstitialIndex: 0,
  nativeIndex: 0,
  bannerIndex: 0,

  // ========== Interstitial / Popunder রোটেশন (জমা বাটন) ==========
  interstitialAds: [
    // 1. Monetag OnClick
    {
      name: 'Monetag OnClick',
      load: function() {
        return new Promise((resolve) => {
          try {
            (function(s){s.dataset.zone='12156567',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
            setTimeout(resolve, 1200);
          } catch(e) { resolve(); }
        });
      }
    },
    // 2. Adsterra Popunder
    {
      name: 'Adsterra Popunder',
      load: function() {
        return new Promise((resolve) => {
          try {
            const s = document.createElement('script');
            s.setAttribute('data-cfasync', 'false');
            s.src = 'https://afders.org/1/8da2bc93ae2a8cab8a58f039565c7483';
            document.body.appendChild(s);
            setTimeout(resolve, 1200);
          } catch(e) { resolve(); }
        });
      }
    },
    // 3. Hilltop Popunder
    {
      name: 'Hilltop Popunder',
      load: function() {
        return new Promise((resolve) => {
          try {
            (function(tmtlp){
              var d = document, s = d.createElement('script'), l = d.currentScript || d.scripts[d.scripts.length - 1];
              s.settings = tmtlp || {};
              s.src = "//enchantingboss.com/cwD.9Z6Abp2v5BldSUWQQ/9RN_zIUt3AOETpMozzMXye0_3dNoThcP5ZMIzKMi3m";
              s.async = true;
              s.referrerPolicy = 'no-referrer-when-downgrade';
              l.parentNode.insertBefore(s, l);
            })({});
            setTimeout(resolve, 1200);
          } catch(e) { resolve(); }
        });
      }
    }
  ],

  // Native অ্যাড (প্রবন্ধ + প্রশ্ন)
  showNative: function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const natives = [
      // Monetag Vignette
      function() {
        container.innerHTML = '';
        const s = document.createElement('script');
        s.innerHTML = `(function(s){s.dataset.zone='12156576',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
        container.appendChild(s);
      },
      // Adsterra Native
      function() {
        container.innerHTML = '<div id="container-466d66da3eb822d38a670cab92fcebbf"></div>';
        const s = document.createElement('script');
        s.async = true;
        s.setAttribute('data-cfasync', 'false');
        s.src = 'https://bicea.org/21/466d66da3eb822d38a670cab92fcebbf';
        container.appendChild(s);
      },
      // Hilltop In-Page Push
      function() {
        container.innerHTML = '';
        const s = document.createElement('script');
        s.innerHTML = `(function(uwjqk){var d=document,s=d.createElement('script'),l=d.currentScript||d.scripts[d.scripts.length-1];s.settings=uwjqk||{};s.src="//prizefamily.com/bNX.V/sFdCG_lh0-Y/Wkcy/Peomp9/urZWUXllk/PmT/cv1tNhzykAzFOzTUcStTNxzIU/3cOPTEQ/w/MyQQ";s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})`;
        container.appendChild(s);
      }
    ];

    const ad = natives[this.nativeIndex % natives.length];
    this.nativeIndex++;
    ad();
  },

  // Banner অ্যাড (রেজাল্ট + হোম)
  showBanner: function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const banners = [
      // Hilltop Banner
      function() {
        container.innerHTML = '';
        const s = document.createElement('script');
        s.innerHTML = `(function(js){var d=document,s=d.createElement('script'),l=d.currentScript||d.scripts[d.scripts.length-1];s.settings=js||{};s.src="//prizefamily.com/beXSVhs.d/GHlE0rYOWxc-/qeVmL9SulZWUql-kBP/TVcY1qN/zNkK0qMXTnMstqN/zMUP3qOMTcQQxvNLw_";s.async=true;s.referrerPolicy='no-referrer-when-downgrade';l.parentNode.insertBefore(s,l);})({})`;
        container.appendChild(s);
      },
      // Adsterra 300x250
      function() {
        container.innerHTML = '';
        const s1 = document.createElement('script');
        s1.innerHTML = `atOptions = { 'key' : '3681e9d4e03d19c7f8879b13cb6164e0', 'format' : 'iframe', 'height' : 250, 'width' : 300, 'params' : {} };`;
        const s2 = document.createElement('script');
        s2.src = 'https://bicea.org/22/3681e9d4e03d19c7f8879b13cb6164e0';
        container.appendChild(s1);
        container.appendChild(s2);
      },
      // Monetag In-Page Push
      function() {
        container.innerHTML = '';
        const s = document.createElement('script');
        s.innerHTML = `(function(s){s.dataset.zone='12156578',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`;
        container.appendChild(s);
      }
    ];

    const ad = banners[this.bannerIndex % banners.length];
    this.bannerIndex++;
    ad();
  },

  // Interstitial দেখানো (জমা বাটন)
  showInterstitial: async function() {
    const ad = this.interstitialAds[this.interstitialIndex % this.interstitialAds.length];
    this.interstitialIndex++;
    console.log('Showing Interstitial:', ad.name);
    await ad.load();
  },

  // MultiTag (সেশন শুরুতে)
  showMultiTag: function() {
    try {
      const s = document.createElement('script');
      s.src = 'https://quge5.com/88/tag.min.js';
      s.setAttribute('data-zone', '303727');
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      document.body.appendChild(s);
    } catch(e) {}
  }
};
