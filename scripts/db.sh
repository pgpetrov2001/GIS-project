#!/bin/bash
sudo -u postgres psql -f init_database.sql
sudo -u postgres psql -c "create extension postgis" gisproject
sudo -u postgres psql -c "create extension pgRouting cascade" gisproject

PGPASSWORD=password psql -h 127.0.0.1 -p 5432 -f create_tables.sql gisproject gis_project_user
sudo -u postgres ogr2ogr -f "PostgreSQL" PG:"dbname=gisproject user=postgres" "../data/peshehodna_mreja_26_sofpr_20200406.geojson" -nln pedestrian_network -lco GEOMETRY_NAME=geom
sudo -u postgres ogr2ogr -f "PostgreSQL" PG:"dbname=gisproject user=postgres" "../data/hotels_hostels_restaurants_bars.geojson" -nln places -lco GEOMETRY_NAME=geom

sudo -u postgres psql -f create_network_topology.sql gisproject
