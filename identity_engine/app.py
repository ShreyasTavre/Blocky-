from flask import Flask, jsonify
from flask_cors import CORS
from faker import Faker

app = Flask(__name__)
CORS(app)
fake = Faker()

@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Welcome to the Identity Engine API! Go to /generate to see the data."})

@app.route('/generate', methods=['GET'])
def generate_identity():
    identity = {
        "name": fake.name(),
        "job": fake.job(),
        "location": fake.city()
    }
    return jsonify(identity)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
