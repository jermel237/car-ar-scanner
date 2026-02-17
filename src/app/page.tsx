'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ==================== INTERFACES ====================

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

interface HumanAppearance {
  skinTone: string;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  hairStyle: 'short' | 'long' | 'bald';
  gender: 'male' | 'female';
}

interface Student {
  id: number;
  name: string;
  appearance: HumanAppearance;
}

interface Task {
  id: number;
  text: string;
  priority: 'high' | 'medium' | 'low';
}

interface ArrayDataItem {
  label: string;
  color: string;
  subLabel?: string;
  appearance?: HumanAppearance;
  name?: string;
}

// ==================== MAIN COMPONENT ====================

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
  
  // GROCERY DATA
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([
    { id: 1, name: 'Milk', color: '#3498db' },
    { id: 2, name: 'Bread', color: '#e67e22' },
    { id: 3, name: 'Eggs', color: '#f1c40f' },
    { id: 4, name: 'Apple', color: '#e74c3c' },
    { id: 5, name: 'Juice', color: '#9b59b6' },
  ]);
  
  // STUDENT DATA WITH 3D APPEARANCE
  const [students, setStudents] = useState<Student[]>([
    { 
      id: 1, 
      name: 'Alex',
      appearance: {
        skinTone: '#ffdbac',
        shirtColor: '#3498db',
        pantsColor: '#2c3e50',
        hairColor: '#4a3728',
        hairStyle: 'short',
        gender: 'male'
      }
    },
    { 
      id: 2, 
      name: 'Beth',
      appearance: {
        skinTone: '#f5d0c5',
        shirtColor: '#e91e63',
        pantsColor: '#8e44ad',
        hairColor: '#2c1810',
        hairStyle: 'long',
        gender: 'female'
      }
    },
    { 
      id: 3, 
      name: 'Carl',
      appearance: {
        skinTone: '#8d5524',
        shirtColor: '#27ae60',
        pantsColor: '#2c3e50',
        hairColor: '#1a1a1a',
        hairStyle: 'short',
        gender: 'male'
      }
    },
    { 
      id: 4, 
      name: 'Dana',
      appearance: {
        skinTone: '#ffcd94',
        shirtColor: '#f39c12',
        pantsColor: '#3498db',
        hairColor: '#d4a574',
        hairStyle: 'long',
        gender: 'female'
      }
    },
    { 
      id: 5, 
      name: 'Erik',
      appearance: {
        skinTone: '#ffe0bd',
        shirtColor: '#9b59b6',
        pantsColor: '#34495e',
        hairColor: '#b86b3e',
        hairStyle: 'short',
        gender: 'male'
      }
    },
  ]);
  
  // TASK DATA
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
    setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1.0);
  }, []);

  // ==================== CAMERA FUNCTIONS ====================

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

  // ==================== MODEL LOADING ====================

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

  // ==================== INITIALIZATION ====================

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

  // ==================== DETECTION LOOP ====================

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;

    let animationId: number;
    let running = true;
    let lastDetection = 0;
    const DETECTION_INTERVAL = 100;

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;

      const now = Date.now();
      if (now - lastDetection < DETECTION_INTERVAL) {
        animationId = requestAnimationFrame(detect);
        return;
      }
      lastDetection = now;

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

  // ==================== UTILITY ====================

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ==================== GROCERY OPERATIONS ====================

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

  // ==================== STUDENT OPERATIONS ====================

  const studentAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const index = Math.floor(Math.random() * students.length);
    setHighlightIndex(index);
    setOperationMessage(`Seat ${index}: ${students[index].name}`);
    setCodeDisplay(`// O(1) Random Access\nstudent = seats[${index}]; // ${students[index].name}`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
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
    setCodeDisplay(`// Swap Operation\ntemp = seats[${idx1}];\nseats[${idx1}] = seats[${idx2}];\nseats[${idx2}] = temp;`);
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
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== TODO OPERATIONS ====================

  const todoAppend = async () => {
    if (isAnimating || tasks.length >= 6) return;
    setIsAnimating(true);
    const newTasks = ['Email', 'Call', 'Clean'];
    const task = newTasks[Math.floor(Math.random() * newTasks.length)];
    
    setOperationMessage(`Appending "${task}"...`);
    setCodeDisplay(`// O(1) Append\ntasks.push("${task}");`);
    setTasks(prev => [...prev, { id: Date.now(), text: task, priority: 'medium' }]);
    setHighlightIndex(tasks.length);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const todoDelete = async () => {
    if (isAnimating || tasks.length <= 2) return;
    setIsAnimating(true);
    const idx = Math.floor(Math.random() * tasks.length);
    setHighlightIndex(idx);
    setOperationMessage(`Completing "${tasks[idx].text}"...`);
    setCodeDisplay(`// Delete at index\ntasks.splice(${idx}, 1);`);
    await delay(1000);
    setTasks(prev => prev.filter((_, i) => i !== idx));
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== GET ARRAY DATA ====================

  const getCurrentArrayData = (): ArrayDataItem[] => {
    switch (currentEnv) {
      case 'grocery':
        return groceryItems.map(item => ({ 
          label: item.name, 
          color: item.color 
        }));
      case 'classroom':
        return students.map(s => ({ 
          label: s.name, 
          color: s.appearance.shirtColor,
          appearance: s.appearance,
          name: s.name
        }));
      case 'todo':
        return tasks.map(t => ({
          label: t.text,
          color: t.priority === 'high' ? '#e74c3c' : 
                 t.priority === 'medium' ? '#f39c12' : '#2ecc71'
        }));
      default:
        return [];
    }
  };

  // ==================== ERROR STATE ====================

  if (error) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'white', padding: 20, textAlign: 'center'
      }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>📷</div>
        <h2 style={{ marginBottom: 10 }}>Camera Access Needed</h2>
        <p style={{ opacity: 0.7, marginBottom: 30 }}>{error}</p>
        <button onClick={() => window.location.reload()}
          style={{ 
            padding: '15px 40px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none', borderRadius: 30, color: 'white', 
            fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}>
          🔄 Try Again
        </button>
      </div>
    );
  }

  // ==================== LOADING STATE ====================

  if (isLoading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          width: 70, height: 70,
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ marginTop: 25, fontSize: 24 }}>📊 Array Learning AR</h2>
        <p style={{ opacity: 0.7, marginTop: 10 }}>{loadingText}</p>
        <div style={{ marginTop: 30, display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 30 }}>🛒</span>
          <span style={{ fontSize: 30 }}>🧑‍🤝‍🧑</span>
          <span style={{ fontSize: 30 }}>📝</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ==================== ENVIRONMENT INFO ====================

  const envInfo = {
    grocery: { icon: '🛒', title: 'Grocery Shelf' },
    classroom: { icon: '🧑‍🤝‍🧑', title: 'Student Seats' },
    todo: { icon: '📝', title: 'To-Do List' }
  }[currentEnv];

  // ==================== MAIN RENDER ====================

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {/* VIDEO FEED */}
      <video 
        ref={videoRef} 
        playsInline 
        muted 
        autoPlay
        style={{ 
          position: 'absolute', 
          inset: 0, 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        }} 
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 3D VISUALIZATION */}
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

      {/* ==================== TOP UI ==================== */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        
        {/* CAMERA SWITCH BUTTON */}
        <button 
          onClick={switchCamera}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 50, height: 50, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.6)',
            color: 'white', fontSize: 24, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
          🔄
        </button>

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
              }}>
              +
            </button>

            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0,0,0,0.9)',
              border: '3px solid #00ff00',
              color: '#00ff00', fontSize: 14, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0,255,0,0.3)'
            }}>
              {Math.round(zoomLevel * 100)}%
            </div>

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
              }}>
              −
            </button>

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
              }}>
              ⟲
            </button>
          </div>
        )}

        {/* TITLE BAR */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: detectedPerson 
            ? 'linear-gradient(135deg, #00b894, #00cec9)' 
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white', padding: '10px 20px', borderRadius: 25,
          fontSize: 14, fontWeight: 'bold',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{ fontSize: 20 }}>{envInfo.icon}</span>
          <span>{envInfo.title}</span>
          {detectedPerson && <span style={{ fontSize: 10, opacity: 0.8 }}>● LIVE</span>}
        </div>

        {/* ENVIRONMENT TABS */}
        {detectedPerson && (
          <div style={{
            position: 'absolute', top: 55, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 5, background: 'rgba(0,0,0,0.7)',
            padding: 5, borderRadius: 25, backdropFilter: 'blur(10px)'
          }}>
            {(['grocery', 'classroom', 'todo'] as Environment[]).map(env => (
              <button 
                key={env}
                onClick={() => !isAnimating && setCurrentEnv(env)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 'bold',
                  border: 'none', borderRadius: 20,
                  background: currentEnv === env 
                    ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                    : 'transparent',
                  color: 'white', cursor: 'pointer',
                  opacity: currentEnv === env ? 1 : 0.6,
                  transition: 'all 0.3s ease'
                }}>
                {env === 'grocery' ? '🛒 Shelf' : env === 'classroom' ? '🧑‍🤝‍🧑 Seats' : '📝 Tasks'}
              </button>
            ))}
          </div>
        )}

        {/* OPERATION MESSAGE */}
        {operationMessage && (
          <div style={{
            position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.9)', color: '#00ff00',
            padding: '10px 20px', borderRadius: 15, fontSize: 14, fontWeight: 'bold',
            border: '1px solid #00ff00', boxShadow: '0 0 20px rgba(0,255,0,0.3)'
          }}>
            ⚡ {operationMessage}
          </div>
        )}

        {/* CODE DISPLAY */}
        {codeDisplay && (
          <div style={{
            position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,30,0.95)', color: '#00ff00',
            padding: '10px 15px', borderRadius: 10, fontSize: 11,
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
            border: '1px solid #444', maxWidth: '90%',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}>
            {codeDisplay}
          </div>
        )}
      </div>

      {/* ==================== BOTTOM CONTROLS ==================== */}
      {detectedPerson && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '20px 10px', paddingBottom: 30,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {currentEnv === 'grocery' && (
              <>
                <OperationButton onClick={groceryAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OperationButton onClick={groceryInsert} disabled={isAnimating || groceryItems.length >= 6} color="#2ecc71" label="➕ Insert" />
                <OperationButton onClick={groceryDelete} disabled={isAnimating || groceryItems.length <= 2} color="#e74c3c" label="➖ Delete" />
              </>
            )}
            {currentEnv === 'classroom' && (
              <>
                <OperationButton onClick={studentAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OperationButton onClick={studentSwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
              </>
            )}
            {currentEnv === 'todo' && (
              <>
                <OperationButton onClick={todoAppend} disabled={isAnimating || tasks.length >= 6} color="#2ecc71" label="⏬ Append" />
                <OperationButton onClick={todoDelete} disabled={isAnimating || tasks.length <= 2} color="#e74c3c" label="✅ Done" />
              </>
            )}
          </div>
          
          <div style={{
            textAlign: 'center', marginTop: 10,
            color: 'rgba(255,255,255,0.7)', fontSize: 12
          }}>
            Length: {currentEnv === 'grocery' ? groceryItems.length : 
                     currentEnv === 'classroom' ? students.length : tasks.length}
          </div>
        </div>
      )}

      {/* ==================== SCANNING PROMPT ==================== */}
      {!detectedPerson && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: 'white',
          padding: '20px 30px', borderRadius: 20, fontSize: 16, textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animation: 'pulse 2s infinite'
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
          <div>Point camera at a person</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 5 }}>
            AR visualization will appear
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.8; transform: translateX(-50%) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

// ==================== OPERATION BUTTON COMPONENT ====================

function OperationButton({ onClick, disabled, color, label }: {
  onClick: () => void; disabled: boolean; color: string; label: string;
}) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      style={{
        padding: '14px 22px', fontSize: 14, fontWeight: 'bold',
        border: 'none', borderRadius: 25,
        background: disabled ? 'rgba(100,100,100,0.5)' : color,
        color: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, touchAction: 'manipulation',
        boxShadow: disabled ? 'none' : `0 4px 15px ${color}40`,
        transition: 'all 0.3s ease'
      }}>
      {label}
    </button>
  );
}

// ==================== 3D VISUALIZATION COMPONENT ====================

function ArrayVisualization3D({
  position, arrayData, highlightIndex, highlightIndex2, environment, zoomLevel, setZoomLevel
}: {
  position: Position;
  arrayData: ArrayDataItem[];
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
  const rotationRef = useRef({ x: 0.2, y: 0 });
  const zoomRef = useRef(zoomLevel);
  
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  const size = {
    width: Math.min(window.innerWidth - 20, 360),
    height: 200,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 360) / 2,
    y: position.y + position.height / 2 - 100
  };

  // ==================== CREATE 3D HUMAN ====================
  
  const createHuman3D = useCallback((
    appearance: HumanAppearance,
    name: string,
    isHighlighted: boolean,
    isHighlighted2: boolean
  ): THREE.Group => {
    const human = new THREE.Group();
    const highlightEmission = isHighlighted ? 0.5 : isHighlighted2 ? 0.3 : 0;
    
    // HEAD GROUP
    const headGroup = new THREE.Group();
    
    // Main head
    const headGeometry = new THREE.SphereGeometry(0.12, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: appearance.skinTone,
      emissive: isHighlighted ? '#ffff00' : isHighlighted2 ? '#ff00ff' : '#000000',
      emissiveIntensity: highlightEmission * 0.3
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    headGroup.add(head);
    
    // HAIR
    if (appearance.hairStyle !== 'bald') {
      const hairGeometry = appearance.hairStyle === 'long' 
        ? new THREE.SphereGeometry(0.125, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55)
        : new THREE.SphereGeometry(0.123, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      
      const hairMaterial = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
      const hair = new THREE.Mesh(hairGeometry, hairMaterial);
      hair.position.y = 0.02;
      headGroup.add(hair);
      
      if (appearance.hairStyle === 'long') {
        const backHairGeometry = new THREE.CapsuleGeometry(0.05, 0.15, 8, 16);
        const backHair = new THREE.Mesh(backHairGeometry, hairMaterial);
        backHair.position.set(0, -0.1, -0.06);
        headGroup.add(backHair);
      }
    }
    
    // EYES
    const eyeWhiteGeometry = new THREE.SphereGeometry(0.018, 16, 16);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const eyePupilGeometry = new THREE.SphereGeometry(0.008, 8, 8);
    const eyePupilMaterial = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    
    [-0.04, 0.04].forEach(xPos => {
      const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
      eyeWhite.position.set(xPos, 0.015, 0.095);
      eyeWhite.scale.set(1, 1, 0.5);
      headGroup.add(eyeWhite);
      
      const pupil = new THREE.Mesh(eyePupilGeometry, eyePupilMaterial);
      pupil.position.set(xPos, 0.015, 0.11);
      headGroup.add(pupil);
    });
    
    // EYEBROWS
    const eyebrowGeometry = new THREE.BoxGeometry(0.03, 0.006, 0.008);
    const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
    [-0.04, 0.04].forEach((xPos, i) => {
      const eyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
      eyebrow.position.set(xPos, 0.045, 0.1);
      eyebrow.rotation.z = i === 0 ? -0.1 : 0.1;
      headGroup.add(eyebrow);
    });
    
    // NOSE
    const noseGeometry = new THREE.ConeGeometry(0.012, 0.025, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, -0.01, 0.11);
    nose.rotation.x = Math.PI;
    headGroup.add(nose);
    
    // SMILE
    const smileGeometry = new THREE.TorusGeometry(0.025, 0.004, 8, 16, Math.PI);
    const smileMaterial = new THREE.MeshStandardMaterial({ color: '#c0392b' });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    smile.position.set(0, -0.045, 0.1);
    smile.rotation.x = Math.PI;
    headGroup.add(smile);
    
    // EARS
    const earGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const earMaterial = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-0.11, 0.11].forEach(xPos => {
      const ear = new THREE.Mesh(earGeometry, earMaterial);
      ear.position.set(xPos, 0, 0);
      ear.scale.set(0.5, 0.8, 0.6);
      headGroup.add(ear);
    });
    
    headGroup.position.y = 0.42;
    human.add(headGroup);
    
    // NECK
    const neckGeometry = new THREE.CylinderGeometry(0.03, 0.035, 0.05, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = 0.275;
    human.add(neck);
    
    // TORSO
    const torsoGeometry = new THREE.CylinderGeometry(0.09, 0.07, 0.2, 16);
    const torsoMaterial = new THREE.MeshStandardMaterial({ 
      color: appearance.shirtColor,
      emissive: isHighlighted ? '#ffff00' : isHighlighted2 ? '#ff00ff' : '#000000',
      emissiveIntensity: highlightEmission
    });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 0.15;
    human.add(torso);
    
    // ARMS
    const armGeometry = new THREE.CapsuleGeometry(0.018, 0.12, 8, 16);
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    
    [-1, 1].forEach(side => {
      const armGroup = new THREE.Group();
      
      const upperArm = new THREE.Mesh(armGeometry, sleeveMaterial);
      armGroup.add(upperArm);
      
      const lowerArmGeometry = new THREE.CapsuleGeometry(0.014, 0.08, 8, 16);
      const lowerArm = new THREE.Mesh(lowerArmGeometry, skinMaterial);
      lowerArm.position.y = -0.12;
      armGroup.add(lowerArm);
      
      const handGeometry = new THREE.SphereGeometry(0.022, 12, 12);
      const hand = new THREE.Mesh(handGeometry, skinMaterial);
      hand.position.y = -0.19;
      hand.scale.set(0.7, 0.9, 0.5);
      armGroup.add(hand);
      
      armGroup.position.set(side * 0.11, 0.15, 0);
      armGroup.rotation.z = side * 0.25;
      human.add(armGroup);
    });
    
    // HIPS
    const hipsGeometry = new THREE.CylinderGeometry(0.07, 0.065, 0.05, 16);
    const hipsMaterial = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    const hips = new THREE.Mesh(hipsGeometry, hipsMaterial);
    hips.position.y = 0.02;
    human.add(hips);
    
    // LEGS
    const legGeometry = new THREE.CapsuleGeometry(0.028, 0.14, 8, 16);
    const legMaterial = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    
    [-0.035, 0.035].forEach(xPos => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(xPos, -0.1, 0);
      human.add(leg);
    });
    
    // SHOES
    const shoeGeometry = new THREE.BoxGeometry(0.04, 0.02, 0.06);
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    
    [-0.035, 0.035].forEach(xPos => {
      const shoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
      shoe.position.set(xPos, -0.2, 0.01);
      human.add(shoe);
    });
    
    // NAME LABEL
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = isHighlighted ? '#ffff00' : isHighlighted2 ? '#ff00ff' : 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 15);
    ctx.fill();
    
    ctx.strokeStyle = isHighlighted || isHighlighted2 ? '#000' : '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(2, 2, 252, 60, 13);
    ctx.stroke();
    
    ctx.fillStyle = isHighlighted || isHighlighted2 ? '#000000' : '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
    
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
    const label = new THREE.Sprite(labelMaterial);
    label.position.y = 0.62;
    label.scale.set(0.45, 0.11, 1);
    human.add(label);
    
    // HIGHLIGHT RING
    if (isHighlighted || isHighlighted2) {
      const ringGeometry = new THREE.RingGeometry(0.1, 0.18, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: isHighlighted ? '#ffff00' : '#ff00ff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.y = -0.21;
      ring.rotation.x = -Math.PI / 2;
      human.add(ring);
    }
    
    return human;
  }, []);

  // CREATE BOX TEXTURE
  const createTexture = useCallback((
    label: string, bgColor: string, hl1: boolean, hl2: boolean, sub?: string
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = hl1 ? '#ffff00' : hl2 ? '#ff00ff' : bgColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
    
    ctx.fillStyle = hl1 || hl2 ? '#000' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = label.length <= 2 ? 'bold 48px Arial' : 'bold 22px Arial';
    ctx.fillText(label, 64, sub ? 50 : 64);
    
    if (sub) {
      ctx.font = '14px Arial';
      ctx.fillText(sub, 64, 95);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // CREATE CHAIR
  const createChair = useCallback((x: number): THREE.Group => {
    const chair = new THREE.Group();
    const woodMaterial = new THREE.MeshStandardMaterial({ color: '#8b4513' });
    
    const seatGeometry = new THREE.BoxGeometry(0.28, 0.03, 0.28);
    const seat = new THREE.Mesh(seatGeometry, woodMaterial);
    seat.position.y = -0.22;
    chair.add(seat);
    
    const backGeometry = new THREE.BoxGeometry(0.28, 0.2, 0.03);
    const back = new THREE.Mesh(backGeometry, woodMaterial);
    back.position.set(0, -0.1, -0.12);
    chair.add(back);
    
    const legGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
    [[-0.1, -0.32, 0.1], [0.1, -0.32, 0.1], [-0.1, -0.32, -0.1], [0.1, -0.32, -0.1]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeometry, woodMaterial);
      leg.position.set(lx, ly, lz);
      chair.add(leg);
    });
    
    chair.position.x = x;
    return chair;
  }, []);

  // INITIALIZE THREE.JS
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, 0.5, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

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

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      rotationRef.current.y += dx * 0.01;
      rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x + dy * 0.01));
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoomLevel(Math.max(0.5, Math.min(2.5, zoomRef.current + delta)));
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
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
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // UPDATE VISUALIZATION
  useEffect(() => {
    if (!groupRef.current) return;
    
    while (groupRef.current.children.length > 0) {
      const child = groupRef.current.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      groupRef.current.remove(child);
    }

    const spacing = environment === 'classroom' ? 0.8 : 0.95;
    const startX = -((arrayData.length - 1) * spacing) / 2;

    if (environment === 'classroom') {
      arrayData.forEach((item, i) => {
        const hl1 = highlightIndex === i;
        const hl2 = highlightIndex2 === i;
        
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.name || item.label, hl1, hl2);
          human.position.x = startX + i * spacing;
          human.position.y = hl1 || hl2 ? 0.1 : 0;
          human.scale.setScalar(0.85);
          groupRef.current!.add(human);
          
          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.85);
          groupRef.current!.add(chair);
        }
        
        const indexCanvas = document.createElement('canvas');
        indexCanvas.width = 64;
        indexCanvas.height = 32;
        const ctx = indexCanvas.getContext('2d')!;
        ctx.fillStyle = hl1 ? '#ffff00' : hl2 ? '#ff00ff' : '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`[${i}]`, 32, 16);
        
        const indexTexture = new THREE.CanvasTexture(indexCanvas);
        const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTexture, transparent: true }));
        indexSprite.position.set(startX + i * spacing, -0.5, 0);
        indexSprite.scale.set(0.3, 0.15, 1);
        groupRef.current!.add(indexSprite);
      });
    } else {
      const boxSize = 0.7;
      
      arrayData.forEach((item, i) => {
        const hl1 = highlightIndex === i;
        const hl2 = highlightIndex2 === i;
        
        const tex = createTexture(item.label, item.color, hl1, hl2, item.subLabel);
        const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
        const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const cube = new THREE.Mesh(geo, mat);
        cube.position.x = startX + i * spacing;
        cube.position.y = hl1 || hl2 ? 0.25 : 0;
        groupRef.current!.add(cube);

        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 32;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = hl1 ? '#ffff00' : hl2 ? '#ff00ff' : '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`[${i}]`, 32, 16);
        
        const t = new THREE.CanvasTexture(c);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
        s.position.set(startX + i * spacing, -0.55, 0);
        s.scale.set(0.4, 0.2, 1);
        groupRef.current!.add(s);
      });
      
      if (environment === 'grocery') {
        const shelfGeometry = new THREE.BoxGeometry(arrayData.length * spacing + 0.5, 0.05, 0.8);
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.y = -0.4;
        groupRef.current!.add(shelf);
      }
    }
  }, [arrayData, highlightIndex, highlightIndex2, environment, createHuman3D, createTexture, createChair]);

  // ✅ TRANSPARENT BACKGROUND - NO BOX
  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: Math.max(10, Math.min(size.x, window.innerWidth - size.width - 10)),
        top: Math.max(100, Math.min(size.y, window.innerHeight - size.height - 150)),
        width: size.width,
        height: size.height,
        zIndex: 50,
        touchAction: 'none'
      }}
    />
  );
}
