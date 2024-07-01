create table pedestrian_network (
	id serial primary key,
	geom geometry(MULTILINESTRING, 7801)
);

create table places (
	id serial primary key,
	geom geometry(POINT, 7801)
);
