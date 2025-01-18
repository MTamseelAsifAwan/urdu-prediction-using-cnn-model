import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const interpolatePoints = (p1, p2, numPoints = 10) => {
  const points = [];
  const dx = (p2.x - p1.x) / numPoints;
  const dy = (p2.y - p1.y) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    points.push({ x: p1.x + dx * i, y: p1.y + dy * i });
  }
  return points;
};

const UrduAlphabetCanvas = ({ onSave, trainingStatus, setTrainingCoordinates }) => {
  const canvasRef = useRef(null);
  const [drawings, setDrawings] = useState([]);
  const [currentLabel, setCurrentLabel] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const getTouchPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    };

    const startDrawing = (e) => {
      setIsDrawing(true);
      const pos = e.type === 'mousedown' ? { x: e.offsetX, y: e.offsetY } : getTouchPos(e);
      const path = [{ x: pos.x, y: pos.y, timestamp: Date.now(), duration: 0 }];
      setCurrentPath(path);
      setStartTime(Date.now());
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const pos = e.type === 'mousemove' ? { x: e.offsetX, y: e.offsetY } : getTouchPos(e);
      const currentTimestamp = Date.now();
      const duration = (currentTimestamp - startTime) / 1000; // Duration in seconds
      const newPath = [
        ...currentPath,
        {
          x: pos.x,
          y: pos.y,
          timestamp: currentTimestamp,
          duration: duration.toFixed(3), // Save duration with precision
        },
      ];
      setCurrentPath(newPath);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 5;
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      ctx.closePath();
      setTrainingCoordinates(currentPath); // Update training coordinates
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [currentPath, isDrawing]);

  const saveCoordinates = () => {
    if (currentLabel && currentPath.length > 0) {
      const newDrawing = { label: currentLabel, path: currentPath };
      setDrawings([...drawings, newDrawing]);
      onSave([newDrawing]);
      setCurrentPath([]);
    }
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drawings));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "drawings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="text-center bg-gray-800 border text-white p-4 rounded-lg shadow-lg max-w-screen-md mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 text-center">
        Training Canvas
      </h2>
      <div className="relative mx-auto" style={{ maxWidth: "500px" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-auto bg-white rounded-xl border border-white"
          width={500}
          height={350}
        ></canvas>
      </div>
      <div className="mt-4 flex flex-col items-center">
        <input
          type="text"
          placeholder="Enter label for the current drawing"
          value={currentLabel}
          onChange={(e) => setCurrentLabel(e.target.value)}
          className="border p-2 w-full sm:w-3/4 md:w-1/2 rounded-lg text-black mb-4"
        />
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={saveCoordinates}
            className="px-4 py-2 bg-purple-700 text-white rounded hover:bg-purple-600"
          >
            Save/train
          </button>
          <button
            onClick={downloadJson}
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600"
          >
            Download JSON
          </button>
          <button
            onClick={() => {
              const ctx = canvasRef.current.getContext('2d');
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              setCurrentPath([]);
            }}
            className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
          >
            Clear
          </button>
        </div>
        {trainingStatus && (
          <p className="mt-4 text-sm md:text-base">{trainingStatus}</p>
        )}
      </div>
    </div>
  );
};

const TestingCanvas = ({ onTest, prediction, confidence_score, similarityScore, onClear, setTestingCoordinates }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const getTouchPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    };

    const startDrawing = (e) => {
      setIsDrawing(true);
      const pos = e.type === 'mousedown' ? { x: e.offsetX, y: e.offsetY } : getTouchPos(e);
      const path = [{ x: pos.x, y: pos.y, timestamp: Date.now(), duration: 0 }];
      setCurrentPath(path);
      setStartTime(Date.now());
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const pos = e.type === 'mousemove' ? { x: e.offsetX, y: e.offsetY } : getTouchPos(e);
      const currentTimestamp = Date.now();
      const duration = (currentTimestamp - startTime) / 1000; // Duration in seconds
      const newPath = [
        ...currentPath,
        {
          x: pos.x,
          y: pos.y,
          timestamp: currentTimestamp,
          duration: duration.toFixed(3), // Save duration with precision
        },
      ];
      setCurrentPath(newPath);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 5;
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      ctx.closePath();
      setTestingCoordinates(currentPath); // Update testing coordinates
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [currentPath, isDrawing]);

  const handleTestModel = () => {
    console.log('Test coordinates:', currentPath);
    onTest(currentPath);
  };

  const handleClear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCurrentPath([]);
    onClear(); // Call the onClear function to reset prediction and similarityScore
  };

  return (
    <div className="text-center bg-gray-800 border text-white p-4 rounded-lg shadow-lg max-w-screen-md mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold mb-4 text-center">
        Testing Canvas
      </h2>
      <div className="relative mx-auto" style={{ maxWidth: "500px" }}>
        <canvas
          ref={canvasRef}
          className="w-full h-auto bg-white rounded-xl border border-white"
          width={500}
          height={350}
        ></canvas>
      </div>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mt-4">
        <button
          onClick={handleTestModel}
          className="w-full sm:w-auto px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
        >
          Test Model
        </button>
        <button
          onClick={handleClear}
          className="w-full sm:w-auto px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
        >
          Clear
        </button>
      </div>
      {prediction && (
        <div className="mt-4 text-center">
          <h3 className="text-md md:text-lg font-bold">Prediction: {prediction}</h3>
          <h3 className="text-md md:text-lg font-bold">Confidence Score: {(confidence_score * 100).toFixed(2)}%</h3>
        </div>
      )}
    </div>
  );
};

const App2 = () => {
  const [data, setData] = useState([]);
  const [prediction, setPrediction] = useState('');
  const [confidence_score, setConfidenceScore] = useState(0);
  const [similarityScore, setSimilarityScore] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [metadata, setMetadata] = useState({});
  const [trainingCoordinates, setTrainingCoordinates] = useState([]);
  const [testingCoordinates, setTestingCoordinates] = useState([]);

  useEffect(() => {
    // Fetch initial data
    axios.get('http://localhost:8080/api/saved_data')
      .then(response => {
        setData(response.data.savedData);
      })
      .catch(error => {
        console.error('There was an error fetching the data!', error);
      });

    // Fetch metadata
    axios.get('http://localhost:8080/api/metadata')
      .then(response => {
        setMetadata(response.data.metadata);
      })
      .catch(error => {
        console.error('There was an error fetching the metadata!', error);
      });
  }, []);

  const updateMetadata = (newLabel) => {
    setMetadata(prevMetadata => ({
      ...prevMetadata,
      [newLabel]: (prevMetadata[newLabel] || 0) + 1
    }));
  };

  const handleSaveCoordinates = (drawings) => {
    const { label, path } = drawings[0]; // Assuming only one drawing is saved at a time
    setTrainingStatus('Saving coordinates...');
    axios.post('http://localhost:8080/api/save_coordinates', { label, coordinates: path })
      .then(response => {
        console.log('Coordinates saved successfully', response);
        setTrainingStatus('Coordinates saved successfully');
        updateMetadata(label); // Update metadata
        setTimeout(() => {
          setTrainingStatus('Training model...');
          axios.post('http://localhost:8080/api/train')
            .then(response => {
              console.log('Model trained successfully', response.data);
              setTrainingStatus('Model trained successfully');
              setTimeout(() => {
                setTrainingStatus('');
              }, 2000); // Reset the message after 2 seconds
            })
            .catch(error => {
              console.error('There was an error training the model!', error);
              setTrainingStatus('Error training the model');
              setTimeout(() => {
                setTrainingStatus('');
              }, 2000); // Reset the message after 2 seconds
            });
        }, 2000); // Wait for 2 seconds before starting training
      })
      .catch(error => {
        console.error('There was an error saving coordinates!', error);
        setTrainingStatus('Error saving coordinates');
        setTimeout(() => {
          setTrainingStatus('');
        }, 2000); // Reset the message after 2 seconds
      });
  };

  const handleTestModel = (path) => {
    console.log('Test coordinates:', path);
    axios.post('http://localhost:8080/api/predict', { coordinates: path })
      .then(response => {
        console.log('Model test result', response.data);
        setPrediction(response.data.predicted_label);
        setConfidenceScore(response.data.confidence_score);
      })
      .catch(error => {
        console.error('There was an error testing the model!', error);
      });
  };

  const handleClear = () => {
    setPrediction('');
    setConfidenceScore(0);
    setSimilarityScore(0);
  };

  const getLabelVariations = () => {
    const labelVariations = {};
    data.forEach(item => {
      if (labelVariations[item.label]) {
        labelVariations[item.label]++;
      } else {
        labelVariations[item.label] = 1;
      }
    });
    return labelVariations;
  };

  const labelVariations = getLabelVariations();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold underline mb-4 text-center">Urdu Word Prediction and confidence Score by (21-CS-445)</h1>
      {/* <h2 className="text-2xl mb-4 text-center">Supervised By <span>Dr. Abdul Jaleel</span></h2> */}
      
      <div className="flex flex-col lg:flex-row justify-between w-full space-y-4 lg:space-y-0 lg:space-x-4">
        <UrduAlphabetCanvas onSave={handleSaveCoordinates} trainingStatus={trainingStatus} setTrainingCoordinates={setTrainingCoordinates} />
        <TestingCanvas onTest={handleTestModel} prediction={prediction} confidence_score={confidence_score} similarityScore={similarityScore} onClear={handleClear} setTestingCoordinates={setTestingCoordinates} />
      </div>
      <div className="mt-8 w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Metadata</h2>
        <div className="overflow-y-auto border border-white rounded-lg p-1 max-h-64">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metadata).map(([label, count]) => (
              <div key={label} className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-bold">{label}</h3>
                <p>{count} variations</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8 w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Coordinates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white  p-4 rounded-lg shadow-md overflow-y-auto max-h-64">
            <h3 className="text-lg font-bold">Training Coordinates</h3>
            <pre className="text-sm">{JSON.stringify(trainingCoordinates, null, 2)}</pre>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md overflow-y-auto max-h-64">
            <h3 className="text-lg font-bold">Testing Coordinates</h3>
            <pre className="text-sm">{JSON.stringify(testingCoordinates, null, 2)}</pre>
          </div>
        </div>
      </div>
     
    </div>
  );  
};

export default App2;