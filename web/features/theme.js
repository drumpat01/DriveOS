(function(){
  const key='driveos-theme';
  function stored(){return'dark';}
  function apply(theme,persist=true){const selected='dark';document.documentElement.dataset.theme=selected;document.querySelectorAll('[data-theme-choice]').forEach(button=>{const active=button.dataset.themeChoice===selected;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});if(persist){try{localStorage.setItem(key,selected);}catch{}}}
  function initialize(){apply(stored(),false);document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.themeChoice)));}
  window.DriveOSTheme=Object.freeze({stored,apply,initialize});
})();
