let map = L.map('map').setView([42.698334, 23.319941], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const type2color = {
	'hotel': '#E9C46A',
	'restaurant': '#36BA98',
	'hostel': '#698474',
	'bar': '#3FA2F6',
};

const info = L.control();

info.onAdd = function (map) {
	this._div = L.DomUtil.create('div', 'info');
	this.update();
	return this._div;
};

const legend = L.control({position: 'bottomleft'});
legend.onAdd = (map) => {
	const div = L.DomUtil.create('div', 'info legend');
	const labels = ['<strong>Categories</strong>'],
	categories = Object.keys(type2color).map((cat) => [cat, cat.charAt(0).toUpperCase() + cat.slice(1)]);
	for (const [ cat, displayCat ] of categories) {
		labels.push(`<i class="circle" style="background: ${type2color[cat]}"></i> ${displayCat ?? '+'}`);
	}
	div.innerHTML = labels.join('<br>');
	return div;
};
legend.addTo(map);

info.update = function (props) {
	this._div.innerHTML = '';
	if (!props) return;
	for (const key of ["title", "categoryname", "address", "phone", "id"]) {
		if (!(key in props)) continue;
		const value = props[key];
		const displayKey = {
			title: 'Title',
			categoryname: 'Category',
			address: 'Address',
			phone: 'Phone Number',
			id: 'ID',
		}[key] ?? key;
		this._div.innerHTML += `<h3>${displayKey}</h3>: <div class="info_block">${value ?? 'N/A'}</div><br>`;
	}
};

let targetLocations = ['bar'];

function setLocationsOption(types) {
	targetLocations = types.slice();
}

let toShowArrows = false;

function showArrows(value) {
	toShowArrows = value;
}

function setRouteInfo(totalDist, totalTime, numBars, numRestaurants) {
	const minutes = totalTime * 60;
	document.getElementById('route-info').innerHTML = `
		Total distance: ${totalDist.toFixed(0)}m, Total time: ${minutes.toFixed(0)} minute${minutes == 1? '': 's'}<br/>
		Visited ${numBars} bars and ${numRestaurants} restaurants in total.
	`;
}

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

const highlightStyle = (feature) => { return {
	color: '#666',
	fillColor: type2color[feature.properties.category_simplified],
	weight: 3,
}};

const highlightFeature = (e) => {
	if (tspPlaces == null || !tspPlaces.includes(e.target.feature.id)) {
		e.target.setStyle(highlightStyle(e.target.feature));
		e.target.bringToFront();
	}
	info.update(e.target.feature.properties);
};

const resetHighlight = (e) => {
	if (tspPlaces == null || !tspPlaces.includes(e.target.feature.id)) {
		placesLayer.resetStyle(e.target);
	}
	info.update();
};

const clickFeature = async (e) => {
	if (placesLayer != placesLayer) return;
	if (tspFeature != null) map.removeLayer(tspFeature);
	const id = e.target.feature.id;
	const data = await loadFromUrl(`/proximity?place_id=${id}&threshold=500&${targetLocations.map((locationType) => `type=${locationType}`).join('&')}`)
		.catch((err) => alert(err.message));
	if (tspPlaces != null) {
		for (const placeId of tspPlaces) {
			placesLayer.resetStyle(placesLayers[placeId]);
		}
	}
	const placeIds = data.map(({ id }) => id);
	tspPlaces = placeIds.slice();
	tspPlaces.push(e.target.feature.id);

	let numBars = 0, numRestaurants = 0;
	for (const placeId of placeIds) {
		const placeLayer = placesLayers[placeId];
		const { feature } = placeLayer;
		if (feature.properties.category_simplified === 'bar') numBars++;
		if (feature.properties.category_simplified === 'restaurant') numRestaurants++;
		placeLayer.setStyle(highlightStyle(feature));
	}
	e.target.setStyle({
		...highlightStyle(e.target.feature),
		color: 'red',
	});

	console.log(placeIds);
	const tour = await loadFromUrl(`/tsp?starting_node=${id}&${placeIds.map((id) => `node_to_visit=${id}`).join('&')}`).catch((err) => alert(err.message));
	const group = [];
	let totalTime = 0;
	let totalDist = 0;
	for (const segment of tour) {
		const geom = JSON.parse(segment.geom);
		group.push(geom.coordinates.map(([lng, lat]) => [lat, lng]));
		totalDist += segment.length_m;
		totalTime += (segment.length_m / 1000) / segment.max_speed_kmh;
	}
	setRouteInfo(totalDist, totalTime, numBars, numRestaurants);
	let featureGroup = [];
	const polyline = L.polyline(group, {
		color: 'blue',
		weight: 4,
	}).addTo(map);
	featureGroup.push(polyline);
	if (toShowArrows) {
		featureGroup.push(L.polylineDecorator(polyline, {
			patterns: [{
				offset: 0,
				endOffset: '0%',
				repeat: 20,
				symbol: L.Symbol.arrowHead({pixelSize: 5, polygon: false, pathOptions: {stroke: true}})
			}],
		}).addTo(map));
	}
	tspFeature = L.featureGroup(featureGroup).addTo(map);
	placesLayer.bringToFront();
};

const placesLayers = {};

const placesLayerOptions = {
	style: function(feature) {
		return { color: type2color[feature.properties.category_simplified] };
	},
	pointToLayer: function (feature, latlng) {
        return new L.Circle(latlng, {
            radius: 10,
            fillOpacity: 0.95
        });
    },
	onEachFeature: function(feature, layer) {
		placesLayers[feature.id] = layer;
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
let tspPlaces = null;

info.addTo(map);

loadGeoJSON('places')
	.then(async (placesData) => {
		//Wait for places to be loaded before loading pedestrian network, because it takes longer to load
		[ placesLayer, placesFeature ] = addGeoJSONLayer(placesData, placesLayerOptions);

		const pedestrianNetworkData = await loadGeoJSON('pedestrian_network');

		[ pedestrianNetworkLayer, pedestrianNetworkFeature ] = addGeoJSONLayer(pedestrianNetworkData, pedestrianNetworkLayerOptions);
		placesLayer.bringToFront();
		pedestrianNetworkLayer.bringToBack();

	})
	.catch((err) => alert(err.message));


