BEGIN;

CREATE TEMPORARY TABLE tsp_edges ON COMMIT DROP AS
WITH tsp AS (
	SELECT * FROM pgr_TSP(
		$$
		SELECT * FROM pgr_dijkstraCostMatrix(
			'SELECT id, source, target, ST_Length(geom) AS cost, ST_Length(geom) AS reverse_cost FROM pedestrian_network_segments',
			(SELECT array_agg(id) FROM pedestrian_network_segments_vertices_pgr WHERE id < 14),
			directed := false
		)
		$$,
		start_id := 7,
		end_id := 7,
		randomize := false
	)
)
	SELECT tsp1.seq AS seq, tsp1.node AS source, tsp2.node AS target
	FROM tsp AS tsp1
	JOIN tsp AS tsp2
	ON tsp1.seq + 1 = tsp2.seq;


WITH order_array AS (
	SELECT array_agg(source ORDER BY seq) AS arr FROM tsp_edges --WARNING: assumes that start = destination in tour
)
SELECT start_vid, end_vid, pedestrian_network_segments.id, pedestrian_network_segments.source, pedestrian_network_segments.target, pedestrian_network_segments.geom
FROM pgr_Dijkstra(
	'SELECT id, source, target, ST_Length(geom) AS cost, ST_Length(geom) AS reverse_cost FROM pedestrian_network_segments',
	'SELECT source, target FROM tsp_edges ORDER BY seq',
	directed := false
)
JOIN pedestrian_network_segments ON edge = pedestrian_network_segments.id
WHERE edge != -1
ORDER BY (
	array_position((SELECT arr FROM order_array), start_vid),
	path_seq
);

COMMIT;
