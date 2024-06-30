create user gis_project_user with password 'password';

create database gisproject;

grant all privileges on database gisproject to gis_project_user;
