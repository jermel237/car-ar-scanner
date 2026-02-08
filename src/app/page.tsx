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

  // AUTO DETECTION - HUMAN
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
        
        const humans = predictions.filter(
          (p: any) => p.class === 'person' && p.score > 0.5
        );

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
        <h2 style={{ marginTop: 30, fontSize: 24 }}>📊 1D Array Visualizer</h2>
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

      {/* Hidden canvas */}
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

      {/* 1D ARRAY 3D MODEL */}
      {personPosition && (
        <OneDimensionalArray position={personPosition} />
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
          {detectedPerson ? '📊 1D ARRAY' : '🔍 SCANNING...'}
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
          top: 'calc(env(safe-area-inset-top, 20px) + 60px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 15,
          fontSize: 12,
          textAlign: 'center'
        }}>
          {detectedPerson ? '👆 Drag to rotate array' : '📱 Point at person'}
        </div>

        {/* Array Label */}
        {detectedPerson && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 95px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: '#00ff00',
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'monospace',
            fontWeight: 'bold'
          }}>
            int arr[5] = {'{1, 2, 3, 4, 5}'}
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
            height: 3,
            background: 'linear-gradient(90deg, transparent, #667eea, transparent)',
            boxShadow: '0 0 20px #667eea',
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

// 1D ARRAY - Row of 3D boxes [1][2][3][4][5]
function OneDimensionalArray({ position }: { position: Position }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.2, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Array data
  const arrayData = [1, 2, 3, 4, 5];
  
  // Colors for each box
  const colors = [
    '#e74c3c', // Red
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
  ];

  // Size
  const size = {
    width: Math.min(window.innerWidth - 40, 400),
    height: 200,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 40, 400) / 2,
    y: position.y + position.height / 2 - 100
  };

  // Create texture with number
  const createNumberTexture = (num: number, bgColor: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);
    
    // White number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num.toString(), 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, 1, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 3, -5);
    scene.add(backLight);

    // Create array group
    const arrayGroup = new THREE.Group();

    // Box size and spacing
    const boxSize = 1;
    const spacing = 1.3;
    const startX = -((arrayData.length - 1) * spacing) / 2;

    // Create each box in the array
    arrayData.forEach((num, index) => {
      const texture = createNumberTexture(num, colors[index]);
      
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.2,
        roughness: 0.5,
      });

      const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
      const cube = new THREE.Mesh(geometry, material);
      
      // Position in a row
      cube.position.x = startX + index * spacing;
      cube.position.y = 0;
      cube.position.z = 0;

      arrayGroup.add(cube);

      // Add index label below each box
      const indexCanvas = document.createElement('canvas');
      indexCanvas.width = 64;
      indexCanvas.height = 32;
      const indexCtx = indexCanvas.getContext('2d')!;
      indexCtx.fillStyle = '#ffffff';
      indexCtx.font = 'bold 24px Arial';
      indexCtx.textAlign = 'center';
      indexCtx.textBaseline = 'middle';
      indexCtx.fillText(`[${index}]`, 32, 16);

      const indexTexture = new THREE.CanvasTexture(indexCanvas);
      const indexMaterial = new THREE.SpriteMaterial({ 
        map: indexTexture,
        transparent: true
      });
      const indexSprite = new THREE.Sprite(indexMaterial);
      indexSprite.position.set(startX + index * spacing, -1, 0);
      indexSprite.scale.set(0.8, 0.4, 1);
      arrayGroup.add(indexSprite);
    });

    // Add brackets [ ]
    const createBracket = (text: string, x: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 100px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(x, 0, 0.5);
      sprite.scale.set(0.5, 1, 1);
      return sprite;
    };

    arrayGroup.add(createBracket('[', startX - 0.9));
    arrayGroup.add(createBracket(']', startX + (arrayData.length - 1) * spacing + 0.9));

    // Set initial rotation
    arrayGroup.rotation.x = rotationRef.current.x;
    arrayGroup.rotation.y = rotationRef.current.y;

    scene.add(arrayGroup);
    groupRef.current = arrayGroup;

    // Animation loop
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.x = rotationRef.current.x;
        groupRef.current.rotation.y = rotationRef.current.y;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update size
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setSize(size.width, size.height);
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

    rotationRef.current.y += deltaX * 0.01;
    rotationRef.current.x += deltaY * 0.01;

    // Limit vertical rotation
    rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x));

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

    rotationRef.current.y += deltaX * 0.01;
    rotationRef.current.x += deltaY * 0.01;
    rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x));

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
