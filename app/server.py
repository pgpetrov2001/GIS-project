import psycopg2
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
    cur = conn.cursor()
    cur.execute(query, params)
    results = cur.fetchall()
    if to_commit:
        conn.commit()
    return results

relevant_categories = ['hotel', 'restaurant', 'bar', 'hostel']


app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/geojson/<string:name>", methods=["GET"])
def read_geojson(name: str):
    if name == "places":
        category_simplification_case_statement = "\n".join(f"WHEN categoryname ILIKE '%{category}%' THEN '{category}'" for category in relevant_categories)
        category_simplification_case_statement = f"CASE {category_simplification_case_statement} END AS category_simplified"
        where_statement = " or ".join(f"categoryname ilike '%{category}%'" for category in relevant_categories)
        return jsonify(db_fetch_all(*get_geojson_query(
            name,
            [category_simplification_case_statement],
            where_statement
        ))[0])

    return jsonify(db_fetch_all(*get_geojson_query(name))[0])


@app.route("/tsp", methods=["GET"])
def tsp():
    starting_node = request.args.get("starting_node", type=int)
    nodes_to_visit = list(map(int, request.args.getlist("node_to_visit"))) + [starting_node]
    return jsonify(db_fetch_all(*find_tsp_tour(starting_node, nodes_to_visit)))


if __name__ == "__main__":
    app.run(debug=True)
