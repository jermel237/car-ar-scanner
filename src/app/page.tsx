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
type Operation = 'none' | 'access' | 'insert' | 'delete' | 'update' | 'shift';

// Data types for each environment
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
  
  // Environment state
  const [currentEnv, setCurrentEnv] = useState<Environment>('grocery');
  
  // Array states for each environment
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
  
  // Animation states
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [currentOperation, setCurrentOperation] = useState<Operation>('none');
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ==================== GROCERY SHELF OPERATIONS ====================
  
  const groceryAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('access');
    
    const index = Math.floor(Math.random() * groceryItems.length);
    
    setCodeDisplay(`shelf[${index}]`);
    setOperationMessage(`Accessing item at index ${index}...`);
    await delay(500);
    
    setHighlightIndex(index);
    setOperationMessage(`shelf[${index}] = "${groceryItems[index].name}"`);
    setCodeDisplay(`// Direct access O(1)\nitem = shelf[${index}];\n// Returns: ${groceryItems[index].name}`);
    
    await delay(2500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const groceryInsert = async () => {
    if (isAnimating || groceryItems.length >= 6) return;
    setIsAnimating(true);
    setCurrentOperation('insert');
    
    const newItems = ['Cheese', 'Butter', 'Yogurt', 'Ham', 'Bacon'];
    const colors = ['#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#795548'];
    const randomIdx = Math.floor(Math.random() * newItems.length);
    const insertIndex = Math.floor(Math.random() * (groceryItems.length + 1));
    
    setCodeDisplay(`// Insert at index ${insertIndex}\nshelf.insert(${insertIndex}, "${newItems[randomIdx]}");`);
    setOperationMessage(`Inserting "${newItems[randomIdx]}" at index ${insertIndex}...`);
    
    // Show shifting animation
    if (insertIndex < groceryItems.length) {
      setOperationMessage(`Shifting elements ${insertIndex} to ${groceryItems.length - 1} right...`);
      setCodeDisplay(`// Shift elements right O(n)\nfor(i=${groceryItems.length}; i>${insertIndex}; i--)\n  shelf[i] = shelf[i-1];`);
      
      for (let i = groceryItems.length - 1; i >= insertIndex; i--) {
        setHighlightIndex(i);
        await delay(400);
      }
    }
    
    await delay(300);
    setHighlightIndex(insertIndex);
    
    const newItem: GroceryItem = {
      id: Date.now(),
      name: newItems[randomIdx],
      color: colors[randomIdx]
    };
    
    setGroceryItems(prev => {
      const newArr = [...prev];
      newArr.splice(insertIndex, 0, newItem);
      return newArr;
    });
    
    setOperationMessage(`Inserted "${newItems[randomIdx]}" at index ${insertIndex}!`);
    setCodeDisplay(`// Insert complete\nshelf[${insertIndex}] = "${newItems[randomIdx]}";\n// Array length: ${groceryItems.length + 1}`);
    
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const groceryDelete = async () => {
    if (isAnimating || groceryItems.length <= 2) return;
    setIsAnimating(true);
    setCurrentOperation('delete');
    
    const deleteIndex = Math.floor(Math.random() * groceryItems.length);
    const deletedItem = groceryItems[deleteIndex];
    
    setHighlightIndex(deleteIndex);
    setCodeDisplay(`// Delete at index ${deleteIndex}\nshelf.delete(${deleteIndex});`);
    setOperationMessage(`Deleting "${deletedItem.name}" at index ${deleteIndex}...`);
    await delay(800);
    
    // Show shifting animation
    if (deleteIndex < groceryItems.length - 1) {
      setOperationMessage(`Shifting elements ${deleteIndex + 1} to ${groceryItems.length - 1} left...`);
      setCodeDisplay(`// Shift elements left O(n)\nfor(i=${deleteIndex}; i<${groceryItems.length - 1}; i++)\n  shelf[i] = shelf[i+1];`);
      
      for (let i = deleteIndex; i < groceryItems.length - 1; i++) {
        setHighlightIndex(i);
        setHighlightIndex2(i + 1);
        await delay(400);
      }
    }
    
    setGroceryItems(prev => prev.filter((_, i) => i !== deleteIndex));
    setOperationMessage(`Deleted "${deletedItem.name}"! Elements shifted left.`);
    setCodeDisplay(`// Delete complete\n// Array length: ${groceryItems.length - 1}`);
    
    await delay(2000);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // ==================== STUDENT SEATS OPERATIONS ====================
  
  const studentAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('access');
    
    const seatNumber = Math.floor(Math.random() * students.length);
    
    setCodeDisplay(`seats[${seatNumber}]`);
    setOperationMessage(`Finding student at seat ${seatNumber}...`);
    await delay(500);
    
    setHighlightIndex(seatNumber);
    setOperationMessage(`Seat ${seatNumber}: ${students[seatNumber].avatar} ${students[seatNumber].name}`);
    setCodeDisplay(`// Random access O(1)\nstudent = seats[${seatNumber}];\n// Returns: ${students[seatNumber].name}`);
    
    await delay(2500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const studentSwap = async () => {
    if (isAnimating || students.length < 2) return;
    setIsAnimating(true);
    setCurrentOperation('update');
    
    const idx1 = Math.floor(Math.random() * students.length);
    let idx2 = Math.floor(Math.random() * students.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * students.length);
    }
    
    setHighlightIndex(idx1);
    setHighlightIndex2(idx2);
    setCodeDisplay(`// Swap seats ${idx1} and ${idx2}\ntemp = seats[${idx1}];\nseats[${idx1}] = seats[${idx2}];\nseats[${idx2}] = temp;`);
    setOperationMessage(`Swapping ${students[idx1].name} (seat ${idx1}) ↔ ${students[idx2].name} (seat ${idx2})`);
    
    await delay(1500);
    
    setStudents(prev => {
      const newArr = [...prev];
      const temp = newArr[idx1];
      newArr[idx1] = newArr[idx2];
      newArr[idx2] = temp;
      return newArr;
    });
    
    setOperationMessage(`Swapped! ${students[idx2].name} now at seat ${idx1}, ${students[idx1].name} at seat ${idx2}`);
    setCodeDisplay(`// Swap complete O(1)\n// seats[${idx1}] = ${students[idx2].name}\n// seats[${idx2}] = ${students[idx1].name}`);
    
    await delay(2000);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const studentUpdate = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentOperation('update');
    
    const index = Math.floor(Math.random() * students.length);
    const newNames = ['Fay', 'Gus', 'Ivy', 'Joe', 'Kim'];
    const newAvatars = ['👱', '👴', '👶', '🧔', '👵'];
    const randIdx = Math.floor(Math.random() * newNames.length);
    
    setHighlightIndex(index);
    setCodeDisplay(`// Update seat ${index}\nseats[${index}] = new Student("${newNames[randIdx]}");`);
    setOperationMessage(`Updating seat ${index}: ${students[index].name} → ${newNames[randIdx]}`);
    
    await delay(1000);
    
    setStudents(prev => {
      const newArr = [...prev];
      newArr[index] = {
        id: Date.now(),
        name: newNames[randIdx],
        avatar: newAvatars[randIdx]
      };
      return newArr;
    });
    
    setOperationMessage(`Updated! Seat ${index} now has ${newNames[randIdx]}`);
    setCodeDisplay(`// Update complete O(1)\nseats[${index}].name = "${newNames[randIdx]}";`);
    
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // ==================== TO-DO LIST OPERATIONS ====================
  
  const todoAppend = async () => {
    if (isAnimating || tasks.length >= 6) return;
    setIsAnimating(true);
    setCurrentOperation('insert');
    
    const newTasks = ['Email', 'Call', 'Clean', 'Cook', 'Shop', 'Walk'];
    const priorities: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
    const randomTask = newTasks[Math.floor(Math.random() * newTasks.length)];
    const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
    
    setCodeDisplay(`// Append to end O(1)\ntasks.push("${randomTask}");`);
    setOperationMessage(`Appending "${randomTask}" to end of list...`);
    
    await delay(500);
    setHighlightIndex(tasks.length);
    
    setTasks(prev => [...prev, {
      id: Date.now(),
      text: randomTask,
      priority: randomPriority
    }]);
    
    setOperationMessage(`Appended "${randomTask}" at index ${tasks.length}!`);
    setCodeDisplay(`// Append complete O(1)\ntasks[${tasks.length}] = "${randomTask}";\n// No shifting needed!`);
    
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const todoInsertAt = async () => {
    if (isAnimating || tasks.length >= 6) return;
    setIsAnimating(true);
    setCurrentOperation('insert');
    
    const newTasks = ['Urgent', 'ASAP', 'Now'];
    const randomTask = newTasks[Math.floor(Math.random() * newTasks.length)];
    const insertIndex = Math.floor(Math.random() * tasks.length);
    
    setCodeDisplay(`// Insert at index ${insertIndex}\ntasks.insert(${insertIndex}, "${randomTask}");`);
    setOperationMessage(`Inserting "${randomTask}" at index ${insertIndex}...`);
    
    // Show shifting
    setOperationMessage(`Shifting tasks ${insertIndex} to ${tasks.length - 1} right...`);
    setCodeDisplay(`// Must shift elements O(n)\nfor(i=${tasks.length}; i>${insertIndex}; i--)\n  tasks[i] = tasks[i-1];`);
    
    for (let i = tasks.length - 1; i >= insertIndex; i--) {
      setHighlightIndex(i);
      await delay(400);
    }
    
    setHighlightIndex(insertIndex);
    
    setTasks(prev => {
      const newArr = [...prev];
      newArr.splice(insertIndex, 0, {
        id: Date.now(),
        text: randomTask,
        priority: 'high'
      });
      return newArr;
    });
    
    setOperationMessage(`Inserted "${randomTask}" at index ${insertIndex}! (Required shifting)`);
    setCodeDisplay(`// Insert at index costs O(n)\n// Had to shift ${tasks.length - insertIndex} elements`);
    
    await delay(2500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  const todoDelete = async () => {
    if (isAnimating || tasks.length <= 2) return;
    setIsAnimating(true);
    setCurrentOperation('delete');
    
    const deleteIndex = Math.floor(Math.random() * tasks.length);
    const deletedTask = tasks[deleteIndex];
    
    setHighlightIndex(deleteIndex);
    setCodeDisplay(`// Delete at index ${deleteIndex}\ntasks.remove(${deleteIndex});`);
    setOperationMessage(`Completing "${deletedTask.text}" at index ${deleteIndex}...`);
    
    await delay(800);
    
    if (deleteIndex < tasks.length - 1) {
      setOperationMessage(`Shifting tasks ${deleteIndex + 1} to ${tasks.length - 1} left...`);
      setCodeDisplay(`// Shift left O(n)\nfor(i=${deleteIndex}; i<${tasks.length - 1}; i++)\n  tasks[i] = tasks[i+1];`);
      
      for (let i = deleteIndex; i < tasks.length - 1; i++) {
        setHighlightIndex(i);
        setHighlightIndex2(i + 1);
        await delay(400);
      }
    }
    
    setTasks(prev => prev.filter((_, i) => i !== deleteIndex));
    setOperationMessage(`Completed "${deletedTask.text}"! Remaining tasks shifted.`);
    setCodeDisplay(`// Delete complete\n// Shifted ${tasks.length - 1 - deleteIndex} elements`);
    
    await delay(2000);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setCodeDisplay('');
    setCurrentOperation('none');
    setIsAnimating(false);
  };

  // Reset functions
  const resetGrocery = () => {
    if (isAnimating) return;
    setGroceryItems([
      { id: 1, name: 'Milk', color: '#3498db' },
      { id: 2, name: 'Bread', color: '#e67e22' },
      { id: 3, name: 'Eggs', color: '#f1c40f' },
      { id: 4, name: 'Apple', color: '#e74c3c' },
      { id: 5, name: 'Juice', color: '#9b59b6' },
    ]);
  };

  const resetStudents = () => {
    if (isAnimating) return;
    setStudents([
      { id: 1, name: 'Alex', avatar: '👦' },
      { id: 2, name: 'Beth', avatar: '👧' },
      { id: 3, name: 'Carl', avatar: '👨' },
      { id: 4, name: 'Dana', avatar: '👩' },
      { id: 5, name: 'Erik', avatar: '🧑' },
    ]);
  };

  const resetTasks = () => {
    if (isAnimating) return;
    setTasks([
      { id: 1, text: 'Study', priority: 'high' },
      { id: 2, text: 'Code', priority: 'high' },
      { id: 3, text: 'Read', priority: 'medium' },
      { id: 4, text: 'Rest', priority: 'low' },
    ]);
  };

  // Get current array data for visualization
  const getCurrentArrayData = () => {
    switch (currentEnv) {
      case 'grocery':
        return groceryItems.map(item => ({ label: item.name, color: item.color }));
      case 'classroom':
        return students.map(student => ({ label: student.avatar, color: '#3498db', subLabel: student.name }));
      case 'todo':
        return tasks.map(task => ({
          label: task.text,
          color: task.priority === 'high' ? '#e74c3c' : task.priority === 'medium' ? '#f39c12' : '#2ecc71'
        }));
      default:
        return [];
    }
  };

  const getEnvInfo = () => {
    switch (currentEnv) {
      case 'grocery':
        return { icon: '🛒', title: 'Grocery Shelf', surface: 'Table Surface' };
      case 'classroom':
        return { icon: '🪑', title: 'Student Seats', surface: 'Floor Section' };
      case 'todo':
        return { icon: '📝', title: 'To-Do List', surface: 'Desk Surface' };
    }
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
        <h2 style={{ marginTop: 30, fontSize: 24 }}>📊 Array Learning AR</h2>
        <p style={{ marginTop: 10, opacity: 0.7, fontSize: 16 }}>{loadingText}</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const envInfo = getEnvInfo();

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

      {/* 3D Array Visualization */}
      {personPosition && (
        <ArrayVisualization3D
          position={personPosition}
          arrayData={getCurrentArrayData()}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          environment={currentEnv}
        />
      )}

      {/* TOP UI */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 'env(safe-area-inset-top, 15px)',
        zIndex: 100
      }}>
        {/* Camera Switch */}
        <button
          onClick={switchCamera}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 15px) + 8px)',
            right: 10,
            width: 45,
            height: 45,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          🔄
        </button>

        {/* Environment Title */}
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 15px) + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: detectedPerson 
            ? 'linear-gradient(135deg, #00b894, #00cec9)'
            : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          {envInfo.icon} {envInfo.title}
        </div>

        {/* Surface Label */}
        {detectedPerson && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 15px) + 45px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#aaa',
            padding: '5px 12px',
            borderRadius: 10,
            fontSize: 11
          }}>
            {envInfo.surface}
          </div>
        )}

        {/* Environment Tabs */}
        {detectedPerson && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 15px) + 75px)',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            background: 'rgba(0,0,0,0.5)',
            padding: 4,
            borderRadius: 20
          }}>
            <EnvTab 
              active={currentEnv === 'grocery'}
              onClick={() => !isAnimating && setCurrentEnv('grocery')}
              icon="🛒"
              label="Shelf"
            />
            <EnvTab 
              active={currentEnv === 'classroom'}
              onClick={() => !isAnimating && setCurrentEnv('classroom')}
              icon="🪑"
              label="Seats"
            />
            <EnvTab 
              active={currentEnv === 'todo'}
              onClick={() => !isAnimating && setCurrentEnv('todo')}
              icon="📝"
              label="Tasks"
            />
          </div>
        )}

        {/* Operation Message */}
        {operationMessage && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 15px) + 115px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            color: '#00ff00',
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 'bold',
            maxWidth: '90%',
            textAlign: 'center'
          }}>
            {operationMessage}
          </div>
        )}

        {/* Code Display */}
        {codeDisplay && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 15px) + 150px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 30, 30, 0.95)',
            color: '#00ff00',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 10,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            maxWidth: '85%',
            border: '1px solid #333'
          }}>
            {codeDisplay}
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
          paddingBottom: 'calc(env(safe-area-inset-bottom, 15px) + 10px)',
          paddingTop: 10,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 70%, transparent 100%)',
          zIndex: 100
        }}>
          {/* Key Concepts */}
          <div style={{
            textAlign: 'center',
            marginBottom: 8,
            padding: '0 15px'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 10,
              display: 'inline-block'
            }}>
              {currentEnv === 'grocery' && '📚 Key: Linear indexing, shifting on insert/delete'}
              {currentEnv === 'classroom' && '📚 Key: Random access O(1), element swapping'}
              {currentEnv === 'todo' && '📚 Key: Append O(1) vs Insert O(n), shifting logic'}
            </div>
          </div>

          {/* Operation Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '0 10px',
            marginBottom: 8
          }}>
            {currentEnv === 'grocery' && (
              <>
                <OpButton onClick={groceryAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpButton onClick={groceryInsert} disabled={isAnimating || groceryItems.length >= 6} color="#2ecc71" label="➕ Insert" />
                <OpButton onClick={groceryDelete} disabled={isAnimating || groceryItems.length <= 2} color="#e74c3c" label="➖ Delete" />
                <OpButton onClick={resetGrocery} disabled={isAnimating} color="#7f8c8d" label="🔄" />
              </>
            )}
            
            {currentEnv === 'classroom' && (
              <>
                <OpButton onClick={studentAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpButton onClick={studentSwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
                <OpButton onClick={studentUpdate} disabled={isAnimating} color="#3498db" label="✏️ Update" />
                <OpButton onClick={resetStudents} disabled={isAnimating} color="#7f8c8d" label="🔄" />
              </>
            )}
            
            {currentEnv === 'todo' && (
              <>
                <OpButton onClick={todoAppend} disabled={isAnimating || tasks.length >= 6} color="#2ecc71" label="⏬ Append" />
                <OpButton onClick={todoInsertAt} disabled={isAnimating || tasks.length >= 6} color="#f39c12" label="📍 Insert" />
                <OpButton onClick={todoDelete} disabled={isAnimating || tasks.length <= 2} color="#e74c3c" label="✅ Done" />
                <OpButton onClick={resetTasks} disabled={isAnimating} color="#7f8c8d" label="🔄" />
              </>
            )}
          </div>

          {/* Array Display */}
          <div style={{
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#00ff00',
            background: 'rgba(0,0,0,0.5)',
            padding: '6px 12px',
            margin: '0 15px',
            borderRadius: 8
          }}>
            {currentEnv === 'grocery' && `shelf[${groceryItems.length}] = [${groceryItems.map(i => `"${i.name}"`).join(', ')}]`}
            {currentEnv === 'classroom' && `seats[${students.length}] = [${students.map(s => `"${s.name}"`).join(', ')}]`}
            {currentEnv === 'todo' && `tasks[${tasks.length}] = [${tasks.map(t => `"${t.text}"`).join(', ')}]`}
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
          
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: 15,
            fontSize: 14,
            textAlign: 'center'
          }}>
            📱 Point camera at a person to start learning!
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// Environment Tab Component
function EnvTab({ active, onClick, icon, label }: { 
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 15,
        background: active ? '#667eea' : 'transparent',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        opacity: active ? 1 : 0.7
      }}
    >
      {icon} {label}
    </button>
  );
}

// Operation Button Component
function OpButton({ onClick, disabled, color, label }: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        padding: '10px 14px',
        fontSize: 12,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 20,
        background: disabled ? '#444' : color,
        color: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        touchAction: 'manipulation'
      }}
    >
      {label}
    </button>
  );
}

// 3D Array Visualization Component
function ArrayVisualization3D({
  position,
  arrayData,
  highlightIndex,
  highlightIndex2,
  environment
}: {
  position: Position;
  arrayData: { label: string; color: string; subLabel?: string }[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  environment: Environment;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.25, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  const size = {
    width: Math.min(window.innerWidth - 20, 360),
    height: 160,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 360) / 2,
    y: position.y + position.height / 2 - 80
  };

  const createBoxTexture = (label: string, bgColor: string, isHighlighted: boolean, isHighlighted2: boolean, subLabel?: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Background
    if (isHighlighted) {
      ctx.fillStyle = '#ffff00';
    } else if (isHighlighted2) {
      ctx.fillStyle = '#ff00ff';
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(0, 0, 128, 128);

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 122, 122);

    // Text
    ctx.fillStyle = isHighlighted || isHighlighted2 ? '#000' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (label.length <= 2) {
      ctx.font = 'bold 50px Arial';
      ctx.fillText(label, 64, subLabel ? 50 : 64);
    } else {
      ctx.font = 'bold 28px Arial';
      ctx.fillText(label, 64, subLabel ? 50 : 64);
    }

    if (subLabel) {
      ctx.font = '18px Arial';
      ctx.fillText(subLabel, 64, 95);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const arrayGroup = new THREE.Group();
    groupRef.current = arrayGroup;
    scene.add(arrayGroup);

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

  // Update when array changes
  useEffect(() => {
    if (!groupRef.current) return;

    groupRef.current.clear();

    const boxSize = environment === 'classroom' ? 0.85 : 0.8;
    const spacing = environment === 'classroom' ? 1.0 : 0.95;
    const startX = -((arrayData.length - 1) * spacing) / 2;

    arrayData.forEach((item, index) => {
      const isHighlighted = highlightIndex === index;
      const isHighlighted2 = highlightIndex2 === index;
      const texture = createBoxTexture(item.label, item.color, isHighlighted, isHighlighted2, item.subLabel);

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.1,
        roughness: 0.5
      });

      const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
      const cube = new THREE.Mesh(geometry, material);

      cube.position.x = startX + index * spacing;
      cube.position.y = isHighlighted || isHighlighted2 ? 0.25 : 0;

      groupRef.current!.add(cube);

      // Index label
      const indexCanvas = document.createElement('canvas');
      indexCanvas.width = 64;
      indexCanvas.height = 32;
      const indexCtx = indexCanvas.getContext('2d')!;
      indexCtx.fillStyle = isHighlighted ? '#ffff00' : '#fff';
      indexCtx.font = 'bold 20px Arial';
      indexCtx.textAlign = 'center';
      indexCtx.textBaseline = 'middle';
      indexCtx.fillText(`[${index}]`, 32, 16);

      const indexTexture = new THREE.CanvasTexture(indexCanvas);
      const indexMaterial = new THREE.SpriteMaterial({ map: indexTexture, transparent: true });
      const indexSprite = new THREE.Sprite(indexMaterial);
      indexSprite.position.set(startX + index * spacing, -0.75, 0);
      indexSprite.scale.set(0.5, 0.25, 1);
      groupRef.current!.add(indexSprite);
    });
  }, [arrayData, highlightIndex, highlightIndex2, environment]);

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
    rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x));

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
        transition: 'left 0.15s, top 0.15s'
      }}
    />
  );
}
