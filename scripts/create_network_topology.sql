DELETE FROM places WHERE NOT (categoryname ilike '%hotel%' OR categoryname ilike '%restaurant%' OR categoryname ilike '%hostel%' OR categoryname ilike '%bar%');

-- create a table of segments, taken from the multi-linestring pedestrian network
CREATE TABLE pedestrian_network_segments AS
WITH
pedestrian_network2 AS (
	SELECT id, ST_LineMerge(geom) AS geom FROM pedestrian_network
),
pts_dump AS ( 
	SELECT id, ST_DumpPoints(geom) AS pt FROM pedestrian_network2
), 
pts AS (
	SELECT id, (pt).geom, (pt).path[1] AS vert FROM pts_dump
) 
SELECT a.id as source_id, CAST(row_number() over() AS INTEGER) AS id, ST_MakeLine(ARRAY[a.geom, b.geom]) AS geom
FROM pts a, pts b 
WHERE a.id = b.id AND a.vert = b.vert-1 AND b.vert > 1;

--prepare the table for pgr_createTopology
ALTER TABLE pedestrian_network_segments ADD COLUMN IF NOT EXISTS source INTEGER;
ALTER TABLE pedestrian_network_segments ADD COLUMN IF NOT EXISTS target INTEGER;
ALTER TABLE pedestrian_network_segments ADD COLUMN IF NOT EXISTS place_id INTEGER DEFAULT NULL;

-- insert edges for access points of places onto the pedestrian network, between the access point and the endpoints of the nearest segment
-- this query might take a couple of minutes to run
WITH
number_of_segments AS (
	SELECT COUNT(*) AS num FROM pedestrian_network_segments
),
places_segs AS (
	SELECT 
		places.id AS place_id, 
		segs.id AS seg_id, 
		places.geom AS place_geom,
		segs.geom AS seg_geom,
		ST_ClosestPoint(segs.geom, places.geom) AS closest_point,
		source_id
	FROM 
		places
	JOIN 
		pedestrian_network_segments segs 
	ON 
		segs.id = (
			SELECT id 
			FROM pedestrian_network_segments segs2
			ORDER BY places.geom <-> segs2.geom 
			LIMIT 1
		)
), number_of_places AS (
	SELECT COUNT(*) AS num FROM places
)
INSERT INTO pedestrian_network_segments (id, source_id, place_id, geom)
SELECT
	row_number() over() + (SELECT num FROM number_of_segments), source_id, place_id,
	ST_MakeLine(ARRAY[place_geom, closest_point]) AS geom
FROM places_segs
UNION ALL
SELECT
	row_number() over() + (SELECT num FROM number_of_segments) + 1*(SELECT num FROM number_of_places), source_id, place_id,
	ST_MakeLine(ARRAY[place_geom, closest_point]) AS geom
FROM places_segs
UNION ALL
SELECT
	row_number() over() + (SELECT num FROM number_of_segments) + 2*(SELECT num FROM number_of_places), source_id, NULL,
	ST_MakeLine(ARRAY[closest_point, ST_StartPoint(seg_geom)]) AS geom
FROM places_segs
UNION ALL
SELECT
	row_number() over() + (SELECT num FROM number_of_segments) + 3*(SELECT num FROM number_of_places), source_id, NULL,
	ST_MakeLine(ARRAY[closest_point, ST_EndPoint(seg_geom)]) AS geom
FROM places_segs;

--creates the edges into the source and target columns of pedestrian_network_segments, and adds a new column "pedestrian_network_segments_vertices"
SELECT pgr_createTopology('pedestrian_network_segments', 0.000001, 'geom', 'id');
