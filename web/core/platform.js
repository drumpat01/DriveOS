(function(){
  const isLocalHost=(hostname=location.hostname)=>{
    const normalized=String(hostname||"").toLowerCase();
    return normalized==="127.0.0.1"||normalized==="localhost";
  };
  const isTailnetRemote=()=>/\.ts\.net$/i.test(location.hostname);
  const isLocalPreview=()=>isLocalHost()||isTailnetRemote();
  const isIosDevice=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const isStandalonePwa=()=>window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
  const connectionContextLabel=(hostname=location.hostname)=>{
    const normalized=String(hostname||"").toLowerCase();
    return isLocalHost(normalized)
      ? "Local only \u00b7 127.0.0.1"
      : `Hosted securely \u00b7 ${normalized}`;
  };
  document.documentElement.classList.toggle("local-host",isLocalPreview());
  window.DriveOSPlatform=Object.freeze({isLocalHost,isLocalPreview,isTailnetRemote,isIosDevice,isStandalonePwa,connectionContextLabel});
})();
