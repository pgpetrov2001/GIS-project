def get_geojson_query(name: str, cols: list = None, whereclause: str = None):
    return f"""
        SELECT jsonb_build_object(
            'type',     'FeatureCollection',
            'features', jsonb_agg(feature)
        )
        FROM (
          SELECT jsonb_build_object(
            'type',       'Feature',
            'id',         id,
            'geometry',   ST_AsGeoJSON(geom)::jsonb,
            'properties', to_jsonb(inputs) - 'id' - 'geom'
          ) AS feature
          FROM (SELECT * {'' if cols is None else ', ' + ', '.join(cols)} FROM {name} {'' if whereclause is None else f'WHERE {whereclause}'}) AS inputs
        ) features;
    """, None, None


def find_tsp_tour(starting_node: int, nodes_to_visit: list):
    if starting_node not in nodes_to_visit:
        raise ValueError("Starting node must be in list of nodes to visit")

    return """
        ROLLBACK; BEGIN;

        CREATE TEMPORARY TABLE v_with_place_id ON COMMIT DROP AS
            SELECT v.id AS id, e.place_id AS place_id
            FROM pedestrian_network_segments_vertices_pgr AS v
            JOIN pedestrian_network_segments              AS e
            ON v.id = e.source
            WHERE e.place_id = ANY(%(nodes_to_visit)s)
            GROUP BY v.id, e.place_id;

        CREATE TEMPORARY TABLE tsp_edges ON COMMIT DROP AS
        WITH tsp AS (
            SELECT * FROM pgr_TSP(
                $$
                SELECT * FROM pgr_dijkstraCostMatrix(
                    'SELECT id, source, target, ST_Length(geom) AS cost, ST_Length(geom) AS reverse_cost FROM pedestrian_network_segments',
                    ( SELECT array_agg(id) FROM v_with_place_id ),
                    directed := false
                )
                $$,
                start_id := ( SELECT id FROM v_with_place_id WHERE place_id = %(start_id)s LIMIT 1 ),
                end_id := ( SELECT id FROM v_with_place_id WHERE place_id = %(start_id)s LIMIT 1 ),
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
    """, { "start_id": starting_node, "nodes_to_visit": nodes_to_visit }, True
