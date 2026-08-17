(function(){
  const escape=value=>window.DriveOSDom.escapeHtml(value);
  const number=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(Number(value)||0);
  const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Unknown':parsed.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});};
  const categoryName=value=>({home:'Home',work:'Work',family:'Family',errands:'Errands',dining:'Dining',wellness:'Wellness',routine:'Frequent place',other:'Other'}[value]||'Other');
  const safeCategory=value=>['home','work','family','errands','dining','wellness','routine','other'].includes(value)?value:'other';
  const safeDirection=value=>['up','down','new','stable','neutral'].includes(value)?value:'neutral';
  const placeCategories=[['home','Home'],['work','Work'],['family','Family'],['errands','Errands'],['dining','Dining'],['wellness','Wellness'],['other','Other']];
  const routineTypes=[['commute','Commute'],['school-run','School run'],['family-visit','Family visit'],['errand-loop','Errand loop'],['frequent-route','Frequent route'],['custom','Custom']];
  const routineName=value=>Object.fromEntries(routineTypes)[value]||'Suggested pattern';
  const journeyCopy=value=>String(value||'').replace(/\bdrives\b/gi,'journeys').replace(/\bdrive\b/gi,'journey');
  const reviewedStorageKey='journeydeck-reviewed-routines-v1';
  const savedPlaceLabelsStorageKey='journeydeck-saved-place-labels-v1';
  try{localStorage.removeItem(savedPlaceLabelsStorageKey);}catch{}
  const reviewedRoutineIds=()=>{try{return new Set(JSON.parse(localStorage.getItem(reviewedStorageKey)||'[]'));}catch{return new Set();}};
  const rememberReviewedRoutine=id=>{const ids=reviewedRoutineIds();ids.add(id);try{localStorage.setItem(reviewedStorageKey,JSON.stringify([...ids].slice(-1000)));}catch{}};
  const forgetReviewedRoutine=id=>{const ids=reviewedRoutineIds();ids.delete(id);try{localStorage.setItem(reviewedStorageKey,JSON.stringify([...ids]));}catch{}};
  const validCoordinate=(latitude,longitude)=>Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;
  const distanceMiles=(start,end)=>{
    const radians=value=>value*Math.PI/180;
    const lat1=radians(start[1]),lat2=radians(end[1]),deltaLat=lat2-lat1,deltaLon=radians(end[0]-start[0]);
    const value=Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLon/2)**2;
    return 3958.8*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
  };
  function representativeJourneyFeatures(drives,limit=200){
    const corridors=new Map();
    (Array.isArray(drives)?drives:[]).forEach((drive,index)=>{
      const start=[Number(drive.startingLongitude),Number(drive.startingLatitude)];
      const end=[Number(drive.endingLongitude),Number(drive.endingLatitude)];
      if(!validCoordinate(start[1],start[0])||!validCoordinate(end[1],end[0]))return;
      const miles=distanceMiles(start,end);if(miles<.08)return;
      const endpointKey=point=>`${point[0].toFixed(3)},${point[1].toFixed(3)}`;
      const routeKey=[endpointKey(start),endpointKey(end)].sort().join('|');
      const candidate={start,end,miles,index};
      const previous=corridors.get(routeKey);if(!previous||candidate.miles>previous.miles)corridors.set(routeKey,candidate);
    });
    const candidates=[...corridors.values()];if(!candidates.length)return[];
    const selected=[];const remaining=new Set(candidates);
    while(selected.length<Math.min(Math.max(1,limit),candidates.length)){
      let best=null,bestScore=-Infinity;
      remaining.forEach(candidate=>{
        const novelty=selected.length?Math.min(...selected.flatMap(item=>[
          distanceMiles(candidate.start,item.start),distanceMiles(candidate.start,item.end),
          distanceMiles(candidate.end,item.start),distanceMiles(candidate.end,item.end)
        ])):candidate.miles;
        const score=candidate.miles*.58+novelty*.42;
        if(score>bestScore){best=candidate;bestScore=score;}
      });
      if(!best)break;selected.push(best);remaining.delete(best);
    }
    return selected.map((item,index)=>({type:'Feature',properties:{distanceMiles:item.miles,palette:index%3},geometry:{type:'LineString',coordinates:[item.start,item.end]}}));
  }
  const mobilityHash=async(kind,key)=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${kind}:${key}`));
    return `${kind}-${[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('').slice(0,12)}`;
  };
  const genericImportedLabel=value=>/^(google timeline location|imported timeline locations?)$/i.test(String(value||'').trim());
  const coordinatePlaceLabel=value=>/^(?:imported|unknown) place\s+-?\d{1,3}(?:\.\d+)?\s*[, ]\s*-?\d{1,3}(?:\.\d+)?$/i.test(String(value||'').trim());
  const unresolvedPlaceText=value=>genericImportedLabel(value)||coordinatePlaceLabel(value)||/multiple coordinates|not one address/i.test(String(value||''));
  const importedPlaceLabel=endpoint=>endpoint.businessName||(!genericImportedLabel(endpoint.label)?endpoint.label:`Imported place ${endpoint.latitude.toFixed(3)}, ${endpoint.longitude.toFixed(3)}`);
  const enrichmentIndex=places=>{const list=(Array.isArray(places)?places:[]).filter(place=>validCoordinate(Number(place.latitude),Number(place.longitude)));return{list,exact:new Map(list.map(place=>[`${Number(place.latitude).toFixed(4)},${Number(place.longitude).toFixed(4)}`,place]))};};
  const placeEnrichment=(index,latitude,longitude)=>{const exact=index.exact.get(`${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`);if(exact?.source==='manual')return exact;let manual=null,manualMiles=Infinity,closest=exact||null,miles=exact?0:Infinity;index.list.forEach(place=>{const candidate=distanceMiles([Number(longitude),Number(latitude)],[Number(place.longitude),Number(place.latitude)]),radius=Number(place.radiusMiles)||.16;if(candidate>radius)return;if(place.source==='manual'&&candidate<manualMiles){manual=place;manualMiles=candidate;}else if(candidate<miles){closest=place;miles=candidate;}});return manual||closest;};
  async function loadAtlasPlaceEnrichment(api){
    try{
      const result=await api.get('/api/atlas/places');return Array.isArray(result?.places)?result.places:[];
    }catch{return[];}
  }
  async function buildImportedJourneyRoutines(drives,enrichedPlaces=[]){
    const enriched=enrichmentIndex(enrichedPlaces);
    const imported=(Array.isArray(drives)?drives:[]).filter(drive=>String(drive.driverProfile||'').toLowerCase().includes('google timeline')||genericImportedLabel(drive.rawStartingLocation)||genericImportedLabel(drive.rawEndingLocation)).sort((a,b)=>String(a.startedAt||'').localeCompare(String(b.startedAt||'')));
    const places=[],groups=new Map(),placeBuckets=new Map(),cellSize=.004;
    const bucketKey=(latitude,longitude)=>`${Math.floor(latitude/cellSize)}:${Math.floor(longitude/cellSize)}`;
    const placeFor=endpoint=>{const latCell=Math.floor(endpoint.latitude/cellSize),lonCell=Math.floor(endpoint.longitude/cellSize),nearby=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)nearby.push(...(placeBuckets.get(`${latCell+y}:${lonCell+x}`)||[]));let place=nearby.find(candidate=>distanceMiles([candidate.longitude,candidate.latitude],[endpoint.longitude,endpoint.latitude])<=.2);if(!place){place={...endpoint,index:places.length};places.push(place);const key=bucketKey(endpoint.latitude,endpoint.longitude),bucket=placeBuckets.get(key)||[];bucket.push(place);placeBuckets.set(key,bucket);}else if(endpoint.businessName&&!place.businessName){place.businessName=endpoint.businessName;place.businessAddress=endpoint.businessAddress;}return place;};
    imported.forEach(drive=>{
      const endpoints=[{label:genericImportedLabel(drive.rawStartingLocation)?drive.rawStartingLocation:(drive.startingLocation||drive.rawStartingLocation),latitude:Number(drive.startingLatitude),longitude:Number(drive.startingLongitude)},{label:genericImportedLabel(drive.rawEndingLocation)?drive.rawEndingLocation:(drive.endingLocation||drive.rawEndingLocation),latitude:Number(drive.endingLatitude),longitude:Number(drive.endingLongitude)}].map(endpoint=>{const match=placeEnrichment(enriched,endpoint.latitude,endpoint.longitude);return match?{...endpoint,businessName:match.name,businessAddress:match.address}:endpoint;});
      if(!endpoints.every(point=>validCoordinate(point.latitude,point.longitude)))return;
      const start=placeFor(endpoints[0]),end=placeFor(endpoints[1]);if(start.index===end.index)return;
      const pair=[start.index,end.index].sort((a,b)=>a-b),key=pair.join('|');
      const group=groups.get(key)||{a:places[pair[0]],b:places[pair[1]],drives:[],directions:new Set()};group.drives.push(drive);group.directions.add(`${start.index}>${end.index}`);groups.set(key,group);
    });
    await Promise.all(places.map(async place=>{place.id=await mobilityHash('place',`${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`);}));
    const routines=[];
    for(const group of groups.values()){
      if(group.drives.length<3)continue;
      const pair=[group.a.id,group.b.id].sort(),id=await mobilityHash('routine',`${pair[0]}|${pair[1]}`),moments=group.drives.map(drive=>new Date(drive.startedAt)).filter(value=>!Number.isNaN(value.getTime()));
      const hours=moments.map(value=>value.getHours()),days=moments.map(value=>value.getDay()),timeBand=hours.length?(['late night','morning','afternoon','evening'].map(label=>({label,count:hours.filter(hour=>label==='morning'?hour>=5&&hour<12:label==='afternoon'?hour>=12&&hour<17:label==='evening'?hour>=17&&hour<22:hour<5||hour>=22).length})).sort((a,b)=>b.count-a.count)[0].label):'varied times';
      const weekdays=days.filter(day=>day>=1&&day<=5).length,dayPattern=!days.length?'across the week':weekdays/days.length>=.7?'on weekdays':(days.length-weekdays)/days.length>=.7?'on weekends':'across the week';
      const aLabel=importedPlaceLabel(group.a),bLabel=importedPlaceLabel(group.b);
      const aAddress=group.a.businessAddress||aLabel,bAddress=group.b.businessAddress||bLabel;
      if(aLabel.toLowerCase()===bLabel.toLowerCase()&&(aLabel.toLowerCase()==='home'||aAddress.toLowerCase()===bAddress.toLowerCase()))continue;
      routines.push({id,type:'frequent-route',inferredType:'frequent-route',title:`${aLabel} to ${bLabel}`,sourceLabel:aLabel,targetLabel:bLabel,narrative:`${group.drives.length} imported journeys, ${dayPattern}, usually in the ${timeBand}.`,source:group.a.id,target:group.b.id,sourceLatitude:group.a.latitude,sourceLongitude:group.a.longitude,targetLatitude:group.b.latitude,targetLongitude:group.b.longitude,driveCount:group.drives.length,bidirectional:group.directions.size>1,sourceAddress:aAddress,targetAddress:bAddress,typicalTime:timeBand,dayPattern,confidenceLabel:group.drives.length>=5?'high':'medium',confirmationStatus:'suggested',imported:true});
    }
    return routines.sort((a,b)=>b.driveCount-a.driveCount||a.title.localeCompare(b.title)).slice(0,250);
  }

  function positions(nodes,frame={}){
    const width=Number(frame.width)||900,height=Number(frame.height)||520,padding=Number(frame.padding)||72;
    const located=nodes.filter(node=>Number.isFinite(Number(node.latitude))&&Number.isFinite(Number(node.longitude)));
    const allLocated=located.length===nodes.length&&nodes.length>1;
    if(allLocated){
      const lats=nodes.map(node=>Number(node.latitude)),lons=nodes.map(node=>Number(node.longitude));
      const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
      const latSpan=Math.max(maxLat-minLat,.01),lonSpan=Math.max(maxLon-minLon,.01);
      return new Map(nodes.map(node=>[node.id,{x:padding+((Number(node.longitude)-minLon)/lonSpan)*(width-padding*2),y:height-padding-((Number(node.latitude)-minLat)/latSpan)*(height-padding*2)}]));
    }
    const centerX=width/2,centerY=height/2,radius=Math.min(width,height)*.36;
    return new Map(nodes.map((node,index)=>{const angle=(Math.PI*2*index/Math.max(nodes.length,1))-Math.PI/2;return[node.id,{x:centerX+Math.cos(angle)*radius,y:centerY+Math.sin(angle)*radius}];}));
  }

  function create({api,state}){
    let graph=null,loaded=false,loading=null,selectedId=null,mobilityMap=null,mobilityMarkers=[],mapDrives=[],placeSaveQueue=Promise.resolve(),routineSaveQueue=Promise.resolve();
    const nodeMap=()=>new Map((graph?.nodes||[]).map(node=>[node.id,node]));
    function enrichAddresses(){
      const endpoints=(state?.drives||[]).flatMap(drive=>[
        {label:drive.startingLocation,address:drive.rawStartingLocation||drive.startingLocation,latitude:Number(drive.startingLatitude),longitude:Number(drive.startingLongitude)},
        {label:drive.endingLocation,address:drive.rawEndingLocation||drive.endingLocation,latitude:Number(drive.endingLatitude),longitude:Number(drive.endingLongitude)}
      ]).filter(item=>item.address);
      (graph?.nodes||[]).forEach(node=>{if(node.address)return;const lat=Number(node.latitude),lon=Number(node.longitude);let match=null;if(Number.isFinite(lat)&&Number.isFinite(lon)){match=endpoints.filter(item=>Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)).sort((a,b)=>((a.latitude-lat)**2+(a.longitude-lon)**2)-((b.latitude-lat)**2+(b.longitude-lon)**2))[0];if(match&&Math.hypot(match.latitude-lat,match.longitude-lon)>.01)match=null;}if(!match)match=endpoints.find(item=>String(item.label||'').toLowerCase()===String(node.originalLabel||node.label||'').toLowerCase());if(match)node.address=match.address;});
      (graph?.nodes||[]).forEach(node=>{if(/^Google Timeline location$/i.test(String(node.address||''))&&Number(node.visitCount)>100){node.dataQualityIssue=true;node.label='Imported Timeline locations';node.address='Multiple coordinates · the Google export did not include street addresses';node.category='other';}});
      const nodes=nodeMap();(graph?.routines||[]).forEach(item=>{item.sourceAddress=item.sourceAddress||nodes.get(item.source)?.address;item.targetAddress=item.targetAddress||nodes.get(item.target)?.address;});
      (graph?.routines||[]).forEach(item=>{const source=nodes.get(item.source),target=nodes.get(item.target);if(source?.dataQualityIssue||target?.dataQualityIssue){item.title='Imported Timeline journey cluster';item.sourceAddress='Not one address';item.targetAddress='Not one address';item.narrative=`${number(item.driveCount)} reconstructed journeys were grouped by an old placeholder-key bug. They are not one Waffle House route.`;}});
    }
    function removeImportedPlaceArtifacts(){
      if(!graph)return;
      const hidden=new Set((graph.nodes||[]).filter(node=>node.dataQualityIssue||unresolvedPlaceText(node.label)||unresolvedPlaceText(node.address)).map(node=>node.id));
      graph.nodes=(graph.nodes||[]).filter(node=>!hidden.has(node.id));
      graph.edges=(graph.edges||[]).filter(edge=>!hidden.has(edge.source)&&!hidden.has(edge.target));
      graph.routines=(graph.routines||[]).filter(item=>!hidden.has(item.source)&&!hidden.has(item.target)&&!unresolvedPlaceText(item.title)&&!unresolvedPlaceText(item.sourceAddress)&&!unresolvedPlaceText(item.targetAddress));
      if(graph.summary){graph.summary.placeCount=graph.nodes.length;graph.summary.connectionCount=graph.edges.length;}
      if(selectedId&&hidden.has(selectedId))selectedId=null;
    }
    function deduplicateRoutines(){
      if(!graph)return;
      const nodes=nodeMap(),groups=new Map(),passthrough=[];
      const endpointIdentity=(item,side)=>{const node=nodes.get(item[side]),label=String(item[`${side}Label`]||node?.label||'').trim().toLowerCase(),address=String(item[`${side}Address`]||node?.address||'').trim().toLowerCase();return `${label}|${address}`;};
      (graph.routines||[]).forEach(item=>{
        if((item.confirmationStatus||'suggested')!=='suggested'){passthrough.push(item);return;}
        const key=[endpointIdentity(item,'source'),endpointIdentity(item,'target')].sort().join('→');
        if(key==='|→|'){passthrough.push(item);return;}
        const existing=groups.get(key),ids=new Set([item.id,...(item.relatedRoutineIds||[])]);
        if(!existing){groups.set(key,{...item,relatedRoutineIds:[...ids]});return;}
        (existing.relatedRoutineIds||[]).forEach(id=>ids.add(id));
        const representative=(Number(item.driveCount)||0)>(Number(existing.driveCount)||0)?item:existing;
        groups.set(key,{...representative,relatedRoutineIds:[...ids]});
      });
      graph.routines=[...groups.values(),...passthrough].sort((a,b)=>(Number(b.driveCount)||0)-(Number(a.driveCount)||0));
    }
    function consolidateHomeNodes(){
      if(!graph)return;
      const fences=(graph.placeGeofences||[]).filter(fence=>String(fence.category||'').toLowerCase()==='home'||String(fence.name||'').trim().toLowerCase()==='home');
      const insideHomeFence=node=>fences.some(fence=>validCoordinate(Number(node.latitude),Number(node.longitude))&&validCoordinate(Number(fence.latitude),Number(fence.longitude))&&distanceMiles([Number(node.longitude),Number(node.latitude)],[Number(fence.longitude),Number(fence.latitude)])<=Number(fence.radiusFeet||200)/5280);
      const homes=(graph.nodes||[]).filter(node=>node.kind==='home'||node.category==='home'||String(node.label||'').trim().toLowerCase()==='home'||insideHomeFence(node));
      if(!homes.length)return;
      const canonical=[...homes].sort((a,b)=>Number(validCoordinate(Number(b.latitude),Number(b.longitude)))-Number(validCoordinate(Number(a.latitude),Number(a.longitude)))||(Number(b.visitCount)||0)-(Number(a.visitCount)||0))[0],homeIds=new Set(homes.map(node=>node.id)),journeyIds=new Set(),retainedHomeJourneyIds=new Set(),homeZones=[...fences];
      if(validCoordinate(Number(canonical.latitude),Number(canonical.longitude)))homeZones.push({latitude:canonical.latitude,longitude:canonical.longitude,radiusFeet:200});
      (state?.drives||[]).forEach((drive,index)=>{const endpointIsHome=side=>{const label=String(drive[`${side}Location`]||drive[`raw${side[0].toUpperCase()}${side.slice(1)}Location`]||'').trim().toLowerCase();if(label==='home')return true;const latitude=Number(drive[`${side}Latitude`]),longitude=Number(drive[`${side}Longitude`]);return homeZones.some(fence=>validCoordinate(latitude,longitude)&&validCoordinate(Number(fence.latitude),Number(fence.longitude))&&distanceMiles([longitude,latitude],[Number(fence.longitude),Number(fence.latitude)])<=Number(fence.radiusFeet||200)/5280);};if(endpointIsHome('starting')||endpointIsHome('ending'))retainedHomeJourneyIds.add(drive.id||`journey-${index}`);});
      (graph.edges||[]).forEach(edge=>{if(homeIds.has(edge.source)||homeIds.has(edge.target))(edge.driveIds||[]).forEach(id=>journeyIds.add(id));});
      canonical.label='Home';canonical.kind='home';canonical.category='home';canonical.categoryConfidence='confirmed';canonical.categoryReason='All saved Home mentions are consolidated inside one place.';
      canonical.visitCount=retainedHomeJourneyIds.size||journeyIds.size||homes.reduce((total,node)=>total+(Number(node.visitCount)||0),0);
      canonical.arrivals=homes.reduce((total,node)=>total+(Number(node.arrivals)||0),0);canonical.departures=homes.reduce((total,node)=>total+(Number(node.departures)||0),0);canonical.totalMiles=homes.reduce((total,node)=>total+(Number(node.totalMiles)||0),0);
      canonical.firstSeenAt=homes.map(node=>node.firstSeenAt).filter(Boolean).sort()[0]||canonical.firstSeenAt;canonical.lastSeenAt=homes.map(node=>node.lastSeenAt).filter(Boolean).sort().at(-1)||canonical.lastSeenAt;
      const remap=id=>homeIds.has(id)?canonical.id:id,mergedEdges=new Map();
      (graph.edges||[]).forEach(edge=>{const source=remap(edge.source),target=remap(edge.target);if(source===target)return;const key=`${source}>${target}`,current=mergedEdges.get(key);if(!current){mergedEdges.set(key,{...edge,source,target,driveIds:[...(edge.driveIds||[])]});return;}const ids=new Set([...(current.driveIds||[]),...(edge.driveIds||[])]);current.driveIds=[...ids];current.driveCount=ids.size||((Number(current.driveCount)||0)+(Number(edge.driveCount)||0));current.totalMiles=(Number(current.totalMiles)||0)+(Number(edge.totalMiles)||0);});
      graph.nodes=(graph.nodes||[]).filter(node=>!homeIds.has(node.id)||node.id===canonical.id);graph.edges=[...mergedEdges.values()];
      const nodes=nodeMap();graph.routines=(graph.routines||[]).map(item=>({...item,source:remap(item.source),target:remap(item.target)})).filter(item=>item.source!==item.target).map(item=>{const source=nodes.get(item.source),target=nodes.get(item.target);return{...item,title:source&&target?`${source.label} to ${target.label}`:item.title,sourceAddress:source?.address||item.sourceAddress,targetAddress:target?.address||item.targetAddress};});
      if(graph.summary){graph.summary.placeCount=graph.nodes.length;graph.summary.connectionCount=graph.edges.length;}
      if(selectedId&&homeIds.has(selectedId))selectedId=canonical.id;
    }
    function applyAtlasPlaceEnrichment(places){
      const index=enrichmentIndex(places);
      (graph?.nodes||[]).forEach(node=>{const match=placeEnrichment(index,Number(node.latitude),Number(node.longitude));if(!match)return;if(genericImportedLabel(node.label)||genericImportedLabel(node.originalLabel))node.label=match.name||node.label;if(match.address)node.address=match.address;node.atlasPlaceSource=match.source||'persisted';});
      consolidateHomeNodes();
    }
    function bindViewport(canvas,svg,frame){
      const base={x:0,y:0,width:frame.width,height:frame.height};
      const view={...base};
      let drag=null;
      const clamp=()=>{view.width=Math.min(base.width,Math.max(base.width/5,view.width));view.height=view.width*(base.height/base.width);view.x=Math.min(base.width-view.width,Math.max(0,view.x));view.y=Math.min(base.height-view.height,Math.max(0,view.y));};
      const apply=()=>{clamp();svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);};
      const zoom=(factor,clientX,clientY)=>{const rect=svg.getBoundingClientRect();const px=clientX==null ? .5 : Math.min(1,Math.max(0,(clientX-rect.left)/Math.max(rect.width,1)));const py=clientY==null ? .5 : Math.min(1,Math.max(0,(clientY-rect.top)/Math.max(rect.height,1)));const nextWidth=view.width*factor,nextHeight=nextWidth*(base.height/base.width);view.x+=(view.width-nextWidth)*px;view.y+=(view.height-nextHeight)*py;view.width=nextWidth;view.height=nextHeight;apply();};
      canvas.querySelector('[data-mobility-zoom-in]')?.addEventListener('click',()=>zoom(.72));
      canvas.querySelector('[data-mobility-zoom-out]')?.addEventListener('click',()=>zoom(1.38));
      canvas.querySelector('[data-mobility-zoom-reset]')?.addEventListener('click',()=>{Object.assign(view,base);apply();});
      svg.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY<0 ? .82 : 1.22,event.clientX,event.clientY);},{passive:false});
      svg.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,viewX:view.x,viewY:view.y};svg.setPointerCapture(event.pointerId);svg.classList.add('is-dragging');});
      svg.addEventListener('pointermove',event=>{if(!drag)return;const rect=svg.getBoundingClientRect();view.x=drag.viewX-(event.clientX-drag.x)*(view.width/Math.max(rect.width,1));view.y=drag.viewY-(event.clientY-drag.y)*(view.height/Math.max(rect.height,1));apply();});
      const end=event=>{if(!drag)return;drag=null;svg.classList.remove('is-dragging');if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);};
      svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
    }
    function inspect(node){
      const inspector=document.getElementById('mobilityPlaceInspector');if(!inspector||!graph)return;inspector.hidden=false;
      if(node.kind==='home'||node.category==='home'){
        inspector.innerHTML=`<div class="mobility-home-summary"><div class="section-label">HOME</div><h3>${escape(node.label||'Home')}</h3><strong>${number(node.visitCount)}</strong><span>moments when Home anchored your journey</span></div>`;
        return;
      }
      const nodes=nodeMap();
      const connectedByPlace=new Map();graph.edges.filter(edge=>edge.source===node.id||edge.target===node.id).forEach(edge=>{const other=nodes.get(edge.source===node.id?edge.target:edge.source);if(!other)return;const current=connectedByPlace.get(other.id)||{other,driveCount:0};current.driveCount+=Number(edge.driveCount)||0;connectedByPlace.set(other.id,current);});
      const connected=[...connectedByPlace.values()].sort((a,b)=>b.driveCount-a.driveCount).slice(0,5);
      const categoryOptions=placeCategories.map(([value,label])=>`<option value="${value}"${safeCategory(node.category)===value?' selected':''}>${escape(label)}</option>`).join('');
      inspector.innerHTML=`<div class="section-label">${escape(node.kind==='home'?'ANCHOR PLACE':'MOBILITY PLACE')}</div><h3>${escape(node.label)}</h3><p class="mobility-place-address">${escape(node.address||node.originalLabel||'Address unavailable')}</p><div class="mobility-identity"><span class="mobility-category category-${safeCategory(node.category)}">${escape(categoryName(node.category))}</span><span>${escape(node.categoryConfidence||'low')} confidence</span></div><p class="mobility-identity-reason">${escape(node.categoryReason||'JourneyDeck needs more evidence to identify this place.')}</p><form class="mobility-place-editor" data-mobility-place-form><label>Name<input name="name" maxlength="80" required value="${escape(node.label)}"></label><label>Identity<select name="category">${categoryOptions}</select></label><div><button class="primary-button compact" type="submit">Save identity</button>${node.manualOverride?'<button class="secondary-button compact" type="button" data-reset-place>Use suggestion</button>':''}</div></form><div class="mobility-place-facts"><span><strong>${number(node.visitCount)}</strong> visits</span><span><strong>${number(node.arrivals)}</strong> arrivals</span><span><strong>${number(node.departures)}</strong> departures</span></div><p>Seen from ${escape(date(node.firstSeenAt))} through ${escape(date(node.lastSeenAt))}.</p><div class="mobility-connections"><div class="section-label">STRONGEST CONNECTIONS</div>${connected.length?connected.map(item=>`<div><span>${escape(item.other.label)}<small>${escape(item.other.address||'')}</small></span><strong>${number(item.driveCount)} journey${Number(item.driveCount)===1?'':'s'}</strong></div>`).join(''):'<p>No connected journey is available yet.</p>'}</div>`;
      const form=inspector.querySelector('[data-mobility-place-form]');form?.addEventListener('submit',event=>{event.preventDefault();void savePlace(node,form);});inspector.querySelector('[data-reset-place]')?.addEventListener('click',event=>void resetPlace(node,event.currentTarget));
    }
    function select(nodeId){selectedId=nodeId;document.querySelectorAll('[data-mobility-node]').forEach(element=>element.classList.toggle('selected',element.dataset.mobilityNode===nodeId));document.querySelectorAll('[data-mobility-edge]').forEach(element=>element.classList.toggle('connected',element.dataset.mobilityEdgeSource===nodeId||element.dataset.mobilityEdgeTarget===nodeId));const node=nodeMap().get(nodeId);if(node)inspect(node);}
    async function renderGeographicMap(canvas,status){
      mobilityMarkers.forEach(marker=>marker.remove());mobilityMarkers=[];mobilityMap?.remove();mobilityMap=null;
      canvas.innerHTML='<div class="mobility-map" data-mobility-map aria-label="Interactive map of your journey places"></div><div class="mobility-graph-help">Drag to move · scroll or use controls to zoom</div><div class="mobility-place-attribution">Place labels © OpenStreetMap contributors · ODbL</div>';
      try{
        const maplibregl=await window.JourneyDeckMaps.ensureMapLibre();if(!canvas.isConnected)return;
        const nodes=(graph.nodes||[]).filter(node=>Number.isFinite(Number(node.latitude))&&Number.isFinite(Number(node.longitude)));
        const map=new maplibregl.Map({container:canvas.querySelector('[data-mobility-map]'),style:window.JourneyDeckMapTheme?.style||'https://tiles.openfreemap.org/styles/dark',center:[Number(nodes[0].longitude),Number(nodes[0].latitude)],zoom:10,attributionControl:true});
        window.JourneyDeckMapTheme?.attach(map);mobilityMap=map;map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
        map.on('load',()=>{
          const features=representativeJourneyFeatures(mapDrives,200);
          map.addSource('mobility-connections',{type:'geojson',data:{type:'FeatureCollection',features}});
          map.addLayer({id:'mobility-connections-glow',type:'line',source:'mobility-connections',paint:{'line-color':'#a64cff','line-width':6,'line-opacity':.2,'line-blur':4}});
          map.addLayer({id:'mobility-connections-line',type:'line',source:'mobility-connections',paint:{'line-color':'#b765ff','line-width':2.6,'line-opacity':.78}});
          const bounds=new maplibregl.LngLatBounds();nodes.forEach(node=>bounds.extend([Number(node.longitude),Number(node.latitude)]));features.forEach(feature=>feature.geometry.coordinates.forEach(coordinate=>bounds.extend(coordinate)));map.fitBounds(bounds,{padding:70,maxZoom:13,duration:0});
          if(status)status.textContent=`${number(features.length)} representative journey lines · ${number(graph.summary.driveCount)} journeys total`;
        });
        nodes.forEach(node=>{const element=document.createElement('button');element.type='button';element.className=`mobility-map-marker category-${safeCategory(node.category)}`;element.dataset.mobilityNode=node.id;element.setAttribute('aria-label',`${node.label}, ${node.address||'address unavailable'}, ${number(node.visitCount)} visits`);element.innerHTML=`<i></i><span><strong>${escape(node.label)}</strong><small>${escape(node.address||'')}</small></span>`;element.addEventListener('click',()=>select(node.id));mobilityMarkers.push(new maplibregl.Marker({element,anchor:'center'}).setLngLat([Number(node.longitude),Number(node.latitude)]).addTo(map));});
        if(status)status.textContent=`Selecting geographically diverse journeys from ${number(graph.summary.driveCount)} total…`;
      }catch(error){canvas.innerHTML=`<div class="empty-state"><h3>Mobility map unavailable</h3><p>${escape(error.message)}</p></div>`;}
    }
    function render(){
      const summary=document.getElementById('mobilityGraphSummary'),canvas=document.getElementById('mobilityGraphCanvas'),status=document.getElementById('mobilityGraphStatus');if(!summary||!canvas||!graph)return;
      const values=[graph.summary.placeCount,graph.summary.connectionCount,graph.summary.driveCount,`${number(graph.summary.totalMiles)} mi`];summary.querySelectorAll('strong').forEach((element,index)=>{element.textContent=values[index]??'--';});
      renderIntelligence();
      if(!graph.nodes.length){canvas.innerHTML='<div class="empty-state"><h3>Your graph is waiting for its first journey</h3><p>Places and connections will appear automatically.</p></div>';if(status)status.textContent='No retained journeys';return;}
      const compact=window.matchMedia('(max-width: 560px)').matches,frame=compact?{width:560,height:620,padding:76}:{width:900,height:520,padding:72};
      const locatedNodes=graph.nodes.filter(node=>Number.isFinite(Number(node.latitude))&&Number.isFinite(Number(node.longitude)));
      if(locatedNodes.length>1){void renderGeographicMap(canvas,status);select(selectedId&&nodeMap().has(selectedId)?selectedId:graph.nodes[0].id);return;}
      const points=positions(graph.nodes,frame),maxVisits=Math.max(...graph.nodes.map(node=>Number(node.visitCount)||1)),maxDrives=Math.max(...graph.edges.map(edge=>Number(edge.driveCount)||1),1);
      const edges=graph.edges.map(edge=>{const start=points.get(edge.source),end=points.get(edge.target);if(!start||!end)return'';const width=1.5+(Number(edge.driveCount)/maxDrives)*7;return`<line class="mobility-edge" data-mobility-edge data-mobility-edge-source="${escape(edge.source)}" data-mobility-edge-target="${escape(edge.target)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" style="--edge-width:${width}px"><title>${number(edge.driveCount)} journe${Number(edge.driveCount)===1?'y':'ys'} · ${number(edge.totalMiles)} miles</title></line>`;}).join('');
      const nodes=graph.nodes.map(node=>{const point=points.get(node.id),radius=10+(Number(node.visitCount)/maxVisits)*16;return`<g class="mobility-node category-${safeCategory(node.category)}" data-mobility-node="${escape(node.id)}" tabindex="0" role="button" aria-label="${escape(node.label)}, ${escape(categoryName(node.category))}, ${number(node.visitCount)} visits" transform="translate(${point.x} ${point.y})"><circle r="${radius}"></circle><circle class="mobility-node-core" r="${Math.max(4,radius*.34)}"></circle><text y="${radius+20}" text-anchor="middle">${escape(node.label)}</text></g>`;}).join('');
      canvas.innerHTML=`<div class="mobility-graph-viewport"><svg class="mobility-graph-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Personal mobility graph with ${number(graph.nodes.length)} places and ${number(graph.edges.length)} connections"><defs><linearGradient id="mobilityEdgeGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ba9be"/><stop offset="1" stop-color="#18c997"/></linearGradient></defs><g class="mobility-edges">${edges}</g><g class="mobility-nodes">${nodes}</g></svg></div><div class="mobility-graph-controls" role="group" aria-label="Mobility graph zoom controls"><button type="button" data-mobility-zoom-in aria-label="Zoom in">+</button><button type="button" data-mobility-zoom-out aria-label="Zoom out">−</button><button type="button" data-mobility-zoom-reset aria-label="Reset graph view">⌂</button></div><div class="mobility-graph-help">Drag to move · scroll to zoom</div>`;
      const svg=canvas.querySelector('.mobility-graph-svg');bindViewport(canvas,svg,frame);
      canvas.querySelectorAll('[data-mobility-node]').forEach(element=>{element.addEventListener('click',()=>select(element.dataset.mobilityNode));element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(element.dataset.mobilityNode);}});});
      if(status)status.textContent=`${number(graph.summary.driveCount)} journeys across ${number(graph.windowDays)} days`;
      select(selectedId&&nodeMap().has(selectedId)?selectedId:graph.nodes[0].id);
    }
    function renderIntelligence(){
      const routines=document.getElementById('mobilityRoutines'),changes=document.getElementById('mobilityChanges');
      if(routines){const reviewed=reviewedRoutineIds(),nodes=nodeMap();const items=(Array.isArray(graph?.routines)?graph.routines:[]).filter(item=>(item.confirmationStatus||'suggested')==='suggested'&&!reviewed.has(item.id)&&!(nodes.get(item.source)?.dataQualityIssue||nodes.get(item.target)?.dataQualityIssue)&&!unresolvedPlaceText(item.title)&&!unresolvedPlaceText(item.sourceAddress)&&!unresolvedPlaceText(item.targetAddress)).slice(0,10);routines.innerHTML=items.length?items.map(item=>{const inferred=['round-trip','frequent-route'].includes(item.inferredType)?'frequent-route':item.inferredType;const candidate=routineTypes.some(([value])=>value===item.type)?item.type:inferred;const selected=routineTypes.some(([value])=>value===candidate)?candidate:'frequent-route';const options=routineTypes.map(([value,label])=>`<option value="${value}"${selected===value?' selected':''}>${escape(label)}</option>`).join(''),source=nodes.get(item.source),target=nodes.get(item.target);const addresses=[item.sourceAddress,item.targetAddress].filter(Boolean).join(' → '),sourceName=item.sourceLabel||source?.label||item.sourceAddress||'',targetName=item.targetLabel||target?.label||item.targetAddress||'';return`<article class="mobility-routine-card status-suggested" data-routine-card="${escape(item.id)}"><div><span class="mobility-pattern-type">Suggested by JourneyDeck</span><span class="mobility-confidence">${escape(item.confidenceLabel||'early signal')} confidence</span></div><h4>${escape(item.title)}</h4>${addresses?`<address>${escape(addresses)}</address>`:''}<p>${escape(journeyCopy(item.narrative))}</p><small>${number(item.driveCount)} supporting journeys</small><details class="mobility-card-place-labeler"><summary>Change place labels</summary><div><label>Start place<input data-card-place-name="source" maxlength="80" value="${escape(sourceName)}"></label><button class="secondary-button compact" type="button" data-save-card-place="source">Save</button></div><div><label>Destination<input data-card-place-name="target" maxlength="80" value="${escape(targetName)}"></label><button class="secondary-button compact" type="button" data-save-card-place="target">Save</button></div><span class="mobility-place-save-status" data-card-place-status aria-live="polite"></span></details><div class="mobility-routine-editor"><label>Is this a routine?<select data-routine-type>${options}</select></label><label class="mobility-custom-routine${selected==='custom'?' visible':''}">Routine name<input data-routine-custom maxlength="60" value="${escape(item.customName||item.title||'')}"></label><div><button class="primary-button compact" type="button" data-confirm-routine>Confirm</button><button class="secondary-button compact" type="button" data-dismiss-routine>Keep dismissed</button></div></div></article>`;}).join(''):'<div class="mobility-intelligence-empty"><strong>Pattern queue reviewed</strong><span>Unresolved imports stay hidden until they have a business, address, or label.</span></div>';bindRoutineEditors(routines);}
      if(changes){const items=(Array.isArray(graph?.changeInsights)?graph.changeInsights:[]).slice(0,3);changes.innerHTML=items.length?items.map(item=>{const direction=safeDirection(item.direction);return`<article class="mobility-change-card direction-${direction}"><span class="mobility-change-direction" aria-hidden="true">${direction==='up'?'↗':direction==='down'?'↘':direction==='new'?'+':'→'}</span><div><h4>${escape(item.title)}</h4><p>${escape(item.narrative)}</p><small>${escape(item.confidence||'early')} confidence</small></div></article>`;}).join(''):'<div class="mobility-intelligence-empty"><strong>Comparison is still forming</strong><span>Two complete activity periods are needed.</span></div>';}
    }
    async function mutate(button,path,body){const status=document.getElementById('mobilityGraphStatus');if(button)button.disabled=true;if(status)status.textContent='Saving your correction…';try{await api.post(path,body);loaded=false;await load(true);if(status)status.textContent='Saved to your private mobility graph';return true;}catch(error){if(status)status.textContent=error.message;return false;}finally{if(button)button.disabled=false;}}
    async function savePlace(node,form){const button=form.querySelector('button[type="submit"]');await mutate(button,'/api/mobility/place',{nodeId:node.id,name:form.elements.name.value,category:form.elements.category.value});}
    async function resetPlace(node,button){await mutate(button,'/api/mobility/place',{nodeId:node.id,reset:true});}
    async function reviewRoutine(card,button,body){const status=document.getElementById('mobilityGraphStatus'),routineId=card.dataset.routineCard,item=(graph?.routines||[]).find(candidate=>candidate.id===routineId);if(!item)return;const routineIds=[...new Set([routineId,...(item.relatedRoutineIds||[])])];button.disabled=true;card.classList.add('is-saving');routineIds.forEach(rememberReviewedRoutine);graph.routines=(graph.routines||[]).filter(candidate=>!routineIds.includes(candidate.id));renderIntelligence();loaded=false;if(status)status.textContent='Saving · the next recurring pattern is ready';const request=async()=>{for(const id of routineIds)await api.post('/api/mobility/routine',{...body,routineId:id});};routineSaveQueue=routineSaveQueue.catch(()=>{}).then(request);try{await routineSaveQueue;if(status)status.textContent='Saved · the next recurring pattern is ready';}catch(error){const compatibility=/endpoint not found|\b404\b/i.test(String(error?.message||''));if(!compatibility){routineIds.forEach(forgetReviewedRoutine);graph.routines=[...(graph.routines||[]),item].sort((a,b)=>(Number(b.driveCount)||0)-(Number(a.driveCount)||0));renderIntelligence();}if(status)status.textContent=compatibility?'Saved on this beta · server sync will follow the backend update':`Save failed · the pattern is ready to retry: ${error.message}`;}}
    function applySavedCardLabel(nodeId,name){const nodes=nodeMap(),node=nodes.get(nodeId);if(node)node.label=name;(graph?.routines||[]).forEach(item=>{if(item.source===nodeId)item.sourceLabel=name;if(item.target===nodeId)item.targetLabel=name;const sourceLabel=item.sourceLabel||nodes.get(item.source)?.label||item.sourceAddress||'',targetLabel=item.targetLabel||nodes.get(item.target)?.label||item.targetAddress||'';item.title=`${sourceLabel} to ${targetLabel}`;});document.querySelectorAll('[data-routine-card]').forEach(card=>{const item=(graph?.routines||[]).find(candidate=>candidate.id===card.dataset.routineCard);if(!item)return;const heading=card.querySelector('h4');if(heading)heading.textContent=item.title;['source','target'].forEach(side=>{if(item[side]!==nodeId)return;const input=card.querySelector(`[data-card-place-name="${side}"]`);if(input)input.value=name;});});}
    async function saveCardPlace(card,side,button){const item=(graph?.routines||[]).find(candidate=>candidate.id===card.dataset.routineCard),node=nodeMap().get(item?.[side]),input=card.querySelector(`[data-card-place-name="${side}"]`),status=card.querySelector('[data-card-place-status]'),name=String(input?.value||'').trim();if(!item||!name)return;const category=['home','work','family','errands','dining','wellness','other'].includes(node?.category)?node.category:'other',latitude=Number(item[`${side}Latitude`]??node?.latitude),longitude=Number(item[`${side}Longitude`]??node?.longitude),originalText=button.textContent;button.disabled=true;button.textContent='Saving…';if(status){status.textContent='Writing this label…';status.classList.remove('is-error');}const request=async()=>{if(validCoordinate(latitude,longitude)){try{return await api.post('/api/mobility/place-geofence',{latitude,longitude,radiusFeet:200,name,category});}catch(error){if(!/endpoint not found|\b404\b/i.test(String(error?.message||'')))throw error;}}return api.post('/api/mobility/place',{nodeId:item[side],name,category});};placeSaveQueue=placeSaveQueue.catch(()=>{}).then(request);try{await placeSaveQueue;applySavedCardLabel(item[side],name);loaded=false;button.textContent='Saved';if(status)status.textContent=`${name} saved. You can save the other label now.`;}catch(error){button.textContent=originalText;if(status){status.textContent=error.message||'This label could not be saved.';status.classList.add('is-error');}}finally{button.disabled=false;}}
    function bindRoutineEditors(container){container.querySelectorAll('[data-routine-card]').forEach(card=>{const select=card.querySelector('[data-routine-type]'),custom=card.querySelector('.mobility-custom-routine');select?.addEventListener('change',()=>custom?.classList.toggle('visible',select.value==='custom'));card.querySelector('[data-confirm-routine]')?.addEventListener('click',event=>void reviewRoutine(card,event.currentTarget,{routineId:card.dataset.routineCard,status:'confirmed',type:select.value,customName:card.querySelector('[data-routine-custom]').value}));card.querySelector('[data-dismiss-routine]')?.addEventListener('click',event=>void reviewRoutine(card,event.currentTarget,{routineId:card.dataset.routineCard,status:'dismissed'}));card.querySelectorAll('[data-save-card-place]').forEach(button=>button.addEventListener('click',()=>void saveCardPlace(card,button.dataset.saveCardPlace,button)));});}
    async function load(force=false){if(force)loaded=false;if(loaded)return graph;if(loading)return loading;const journeys=api.get('/api/drives').catch(()=>({drives:state?.drives||[]}));loading=Promise.all([api.get('/api/mobility-graph'),journeys,loadAtlasPlaceEnrichment(api)]).then(async([data,journeyData,atlasPlaces])=>{const retainedDrives=Array.isArray(journeyData.drives)?journeyData.drives:(state?.drives||[]);mapDrives=retainedDrives;if(state&&retainedDrives.length>(state.drives?.length||0))state.drives=retainedDrives;const graphPlaces=(data.nodes||[]).filter(node=>!genericImportedLabel(node.label)&&validCoordinate(Number(node.latitude),Number(node.longitude))).map(node=>({latitude:node.latitude,longitude:node.longitude,name:node.label,address:node.address,category:node.category,source:'graph',radiusMiles:node.category==='home'?200/5280:undefined})),geofencePlaces=(data.placeGeofences||[]).filter(fence=>validCoordinate(Number(fence.latitude),Number(fence.longitude))).map(fence=>({latitude:fence.latitude,longitude:fence.longitude,name:fence.name,address:fence.name,category:fence.category,source:'manual',radiusMiles:Number(fence.radiusFeet)/5280})),knownPlaces=[...atlasPlaces,...graphPlaces,...geofencePlaces];const generated=await buildImportedJourneyRoutines(retainedDrives,knownPlaces),merged=new Map(generated.map(item=>[item.id,item]));(data.routines||[]).forEach(item=>merged.set(item.id,item));data.routines=[...merged.values()].filter(item=>!/^home to home$/i.test(String(item.title||'').trim())).sort((a,b)=>(Number(b.driveCount)||0)-(Number(a.driveCount)||0));graph=data;applyAtlasPlaceEnrichment(knownPlaces);enrichAddresses();removeImportedPlaceArtifacts();deduplicateRoutines();loaded=true;render();return data;}).catch(error=>{const canvas=document.getElementById('mobilityGraphCanvas');if(canvas)canvas.innerHTML=`<div class="empty-state"><h3>Mobility map unavailable</h3><p>${escape(error.message)}</p></div>`;throw error;}).finally(()=>{loading=null;});return loading;}
    function bind(){document.addEventListener('journeydeck:viewchange',event=>{if(event.detail?.view==='graph')void load();});if(location.hash==='#graph')void load();}
    return Object.freeze({load,render,bind});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.mobilityGraph=Object.freeze({create,positions,representativeJourneyFeatures,buildImportedJourneyRoutines});
})();
