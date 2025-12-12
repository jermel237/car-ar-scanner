'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [model, setModel] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedCar, setDetectedCar] = useState<Detection | null>(null);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Start camera function
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
      }

      setStream(newStream);
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      throw new Error('Cannot access camera. Please allow camera permission.');
    }
  }, [stream]);

  // Switch camera
  const switchCamera = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    try {
      await startCamera(newFacing);
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  };

  // Load AI model
  const loadModel = async () => {
    try {
      setLoadingText('Loading AI...');
      
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      await tf.setBackend('webgl');
      
      setLoadingText('Loading car detector...');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      
      return loadedModel;
    } catch (err) {
      console.error('Model error:', err);
      throw new Error('Failed to load AI model. Please refresh.');
    }
  };

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('Starting camera...');
        await startCamera('environment');
        
        const loadedModel = await loadModel();
        setModel(loadedModel);
        
        setIsLoading(false);
      } catch (err: any) {
        console.error('Init error:', err);
        setError(err.message || 'Failed to start. Please allow camera access.');
        setIsLoading(false);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!isScanning || !model || !videoRef.current || !canvasRef.current) return;

    let animationId: number;
    let running = true;

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const predictions = await model.detect(video);
        
        // Filter for vehicles
        const vehicles = predictions.filter(
          (p: any) => ['car', 'truck', 'bus', 'motorcycle'].includes(p.class) && p.score > 0.5
        );

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (vehicles.length > 0) {
          const car = vehicles[0];
          setDetectedCar({
            bbox: car.bbox,
            class: car.class,
            score: car.score
          });

          // Draw detection box
          const [x, y, width, height] = car.bbox;

          // Green rectangle
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, width, height);

          // Corner accents
          const cornerSize = 20;
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#00ff00';

          // Top-left corner
          ctx.beginPath();
          ctx.moveTo(x, y + cornerSize);
          ctx.lineTo(x, y);
          ctx.lineTo(x + cornerSize, y);
          ctx.stroke();

          // Top-right corner
          ctx.beginPath();
          ctx.moveTo(x + width - cornerSize, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width, y + cornerSize);
          ctx.stroke();

          // Bottom-left corner
          ctx.beginPath();
          ctx.moveTo(x, y + height - cornerSize);
          ctx.lineTo(x, y + height);
          ctx.lineTo(x + cornerSize, y + height);
          ctx.stroke();

          // Bottom-right corner
          ctx.beginPath();
          ctx.moveTo(x + width - cornerSize, y + height);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x + width, y + height - cornerSize);
          ctx.stroke();

          // Label background
          const label = `${car.class.toUpperCase()} ${Math.round(car.score * 100)}%`;
          ctx.font = 'bold 18px Arial';
          const textWidth = ctx.measureText(label).width;
          
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(x, y - 30, textWidth + 16, 28);
          
          // Label text
          ctx.fillStyle = '#000000';
          ctx.fillText(label, x + 8, y - 10);

        } else {
          setDetectedCar(null);
        }
      } catch (e) {
        console.error('Detection error:', e);
      }

      if (running) {
        animationId = requestAnimationFrame(detect);
      }
    };

    detect();

    return () => {
      running = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isScanning, model]);

  // Handle button click
  const handleClick = () => {
    if (!isScanning) {
      setIsScanning(true);
      setDetectedCar(null);
    } else if (detectedCar) {
      setIsScanning(false);
      setShow3DViewer(true);
    } else {
      setIsScanning(false);
    }
  };

  // Close 3D viewer
  const close3DViewer = () => {
    setShow3DViewer(false);
    setDetectedCar(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Error screen
  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>📷</div>
        <h2 style={{ marginBottom: 10 }}>Camera Access Needed</h2>
        <p style={{ opacity: 0.7, maxWidth: 300 }}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: 30,
            padding: '14px 40px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            border: 'none',
            borderRadius: 50,
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Loading screen
  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          width: 60,
          height: 60,
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ marginTop: 30 }}>🚗 Car Scanner</h2>
        <p style={{ marginTop: 10, opacity: 0.7 }}>{loadingText}</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Main app
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Camera Video */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />

      {/* Detection Canvas Overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none'
        }}
      />

      {/* Scanning Animation */}
      {isScanning && (
        <>
          <div style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: 3,
            background: 'linear-gradient(90deg, transparent, #00ff00, #00ff00, transparent)',
            boxShadow: '0 0 20px #00ff00, 0 0 40px #00ff00',
            animation: 'scanMove 2s ease-in-out infinite'
          }} />
          <style>{`
            @keyframes scanMove {
              0%, 100% { top: 15%; }
              50% { top: 85%; }
            }
          `}</style>
        </>
      )}

      {/* Camera Switch Button */}
      <button
        onClick={switchCamera}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}
      >
        🔄
      </button>

      {/* Camera Mode Indicator */}
      <div style={{
        position: 'absolute',
        top: 25,
        left: 20,
        background: 'rgba(0,0,0,0.5)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: 20,
        fontSize: 12,
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        {cameraFacing === 'environment' ? '📷 Back Camera' : '🤳 Front Camera'}
      </div>

      {/* Status Bar */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: 25,
        fontSize: 14,
        textAlign: 'center',
        maxWidth: '85%',
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        {isScanning
          ? detectedCar
            ? `🎯 ${detectedCar.class.toUpperCase()} found! (${Math.round(detectedCar.score * 100)}%)`
            : '🔍 Looking for vehicles...'
          : '📱 Point at a car and tap Scan'
        }
      </div>

      {/* Detection Hint */}
      {isScanning && detectedCar && (
        <div style={{
          position: 'absolute',
          bottom: 140,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 255, 0, 0.2)',
          border: '2px solid #00ff00',
          padding: '10px 20px',
          borderRadius: 10,
          color: '#00ff00',
          fontWeight: 'bold',
          fontSize: 14,
          zIndex: 100
        }}>
          ✨ Tap "Capture 3D" to create model
        </div>
      )}

      {/* Main Button */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100
      }}>
        <button
          onClick={handleClick}
          style={{
            padding: '18px 50px',
            fontSize: 18,
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 50,
            background: isScanning && detectedCar 
              ? 'linear-gradient(135deg, #00b894, #00cec9)' 
              : 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 25px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          {isScanning
            ? detectedCar
              ? '✨ Capture 3D'
              : '⏹️ Stop Scan'
            : '🔍 Start Scan'
          }
        </button>
      </div>

      {/* 3D Viewer Modal */}
      {show3DViewer && (
        <Viewer3D
          carType={detectedCar?.class || 'car'}
          confidence={detectedCar?.score || 0}
          onClose={close3DViewer}
        />
      )}
    </div>
  );
}

// 3D Viewer Component
function Viewer3D({ 
  carType, 
  confidence,
  onClose 
}: { 
  carType: string;
  confidence: number;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);

  // Auto rotate
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 2) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Get color based on vehicle type
  const getColor = () => {
    switch(carType.toLowerCase()) {
      case 'truck': return '#3498db';
      case 'bus': return '#f39c12';
      case 'motorcycle': return '#9b59b6';
      default: return '#e74c3c';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'white'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>
            🚗 {carType.toUpperCase()}
          </h2>
          <p style={{ margin: '5px 0 0', opacity: 0.6, fontSize: 14 }}>
            Confidence: {Math.round(confidence * 100)}%
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            fontSize: 24,
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>

      {/* 3D Car Display */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1000px'
      }}>
        <div style={{
          width: 280,
          height: 160,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotation}deg) rotateX(-10deg)`
        }}>
          {/* Car Body */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '55%',
            bottom: '25%',
            background: `linear-gradient(135deg, ${getColor()}, ${getColor()}dd)`,
            borderRadius: 15,
            boxShadow: `0 30px 60px rgba(0,0,0,0.4), 0 0 30px ${getColor()}44`
          }} />
          
          {/* Car Top/Cabin */}
          <div style={{
            position: 'absolute',
            width: '55%',
            height: '38%',
            bottom: '50%',
            left: '18%',
            background: `linear-gradient(135deg, ${getColor()}, ${getColor()}dd)`,
            borderRadius: '12px 12px 5px 5px'
          }} />
          
          {/* Front Window */}
          <div style={{
            position: 'absolute',
            width: '45%',
            height: '28%',
            bottom: '55%',
            left: '22%',
            background: 'linear-gradient(135deg, #74b9ff, #0984e3)',
            borderRadius: '8px 8px 3px 3px',
            opacity: 0.85
          }} />

          {/* Headlights */}
          <div style={{
            position: 'absolute',
            width: 15,
            height: 10,
            background: '#fff8dc',
            borderRadius: 3,
            bottom: '40%',
            left: '5%',
            boxShadow: '0 0 10px #fff8dc'
          }} />
          <div style={{
            position: 'absolute',
            width: 15,
            height: 10,
            background: '#fff8dc',
            borderRadius: 3,
            bottom: '40%',
            right: '5%',
            boxShadow: '0 0 10px #fff8dc'
          }} />
          
          {/* Wheels */}
          <div style={{
            position: 'absolute',
            width: 45,
            height: 45,
            background: 'linear-gradient(135deg, #2c3e50, #34495e)',
            borderRadius: '50%',
            bottom: '8%',
            left: '12%',
            border: '4px solid #1a1a2e',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
          }} />
          <div style={{
            position: 'absolute',
            width: 45,
            height: 45,
            background: 'linear-gradient(135deg, #2c3e50, #34495e)',
            borderRadius: '50%',
            bottom: '8%',
            right: '12%',
            border: '4px solid #1a1a2e',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
          }} />

          {/* Wheel centers */}
          <div style={{
            position: 'absolute',
            width: 15,
            height: 15,
            background: '#95a5a6',
            borderRadius: '50%',
            bottom: '18%',
            left: '22%'
          }} />
          <div style={{
            position: 'absolute',
            width: 15,
            height: 15,
            background: '#95a5a6',
            borderRadius: '50%',
            bottom: '18%',
            right: '22%'
          }} />
        </div>
      </div>

      {/* Floor Shadow */}
      <div style={{
        position: 'absolute',
        bottom: '30%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 200,
        height: 20,
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />

      {/* Footer */}
      <div style={{
        padding: 30,
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          gap: 15,
          justifyContent: 'center',
          marginBottom: 20
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '14px 30px',
              fontSize: 16,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 50,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            🔍 Scan Another
          </button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          ✨ Vehicle detected and converted to 3D model
        </p>
      </div>
    </div>
  );
}