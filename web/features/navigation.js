(function(){
  function initializeMobileNavigationPortal(){const nav=document.querySelector('.main-nav');const topbar=document.querySelector('.topbar');const right=document.querySelector('.topbar-right');if(!nav||!topbar)return;const update=()=>{const compact=window.matchMedia('(max-width: 767px)').matches;if(compact){if(nav.parentElement!==document.body)document.body.appendChild(nav);nav.classList.add('mobile-nav-portal');return;}if(nav.parentElement===document.body){if(right&&right.parentElement===topbar)topbar.insertBefore(nav,right);else topbar.appendChild(nav);}nav.classList.remove('mobile-nav-portal');};update();window.addEventListener('resize',update,{passive:true});}
  function closeMobileMenu(){const menu=document.getElementById('mobileMoreMenu'),trigger=document.querySelector('[data-mobile-menu]');if(menu)menu.hidden=true;if(trigger)trigger.setAttribute('aria-expanded','false');document.body.classList.remove('mobile-menu-open');}
  function openMobileMenu(){const menu=document.getElementById('mobileMoreMenu'),trigger=document.querySelector('[data-mobile-menu]');if(menu)menu.hidden=false;if(trigger)trigger.setAttribute('aria-expanded','true');document.body.classList.add('mobile-menu-open');}
  function showView(name){document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active-view',view.id===`view-${name}`));document.querySelectorAll('.nav-button[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===name));const localPreview=window.DriveOSPlatform?.isLocalPreview?.()===true;document.querySelector('[data-mobile-menu]')?.classList.toggle('active',(localPreview?['timeline','music','statistics','health']:['graph','timeline','music','statistics','health']).includes(name));closeMobileMenu();history.replaceState(null,'',`#${name}`);document.dispatchEvent(new CustomEvent('journeydeck:viewchange',{detail:{view:name}}));window.scrollTo({top:0,behavior:'smooth'});}
  function bindLoadingLabEasterEgg(){
    const version=document.querySelector('.app-version');
    if(!version||version.dataset.loadingLabBound==='true')return;
    version.dataset.loadingLabBound='true';
    version.tabIndex=0;
    let activations=0,resetTimer=0;
    const activate=()=>{
      window.clearTimeout(resetTimer);
      activations+=1;
      if(activations>=3){
        activations=0;
        const build=encodeURIComponent(window.DriveOSBuild?.webBuild||'current');
        window.location.assign(`/loading-preview.html?v=${build}`);
        return;
      }
      resetTimer=window.setTimeout(()=>{activations=0;},1600);
    };
    version.addEventListener('click',activate);
    version.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      event.preventDefault();
      activate();
    });
  }
  function bind(){document.querySelectorAll('.nav-button[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));document.querySelectorAll('[data-go-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.goView)));document.querySelector('[data-mobile-menu]')?.addEventListener('click',openMobileMenu);document.querySelectorAll('[data-mobile-menu-close]').forEach(button=>button.addEventListener('click',closeMobileMenu));document.querySelectorAll('[data-mobile-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.mobileView)));bindLoadingLabEasterEgg();}
  window.DriveOSNavigation=Object.freeze({initializeMobileNavigationPortal,showView,bind});
})();
