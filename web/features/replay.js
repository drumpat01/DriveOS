(function(){
  function create(state){
    const formatDuration=ms=>{const seconds=Math.max(0,Math.floor(ms/1000)),minutes=Math.floor(seconds/60);return `${minutes}:${String(seconds%60).padStart(2,'0')}`;};
    const routeTimestampMs=point=>Number(point.timestamp)*1000;
    function interpolateNumber(a,b,t){const av=Number(a),bv=Number(b);if(!Number.isFinite(av)&&!Number.isFinite(bv))return null;if(!Number.isFinite(av))return bv;if(!Number.isFinite(bv))return av;return av+(bv-av)*t;}
    function normalizeHeadingDelta(from,to){let delta=Number(to)-Number(from);while(delta>180)delta-=360;while(delta< -180)delta+=360;return delta;}
    function stateAt(ms){const points=state.driveMapData?.routePoints||[];if(!points.length)return null;const first=routeTimestampMs(points[0]),last=routeTimestampMs(points.at(-1)),target=Math.max(first,Math.min(last,ms));if(target<=first)return{...points[0],timestampMs:first};if(target>=last)return{...points.at(-1),timestampMs:last};let low=0,high=points.length-1;while(low<=high){const mid=Math.floor((low+high)/2);if(routeTimestampMs(points[mid])<target)low=mid+1;else high=mid-1;}const rightIndex=Math.min(points.length-1,low),leftIndex=Math.max(0,rightIndex-1),left=points[leftIndex],right=points[rightIndex],leftMs=routeTimestampMs(left),rightMs=routeTimestampMs(right),span=Math.max(1,rightMs-leftMs),t=Math.max(0,Math.min(1,(target-leftMs)/span));let heading=left.heading;if(left.heading!=null&&right.heading!=null){heading=Number(left.heading)+normalizeHeadingDelta(left.heading,right.heading)*t;if(heading<0)heading+=360;if(heading>=360)heading-=360;}return{latitude:interpolateNumber(left.latitude,right.latitude,t),longitude:interpolateNumber(left.longitude,right.longitude,t),speed:interpolateNumber(left.speed,right.speed,t),battery:interpolateNumber(left.battery,right.battery,t),heading,timestampMs:target};}
    return Object.freeze({formatDuration,routeTimestampMs,interpolateNumber,normalizeHeadingDelta,stateAt});
  }
  window.DriveOSFeatures=window.DriveOSFeatures||{};window.DriveOSFeatures.replay=Object.freeze({create});
})();
