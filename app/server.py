import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, render_template, jsonify, request
from queries import *

conn = psycopg2.connect(
    dbname="gisproject",
    user="gis_project_user",
    password="password",
    host="localhost",
    port="5432"
)

def db_fetch_all(query: str, params = None, to_commit = None):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, params)
    results = cur.fetchall()
    if to_commit:
        conn.commit()
    return results

def db_fetch_one(query: str, params = None, to_commit = None):
    cur = conn.cursor()
    cur.execute(query, params)
    result = cur.fetchone()
    if to_commit:
        conn.commit()
    return result

relevant_categories = ['hotel', 'restaurant', 'bar', 'hostel']


app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/geojson/<string:name>", methods=["GET"])
def read_geojson(name: str):
    return jsonify(db_fetch_one(*get_geojson_query(name))[0])


@app.route("/tsp", methods=["GET"])
def tsp():
    starting_node = request.args.get("starting_node", type=int)
    nodes_to_visit = list(map(int, request.args.getlist("node_to_visit"))) + [starting_node]
    return jsonify(db_fetch_all(*find_tsp_tour(starting_node, nodes_to_visit)))

@app.route("/proximity", methods=["GET"])
def proximity():
    starting_node = request.args.get("place_id", type=int)
    threshold = request.args.get("threshold", type=float)
    threshold /= 111_000
    types = request.args.getlist("type")
    return jsonify(db_fetch_all(*find_proximity(starting_node, types, threshold)))


if __name__ == "__main__":
    app.run(debug=True)
