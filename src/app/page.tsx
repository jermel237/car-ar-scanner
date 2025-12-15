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
          (p: any) => ['car', 'truck', 'bus', 'motorcycle'].includes(p.class) && p.score > 0.4
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (vehicles.length > 0) {
          const car = vehicles[0];
          const [x, y, width, height] = car.bbox;
          
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

          setCarPosition(newPosition);

          // Only draw detection box when SCANNING
          if (isScanning && !arMode) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            const cornerLength = 30;
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#00ff00';

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

            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(
              `${car.class.toUpperCase()} ${Math.round(car.score * 100)}%`,
              x + 5,
              y - 15
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
          pointerEvents: 'none',
          display: arMode ? 'none' : 'block'
        }}
      />

      {/* 3D Car - 5X BIGGER with touch spin */}
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
          AR MODE
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

      {/* Touch instruction in AR mode */}
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
          backdropFilter: 'blur(10px)'
        }}>
          👆 Hold & drag to spin the car
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
    </div>
  );
}

// 3D Car - 5X BIGGER + TOUCH SPIN CONTROL
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

  // Calculate 5X bigger size centered on detection
  const size = {
    width: position.width * 5,
    height: position.height * 5,
    x: position.x + position.width / 2 - (position.width * 5) / 2,
    y: position.y + position.height / 2 - (position.height * 5) / 2
  };

  // Keep within screen bounds
  const boundedSize = {
    width: Math.min(size.width, window.innerWidth * 0.95),
    height: Math.min(size.height, window.innerHeight * 0.7),
    x: Math.max(10, Math.min(size.x, window.innerWidth - size.width - 10)),
    y: Math.max(100, Math.min(size.y, window.innerHeight - size.height - 150))
  };

  // Touch handlers for spinning
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = true;
    lastTouchXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || !carRef.current) return;
    
    const touchX = e.touches[0].clientX;
    const deltaX = touchX - lastTouchXRef.current;
    
    // Rotate based on drag direction
    rotationRef.current += deltaX * 0.01;
    carRef.current.rotation.y = rotationRef.current;
    
    lastTouchXRef.current = touchX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Mouse handlers for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastTouchXRef.current = e.clientX;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !carRef.current) return;
    
    const deltaX = e.clientX - lastTouchXRef.current;
    rotationRef.current += deltaX * 0.01;
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

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.3);
    bottomLight.position.set(0, -3, 0);
    scene.add(bottomLight);

    // Create car
    const car = createCar(getColor());
    scene.add(car);
    carRef.current = car;

    // Animation loop
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

  // Update size
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    rendererRef.current.setSize(boundedSize.width, boundedSize.height);
    cameraRef.current.aspect = boundedSize.width / boundedSize.height;
    cameraRef.current.updateProjectionMatrix();
  }, [boundedSize.width, boundedSize.height]);

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
        left: boundedSize.x,
        top: boundedSize.y,
        width: boundedSize.width,
        height: boundedSize.height,
        zIndex: 50,
        cursor: 'grab',
        touchAction: 'none'
      }}
    />
  );
}

// Create detailed 3D Car
function createCar(color: number): THREE.Group {
  const car = new THREE.Group();

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.7
  });

  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.3,
    roughness: 0.8
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.95,
    roughness: 0.05
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.05
  });

  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffee,
    emissiveIntensity: 1
  });

  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.8
  });

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.5,
    roughness: 0.5
  });

  // ===== BODY =====
  
  // Lower body
  const bodyLowerGeometry = new THREE.BoxGeometry(4.8, 0.9, 2.1);
  const bodyLower = new THREE.Mesh(bodyLowerGeometry, bodyMaterial);
  bodyLower.position.y = 0.55;
  bodyLower.castShadow = true;
  car.add(bodyLower);

  // Upper body
  const bodyUpperGeometry = new THREE.BoxGeometry(4.5, 0.4, 2.05);
  const bodyUpper = new THREE.Mesh(bodyUpperGeometry, bodyMaterial);
  bodyUpper.position.y = 1.2;
  car.add(bodyUpper);

  // Hood
  const hoodGeometry = new THREE.BoxGeometry(1.5, 0.4, 2);
  const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
  hood.position.set(1.9, 1, 0);
  hood.rotation.z = -0.1;
  car.add(hood);

  // Trunk
  const trunkGeometry = new THREE.BoxGeometry(1.1, 0.4, 2);
  const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
  trunk.position.set(-2, 1, 0);
  trunk.rotation.z = 0.08;
  car.add(trunk);

  // ===== CABIN =====
  
  const cabinGeometry = new THREE.BoxGeometry(2.6, 1.1, 1.9);
  const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
  cabin.position.set(-0.1, 1.95, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Roof
  const roofGeometry = new THREE.BoxGeometry(2.4, 0.15, 1.85);
  const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
  roof.position.set(-0.1, 2.55, 0);
  car.add(roof);

  // ===== WINDOWS =====
  
  // Windshield
  const windshieldGeometry = new THREE.PlaneGeometry(1.8, 1);
  const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
  windshield.position.set(1.05, 1.95, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.x = 0.25;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(windshieldGeometry, glassMaterial);
  rearWindow.position.set(-1.3, 1.95, 0);
  rearWindow.rotation.y = -Math.PI / 2;
  rearWindow.rotation.x = -0.2;
  car.add(rearWindow);

  // Side windows
  const sideWindowGeometry = new THREE.PlaneGeometry(2.3, 0.85);
  
  const sideWindowLeft = new THREE.Mesh(sideWindowGeometry, glassMaterial);
  sideWindowLeft.position.set(-0.1, 2, 0.96);
  car.add(sideWindowLeft);

  const sideWindowRight = new THREE.Mesh(sideWindowGeometry, glassMaterial);
  sideWindowRight.position.set(-0.1, 2, -0.96);
  sideWindowRight.rotation.y = Math.PI;
  car.add(sideWindowRight);

  // ===== WHEELS =====
  
  const wheelGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 32);
  const rimGeometry = new THREE.CylinderGeometry(0.28, 0.28, 0.34, 24);
  const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.36, 16);

  const wheelPositions = [
    { x: 1.5, z: 1.15 },
    { x: 1.5, z: -1.15 },
    { x: -1.5, z: 1.15 },
    { x: -1.5, z: -1.15 }
  ];

  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(pos.x, 0.45, pos.z);
    wheel.rotation.x = Math.PI / 2;
    wheel.castShadow = true;
    car.add(wheel);

    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.set(pos.x, 0.45, pos.z);
    rim.rotation.x = Math.PI / 2;
    car.add(rim);

    const hub = new THREE.Mesh(hubGeometry, chromeMaterial);
    hub.position.set(pos.x, 0.45, pos.z);
    hub.rotation.x = Math.PI / 2;
    car.add(hub);

    // Spokes
    for (let i = 0; i < 5; i++) {
      const spokeGeometry = new THREE.BoxGeometry(0.03, 0.2, 0.35);
      const spoke = new THREE.Mesh(spokeGeometry, rimMaterial);
      spoke.position.set(pos.x, 0.45, pos.z);
      spoke.rotation.x = Math.PI / 2;
      spoke.rotation.z = (i * Math.PI * 2) / 5;
      car.add(spoke);
    }
  });

  // ===== LIGHTS =====
  
  // Headlights
  const headlightGeometry = new THREE.BoxGeometry(0.1, 0.25, 0.6);
  
  const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
  headlightLeft.position.set(2.41, 0.7, 0.6);
  car.add(headlightLeft);

  const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  headlightRight.position.set(2.41, 0.7, -0.6);
  car.add(headlightRight);

  // Headlight glow
  const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.6
  });

  const glowLeft = new THREE.Mesh(glowGeometry, glowMaterial);
  glowLeft.position.set(2.5, 0.7, 0.6);
  car.add(glowLeft);

  const glowRight = new THREE.Mesh(glowGeometry, glowMaterial);
  glowRight.position.set(2.5, 0.7, -0.6);
  car.add(glowRight);

  // Taillights
  const taillightGeometry = new THREE.BoxGeometry(0.1, 0.22, 0.5);
  
  const taillightLeft = new THREE.Mesh(taillightGeometry, taillightMaterial);
  taillightLeft.position.set(-2.41, 0.7, 0.6);
  car.add(taillightLeft);

  const taillightRight = new THREE.Mesh(taillightGeometry, taillightMaterial);
  taillightRight.position.set(-2.41, 0.7, -0.6);
  car.add(taillightRight);

  // ===== DETAILS =====
  
  // Grille
  const grilleGeometry = new THREE.BoxGeometry(0.06, 0.4, 1.4);
  const grille = new THREE.Mesh(grilleGeometry, darkMaterial);
  grille.position.set(2.42, 0.5, 0);
  car.add(grille);

  // Grille lines
  for (let i = -3; i <= 3; i++) {
    const lineGeometry = new THREE.BoxGeometry(0.08, 0.35, 0.04);
    const line = new THREE.Mesh(lineGeometry, chromeMaterial);
    line.position.set(2.43, 0.5, i * 0.18);
    car.add(line);
  }

  // Front bumper
  const frontBumperGeometry = new THREE.BoxGeometry(0.25, 0.3, 2.2);
  const frontBumper = new THREE.Mesh(frontBumperGeometry, darkMaterial);
  frontBumper.position.set(2.5, 0.25, 0);
  car.add(frontBumper);

  // Rear bumper
  const rearBumper = new THREE.Mesh(frontBumperGeometry, darkMaterial);
  rearBumper.position.set(-2.5, 0.25, 0);
  car.add(rearBumper);

  // Side mirrors
  const mirrorArmGeometry = new THREE.BoxGeometry(0.25, 0.05, 0.05);
  const mirrorHeadGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.2);

  const mirrorArmLeft = new THREE.Mesh(mirrorArmGeometry, bodyMaterial);
  mirrorArmLeft.position.set(0.8, 1.5, 1.1);
  car.add(mirrorArmLeft);

  const mirrorHeadLeft = new THREE.Mesh(mirrorHeadGeometry, darkMaterial);
  mirrorHeadLeft.position.set(0.8, 1.5, 1.25);
  car.add(mirrorHeadLeft);

  const mirrorArmRight = new THREE.Mesh(mirrorArmGeometry, bodyMaterial);
  mirrorArmRight.position.set(0.8, 1.5, -1.1);
  car.add(mirrorArmRight);

  const mirrorHeadRight = new THREE.Mesh(mirrorHeadGeometry, darkMaterial);
  mirrorHeadRight.position.set(0.8, 1.5, -1.25);
  car.add(mirrorHeadRight);

  // Door handles
  const handleGeometry = new THREE.BoxGeometry(0.2, 0.05, 0.05);
  
  [-0.5, 0.5].forEach(xOffset => {
    const handleLeft = new THREE.Mesh(handleGeometry, chromeMaterial);
    handleLeft.position.set(xOffset, 1.2, 1.06);
    car.add(handleLeft);

    const handleRight = new THREE.Mesh(handleGeometry, chromeMaterial);
    handleRight.position.set(xOffset, 1.2, -1.06);
    car.add(handleRight);
  });

  // Door lines
  const doorLineGeometry = new THREE.BoxGeometry(0.02, 0.85, 0.02);
  
  [0.1, -0.9].forEach(x => {
    const doorLineLeft = new THREE.Mesh(doorLineGeometry, darkMaterial);
    doorLineLeft.position.set(x, 0.55, 1.06);
    car.add(doorLineLeft);

    const doorLineRight = new THREE.Mesh(doorLineGeometry, darkMaterial);
    doorLineRight.position.set(x, 0.55, -1.06);
    car.add(doorLineRight);
  });

  // License plates
  const plateGeometry = new THREE.BoxGeometry(0.04, 0.18, 0.55);
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  const frontPlate = new THREE.Mesh(plateGeometry, plateMaterial);
  frontPlate.position.set(2.52, 0.35, 0);
  car.add(frontPlate);

  const rearPlate = new THREE.Mesh(plateGeometry, plateMaterial);
  rearPlate.position.set(-2.52, 0.35, 0);
  car.add(rearPlate);

  // Antenna
  const antennaGeometry = new THREE.CylinderGeometry(0.015, 0.01, 0.5, 8);
  const antenna = new THREE.Mesh(antennaGeometry, darkMaterial);
  antenna.position.set(-0.8, 2.8, 0.6);
  car.add(antenna);

  // Exhaust pipes
  const exhaustGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 16);
  const exhaustMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
  
  const exhaust1 = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
  exhaust1.position.set(-2.55, 0.2, 0.5);
  exhaust1.rotation.z = Math.PI / 2;
  car.add(exhaust1);

  const exhaust2 = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
  exhaust2.position.set(-2.55, 0.2, -0.5);
  exhaust2.rotation.z = Math.PI / 2;
  car.add(exhaust2);

  return car;
}