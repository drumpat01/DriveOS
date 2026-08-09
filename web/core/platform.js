(function(){
  const isTailnetRemote=()=>/\.ts\.net$/i.test(location.hostname);
  const isIosDevice=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const isStandalonePwa=()=>window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
  window.DriveOSPlatform=Object.freeze({isTailnetRemote,isIosDevice,isStandalonePwa});
})();
