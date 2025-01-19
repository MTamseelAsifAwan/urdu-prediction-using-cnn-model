from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import pairwise_distances_argmin_min
from sklearn.preprocessing import StandardScaler
import numpy as np
import os
import joblib

app = Flask(__name__)
CORS(app)

# Paths to save the model, scaler, training data, and metadata
MODEL_PATH = 'model.pkl'
SCALER_PATH = 'scaler.pkl'
TRAINING_DATA_PATH = 'training_data.pkl'
TRAINING_LABELS_PATH = 'training_labels.pkl'
METADATA_PATH = 'metadata.pkl'

# Initialize the RandomForestClassifier and metadata
if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(TRAINING_DATA_PATH) and os.path.exists(TRAINING_LABELS_PATH) and os.path.exists(METADATA_PATH):
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    training_data = joblib.load(TRAINING_DATA_PATH)
    training_labels = joblib.load(TRAINING_LABELS_PATH)
    metadata = joblib.load(METADATA_PATH)
else:
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    scaler = StandardScaler()
    training_data = []
    training_labels = []
    metadata = {}

# Define the fixed length for the coordinates (for example, 50 points)
FIXED_PATH_LENGTH = 50

@app.route('/')
def hello_world():
    return 'Hello, World!'

@app.route('/api/train', methods=['POST'])
def train_model():
    global model, scaler, training_data, training_labels, metadata

    content = request.json
    label = content['label']
    coordinates = content['coordinates']

    # Convert coordinates to a flat list
    flat_coordinates = [coord for point in coordinates for coord in (point['x'], point['y'])]

    # Pad or truncate the coordinates to ensure consistent length
    if len(flat_coordinates) < FIXED_PATH_LENGTH * 2:
        flat_coordinates += [0] * (FIXED_PATH_LENGTH * 2 - len(flat_coordinates))
    else:
        flat_coordinates = flat_coordinates[:FIXED_PATH_LENGTH * 2]

    # Append to training data
    training_data.append(flat_coordinates)
    training_labels.append(label)

    # Update metadata
    if label in metadata:
        metadata[label] += 1
    else:
        metadata[label] = 1

    # Convert to numpy arrays
    X_train = np.array(training_data)
    y_train = np.array(training_labels)

    # Standardize the data
    scaler.fit(X_train)
    X_train = scaler.transform(X_train)

    # Train the model
    model.fit(X_train, y_train)

    # Save the model, scaler, training data, and metadata to disk
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(training_data, TRAINING_DATA_PATH)
    joblib.dump(training_labels, TRAINING_LABELS_PATH)
    joblib.dump(metadata, METADATA_PATH)

    # Log the metadata to the console
    print(f"Metadata: {metadata}")

    return jsonify({"message": "Model trained successfully", "metadata": metadata})

@app.route('/api/test', methods=['POST'])
def test_model():
    global model, scaler, training_data

    content = request.json
    coordinates = content['coordinates']

    # Convert coordinates to a flat list
    flat_coordinates = [coord for point in coordinates for coord in (point['x'], point['y'])]

    # Pad or truncate the coordinates to ensure consistent length
    if len(flat_coordinates) < FIXED_PATH_LENGTH * 2:
        flat_coordinates += [0] * (FIXED_PATH_LENGTH * 2 - len(flat_coordinates))
    else:
        flat_coordinates = flat_coordinates[:FIXED_PATH_LENGTH * 2]

    # Standardize the test data
    X_test = scaler.transform([flat_coordinates])

    # Predict the label
    prediction = model.predict(X_test)

    # Calculate similarity score based on Euclidean distance
    if len(training_data) > 0:
        X_train = np.array(training_data)
        X_train = scaler.transform(X_train)
        dist_matrix = pairwise_distances_argmin_min(X_test, X_train)
        min_distance = np.mean(dist_matrix[1])  # Average minimum distance
        similarity_score = 100 / (1 + min_distance)  # Inverse of distance for similarity
    else:
        similarity_score = 0

    # Log the prediction and similarity score to the console
    print(f"Prediction: {prediction[0]}, Similarity Score: {similarity_score:.2f}%")

    return jsonify({"prediction": prediction[0], "similarity_score": similarity_score})

if __name__ == '__main__':
    app.run(debug=True)