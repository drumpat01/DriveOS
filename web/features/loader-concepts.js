(function(){
  const STORAGE_KEY="journeydeck-loader-concept-v1";
  const icon='<img src="/assets/journeydeck-icon-cinematic.svg" alt="">';
  const wordmark='<div class="loader-wordmark">JOURNEY<strong>DECK</strong></div>';
  const concepts=[
    {
      id:"pulse",name:"Ignition Pulse",duration:3000,
      markup:`<div class="loader-stage loader-pulse" aria-label="JourneyDeck is loading with Ignition Pulse"><div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="pulse-lockup"><div class="pulse-rings"><i></i><i></i><i></i>${icon}</div>${wordmark}<div class="pulse-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>BRINGING YOUR JOURNEYS TO LIFE</p></div></div>`
    },
    {
      id:"atlas",name:"Atlas Orbit",duration:3800,
      markup:`<div class="loader-stage loader-atlas" aria-label="JourneyDeck is loading with Atlas Orbit"><div class="atlas-grid"></div><div class="atlas-lockup"><div class="atlas-system"><div class="atlas-orbit orbit-one"><i></i><i></i></div><div class="atlas-orbit orbit-two"><i></i><i></i><i></i></div><div class="atlas-orbit orbit-three"><i></i></div>${icon}</div>${wordmark}<p>MAPPING THE WORLD AROUND YOU</p></div></div>`
    },
    {
      id:"trace",name:"Road Trace",duration:3400,
      markup:`<div class="loader-stage loader-trace" aria-label="JourneyDeck is loading with Road Trace"><div class="trace-horizon"></div><div class="trace-grid"></div><div class="trace-route" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div><div class="trace-lockup">${icon}<div>${wordmark}<p>EVERY MILE, BEAUTIFULLY REMEMBERED</p></div></div><div class="trace-progress"><span></span></div></div>`
    },
    {
      id:"sync",name:"Signal Sync",duration:3200,
      markup:`<div class="loader-stage loader-sync" aria-label="JourneyDeck is loading with Signal Sync"><div class="sync-lockup"><div class="sync-brand">${icon}${wordmark}</div><div class="sync-lines" aria-hidden="true"><div style="--delay:0s"><span>VEHICLE</span><i><b></b></i><em>CONNECTED</em></div><div style="--delay:.28s"><span>ATLAS</span><i><b></b></i><em>MAPPED</em></div><div style="--delay:.56s"><span>MUSIC</span><i><b></b></i><em>MATCHED</em></div></div><p>ASSEMBLING YOUR LATEST JOURNEY</p></div></div>`
    },
    {
      id:"soundtrack",name:"Soundtrack Spin",duration:3600,
      markup:`<div class="loader-stage loader-soundtrack" aria-label="JourneyDeck is loading with Soundtrack Spin"><div class="soundtrack-glow"></div><div class="soundtrack-lockup"><div class="soundtrack-record" aria-hidden="true"><i></i><i></i><i></i><i></i><span>${icon}</span></div><div class="soundtrack-copy"><div class="soundtrack-kicker">YOUR ROAD. YOUR SOUNDTRACK.</div>${wordmark}<div class="soundtrack-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>MATCHING MUSIC TO THE MILES</p></div></div></div>`
    },
    {
      id:"wave",name:"Soundwave Journey",duration:3200,
      markup:`<div class="loader-stage loader-wave" aria-label="JourneyDeck is loading with Soundwave Journey"><div class="wave-grid"></div><div class="wave-brand">${icon}${wordmark}</div><div class="wave-road" aria-hidden="true"><span class="wave-origin"></span><div class="wave-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="wave-destination"></span></div><div class="wave-labels"><span>DEPARTURE</span><strong>THE SOUND OF THIS JOURNEY</strong><span>ARRIVAL</span></div></div>`
    },
    {
      id:"liner-notes",name:"Journey Liner Notes",duration:3800,
      markup:`<div class="loader-stage loader-liner" aria-label="JourneyDeck is loading with Journey Liner Notes"><div class="liner-orb liner-orb-a"></div><div class="liner-orb liner-orb-b"></div><div class="liner-stack" aria-hidden="true"><div class="liner-card liner-card-back"><span>12.4 MI</span><i></i><b>FORT WORTH</b></div><div class="liner-card liner-card-mid"><span>NOW PLAYING</span><i></i><b>JOURNEY MIX</b></div><div class="liner-card liner-card-front"><div class="liner-art">${icon}</div><span>VOLUME 08 · TRACK 17</span><b>EVERY MILE HAS A SONG</b></div></div><div class="liner-wordmark">${wordmark}<p>BUILDING THE LINER NOTES</p></div></div>`
    },
    {
      id:"mixdown",name:"Memory Mixdown",duration:3600,
      markup:`<div class="loader-stage loader-mixdown" aria-label="JourneyDeck is loading with Memory Mixdown"><div class="mixdown-lockup"><div class="mixdown-title"><span>LIVE MIX</span>${wordmark}</div><div class="mixdown-console" aria-hidden="true"><div class="mix-track" style="--mix-delay:0s"><span>01</span><strong>ROAD</strong><i><b></b></i><em></em></div><div class="mix-track" style="--mix-delay:.2s"><span>02</span><strong>PLACE</strong><i><b></b></i><em></em></div><div class="mix-track" style="--mix-delay:.4s"><span>03</span><strong>MUSIC</strong><i><b></b></i><em></em></div></div><div class="mixdown-master"><span>MASTER MEMORY</span><div><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong>READY</strong></div><p>MIXING THE MOMENT BACK TOGETHER</p></div></div>`
    }
  ];

  function nextConcept(){
    let previous=-1;
    try{previous=Number.parseInt(localStorage.getItem(STORAGE_KEY)||"",10);}catch{}
    const index=Number.isInteger(previous)&&previous>=0&&previous<concepts.length
      ?(previous+1)%concepts.length
      :Math.floor(Math.random()*concepts.length);
    try{localStorage.setItem(STORAGE_KEY,String(index));}catch{}
    return concepts[index];
  }

  function mount(){
    const host=document.getElementById("driveosIgnition");
    if(!host)return null;
    const selected=nextConcept();
    host.replaceChildren();
    host.style.setProperty("--orange","#ff784b");
    host.style.setProperty("--apricot","#ffad58");
    host.style.setProperty("--coral","#ff405f");
    host.style.setProperty("--purple","#8f43e8");
    const shadow=host.attachShadow({mode:"open"});
    shadow.innerHTML=`<link rel="stylesheet" href="/loading-preview.css?v=6.0.0"><style>:host{display:block;width:100%;height:100%;background:#090511;color:#fff7f2}.loader-stage{width:100%;height:100%;min-height:100%;border:0;border-radius:0}.loader-stage::after{box-shadow:inset 0 0 120px rgba(4,1,8,.42)}@media(prefers-reduced-motion:reduce){.loader-stage::before{content:"LOADING JOURNEYDECK"}}</style>${selected.markup}`;
    const stylesheet=shadow.querySelector('link[rel="stylesheet"]');
    const ready=new Promise(resolve=>{
      if(stylesheet?.sheet){resolve();return;}
      stylesheet?.addEventListener("load",resolve,{once:true});
      stylesheet?.addEventListener("error",resolve,{once:true});
      if(!stylesheet)resolve();
    });
    host.dataset.loaderConcept=selected.id;
    host.dataset.loaderName=selected.name;
    host.classList.add("jd-concept-ready");
    return {current:Object.freeze({id:selected.id,name:selected.name,duration:selected.duration}),ready};
  }

  const mounted=mount();
  window.JourneyDeckLoader=Object.freeze({current:mounted?.current||null,ready:mounted?.ready||Promise.resolve(),concepts:concepts.map(({id,name,duration})=>({id,name,duration}))});
})();
