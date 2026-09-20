import json
import math
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import query
import server


class PlacesLabTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()
        server.TOKEN=''

    def test_distance_and_radius_filter_are_shared(self):
        rows=[dict(id='a',name='Near',lat=0,lon=.001),dict(id='b',name='Far',lat=0,lon=.1)]
        result=query.ranked(rows,0,0,300)
        self.assertEqual([r['id'] for r in result],['a'])
        self.assertAlmostEqual(result[0]['distance'],111.2,places=1)
        self.assertEqual(query.distance(32,-97,32,-97),0)

    def test_reject_nonfinite_and_unbounded_location(self):
        for changes in [dict(lat=math.nan),dict(lat=True),dict(lon=200),dict(radius=100000),dict(radius='300')]:
            with self.assertRaises(ValueError):
                server.validate_location(dict(lat=32,lon=-97,radius=300)|changes)

    def test_missing_foursquare_access_is_not_empty_success(self):
        result=server.query_source('foursquare',dict(lat=32,lon=-97,radius=300))
        self.assertEqual(result['status'],'disconnected')
        self.assertNotIn('total',result)

    def test_partial_overpass_response_is_not_counted(self):
        with patch.object(server,'remote_json',return_value={'elements':[],'remark':'runtime error'}):
            with self.assertRaisesRegex(ValueError,'incomplete'):
                server.query_source('osm',dict(lat=32,lon=-97,radius=300))

    def test_osm_nodes_and_area_centers(self):
        data={'elements':[{'type':'node','id':1,'lat':32,'lon':-97,'tags':{'name':'Cafe','amenity':'cafe'}},
                          {'type':'way','id':2,'center':{'lat':32.0001,'lon':-97},'tags':{'name':'Park','leisure':'park'}}]}
        with patch.object(server,'remote_json',return_value=data):
            result=server.query_source('osm',dict(lat=32,lon=-97,radius=300))
        self.assertEqual(result['total'],2)
        self.assertEqual(result['places'][1]['geometry'],'area center')

    def test_cache_avoids_repeated_provider_calls(self):
        with patch.object(server,'remote_json',return_value={'elements':[]}) as remote:
            first=server.query_source('osm',dict(lat=32,lon=-97,radius=300))
            second=server.query_source('osm',dict(lat=32,lon=-97,radius=300))
        self.assertFalse(first['cached'])
        self.assertTrue(second['cached'])
        self.assertEqual(remote.call_count,1)

    def test_untrusted_source_fields_stay_data(self):
        raw=dict(fsq_place_id='x',name='<img src=x onerror=alert(1)>',latitude=32,longitude=-97,
                 fsq_category_labels=['Cafe'],date_closed='2025-01-01',unresolved_flags=['closed'])
        result=query.normalize(raw,'foursquare')
        self.assertEqual(result['name'],raw['name'])
        self.assertEqual(result['status'],'closed')
        self.assertEqual(result['flags'],['closed'])

    def test_local_server_rejects_cross_origin_and_wrong_host(self):
        http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{http.server_port}'
        try:
            with self.assertRaises(urllib.error.HTTPError) as rejected:
                urllib.request.urlopen(base+'/api/status')
            self.assertEqual(rejected.exception.code,403)
            headers={'Host':f'127.0.0.1:{server.PORT}','Origin':'https://example.com','X-Lab-Token':server.CSRF,'Content-Type':'application/json'}
            req=urllib.request.Request(base+'/api/connect',data=b'{"token":""}',headers=headers)
            with self.assertRaises(urllib.error.HTTPError) as rejected:
                urllib.request.urlopen(req)
            self.assertEqual(rejected.exception.code,403)
            headers['Origin']=server.ORIGIN
            req=urllib.request.Request(base+'/api/connect',data=b'{"token":""}',headers=headers)
            self.assertEqual(json.load(urllib.request.urlopen(req)),{'connected':False})
        finally:
            http.shutdown();http.server_close()


if __name__=='__main__': unittest.main()
