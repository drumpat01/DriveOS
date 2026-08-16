(function(){
  const escape=value=>window.DriveOSDom.escapeHtml(value);
  const number=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(Number(value)||0);
  const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Unknown':parsed.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});};
  const categoryName=value=>({home:'Home',work:'Work / school',family:'Family',errands:'Errands',dining:'Dining',wellness:'Wellness',routine:'Frequent place',other:'Uncategorized'}[value]||'Uncategorized');
  const safeCategory=value=>['home','work','family','errands','dining','wellness','routine','other'].includes(value)?value:'other';
  const safeDirection=value=>['up','down','new','stable','neutral'].includes(value)?value:'neutral';

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

  function create({api}){
    let graph=null,loaded=false,loading=null,selectedId=null;
    const nodeMap=()=>new Map((graph?.nodes||[]).map(node=>[node.id,node]));
    function inspect(node){
      const inspector=document.getElementById('mobilityGraphInspector');if(!inspector||!graph)return;
      const nodes=nodeMap();
      const connectedByPlace=new Map();graph.edges.filter(edge=>edge.source===node.id||edge.target===node.id).forEach(edge=>{const other=nodes.get(edge.source===node.id?edge.target:edge.source);if(!other)return;const current=connectedByPlace.get(other.id)||{other,driveCount:0};current.driveCount+=Number(edge.driveCount)||0;connectedByPlace.set(other.id,current);});
      const connected=[...connectedByPlace.values()].sort((a,b)=>b.driveCount-a.driveCount).slice(0,5);
      inspector.innerHTML=`<div class="section-label">${escape(node.kind==='home'?'ANCHOR PLACE':'MOBILITY PLACE')}</div><h3>${escape(node.label)}</h3><div class="mobility-identity"><span class="mobility-category category-${safeCategory(node.category)}">${escape(categoryName(node.category))}</span><span>${escape(node.categoryConfidence||'low')} confidence</span></div><p class="mobility-identity-reason">${escape(node.categoryReason||'JourneyDeck needs more evidence to identify this place.')}</p><div class="mobility-place-facts"><span><strong>${number(node.visitCount)}</strong> visits</span><span><strong>${number(node.arrivals)}</strong> arrivals</span><span><strong>${number(node.departures)}</strong> departures</span></div><p>Seen from ${escape(date(node.firstSeenAt))} through ${escape(date(node.lastSeenAt))}.</p><div class="mobility-connections"><div class="section-label">STRONGEST CONNECTIONS</div>${connected.length?connected.map(item=>`<div><span>${escape(item.other.label)}</span><strong>${number(item.driveCount)} drive${Number(item.driveCount)===1?'':'s'}</strong></div>`).join(''):'<p>No connected drive is available yet.</p>'}</div>`;
    }
    function select(nodeId){selectedId=nodeId;document.querySelectorAll('[data-mobility-node]').forEach(element=>element.classList.toggle('selected',element.dataset.mobilityNode===nodeId));document.querySelectorAll('[data-mobility-edge]').forEach(element=>element.classList.toggle('connected',element.dataset.mobilityEdgeSource===nodeId||element.dataset.mobilityEdgeTarget===nodeId));const node=nodeMap().get(nodeId);if(node)inspect(node);}
    function render(){
      const summary=document.getElementById('mobilityGraphSummary'),canvas=document.getElementById('mobilityGraphCanvas'),status=document.getElementById('mobilityGraphStatus');if(!summary||!canvas||!graph)return;
      const values=[graph.summary.placeCount,graph.summary.connectionCount,graph.summary.driveCount,`${number(graph.summary.totalMiles)} mi`];summary.querySelectorAll('strong').forEach((element,index)=>{element.textContent=values[index]??'--';});
      renderIntelligence();
      if(!graph.nodes.length){canvas.innerHTML='<div class="empty-state"><h3>Your graph is waiting for its first drive</h3><p>Places and connections will appear automatically.</p></div>';if(status)status.textContent='No retained drives';return;}
      const compact=window.matchMedia('(max-width: 560px)').matches,frame=compact?{width:560,height:620,padding:76}:{width:900,height:520,padding:72};
      const points=positions(graph.nodes,frame),maxVisits=Math.max(...graph.nodes.map(node=>Number(node.visitCount)||1)),maxDrives=Math.max(...graph.edges.map(edge=>Number(edge.driveCount)||1),1);
      const edges=graph.edges.map(edge=>{const start=points.get(edge.source),end=points.get(edge.target);if(!start||!end)return'';const width=1.5+(Number(edge.driveCount)/maxDrives)*7;return`<line class="mobility-edge" data-mobility-edge data-mobility-edge-source="${escape(edge.source)}" data-mobility-edge-target="${escape(edge.target)}" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" style="--edge-width:${width}px"><title>${number(edge.driveCount)} drive${Number(edge.driveCount)===1?'':'s'} · ${number(edge.totalMiles)} miles</title></line>`;}).join('');
      const nodes=graph.nodes.map(node=>{const point=points.get(node.id),radius=10+(Number(node.visitCount)/maxVisits)*16;return`<g class="mobility-node category-${safeCategory(node.category)}" data-mobility-node="${escape(node.id)}" tabindex="0" role="button" aria-label="${escape(node.label)}, ${escape(categoryName(node.category))}, ${number(node.visitCount)} visits" transform="translate(${point.x} ${point.y})"><circle r="${radius}"></circle><circle class="mobility-node-core" r="${Math.max(4,radius*.34)}"></circle><text y="${radius+20}" text-anchor="middle">${escape(node.label)}</text></g>`;}).join('');
      canvas.innerHTML=`<svg class="mobility-graph-svg" viewBox="0 0 ${frame.width} ${frame.height}" role="img" aria-label="Personal mobility graph with ${number(graph.nodes.length)} places and ${number(graph.edges.length)} connections"><defs><linearGradient id="mobilityEdgeGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ba9be"/><stop offset="1" stop-color="#18c997"/></linearGradient></defs><g class="mobility-edges">${edges}</g><g class="mobility-nodes">${nodes}</g></svg>`;
      canvas.querySelectorAll('[data-mobility-node]').forEach(element=>{element.addEventListener('click',()=>select(element.dataset.mobilityNode));element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(element.dataset.mobilityNode);}});});
      if(status)status.textContent=`${number(graph.summary.driveCount)} drives across ${number(graph.windowDays)} days`;
      select(selectedId&&nodeMap().has(selectedId)?selectedId:graph.nodes[0].id);
    }
    function renderIntelligence(){
      const routines=document.getElementById('mobilityRoutines'),changes=document.getElementById('mobilityChanges');
      if(routines){const items=Array.isArray(graph?.routines)?graph.routines:[];routines.innerHTML=items.length?items.map(item=>`<article class="mobility-routine-card"><div><span class="mobility-pattern-type">${escape(String(item.type||'pattern').replaceAll('-',' '))}</span><span class="mobility-confidence">${escape(item.confidenceLabel||'early signal')} confidence</span></div><h4>${escape(item.title)}</h4><p>${escape(item.narrative)}</p><small>${number(item.driveCount)} supporting drives</small></article>`).join(''):'<div class="mobility-intelligence-empty"><strong>No routine claimed yet</strong><span>JourneyDeck waits for at least three supporting drives.</span></div>';}
      if(changes){const items=Array.isArray(graph?.changeInsights)?graph.changeInsights:[];changes.innerHTML=items.length?items.map(item=>{const direction=safeDirection(item.direction);return`<article class="mobility-change-card direction-${direction}"><span class="mobility-change-direction" aria-hidden="true">${direction==='up'?'↗':direction==='down'?'↘':direction==='new'?'+':'→'}</span><div><h4>${escape(item.title)}</h4><p>${escape(item.narrative)}</p><small>${escape(item.confidence||'early')} confidence</small></div></article>`;}).join(''):'<div class="mobility-intelligence-empty"><strong>Comparison is still forming</strong><span>Two complete activity periods are needed.</span></div>';}
    }
    async function load(){if(loaded)return graph;if(loading)return loading;loading=api.get('/api/mobility-graph').then(data=>{graph=data;loaded=true;render();return data;}).catch(error=>{const canvas=document.getElementById('mobilityGraphCanvas');if(canvas)canvas.innerHTML=`<div class="empty-state"><h3>Mobility graph unavailable</h3><p>${escape(error.message)}</p></div>`;throw error;}).finally(()=>{loading=null;});return loading;}
    function bind(){document.addEventListener('journeydeck:viewchange',event=>{if(event.detail?.view==='graph')void load();});if(location.hash==='#graph')void load();}
    return Object.freeze({load,render,bind});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.mobilityGraph=Object.freeze({create,positions});
})();
