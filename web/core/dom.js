(function(){
  const byId=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const setText=(id,value,fallback="--")=>{const element=byId(id);if(element)element.textContent=value??fallback;};
  window.DriveOSDom=Object.freeze({byId,escapeHtml,setText});
})();
