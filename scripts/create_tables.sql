create table pedestrian_network (
	id serial primary key,
	name varchar(255),
	geom geometry(MULTILINESTRING, 7801)
);

create table places (
	id serial primary key,
	name varchar(255),
	geom geometry(POINT, 7801)
);
