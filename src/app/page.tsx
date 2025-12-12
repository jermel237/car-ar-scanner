'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [model, setModel] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedCar, setDetectedCar] = useState<any>(null);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      throw new Error('Cannot access camera. Please allow camera permission.');
    }
  };

  // Load AI model
  const loadModel = async () => {
    try {
      setLoadingText('Loading AI...');
      
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      
      setLoadingText('Loading detector...');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      
      return loadedModel;
    } catch (err) {
      console.error('Model error:', err);
      throw new Error('Failed to load AI model.');
    }
  };

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('Starting camera...');
        await startCamera();
        
        const loadedModel = await loadModel();
        setModel(loadedModel);
        
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    init();
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const predictions = await model.detect(video);
        
        const vehicles = predictions.filter(
          (p: any) => ['car', 'truck', 'bus', 'motorcycle'].includes(p.class) && p.score > 0.5
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (vehicles.length > 0) {
          const car = vehicles[0];
          setDetectedCar(car);

          const [x, y, width, height] = car.bbox;

          // Draw green box
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, width, height);

          // Draw label
          ctx.fillStyle = '#00ff00';
          ctx.font = 'bold 20px Arial';
          ctx.fillText(
            `${car.class.toUpperCase()} ${Math.round(car.score * 100)}%`,
            x + 5,
            y - 10
          );
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
      cancelAnimationFrame(animationId);
    };
  }, [isScanning, model]);

  // Handle button click
  const handleClick = () => {
    if (!isScanning) {
      setIsScanning(true);
    } else if (detectedCar) {
      setIsScanning(false);
      setShow3DViewer(true);
    } else {
      setIsScanning(false);
    }
  };

  // Error screen
  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 50, marginBottom: 20 }}>⚠️</div>
        <h2>Error</h2>
        <p style={{ marginTop: 10, opacity: 0.7 }}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20,
            padding: '12px 30px',
            background: '#667eea',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          Retry
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
        background: '#1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          width: 50,
          height: 50,
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: 20 }}>{loadingText}</p>
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
      position: 'relative',
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Camera */}
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

      {/* Detection overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />

      {/* Scan line */}
      {isScanning && (
        <div style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          height: 4,
          background: 'linear-gradient(90deg, transparent, #00ff00, transparent)',
          animation: 'scanMove 2s ease-in-out infinite',
          boxShadow: '0 0 20px #00ff00'
        }} />
      )}

      <style>{`
        @keyframes scanMove {
          0%, 100% { top: 20%; }
          50% { top: 80%; }
        }
      `}</style>

      {/* Status */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: 25,
        fontSize: 14,
        textAlign: 'center',
        maxWidth: '90%'
      }}>
        {isScanning
          ? detectedCar
            ? `🎯 ${detectedCar.class.toUpperCase()} found!`
            : '🔍 Looking for cars...'
          : '📱 Point at a car and tap Scan'
        }
      </div>

      {/* Button */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <button
          onClick={handleClick}
          style={{
            padding: '18px 50px',
            fontSize: 18,
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 50,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(102,126,234,0.5)'
          }}
        >
          {isScanning
            ? detectedCar
              ? '✨ Capture 3D'
              : '⏹️ Stop'
            : '🔍 Scan'
          }
        </button>
      </div>

      {/* 3D Viewer */}
      {show3DViewer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          zIndex: 100,
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
            <h2>🚗 {detectedCar?.class?.toUpperCase() || 'CAR'}</h2>
            <button
              onClick={() => {
                setShow3DViewer(false);
                setDetectedCar(null);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: 20,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* 3D Car */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 250,
              height: 150,
              position: 'relative',
              animation: 'rotate3d 3s linear infinite',
              transformStyle: 'preserve-3d'
            }}>
              {/* Car body */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '60%',
                bottom: '25%',
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                borderRadius: 15,
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }} />
              {/* Car top */}
              <div style={{
                position: 'absolute',
                width: '55%',
                height: '35%',
                bottom: '55%',
                left: '18%',
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                borderRadius: '12px 12px 5px 5px'
              }} />
              {/* Window */}
              <div style={{
                position: 'absolute',
                width: '45%',
                height: '25%',
                bottom: '60%',
                left: '22%',
                background: 'linear-gradient(135deg, #74b9ff, #0984e3)',
                borderRadius: '8px 8px 3px 3px',
                opacity: 0.8
              }} />
              {/* Wheels */}
              <div style={{
                position: 'absolute',
                width: 40,
                height: 40,
                background: '#2c3e50',
                borderRadius: '50%',
                bottom: '10%',
                left: '15%',
                border: '4px solid #34495e'
              }} />
              <div style={{
                position: 'absolute',
                width: 40,
                height: 40,
                background: '#2c3e50',
                borderRadius: '50%',
                bottom: '10%',
                right: '15%',
                border: '4px solid #34495e'
              }} />
            </div>
          </div>

          <style>{`
            @keyframes rotate3d {
              from { transform: rotateY(0deg); }
              to { transform: rotateY(360deg); }
            }
          `}</style>

          {/* Footer */}
          <div style={{
            padding: 30,
            textAlign: 'center',
            color: 'white'
          }}>
            <p style={{ opacity: 0.6, fontSize: 14 }}>
              ✨ Car detected and converted to 3D!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}