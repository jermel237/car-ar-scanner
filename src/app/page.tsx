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

type Environment = 'grocery' | 'classroom' | 'todo';

interface GroceryItem {
  id: number;
  name: string;
  color: string;
}

interface Student {
  id: number;
  name: string;
  avatar: string;
}

interface Task {
  id: number;
  text: string;
  priority: 'high' | 'medium' | 'low';
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
  const [currentEnv, setCurrentEnv] = useState<Environment>('grocery');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([
    { id: 1, name: 'Milk', color: '#3498db' },
    { id: 2, name: 'Bread', color: '#e67e22' },
    { id: 3, name: 'Eggs', color: '#f1c40f' },
    { id: 4, name: 'Apple', color: '#e74c3c' },
    { id: 5, name: 'Juice', color: '#9b59b6' },
  ]);
  
  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: 'Alex', avatar: '👦' },
    { id: 2, name: 'Beth', avatar: '👧' },
    { id: 3, name: 'Carl', avatar: '👨' },
    { id: 4, name: 'Dana', avatar: '👩' },
    { id: 5, name: 'Erik', avatar: '🧑' },
  ]);
  
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Study', priority: 'high' },
    { id: 2, text: 'Code', priority: 'high' },
    { id: 3, text: 'Read', priority: 'medium' },
    { id: 4, text: 'Rest', priority: 'low' },
  ]);
  
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // ==================== ZOOM FUNCTIONS ====================
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 0.25, 2.5);
      console.log('Zoom In:', newZoom);
      return newZoom;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.25, 0.5);
      console.log('Zoom Out:', newZoom);
      return newZoom;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1.0);
    console.log('Zoom Reset: 1.0');
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
      throw new Error('Cannot access camera.');
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

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;

    let animationId: number;
    let running = true;

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== 4) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const predictions = await model.detect(video);
        const humans = predictions.filter((p: any) => p.class === 'person' && p.score > 0.5);

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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ==================== OPERATIONS ====================
  const groceryAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const index = Math.floor(Math.random() * groceryItems.length);
    setCodeDisplay(`shelf[${index}]`);
    setOperationMessage(`Accessing index ${index}...`);
    await delay(500);
    setHighlightIndex(index);
    setOperationMessage(`shelf[${index}] = "${groceryItems[index].name}"`);
    setCodeDisplay(`// O(1) Access\nitem = shelf[${index}]; // ${groceryItems[index].name}`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const groceryInsert = async () => {
    if (isAnimating || groceryItems.length >= 6) return;
    setIsAnimating(true);
    const newItems = ['Cheese', 'Butter', 'Yogurt'];
    const colors = ['#1abc9c', '#e91e63', '#00bcd4'];
    const idx = Math.floor(Math.random() * newItems.length);
    const insertIndex = Math.floor(Math.random() * (groceryItems.length + 1));
    
    setOperationMessage(`Inserting "${newItems[idx]}" at index ${insertIndex}...`);
    setCodeDisplay(`shelf.insert(${insertIndex}, "${newItems[idx]}");`);
    
    for (let i = groceryItems.length - 1; i >= insertIndex; i--) {
      setHighlightIndex(i);
      await delay(300);
    }
    
    setGroceryItems(prev => {
      const arr = [...prev];
      arr.splice(insertIndex, 0, { id: Date.now(), name: newItems[idx], color: colors[idx] });
      return arr;
    });
    
    setHighlightIndex(insertIndex);
    setOperationMessage(`Inserted at index ${insertIndex}!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const groceryDelete = async () => {
    if (isAnimating || groceryItems.length <= 2) return;
    setIsAnimating(true);
    const deleteIndex = Math.floor(Math.random() * groceryItems.length);
    const item = groceryItems[deleteIndex];
    
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting "${item.name}"...`);
    await delay(800);
    
    setGroceryItems(prev => prev.filter((_, i) => i !== deleteIndex));
    setOperationMessage(`Deleted "${item.name}"!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setIsAnimating(false);
  };

  const studentAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const index = Math.floor(Math.random() * students.length);
    setHighlightIndex(index);
    setOperationMessage(`Seat ${index}: ${students[index].avatar} ${students[index].name}`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setIsAnimating(false);
  };

  const studentSwap = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const idx1 = Math.floor(Math.random() * students.length);
    let idx2 = Math.floor(Math.random() * students.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * students.length);
    
    setHighlightIndex(idx1);
    setHighlightIndex2(idx2);
    setOperationMessage(`Swapping ${students[idx1].name} ↔ ${students[idx2].name}`);
    await delay(1500);
    
    setStudents(prev => {
      const arr = [...prev];
      [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
      return arr;
    });
    
    await delay(1000);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setIsAnimating(false);
  };

  const todoAppend = async () => {
    if (isAnimating || tasks.length >= 6) return;
    setIsAnimating(true);
    const newTasks = ['Email', 'Call', 'Clean'];
    const task = newTasks[Math.floor(Math.random() * newTasks.length)];
    
    setOperationMessage(`Appending "${task}"...`);
    setTasks(prev => [...prev, { id: Date.now(), text: task, priority: 'medium' }]);
    setHighlightIndex(tasks.length);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setIsAnimating(false);
  };

  const todoDelete = async () => {
    if (isAnimating || tasks.length <= 2) return;
    setIsAnimating(true);
    const idx = Math.floor(Math.random() * tasks.length);
    setHighlightIndex(idx);
    setOperationMessage(`Completing "${tasks[idx].text}"...`);
    await delay(1000);
    setTasks(prev => prev.filter((_, i) => i !== idx));
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setIsAnimating(false);
  };

  const getCurrentArrayData = () => {
    switch (currentEnv) {
      case 'grocery':
        return groceryItems.map(item => ({ label: item.name, color: item.color }));
      case 'classroom':
        return students.map(s => ({ label: s.avatar, color: '#3498db', subLabel: s.name }));
      case 'todo':
        return tasks.map(t => ({
          label: t.text,
          color: t.priority === 'high' ? '#e74c3c' : t.priority === 'medium' ? '#f39c12' : '#2ecc71'
        }));
      default:
        return [];
    }
  };

  if (error) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#1a1a2e',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'white', padding: 20, textAlign: 'center'
      }}>
        <div style={{ fontSize: 60 }}>📷</div>
        <h2>Camera Access Needed</h2>
        <p style={{ opacity: 0.7 }}>{error}</p>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 30, padding: '15px 40px', background: '#667eea',
            border: 'none', borderRadius: 30, color: 'white', fontSize: 16 }}>
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#1a1a2e',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          width: 60, height: 60,
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ marginTop: 20 }}>📊 Array Learning AR</h2>
        <p style={{ opacity: 0.7 }}>{loadingText}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const envInfo = {
    grocery: { icon: '🛒', title: 'Grocery Shelf' },
    classroom: { icon: '🪑', title: 'Student Seats' },
    todo: { icon: '📝', title: 'To-Do List' }
  }[currentEnv];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted autoPlay
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 3D Visualization */}
      {personPosition && (
        <ArrayVisualization3D
          position={personPosition}
          arrayData={getCurrentArrayData()}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          environment={currentEnv}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      )}

      {/* TOP UI */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {/* Camera Switch */}
        <button onClick={switchCamera}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 44, height: 44, borderRadius: '50%',
            border: 'none', background: 'rgba(0,0,0,0.6)',
            color: 'white', fontSize: 20, cursor: 'pointer'
          }}>🔄</button>

        {/* ZOOM CONTROLS */}
        {detectedPerson && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200
          }}>
            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); zoomIn(); }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '3px solid #fff',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', fontSize: 32, fontWeight: 'bold',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                touchAction: 'none'
              }}>+</button>

            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0,0,0,0.9)',
              border: '3px solid #00ff00',
              color: '#00ff00', fontSize: 14, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0,255,0,0.3)'
            }}>{Math.round(zoomLevel * 100)}%</div>

            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); zoomOut(); }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '3px solid #fff',
                background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                color: 'white', fontSize: 36, fontWeight: 'bold',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                touchAction: 'none'
              }}>−</button>

            <button
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); resetZoom(); }}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '3px solid #fff',
                background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                color: 'white', fontSize: 24,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                touchAction: 'none'
              }}>⟲</button>
          </div>
        )}

        {/* Title */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: detectedPerson ? '#00b894' : '#667eea',
          color: 'white', padding: '8px 16px', borderRadius: 20,
          fontSize: 14, fontWeight: 'bold'
        }}>{envInfo.icon} {envInfo.title}</div>

        {/* Environment Tabs */}
        {detectedPerson && (
          <div style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5, background: 'rgba(0,0,0,0.5)',
            padding: 4, borderRadius: 20
          }}>
            {(['grocery', 'classroom', 'todo'] as Environment[]).map(env => (
              <button key={env}
                onClick={() => !isAnimating && setCurrentEnv(env)}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 'bold',
                  border: 'none', borderRadius: 15,
                  background: currentEnv === env ? '#667eea' : 'transparent',
                  color: 'white', cursor: 'pointer',
                  opacity: currentEnv === env ? 1 : 0.6
                }}>
                {env === 'grocery' ? '🛒' : env === 'classroom' ? '🪑' : '📝'}
              </button>
            ))}
          </div>
        )}

        {/* Message */}
        {operationMessage && (
          <div style={{
            position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)', color: '#00ff00',
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 'bold'
          }}>{operationMessage}</div>
        )}

        {/* Code */}
        {codeDisplay && (
          <div style={{
            position: 'absolute', top: 125, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,30,0.95)', color: '#00ff00',
            padding: '8px 12px', borderRadius: 8, fontSize: 10,
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
            border: '1px solid #333'
          }}>{codeDisplay}</div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      {detectedPerson && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '15px 10px', paddingBottom: 25,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentEnv === 'grocery' && (
              <>
                <OpBtn onClick={groceryAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpBtn onClick={groceryInsert} disabled={isAnimating || groceryItems.length >= 6} color="#2ecc71" label="➕ Insert" />
                <OpBtn onClick={groceryDelete} disabled={isAnimating || groceryItems.length <= 2} color="#e74c3c" label="➖ Delete" />
              </>
            )}
            {currentEnv === 'classroom' && (
              <>
                <OpBtn onClick={studentAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpBtn onClick={studentSwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
              </>
            )}
            {currentEnv === 'todo' && (
              <>
                <OpBtn onClick={todoAppend} disabled={isAnimating || tasks.length >= 6} color="#2ecc71" label="⏬ Append" />
                <OpBtn onClick={todoDelete} disabled={isAnimating || tasks.length <= 2} color="#e74c3c" label="✅ Done" />
              </>
            )}
          </div>
        </div>
      )}

      {/* Scanning */}
      {!detectedPerson && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: 'white',
          padding: '15px 25px', borderRadius: 15, fontSize: 14
        }}>📱 Point camera at a person</div>
      )}
    </div>
  );
}

function OpBtn({ onClick, disabled, color, label }: {
  onClick: () => void; disabled: boolean; color: string; label: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '12px 18px', fontSize: 13, fontWeight: 'bold',
        border: 'none', borderRadius: 25,
        background: disabled ? '#444' : color,
        color: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, touchAction: 'manipulation'
      }}>{label}</button>
  );
}

// ==================== 3D VISUALIZATION ====================
function ArrayVisualization3D({
  position, arrayData, highlightIndex, highlightIndex2, environment, zoomLevel, setZoomLevel
}: {
  position: Position;
  arrayData: { label: string; color: string; subLabel?: string }[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  environment: Environment;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.3, y: 0 });
  const zoomRef = useRef(zoomLevel);
  
  // Keep zoomRef in sync
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  const size = {
    width: Math.min(window.innerWidth - 20, 340),
    height: 150,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 340) / 2,
    y: position.y + position.height / 2 - 75
  };

  const createTexture = (label: string, bgColor: string, hl1: boolean, hl2: boolean, sub?: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = hl1 ? '#ffff00' : hl2 ? '#ff00ff' : bgColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 124, 124);
    
    ctx.fillStyle = hl1 || hl2 ? '#000' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = label.length <= 2 ? 'bold 48px Arial' : 'bold 26px Arial';
    ctx.fillText(label, 64, sub ? 50 : 64);
    
    if (sub) {
      ctx.font = '16px Arial';
      ctx.fillText(sub, 64, 95);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  };

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    let isDragging = false;
    let lastX = 0, lastY = 0;
    let pinchDist: number | null = null;
    let pinchZoom = 1;

    const getDistance = (t: TouchList) => {
      if (t.length < 2) return null;
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        pinchDist = getDistance(e.touches);
        pinchZoom = zoomRef.current;
      } else if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const dist = getDistance(e.touches);
        if (dist) {
          const scale = dist / pinchDist;
          const newZoom = Math.max(0.5, Math.min(2.5, pinchZoom * scale));
          setZoomLevel(newZoom);
        }
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        rotationRef.current.y += dx * 0.01;
        rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x + dy * 0.01));
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) pinchDist = null;
      if (e.touches.length === 0) isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoomLevel(Math.max(0.5, Math.min(2.5, zoomRef.current + delta)));
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.x = rotationRef.current.x;
        groupRef.current.rotation.y = rotationRef.current.y;
        groupRef.current.scale.setScalar(zoomRef.current);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update boxes
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.clear();

    const boxSize = 0.8;
    const spacing = 0.95;
    const startX = -((arrayData.length - 1) * spacing) / 2;

    arrayData.forEach((item, i) => {
      const hl1 = highlightIndex === i;
      const hl2 = highlightIndex2 === i;
      const tex = createTexture(item.label, item.color, hl1, hl2, item.subLabel);
      const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
      const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
      const cube = new THREE.Mesh(geo, mat);
      cube.position.x = startX + i * spacing;
      cube.position.y = hl1 || hl2 ? 0.3 : 0;
      groupRef.current!.add(cube);

      // Index label
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = hl1 ? '#ffff00' : '#fff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${i}]`, 32, 16);
      const t = new THREE.CanvasTexture(c);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
      s.position.set(startX + i * spacing, -0.7, 0);
      s.scale.set(0.5, 0.25, 1);
      groupRef.current!.add(s);
    });
  }, [arrayData, highlightIndex, highlightIndex2]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: size.x,
        top: size.y,
        width: size.width,
        height: size.height,
        zIndex: 50,
        touchAction: 'none'
      }}
    />
  );
}
