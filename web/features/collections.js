(function(){
  function create({state,api,applyFilter}){
    const $=id=>document.getElementById(id);
    const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
    const drivesFor=collection=>new Set(collection.driveIds||[]);
    function close(){const modal=$("journeyCollectionModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
    function updateCount(){const count=$("journeyCollectionDriveList")?.querySelectorAll("input:checked").length||0;$("journeyCollectionSelectionCount").textContent=`${count} selected`;}
    function driveChoice(drive,selected){return `<label class="journey-collection-drive-choice"><input type="checkbox" value="${escape(drive.id)}" ${selected.has(drive.id)?"checked":""}><span><strong>${escape(drive.shortDateLabel||drive.dateLabel||"Drive")}</strong><small>${escape(drive.startingLocation||"Start")} &rarr; ${escape(drive.endingLocation||"Destination")} &middot; ${escape(drive.miles??0)} mi</small></span></label>`;}
    function open(collection=null){
      const modal=$("journeyCollectionModal");if(!modal)return;
      const selected=drivesFor(collection||{});
      $("journeyCollectionId").value=collection?.id||"";$("journeyCollectionName").value=collection?.name||"";$("journeyCollectionDescription").value=collection?.description||"";
      $("journeyCollectionModalHeading").textContent=collection?"Edit collection":"New collection";$("deleteJourneyCollection").hidden=!collection;$("journeyCollectionMessage").textContent="";
      $("journeyCollectionDriveList").innerHTML=state.drives.slice(0,100).map(drive=>driveChoice(drive,selected)).join("")||'<p class="muted">No drives are available yet.</p>';
      $("journeyCollectionDriveList").querySelectorAll("input").forEach(input=>input.addEventListener("change",updateCount));updateCount();
      modal.classList.add("open");modal.setAttribute("aria-hidden","false");$("journeyCollectionName").focus();
    }
    function render(){
      const container=$("journeyCollections"),status=$("journeyCollectionsStatus");if(!container)return;
      status.textContent=state.collections.length?`${state.collections.length} collection${state.collections.length===1?"":"s"}`:"No collections yet";
      container.innerHTML=state.collections.length?state.collections.map(collection=>{
        const ids=drivesFor(collection),members=state.drives.filter(drive=>ids.has(drive.id));const latest=members[0]?.shortDateLabel||"No drives yet";
        return `<article class="journey-collection-card"><div><strong>${escape(collection.name)}</strong><p>${escape(collection.description||"A saved group of journeys")}</p><span>${ids.size} drive${ids.size===1?"":"s"} &middot; Latest ${escape(latest)}</span></div><div class="journey-collection-card-actions"><button class="secondary-button" type="button" data-view-collection="${escape(collection.id)}" ${ids.size?"":"disabled"}>View drives</button><button class="text-button" type="button" data-edit-collection="${escape(collection.id)}">Manage</button></div></article>`;
      }).join(""):'<div class="favorite-routes-empty"><strong>Create your first collection</strong><span>Group existing drives without changing the original JourneyDeck history.</span></div>';
      container.querySelectorAll("[data-view-collection]").forEach(button=>button.addEventListener("click",()=>{const collection=state.collections.find(item=>item.id===button.dataset.viewCollection);if(collection)applyFilter(collection.driveIds,collection.name);}));
      container.querySelectorAll("[data-edit-collection]").forEach(button=>button.addEventListener("click",()=>open(state.collections.find(item=>item.id===button.dataset.editCollection))));
    }
    async function load(){try{const data=await api.get("/api/collections");state.collections=Array.isArray(data.collections)?data.collections:[];render();}catch(error){$("journeyCollectionsStatus").textContent=error.message;}}
    async function save(event){event.preventDefault();const submit=event.currentTarget.querySelector('[type="submit"]');submit.disabled=true;$("journeyCollectionMessage").textContent="Saving…";try{const collection=await api.post("/api/collections/save",{id:$("journeyCollectionId").value||null,name:$("journeyCollectionName").value,description:$("journeyCollectionDescription").value,driveIds:Array.from($("journeyCollectionDriveList").querySelectorAll("input:checked"),input=>input.value)});state.collections=[collection,...state.collections.filter(item=>item.id!==collection.id)];render();close();}catch(error){$("journeyCollectionMessage").textContent=error.message;}finally{submit.disabled=false;}}
    async function remove(){const id=$("journeyCollectionId").value;if(!id||!confirm("Delete this collection? Your drives will remain untouched."))return;$("deleteJourneyCollection").disabled=true;try{await api.post("/api/collections/delete",{collectionId:id});state.collections=state.collections.filter(item=>item.id!==id);render();close();}catch(error){$("journeyCollectionMessage").textContent=error.message;}finally{$("deleteJourneyCollection").disabled=false;}}
    $("newJourneyCollection")?.addEventListener("click",()=>open());$("journeyCollectionForm")?.addEventListener("submit",save);$("deleteJourneyCollection")?.addEventListener("click",remove);document.querySelectorAll("[data-close-collection-modal]").forEach(element=>element.addEventListener("click",close));
    return Object.freeze({load,render,open,close});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.collections=Object.freeze({create});
})();
