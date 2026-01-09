'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface CarPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlacedCar {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floorCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [model, setModel] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedCar, setDetectedCar] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [arMode, setArMode] = useState(false);
  const [carPosition, setCarPosition] = useState<CarPosition | null>(null);
  
  // Placement mode
  const [placementMode, setPlacementMode] = useState(false);
  const [placedCars, setPlacedCars] = useState<PlacedCar[]>([]);
  const [showFloorGrid, setShowFloorGrid] = useState(false);
  const [floorLevel, setFloorLevel] = useState(0.7);

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

  const switchCamera = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    try {
      await startCamera(newFacing);
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  };

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

  // Floor detection visualization
  useEffect(() => {
    if (!floorCanvasRef.current || !showFloorGrid) return;

    const canvas = floorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const drawFloor = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const floorY = canvas.height * floorLevel;
      
      // Floor gradient
      const gradient = ctx.createLinearGradient(0, floorY, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0, 255, 150, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 255, 150, 0.3)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 255, 150, 0.4)';
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let i = 0; i < 10; i++) {
        const y = floorY + (i * (canvas.height - floorY) / 10);
        const perspective = 1 - (i / 15);
        ctx.beginPath();
        ctx.moveTo(canvas.width * (0.5 - perspective * 0.5), y);
        ctx.lineTo(canvas.width * (0.5 + perspective * 0.5), y);
        ctx.stroke();
      }

      // Vertical lines
      for (let i = -5; i <= 5; i++) {
        const startX = canvas.width / 2;
        const endX = canvas.width / 2 + (i * canvas.width / 8);
        ctx.beginPath();
        ctx.moveTo(startX, floorY);
        ctx.lineTo(endX, canvas.height);
        ctx.stroke();
      }

      // Floor line
      ctx.strokeStyle = 'rgba(0, 255, 150, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(canvas.width, floorY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(0, 255, 150, 0.9)';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('📍 FLOOR DETECTED - Tap to place car', 20, floorY - 10);
    };

    drawFloor();

    const interval = setInterval(drawFloor, 100);
    return () => clearInterval(interval);
  }, [showFloorGrid, floorLevel]);

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
          (p: any) => ['car', 'truck', 'bus', 'motorcycle'].includes(p.class) && p.score > 0.35
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (vehicles.length > 0) {
          const car = vehicles[0];
          const [x, y, width, height] = car.bbox;
          
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;
          
          const newPosition: CarPosition = {
            x: x * scaleX,
            y: y * scaleY,
            width: width * scaleX,
            height: height * scaleY
          };

          setDetectedCar({
            bbox: car.bbox,
            class: car.class,
            score: car.score
          });

          setCarPosition(newPosition);

          // Estimate floor level
          const carBottom = (y + height) / canvas.height;
          setFloorLevel(Math.min(0.9, Math.max(0.5, carBottom)));

          if (isScanning && !arMode) {
            // Draw detection box
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            const cornerLength = 30;
            ctx.lineWidth = 6;

            // Corners
            ctx.beginPath();
            ctx.moveTo(x, y + cornerLength);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLength, y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + width - cornerLength, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + cornerLength);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, y + height - cornerLength);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + cornerLength, y + height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x + width - cornerLength, y + height);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x + width, y + height - cornerLength);
            ctx.stroke();

            // Label
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(
              `${car.class.toUpperCase()} ${Math.round(car.score * 100)}%`,
              x + 5,
              y - 15
            );
          }
        } else {
          if (isScanning && !arMode) {
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

  // SCAN BUTTON HANDLER
  const handleScan = () => {
    if (!isScanning) {
      // Start scanning
      setIsScanning(true);
      setArMode(false);
      setPlacementMode(false);
      setShowFloorGrid(false);
      setDetectedCar(null);
      setCarPosition(null);
    } else if (detectedCar) {
      // Car detected - start AR
      setIsScanning(false);
      setArMode(true);
      setShowFloorGrid(true);
    } else {
      // Stop scanning
      setIsScanning(false);
    }
  };

  const exitAR = () => {
    setArMode(false);
    setPlacementMode(false);
    setShowFloorGrid(false);
    setDetectedCar(null);
    setCarPosition(null);
  };

  const togglePlacementMode = () => {
    setPlacementMode(!placementMode);
    setShowFloorGrid(true);
  };

  // Handle tap to place car
  const handleScreenTap = (e: React.TouchEvent | React.MouseEvent) => {
    if (!placementMode) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Only place if tapping on floor area (below floor line)
    if (clientY > window.innerHeight * floorLevel * 0.8) {
      const newCar: PlacedCar = {
        id: Date.now(),
        x: clientX,
        y: clientY,
        rotation: 0,
        scale: 1,
        color: [0xe74c3c, 0x3498db, 0xf39c12, 0x9b59b6, 0x00b894, 0x6c5ce7][Math.floor(Math.random() * 6)]
      };

      setPlacedCars(prev => [...prev, newCar]);
    }
  };

  const clearPlacedCars = () => {
    setPlacedCars([]);
  };

  const removeCar = (id: number) => {
    setPlacedCars(prev => prev.filter(c => c.id !== id));
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
            padding: '22px 50px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            border: 'none',
            borderRadius: 50,
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            touchAction: 'manipulation'
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
          width: 70,
          height: 70,
          border: '5px solid rgba(255,255,255,0.2)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ marginTop: 30, fontSize: 24 }}>🚗 AR Car Scanner</h2>
        <p style={{ marginTop: 10, opacity: 0.7, fontSize: 16 }}>{loadingText}</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        touchAction: 'none'
      }}
      onClick={handleScreenTap}
      onTouchEnd={handleScreenTap}
    >
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
          pointerEvents: 'none',
          display: arMode ? 'none' : 'block'
        }}
      />

      {/* Floor Grid Canvas */}
      <canvas
        ref={floorCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: showFloorGrid ? 'block' : 'none'
        }}
      />

      {/* Main 3D Car - Tracks Real Car */}
      {arMode && carPosition && !placementMode && (
        <ThreeDCar 
          position={carPosition}
          carType={detectedCar?.class || 'car'}
        />
      )}

      {/* Placed Cars */}
      {placedCars.map(car => (
        <PlacedCarModel
          key={car.id}
          car={car}
          onRemove={() => removeCar(car.id)}
        />
      ))}

      {/* Scanning Line Animation */}
      {isScanning && !arMode && (
        <>
          <div style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: 4,
            background: 'linear-gradient(90deg, transparent, #00ff00, transparent)',
            boxShadow: '0 0 30px #00ff00',
            animation: 'scanMove 2s ease-in-out infinite'
          }} />
          <style>{`
            @keyframes scanMove {
              0%, 100% { top: 10%; }
              50% { top: 90%; }
            }
          `}</style>
        </>
      )}

      {/* ===== TOP UI ===== */}
      
      {/* Camera Switch Button */}
      <button
        onClick={(e) => { e.stopPropagation(); switchCamera(); }}
        style={{
          position: 'absolute',
          top: 15,
          right: 15,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: 26,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation'
        }}
      >
        🔄
      </button>

      {/* Camera Indicator */}
      <div style={{
        position: 'absolute',
        top: 22,
        left: 15,
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '10px 18px',
        borderRadius: 22,
        fontSize: 14,
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        {cameraFacing === 'environment' ? '📷 Back' : '🤳 Front'}
      </div>

      {/* Mode Indicator */}
      {(arMode || isScanning) && (
        <div style={{
          position: 'absolute',
          top: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          background: arMode 
            ? placementMode 
              ? 'linear-gradient(135deg, #f39c12, #e74c3c)'
              : 'linear-gradient(135deg, #00b894, #00cec9)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 30,
          fontSize: 16,
          fontWeight: 'bold',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <span style={{ 
            width: 10, 
            height: 10, 
            background: 'white', 
            borderRadius: '50%',
            animation: 'pulse 1s infinite' 
          }} />
          {arMode 
            ? placementMode 
              ? '📍 PLACE MODE' 
              : 'AR TRACKING'
            : '🔍 SCANNING'
          }
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}

      {/* Status Message */}
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
        {arMode
          ? placementMode
            ? '👆 Tap on the floor to place a 3D car'
            : '👆 Drag to rotate • Tap "Place Mode" to add cars'
          : isScanning
            ? detectedCar
              ? `🎯 ${detectedCar.class.toUpperCase()} detected! Tap "Start AR"`
              : '🔍 Point camera at a car...'
            : '📱 Point at a car and tap "Scan Car"'
        }
      </div>

      {/* Placed cars count */}
      {placedCars.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 130,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          color: '#00ff00',
          padding: '8px 16px',
          borderRadius: 15,
          fontSize: 13,
          zIndex: 100,
          fontWeight: 'bold'
        }}>
          🚗 {placedCars.length} car{placedCars.length > 1 ? 's' : ''} placed
        </div>
      )}

      {/* ===== BOTTOM BUTTONS ===== */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 15,
        padding: '0 20px',
        zIndex: 100
      }}>
        {arMode ? (
          <>
            {/* AR Mode Buttons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {/* Place Mode Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlacementMode(); }}
                style={{
                  padding: '16px 28px',
                  fontSize: 16,
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: 45,
                  background: placementMode
                    ? 'linear-gradient(135deg, #00b894, #00cec9)'
                    : 'linear-gradient(135deg, #f39c12, #e74c3c)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 5px 20px rgba(0,0,0,0.3)',
                  touchAction: 'manipulation'
                }}
              >
                {placementMode ? '✓ Done' : '📍 Place Mode'}
              </button>

              {/* Clear All Button */}
              {placedCars.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearPlacedCars(); }}
                  style={{
                    padding: '16px 28px',
                    fontSize: 16,
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: 45,
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  🗑️ Clear All
                </button>
              )}
            </div>

            {/* Exit AR Button */}
            <button
              onClick={(e) => { e.stopPropagation(); exitAR(); }}
              style={{
                padding: '20px 50px',
                fontSize: 20,
                fontWeight: 'bold',
                border: 'none',
                borderRadius: 55,
                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 6px 25px rgba(0,0,0,0.4)',
                touchAction: 'manipulation',
                minWidth: 200
              }}
            >
              ✕ Exit AR
            </button>
          </>
        ) : (
          /* ===== MAIN SCAN BUTTON - ALWAYS VISIBLE ===== */
          <button
            onClick={(e) => { e.stopPropagation(); handleScan(); }}
            style={{
              padding: '24px 60px',
              fontSize: 22,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 60,
              background: isScanning 
                ? detectedCar
                  ? 'linear-gradient(135deg, #00b894, #00cec9)'
                  : 'linear-gradient(135deg, #e74c3c, #c0392b)'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 8px 35px rgba(0,0,0,0.4)',
              minWidth: 260,
              touchAction: 'manipulation',
              transform: 'scale(1)',
              transition: 'transform 0.2s'
            }}
          >
            {isScanning
              ? detectedCar
                ? '✨ Start AR'
                : '⏹️ Stop Scan'
              : '🔍 Scan Car'
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ===== 3D CAR COMPONENT - TRACKS REAL CAR =====
function ThreeDCar({ 
  position, 
  carType
}: { 
  position: CarPosition;
  carType: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastTouchXRef = useRef<number>(0);

  const getColor = useCallback(() => {
    switch(carType) {
      case 'truck': return 0x3498db;
      case 'bus': return 0xf39c12;
      case 'motorcycle': return 0x9b59b6;
      default: return 0xe74c3c;
    }
  }, [carType]);

  // 2.5x size centered on detection
  const scale = 2.5;
  const displaySize = {
    width: position.width * scale,
    height: position.height * scale,
    x: position.x - (position.width * (scale - 1)) / 2,
    y: position.y - (position.height * (scale - 1)) / 2
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    lastTouchXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingRef.current || !carRef.current) return;
    
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - lastTouchXRef.current;
    rotationRef.current += deltaX * 0.02;
    carRef.current.rotation.y = rotationRef.current;
    lastTouchXRef.current = touchX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 15, 10);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-8, 8, -8);
    scene.add(fillLight);

    const car = createDetailedCar(getColor());
    scene.add(car);
    carRef.current = car;

    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [getColor]);

  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;
    rendererRef.current.setSize(displaySize.width, displaySize.height);
    cameraRef.current.aspect = displaySize.width / displaySize.height;
    cameraRef.current.updateProjectionMatrix();
  }, [displaySize.width, displaySize.height]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'absolute',
        left: displaySize.x,
        top: displaySize.y,
        width: displaySize.width,
        height: displaySize.height,
        zIndex: 50,
        cursor: 'grab',
        touchAction: 'none'
      }}
    />
  );
}

// ===== PLACED CAR MODEL =====
function PlacedCarModel({ 
  car, 
  onRemove 
}: { 
  car: PlacedCar;
  onRemove: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carModelRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(car.rotation);
  const isDraggingRef = useRef<boolean>(false);
  const lastTouchXRef = useRef<number>(0);

  const size = 180;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    lastTouchXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingRef.current || !carModelRef.current) return;
    
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - lastTouchXRef.current;
    rotationRef.current += deltaX * 0.03;
    carModelRef.current.rotation.y = rotationRef.current;
    lastTouchXRef.current = touchX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    scene.add(mainLight);

    const carModel = createDetailedCar(car.color);
    carModel.rotation.y = rotationRef.current;
    scene.add(carModel);
    carModelRef.current = carModel;

    // Shadow circle
    const shadowGeometry = new THREE.CircleGeometry(3, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);

    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [car.color]);

  return (
    <div
      style={{
        position: 'absolute',
        left: car.x - size / 2,
        top: car.y - size / 2,
        width: size,
        height: size,
        zIndex: 60
      }}
    >
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          touchAction: 'none'
        }}
      />
      
      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '2px solid white',
          background: 'rgba(231, 76, 60, 0.9)',
          color: 'white',
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ===== CREATE DETAILED 3D CAR =====
function createDetailedCar(color: number): THREE.Group {
  const car = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.9,
    roughness: 0.15,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    metalness: 0.98,
    roughness: 0.02,
    transparent: true,
    opacity: 0.6
  });

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.2,
    roughness: 0.9
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    metalness: 0.98,
    roughness: 0.02
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.02
  });

  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffee,
    emissiveIntensity: 2
  });

  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.5
  });

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.6,
    roughness: 0.4
  });

  // Body
  const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1, 2.4), bodyMaterial);
  bodyLower.position.y = 0.6;
  car.add(bodyLower);

  const bodySide = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.5, 2.5), bodyMaterial);
  bodySide.position.y = 1.2;
  car.add(bodySide);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.3), bodyMaterial);
  hood.position.set(2.1, 1.05, 0);
  hood.rotation.z = -0.12;
  car.add(hood);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 2.3), bodyMaterial);
  trunk.position.set(-2.3, 1.05, 0);
  trunk.rotation.z = 0.1;
  car.add(trunk);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.3, 2.2), bodyMaterial);
  cabin.position.set(-0.1, 2.05, 0);
  car.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 2.1), bodyMaterial);
  roof.position.set(-0.1, 2.75, 0);
  car.add(roof);

  // Windows
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.1), glassMaterial);
  windshield.position.set(1.2, 2.1, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.x = 0.3;
  car.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.1), glassMaterial);
  rearWindow.position.set(-1.5, 2.1, 0);
  rearWindow.rotation.y = -Math.PI / 2;
  rearWindow.rotation.x = -0.25;
  car.add(rearWindow);

  const sideWindowGeo = new THREE.PlaneGeometry(2.7, 1);
  const sideWindowL = new THREE.Mesh(sideWindowGeo, glassMaterial);
  sideWindowL.position.set(-0.1, 2.15, 1.11);
  car.add(sideWindowL);

  const sideWindowR = new THREE.Mesh(sideWindowGeo, glassMaterial);
  sideWindowR.position.set(-0.1, 2.15, -1.11);
  sideWindowR.rotation.y = Math.PI;
  car.add(sideWindowR);

  // Wheels
  const wheelPositions = [
    { x: 1.7, z: 1.3 },
    { x: 1.7, z: -1.3 },
    { x: -1.7, z: 1.3 },
    { x: -1.7, z: -1.3 }
  ];

  wheelPositions.forEach(pos => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 32), wheelMaterial);
    tire.position.set(pos.x, 0.5, pos.z);
    tire.rotation.x = Math.PI / 2;
    car.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.4, 24), rimMaterial);
    rim.position.set(pos.x, 0.5, pos.z);
    rim.rotation.x = Math.PI / 2;
    car.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16), chromeMaterial);
    hub.position.set(pos.x, 0.5, pos.z);
    hub.rotation.x = Math.PI / 2;
    car.add(hub);
  });

  // Lights
  const headlightGeo = new THREE.BoxGeometry(0.12, 0.3, 0.7);
  const headlightL = new THREE.Mesh(headlightGeo, headlightMaterial);
  headlightL.position.set(2.76, 0.75, 0.7);
  car.add(headlightL);

  const headlightR = new THREE.Mesh(headlightGeo, headlightMaterial);
  headlightR.position.set(2.76, 0.75, -0.7);
  car.add(headlightR);

  const taillightGeo = new THREE.BoxGeometry(0.12, 0.28, 0.6);
  const taillightL = new THREE.Mesh(taillightGeo, taillightMaterial);
  taillightL.position.set(-2.76, 0.75, 0.7);
  car.add(taillightL);

  const taillightR = new THREE.Mesh(taillightGeo, taillightMaterial);
  taillightR.position.set(-2.76, 0.75, -0.7);
  car.add(taillightR);

  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 2.6), darkMaterial);
  frontBumper.position.set(2.85, 0.28, 0);
  car.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 2.6), darkMaterial);
  rearBumper.position.set(-2.85, 0.28, 0);
  car.add(rearBumper);

  // Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.6), darkMaterial);
  grille.position.set(2.77, 0.55, 0);
  car.add(grille);

  return car;
}
