import os
import logging
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, Input
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.preprocessing import LabelEncoder

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Directory to save the coordinates data
COORDINATES_DIR = 'coordinates'

# Ensure the directory exists
os.makedirs(COORDINATES_DIR, exist_ok=True)

# Paths to save the model and label encoder
MODEL_PATH = 'model.weights.h5'
LABEL_ENCODER_PATH = 'label_encoder.pkl'

# Initialize the CNN model
model = Sequential([
    Input(shape=(50, 50, 1)),
    Conv2D(32, (3, 3), activation='relu'),
    MaxPooling2D((2, 2)),
    Conv2D(64, (3, 3), activation='relu'),
    MaxPooling2D((2, 2)),
    Conv2D(128, (3, 3), activation='relu'),
    MaxPooling2D((2, 2)),
    Flatten(),
    Dense(128, activation='relu', name='dense_1'),
    Dropout(0.5),
    Dense(1, activation='sigmoid', name='dense_2')  # Placeholder, will be updated later
])
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

# Initialize label encoder
label_encoder = LabelEncoder()

@app.route('/api/save_coordinates', methods=['POST'])
def save_coordinates():
    content = request.json
    label = content.get('label')
    coordinates = content.get('coordinates', [])

    if not label or not isinstance(coordinates, list):
        return jsonify({"message": "Invalid data format"}), 400

    # Paths to save the coordinates data for the specific label
    coordinates_pkl_path = os.path.join(COORDINATES_DIR, f'{label}-coordinates.pkl')
    coordinates_json_path = os.path.join(COORDINATES_DIR, f'{label}-coordinates.json')

    # Load existing coordinates data for the label if available
    if os.path.exists(coordinates_pkl_path):
        label_coordinates_data = joblib.load(coordinates_pkl_path)
    else:
        label_coordinates_data = []

    label_coordinates_data.append({'label': label, 'path': coordinates})

    # Save coordinates data to disk in .pkl format
    joblib.dump(label_coordinates_data, coordinates_pkl_path)

    # Save coordinates data to disk in .json format
    with open(coordinates_json_path, 'w') as json_file:
        json.dump(label_coordinates_data, json_file)

    # Log the saved data
    logging.info(f"Saved coordinates for label: {label}")
    logging.info(f"Total saved drawings for {label}: {len(label_coordinates_data)}")

    return jsonify({"message": "Coordinates saved successfully"})

@app.route('/api/metadata', methods=['GET'])
def get_metadata():
    label_counts = {}
    for filename in os.listdir(COORDINATES_DIR):
        if filename.endswith('-coordinates.json'):
            label = filename.split('-coordinates.json')[0]
            with open(os.path.join(COORDINATES_DIR, filename), 'r') as json_file:
                label_coordinates_data = json.load(json_file)
                label_counts[label] = len(label_coordinates_data)
    return jsonify({"metadata": label_counts})

@app.route('/api/saved_data', methods=['GET'])
def get_saved_data():
    all_coordinates_data = []
    for filename in os.listdir(COORDINATES_DIR):
        if filename.endswith('-coordinates.pkl'):
            label_coordinates_data = joblib.load(os.path.join(COORDINATES_DIR, filename))
            all_coordinates_data.extend(label_coordinates_data)
    return jsonify({"savedData": all_coordinates_data})

@app.route('/api/train', methods=['POST'])
def train_model():
    global model, label_encoder

    all_coordinates_data = []
    for filename in os.listdir(COORDINATES_DIR):
        if filename.endswith('-coordinates.json'):
            with open(os.path.join(COORDINATES_DIR, filename), 'r') as json_file:
                label_coordinates_data = json.load(json_file)
                all_coordinates_data.extend(label_coordinates_data)

    if not all_coordinates_data:
        return jsonify({"message": "No coordinates data found"}), 400

    training_data = []
    training_labels = []

    for drawing in all_coordinates_data:
        label = drawing.get('label')
        coordinates = drawing.get('path')

        if not label or not coordinates:
            continue

        # Convert coordinates to a 2D grid
        grid = np.zeros((50, 50))
        for point in coordinates:
            x, y = int(point['x']), int(point['y'])
            if 0 <= x < 50 and 0 <= y < 50:
                grid[y, x] = 1

        # Append to training data
        training_data.append(grid)
        training_labels.append(label)

    # Convert to numpy arrays
    X_train = np.array(training_data).reshape(-1, 50, 50, 1)
    y_train = np.array(training_labels)

    # Normalize the data
    X_train = X_train / 255.0

    # Encode labels
    y_train = label_encoder.fit_transform(y_train)

    # Save the label encoder
    joblib.dump(label_encoder, LABEL_ENCODER_PATH)

    # Data augmentation
    datagen = ImageDataGenerator(
        rotation_range=10,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.1
    )
    datagen.fit(X_train)

    # Split the data into training and validation sets
    validation_split = 0.2
    split_index = int(len(X_train) * (1 - validation_split))
    X_train, X_val = X_train[:split_index], X_train[split_index:]
    y_train, y_val = y_train[:split_index], y_train[split_index:]

    # Update the model's output layer if new classes are added
    num_classes = len(label_encoder.classes_)
    if isinstance(model.layers[-1], Dense) and model.layers[-1].units != num_classes:
        model.pop()
        model.add(Dense(num_classes, activation='softmax' if num_classes > 1 else 'sigmoid', name='output_dense'))
        model.compile(optimizer='adam', loss='sparse_categorical_crossentropy' if num_classes > 1 else 'binary_crossentropy', metrics=['accuracy'])

    # Compile the model (ensure it's compiled before training)
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy' if num_classes > 1 else 'binary_crossentropy', metrics=['accuracy'])

    # Train the model
    model.fit(datagen.flow(X_train, y_train, batch_size=32), epochs=5, validation_data=(X_val, y_val))

    # Save the model and label encoder to disk
    model.save_weights(MODEL_PATH)

    return jsonify({"message": "Model trained successfully"})

@app.route('/api/predict', methods=['POST'])
def predict():
    global model, label_encoder

    # Load the label encoder
    if os.path.exists(LABEL_ENCODER_PATH):
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
    else:
        return jsonify({"message": "Label encoder not found"}), 400

    content = request.json
    coordinates = content.get('coordinates', [])

    if not coordinates:
        logging.error("No coordinates provided")
        return jsonify({"message": "No coordinates provided"}), 400

    logging.info(f"Received coordinates: {coordinates}")

    # Convert coordinates to a 2D grid
    grid = np.zeros((50, 50))
    for point in coordinates:
        x, y = int(point['x']), int(point['y'])
        if 0 <= x < 50 and 0 <= y < 50:
            grid[y, x] = 1

    # Normalize the data
    X_test = np.array([grid]).reshape(-1, 50, 50, 1) / 255.0

    # Predict the label
    prediction = model.predict(X_test)
    confidence_score = float(np.max(prediction)) if len(label_encoder.classes_) > 1 else float(prediction[0][0])
    predicted_label = label_encoder.inverse_transform([np.argmax(prediction) if len(label_encoder.classes_) > 1 else int(prediction[0][0] > 0.5)])

    logging.info(f"Prediction: {predicted_label[0]}, Confidence Score: {confidence_score}")

    return jsonify({"predicted_label": predicted_label[0], "confidence_score": confidence_score})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)