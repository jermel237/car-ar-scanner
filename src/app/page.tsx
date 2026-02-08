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

type Operation = 'none' | 'access' | 'insert' | 'delete' | 'search' | 'sort';

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
  
  // Array state
  const [arrayData, setArrayData] = useState([5, 2, 8, 1, 9]);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [currentOperation, setCurrentOperation] = useState<Operation>('none');
  const [operationMessage, setOperationMessage] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

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

  // AUTO DETECTION
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

  // Helper function for delays
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ACCESS operation - arr[index]
  const accessElement = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('access');
    
    const index = 2; // Access arr[2]
    
    setOperationMessage(`Accessing arr[${index}]...`);
    await delay(500);
    
    // Highlight the element
    setHighlightIndex(index);
    setOperationMessage(`arr[${index}] = ${arrayData[index]}`);
    
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // INSERT operation - add element
  const insertElement = async () => {
    if (isAnimating || arrayData.length >= 7) return;
    setIsAnimating(true);
    setCurrentOperation('insert');
    
    const newValue = Math.floor(Math.random() * 9) + 1;
    
    setOperationMessage(`Inserting ${newValue} at end...`);
    await delay(500);
    
    // Show where it will be inserted
    setHighlightIndex(arrayData.length);
    await delay(500);
    
    // Add the element
    setArrayData(prev => [...prev, newValue]);
    setOperationMessage(`Inserted! arr[${arrayData.length}] = ${newValue}`);
    
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // DELETE operation - remove last element
  const deleteElement = async () => {
    if (isAnimating || arrayData.length <= 2) return;
    setIsAnimating(true);
    setCurrentOperation('delete');
    
    const lastIndex = arrayData.length - 1;
    const deletedValue = arrayData[lastIndex];
    
    setOperationMessage(`Deleting arr[${lastIndex}]...`);
    setHighlightIndex(lastIndex);
    await delay(1000);
    
    // Remove the element
    setArrayData(prev => prev.slice(0, -1));
    setOperationMessage(`Deleted ${deletedValue}!`);
    
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // SEARCH operation - linear search
  const searchElement = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('search');
    
    const target = arrayData[Math.floor(Math.random() * arrayData.length)];
    
    setOperationMessage(`Searching for ${target}...`);
    await delay(500);
    
    // Linear search with animation
    for (let i = 0; i < arrayData.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Checking arr[${i}] = ${arrayData[i]}...`);
      await delay(600);
      
      if (arrayData[i] === target) {
        setOperationMessage(`Found ${target} at index ${i}!`);
        await delay(1500);
        break;
      }
    }
    
    setHighlightIndex(null);
    setOperationMessage('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // SORT operation - bubble sort
  const sortArray = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('sort');
    
    setOperationMessage('Bubble Sort starting...');
    await delay(500);
    
    let arr = [...arrayData];
    const n = arr.length;
    
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        // Highlight comparing elements
        setHighlightIndex(j);
        setHighlightIndex2(j + 1);
        setOperationMessage(`Comparing ${arr[j]} and ${arr[j + 1]}`);
        await delay(500);
        
        if (arr[j] > arr[j + 1]) {
          // Swap
          setOperationMessage(`Swapping ${arr[j]} and ${arr[j + 1]}`);
          const temp = arr[j];
          arr[j] = arr[j + 1];
          arr[j + 1] = temp;
          setArrayData([...arr]);
          await delay(500);
        }
      }
    }
    
    setOperationMessage('Array sorted!');
    setHighlightIndex(null);
    setHighlightIndex2(null);
    await delay(1500);
    
    setOperationMessage('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // RESET array
  const resetArray = () => {
    if (isAnimating) return;
    setArrayData([5, 2, 8, 1, 9]);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('Array reset!');
    setTimeout(() => setOperationMessage(''), 1000);
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
        <h2 style={{ marginTop: 30, fontSize: 24 }}>📊 Array Visualizer</h2>
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

      {/* 3D ARRAY VISUALIZATION */}
      {personPosition && (
        <ArrayVisualization 
          position={personPosition}
          arrayData={arrayData}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
        />
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
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          🔄
        </button>

        {/* Status */}
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 20px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: detectedPerson 
            ? 'linear-gradient(135deg, #00b894, #00cec9)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '8px 18px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ 
            width: 6, 
            height: 6, 
            background: 'white', 
            borderRadius: '50%',
            animation: 'pulse 1s infinite' 
          }} />
          {detectedPerson ? '📊 ARRAY READY' : '🔍 SCANNING...'}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

        {/* Array Code Display */}
        {detectedPerson && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 55px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            color: '#00ff00',
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 13,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            border: '1px solid #00ff00'
          }}>
            arr = [{arrayData.join(', ')}]
          </div>
        )}

        {/* Operation Message */}
        {operationMessage && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 100px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: currentOperation === 'sort' ? 'rgba(155, 89, 182, 0.9)' :
                       currentOperation === 'search' ? 'rgba(52, 152, 219, 0.9)' :
                       currentOperation === 'insert' ? 'rgba(46, 204, 113, 0.9)' :
                       currentOperation === 'delete' ? 'rgba(231, 76, 60, 0.9)' :
                       'rgba(241, 196, 15, 0.9)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}>
            {operationMessage}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      {detectedPerson && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 15px)',
          paddingTop: 15,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
          zIndex: 100
        }}>
          {/* Operation Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '0 15px',
            marginBottom: 10
          }}>
            <OperationButton 
              onClick={accessElement}
              disabled={isAnimating}
              color="#f39c12"
              label="📍 Access"
            />
            <OperationButton 
              onClick={searchElement}
              disabled={isAnimating}
              color="#3498db"
              label="🔍 Search"
            />
            <OperationButton 
              onClick={insertElement}
              disabled={isAnimating || arrayData.length >= 7}
              color="#2ecc71"
              label="➕ Insert"
            />
            <OperationButton 
              onClick={deleteElement}
              disabled={isAnimating || arrayData.length <= 2}
              color="#e74c3c"
              label="➖ Delete"
            />
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 10
          }}>
            <OperationButton 
              onClick={sortArray}
              disabled={isAnimating}
              color="#9b59b6"
              label="📊 Bubble Sort"
              large
            />
            <OperationButton 
              onClick={resetArray}
              disabled={isAnimating}
              color="#7f8c8d"
              label="🔄 Reset"
              large
            />
          </div>
        </div>
      )}

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
          
          {/* Instructions when not detected */}
          <div style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: 15,
            fontSize: 14,
            textAlign: 'center'
          }}>
            📱 Point camera at a person to see array visualization
          </div>
        </>
      )}
    </div>
  );
}

// Operation Button Component
function OperationButton({ 
  onClick, 
  disabled, 
  color, 
  label,
  large = false
}: { 
  onClick: () => void;
  disabled: boolean;
  color: string;
  label: string;
  large?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        padding: large ? '12px 20px' : '10px 14px',
        fontSize: large ? 14 : 12,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 25,
        background: disabled ? '#555' : color,
        color: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled ? 'none' : `0 4px 15px ${color}66`,
        transition: 'all 0.2s',
        touchAction: 'manipulation'
      }}
    >
      {label}
    </button>
  );
}

// 3D Array Visualization Component
function ArrayVisualization({ 
  position, 
  arrayData,
  highlightIndex,
  highlightIndex2
}: { 
  position: Position;
  arrayData: number[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cubesRef = useRef<THREE.Mesh[]>([]);
  const rotationRef = useRef({ x: 0.3, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  // Colors
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'
  ];

  // Size
  const size = {
    width: Math.min(window.innerWidth - 20, 380),
    height: 180,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 380) / 2,
    y: position.y + position.height / 2 - 90
  };

  // Create texture with number
  const createNumberTexture = (num: number, bgColor: string, isHighlighted: boolean, isHighlighted2: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    if (isHighlighted) {
      ctx.fillStyle = '#ffff00'; // Yellow highlight
    } else if (isHighlighted2) {
      ctx.fillStyle = '#ff00ff'; // Magenta for second comparison
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(0, 0, 128, 128);
    
    // Border
    ctx.strokeStyle = isHighlighted || isHighlighted2 ? '#000' : '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);
    
    // Number
    ctx.fillStyle = isHighlighted || isHighlighted2 ? '#000' : '#fff';
    ctx.font = 'bold 70px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num.toString(), 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  // Initial setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, 1.5, 7);
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
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Array group
    const arrayGroup = new THREE.Group();
    groupRef.current = arrayGroup;
    scene.add(arrayGroup);

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

  // Update cubes when array data changes
  useEffect(() => {
    if (!groupRef.current || !sceneRef.current) return;

    // Clear old cubes
    groupRef.current.clear();
    cubesRef.current = [];

    const boxSize = 0.9;
    const spacing = 1.1;
    const startX = -((arrayData.length - 1) * spacing) / 2;

    // Create cubes
    arrayData.forEach((num, index) => {
      const isHighlighted = highlightIndex === index;
      const isHighlighted2 = highlightIndex2 === index;
      const texture = createNumberTexture(num, colors[index % colors.length], isHighlighted, isHighlighted2);
      
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.5,
      });

      const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
      const cube = new THREE.Mesh(geometry, material);
      
      cube.position.x = startX + index * spacing;
      cube.position.y = isHighlighted || isHighlighted2 ? 0.3 : 0; // Lift highlighted
      
      groupRef.current!.add(cube);
      cubesRef.current.push(cube);

      // Index label
      const indexCanvas = document.createElement('canvas');
      indexCanvas.width = 64;
      indexCanvas.height = 32;
      const indexCtx = indexCanvas.getContext('2d')!;
      indexCtx.fillStyle = isHighlighted ? '#ffff00' : '#ffffff';
      indexCtx.font = 'bold 22px Arial';
      indexCtx.textAlign = 'center';
      indexCtx.textBaseline = 'middle';
      indexCtx.fillText(`[${index}]`, 32, 16);

      const indexTexture = new THREE.CanvasTexture(indexCanvas);
      const indexMaterial = new THREE.SpriteMaterial({ map: indexTexture, transparent: true });
      const indexSprite = new THREE.Sprite(indexMaterial);
      indexSprite.position.set(startX + index * spacing, -0.85, 0);
      indexSprite.scale.set(0.6, 0.3, 1);
      groupRef.current!.add(indexSprite);
    });

  }, [arrayData, highlightIndex, highlightIndex2]);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDragging.current) return;

    const deltaX = e.touches[0].clientX - lastTouch.current.x;
    const deltaY = e.touches[0].clientY - lastTouch.current.y;

    rotationRef.current.y += deltaX * 0.01;
    rotationRef.current.x += deltaY * 0.01;
    rotationRef.current.x = Math.max(-0.6, Math.min(0.6, rotationRef.current.x));

    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = () => {
    isDragging.current = false;
  };

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
    rotationRef.current.x = Math.max(-0.6, Math.min(0.6, rotationRef.current.x));
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
        transition: 'left 0.15s, top 0.15s'
      }}
    />
  );
}
