let map = L.map('map').setView([42.698334, 23.319941], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const info = L.control();

info.onAdd = function (map) {
	this._div = L.DomUtil.create('div', 'info');
	this.update();
	return this._div;
};

info.update = function (props) {
	this._div.innerHTML = '';
	for (const [key, value] of Object.entries(props || {})) {
		if (!["name", "categoryname", "address", "phone", "id"].includes(key)) continue;
		this._div.innerHTML += `<b>${key}</b>: <div class="info_block">${value}</div><br>`;
	}
};

async function loadFromUrl(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load from "${url}": ${response.status}`);
	}
	return await response.json();
}

async function loadGeoJSON(name) {
	return await loadFromUrl(`/geojson/${name}`);
}

function addGeoJSONLayer(data, options = {}) {
	const geoJsonLayer = L.geoJSON(data, options);
	const feature = map.addLayer(geoJsonLayer);
	return [ geoJsonLayer, feature ];
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

const highlightFeature = (e) => {
	e.target.setStyle({
		weight: 5,
		color: '#666',
		dashArray: '',
		fillOpacity: 0.7
	});

	e.target.bringToFront();
	info.update(e.target.feature.properties);
};

const resetHighlight = (e) => {
	placesLayer.resetStyle(e.target);
	info.update();
};

const clickFeature = async (e) => {
	if (placesLayer != placesLayer) return;
	if (tspFeature != null) map.removeLayer(tspFeature);
	const id = e.target.feature.id;
	const data = await loadFromUrl(`/proximity?place_id=${id}&threshold=500&type=bar&type=restaurant&type=hotel&type=hostel`).catch((err) => alert(err.message));
	const placeIds = data.map(({ id }) => id);
	console.log(placeIds);
	const tour = await loadFromUrl(`/tsp?starting_node=${id}&${placeIds.map((id) => `node_to_visit=${id}`).join('&')}`).catch((err) => alert(err.message));
	const group = [];
	for (const segment of tour) {
		const geom = JSON.parse(segment.geom);
		group.push(geom.coordinates.map(([lng, lat]) => [lat, lng]));
	}
	const polyline = L.polyline(group, { color: 'red', weight: 5 }).addTo(map);
	tspFeature = L.featureGroup([polyline]).addTo(map);
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
    },
	onEachFeature: function(feature, layer) {
		layer.on({
			mouseover: highlightFeature,
			mouseout: resetHighlight,
			click: clickFeature,
		});
	},
};

const pedestrianNetworkLayerOptions = {
	style: {
		color: 'black',
		weight: 1,
		opacity: 1,
	},
};

let placesLayer = null, placesFeature = null;
let pedestrianNetworkLayer = null, pedestrianNetworkFeature = null;
let tspLayer = null, tspFeature = null;

info.addTo(map);

loadGeoJSON('places')
	.then(async (placesData) => {
		//Wait for places to be loaded before loading pedestrian network, because it takes longer to load
		[ placesLayer, placesFeature ] = addGeoJSONLayer(placesData, placesLayerOptions);

		// addMbTilesLayer('/static/pedestrian_network.mbtiles');
		const pedestrianNetworkData = await loadGeoJSON('pedestrian_network');

		map.removeLayer(placesFeature);
		[ pedestrianNetworkLayer, pedestrianNetworkFeature ] = addGeoJSONLayer(pedestrianNetworkData, pedestrianNetworkLayerOptions);
		[ placesLayer, placesFeature ]                       = addGeoJSONLayer(placesData, placesLayerOptions);

	})
	.catch((err) => alert(err.message));


