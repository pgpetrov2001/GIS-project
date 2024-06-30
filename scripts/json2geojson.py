import sys
import json

with open(sys.argv[1]) as file:
    raw_json_data = file.read()

json_data = json.loads(raw_json_data)

geojson = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [item["location"]["lng"], item["location"]["lat"]],
            },
            "properties": { key: item[key] for key in item if key not in ["location"] },
        }
        for item in json_data
    ],
}

with open(sys.argv[2], mode='wt') as file:
    file.write(json.dumps(geojson))
