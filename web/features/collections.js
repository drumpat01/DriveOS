(function(){
  function create({state,api,applyFilter,ensureMapLibre}){
    const $=id=>document.getElementById(id),MAX_BYTES=1572864;
    const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
    const drivesFor=collection=>new Set(collection.driveIds||[]);
    const membersFor=collection=>{const ids=drivesFor(collection);return state.drives.filter(drive=>ids.has(drive.id));};
    const formatBytes=value=>value>=1048576?`${(value/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(value/1024))} KB`;
    const total=(items,key)=>items.reduce((sum,item)=>sum+(Number(item[key])||0),0);
    let storyCollection=null,storyMap=null;

    function close(){const modal=$("journeyCollectionModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");}
    function closeStory(){const modal=$("journeyStoryModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");storyMap?.remove();storyMap=null;storyCollection=null;}
    function updateCount(){const count=$("journeyCollectionDriveList")?.querySelectorAll("input:checked").length||0;$("journeyCollectionSelectionCount").textContent=`${count} selected`;}
    function driveChoice(drive,selected){return `<label class="journey-collection-drive-choice"><input type="checkbox" value="${escape(drive.id)}" ${selected.has(drive.id)?"checked":""}><span><strong>${escape(drive.shortDateLabel||drive.dateLabel||"Journey")}</strong><small>${escape(drive.startingLocation||"Start")} &rarr; ${escape(drive.endingLocation||"Destination")} &middot; ${escape(drive.miles??0)} mi</small></span></label>`;}

    function renderAttachments(items=[]){
      const list=$("journeyAttachmentList");if(!list)return;
      list.innerHTML=items.length?items.map(item=>`<article class="journey-attachment-item"><div><strong title="${escape(item.fileName)}">${escape(item.fileName)}</strong><small>${escape(formatBytes(item.byteLength))}</small></div><span class="journey-attachment-item-actions"><button class="text-button" type="button" data-open-attachment="${escape(item.id)}">Open</button><button class="text-button" type="button" data-remove-attachment="${escape(item.id)}">Remove</button></span></article>`).join(""):'<div class="journey-attachment-empty">No photos or files yet.</div>';
      list.querySelectorAll("[data-open-attachment]").forEach(button=>button.addEventListener("click",()=>openAttachment(button.dataset.openAttachment)));
      list.querySelectorAll("[data-remove-attachment]").forEach(button=>button.addEventListener("click",()=>removeAttachment(button.dataset.removeAttachment)));
    }
    async function listAttachments(collectionId){const data=await api.post("/api/collections/attachments/list",{collectionId});return data.attachments||[];}
    async function loadAttachments(collectionId){$("journeyAttachmentMessage").textContent="";try{renderAttachments(await listAttachments(collectionId));}catch(error){$("journeyAttachmentMessage").textContent=error.message;}}

    function open(collection=null){
      const modal=$("journeyCollectionModal");if(!modal)return;const selected=drivesFor(collection||{});
      $("journeyCollectionId").value=collection?.id||"";$("journeyCollectionName").value=collection?.name||"";$("journeyCollectionDescription").value=collection?.description||"";
      $("journeyCollectionModalHeading").textContent=collection?"Edit collection":"New collection";$("deleteJourneyCollection").hidden=!collection;$("journeyCollectionMessage").textContent="";$("journeyAttachmentSection").hidden=!collection;
      renderAttachments([]);if(collection)void loadAttachments(collection.id);
      $("journeyCollectionDriveList").innerHTML=state.drives.slice(0,100).map(drive=>driveChoice(drive,selected)).join("")||'<p class="muted">No journeys are available yet.</p>';
      $("journeyCollectionDriveList").querySelectorAll("input").forEach(input=>input.addEventListener("change",updateCount));updateCount();
      modal.classList.add("open");modal.setAttribute("aria-hidden","false");$("journeyCollectionName").focus();
    }

    function collectionMusic(drives){
      const counts=new Map(),examples=new Map();let songs=0;
      drives.forEach(drive=>(drive.soundtrack||[]).filter(Boolean).forEach(song=>{songs++;const artist=String(song.artist||"").trim();if(!artist)return;const key=artist.toLocaleLowerCase();counts.set(key,(counts.get(key)||0)+1);if(!examples.has(key))examples.set(key,song);}));
      const winner=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
      return {songs,artist:winner?examples.get(winner[0])?.artist:null,plays:winner?.[1]||0,image:winner?examples.get(winner[0])?.albumImage:null};
    }
    function validCoordinate(value,min,max){const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max;}
    function collectionRoutes(drives){return drives.map(drive=>[[Number(drive.startingLongitude),Number(drive.startingLatitude)],[Number(drive.endingLongitude),Number(drive.endingLatitude)]]).filter(line=>line.every(point=>validCoordinate(point[0],-180,180)&&validCoordinate(point[1],-90,90)));}

    async function renderStoryPhotos(collection){
      const container=$("journeyStoryPhotos");container.hidden=true;container.innerHTML="";
      const attachments=await listAttachments(collection.id),images=attachments.filter(item=>String(item.contentType).startsWith("image/")).slice(0,3);
      if(!images.length)return;
      const records=(await Promise.all(images.map(item=>api.post("/api/collections/attachments/get",{attachmentId:item.id}).catch(()=>null)))).filter(Boolean);
      if(!records.length)return;
      container.innerHTML=records.map((item,index)=>`<img class="journey-story-photo" src="data:${escape(item.contentType)};base64,${item.dataBase64}" alt="${escape(index?`${collection.name} photo ${index+1}`:`Cover photo for ${collection.name}`)}">`).join("");container.hidden=false;
    }

    async function renderStoryMap(drives){
      const mapElement=$("journeyStoryMap"),status=$("journeyStoryMapStatus"),routes=collectionRoutes(drives);storyMap?.remove();storyMap=null;mapElement.innerHTML="";mapElement.classList.remove("map-unavailable");
      if(!routes.length){mapElement.classList.add("map-unavailable");mapElement.textContent="No route coordinates are available for these journeys.";status.textContent="No map data";return;}
      try{
        const maplibre=await ensureMapLibre();
        storyMap=new maplibre.Map({container:mapElement,style:window.JourneyDeckMapTheme?.style||"https://tiles.openfreemap.org/styles/dark",center:routes[0][0],zoom:9,attributionControl:true});
        window.JourneyDeckMapTheme?.attach(storyMap);
        storyMap.addControl(new maplibre.NavigationControl({showCompass:false}),"top-right");
        storyMap.on("load",()=>{
          storyMap.addSource("collection-routes",{type:"geojson",data:{type:"FeatureCollection",features:routes.map((coordinates,index)=>({type:"Feature",properties:{index},geometry:{type:"LineString",coordinates}}))}});
          storyMap.addLayer({id:"collection-route-shadow",type:"line",source:"collection-routes",paint:{"line-color":"#062d38","line-width":7,"line-opacity":.28}});
          storyMap.addLayer({id:"collection-routes",type:"line",source:"collection-routes",paint:{"line-color":"#13b8a7","line-width":4,"line-opacity":.88}});
          const bounds=routes.flat().reduce((box,coordinate)=>box.extend(coordinate),new maplibre.LngLatBounds(routes[0][0],routes[0][0]));storyMap.fitBounds(bounds,{padding:44,maxZoom:13,duration:0});status.textContent=`${routes.length} route${routes.length===1?"":"s"}`;
        });
      }catch(error){mapElement.classList.add("map-unavailable");mapElement.textContent=error.message||"Map overview is unavailable.";status.textContent="Map unavailable";}
    }

    async function openStory(collection){
      const modal=$("journeyStoryModal");if(!modal)return;storyCollection=collection;$("journeyStoryLoading").hidden=false;$("journeyStoryContent").hidden=true;$("journeyStoryLoading").textContent="Building your collection story…";modal.classList.add("open");modal.setAttribute("aria-hidden","false");
      try{
        const drives=membersFor(collection),music=collectionMusic(drives),miles=total(drives,"miles"),minutes=total(drives,"durationMinutes");
        $("journeyStoryHeading").textContent=collection.name;$("journeyStoryDescription").textContent=collection.description||"A saved chapter from your time on the road.";
        $("journeyStoryStats").innerHTML=[{label:"Journeys",value:drives.length,detail:"in this collection"},{label:"Distance",value:`${Math.round(miles*10)/10} mi`,detail:"across every route"},{label:"Journey time",value:minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes} min`,detail:"behind the wheel"},{label:"Soundtrack",value:`${music.songs} song${music.songs===1?"":"s"}`,detail:music.artist?`Led by ${music.artist}`:"No archived songs"}].map(item=>`<article class="journey-story-stat"><span>${escape(item.label)}</span><strong>${escape(item.value)}</strong><small>${escape(item.detail)}</small></article>`).join("");
        $("journeyStoryArtist").innerHTML=`${music.image?`<img class="journey-story-artist-art" src="${escape(music.image)}" alt="${escape(music.artist||"Top artist")}">`:'<div class="journey-story-artist-art"></div>'}<span class="section-label">TOP ARTIST</span><strong>${escape(music.artist||"No artist yet")}</strong><small>${music.artist?`${music.plays} play${music.plays===1?"":"s"} in this collection`:"Songs matched to these journeys will appear here."}</small>`;
        $("journeyStoryDrives").innerHTML=drives.length?drives.slice(0,12).map(drive=>`<article class="journey-story-drive"><strong>${escape(drive.shortDateLabel||drive.dateLabel||"Journey")}</strong><span>${escape(drive.startingLocation||"Start")} &rarr; ${escape(drive.endingLocation||"Destination")}</span><span>${escape(drive.miles??0)} mi &middot; ${escape(drive.durationMinutes??0)} min</span></article>`).join(""):'<div class="journey-attachment-empty">No journeys are currently in this collection.</div>';
        $("journeyStoryShowDrives").disabled=!drives.length;$("journeyStoryLoading").hidden=true;$("journeyStoryContent").hidden=false;
        await Promise.all([renderStoryPhotos(collection).catch(()=>{}),renderStoryMap(drives)]);
      }catch(error){$("journeyStoryLoading").textContent=error.message||"JourneyDeck could not open this collection.";}
    }

    function render(){
      const container=$("journeyCollections"),status=$("journeyCollectionsStatus");if(!container)return;
      status.textContent=state.collections.length?`${state.collections.length} collection${state.collections.length===1?"":"s"}`:"No collections yet";
      container.innerHTML=state.collections.length?state.collections.map(collection=>{const ids=drivesFor(collection),members=membersFor(collection),latest=members[0]?.shortDateLabel||"No journeys yet";return `<article class="journey-collection-card" data-open-collection="${escape(collection.id)}" role="button" tabindex="0" aria-label="Open ${escape(collection.name)}"><div><strong>${escape(collection.name)}</strong><p>${escape(collection.description||"A saved group of journeys")}</p><span>${ids.size} journey${ids.size===1?"":"s"} &middot; Latest ${escape(latest)}</span></div><div class="journey-collection-card-actions"><button class="secondary-button" type="button" data-story-collection="${escape(collection.id)}">Open collection</button><button class="text-button" type="button" data-edit-collection="${escape(collection.id)}">Manage</button></div></article>`;}).join(""):'<div class="favorite-routes-empty"><strong>Create your first collection</strong><span>Group existing journeys without changing the original JourneyDeck history.</span></div>';
      const launch=id=>{const collection=state.collections.find(item=>item.id===id);if(collection)void openStory(collection);};
      container.querySelectorAll("[data-open-collection]").forEach(card=>{card.addEventListener("click",event=>{if(!event.target.closest("button"))launch(card.dataset.openCollection);});card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();launch(card.dataset.openCollection);}});});
      container.querySelectorAll("[data-story-collection]").forEach(button=>button.addEventListener("click",()=>launch(button.dataset.storyCollection)));
      container.querySelectorAll("[data-edit-collection]").forEach(button=>button.addEventListener("click",()=>open(state.collections.find(item=>item.id===button.dataset.editCollection))));
    }
    async function load(){try{const data=await api.get("/api/collections");state.collections=Array.isArray(data.collections)?data.collections:[];render();}catch(error){$("journeyCollectionsStatus").textContent=error.message;}}
    async function save(event){event.preventDefault();const submit=event.currentTarget.querySelector('[type="submit"]');submit.disabled=true;$("journeyCollectionMessage").textContent="Saving…";try{const collection=await api.post("/api/collections/save",{id:$("journeyCollectionId").value||null,name:$("journeyCollectionName").value,description:$("journeyCollectionDescription").value,driveIds:Array.from($("journeyCollectionDriveList").querySelectorAll("input:checked"),input=>input.value)});state.collections=[collection,...state.collections.filter(item=>item.id!==collection.id)];render();close();}catch(error){$("journeyCollectionMessage").textContent=error.message;}finally{submit.disabled=false;}}
    async function remove(){const id=$("journeyCollectionId").value;if(!id||!confirm("Delete this collection? Your journeys will remain untouched."))return;$("deleteJourneyCollection").disabled=true;try{await api.post("/api/collections/delete",{collectionId:id});state.collections=state.collections.filter(item=>item.id!==id);render();close();}catch(error){$("journeyCollectionMessage").textContent=error.message;}finally{$("deleteJourneyCollection").disabled=false;}}
    const bytesToBase64=bytes=>{let value="";for(let index=0;index<bytes.length;index+=32768)value+=String.fromCharCode(...bytes.subarray(index,index+32768));return btoa(value);};
    async function prepareFile(file){if(!file.type.startsWith("image/")){if(file.size>MAX_BYTES)throw new Error(`${file.name} is larger than 1.5 MB.`);return {fileName:file.name,contentType:file.type,dataBase64:bytesToBase64(new Uint8Array(await file.arrayBuffer()))};}try{const bitmap=await createImageBitmap(file),scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));if(!blob||blob.size>MAX_BYTES)throw new Error("Photo could not be reduced below 1.5 MB.");return {fileName:file.name.replace(/\.[^.]+$/,"")+".jpg",contentType:"image/jpeg",dataBase64:bytesToBase64(new Uint8Array(await blob.arrayBuffer()))};}catch(error){if(file.size>MAX_BYTES)throw error;return {fileName:file.name,contentType:file.type,dataBase64:bytesToBase64(new Uint8Array(await file.arrayBuffer()))};}}
    async function addAttachments(event){const files=Array.from(event.target.files||[]),collectionId=$("journeyCollectionId").value,message=$("journeyAttachmentMessage");event.target.value="";if(!collectionId||!files.length)return;message.textContent=`Adding ${files.length} file${files.length===1?"":"s"}…`;try{for(const file of files){const prepared=await prepareFile(file);await api.post("/api/collections/attachments/add",{collectionId,...prepared});}message.textContent="Added.";await loadAttachments(collectionId);}catch(error){message.textContent=error.message;}}
    async function openAttachment(attachmentId){const message=$("journeyAttachmentMessage");try{message.textContent="Opening…";const item=await api.post("/api/collections/attachments/get",{attachmentId}),binary=atob(item.dataBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:item.contentType}));window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);message.textContent="";}catch(error){message.textContent=error.message;}}
    async function removeAttachment(attachmentId){if(!confirm("Remove this photo or file from the journey?"))return;const message=$("journeyAttachmentMessage");try{await api.post("/api/collections/attachments/remove",{attachmentId});message.textContent="Removed.";await loadAttachments($("journeyCollectionId").value);}catch(error){message.textContent=error.message;}}

    $("newJourneyCollection")?.addEventListener("click",()=>open());$("journeyCollectionForm")?.addEventListener("submit",save);$("deleteJourneyCollection")?.addEventListener("click",remove);$("journeyAttachmentInput")?.addEventListener("change",addAttachments);
    $("journeyStoryShowDrives")?.addEventListener("click",()=>{if(!storyCollection)return;const collection=storyCollection;closeStory();applyFilter(collection.driveIds,collection.name);});
    $("journeyStoryManage")?.addEventListener("click",()=>{if(!storyCollection)return;const collection=storyCollection;closeStory();open(collection);});
    document.querySelectorAll("[data-close-collection-modal]").forEach(element=>element.addEventListener("click",close));document.querySelectorAll("[data-close-journey-story]").forEach(element=>element.addEventListener("click",closeStory));
    return Object.freeze({load,render,open,openStory,close,closeStory});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.collections=Object.freeze({create});
})();
