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
  const [carPosition, setCarPosition] = useState<CarPosition | null>(null);

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

  // Detection loop - ALWAYS RUNS IN AR MODE to track car
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
          (p: any) => ['car', 'truck', 'bus', 'motorcycle'].includes(p.class) && p.score > 0.4
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (vehicles.length > 0) {
          const car = vehicles[0];
          const [x, y, width, height] = car.bbox;
          
          // Scale to screen size
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;
          
          const newPosition = {
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

          // ALWAYS update position - this makes 3D model follow the car
          setCarPosition(newPosition);

          // Draw detection box when scanning (not in AR mode)
          if (!arMode) {
            // Green box
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Corner brackets
            const cornerLength = 30;
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#00ff00';

            // Top-left
            ctx.beginPath();
            ctx.moveTo(x, y + cornerLength);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLength, y);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(x + width - cornerLength, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + cornerLength);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(x, y + height - cornerLength);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + cornerLength, y + height);
            ctx.stroke();

            // Bottom-right
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
          // No car detected
          if (!arMode) {
            setDetectedCar(null);
            setCarPosition(null);
          }
          // In AR mode, keep last known position if car temporarily lost
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
      setCarPosition(null);
    } else if (detectedCar) {
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
      touchAction: 'none'
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

      {/* 3D Car Overlay - TRACKS THE REAL CAR */}
      {arMode && carPosition && (
        <ThreeDCar 
          position={carPosition}
          carType={detectedCar?.class || 'car'}
        />
      )}

      {/* Scanning Line */}
      {isScanning && (
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

      {/* Camera Switch Button */}
      <button
        onClick={switchCamera}
        style={{
          position: 'absolute',
          top: 15,
          right: 15,
          width: 65,
          height: 65,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          fontSize: 30,
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
        top: 25,
        left: 15,
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: 25,
        fontSize: 15,
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
          padding: '14px 28px',
          borderRadius: 35,
          fontSize: 18,
          fontWeight: 'bold',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <span style={{ 
            width: 12, 
            height: 12, 
            background: 'white', 
            borderRadius: '50%',
            animation: 'pulse 1s infinite' 
          }} />
          AR TRACKING
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(0.8); }
            }
          `}</style>
        </div>
      )}

      {/* Status Bar */}
      {!arMode && (
        <div style={{
          position: 'absolute',
          top: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)',
          color: 'white',
          padding: '16px 30px',
          borderRadius: 35,
          fontSize: 17,
          textAlign: 'center',
          maxWidth: '90%',
          backdropFilter: 'blur(10px)',
          zIndex: 100
        }}>
          {isScanning
            ? detectedCar
              ? `🎯 ${detectedCar.class.toUpperCase()} detected!`
              : '🔍 Looking for vehicles...'
            : '📱 Point at a car and tap Scan'
          }
        </div>
      )}

      {/* Main Buttons */}
      <div style={{
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 20,
        padding: '0 20px',
        zIndex: 100
      }}>
        {arMode ? (
          <button
            onClick={exitAR}
            style={{
              padding: '24px 55px',
              fontSize: 22,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 60,
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              minWidth: 220,
              touchAction: 'manipulation'
            }}
          >
            ✕ Exit AR
          </button>
        ) : (
          <button
            onClick={handleScan}
            style={{
              padding: '24px 65px',
              fontSize: 22,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 60,
              background: isScanning && detectedCar
                ? 'linear-gradient(135deg, #00b894, #00cec9)'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              minWidth: 240,
              touchAction: 'manipulation'
            }}
          >
            {isScanning
              ? detectedCar
                ? '✨ Start AR'
                : '⏹️ Stop'
              : '🔍 Scan Car'
            }
          </button>
        )}
      </div>

      {/* AR Instructions */}
      {arMode && (
        <div style={{
          position: 'absolute',
          bottom: 140,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '14px 28px',
          borderRadius: 25,
          fontSize: 15,
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 100,
          maxWidth: '90%'
        }}>
          🚗 3D model tracks the real car • Move your phone!
        </div>
      )}
    </div>
  );
}

// Real Three.js 3D Car - NO SPINNING, TRACKS POSITION
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

  // Get color based on vehicle type
  const getColor = useCallback(() => {
    switch(carType) {
      case 'truck': return 0x3498db;
      case 'bus': return 0xf39c12;
      case 'motorcycle': return 0x9b59b6;
      default: return 0xe74c3c;
    }
  }, [carType]);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // Create 3D Car
    const car = createCar(getColor());
    scene.add(car);
    carRef.current = car;

    // Animation loop (just renders, no rotation)
    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      carRef.current = null;
    };
  }, [getColor]);

  // Update size when position changes
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    const width = position.width;
    const height = position.height;

    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [position.width, position.height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: position.width,
        height: position.height,
        pointerEvents: 'none',
        zIndex: 50,
        transition: 'left 0.05s linear, top 0.05s linear, width 0.05s linear, height 0.05s linear'
      }}
    >
      {/* AR Label */}
      <div style={{
        position: 'absolute',
        top: -45,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        padding: '10px 22px',
        borderRadius: 25,
        fontSize: 15,
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        zIndex: 60
      }}>
        🚗 {carType.toUpperCase()} • AR
      </div>

      {/* Tracking border */}
      <div style={{
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        border: '3px solid #00ff00',
        borderRadius: 12,
        boxShadow: '0 0 15px #00ff00, 0 0 30px #00ff0055',
        pointerEvents: 'none'
      }} />

      {/* Corner markers */}
      <div style={{ position: 'absolute', top: -8, left: -8, width: 20, height: 20, borderTop: '4px solid #00ff00', borderLeft: '4px solid #00ff00' }} />
      <div style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderTop: '4px solid #00ff00', borderRight: '4px solid #00ff00' }} />
      <div style={{ position: 'absolute', bottom: -8, left: -8, width: 20, height: 20, borderBottom: '4px solid #00ff00', borderLeft: '4px solid #00ff00' }} />
      <div style={{ position: 'absolute', bottom: -8, right: -8, width: 20, height: 20, borderBottom: '4px solid #00ff00', borderRight: '4px solid #00ff00' }} />
    </div>
  );
}

// Create 3D Car Model
function createCar(color: number): THREE.Group {
  const car = new THREE.Group();

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.6,
    roughness: 0.4,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  });

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.3,
    roughness: 0.8
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.8,
    roughness: 0.2
  });

  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffcc,
    emissive: 0xffffcc,
    emissiveIntensity: 0.5
  });

  const tailLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.3
  });

  // Main body (lower)
  const bodyGeometry = new THREE.BoxGeometry(4, 1, 2);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  car.add(body);

  // Hood
  const hoodGeometry = new THREE.BoxGeometry(1.2, 0.4, 1.9);
  const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
  hood.position.set(1.7, 0.8, 0);
  car.add(hood);

  // Cabin
  const cabinGeometry = new THREE.BoxGeometry(2.2, 1, 1.8);
  const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
  cabin.position.set(-0.2, 1.5, 0);
  car.add(cabin);

  // Roof
  const roofGeometry = new THREE.BoxGeometry(1.8, 0.15, 1.7);
  const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
  roof.position.set(-0.2, 2.05, 0);
  car.add(roof);

  // Windshield front
  const windshieldGeometry = new THREE.PlaneGeometry(1.6, 0.9);
  const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
  windshield.position.set(0.75, 1.5, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.z = 0.15;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(windshieldGeometry, glassMaterial);
  rearWindow.position.set(-1.35, 1.5, 0);
  rearWindow.rotation.y = -Math.PI / 2;
  rearWindow.rotation.z = -0.15;
  car.add(rearWindow);

  // Side windows
  const sideWindowGeometry = new THREE.PlaneGeometry(2, 0.75);
  
  const sideWindowLeft = new THREE.Mesh(sideWindowGeometry, glassMaterial);
  sideWindowLeft.position.set(-0.2, 1.55, 0.91);
  car.add(sideWindowLeft);

  const sideWindowRight = new THREE.Mesh(sideWindowGeometry, glassMaterial);
  sideWindowRight.position.set(-0.2, 1.55, -0.91);
  sideWindowRight.rotation.y = Math.PI;
  car.add(sideWindowRight);

  // Wheels
  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24);
  const rimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 16);

  const wheelPositions = [
    { x: 1.3, z: 1.15 },
    { x: 1.3, z: -1.15 },
    { x: -1.3, z: 1.15 },
    { x: -1.3, z: -1.15 }
  ];

  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(pos.x, 0.4, pos.z);
    wheel.rotation.x = Math.PI / 2;
    car.add(wheel);

    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.set(pos.x, 0.4, pos.z);
    rim.rotation.x = Math.PI / 2;
    car.add(rim);
  });

  // Headlights
  const headlightGeometry = new THREE.BoxGeometry(0.1, 0.25, 0.5);
  
  const headlightLeft = new THREE.Mesh(headlightGeometry, lightMaterial);
  headlightLeft.position.set(2.01, 0.6, 0.55);
  car.add(headlightLeft);

  const headlightRight = new THREE.Mesh(headlightGeometry, lightMaterial);
  headlightRight.position.set(2.01, 0.6, -0.55);
  car.add(headlightRight);

  // Taillights
  const taillightLeft = new THREE.Mesh(headlightGeometry, tailLightMaterial);
  taillightLeft.position.set(-2.01, 0.6, 0.55);
  car.add(taillightLeft);

  const taillightRight = new THREE.Mesh(headlightGeometry, tailLightMaterial);
  taillightRight.position.set(-2.01, 0.6, -0.55);
  car.add(taillightRight);

  // Front grille
  const grilleGeometry = new THREE.BoxGeometry(0.05, 0.4, 1.2);
  const grilleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
  grille.position.set(2.03, 0.4, 0);
  car.add(grille);

  // Bumpers
  const bumperGeometry = new THREE.BoxGeometry(0.15, 0.25, 2.1);
  const bumperMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.4 });
  
  const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  frontBumper.position.set(2.08, 0.2, 0);
  car.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
  rearBumper.position.set(-2.08, 0.2, 0);
  car.add(rearBumper);

  // Side mirrors
  const mirrorGeometry = new THREE.BoxGeometry(0.15, 0.12, 0.25);
  
  const mirrorLeft = new THREE.Mesh(mirrorGeometry, bodyMaterial);
  mirrorLeft.position.set(0.6, 1.3, 1.15);
  car.add(mirrorLeft);

  const mirrorRight = new THREE.Mesh(mirrorGeometry, bodyMaterial);
  mirrorRight.position.set(0.6, 1.3, -1.15);
  car.add(mirrorRight);

  // Door lines (subtle)
  const doorLineGeometry = new THREE.BoxGeometry(0.02, 0.9, 0.02);
  const doorLineMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

  const doorLine1 = new THREE.Mesh(doorLineGeometry, doorLineMaterial);
  doorLine1.position.set(0.3, 0.5, 1.01);
  car.add(doorLine1);

  const doorLine2 = new THREE.Mesh(doorLineGeometry, doorLineMaterial);
  doorLine2.position.set(0.3, 0.5, -1.01);
  car.add(doorLine2);

  return car;
}