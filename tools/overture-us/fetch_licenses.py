"""Refresh redistribution texts from their publishers; review changes before release."""
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'CDLA Permissive 2.0': 'https://raw.githubusercontent.com/Community-Data-License-Agreements/Releases/main/CDLA-Permissive-2.0.txt',
    'Apache License 2.0': 'https://www.apache.org/licenses/LICENSE-2.0.txt',
    'CC0 1.0 Universal': 'https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC0-1.0.txt',
}
NOTICE = '''Foursquare OS Places Notice
https://opensource.foursquare.com/places-notice-txt/

© 2026 Foursquare Labs, Inc. All rights reserved.
The Foursquare OS Places dataset (the “Data”) is licensed under the Apache License, Version 2.0 (the “License”). You may not use, modify, or distribute the Data except in compliance with the License.
As set forth more fully in the License, if you use, modify, or distribute the Data, you must:
– provide recipients with a copy of the License.
– if applicable, include prominent notices to the extent you’ve changed the Data.
– preserve attribution to Foursquare, including preserving the full content of this NOTICE.txt file.
To ensure appropriate attribution to Foursquare, we recommend the following:
– if using/distributing the Data in flat file form as-is or after making changes/modifications: include this NOTICE.txt file, which may be modified to include an additional notice of your changes/modifications, if any.
– if using/distributing the Data in API form as-is or after making changes/modifications: include a copy of the content from this NOTICE.txt file prominently in your developer documentation for such API, which may be modified to include an additional notice of your changes/modifications, if any.
You may obtain a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, the Data distributed under the License is distributed on an “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
We also encourage you to join our Placemaker community (https://opensource.foursquare.com/placemakers/) where you can contribute and provide suggestions to improve the accuracy of the Data for future releases for yourself and others.
'''
INTRO = '''Place data: Overture Maps Foundation and contributors.
https://docs.overturemaps.org/attribution/#places

Contributors include Meta, Microsoft, PinMeTo, Krick, RenderSEO, DAC, BrightQuery (CDLA Permissive 2.0), Foursquare (Apache 2.0), and AllThePlaces (CC0 1.0).
Overture credits Foursquare: Copyright 2024 Foursquare Labs, Inc. All rights reserved. Foursquare data was transformed to the Overture schema. Changed: 2026-03-18.

JourneyDeck modifications (2026-09-05): US country filtering; open-status and existence-confidence filtering; reduced fields; geographic grouping with overlapping borders; compression. The release manifest records the contributing source datasets in each extract. Place matching is performed on the device. Apple MapKit supplies fallback place lookups. Map display providers are credited separately on each map.
'''

if __name__ == '__main__':
    sections = [dict(title='Place data credits', text=INTRO), dict(title='Foursquare NOTICE', text=NOTICE)]
    for title, url in SOURCES.items():
        with urlopen(url, timeout=30) as response:
            text = response.read().decode('utf-8')
        sections.append(dict(title=title, text=text, source=url))
    target = ROOT / 'mobile/recorder/assets/overture-licenses.json'
    target.write_text(json.dumps(sections, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'tools/overture-us/NOTICE.txt').write_text(INTRO+'\n'+NOTICE, encoding='utf-8')
    print('Saved public license and notice texts.')
