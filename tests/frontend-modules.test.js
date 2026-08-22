const fs=require('fs');const path=require('path');const vm=require('vm');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const elements=new Map([['status',{textContent:''}]]);
const longestCardElement={innerHTML:'',textContent:'',hidden:false,className:'statistics-highlight statistics-longest',attributes:{},dataset:{},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},classList:{values:new Set(['statistics-highlight','statistics-longest']),toggle(name,enabled){if(enabled)this.values.add(name);else this.values.delete(name);},add(name){this.values.add(name);},remove(name){this.values.delete(name);},contains(name){return this.values.has(name);}},listeners:{},addEventListener(event,handler){this.listeners[event]=handler;},dispatchEvent(event){const handler=this.listeners[event.type];if(handler)handler(event);}};
const makeRangeButton=statRange=>({dataset:{statRange},attributes:{},focused:false,classList:{values:new Set(),toggle(name,enabled){if(enabled)this.values.add(name);else this.values.delete(name);},add(name){this.values.add(name);},remove(name){this.values.delete(name);},contains(name){return this.values.has(name);}},listeners:{},addEventListener(ev,fn){this.listeners[ev]=fn;},setAttribute(name,value){this.attributes[name]=String(value);},getAttribute(name){return this.attributes[name]??null;},removeAttribute(name){delete this.attributes[name];},hasAttribute(name){return name in this.attributes;},focus(){this.focused=true;},dispatchEvent(event){const handler=this.listeners[event.type];if(handler)handler(event);}});
const rangeButtons=[makeRangeButton('daily'),makeRangeButton('weekly'),makeRangeButton('monthly')];
const context={console,Map,Promise,setTimeout,clearTimeout,URL,Intl,location:{hostname:'127.0.0.1',hash:''},navigator:{userAgent:'DriveOS Test',platform:'Win32',maxTouchPoints:0},document:{getElementById:id=>elements.get(id)||null,documentElement:{dataset:{},classList:{toggle(){}}},querySelector:sel=>sel==='.statistics-longest'||sel==='[data-statistics-dashboard]'?longestCardElement:null,querySelectorAll:sel=>sel==='[data-stat-range]'?rangeButtons:[],addEventListener(){}},window:null,fetch:async()=>({ok:true,json:async()=>({ok:true})})};
context.window=context;context.window.navigator=context.navigator;context.window.location=context.location;context.window.matchMedia=()=>({matches:false});
vm.createContext(context);
for(const file of ['web/core/dom.js','web/core/state.js','web/core/platform.js','web/core/api.js','web/features/drives.js','web/features/replay.js','web/features/music.js','web/features/data-health.js','web/features/collections.js','web/features/mobility-graph.js','web/features/statistics-dashboard.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const statIds=['statDriveCount','statMiles','statEfficiency','statEnergy','statBattery','statSongs','statAutopilot','statAutopilotShare','statDriveCountChange','statMilesChange','statEfficiencyChange','statEnergyChange','statBatteryChange','statSongsChange','statAutopilotChange','statisticsComparison','statisticsScoreGauge','statisticsScore','statisticsScoreLabel','statisticsScoreContext','statisticsScoreDetails','statisticsLongestMiles','statisticsLongestRoute','statisticsLongestDate','statisticsLongestRouteArt','statisticsFavoriteDay','statisticsFavoriteAverage','statisticsFavoriteShare','statisticsWeekdayBars','statisticsStreakDays','statisticsStreakMessage','statisticsStreakTrack','statisticsTrendChart','statisticsChartWrap','statisticsTrendAnnouncement','statisticsTrendInspection','statisticsScoreBreakdown','statisticsMonthlyArchiveButton','statisticsMonthlyArchive'];
for(const id of statIds)elements.set(id,{innerHTML:'',textContent:'',hidden:false,className:'',style:{setProperty(){}},attributes:{},dataset:{},hasAttribute(name){return name in this.attributes;},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];if(name==='hidden')this.hidden=false;},classList:{values:new Set(),toggle(name,enabled){if(enabled)this.values.add(name);else this.values.delete(name);}},listeners:{},addEventListener(event,handler){this.listeners[event]=handler;},dispatchEvent(event){const handler=this.listeners[event.type];if(handler)handler(event);},getBoundingClientRect(){return{left:0,top:0,width:760,height:278};}});
let openedDrive=null;
const statDrives=Array.from({length:45},(_,index)=>{const date=new Date(Date.now()-index*86400000-3600000);return{id:`streak-drive-${index+1}`,startedAt:date.toISOString(),miles:index===2?50:10,energyKWh:2.5,batteryUsed:5,durationMinutes:20,efficiencyWhMi:250,startingLocation:'Home',endingLocation:'Office'};});
context.DriveOSStatisticsDashboard.render(null,statDrives,{openDrive:drive=>{openedDrive=drive;}});
assert.equal(elements.get('statisticsStreakDays').textContent,'45 days','driving streak should reflect full library history and exceed the 30-day window');
assert.equal(elements.get('statDriveCount').textContent,'30','30-day KPI totals must continue using only the current 30-day window');
const streakTrackHtml=elements.get('statisticsStreakTrack').innerHTML;
assert.equal((streakTrackHtml.match(/<div class=/g)||[]).length,7,'streak visual track must remain exactly 7 days');
assert.ok(longestCardElement.classList.contains('is-interactive'),'longest journey card should be interactive when longest drive exists');
assert.equal(longestCardElement.attributes['role'],'button','longest journey card should have button role');
assert.equal(longestCardElement.attributes['tabindex'],'0','longest journey card should be focusable via tabindex');
longestCardElement.dispatchEvent({type:'click',target:longestCardElement,closest:()=>null});
assert.equal(openedDrive?.id,'streak-drive-3','clicking longest journey card should invoke openDrive callback with the longest drive');
openedDrive=null;
longestCardElement.dispatchEvent({type:'keydown',key:'Enter',preventDefault:()=>{}});
assert.equal(openedDrive?.id,'streak-drive-3','pressing Enter on longest journey card should open the longest drive');

const chartElement=elements.get('statisticsTrendChart');
const inspectionElement=elements.get('statisticsTrendInspection');
const announcementElement=elements.get('statisticsTrendAnnouncement');
const chartWrapElement=elements.get('statisticsChartWrap');

assert.equal(typeof context.DriveOSStatisticsDashboard.inspectTrend,'undefined','inspectTrend must not be exposed on public API');
assert.equal(typeof context.DriveOSStatisticsDashboard.clearTrendInspection,'undefined','clearTrendInspection must not be exposed on public API');

chartElement.dispatchEvent({type:'pointermove',clientX:48});
assert.equal(inspectionElement.hidden,false,'start point pointer inspection should be visible');
assert.ok(inspectionElement.innerHTML.includes('statistics-trend-guide'),'inspection must include guide line');
assert.ok(inspectionElement.innerHTML.includes('statistics-trend-dot miles'),'inspection must include miles dot');
assert.ok(inspectionElement.innerHTML.includes('statistics-trend-dot energy'),'inspection must include energy dot');
assert.ok(inspectionElement.innerHTML.includes('statistics-trend-tooltip'),'inspection must include tooltip');
assert.ok(announcementElement.textContent.includes('miles')&&announcementElement.textContent.includes('kilowatt-hours'),'screen-reader live region must announce values');

chartElement.dispatchEvent({type:'pointermove',clientX:380});
assert.equal(inspectionElement.hidden,false,'midpoint pointer inspection should be visible');

chartElement.dispatchEvent({type:'pointermove',clientX:712});
assert.equal(inspectionElement.hidden,false,'end point pointer inspection should be visible');

chartWrapElement.dispatchEvent({type:'keydown',key:'ArrowLeft',preventDefault:()=>{}});
assert.ok(announcementElement.textContent.length>0,'ArrowLeft should step to adjacent point');

chartWrapElement.dispatchEvent({type:'keydown',key:'Escape',preventDefault:()=>{}});
assert.equal(inspectionElement.hidden,true,'Escape should clear inspection');
assert.equal(announcementElement.textContent,'','Escape should clear live region text');

chartElement.dispatchEvent({type:'pointermove',clientX:120});
assert.equal(inspectionElement.hidden,false,'re-hovering reveals inspection');
chartElement.dispatchEvent({type:'pointerleave'});
assert.equal(inspectionElement.hidden,true,'pointerleave should dismiss overlay');

assert.equal(rangeButtons[0].attributes['role'],undefined,'range buttons should not use tab role');
assert.equal(rangeButtons[0].attributes['aria-pressed'],'true','daily range button should initially have aria-pressed true');
assert.ok(rangeButtons[0].classList.contains('active'),'daily range button should have active class');
assert.equal(rangeButtons[1].attributes['aria-pressed'],'false','weekly range button should initially have aria-pressed false');
assert.equal(rangeButtons[2].attributes['aria-pressed'],'false','monthly range button should initially have aria-pressed false');

chartElement.dispatchEvent({type:'pointerdown',clientX:200});
assert.equal(inspectionElement.hidden,false,'active inspection exists before switching range');
rangeButtons[1].dispatchEvent({type:'click'});
assert.equal(rangeButtons[1].attributes['aria-pressed'],'true','clicked weekly button must have aria-pressed true');
assert.ok(rangeButtons[1].classList.contains('active'),'clicked weekly button must have active class');
assert.equal(rangeButtons[0].attributes['aria-pressed'],'false','daily button must now have aria-pressed false');
assert.equal(rangeButtons[2].attributes['aria-pressed'],'false','monthly button must remain aria-pressed false');
assert.equal(inspectionElement.hidden,true,'switching range button must clear active trend inspection');
assert.equal(announcementElement.textContent,'','switching range button must clear live announcement');

rangeButtons[0].focused=false;rangeButtons[1].focused=false;rangeButtons[2].focused=false;
rangeButtons[1].dispatchEvent({type:'keydown',key:'ArrowRight',preventDefault:()=>{}});
assert.equal(rangeButtons[2].attributes['aria-pressed'],'true','ArrowRight should activate monthly range button');
assert.equal(rangeButtons[2].focused,true,'monthly range button should receive focus');
assert.equal(rangeButtons[1].attributes['aria-pressed'],'false','weekly range button should have aria-pressed false');

rangeButtons[0].focused=false;rangeButtons[1].focused=false;rangeButtons[2].focused=false;
rangeButtons[2].dispatchEvent({type:'keydown',key:'ArrowRight',preventDefault:()=>{}});
assert.equal(rangeButtons[0].attributes['aria-pressed'],'true','ArrowRight on last button should wrap to daily range button');
assert.equal(rangeButtons[0].focused,true,'daily range button should receive focus');

rangeButtons[0].focused=false;rangeButtons[1].focused=false;rangeButtons[2].focused=false;
rangeButtons[0].dispatchEvent({type:'keydown',key:'ArrowLeft',preventDefault:()=>{}});
assert.equal(rangeButtons[2].attributes['aria-pressed'],'true','ArrowLeft on first button should wrap to monthly range button');
assert.equal(rangeButtons[2].focused,true,'monthly range button should receive focus on wrap');

rangeButtons[0].focused=false;rangeButtons[1].focused=false;rangeButtons[2].focused=false;
rangeButtons[2].dispatchEvent({type:'keydown',key:'Home',preventDefault:()=>{}});
assert.equal(rangeButtons[0].attributes['aria-pressed'],'true','Home should activate first button (daily)');
assert.equal(rangeButtons[0].focused,true,'daily range button should receive focus on Home');

rangeButtons[0].focused=false;rangeButtons[1].focused=false;rangeButtons[2].focused=false;
rangeButtons[0].dispatchEvent({type:'keydown',key:'End',preventDefault:()=>{}});
assert.equal(rangeButtons[2].attributes['aria-pressed'],'true','End should activate last button (monthly)');
assert.equal(rangeButtons[2].focused,true,'monthly range button should receive focus on End');

rangeButtons[0].dispatchEvent({type:'click'});

context.DriveOSStatisticsDashboard.render(null,[],{});
assert.ok(!longestCardElement.classList.contains('is-interactive'),'longest journey card should not be interactive when no journeys exist');
chartElement.dispatchEvent({type:'pointermove',clientX:48});
assert.equal(inspectionElement.hidden,false,'zero-activity data should still allow inspection');
assert.ok(inspectionElement.innerHTML.includes('0.0 mi'),'zero-activity inspection should show 0.0 mi');
assert.ok(inspectionElement.innerHTML.includes('0.0 kWh'),'zero-activity inspection should show 0.0 kWh');
assert.equal(context.DriveOSDom.escapeHtml(`<Driver's & "Song">`),'&lt;Driver&#039;s &amp; &quot;Song&quot;&gt;');
context.DriveOSDom.setText('status','ONLINE');assert.equal(elements.get('status').textContent,'ONLINE');
assert.equal(context.DriveOSState.driveLibraryWindowDays,730);assert.ok(context.DriveOSState.songMapMarkers instanceof Map);
assert.equal(typeof context.DriveOSFeatures.collections.create,'function','Journey Collections feature module should load independently');
assert.equal(typeof context.DriveOSFeatures.mobilityGraph.create,'function','Personal Mobility Graph feature module should load independently');
const graphPositions=context.DriveOSFeatures.mobilityGraph.positions([{id:'home',latitude:32.9,longitude:-97.3},{id:'work',latitude:32.75,longitude:-97.1}]);assert.equal(graphPositions.size,2,'mobility graph should position every place');assert.ok([...graphPositions.values()].every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)),'mobility graph positions must remain finite');
assert.equal(context.DriveOSPlatform.isTailnetRemote(),false);assert.equal(context.DriveOSPlatform.isStandalonePwa(),false);
assert.equal(context.DriveOSPlatform.connectionContextLabel(),'Local only \u00b7 127.0.0.1','desktop should retain its local-only footer');
assert.equal(context.DriveOSPlatform.connectionContextLabel('journeydeck.me'),'Hosted securely \u00b7 journeydeck.me','production should identify its hosted context');
const healthElement=()=>({innerHTML:'',textContent:'',hidden:true,className:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},classList:{values:new Set(),toggle(name,enabled){if(enabled)this.values.add(name);else this.values.delete(name);}}});
for(const id of ['dataHealthOverall','dataHealthAlerts','dataHealthIntegrations','dataHealthSoundtracks','dataHealthRollout','dataHealthIntegrityAudit','dataHealthNavAlertCount','mobileDataHealthAlertCount','dataHealthNav','mobileDataHealthNav'])elements.set(id,healthElement());
const healthFeature=context.DriveOSFeatures.dataHealth.create({api:context.DriveOSApi});healthFeature.render({overallStatus:'attention',generatedAtUtc:'2026-08-15T12:00:00Z',repositoryProvider:'Turso',alerts:[{severity:'warning',title:'Spotify is late',message:'The durable cursor is stale.'}],integrations:[],soundtrackProjection:{recentDriveCount:1,materializedCount:1,missingCount:0,pendingCount:0},rollout:{tessieWritesEnabled:true,tessieReadsEnabled:true,readCanaryApproved:true}});assert.ok(elements.get('dataHealthAlerts').innerHTML.includes('Spotify is late'),'active alerts should render');assert.equal(elements.get('dataHealthNavAlertCount').textContent,'1','desktop navigation should show the alert count');assert.equal(elements.get('mobileDataHealthAlertCount').textContent,'1','mobile navigation should show the alert count');
healthFeature.render({overallStatus:'failed',generatedAtUtc:'2026-08-17T13:00:00Z',repositoryProvider:'Turso',alerts:[{id:'integrity-audit-failed',severity:'critical',title:'Integrity audit failed',message:'A non-cursor check failed.'}],integrations:[{id:'integrity-audit',name:'Daily integrity audit',status:'failed',lagMinutes:30}],integrityAudit:{status:'failed',completedAtUtc:'2026-08-17T12:59:00Z',report:{resources:{drives:{passed:true},charges:{passed:true}},checks:[{name:'signature-check',passed:false}],generatedAtUtc:'2026-08-17T12:59:00Z',auditRange:{toUtc:'2026-08-17T12:29:00Z'}}},soundtrackProjection:{},rollout:{}});assert.ok(elements.get('dataHealthAlerts').innerHTML.includes('Integrity audit failed'),'fresh failed audits must not be hidden by the client');assert.equal(elements.get('dataHealthOverall').className,'data-health-overall status-failed','authoritative failed health status must remain failed');
healthFeature.render({overallStatus:'healthy',generatedAtUtc:'2026-08-17T13:10:00Z',repositoryProvider:'Turso',alerts:[],integrations:[],integrityAudit:{status:'ready',readyForReadCanary:true,completedAtUtc:'2026-08-17T13:09:00Z',report:{resources:{drives:{passed:true},charges:{passed:true}},cursors:[{resource:'drives',passed:true},{resource:'charges',passed:true}]}},soundtrackProjection:{},rollout:{}});assert.ok(elements.get('dataHealthIntegrityAudit').innerHTML.includes('Cursor policy</span><strong>Passed'),'privacy-safe persisted cursors must render a passing cursor policy without a checks array');
const repeated=[{id:'a',startedAt:'2026-01-02',shortDateLabel:'Jan 2',startingLocation:'Home',endingLocation:'Work',startingLatitude:32,startingLongitude:-97,endingLatitude:33,endingLongitude:-98,miles:10,durationMinutes:20,efficiencyWhMi:250},{id:'b',startedAt:'2026-01-01',shortDateLabel:'Jan 1',startingLocation:'Home',endingLocation:'Work',startingLatitude:32.001,startingLongitude:-97.001,endingLatitude:33.001,endingLongitude:-98.001,miles:12,durationMinutes:24,efficiencyWhMi:260}];
const routes=context.DriveOSFeatures.drives.detectFavoriteRoutes(repeated);assert.equal(routes.length,1);assert.deepEqual(Array.from(routes[0].driveIds),['a','b']);
assert.ok(context.DriveOSFeatures.drives.driveSearchHaystack({id:'legacy-drive',soundtrack:[null,{track:'Stored'}]}).includes('stored'),'drive search should tolerate null legacy soundtrack entries');
const normalized=context.DriveOSFeatures.drives.normalizeDriveCollection([null,{id:'legacy-drive',soundtrack:[null,{track:'Stored'}]},{id:'missing-soundtrack'}]);assert.equal(normalized.length,2,'null drive records should be ignored');assert.deepEqual(Array.from(normalized[0].soundtrack),[{track:'Stored'}],'null legacy soundtrack entries should be removed at the client boundary');assert.deepEqual(Array.from(normalized[1].soundtrack),[],'missing soundtracks should normalize to an empty array');
const libraryDrives=Array.from({length:14},(_,index)=>({id:`drive-${index+1}`}));assert.equal(context.DriveOSFeatures.drives.visibleDriveCollection(libraryDrives,false).length,10,'drive library should show ten results by default');assert.equal(context.DriveOSFeatures.drives.visibleDriveCollection(libraryDrives,true).length,14,'expanded drive library should show all results');
const manyRoutes=[];for(let route=0;route<5;route++){for(let trip=0;trip<2;trip++){manyRoutes.push({id:`${route}-${trip}`,startedAt:`2026-01-${String(20-route).padStart(2,'0')}`,startingLocation:`Start ${route}`,endingLocation:`End ${route}`,startingLatitude:30+route*2,startingLongitude:-100,endingLatitude:31+route*2,endingLongitude:-99,miles:route+1,durationMinutes:10,efficiencyWhMi:250});}}assert.equal(context.DriveOSFeatures.drives.detectFavoriteRoutes(manyRoutes).length,3,'only the top three favorite routes should render');
const replayState={driveMapData:{routePoints:[{timestamp:100,latitude:0,longitude:0,speed:0,battery:80,heading:350},{timestamp:110,latitude:10,longitude:20,speed:20,battery:70,heading:10}]}};const replay=context.DriveOSFeatures.replay.create(replayState);const midpoint=replay.stateAt(105000);assert.equal(midpoint.latitude,5);assert.equal(midpoint.heading,0);
const musicState={drives:[{id:'drive',startedAt:'2026-01-01T10:00:00Z',endedAt:'2026-01-01T11:00:00Z',startingLocation:'Home',endingLocation:'Work',shortDateLabel:'Jan 1',startTime:'10:00 AM',soundtrack:[{playedAt:'2026-01-01T10:05:00Z',durationMs:180000,track:'Song',artist:'Artist',trackId:'one'}]}]};const music=context.DriveOSFeatures.music.create({state:musicState,compactLocation:value=>value});const located=music.byLocation('Home',15);assert.equal(located.plays.length,1);assert.equal(located.topArtists[0].artist,'Artist');
context.DriveOSApi.get('/api/status').then(value=>{assert.equal(value.ok,true);console.log('Frontend module characterization tests passed.');}).catch(error=>{console.error(error);process.exitCode=1;});
