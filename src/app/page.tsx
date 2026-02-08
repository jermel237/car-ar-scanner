'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

interface Detection {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface Position {
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
  const [detectedPerson, setDetectedPerson] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [personPosition, setPersonPosition] = useState<Position | null>(null);

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
      
      setLoadingText('Loading human detector...');
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

  // AUTO DETECTION - Detects HUMAN
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
        
        // DETECT HUMAN
        const humans = predictions.filter(
          (p: any) => p.class === 'person' && p.score > 0.5
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (humans.length > 0) {
          const person = humans[0];
          const [x, y, width, height] = person.bbox;
          
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;
          
          setDetectedPerson({
            bbox: person.bbox,
            class: person.class,
            score: person.score
          });

          setPersonPosition({
            x: x * scaleX,
            y: y * scaleY,
            width: width * scaleX,
            height: height * scaleY
          });

        } else {
          setDetectedPerson(null);
          setPersonPosition(null);
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
        <h2 style={{ marginTop: 30, fontSize: 24 }}>👤 Human Detector</h2>
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

      {/* Hidden canvas for detection */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0
        }}
      />

      {/* REAL 3D CUBE - Appears when human detected */}
      {personPosition && (
        <Real3DCube position={personPosition} />
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
          background: detectedPerson 
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
          {detectedPerson ? '👤 HUMAN DETECTED' : '🔍 SCANNING...'}
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
          {detectedPerson 
            ? '👆 Drag to rotate the 3D cube' 
            : '📱 Point camera at a person'
          }
        </div>

        {/* Confidence */}
        {detectedPerson && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 110px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            color: '#00ff00',
            padding: '8px 16px',
            borderRadius: 15,
            fontSize: 12,
            fontWeight: 'bold'
          }}>
            Confidence: {Math.round(detectedPerson.score * 100)}%
          </div>
        )}
      </div>

      {/* Scanning animation */}
      {!detectedPerson && (
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

// REAL 3D CUBE with "1" painted on faces - NO AUTO SPIN
function Real3DCube({ position }: { position: Position }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rotationRef = useRef({ x: 0.3, y: 0.5 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Size
  const scale = 1.8;
  const size = {
    width: Math.max(position.width * scale, 200),
    height: Math.max(position.height * scale, 200),
    x: position.x + position.width / 2 - Math.max(position.width * scale, 200) / 2,
    y: position.y + position.height / 2 - Math.max(position.height * scale, 200) / 2
  };

  // Create texture with number "1" painted on colored background
  const createFaceTexture = (bgColor: string, textColor: string, number: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Fill background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 512);
    
    // Add subtle gradient for 3D effect
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 472, 472);
    
    // Draw inner border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 432, 432);
    
    // Draw the number with shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 280px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, 256, 270);
    
    // Reset shadow and add highlight
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Add text outline for depth
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(number, 254, 268);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // Create 6 different textures for each face with "1"
    const textures = [
      createFaceTexture('#e74c3c', '#ffffff', '1'), // Right - Red
      createFaceTexture('#3498db', '#ffffff', '1'), // Left - Blue  
      createFaceTexture('#2ecc71', '#ffffff', '1'), // Top - Green
      createFaceTexture('#f39c12', '#ffffff', '1'), // Bottom - Orange
      createFaceTexture('#9b59b6', '#ffffff', '1'), // Front - Purple
      createFaceTexture('#1abc9c', '#ffffff', '1'), // Back - Teal
    ];

    // Create materials with textures
    const materials = textures.map(texture => 
      new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.3,
      })
    );

    // Create cube
    const cubeSize = 1.5;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cube = new THREE.Mesh(geometry, materials);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Set initial rotation
    cube.rotation.x = rotationRef.current.x;
    cube.rotation.y = rotationRef.current.y;
    
    scene.add(cube);
    cubeRef.current = cube;

    // Animation loop - NO AUTO SPIN
    const animate = () => {
      if (cubeRef.current) {
        cubeRef.current.rotation.x = rotationRef.current.x;
        cubeRef.current.rotation.y = rotationRef.current.y;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();

    return () => {
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update size
  useEffect(() => {
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(size.width, size.height);
      cameraRef.current.aspect = size.width / size.height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [size.width, size.height]);

  // Touch handlers
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

    rotationRef.current.y += deltaX * 0.015;
    rotationRef.current.x += deltaY * 0.015;

    lastTouch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDragging.current = false;
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    lastTouch.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - lastTouch.current.x;
    const deltaY = e.clientY - lastTouch.current.y;

    rotationRef.current.y += deltaX * 0.015;
    rotationRef.current.x += deltaY * 0.015;

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
