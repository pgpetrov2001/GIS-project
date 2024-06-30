let map = L.map('map').setView([42.698334, 23.319941], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

async function loadGeoJSON(name) {
	const response = await fetch(`/geojson/${name}`);
	if (!response.ok) {
		throw new Error(`Failed to load GeoJSON: ${response.status}`);
	}
	return await response.json();
}

function addGeoJSONLayer(data, options = {}) {
	const geoJsonLayer = L.geoJSON(data, options);
	return map.addLayer(geoJsonLayer);
}

function addMbTilesLayer(url) {
	return L.tileLayer.mbTiles(url).addTo(map);
}

const type2color = {
	'hotel': 'blue',
	'restaurant': 'red',
	'hostel': 'green',
	'bar': 'purple',
};

const placesLayerOptions = {
	style: function(feature) {
		return { color: type2color[feature.properties.category_simplified] };
	},
	pointToLayer: function (feature, latlng) {
        return new L.Circle(latlng, {
            radius: 10,
            fillOpacity: 0.85
        });
    }
};

const pedestrianNetworkLayerOptions = {
	style: {
		color: 'black',
		weight: 1,
		opacity: 1,
	},
};

let placesLayer = null;
let pedestrianNetworkLayer = null;

loadGeoJSON('places')
	.then(async (placesData) => {
		//Wait for places to be loaded before loading pedestrian network, because it takes longer to load
		placesLayer = addGeoJSONLayer(placesData, placesLayerOptions);

		// addMbTilesLayer('/static/pedestrian_network.mbtiles');
		const pedestrianNetworkData = await loadGeoJSON('pedestrian_network');

		map.removeLayer(placesLayer);
		pedestrianNetworkLayer = addGeoJSONLayer(pedestrianNetworkData, pedestrianNetworkLayerOptions);
		placesLayer            = addGeoJSONLayer(placesData, placesLayerOptions);
	})
	.catch((err) => alert(err.message));


