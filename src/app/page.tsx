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
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [arMode, setArMode] = useState(false);
  const [carPosition, setCarPosition] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  // Start camera
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
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
      throw new Error('Failed to load AI model.');
    }
  };

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('Starting camera...');
        await startCamera('environment');
        
        const loadedModel = await loadModel();
        setModel(loadedModel);
        
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Detection loop
  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    if (!isScanning && !arMode) return;

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
          const [x, y, width, height] = car.bbox;
          
          // Scale to screen size
          const scaleX = canvas.clientWidth / canvas.width;
          const scaleY = canvas.clientHeight / canvas.height;
          
          setDetectedCar({
            bbox: car.bbox,
            class: car.class,
            score: car.score
          });

          setCarPosition({
            x: x * scaleX,
            y: y * scaleY,
            width: width * scaleX,
            height: height * scaleY
          });

          if (!arMode) {
            // Draw detection box when scanning
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Label
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(
              `${car.class.toUpperCase()} ${Math.round(car.score * 100)}%`,
              x + 5,
              y - 10
            );
          }
        } else {
          if (!arMode) {
            setDetectedCar(null);
            setCarPosition(null);
          }
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
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isScanning, arMode, model]);

  // Handle scan button
  const handleScan = () => {
    if (!isScanning) {
      setIsScanning(true);
      setArMode(false);
      setDetectedCar(null);
    } else if (detectedCar) {
      // Capture and enable AR mode
      setIsScanning(false);
      setArMode(true);
    } else {
      setIsScanning(false);
    }
  };

  // Exit AR mode
  const exitAR = () => {
    setArMode(false);
    setDetectedCar(null);
    setCarPosition(null);
  };

  // Error screen
  if (error) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        padding: 20,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>📷</div>
        <h2>Camera Access Needed</h2>
        <p style={{ opacity: 0.7, marginTop: 10 }}>{error}</p>
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
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
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
        <h2 style={{ marginTop: 30 }}>🚗 AR Car Scanner</h2>
        <p style={{ marginTop: 10, opacity: 0.7 }}>{loadingText}</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

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
      {/* Camera Feed */}
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

      {/* Detection Canvas */}
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

      {/* AR 3D Car Overlay - Shows on detected car position */}
      {arMode && carPosition && (
        <div
          style={{
            position: 'absolute',
            left: carPosition.x,
            top: carPosition.y,
            width: carPosition.width,
            height: carPosition.height,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '1000px'
          }}
        >
          <Car3D 
            width={carPosition.width} 
            height={carPosition.height}
            carType={detectedCar?.class || 'car'}
          />
        </div>
      )}

      {/* Scanning Line */}
      {isScanning && (
        <>
          <div style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: 3,
            background: 'linear-gradient(90deg, transparent, #00ff00, transparent)',
            boxShadow: '0 0 20px #00ff00',
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
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: 22,
          cursor: 'pointer',
          zIndex: 100
        }}
      >
        🔄
      </button>

      {/* Camera Indicator */}
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
        {cameraFacing === 'environment' ? '📷 Back' : '🤳 Front'}
      </div>

      {/* AR Mode Indicator */}
      {arMode && (
        <div style={{
          position: 'absolute',
          top: 25,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #00b894, #00cec9)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 25,
          fontSize: 14,
          fontWeight: 'bold',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ animation: 'pulse 1s infinite' }}>●</span> AR MODE
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      )}

      {/* Status Bar */}
      {!arMode && (
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
          maxWidth: '90%',
          backdropFilter: 'blur(10px)',
          zIndex: 100
        }}>
          {isScanning
            ? detectedCar
              ? `🎯 ${detectedCar.class.toUpperCase()} detected! Tap to activate AR`
              : '🔍 Looking for vehicles...'
            : '📱 Point at a car and tap Scan'
          }
        </div>
      )}

      {/* Main Button */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        gap: 15
      }}>
        {arMode ? (
          <button
            onClick={exitAR}
            style={{
              padding: '18px 40px',
              fontSize: 16,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 50,
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            ✕ Exit AR
          </button>
        ) : (
          <button
            onClick={handleScan}
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
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {isScanning
              ? detectedCar
                ? '✨ Activate AR'
                : '⏹️ Stop'
              : '🔍 Scan'
            }
          </button>
        )}
      </div>

      {/* AR Instructions */}
      {arMode && (
        <div style={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 15,
          fontSize: 13,
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 100
        }}>
          🚗 3D car overlaid on real car • Move phone to see AR effect
        </div>
      )}
    </div>
  );
}

// 3D Car Component that overlays on real car
function Car3D({ width, height, carType }: { width: number; height: number; carType: string }) {
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getColor = () => {
    switch(carType) {
      case 'truck': return { main: '#3498db', dark: '#2980b9' };
      case 'bus': return { main: '#f39c12', dark: '#d68910' };
      case 'motorcycle': return { main: '#9b59b6', dark: '#8e44ad' };
      default: return { main: '#e74c3c', dark: '#c0392b' };
    }
  };

  const colors = getColor();
  const carWidth = Math.min(width * 0.9, 300);
  const carHeight = carWidth * 0.5;

  return (
    <div
      style={{
        width: carWidth,
        height: carHeight,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateY(${rotation}deg) rotateX(-5deg)`,
        filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.5))'
      }}
    >
      {/* Glowing outline effect */}
      <div style={{
        position: 'absolute',
        top: -5,
        left: -5,
        right: -5,
        bottom: -5,
        border: `3px solid ${colors.main}`,
        borderRadius: 20,
        boxShadow: `0 0 20px ${colors.main}, 0 0 40px ${colors.main}55, inset 0 0 20px ${colors.main}33`,
        animation: 'glow 2s ease-in-out infinite'
      }} />
      
      <style>{`
        @keyframes glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 20px ${colors.main}, 0 0 40px ${colors.main}55; }
          50% { opacity: 0.8; box-shadow: 0 0 30px ${colors.main}, 0 0 60px ${colors.main}77; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>

      {/* Car Body */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '50%',
        bottom: '20%',
        background: `linear-gradient(180deg, ${colors.main}ee, ${colors.dark}ee)`,
        borderRadius: 12,
        backdropFilter: 'blur(5px)',
        border: `2px solid ${colors.main}`,
        boxShadow: `inset 0 5px 15px rgba(255,255,255,0.3), inset 0 -5px 15px rgba(0,0,0,0.3)`
      }} />
      
      {/* Car Roof */}
      <div style={{
        position: 'absolute',
        width: '50%',
        height: '35%',
        bottom: '45%',
        left: '20%',
        background: `linear-gradient(180deg, ${colors.main}ee, ${colors.dark}ee)`,
        borderRadius: '10px 10px 5px 5px',
        border: `2px solid ${colors.main}`,
        boxShadow: `inset 0 5px 10px rgba(255,255,255,0.2)`
      }} />
      
      {/* Windshield */}
      <div style={{
        position: 'absolute',
        width: '40%',
        height: '25%',
        bottom: '50%',
        left: '25%',
        background: 'linear-gradient(135deg, rgba(116,185,255,0.7), rgba(9,132,227,0.7))',
        borderRadius: '8px 8px 3px 3px',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.2)'
      }} />

      {/* Headlights */}
      <div style={{
        position: 'absolute',
        width: '8%',
        height: '12%',
        bottom: '35%',
        left: '5%',
        background: 'radial-gradient(circle, #fffacd, #ffd700)',
        borderRadius: 4,
        boxShadow: '0 0 15px #ffd700, 0 0 30px #ffd70066'
      }} />
      <div style={{
        position: 'absolute',
        width: '8%',
        height: '12%',
        bottom: '35%',
        right: '5%',
        background: 'radial-gradient(circle, #fffacd, #ffd700)',
        borderRadius: 4,
        boxShadow: '0 0 15px #ffd700, 0 0 30px #ffd70066'
      }} />

      {/* Tail lights */}
      <div style={{
        position: 'absolute',
        width: '6%',
        height: '10%',
        bottom: '30%',
        left: '2%',
        background: 'radial-gradient(circle, #ff6b6b, #ee5a24)',
        borderRadius: 3,
        boxShadow: '0 0 10px #ff0000'
      }} />
      <div style={{
        position: 'absolute',
        width: '6%',
        height: '10%',
        bottom: '30%',
        right: '2%',
        background: 'radial-gradient(circle, #ff6b6b, #ee5a24)',
        borderRadius: 3,
        boxShadow: '0 0 10px #ff0000'
      }} />

      {/* Wheels */}
      <div style={{
        position: 'absolute',
        width: '18%',
        height: '36%',
        bottom: '5%',
        left: '12%',
        background: 'radial-gradient(circle, #555, #222)',
        borderRadius: '50%',
        border: '3px solid #333',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5)'
      }}>
        {/* Wheel rim */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, #ccc, #888)',
          borderRadius: '50%'
        }} />
      </div>
      <div style={{
        position: 'absolute',
        width: '18%',
        height: '36%',
        bottom: '5%',
        right: '12%',
        background: 'radial-gradient(circle, #555, #222)',
        borderRadius: '50%',
        border: '3px solid #333',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8), 0 5px 15px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, #ccc, #888)',
          borderRadius: '50%'
        }} />
      </div>

      {/* Holographic effect lines */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          ${colors.main}22 3px,
          ${colors.main}22 6px
        )`,
        borderRadius: 15,
        pointerEvents: 'none',
        opacity: 0.5
      }} />

      {/* AR Label */}
      <div style={{
        position: 'absolute',
        top: -35,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        padding: '5px 15px',
        borderRadius: 15,
        fontSize: 12,
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        boxShadow: '0 3px 10px rgba(0,0,0,0.3)'
      }}>
        🚗 {carType.toUpperCase()} • AR
      </div>
    </div>
  );
}