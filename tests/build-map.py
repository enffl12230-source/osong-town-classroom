"""Build the self-contained SVG position diagram from canonical place coordinates."""
from __future__ import annotations

import base64
import io
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
places = json.loads((ROOT / "data/places.json").read_text(encoding="utf-8-sig"))["places"]
by_id = {place["id"]: place for place in places}
assert list(by_id) == ["station", "osco", "park", "health", "center"]

# Local equirectangular projection: north is up, with one scale for both axes.
# Latitude correction keeps east/west and north/south distances proportional.
west = min(place["coords"][1] for place in places)
north = max(place["coords"][0] for place in places)
mean_lat = sum(place["coords"][0] for place in places) / len(places)
scale = 15100
longitude_correction = math.cos(math.radians(mean_lat))

def project(place):
    lat, lon = place["coords"]
    return (300 + (lon - west) * longitude_correction * scale,
            150 + (north - lat) * scale)

points = {place["id"]: project(place) for place in places}
cards = {
    "health": (170, 107, 298, 86),
    "osco": (664, 192, 202, 84),
    "station": (588, 286, 256, 80),
    "park": (40, 284, 210, 108),
    "center": (141, 450, 299, 79),
}

parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" role="img" aria-labelledby="map-title map-description">
  <title id="map-title">우리 동네 위치 그림지도</title>
  <desc id="map-description">청주 오송의 다섯 장소를 실제 좌표에 따라 표시했습니다. 가장 북쪽은 4번 오송생명과학단지 보건지소입니다. 그 남동쪽에는 2번 청주오스코, 남쪽에는 1번 오송역이 있습니다. 3번 정중근린공원 물놀이장은 서쪽, 5번 오송읍 행정복지센터는 가장 남쪽에 있습니다. 점선은 이름표 연결선이며 이동 경로가 아닙니다. 표시는 시설의 대표 위치입니다. 축척이 없으며 길 안내용이 아닙니다.</desc>
  <defs>
    <style>
      @font-face{font-family:MapJua;src:url('data:font/ttf;base64,__FONT_DATA__') format('truetype');font-weight:400;font-style:normal}
      text{font-family:MapJua,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;fill:#244d40}
      .heading{font-size:31px}.label{font-size:24px}.hint{font-size:17px;fill:#64776b}
      .number{font-size:25px;fill:#fffef8;text-anchor:middle}
      .leader{fill:none;stroke:#98ac9a;stroke-width:2.5;stroke-dasharray:5 5;stroke-linecap:round;stroke-linejoin:round}
      .card{fill:#fffef8;stroke:#d7e3d4;stroke-width:2}
    </style>
    <filter id="soft-shadow" x="-15%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#244d40" flood-opacity=".08"/></filter>
    <pattern id="paper-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#dce5d1"/></pattern>
  </defs>
  <rect width="900" height="600" rx="28" fill="#fbf8e9"/>
  <rect x="18" y="86" width="864" height="456" rx="22" fill="url(#paper-dots)"/>
  <path d="M19 472C71 435 107 476 159 486C187 492 193 520 177 541H19Z" fill="#e9eed8"/>
  <path d="M755 424C802 383 848 417 881 455V541H772C789 503 717 464 755 424Z" fill="#e9eed8"/>
  <circle cx="42" cy="43" r="13" fill="#e98064"/>
  <path d="M38 43l3 3 6-7" fill="none" stroke="#fffef8" stroke-width="3" stroke-linecap="round"/>
  <text x="65" y="55" class="heading">우리 동네 위치 그림지도</text>
  <rect x="658" y="28" width="207" height="35" rx="17" fill="#e2edda"/>
  <text x="761" y="52" text-anchor="middle" font-size="18">청주 오송 · 탐험 5곳</text>
  <text x="50" y="231" font-size="20">어디에 있을까요?</text>
  <text x="50" y="258" class="hint">번호를 찾아 탐험해요.</text>
''']

for place in places:
    place_id = place["id"]
    x, y = points[place_id]
    cx, cy, width, height = cards[place_id]
    # Cards sit on the far side of their point. Only short label leaders are drawn.
    edge = cx + width if cx < x else cx
    toward = x - 27 if edge < x else x + 27
    parts.append(f'  <path class="leader" d="M{edge:.2f} {y:.2f}H{toward:.2f}"/>')
    parts.append(f'  <g filter="url(#soft-shadow)" data-label-for="{place_id}">')
    parts.append(f'    <rect x="{cx}" y="{cy}" width="{width}" height="{height}" rx="18" class="card"/>')
    if place_id == "health":
        first, second = place["name"].split(" ", 1)
        parts.append(f'    <text x="{cx+20}" y="{cy+32}" font-size="23">{escape(first)}</text>')
        parts.append(f'    <text x="{cx+20}" y="{cy+63}" font-size="18">{escape(second)} · 건강을 돕는 곳</text>')
    elif place_id == "park":
        first, second = place["name"].split(" ", 1)
        parts.append(f'    <text x="{cx+19}" y="{cy+30}" font-size="24">{escape(first)}</text>')
        parts.append(f'    <text x="{cx+19}" y="{cy+58}" font-size="24">{escape(second)}</text>')
        parts.append(f'    <text x="{cx+19}" y="{cy+87}" class="hint">함께 놀고 쉬는 곳</text>')
    else:
        parts.append(f'    <text x="{cx+20}" y="{cy+32}" class="label">{escape(place["name"])}</text>')
        parts.append(f'    <text x="{cx+20}" y="{cy+61}" class="hint">{escape(place["roleLabel"])}</text>')
    parts.append('  </g>')
    color = "#e98064" if place_id in ("station", "osco") else "#3d8069"
    number = int(place["number"])
    lat, lon = place["coords"]
    parts.append(f'  <g data-place-id="{place_id}" data-lat="{lat}" data-lon="{lon}" data-x="{x:.3f}" data-y="{y:.3f}">')
    parts.append(f'    <circle cx="{x:.3f}" cy="{y:.3f}" r="26" fill="{color}" stroke="#fffef8" stroke-width="5"/>')
    parts.append(f'    <text x="{x:.3f}" y="{y+9:.3f}" class="number">{number}</text>')
    parts.append('  </g>')

parts.append('''  <g transform="translate(820 112)">
    <text x="0" y="0" text-anchor="middle" font-size="20">북</text>
    <path d="M0 12l-11 28 11-5 11 5Z" fill="#345f4d"/>
    <path d="M0 36v23" stroke="#345f4d" stroke-width="3" stroke-linecap="round"/>
    <text x="0" y="78" text-anchor="middle" font-size="14">N</text>
  </g>
  <text x="50" y="423" font-size="14" fill="#64776b">점선은 이름표 연결선이에요.</text>
  <path d="M35 548H865" stroke="#dce4d3" stroke-width="1.5"/>
  <text x="450" y="578" text-anchor="middle" font-size="18">실제 좌표의 위치 관계를 단순화했어요 · 축척 없음 · 길 안내용 아님</text>
</svg>
''')

svg = "\n".join(parts)
tree = ET.fromstring(svg)
visible_text = "".join(element.text or "" for element in tree.iter()
                       if element.tag.rsplit("}", 1)[-1] in ("text", "title", "desc"))
font = TTFont(ROOT / "assets/Jua-Regular.ttf")
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=visible_text)
subsetter.subset(font)
font_bytes = io.BytesIO()
font.save(font_bytes)
svg = svg.replace("__FONT_DATA__", base64.b64encode(font_bytes.getvalue()).decode("ascii"))
ET.fromstring(svg)
output = ROOT / "assets/osong-simple-map.svg"
output.write_text(svg, encoding="utf-8", newline="\n")
print(f"Built {output.name}: {len(svg.encode('utf-8')):,} bytes, embedded Jua {len(font_bytes.getvalue()):,} bytes")
for place in places:
    print(place["id"], "point", tuple(round(v, 3) for v in points[place["id"]]))
