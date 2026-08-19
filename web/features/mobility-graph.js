(function(){
  const escape=value=>window.DriveOSDom.escapeHtml(value);
  const number=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(Number(value)||0);
  const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Unknown':parsed.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});};
  const categoryName=value=>({home:'Home',work:'Work',family:'Family',errands:'Errands',dining:'Dining',wellness:'Wellness',routine:'Frequent place',other:'Other'}[value]||'Other');
  const safeCategory=value=>['home','work','family','errands','dining','wellness','routine','other'].includes(value)?value:'other';
  const safeDirection=value=>['up','down','new','stable','neutral'].includes(value)?value:'neutral';
  const validCoordinate=(latitude,longitude)=>Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;
  const placeCategories=[['home','Home'],['work','Work'],['family','Family'],['errands','Errands'],['dining','Dining'],['wellness','Wellness'],['other','Other']];
  const routineTypes=[['commute','Commute'],['school-run','School run'],['family-visit','Family visit'],['errand-loop','Errand loop'],['frequent-route','Frequent route'],['custom','Custom']];

  function positions(nodes,frame={}){
    const width=Number(frame.width)||900,height=Number(frame.height)||520,padding=Number(frame.padding)||72;
    const located=nodes.filter(node=>validCoordinate(Number(node.latitude),Number(node.longitude)));
    if(located.length===nodes.length&&nodes.length>1){
      const lats=nodes.map(node=>Number(node.latitude)),lons=nodes.map(node=>Number(node.longitude));
      const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
      const latSpan=Math.max(maxLat-minLat,.01),lonSpan=Math.max(maxLon-minLon,.01);
      return new Map(nodes.map(node=>[node.id,{x:padding+((Number(node.longitude)-minLon)/lonSpan)*(width-padding*2),y:height-padding-((Number(node.latitude)-minLat)/latSpan)*(height-padding*2)}]));
    }
    const centerX=width/2,centerY=height/2,radius=Math.min(width,height)*.36;
    return new Map(nodes.map((node,index)=>{const angle=(Math.PI*2*index/Math.max(nodes.length,1))-Math.PI/2;return[node.id,{x:centerX+Math.cos(angle)*radius,y:centerY+Math.sin(angle)*radius}];}));
  }

  function create({api}){
    let graph=null,loaded=false,loading=null,selectedId=null,mobilityMap=null,journeyMapRequest=0,journeyMapTimer=null,placeSaveQueue=Promise.resolve(),routineSaveQueue=Promise.resolve();
    const nodeMap=()=>new Map((graph?.nodes||[]).map(node=>[node.id,node]));
    const setStatus=text=>{const status=document.getElementById('mobilityGraphStatus');if(status)status.textContent=text;};

    function placeGeoJson(){
      return {type:'FeatureCollection',features:(graph?.nodes||[]).filter(node=>validCoordinate(Number(node.latitude),Number(node.longitude))).map(node=>({type:'Feature',id:node.id,properties:{placeId:node.id,label:node.label,address:node.address||'',category:safeCategory(node.category),visitCount:Number(node.visitCount)||0},geometry:{type:'Point',coordinates:[Number(node.longitude),Number(node.latitude)]}}))};
    }

    function updateSelectedLayer(){if(mobilityMap?.getLayer('mobility-place-selected'))mobilityMap.setFilter('mobility-place-selected',['==',['get','placeId'],selectedId||'']);}

    async function inspect(node){
      const inspector=document.getElementById('mobilityPlaceInspector');if(!inspector||!graph)return;inspector.hidden=false;
      if(node.category==='home'){const homeJourneyCount=Number(graph.summary?.homeJourneyCount);inspector.innerHTML=`<div class="mobility-home-summary"><h3>${escape(node.label||'Home')}</h3><strong>${number(Number.isFinite(homeJourneyCount)?homeJourneyCount:node.visitCount)}</strong><span>journeys recorded going to or from Home</span></div>`;return;}
      inspector.innerHTML=`<div class="section-label">MOBILITY PLACE</div><h3>${escape(node.label)}</h3><p class="mobility-place-address">Loading place details…</p>`;
      try{
        const detail=await api.get(`/api/atlas/places/${encodeURIComponent(node.id)}`);if(selectedId!==node.id)return;
        const nodes=nodeMap(),connections=(detail.connections||[]).map(item=>({...item,other:nodes.get(item.otherPlaceId)})).filter(item=>item.other).slice(0,5);
        const options=placeCategories.map(([value,label])=>`<option value="${value}"${safeCategory(detail.category)===value?' selected':''}>${escape(label)}</option>`).join('');
        inspector.innerHTML=`<div class="section-label">MOBILITY PLACE</div><h3>${escape(detail.label)}</h3><p class="mobility-place-address">${escape(detail.address||'Address unavailable')}</p><div class="mobility-identity"><span class="mobility-category category-${safeCategory(detail.category)}">${escape(categoryName(detail.category))}</span><span>saved privately</span></div><form class="mobility-place-editor" data-mobility-place-form><label>Name<input name="name" maxlength="80" required value="${escape(detail.label)}"></label><label>Identity<select name="category">${options}</select></label><div><button class="primary-button compact" type="submit">Save identity</button></div></form><div class="mobility-place-facts"><span><strong>${number(detail.visitCount)}</strong> visits</span><span><strong>${number(detail.arrivals)}</strong> arrivals</span><span><strong>${number(detail.departures)}</strong> departures</span></div><p>Seen from ${escape(date(detail.firstSeenAt))} through ${escape(date(detail.lastSeenAt))}.</p><div class="mobility-connections"><div class="section-label">STRONGEST CONNECTIONS</div>${connections.length?connections.map(item=>`<div><span>${escape(item.other.label)}<small>${escape(item.other.address||'')}</small></span><strong>${number(item.driveCount)} journey${Number(item.driveCount)===1?'':'s'}</strong></div>`).join(''):'<p>No connected journey is available yet.</p>'}</div>`;
        inspector.querySelector('[data-mobility-place-form]')?.addEventListener('submit',event=>{event.preventDefault();void savePlace(node,event.currentTarget);});
      }catch(error){if(selectedId===node.id)inspector.innerHTML=`<div class="empty-state"><h3>Place details unavailable</h3><p>${escape(error.message)}</p></div>`;}
    }

    function select(nodeId){selectedId=nodeId;updateSelectedLayer();const node=nodeMap().get(nodeId);if(node)void inspect(node);}

    async function loadJourneyMap(map){
      const request=++journeyMapRequest,bounds=map.getBounds(),zoom=map.getZoom(),query=new URLSearchParams({west:String(bounds.getWest()),south:String(bounds.getSouth()),east:String(bounds.getEast()),north:String(bounds.getNorth()),zoom:String(zoom)});
      try{
        const result=await api.get(`/api/atlas/map?${query}`);if(request!==journeyMapRequest||mobilityMap!==map)return;
        map.getSource('mobility-connections')?.setData(result.data||{type:'FeatureCollection',features:[]});
        const shown=number(result.returned),total=number(result.totalInView);setStatus(result.mode==='journeys'?`${shown}${result.truncated?` of ${total}`:''} visible journeys · pan or zoom to explore`:`${shown} travel corridors · ${total} journeys in view · zoom in for individual journeys`);
      }catch(error){if(request===journeyMapRequest&&mobilityMap===map)setStatus(`Journey detail unavailable · ${error.message}`);}
    }

    function scheduleJourneyMap(map,delay=120){clearTimeout(journeyMapTimer);journeyMapTimer=setTimeout(()=>void loadJourneyMap(map),delay);}

    function addMapLayers(map){
      map.addSource('mobility-connections',{type:'geojson',data:graph.representativeLines});
      map.addLayer({id:'mobility-connections-glow',type:'line',source:'mobility-connections',paint:{'line-color':['match',['get','kind'],'journey','#ff6a61','corridor','#b765ff',['match',['get','palette'],0,'#ff6a61',1,'#b765ff','#ff9f43']],'line-width':['interpolate',['linear'],['coalesce',['get','journeyCount'],1],1,3,10,6,100,11],'line-opacity':['match',['get','kind'],'journey',.14,.24],'line-blur':4}});
      map.addLayer({id:'mobility-connections-line',type:'line',source:'mobility-connections',paint:{'line-color':['match',['get','kind'],'journey','#ff756d','corridor','#c078ff',['match',['get','palette'],0,'#ff756d',1,'#c078ff','#ffad55']],'line-width':['match',['get','kind'],'journey',['interpolate',['linear'],['zoom'],11,1.2,16,2.4],['interpolate',['linear'],['coalesce',['get','journeyCount'],1],1,1.5,10,2.6,100,5]],'line-opacity':['match',['get','kind'],'journey',.62,.78]}});
      map.addSource('mobility-places',{type:'geojson',data:placeGeoJson(),cluster:true,clusterMaxZoom:10,clusterRadius:42});
      map.addLayer({id:'mobility-place-clusters',type:'circle',source:'mobility-places',filter:['has','point_count'],paint:{'circle-color':'#6d2fa8','circle-radius':['step',['get','point_count'],15,25,20,75,27],'circle-stroke-color':'#ff8b4d','circle-stroke-width':2.5,'circle-opacity':.9}});
      map.addLayer({id:'mobility-place-cluster-count',type:'symbol',source:'mobility-places',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':11},paint:{'text-color':'#fff5ff'}});
      map.addLayer({id:'mobility-places',type:'circle',source:'mobility-places',filter:['!',['has','point_count']],paint:{'circle-color':['match',['get','category'],'home','#ff605d','work','#42b6ff','dining','#ff9f43','#a64cff'],'circle-radius':['interpolate',['linear'],['zoom'],3,4.5,12,8],'circle-stroke-color':'#fff5ff','circle-stroke-width':1.5,'circle-opacity':.94}});
      map.addLayer({id:'mobility-place-selected',type:'circle',source:'mobility-places',filter:['==',['get','placeId'],selectedId||''],paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':['interpolate',['linear'],['zoom'],3,8,12,14],'circle-stroke-color':'#ff9f43','circle-stroke-width':3}});
      map.addLayer({id:'mobility-place-labels',type:'symbol',source:'mobility-places',minzoom:8,filter:['!',['has','point_count']],layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],8,10,14,12],'text-offset':[0,1.25],'text-anchor':'top','text-optional':true},paint:{'text-color':'#f7ebff','text-halo-color':'#160823','text-halo-width':1.5}});
      map.on('click','mobility-places',event=>{const id=event.features?.[0]?.properties?.placeId;if(id)select(id);});map.on('click','mobility-place-labels',event=>{const id=event.features?.[0]?.properties?.placeId;if(id)select(id);});
      map.on('click','mobility-place-clusters',event=>{const coordinate=event.features?.[0]?.geometry?.coordinates;if(coordinate)map.easeTo({center:coordinate,zoom:Math.min(map.getZoom()+2,13)});});
      for(const layer of ['mobility-places','mobility-place-labels','mobility-place-clusters']){map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});}
      map.on('moveend',()=>scheduleJourneyMap(map));
    }

    async function renderGeographicMap(canvas){
      clearTimeout(journeyMapTimer);journeyMapRequest++;mobilityMap?.remove();mobilityMap=null;canvas.innerHTML='<div class="mobility-map" data-mobility-map aria-label="Interactive map of your journey places"></div><div class="mobility-graph-help">Drag to move · zoom in to reveal individual journeys</div><div class="mobility-place-attribution">Place labels © OpenStreetMap contributors · ODbL</div>';
      try{
        const maplibregl=await window.JourneyDeckMaps.ensureMapLibre();if(!canvas.isConnected||!graph)return;
        const nodes=graph.nodes.filter(node=>validCoordinate(Number(node.latitude),Number(node.longitude))),first=nodes[0];
        const options={container:canvas.querySelector('[data-mobility-map]'),style:window.JourneyDeckMapTheme?.style||'https://tiles.openfreemap.org/styles/dark',center:first?[Number(first.longitude),Number(first.latitude)]:[-97,32.8],zoom:9,attributionControl:true};
        const map=new maplibregl.Map(window.JourneyDeckMapTheme?.options(options)||options);window.JourneyDeckMapTheme?.attach(map);mobilityMap=map;map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
        map.on('load',()=>{if(mobilityMap!==map)return;addMapLayers(map);const bounds=new maplibregl.LngLatBounds();nodes.forEach(node=>bounds.extend([Number(node.longitude),Number(node.latitude)]));graph.representativeLines.features.forEach(feature=>feature.geometry.coordinates.forEach(coordinate=>bounds.extend(coordinate)));if(!bounds.isEmpty())map.fitBounds(bounds,{padding:60,maxZoom:12,duration:0});scheduleJourneyMap(map,0);});
      }catch(error){canvas.innerHTML=`<div class="empty-state"><h3>Mobility map unavailable</h3><p>${escape(error.message)}</p></div>`;}
    }

    function render(){
      const summary=document.getElementById('mobilityGraphSummary'),canvas=document.getElementById('mobilityGraphCanvas');if(!summary||!canvas||!graph)return;
      const values=[graph.summary.placeCount,graph.summary.connectionCount,graph.summary.driveCount,`${number(graph.summary.totalMiles)} mi`];summary.querySelectorAll('strong').forEach((element,index)=>{element.textContent=values[index]??'--';});renderIntelligence();
      if(!graph.nodes.length){canvas.innerHTML='<div class="empty-state"><h3>Your Atlas is waiting for its first journey</h3><p>Places and connections will appear automatically.</p></div>';setStatus('No retained journeys');return;}
      void renderGeographicMap(canvas);select(selectedId&&nodeMap().has(selectedId)?selectedId:graph.nodes[0].id);
    }

    function renderIntelligence(){
      const routines=document.getElementById('mobilityRoutines'),changes=document.getElementById('mobilityChanges'),nodes=nodeMap();
      if(routines){const items=(graph?.routines||[]).slice(0,10);routines.innerHTML=items.length?items.map(item=>{const selected=routineTypes.some(([value])=>value===item.type)?item.type:'frequent-route',options=routineTypes.map(([value,label])=>`<option value="${value}"${selected===value?' selected':''}>${escape(label)}</option>`).join(''),source=nodes.get(item.source),target=nodes.get(item.target),addresses=[item.sourceAddress,item.targetAddress].filter(Boolean).join(' → ');return`<article class="mobility-routine-card status-suggested" data-routine-card="${escape(item.id)}"><div><span class="mobility-pattern-type">Suggested by JourneyDeck</span><span class="mobility-confidence">${escape(item.confidenceLabel||'early signal')} confidence</span></div><h4>${escape(item.title)}</h4>${addresses?`<address>${escape(addresses)}</address>`:''}<p>${escape(item.narrative)}</p><small>${number(item.driveCount)} supporting journeys</small><details class="mobility-card-place-labeler"><summary>Change place labels</summary><div><label>Start place<input data-card-place-name="source" maxlength="80" value="${escape(item.sourceLabel||source?.label||'')}"></label><button class="secondary-button compact" type="button" data-save-card-place="source">Save</button></div><div><label>Destination<input data-card-place-name="target" maxlength="80" value="${escape(item.targetLabel||target?.label||'')}"></label><button class="secondary-button compact" type="button" data-save-card-place="target">Save</button></div><span class="mobility-place-save-status" data-card-place-status aria-live="polite"></span></details><div class="mobility-routine-editor"><label>Is this a routine?<select data-routine-type>${options}</select></label><label class="mobility-custom-routine${selected==='custom'?' visible':''}">Routine name<input data-routine-custom maxlength="60" value="${escape(item.title)}"></label><div><button class="primary-button compact" type="button" data-confirm-routine>Confirm</button><button class="secondary-button compact" type="button" data-dismiss-routine>Keep dismissed</button></div></div></article>`;}).join(''):'<div class="mobility-intelligence-empty"><strong>Pattern queue reviewed</strong><span>New patterns will appear as your journey history grows.</span></div>';bindRoutineEditors(routines);}
      if(changes){const items=(graph?.changeInsights||[]).slice(0,3);changes.innerHTML=items.map(item=>{const direction=safeDirection(item.direction);return`<article class="mobility-change-card direction-${direction}"><span class="mobility-change-direction" aria-hidden="true">${direction==='up'?'↗':direction==='down'?'↘':direction==='new'?'+':'→'}</span><div><h4>${escape(item.title)}</h4><p>${escape(item.narrative)}</p><small>${escape(item.confidence||'early')} confidence</small></div></article>`;}).join('');}
    }

    function patchLabel(placeId,name,category){
      const node=nodeMap().get(placeId);if(node){node.label=name;node.address=name;node.category=category;}graph.routines.forEach(item=>{if(item.source===placeId){item.sourceLabel=name;item.sourceAddress=name;}if(item.target===placeId){item.targetLabel=name;item.targetAddress=name;}item.title=`${item.sourceLabel} to ${item.targetLabel}`;});const source=mobilityMap?.getSource('mobility-places');if(source)source.setData(placeGeoJson());renderIntelligence();if(selectedId===placeId&&node)void inspect(node);
    }

    async function savePlace(node,form){
      const button=form.querySelector('button[type="submit"]'),name=String(form.elements.name.value||'').trim(),category=safeCategory(form.elements.category.value);button.disabled=true;setStatus('Saving your correction…');const request=()=>api.post('/api/atlas/places/label',{placeId:node.id,name,category,latitude:Number(node.latitude),longitude:Number(node.longitude),radiusFeet:200});placeSaveQueue=placeSaveQueue.catch(()=>{}).then(request);try{await placeSaveQueue;patchLabel(node.id,name,category);setStatus('Saved to your private Atlas');}catch(error){setStatus(error.message||'This label could not be saved.');}finally{button.disabled=false;}
    }

    async function saveCardPlace(card,side,button){
      const item=graph.routines.find(candidate=>candidate.id===card.dataset.routineCard),node=nodeMap().get(item?.[side]),input=card.querySelector(`[data-card-place-name="${side}"]`),status=card.querySelector('[data-card-place-status]'),name=String(input?.value||'').trim();if(!item||!node||!name)return;button.disabled=true;if(status)status.textContent='Writing this label…';const request=()=>api.post('/api/atlas/places/label',{placeId:node.id,name,category:safeCategory(node.category),latitude:Number(node.latitude),longitude:Number(node.longitude),radiusFeet:200});placeSaveQueue=placeSaveQueue.catch(()=>{}).then(request);try{await placeSaveQueue;patchLabel(node.id,name,safeCategory(node.category));if(status)status.textContent=`${name} saved. You can save the other label now.`;}catch(error){if(status){status.textContent=error.message||'This label could not be saved.';status.classList.add('is-error');}}finally{button.disabled=false;}
    }

    async function reviewRoutine(card,button,status,body={}){
      const id=card.dataset.routineCard,item=graph.routines.find(candidate=>candidate.id===id);if(!item)return;button.disabled=true;card.classList.add('is-saving');graph.routines=graph.routines.filter(candidate=>candidate.id!==id);renderIntelligence();setStatus('Saving · the next recurring pattern is ready');const request=()=>api.post(`/api/atlas/patterns/${encodeURIComponent(id)}/${status==='confirmed'?'confirm':'dismiss'}`,body);routineSaveQueue=routineSaveQueue.catch(()=>{}).then(request);try{await routineSaveQueue;const result=await api.get('/api/atlas/patterns?limit=10');graph.routines=result.items||[];renderIntelligence();setStatus('Saved · the next recurring pattern is ready');}catch(error){graph.routines=[item,...graph.routines].slice(0,10);renderIntelligence();setStatus(`Save failed · the pattern is ready to retry: ${error.message}`);}
    }

    function bindRoutineEditors(container){container.querySelectorAll('[data-routine-card]').forEach(card=>{const select=card.querySelector('[data-routine-type]'),custom=card.querySelector('.mobility-custom-routine');select?.addEventListener('change',()=>custom?.classList.toggle('visible',select.value==='custom'));card.querySelector('[data-confirm-routine]')?.addEventListener('click',event=>void reviewRoutine(card,event.currentTarget,'confirmed',{type:select.value,customName:card.querySelector('[data-routine-custom]').value}));card.querySelector('[data-dismiss-routine]')?.addEventListener('click',event=>void reviewRoutine(card,event.currentTarget,'dismissed'));card.querySelectorAll('[data-save-card-place]').forEach(button=>button.addEventListener('click',()=>void saveCardPlace(card,button.dataset.saveCardPlace,button)));});}

    async function load(force=false){
      if(force)loaded=false;if(loaded)return graph;if(loading)return loading;loading=api.get('/api/atlas/bootstrap').then(data=>{graph={...data,nodes:Array.isArray(data.places)?data.places:[],routines:Array.isArray(data.patterns)?data.patterns:[],summary:{...data.summary,driveCount:data.summary?.journeyCount||0},representativeLines:data.representativeLines||{type:'FeatureCollection',features:[]}};loaded=true;render();return graph;}).catch(error=>{const canvas=document.getElementById('mobilityGraphCanvas');if(canvas)canvas.innerHTML=`<div class="empty-state"><h3>Mobility map unavailable</h3><p>${escape(error.message)}</p></div>`;throw error;}).finally(()=>{loading=null;});return loading;
    }

    function bind(){document.addEventListener('journeydeck:viewchange',event=>{if(event.detail?.view==='graph')void load();});if(location.hash==='#graph')void load();}
    return Object.freeze({load,render,bind});
  }

  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.mobilityGraph=Object.freeze({create,positions});
})();
