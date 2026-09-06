"""Loopback-only research app, isolated from JourneyDeck data and production services."""
import json
import math
import mimetypes
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from query import bounds, ranked

ROOT = Path(__file__).resolve().parent
PORT = 8768
ORIGIN = f'http://127.0.0.1:{PORT}'
CSRF = secrets.token_urlsafe(32)
TOKEN = ''
LOCKS = {s:threading.Lock() for s in ['overture','foursquare','osm','search']}
CACHE = {}
LAST = {}
UA = 'JourneyDeck-PlacesLab/1.0 (local, manual POI research; https://journeydeck.com)'


def remote_json(url, data=None, timeout=35):
    req = urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        body = res.read(15_000_001)
        if len(body)>15_000_000:
            raise ValueError('Response too large')
        return json.loads(body)


def validate_location(data):
    values = [data.get(k) for k in ['lat','lon','radius']]
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
        raise ValueError('Enter a valid latitude, longitude, and radius.')
    lat,lon,radius = values
    if not (-80 <= lat <= 80 and -179.9 <= lon <= 179.9 and 50 <= radius <= 1500):
        raise ValueError('Use latitude −80 to 80, longitude −179.9 to 179.9, and a radius of 50–1,500 m.')
    return lat,lon,radius


def query_source(source, data):
    lat,lon,radius = validate_location(data)
    if source=='foursquare' and not TOKEN:
        return dict(status='disconnected', places=[],message='Connect your free Places Portal token to compare Foursquare Open Places.')
    key = (source,lat,lon,radius)
    with LOCKS[source]:
        cached = CACHE.get(key)
        if cached and time.monotonic()-cached[0] < 1800:
            return {**cached[1],'cached':True}
        if source=='osm':
            time.sleep(max(0, 2-(time.monotonic()-LAST.get(source,0))))
            box = bounds(lat,lon,radius)
            bbox = f'{box[1]},{box[0]},{box[3]},{box[2]}'
            query = f'[out:json][timeout:25];(nwr["name"]["amenity"]({bbox});nwr["name"]["shop"]({bbox});nwr["name"]["tourism"]({bbox});nwr["name"]["leisure"]({bbox});nwr["name"]["office"]({bbox});nwr["name"]["craft"]({bbox});nwr["name"]["historic"]({bbox}););out center tags;'
            LAST[source] = time.monotonic()
            response = remote_json('https://overpass-api.de/api/interpreter',urllib.parse.urlencode({'data':query}).encode())
            if response.get('remark'):
                raise ValueError('OpenStreetMap returned an incomplete response. Please retry later.')
            rows=[]
            for row in response.get('elements',[]):
                tags=row.get('tags',{}); point=row.get('center',row)
                rows.append(dict(id=f"{row['type']}/{row['id']}",name=tags.get('name',''),lat=point.get('lat'),lon=point.get('lon'),
                                 category=' · '.join(tags[k].replace('_',' ') for k in ['amenity','shop','tourism','leisure','office','craft','historic'] if tags.get(k)),
                                 address=' '.join(tags.get(k,'') for k in ['addr:housenumber','addr:street','addr:city']).strip(),
                                 geometry='point' if row['type']=='node' else 'area center',status='OSM tagged place'))
            result=dict(places=ranked(rows,lat,lon,radius),release=response.get('osm3s',{}).get('timestamp_osm_base','Live OSM'))
        else:
            payload=dict(source=source,lat=lat,lon=lon,radius=radius)
            if source=='foursquare': payload['token']=TOKEN
            try:
                process=subprocess.run([sys.executable,str(ROOT/'query.py')],input=json.dumps(payload),text=True,capture_output=True,timeout=100,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            except subprocess.TimeoutExpired:
                raise ValueError('The source took too long. Retry with a smaller radius.') from None
            try: result=json.loads(process.stdout)
            except (ValueError,TypeError): raise ValueError('The local data reader could not complete this request.') from None
            if process.returncode or result.get('error'):
                raise ValueError(result.get('error','Source unavailable.'))
        result.update(status='ok',total=len(result['places']),cached=False)
        # Bound memory; never write lookup locations or results to the server filesystem.
        if len(CACHE)>=50: CACHE.pop(next(iter(CACHE)))
        CACHE[key]=(time.monotonic(),result)
        return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass

    def send(self,status,data,content_type='application/json'):
        body=json.dumps(data).encode() if content_type=='application/json' else data
        self.send_response(status)
        self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        try: self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError): pass

    def allowed(self):
        return self.headers.get('Host')==f'127.0.0.1:{PORT}'

    def do_GET(self):
        if not self.allowed(): return self.send(403,{'error':'Local access only.'})
        if self.path=='/api/status':
            return self.send(200,dict(csrf=CSRF,foursquare=bool(TOKEN)))
        paths={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/leaflet.js':'vendor/leaflet.js','/leaflet.css':'vendor/leaflet.css'}
        file=paths.get(self.path)
        if not file: return self.send(404,{'error':'Not found'})
        path=ROOT/file
        return self.send(200,path.read_bytes(),mimetypes.guess_type(path.name)[0] or 'text/plain')

    def do_POST(self):
        global TOKEN
        if not self.allowed() or self.headers.get('Origin')!=ORIGIN or self.headers.get('X-Lab-Token')!=CSRF:
            return self.send(403,{'error':'Reload the local app to reconnect.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<2 or size>16384: raise ValueError('Invalid request size.')
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict): raise ValueError('Invalid request.')
            if self.path=='/api/connect':
                token=data.get('token','')
                if not isinstance(token,str) or len(token)>8192 or (token and (len(token)<20 or any(c.isspace() for c in token))):
                    raise ValueError('Paste the Places Portal token without spaces.')
                with LOCKS['foursquare']:
                    TOKEN=token
                    for key in list(CACHE):
                        if key[0]=='foursquare': CACHE.pop(key,None)
                return self.send(200,dict(connected=bool(TOKEN)))
            if self.path=='/api/search':
                q=data.get('q','')
                if not isinstance(q,str) or not 3<=len(q)<=150: raise ValueError('Enter a public place and city.')
                with LOCKS['search']:
                    time.sleep(max(0,1.1-(time.monotonic()-LAST.get('search',0))))
                    LAST['search']=time.monotonic()
                    found=remote_json('https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode(dict(q=q,format='jsonv2',limit=5)),timeout=15)
                return self.send(200,dict(results=[dict(name=r['display_name'],lat=float(r['lat']),lon=float(r['lon'])) for r in found]))
            source=self.path.removeprefix('/api/query/')
            if source not in ['overture','foursquare','osm']: return self.send(404,{'error':'Not found'})
            start=time.monotonic()
            result=query_source(source,data)
            result['seconds']=round(time.monotonic()-start,1)
            return self.send(200,result)
        except ValueError as exc:
            return self.send(400,{'error':str(exc) if len(str(exc))<200 else 'Invalid response. Please retry.'})
        except Exception:
            return self.send(502,{'error':'The source is temporarily unavailable. Please try again.'})


if __name__=='__main__':
    print(f'JourneyDeck Places Lab ready at {ORIGIN}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
