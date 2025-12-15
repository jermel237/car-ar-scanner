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

  // CONTINUOUS DETECTION - Always tracks the car in AR mode
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
          
          // UPDATE POSITION EVERY FRAME - 3D follows real car
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

          // Draw box only when scanning
          if (isScanning && !arMode) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            const cornerLength = 30;
            ctx.lineWidth = 6;

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

  const exitAR = () => {
    setArMode(false);
    setDetectedCar(null);
    setCarPosition(null);
  };

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

      {/* 3D CAR - EXACTLY ON REAL CAR POSITION */}
      {arMode && carPosition && (
        <ThreeDCar 
          position={carPosition}
          carType={detectedCar?.class || 'car'}
        />
      )}

      {/* Scanning Line */}
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

      {/* Camera Switch */}
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

      {/* AR Mode */}
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
          AR LIVE
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </div>
      )}

      {/* Status */}
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

      {/* AR Instructions */}
      {arMode && (
        <div style={{
          position: 'absolute',
          top: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 20,
          fontSize: 14,
          zIndex: 100,
          backdropFilter: 'blur(10px)',
          textAlign: 'center'
        }}>
          👆 Drag to rotate • Move phone to track car
        </div>
      )}

      {/* Buttons */}
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
    </div>
  );
}

// 3D CAR - COVERS THE REAL CAR EXACTLY + TOUCH SPIN
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

  // EXACT POSITION - 3D covers the real car
  // Make it 2x bigger than detection box to really cover the car
  const scale = 2.5;
  const displaySize = {
    width: position.width * scale,
    height: position.height * scale,
    x: position.x - (position.width * (scale - 1)) / 2,
    y: position.y - (position.height * (scale - 1)) / 2
  };

  // Touch handlers
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
    
    // Rotate car based on drag
    rotationRef.current += deltaX * 0.02;
    carRef.current.rotation.y = rotationRef.current;
    
    lastTouchXRef.current = touchX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = false;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    lastTouchXRef.current = e.clientX;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !carRef.current) return;
    
    const deltaX = e.clientX - lastTouchXRef.current;
    rotationRef.current += deltaX * 0.02;
    carRef.current.rotation.y = rotationRef.current;
    
    lastTouchXRef.current = e.clientX;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera positioned to see the whole car
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Strong lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 15, 10);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-8, 8, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 0, -10);
    scene.add(rimLight);

    // Create big detailed car
    const car = createBigCar(getColor());
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [getColor]);

  // Update renderer size when position changes
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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

// Create BIG detailed 3D Car
function createBigCar(color: number): THREE.Group {
  const car = new THREE.Group();

  // Materials
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

  // === MAIN BODY ===
  
  // Lower body
  const bodyLower = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 1, 2.4),
    bodyMaterial
  );
  bodyLower.position.y = 0.6;
  bodyLower.castShadow = true;
  car.add(bodyLower);

  // Body sides (curved look)
  const bodySide = new THREE.Mesh(
    new THREE.BoxGeometry(5.3, 0.5, 2.5),
    bodyMaterial
  );
  bodySide.position.y = 1.2;
  car.add(bodySide);

  // Hood
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 2.3),
    bodyMaterial
  );
  hood.position.set(2.1, 1.05, 0);
  hood.rotation.z = -0.12;
  car.add(hood);

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.5, 2.3),
    bodyMaterial
  );
  trunk.position.set(-2.3, 1.05, 0);
  trunk.rotation.z = 0.1;
  car.add(trunk);

  // === CABIN ===
  
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.3, 2.2),
    bodyMaterial
  );
  cabin.position.set(-0.1, 2.05, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.18, 2.1),
    bodyMaterial
  );
  roof.position.set(-0.1, 2.75, 0);
  car.add(roof);

  // === WINDOWS ===
  
  // Windshield
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1.1),
    glassMaterial
  );
  windshield.position.set(1.2, 2.1, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.x = 0.3;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1.1),
    glassMaterial
  );
  rearWindow.position.set(-1.5, 2.1, 0);
  rearWindow.rotation.y = -Math.PI / 2;
  rearWindow.rotation.x = -0.25;
  car.add(rearWindow);

  // Side windows
  const sideWindowGeo = new THREE.PlaneGeometry(2.7, 1);
  
  const sideWindowL = new THREE.Mesh(sideWindowGeo, glassMaterial);
  sideWindowL.position.set(-0.1, 2.15, 1.11);
  car.add(sideWindowL);

  const sideWindowR = new THREE.Mesh(sideWindowGeo, glassMaterial);
  sideWindowR.position.set(-0.1, 2.15, -1.11);
  sideWindowR.rotation.y = Math.PI;
  car.add(sideWindowR);

  // === WHEELS ===
  
  const wheelPositions = [
    { x: 1.7, z: 1.3 },
    { x: 1.7, z: -1.3 },
    { x: -1.7, z: 1.3 },
    { x: -1.7, z: -1.3 }
  ];

  wheelPositions.forEach(pos => {
    // Tire
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.38, 32),
      wheelMaterial
    );
    tire.position.set(pos.x, 0.5, pos.z);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    car.add(tire);

    // Rim
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.4, 24),
      rimMaterial
    );
    rim.position.set(pos.x, 0.5, pos.z);
    rim.rotation.x = Math.PI / 2;
    car.add(rim);

    // Hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.42, 16),
      chromeMaterial
    );
    hub.position.set(pos.x, 0.5, pos.z);
    hub.rotation.x = Math.PI / 2;
    car.add(hub);

    // Spokes
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.25, 0.4),
        rimMaterial
      );
      spoke.position.set(pos.x, 0.5, pos.z);
      spoke.rotation.x = Math.PI / 2;
      spoke.rotation.z = (i * Math.PI) / 3;
      car.add(spoke);
    }
  });

  // === LIGHTS ===
  
  // Headlights
  const headlightGeo = new THREE.BoxGeometry(0.12, 0.3, 0.7);
  
  const headlightL = new THREE.Mesh(headlightGeo, headlightMaterial);
  headlightL.position.set(2.76, 0.75, 0.7);
  car.add(headlightL);

  const headlightR = new THREE.Mesh(headlightGeo, headlightMaterial);
  headlightR.position.set(2.76, 0.75, -0.7);
  car.add(headlightR);

  // Headlight glow
  const glowGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffffcc,
    transparent: true,
    opacity: 0.7
  });

  const glowL = new THREE.Mesh(glowGeo, glowMat);
  glowL.position.set(2.9, 0.75, 0.7);
  car.add(glowL);

  const glowR = new THREE.Mesh(glowGeo, glowMat);
  glowR.position.set(2.9, 0.75, -0.7);
  car.add(glowR);

  // Taillights
  const taillightGeo = new THREE.BoxGeometry(0.12, 0.28, 0.6);
  
  const taillightL = new THREE.Mesh(taillightGeo, taillightMaterial);
  taillightL.position.set(-2.76, 0.75, 0.7);
  car.add(taillightL);

  const taillightR = new THREE.Mesh(taillightGeo, taillightMaterial);
  taillightR.position.set(-2.76, 0.75, -0.7);
  car.add(taillightR);

  // === DETAILS ===
  
  // Grille
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 1.6),
    darkMaterial
  );
  grille.position.set(2.77, 0.55, 0);
  car.add(grille);

  // Grille bars
  for (let i = -4; i <= 4; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.45, 0.05),
      chromeMaterial
    );
    bar.position.set(2.78, 0.55, i * 0.16);
    car.add(bar);
  }

  // Front bumper
  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.35, 2.6),
    darkMaterial
  );
  frontBumper.position.set(2.85, 0.28, 0);
  car.add(frontBumper);

  // Rear bumper
  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.35, 2.6),
    darkMaterial
  );
  rearBumper.position.set(-2.85, 0.28, 0);
  car.add(rearBumper);

  // Side mirrors
  const mirrorArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.06),
    bodyMaterial
  );
  mirrorArm.position.set(0.9, 1.65, 1.25);
  car.add(mirrorArm);

  const mirrorHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.15, 0.25),
    darkMaterial
  );
  mirrorHead.position.set(0.9, 1.65, 1.4);
  car.add(mirrorHead);

  const mirrorArm2 = mirrorArm.clone();
  mirrorArm2.position.z = -1.25;
  car.add(mirrorArm2);

  const mirrorHead2 = mirrorHead.clone();
  mirrorHead2.position.z = -1.4;
  car.add(mirrorHead2);

  // Door handles
  const handleGeo = new THREE.BoxGeometry(0.25, 0.06, 0.06);
  
  [0.5, -0.6].forEach(x => {
    const handleL = new THREE.Mesh(handleGeo, chromeMaterial);
    handleL.position.set(x, 1.3, 1.21);
    car.add(handleL);

    const handleR = new THREE.Mesh(handleGeo, chromeMaterial);
    handleR.position.set(x, 1.3, -1.21);
    car.add(handleR);
  });

  // Door lines
  [0.15, -1].forEach(x => {
    const lineL = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 1, 0.02),
      darkMaterial
    );
    lineL.position.set(x, 0.7, 1.21);
    car.add(lineL);

    const lineR = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 1, 0.02),
      darkMaterial
    );
    lineR.position.set(x, 0.7, -1.21);
    car.add(lineR);
  });

  // License plates
  const plateGeo = new THREE.BoxGeometry(0.05, 0.22, 0.65);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(2.88, 0.4, 0);
  car.add(frontPlate);

  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(-2.88, 0.4, 0);
  car.add(rearPlate);

  // Antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.012, 0.6, 8),
    darkMaterial
  );
  antenna.position.set(-0.9, 3.05, 0.7);
  car.add(antenna);

  // Exhaust
  const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 16);
  const exhaustMat = new THREE.MeshStandardMaterial({ 
    color: 0x555555, 
    metalness: 0.9 
  });
  
  const exhaust1 = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust1.position.set(-2.95, 0.22, 0.6);
  exhaust1.rotation.z = Math.PI / 2;
  car.add(exhaust1);

  const exhaust2 = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust2.position.set(-2.95, 0.22, -0.6);
  exhaust2.rotation.z = Math.PI / 2;
  car.add(exhaust2);

  // Sunroof
  const sunroof = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.02, 0.9),
    glassMaterial
  );
  sunroof.position.set(-0.1, 2.77, 0);
  car.add(sunroof);

  return car;
}