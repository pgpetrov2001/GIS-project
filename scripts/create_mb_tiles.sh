#!/bin/bash
ogr2ogr -f MVT -dsco FORMAT=MBTILES -dsco MAXZOOM=18 pedestrian_network.mbtiles ../data/peshehodna_mreja_26_sofpr_20200406.geojson
