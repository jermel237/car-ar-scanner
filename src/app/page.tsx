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
  const [detectedCar, setDetectedCar] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
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
      
      setLoadingText('Loading detector...');
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

  // AUTO DETECTION - Always running, 3D cube appears automatically
  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;

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

        } else {
          setDetectedCar(null);
          setCarPosition(null);
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
  }, [model]);

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
            cursor: 'pointer'
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
        <h2 style={{ marginTop: 30, fontSize: 24 }}>🎯 AR Auto Scanner</h2>
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

      {/* Detection Canvas (hidden, just for processing) */}
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
          opacity: 0
        }}
      />

      {/* 3D CUBE - Appears automatically when car detected */}
      {carPosition && (
        <ThreeDCube position={carPosition} />
      )}

      {/* TOP UI */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 'env(safe-area-inset-top, 20px)',
        zIndex: 100
      }}>
        {/* Camera Switch */}
        <button
          onClick={switchCamera}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 10px)',
            right: 15,
            width: 55,
            height: 55,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 24,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          🔄
        </button>

        {/* Camera Label */}
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 20px) + 18px)',
          left: 15,
          background: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '8px 15px',
          borderRadius: 20,
          fontSize: 13
        }}>
          {cameraFacing === 'environment' ? '📷 Back' : '🤳 Front'}
        </div>

        {/* Status */}
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 20px) + 15px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: detectedCar 
            ? 'linear-gradient(135deg, #00b894, #00cec9)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 25,
          fontSize: 14,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ 
            width: 8, 
            height: 8, 
            background: 'white', 
            borderRadius: '50%',
            animation: 'pulse 1s infinite' 
          }} />
          {detectedCar ? `🎯 ${detectedCar.class.toUpperCase()} FOUND` : '🔍 SCANNING...'}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

        {/* Instructions */}
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 20px) + 65px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 20,
          fontSize: 13,
          textAlign: 'center'
        }}>
          {detectedCar 
            ? '👆 Drag cube to rotate' 
            : '📱 Point camera at a car'
          }
        </div>
      </div>

      {/* Scanning animation when no car detected */}
      {!detectedCar && (
        <>
          <div style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            height: 4,
            background: 'linear-gradient(90deg, transparent, #667eea, transparent)',
            boxShadow: '0 0 30px #667eea',
            animation: 'scanMove 2s ease-in-out infinite'
          }} />
          <style>{`
            @keyframes scanMove {
              0%, 100% { top: 20%; }
              50% { top: 80%; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

// 3D CUBE with number "1"
function ThreeDCube({ position }: { position: CarPosition }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Size of cube area (2x the detection box)
  const scale = 2;
  const size = {
    width: Math.max(position.width * scale, 200),
    height: Math.max(position.height * scale, 200),
    x: position.x + position.width / 2 - Math.max(position.width * scale, 200) / 2,
    y: position.y + position.height / 2 - Math.max(position.height * scale, 200) / 2
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-5, -5, -5);
    scene.add(backLight);

    // Create cube group
    const cubeGroup = new THREE.Group();
    
    // Create cube with different colors on each face
    const cubeSize = 1.5;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    
    // Materials for each face (6 faces)
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, metalness: 0.3, roughness: 0.4 }), // Right - Red
      new THREE.MeshStandardMaterial({ color: 0x3498db, metalness: 0.3, roughness: 0.4 }), // Left - Blue
      new THREE.MeshStandardMaterial({ color: 0x2ecc71, metalness: 0.3, roughness: 0.4 }), // Top - Green
      new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.3, roughness: 0.4 }), // Bottom - Orange
      new THREE.MeshStandardMaterial({ color: 0x9b59b6, metalness: 0.3, roughness: 0.4 }), // Front - Purple
      new THREE.MeshStandardMaterial({ color: 0x1abc9c, metalness: 0.3, roughness: 0.4 }), // Back - Teal
    ];

    const cube = new THREE.Mesh(geometry, materials);
    cubeGroup.add(cube);

    // Add "1" text on each face
    const createTextSprite = (text: string, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Transparent background
      ctx.clearRect(0, 0, 256, 256);
      
      // Draw text
      ctx.fillStyle = color;
      ctx.font = 'bold 180px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(1, 1, 1);
      
      return sprite;
    };

    // Add "1" to front face
    const frontText = createTextSprite('1', '#ffffff');
    frontText.position.set(0, 0, cubeSize / 2 + 0.01);
    cubeGroup.add(frontText);

    // Add "1" to back face
    const backText = createTextSprite('1', '#ffffff');
    backText.position.set(0, 0, -cubeSize / 2 - 0.01);
    cubeGroup.add(backText);

    // Add "1" to right face
    const rightText = createTextSprite('1', '#ffffff');
    rightText.position.set(cubeSize / 2 + 0.01, 0, 0);
    cubeGroup.add(rightText);

    // Add "1" to left face
    const leftText = createTextSprite('1', '#ffffff');
    leftText.position.set(-cubeSize / 2 - 0.01, 0, 0);
    cubeGroup.add(leftText);

    // Add "1" to top face
    const topText = createTextSprite('1', '#ffffff');
    topText.position.set(0, cubeSize / 2 + 0.01, 0);
    cubeGroup.add(topText);

    // Add "1" to bottom face
    const bottomText = createTextSprite('1', '#ffffff');
    bottomText.position.set(0, -cubeSize / 2 - 0.01, 0);
    cubeGroup.add(bottomText);

    // Add edges/wireframe for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    cubeGroup.add(wireframe);

    scene.add(cubeGroup);
    cubeRef.current = cubeGroup;

    // Animation loop
    const animate = () => {
      if (cubeRef.current) {
        // Auto rotate slightly when not dragging
        if (!isDragging.current) {
          rotationRef.current.y += 0.01;
        }
        cubeRef.current.rotation.x = rotationRef.current.x;
        cubeRef.current.rotation.y = rotationRef.current.y;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Update size
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();

    return () => {
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update size when position changes
  useEffect(() => {
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(size.width, size.height);
      cameraRef.current.aspect = size.width / size.height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [size.width, size.height]);

  // Touch handlers for rotation
  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    lastTouch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDragging.current) return;

    const deltaX = e.touches[0].clientX - lastTouch.current.x;
    const deltaY = e.touches[0].clientY - lastTouch.current.y;

    rotationRef.current.y += deltaX * 0.02;
    rotationRef.current.x += deltaY * 0.02;

    lastTouch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDragging.current = false;
  };

  // Mouse handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - lastTouch.current.x;
    const deltaY = e.clientY - lastTouch.current.y;

    rotationRef.current.y += deltaX * 0.02;
    rotationRef.current.x += deltaY * 0.02;

    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: 'absolute',
        left: size.x,
        top: size.y,
        width: size.width,
        height: size.height,
        zIndex: 50,
        cursor: 'grab',
        touchAction: 'none',
        transition: 'left 0.1s, top 0.1s'
      }}
    />
  );
}
