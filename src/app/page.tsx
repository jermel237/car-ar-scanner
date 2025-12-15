'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  
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
          
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;
          
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
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 24px Arial';
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
            padding: '20px 50px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            border: 'none',
            borderRadius: 50,
            color: 'white',
            fontSize: 18,
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

      {/* 3D Car Overlay */}
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

      {/* Camera Switch Button - BIGGER */}
      <button
        onClick={switchCamera}
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
          fontSize: 28,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        🔄
      </button>

      {/* Camera Indicator */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 15,
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '10px 18px',
        borderRadius: 25,
        fontSize: 14,
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        {cameraFacing === 'environment' ? '📷 Back' : '🤳 Front'}
      </div>

      {/* AR Mode Indicator */}
      {arMode && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #00b894, #00cec9)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 30,
          fontSize: 16,
          fontWeight: 'bold',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}>
          <span style={{ 
            width: 10, 
            height: 10, 
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
          top: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '14px 28px',
          borderRadius: 30,
          fontSize: 16,
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

      {/* Main Buttons - MUCH BIGGER */}
      <div style={{
        position: 'absolute',
        bottom: 40,
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
              padding: '22px 50px',
              fontSize: 20,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 60,
              background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 6px 25px rgba(0,0,0,0.4)',
              minWidth: 200,
              touchAction: 'manipulation'
            }}
          >
            ✕ Exit AR
          </button>
        ) : (
          <button
            onClick={handleScan}
            style={{
              padding: '22px 60px',
              fontSize: 20,
              fontWeight: 'bold',
              border: 'none',
              borderRadius: 60,
              background: isScanning && detectedCar
                ? 'linear-gradient(135deg, #00b894, #00cec9)'
                : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 6px 25px rgba(0,0,0,0.4)',
              minWidth: 220,
              touchAction: 'manipulation'
            }}
          >
            {isScanning
              ? detectedCar
                ? '✨ Activate AR'
                : '⏹️ Stop Scan'
              : '🔍 Scan Car'
            }
          </button>
        )}
      </div>

      {/* AR Instructions */}
      {arMode && (
        <div style={{
          position: 'absolute',
          bottom: 130,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 20,
          fontSize: 14,
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 100
        }}>
          🚗 3D car model overlaid in real world
        </div>
      )}
    </div>
  );
}

// Real Three.js 3D Car Component
function ThreeDCar({ 
  position, 
  carType 
}: { 
  position: { x: number; y: number; width: number; height: number };
  carType: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    car: THREE.Group;
  } | null>(null);

  // Get color based on vehicle type
  const getColor = () => {
    switch(carType) {
      case 'truck': return 0x3498db;
      case 'bus': return 0xf39c12;
      case 'motorcycle': return 0x9b59b6;
      default: return 0xe74c3c;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = position.width;
    const height = position.height;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 2, 6);
    camera.lookAt(0, 0, 0);

    // Renderer with transparency
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // Create 3D Car (like the simple car model)
    const car = new THREE.Group();
    const carColor = getColor();

    // Car body material
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: carColor,
      metalness: 0.6,
      roughness: 0.4,
    });

    // Main body (lower part)
    const bodyGeometry = new THREE.BoxGeometry(4, 1, 2);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    car.add(body);

    // Hood (front slope)
    const hoodGeometry = new THREE.BoxGeometry(1.2, 0.3, 1.9);
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(1.8, 0.85, 0);
    hood.rotation.z = -0.2;
    car.add(hood);

    // Cabin (upper part)
    const cabinGeometry = new THREE.BoxGeometry(2, 1, 1.8);
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.position.set(-0.2, 1.5, 0);
    cabin.castShadow = true;
    car.add(cabin);

    // Windshield (front)
    const windshieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });

    const windshieldGeometry = new THREE.PlaneGeometry(1.6, 0.8);
    const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    windshield.position.set(0.85, 1.5, 0);
    windshield.rotation.y = Math.PI / 2;
    windshield.rotation.x = 0.1;
    car.add(windshield);

    // Rear window
    const rearWindow = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
    rearWindow.position.set(-1.25, 1.5, 0);
    rearWindow.rotation.y = -Math.PI / 2;
    rearWindow.rotation.x = -0.1;
    car.add(rearWindow);

    // Side windows
    const sideWindowGeometry = new THREE.PlaneGeometry(1.8, 0.7);
    const sideWindowLeft = new THREE.Mesh(sideWindowGeometry, windshieldMaterial);
    sideWindowLeft.position.set(-0.2, 1.5, 0.91);
    car.add(sideWindowLeft);

    const sideWindowRight = new THREE.Mesh(sideWindowGeometry, windshieldMaterial);
    sideWindowRight.position.set(-0.2, 1.5, -0.91);
    sideWindowRight.rotation.y = Math.PI;
    car.add(sideWindowRight);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.8
    });

    const wheelPositions = [
      { x: 1.3, z: 1.1 },
      { x: 1.3, z: -1.1 },
      { x: -1.3, z: 1.1 },
      { x: -1.3, z: -1.1 }
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos.x, 0.4, pos.z);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      car.add(wheel);

      // Wheel rim
      const rimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 16);
      const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.8,
        roughness: 0.2
      });
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      rim.position.set(pos.x, 0.4, pos.z);
      rim.rotation.x = Math.PI / 2;
      car.add(rim);
    });

    // Headlights
    const headlightGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.4);
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5
    });

    const headlightLeft = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlightLeft.position.set(2.01, 0.6, 0.6);
    car.add(headlightLeft);

    const headlightRight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    headlightRight.position.set(2.01, 0.6, -0.6);
    car.add(headlightRight);

    // Taillights
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3
    });

    const taillightLeft = new THREE.Mesh(headlightGeometry, taillightMaterial);
    taillightLeft.position.set(-2.01, 0.6, 0.6);
    car.add(taillightLeft);

    const taillightRight = new THREE.Mesh(headlightGeometry, taillightMaterial);
    taillightRight.position.set(-2.01, 0.6, -0.6);
    car.add(taillightRight);

    // Bumpers
    const bumperGeometry = new THREE.BoxGeometry(0.2, 0.3, 2);
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.5
    });

    const frontBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    frontBumper.position.set(2.1, 0.25, 0);
    car.add(frontBumper);

    const rearBumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    rearBumper.position.set(-2.1, 0.25, 0);
    car.add(rearBumper);

    // Add car to scene
    scene.add(car);

    // Store refs
    sceneRef.current = { scene, camera, renderer, car };

    // Animation
    let rotation = 0;
    const animate = () => {
      if (!sceneRef.current) return;
      
      rotation += 0.02;
      sceneRef.current.car.rotation.y = rotation;
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      sceneRef.current = null;
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [position.width, position.height, carType]);

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
        zIndex: 50
      }}
    >
      {/* AR Label */}
      <div style={{
        position: 'absolute',
        top: -40,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        padding: '8px 20px',
        borderRadius: 20,
        fontSize: 14,
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        zIndex: 60
      }}>
        🚗 {carType.toUpperCase()} • 3D AR
      </div>

      {/* Glowing border */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: '3px solid #00ff00',
        borderRadius: 15,
        boxShadow: '0 0 20px #00ff00, 0 0 40px #00ff0055, inset 0 0 20px #00ff0022',
        animation: 'glow 2s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      <style>{`
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px #00ff00, 0 0 40px #00ff0055; }
          50% { box-shadow: 0 0 30px #00ff00, 0 0 60px #00ff0077; }
        }
      `}</style>
    </div>
  );
}