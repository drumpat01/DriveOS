(function(){
  const $=window.DriveOSDom.byId;
  function create(tasks){
    async function refresh(){const button=$('refreshButton');if(button){button.disabled=true;button.textContent='Refreshing…';}await Promise.allSettled([tasks.loadStatus(),tasks.loadVehicle()]);await tasks.loadSpotify();await Promise.allSettled([tasks.loadDrives(),tasks.loadMusicStats(),tasks.loadStatistics(),tasks.loadPlaces(),tasks.loadCharging(),tasks.loadRecaps()]);if(button){button.disabled=false;button.textContent='Refresh data';}}
    function bind(){ $('refreshButton')?.addEventListener('click',refresh); }
    function start(){refresh();window.setInterval(()=>{tasks.loadVehicle();tasks.loadStatus();},120000);window.setInterval(async()=>{await tasks.loadSpotify();await Promise.allSettled([tasks.loadDrives(),tasks.loadMusicStats(),tasks.loadStatistics(),tasks.loadPlaces(),tasks.loadCharging(),tasks.loadRecaps()]);},300000);}
    return Object.freeze({refresh,bind,start});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.refresh=Object.freeze({create});
})();
