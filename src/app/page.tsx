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

type DataStructure = 'array' | 'linkedlist' | 'stack' | 'queue';
type ArrayEnvironment = 'grocery' | 'classroom' | 'todo';
type LinkedListEnvironment = 'train' | 'people' | 'domino';
type StackEnvironment = 'books' | 'plates' | 'boxes';
type QueueEnvironment = 'tollgate' | 'tickets' | 'students';

interface HumanAppearance {
  skinTone: string;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  hairStyle: 'short' | 'long' | 'bald';
  gender: 'male' | 'female';
}

interface DataItem {
  id: number;
  label: string;
  color: string;
  appearance?: HumanAppearance;
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
  const [zoomLevel, setZoomLevel] = useState(1.0);
  
  const [currentStructure, setCurrentStructure] = useState<DataStructure>('array');
  const [arrayEnv, setArrayEnv] = useState<ArrayEnvironment>('grocery');
  const [linkedListEnv, setLinkedListEnv] = useState<LinkedListEnvironment>('train');
  const [stackEnv, setStackEnv] = useState<StackEnvironment>('books');
  const [queueEnv, setQueueEnv] = useState<QueueEnvironment>('tollgate');
  
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // ==================== ALL DATA ====================
  
  const [groceryItems, setGroceryItems] = useState<DataItem[]>([
    { id: 1, label: 'Milk', color: '#3498db' },
    { id: 2, label: 'Bread', color: '#e67e22' },
    { id: 3, label: 'Eggs', color: '#f1c40f' },
    { id: 4, label: 'Apple', color: '#e74c3c' },
    { id: 5, label: 'Juice', color: '#9b59b6' },
  ]);
  
  const [students, setStudents] = useState<DataItem[]>([
    { id: 1, label: 'Alex', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' }},
    { id: 2, label: 'Beth', color: '#e91e63', appearance: { skinTone: '#f5d0c5', shirtColor: '#e91e63', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' }},
    { id: 3, label: 'Carl', color: '#27ae60', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' }},
    { id: 4, label: 'Dana', color: '#f39c12', appearance: { skinTone: '#ffcd94', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' }},
  ]);
  
  const [tasks, setTasks] = useState<DataItem[]>([
    { id: 1, label: 'Study', color: '#e74c3c' },
    { id: 2, label: 'Code', color: '#e74c3c' },
    { id: 3, label: 'Read', color: '#f39c12' },
    { id: 4, label: 'Rest', color: '#2ecc71' },
  ]);

  const [trainCars, setTrainCars] = useState<DataItem[]>([
    { id: 1, label: 'Engine', color: '#e74c3c' },
    { id: 2, label: 'Coal', color: '#3498db' },
    { id: 3, label: 'Cargo', color: '#2ecc71' },
    { id: 4, label: 'Pass', color: '#9b59b6' },
  ]);

  const [peopleLine, setPeopleLine] = useState<DataItem[]>([
    { id: 1, label: 'Alice', color: '#e74c3c', appearance: { skinTone: '#ffdbac', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' }},
    { id: 2, label: 'Bob', color: '#3498db', appearance: { skinTone: '#8d5524', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' }},
    { id: 3, label: 'Carol', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' }},
  ]);

  const [dominoNodes, setDominoNodes] = useState<DataItem[]>([
    { id: 1, label: '1', color: '#ecf0f1' },
    { id: 2, label: '2', color: '#ecf0f1' },
    { id: 3, label: '3', color: '#ecf0f1' },
    { id: 4, label: '4', color: '#ecf0f1' },
  ]);

  const [bookStack, setBookStack] = useState<DataItem[]>([
    { id: 1, label: 'Math', color: '#3498db' },
    { id: 2, label: 'Science', color: '#2ecc71' },
    { id: 3, label: 'History', color: '#e67e22' },
  ]);

  const [plateStack, setPlateStack] = useState<DataItem[]>([
    { id: 1, label: 'Plate 1', color: '#ecf0f1' },
    { id: 2, label: 'Plate 2', color: '#bdc3c7' },
    { id: 3, label: 'Plate 3', color: '#95a5a6' },
  ]);

  const [boxStack, setBoxStack] = useState<DataItem[]>([
    { id: 1, label: 'Box A', color: '#e67e22' },
    { id: 2, label: 'Box B', color: '#d35400' },
    { id: 3, label: 'Box C', color: '#e74c3c' },
  ]);

  const [tollGate, setTollGate] = useState<DataItem[]>([
    { id: 1, label: 'Red', color: '#e74c3c' },
    { id: 2, label: 'Blue', color: '#3498db' },
    { id: 3, label: 'Green', color: '#2ecc71' },
  ]);

  const [ticketQueue, setTicketQueue] = useState<DataItem[]>([
    { id: 1, label: 'T-001', color: '#f39c12' },
    { id: 2, label: 'T-002', color: '#e74c3c' },
    { id: 3, label: 'T-003', color: '#9b59b6' },
  ]);

  const [studentQueue, setStudentQueue] = useState<DataItem[]>([
    { id: 1, label: 'Stu 1', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' }},
    { id: 2, label: 'Stu 2', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' }},
    { id: 3, label: 'Stu 3', color: '#9b59b6', appearance: { skinTone: '#8d5524', shirtColor: '#9b59b6', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' }},
  ]);

  // ==================== HELPERS ====================
  
  const zoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5)), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getArrayData = () => arrayEnv === 'grocery' ? groceryItems : arrayEnv === 'classroom' ? students : tasks;
  const setArrayData = arrayEnv === 'grocery' ? setGroceryItems : arrayEnv === 'classroom' ? setStudents : setTasks;
  const getLinkedListData = () => linkedListEnv === 'train' ? trainCars : linkedListEnv === 'people' ? peopleLine : dominoNodes;
  const setLinkedListData = linkedListEnv === 'train' ? setTrainCars : linkedListEnv === 'people' ? setPeopleLine : setDominoNodes;
  const getStackData = () => stackEnv === 'books' ? bookStack : stackEnv === 'plates' ? plateStack : boxStack;
  const setStackData = stackEnv === 'books' ? setBookStack : stackEnv === 'plates' ? setPlateStack : setBoxStack;
  const getQueueData = () => queueEnv === 'tollgate' ? tollGate : queueEnv === 'tickets' ? ticketQueue : studentQueue;
  const setQueueData = queueEnv === 'tollgate' ? setTollGate : queueEnv === 'tickets' ? setTicketQueue : setStudentQueue;
  const getCurrentData = () => currentStructure === 'array' ? getArrayData() : currentStructure === 'linkedlist' ? getLinkedListData() : currentStructure === 'stack' ? getStackData() : getQueueData();

  // ==================== CAMERA ====================

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await new Promise<void>((resolve) => { if (videoRef.current) { videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); }; } });
      }
      setStream(newStream);
    } catch (err) { throw new Error('Cannot access camera.'); }
  }, [stream]);

  const switchCamera = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    try { await startCamera(newFacing); } catch (err) { console.error(err); }
  };

  const loadModel = async () => {
    setLoadingText('Loading AI...');
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    await tf.setBackend('webgl');
    setLoadingText('Loading detector...');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    return await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('Starting camera...');
        await startCamera('environment');
        const loadedModel = await loadModel();
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err: any) { setError(err.message); setIsLoading(false); }
    };
    init();
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    let animationId: number, running = true, lastDetection = 0;
    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;
      const now = Date.now();
      if (now - lastDetection < 100) { animationId = requestAnimationFrame(detect); return; }
      lastDetection = now;
      const video = videoRef.current, canvas = canvasRef.current;
      if (video.readyState !== 4) { animationId = requestAnimationFrame(detect); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      try {
        const predictions = await model.detect(video);
        const humans = predictions.filter((p: any) => p.class === 'person' && p.score > 0.5);
        if (humans.length > 0) {
          const [x, y, width, height] = humans[0].bbox;
          const scaleX = window.innerWidth / canvas.width, scaleY = window.innerHeight / canvas.height;
          setDetectedPerson({ bbox: humans[0].bbox, class: humans[0].class, score: humans[0].score });
          setPersonPosition({ x: x * scaleX, y: y * scaleY, width: width * scaleX, height: height * scaleY });
        } else { setDetectedPerson(null); setPersonPosition(null); }
      } catch (e) { console.error(e); }
      if (running) animationId = requestAnimationFrame(detect);
    };
    detect();
    return () => { running = false; if (animationId) cancelAnimationFrame(animationId); };
  }, [model]);

  // ==================== OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData(), index = Math.floor(Math.random() * data.length);
    setHighlightIndex(index);
    setOperationMessage(`Accessing [${index}]: "${data[index].label}"`);
    setCodeDisplay(`// O(1) Access\narray[${index}] → "${data[index].label}"`);
    await delay(2000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating || getArrayData().length >= 6) return; setIsAnimating(true);
    const data = getArrayData(), insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(300); }
    (setArrayData as any)((prev: DataItem[]) => { const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' }); return arr; });
    setHighlightIndex(insertIndex); setOperationMessage(`Inserted!`); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return; setIsAnimating(true);
    const data = getArrayData(), deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]...`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    await delay(1000);
    (setArrayData as any)((prev: DataItem[]) => prev.filter((_, i) => i !== deleteIndex));
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData();
    const idx1 = Math.floor(Math.random() * data.length);
    let idx2 = Math.floor(Math.random() * data.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * data.length);
    setHighlightIndex(idx1); setHighlightIndex2(idx2);
    setOperationMessage(`Swapping [${idx1}] ↔ [${idx2}]`);
    setCodeDisplay(`// O(1) Swap`);
    await delay(1500);
    (setArrayData as any)((prev: DataItem[]) => { const arr = [...prev]; [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]; return arr; });
    await delay(1000);
    setHighlightIndex(null); setHighlightIndex2(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListInsertHead = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    setOperationMessage('Inserting at HEAD...');
    setCodeDisplay(`// O(1)\nnewNode.next = head\nhead = newNode`);
    await delay(1000);
    const newItem: DataItem = linkedListEnv === 'people' 
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' }}
      : { id: Date.now(), label: 'New', color: '#1abc9c' };
    (setLinkedListData as any)((prev: DataItem[]) => [newItem, ...prev]);
    setHighlightIndex(0); setOperationMessage('Inserted at HEAD!'); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    const data = getLinkedListData();
    setOperationMessage('Traversing to TAIL...');
    setCodeDisplay(`// O(n) Traverse`);
    for (let i = 0; i < data.length; i++) { setHighlightIndex(i); await delay(400); }
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' }}
      : { id: Date.now(), label: 'New', color: '#e74c3c' };
    (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length); setOperationMessage('Inserted at TAIL!'); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating || getLinkedListData().length <= 2) return; setIsAnimating(true);
    setHighlightIndex(0);
    setOperationMessage('Deleting HEAD...');
    setCodeDisplay(`// O(1)\nhead = head.next`);
    await delay(1500);
    (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getLinkedListData();
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Visiting: ${data[i].label}`);
      setCodeDisplay(`// Node ${i}\ncurr = curr.next`);
      await delay(600);
    }
    setOperationMessage(`Done! ${data.length} nodes`); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPush = async () => {
    if (isAnimating || getStackData().length >= 5) return; setIsAnimating(true);
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c'] : ['#7f8c8d'];
    const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] };
    setOperationMessage(`Pushing "${newItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.push("${newItem.label}")`);
    await delay(500);
    (setStackData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating || getStackData().length <= 1) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping "${topItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`);
    await delay(1500);
    (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating || getStackData().length === 0) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`TOP: "${topItem.label}"`);
    setCodeDisplay(`// O(1)\nstack.peek() → "${topItem.label}"`);
    await delay(2000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return; setIsAnimating(true);
    const data = getQueueData();
    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' }}
      : { id: Date.now(), label: queueEnv === 'tollgate' ? 'New Car' : `T-00${data.length + 1}`, color: '#1abc9c' };
    setOperationMessage(`Enqueue: "${newItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.enqueue("${newItem.label}")`);
    await delay(500);
    (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length); await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating || getQueueData().length <= 1) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`);
    await delay(1500);
    (setQueueData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`);
    await delay(2000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== RENDER ====================

  if (error) return <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}><div style={{ fontSize: 80 }}>📷</div><h2>Camera Access Needed</h2><button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white' }}>🔄 Try Again</button></div>;

  if (isLoading) return <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}><div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2><p>{loadingText}</p><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>;

  const currentEnvId = currentStructure === 'array' ? arrayEnv : currentStructure === 'linkedlist' ? linkedListEnv : currentStructure === 'stack' ? stackEnv : queueEnv;
  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv : currentStructure === 'linkedlist' ? setLinkedListEnv : currentStructure === 'stack' ? setStackEnv : setQueueEnv;
  const envTabs = currentStructure === 'array' ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist' ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
    : currentStructure === 'stack' ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
    : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {personPosition && <Visualization3D position={personPosition} data={getCurrentData()} highlightIndex={highlightIndex} highlightIndex2={highlightIndex2} structure={currentStructure} environment={currentEnvId} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24 }}>🔄</button>

        {detectedPerson && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={() => zoomIn()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={() => zoomOut()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={() => resetZoom()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
            <button key={s} onClick={() => !isAnimating && setCurrentStructure(s)} style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]} {currentStructure === s && { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
            </button>
          ))}
        </div>

        {detectedPerson && (
          <div style={{ position: 'absolute', top: 55, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as any)(e.id)} style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        )}

        {operationMessage && <div style={{ position: 'absolute', top: 95, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px', borderRadius: 15, fontSize: 14, border: '1px solid #0f0' }}>⚡ {operationMessage}</div>}
        {codeDisplay && <div style={{ position: 'absolute', top: 135, left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444' }}>{codeDisplay}</div>}
      </div>

      {detectedPerson && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (<><OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" /><OpBtn onClick={arrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Insert" /><OpBtn onClick={arrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="➖ Delete" /><OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" /></>)}
            {currentStructure === 'linkedlist' && (<><OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" /><OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" /><OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" /><OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" /></>)}
            {currentStructure === 'stack' && (<><OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" /><OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" /><OpBtn onClick={stackPeek} disabled={isAnimating} color="#f39c12" label="👁️ Peek" /></>)}
            {currentStructure === 'queue' && (<><OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" /><OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" /><OpBtn onClick={queueFront} disabled={isAnimating} color="#f39c12" label="👁️ Front" /></>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Size: {getCurrentData().length}</div>
        </div>
      )}

      {!detectedPerson && <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}><div style={{ fontSize: 40 }}>📱</div><div>Point camera at a person</div></div>}
    </div>
  );
}

function OpBtn({ onClick, disabled, color, label }: { onClick: () => void; disabled: boolean; color: string; label: string }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25, background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1 }}>{label}</button>;
}

// ==================== 3D VISUALIZATION COMPONENT ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel }: {
  position: Position;
  data: DataItem[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  structure: DataStructure;
  environment: string;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const size = {
    width: Math.min(window.innerWidth - 20, 380),
    height: structure === 'stack' ? 300 : 220,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 380) / 2,
    y: position.y + position.height / 2 - (structure === 'stack' ? 150 : 110)
  };

  // ==================== 3D MODEL: GROCERY BOX ====================
  const createGroceryBox = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    
    // Main cardboard box
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.55, 0.32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      emissive: isHighlighted ? '#ffff00' : '#000000',
      emissiveIntensity: isHighlighted ? 0.4 : 0
    });
    box.add(new THREE.Mesh(bodyGeo, bodyMat));
    
    // Top flaps
    const flapGeo = new THREE.BoxGeometry(0.22, 0.02, 0.32);
    const flapMat = new THREE.MeshStandardMaterial({ color: color });
    const leftFlap = new THREE.Mesh(flapGeo, flapMat);
    leftFlap.position.set(-0.12, 0.28, 0);
    leftFlap.rotation.z = -0.4;
    box.add(leftFlap);
    const rightFlap = new THREE.Mesh(flapGeo, flapMat);
    rightFlap.position.set(0.12, 0.28, 0);
    rightFlap.rotation.z = 0.4;
    box.add(rightFlap);
    
    // Label sticker
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 5, 118, 70);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 118, 70);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, 64, 50);
    
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.22),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
    );
    labelMesh.position.z = 0.165;
    box.add(labelMesh);
    
    // Highlight glow
    if (isHighlighted) {
      const glowGeo = new THREE.BoxGeometry(0.5, 0.6, 0.37);
      const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
      box.add(new THREE.Mesh(glowGeo, glowMat));
    }
    
    return box;
  }, []);

  // ==================== 3D MODEL: HUMAN ====================
  const createHuman3D = useCallback((appearance: HumanAppearance, name: string, isHighlighted: boolean): THREE.Group => {
    const human = new THREE.Group();
    const hlEmit = isHighlighted ? 0.4 : 0;
    
    // HEAD
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.09, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: appearance.skinTone,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: hlEmit * 0.3
    });
    headGroup.add(new THREE.Mesh(headGeo, headMat));
    
    // Hair
    if (appearance.hairStyle !== 'bald') {
      const hairGeo = appearance.hairStyle === 'long'
        ? new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55)
        : new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.y = 0.015;
      headGroup.add(hair);
      
      if (appearance.hairStyle === 'long') {
        const backHairGeo = new THREE.CapsuleGeometry(0.035, 0.1, 8, 16);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, -0.07, -0.04);
        headGroup.add(backHair);
      }
    }
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#fff' });
    const pupilGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    
    [-0.028, 0.028].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      eye.position.set(x, 0.01, 0.075);
      eye.scale.z = 0.5;
      headGroup.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(x, 0.01, 0.085);
      headGroup.add(pupil);
    });
    
    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.025, 0.005, 0.005);
    const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
    [-0.028, 0.028].forEach((x, i) => {
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(x, 0.035, 0.075);
      brow.rotation.z = i === 0 ? -0.1 : 0.1;
      headGroup.add(brow);
    });
    
    // Nose
    const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, -0.005, 0.085);
    nose.rotation.x = Math.PI;
    headGroup.add(nose);
    
    // Smile
    const smileGeo = new THREE.TorusGeometry(0.018, 0.003, 8, 16, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({ color: '#c0392b' });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, -0.035, 0.075);
    smile.rotation.x = Math.PI;
    headGroup.add(smile);
    
    // Ears
    const earGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-0.085, 0.085].forEach(x => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(x, 0, 0);
      ear.scale.set(0.5, 0.8, 0.6);
      headGroup.add(ear);
    });
    
    headGroup.position.y = 0.32;
    human.add(headGroup);
    
    // NECK
    const neckGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.04, 16);
    const neckMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 0.21;
    human.add(neck);
    
    // TORSO
    const torsoGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: appearance.shirtColor,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: hlEmit
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.11;
    human.add(torso);
    
    // ARMS
    const armGeo = new THREE.CapsuleGeometry(0.014, 0.09, 8, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
    const skinArmMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    
    [-1, 1].forEach(side => {
      const armGroup = new THREE.Group();
      const upperArm = new THREE.Mesh(armGeo, armMat);
      armGroup.add(upperArm);
      
      const lowerArmGeo = new THREE.CapsuleGeometry(0.011, 0.06, 8, 16);
      const lowerArm = new THREE.Mesh(lowerArmGeo, skinArmMat);
      lowerArm.position.y = -0.09;
      armGroup.add(lowerArm);
      
      const handGeo = new THREE.SphereGeometry(0.018, 12, 12);
      const hand = new THREE.Mesh(handGeo, skinArmMat);
      hand.position.y = -0.14;
      hand.scale.set(0.7, 0.9, 0.5);
      armGroup.add(hand);
      
      armGroup.position.set(side * 0.085, 0.1, 0);
      armGroup.rotation.z = side * 0.2;
      human.add(armGroup);
    });
    
    // HIPS
    const hipsGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.04, 16);
    const hipsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    const hips = new THREE.Mesh(hipsGeo, hipsMat);
    hips.position.y = 0.01;
    human.add(hips);
    
    // LEGS
    const legGeo = new THREE.CapsuleGeometry(0.02, 0.1, 8, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    
    [-0.028, 0.028].forEach(x => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, -0.07, 0);
      human.add(leg);
    });
    
    // SHOES
    const shoeGeo = new THREE.BoxGeometry(0.032, 0.015, 0.045);
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    
    [-0.028, 0.028].forEach(x => {
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(x, -0.135, 0.008);
      human.add(shoe);
    });
    
    // NAME LABEL
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isHighlighted ? '#ffff00' : 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 128, 32, 8);
    ctx.fill();
    ctx.fillStyle = isHighlighted ? '#000' : '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, 64, 22);
    
    const labelTex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    label.position.y = 0.48;
    label.scale.set(0.32, 0.08, 1);
    human.add(label);
    
    // HIGHLIGHT RING
    if (isHighlighted) {
      const ringGeo = new THREE.RingGeometry(0.07, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = -0.14;
      ring.rotation.x = -Math.PI / 2;
      human.add(ring);
    }
    
    return human;
  }, []);

  // ==================== 3D MODEL: CLIPBOARD (TODO) ====================
  const createClipboard = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const clipboard = new THREE.Group();
    
    // Wooden board
    const boardGeo = new THREE.BoxGeometry(0.38, 0.5, 0.025);
    const boardMat = new THREE.MeshStandardMaterial({
      color: '#8b4513',
      roughness: 0.7,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.3 : 0
    });
    clipboard.add(new THREE.Mesh(boardGeo, boardMat));
    
    // Metal clip
    const clipGeo = new THREE.BoxGeometry(0.12, 0.05, 0.04);
    const clipMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.8 });
    const clip = new THREE.Mesh(clipGeo, clipMat);
    clip.position.set(0, 0.27, 0.025);
    clipboard.add(clip);
    
    // Paper
    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = 128; paperCanvas.height = 180;
    const pctx = paperCanvas.getContext('2d')!;
    
    // White paper
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, 128, 180);
    
    // Priority color header
    pctx.fillStyle = color;
    pctx.fillRect(0, 0, 128, 30);
    
    // Task text
    pctx.fillStyle = '#ffffff';
    pctx.font = 'bold 16px Arial';
    pctx.textAlign = 'center';
    pctx.fillText(label, 64, 22);
    
    // Lines on paper
    pctx.strokeStyle = '#e0e0e0';
    pctx.lineWidth = 1;
    for (let y = 50; y < 170; y += 18) {
      pctx.beginPath();
      pctx.moveTo(10, y);
      pctx.lineTo(118, y);
      pctx.stroke();
    }
    
    // Checkbox
    pctx.strokeStyle = '#333';
    pctx.lineWidth = 2;
    pctx.strokeRect(12, 55, 14, 14);
    
    if (isHighlighted) {
      pctx.strokeStyle = '#2ecc71';
      pctx.lineWidth = 3;
      pctx.beginPath();
      pctx.moveTo(14, 62);
      pctx.lineTo(19, 67);
      pctx.lineTo(26, 57);
      pctx.stroke();
    }
    
    const paperTex = new THREE.CanvasTexture(paperCanvas);
    const paperGeo = new THREE.PlaneGeometry(0.34, 0.45);
    const paperMat = new THREE.MeshBasicMaterial({ map: paperTex });
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.z = 0.015;
    clipboard.add(paper);
    
    return clipboard;
  }, []);

  // ==================== 3D MODEL: TRAIN CAR ====================
  const createTrainCar = useCallback((isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const train = new THREE.Group();
    
    // Main body
    const bodyGeo = new THREE.BoxGeometry(0.65, 0.32, 0.28);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.7,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.4 : 0
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.1;
    train.add(body);
    
    // Roof
    const roofGeo = new THREE.BoxGeometry(0.6, 0.05, 0.26);
    const roofMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 0.285;
    train.add(roof);
    
    // Undercarriage
    const underGeo = new THREE.BoxGeometry(0.6, 0.04, 0.22);
    const underMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const under = new THREE.Mesh(underGeo, underMat);
    under.position.y = -0.08;
    train.add(under);
    
    // Wheels (4)
    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const wheelPositions = [[-0.2, -0.06, 0.14], [0.2, -0.06, 0.14], [-0.2, -0.06, -0.14], [0.2, -0.06, -0.14]];
    
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, y, z);
      train.add(wheel);
      
      // Wheel hub
      const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
      const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, y, z);
      train.add(hub);
    });
    
    // Windows
    if (!isEngine) {
      const windowGeo = new THREE.PlaneGeometry(0.08, 0.07);
      const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.3 });
      
      [-0.18, 0, 0.18].forEach(x => {
        const wFront = new THREE.Mesh(windowGeo, windowMat);
        wFront.position.set(x, 0.15, 0.141);
        train.add(wFront);
        const wBack = new THREE.Mesh(windowGeo, windowMat);
        wBack.position.set(x, 0.15, -0.141);
        train.add(wBack);
      });
    }
    
    // Engine-specific parts
    if (isEngine) {
      // Front boiler
      const boilerGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.22, 20);
      const boilerMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.4 });
      const boiler = new THREE.Mesh(boilerGeo, boilerMat);
      boiler.rotation.z = Math.PI / 2;
      boiler.position.set(0.44, 0.1, 0);
      train.add(boiler);
      
      // Chimney
      const chimneyGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12);
      const chimneyMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
      chimney.position.set(0.15, 0.38, 0);
      train.add(chimney);
      
      // Smoke puffs
      const smokeGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.5 });
      [0.48, 0.55, 0.63].forEach((y, i) => {
        const smoke = new THREE.Mesh(smokeGeo, smokeMat);
        smoke.position.set(0.15, y, 0);
        smoke.scale.setScalar(1 + i * 0.25);
        train.add(smoke);
      });
      
      // Cow catcher
      const catcherGeo = new THREE.BoxGeometry(0.04, 0.08, 0.22);
      const catcherMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
      const catcher = new THREE.Mesh(catcherGeo, catcherMat);
      catcher.position.set(0.55, -0.02, 0);
      train.add(catcher);
    }
    
    // Connector hooks
    const hookGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
    const hookMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
    [-0.34, 0.34].forEach(x => {
      const hook = new THREE.Mesh(hookGeo, hookMat);
      hook.position.set(x, 0, 0);
      train.add(hook);
    });
    
    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isHighlighted ? '#ffff00' : '#fff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, 64, 24);
    
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.y = 0.45;
    labelSprite.scale.set(0.4, 0.1, 1);
    train.add(labelSprite);
    
    return train;
  }, []);

  // ==================== 3D MODEL: DOMINO ====================
  const createDomino = useCallback((value: string, isHighlighted: boolean): THREE.Group => {
    const domino = new THREE.Group();
    
    // Main tile
    const tileGeo = new THREE.BoxGeometry(0.22, 0.45, 0.06);
    const tileMat = new THREE.MeshStandardMaterial({
      color: isHighlighted ? '#1abc9c' : '#ecf0f1',
      emissive: isHighlighted ? '#1abc9c' : '#000',
      emissiveIntensity: isHighlighted ? 0.3 : 0
    });
    domino.add(new THREE.Mesh(tileGeo, tileMat));
    
    // Center divider line
    const lineGeo = new THREE.BoxGeometry(0.18, 0.008, 0.01);
    const lineMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.z = 0.031;
    domino.add(line);
    
    // Border
    const borderGeo = new THREE.BoxGeometry(0.23, 0.46, 0.02);
    const borderMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.z = -0.025;
    domino.add(border);
    
    // Dots
    const dotGeo = new THREE.CircleGeometry(0.018, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#2c3e50', side: THREE.DoubleSide });
    const val = parseInt(value) || 1;
    
    // Top half dots
    const topDotPositions: [number, number][] = [];
    if (val >= 1) topDotPositions.push([0, 0.14]);
    if (val >= 2) topDotPositions.push([-0.05, 0.2]);
    if (val >= 3) topDotPositions.push([0.05, 0.08]);
    
    topDotPositions.forEach(([x, y]) => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, y, 0.032);
      domino.add(dot);
    });
    
    // Bottom half dots (mirror of top)
    topDotPositions.forEach(([x, y]) => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(-x, -y, 0.032);
      domino.add(dot);
    });
    
    // Glow effect
    if (isHighlighted) {
      const glowGeo = new THREE.BoxGeometry(0.26, 0.49, 0.02);
      const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.3 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.z = -0.04;
      domino.add(glow);
    }
    
    return domino;
  }, []);

  // ==================== 3D MODEL: BOOK ====================
  const createBook = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const book = new THREE.Group();
    
    // Book cover
    const coverGeo = new THREE.BoxGeometry(0.55, 0.07, 0.38);
    const coverMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.6,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    book.add(new THREE.Mesh(coverGeo, coverMat));
    
    // Pages (slightly inset)
    const pagesGeo = new THREE.BoxGeometry(0.52, 0.055, 0.35);
    const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc' });
    const pages = new THREE.Mesh(pagesGeo, pagesMat);
    pages.position.x = 0.01;
    book.add(pages);
    
    // Spine
    const spineGeo = new THREE.BoxGeometry(0.02, 0.07, 0.38);
    const spineMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.x = -0.285;
    book.add(spine);
    
    // Gold text on spine
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffd700';
    ctx.save();
    ctx.translate(16, 64);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 6);
    ctx.restore();
    
    const spineTex = new THREE.CanvasTexture(canvas);
    const spineLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.32),
      new THREE.MeshBasicMaterial({ map: spineTex, transparent: true })
    );
    spineLabel.position.set(-0.296, 0, 0);
    spineLabel.rotation.y = -Math.PI / 2;
    book.add(spineLabel);
    
    // Cover title
    const coverCanvas = document.createElement('canvas');
    coverCanvas.width = 128; coverCanvas.height = 128;
    const cctx = coverCanvas.getContext('2d')!;
    cctx.fillStyle = '#ffd700';
    cctx.font = 'bold 24px serif';
    cctx.textAlign = 'center';
    cctx.fillText(label, 64, 70);
    
    const coverTex = new THREE.CanvasTexture(coverCanvas);
    const coverLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.25),
      new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
    );
    coverLabel.position.y = 0.036;
    coverLabel.rotation.x = -Math.PI / 2;
    book.add(coverLabel);
    
    return book;
  }, []);

  // ==================== 3D MODEL: PLATE ====================
  const createPlate = useCallback((label: string, isHighlighted: boolean): THREE.Group => {
    const plate = new THREE.Group();
    
    // Main plate (cylinder)
    const plateGeo = new THREE.CylinderGeometry(0.28, 0.26, 0.025, 32);
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#ecf0f1',
      roughness: 0.3,
      metalness: 0.1,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.25 : 0
    });
    plate.add(new THREE.Mesh(plateGeo, plateMat));
    
    // Rim
    const rimGeo = new THREE.TorusGeometry(0.27, 0.012, 16, 32);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#bdc3c7' });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.012;
    plate.add(rim);
    
    // Inner decorative ring
    const innerRingGeo = new THREE.RingGeometry(0.12, 0.16, 32);
    const innerRingMat = new THREE.MeshStandardMaterial({ color: '#3498db', side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.014;
    plate.add(innerRing);
    
    // Center pattern
    const centerGeo = new THREE.CircleGeometry(0.06, 32);
    const centerMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.015;
    plate.add(center);
    
    return plate;
  }, []);

  // ==================== 3D MODEL: CARDBOARD BOX ====================
  const createCardboardBox = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    
    // Main box body
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.9,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    box.add(new THREE.Mesh(bodyGeo, bodyMat));
    
    // Tape on top
    const tapeGeo = new THREE.BoxGeometry(0.08, 0.01, 0.42);
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574' });
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = 0.18;
    box.add(tape);
    
    // Box edges (darker lines)
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
    
    // Vertical edges
    const vEdgeGeo = new THREE.BoxGeometry(0.01, 0.35, 0.01);
    [[-0.245, 0, 0.195], [0.245, 0, 0.195], [-0.245, 0, -0.195], [0.245, 0, -0.195]].forEach(([x, y, z]) => {
      const edge = new THREE.Mesh(vEdgeGeo, edgeMat);
      edge.position.set(x, y, z);
      box.add(edge);
    });
    
    // Shipping label
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 80);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 124, 76);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(5, 5, 118, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('FRAGILE', 64, 20);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(label, 64, 55);
    
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.22),
      new THREE.MeshBasicMaterial({ map: labelTex })
    );
    labelMesh.position.z = 0.201;
    box.add(labelMesh);
    
    return box;
  }, []);

  // ==================== 3D MODEL: CAR ====================
  const createCar = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const car = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.18, 0.28);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.6,
      roughness: 0.4,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.08;
    car.add(body);
    
    // Cabin/roof
    const cabinGeo = new THREE.BoxGeometry(0.3, 0.12, 0.24);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(-0.05, 0.22, 0);
    car.add(cabin);
    
    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(0.24, 0.1);
    const windshieldMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.3, side: THREE.DoubleSide });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0.1, 0.22, 0);
    windshield.rotation.y = Math.PI / 2;
    windshield.rotation.z = 0.2;
    car.add(windshield);
    
    // Rear window
    const rearWindow = new THREE.Mesh(windshieldGeo, windshieldMat);
    rearWindow.position.set(-0.2, 0.22, 0);
    rearWindow.rotation.y = Math.PI / 2;
    rearWindow.rotation.z = -0.2;
    car.add(rearWindow);
    
    // Side windows
    const sideWindowGeo = new THREE.PlaneGeometry(0.18, 0.08);
    [-1, 1].forEach(side => {
      const sideWindow = new THREE.Mesh(sideWindowGeo, windshieldMat);
      sideWindow.position.set(-0.05, 0.22, side * 0.121);
      car.add(sideWindow);
    });
    
    // Wheels (4)
    const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
    
    [[-0.18, -0.02, 0.14], [0.18, -0.02, 0.14], [-0.18, -0.02, -0.14], [0.18, -0.02, -0.14]].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, y, z);
      car.add(wheel);
      
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, y, z);
      car.add(hub);
    });
    
    // Headlights
    const lightGeo = new THREE.CircleGeometry(0.025, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    [-0.08, 0.08].forEach(z => {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(0.276, 0.08, z);
      light.rotation.y = Math.PI / 2;
      car.add(light);
    });
    
    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    [-0.08, 0.08].forEach(z => {
      const tail = new THREE.Mesh(lightGeo, tailMat);
      tail.position.set(-0.276, 0.08, z);
      tail.rotation.y = -Math.PI / 2;
      car.add(tail);
    });
    
    // License plate
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 64; plateCanvas.height = 24;
    const pctx = plateCanvas.getContext('2d')!;
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, 64, 24);
    pctx.fillStyle = '#000';
    pctx.font = 'bold 12px Arial';
    pctx.textAlign = 'center';
    pctx.fillText(label, 32, 17);
    
    const plateTex = new THREE.CanvasTexture(plateCanvas);
    const plateMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.04),
      new THREE.MeshBasicMaterial({ map: plateTex })
    );
    plateMesh.position.set(-0.276, 0.02, 0);
    plateMesh.rotation.y = -Math.PI / 2;
    car.add(plateMesh);
    
    return car;
  }, []);

  // ==================== 3D MODEL: TICKET ====================
  const createTicket = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const ticket = new THREE.Group();
    
    // Main ticket body
    const ticketGeo = new THREE.BoxGeometry(0.4, 0.22, 0.01);
    const ticketMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    ticket.add(new THREE.Mesh(ticketGeo, ticketMat));
    
    // Stub section (perforated)
    const stubGeo = new THREE.BoxGeometry(0.1, 0.22, 0.01);
    const stubMat = new THREE.MeshStandardMaterial({ color: color });
    const stub = new THREE.Mesh(stubGeo, stubMat);
    stub.position.x = 0.25;
    ticket.add(stub);
    
    // Perforation line (dots)
    const dotGeo = new THREE.CircleGeometry(0.005, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
    for (let y = -0.1; y <= 0.1; y += 0.02) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(0.195, y, 0.006);
      ticket.add(dot);
    }
    
    // Ticket content
    const canvas = document.createElement('canvas');
    canvas.width = 180; canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    
    // Background pattern
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 180; i += 10) {
      ctx.fillRect(i, 0, 5, 100);
    }
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ADMIT ONE', 70, 25);
    ctx.font = 'bold 28px Arial';
    ctx.fillText(label, 70, 60);
    ctx.font = '12px Arial';
    ctx.fillText('⭐ VIP ⭐', 70, 85);
    
    // Stub number
    ctx.font = 'bold 14px Arial';
    ctx.save();
    ctx.translate(155, 50);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
    
    const ticketTex = new THREE.CanvasTexture(canvas);
    const ticketLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.2),
      new THREE.MeshBasicMaterial({ map: ticketTex, transparent: true })
    );
    ticketLabel.position.z = 0.006;
    ticket.add(ticketLabel);
    
    return ticket;
  }, []);

  // ==================== 3D MODEL: CHAIR (for classroom) ====================
  const createChair = useCallback((x: number): THREE.Group => {
    const chair = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
    
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.22, 0.025, 0.22);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = -0.18;
    chair.add(seat);
    
    // Back
    const backGeo = new THREE.BoxGeometry(0.22, 0.18, 0.02);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, -0.08, -0.1);
    chair.add(back);
    
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
    [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, ly, lz);
      chair.add(leg);
    });
    
    chair.position.x = x;
    return chair;
  }, []);

  // ==================== CREATE POINTER ARROW ====================
  const createArrow = useCallback((fromX: number, toX: number, isHighlighted: boolean): THREE.Group => {
    const arrow = new THREE.Group();
    const color = isHighlighted ? 0xffff00 : 0x00ff00;
    
    // Line
    const points = [new THREE.Vector3(fromX + 0.35, 0, 0), new THREE.Vector3(toX - 0.35, 0, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color });
    arrow.add(new THREE.Line(lineGeo, lineMat));
    
    // Arrowhead
    const coneGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
    const coneMat = new THREE.MeshBasicMaterial({ color });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(toX - 0.4, 0, 0);
    cone.rotation.z = -Math.PI / 2;
    arrow.add(cone);
    
    return arrow;
  }, []);

  // ==================== INITIALIZE THREE.JS ====================
  
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.2 : 0.5, structure === 'stack' ? 5 : 4.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    const fillLight = new THREE.PointLight(0xffffff, 0.3);
    fillLight.position.set(0, -3, 3);
    scene.add(fillLight);

    // Group for all objects
    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // ==================== TOUCH/MOUSE CONTROLS ====================
    
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let pinchDist: number | null = null;
    let pinchZoom = 1;

    const getDistance = (t: TouchList): number | null => {
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
        rotationRef.current.x = Math.max(-0.6, Math.min(0.6, rotationRef.current.x + dy * 0.008));
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
      rotationRef.current.x = Math.max(-0.6, Math.min(0.6, rotationRef.current.x + dy * 0.008));
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      setZoomLevel(Math.max(0.5, Math.min(2.5, zoomRef.current + delta)));
    };

    // Add event listeners
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // ==================== ANIMATION LOOP ====================
    
    let animationId: number;
    const animate = () => {
      if (groupRef.current) {
        groupRef.current.rotation.x = rotationRef.current.x;
        groupRef.current.rotation.y = rotationRef.current.y;
        groupRef.current.scale.setScalar(zoomRef.current);
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    // ==================== CLEANUP ====================
    
    return () => {
      cancelAnimationFrame(animationId);
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
  }, [structure, size.width, size.height]);

  // ==================== UPDATE SCENE WITH 3D MODELS ====================
  
  useEffect(() => {
    if (!groupRef.current) return;

    // Clear previous objects
    while (groupRef.current.children.length > 0) {
      const child = groupRef.current.children[0];
      groupRef.current.remove(child);
    }

    const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 0.9 : 0.85;
    const startX = -((data.length - 1) * spacing) / 2;

    // ==================== RENDER BASED ON STRUCTURE & ENVIRONMENT ====================

    if (structure === 'array') {
      // ----- ARRAY -----
      
      if (environment === 'grocery') {
        // Grocery Shelf with 3D Boxes
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          const box = createGroceryBox(item.color, item.label, isHl);
          box.position.x = startX + i * spacing;
          box.position.y = isHl ? 0.15 : 0;
          groupRef.current!.add(box);

          // Index label
          const indexCanvas = document.createElement('canvas');
          indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff';
          ctx.font = 'bold 22px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.45, 0);
          indexSprite.scale.set(0.3, 0.15, 1);
          groupRef.current!.add(indexSprite);
        });

        // Shelf
        const shelfGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.5);
        const shelfMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 });
        const shelf = new THREE.Mesh(shelfGeo, shelfMat);
        shelf.position.y = -0.32;
        groupRef.current!.add(shelf);

        // Shelf supports
        const supportGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        [-data.length * spacing / 2 - 0.2, data.length * spacing / 2 + 0.2].forEach(x => {
          const support = new THREE.Mesh(supportGeo, shelfMat);
          support.position.set(x, -0.55, 0);
          groupRef.current!.add(support);
        });

      } else if (environment === 'classroom') {
        // Classroom with 3D Humans
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing;
            human.position.y = isHl ? 0.08 : 0;
            human.scale.setScalar(0.8);
            groupRef.current!.add(human);

            const chair = createChair(startX + i * spacing);
            chair.scale.setScalar(0.8);
            groupRef.current!.add(chair);
          }

          // Index label
          const indexCanvas = document.createElement('canvas');
          indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff';
          ctx.font = 'bold 22px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.38, 0);
          indexSprite.scale.set(0.25, 0.12, 1);
          groupRef.current!.add(indexSprite);
        });

        // Floor
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.8);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.32;
        groupRef.current!.add(floor);

      } else if (environment === 'todo') {
        // To-Do with 3D Clipboards
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          const clipboard = createClipboard(item.label, item.color, isHl);
          clipboard.position.x = startX + i * spacing;
          clipboard.position.y = isHl ? 0.12 : 0;
          clipboard.scale.setScalar(0.75);
          groupRef.current!.add(clipboard);

          // Index label
          const indexCanvas = document.createElement('canvas');
          indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff';
          ctx.font = 'bold 22px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.45, 0);
          indexSprite.scale.set(0.25, 0.12, 1);
          groupRef.current!.add(indexSprite);
        });

        // Desk surface
        const deskGeo = new THREE.BoxGeometry(data.length * spacing + 0.5, 0.03, 0.4);
        const deskMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const desk = new THREE.Mesh(deskGeo, deskMat);
        desk.position.y = -0.28;
        groupRef.current!.add(desk);
      }

    } else if (structure === 'linkedlist') {
      // ----- LINKED LIST -----

      if (environment === 'train') {
        // Train Cars
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const isEngine = i === 0;
          const trainCar = createTrainCar(isEngine, item.color, item.label, isHl);
          trainCar.position.x = startX + i * spacing;
          trainCar.position.y = isHl ? 0.12 : 0;
          trainCar.scale.setScalar(0.85);
          groupRef.current!.add(trainCar);

          // Pointer arrow to next
          if (i < data.length - 1) {
            const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
            arrow.position.y = -0.15;
            groupRef.current!.add(arrow);
          }
        });

        // HEAD label
        const headCanvas = document.createElement('canvas');
        headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!;
        hctx.fillStyle = '#ff0000';
        hctx.font = 'bold 20px Arial';
        hctx.textAlign = 'center';
        hctx.fillText('HEAD', 40, 24);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.55, 0);
        headSprite.scale.set(0.35, 0.14, 1);
        groupRef.current!.add(headSprite);

        // TAIL label
        const tailCanvas = document.createElement('canvas');
        tailCanvas.width = 80; tailCanvas.height = 32;
        const tctx = tailCanvas.getContext('2d')!;
        tctx.fillStyle = '#0066ff';
        tctx.font = 'bold 20px Arial';
        tctx.textAlign = 'center';
        tctx.fillText('TAIL', 40, 24);
        const tailTex = new THREE.CanvasTexture(tailCanvas);
        const tailSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tailTex, transparent: true }));
        tailSprite.position.set(startX + (data.length - 1) * spacing, 0.55, 0);
        tailSprite.scale.set(0.35, 0.14, 1);
        groupRef.current!.add(tailSprite);

        // NULL
        const nullCanvas = document.createElement('canvas');
        nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!;
        nctx.fillStyle = '#ff0000';
        nctx.font = 'bold 22px Arial';
        nctx.textAlign = 'center';
        nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, 0, 0);
        nullSprite.scale.set(0.35, 0.25, 1);
        groupRef.current!.add(nullSprite);

        // Arrow to NULL
        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.15, false);
        nullArrow.position.y = -0.15;
        groupRef.current!.add(nullArrow);

        // Rail tracks
        const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
        const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
        [-0.12, 0.12].forEach(z => {
          const rail = new THREE.Mesh(railGeo, railMat);
          rail.position.set(0, -0.12, z);
          groupRef.current!.add(rail);
        });

        // Rail ties
        const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
        const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.2) {
          const tie = new THREE.Mesh(tieGeo, tieMat);
          tie.position.set(x, -0.13, 0);
          groupRef.current!.add(tie);
        }

      } else if (environment === 'people') {
        // People in Line
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing;
            human.position.y = isHl ? 0.08 : 0;
            human.scale.setScalar(0.75);
            groupRef.current!.add(human);
          }

          // Pointer arrow to next
          if (i < data.length - 1) {
            const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
            arrow.position.y = 0.1;
            groupRef.current!.add(arrow);
          }
        });

        // HEAD/TAIL labels
        const headCanvas = document.createElement('canvas');
        headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!;
        hctx.fillStyle = '#ff0000';
        hctx.font = 'bold 18px Arial';
        hctx.textAlign = 'center';
        hctx.fillText('HEAD', 40, 22);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.55, 0);
        headSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(headSprite);

        // NULL at end
        const nullCanvas = document.createElement('canvas');
        nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!;
        nctx.fillStyle = '#ff0000';
        nctx.font = 'bold 20px Arial';
        nctx.textAlign = 'center';
        nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, 0.1, 0);
        nullSprite.scale.set(0.3, 0.2, 1);
        groupRef.current!.add(nullSprite);

        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
        nullArrow.position.y = 0.1;
        groupRef.current!.add(nullArrow);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.5);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.17;
        groupRef.current!.add(floor);

      } else if (environment === 'domino') {
        // Domino Nodes
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const domino = createDomino(item.label, isHl);
          domino.position.x = startX + i * spacing;
          domino.position.y = isHl ? 0.1 : 0;
          domino.scale.setScalar(0.9);
          groupRef.current!.add(domino);

          // Pointer arrow
          if (i < data.length - 1) {
            const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
            arrow.position.y = -0.35;
            groupRef.current!.add(arrow);
          }
        });

        // HEAD/TAIL labels
        const headCanvas = document.createElement('canvas');
        headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!;
        hctx.fillStyle = '#ff0000';
        hctx.font = 'bold 18px Arial';
        hctx.textAlign = 'center';
        hctx.fillText('HEAD', 40, 22);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.4, 0);
        headSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(headSprite);

        // NULL
        const nullCanvas = document.createElement('canvas');
        nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!;
        nctx.fillStyle = '#ff0000';
        nctx.font = 'bold 18px Arial';
        nctx.textAlign = 'center';
        nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, -0.35, 0);
        nullSprite.scale.set(0.3, 0.2, 1);
        groupRef.current!.add(nullSprite);

        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
        nullArrow.position.y = -0.35;
        groupRef.current!.add(nullArrow);

        // Table surface
        const tableGeo = new THREE.BoxGeometry(data.length * spacing + 0.8, 0.03, 0.5);
        const tableMat = new THREE.MeshStandardMaterial({ color: '#27ae60' });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.position.y = -0.28;
        groupRef.current!.add(table);
      }

    } else if (structure === 'stack') {
      // ----- STACK -----
      const stackSpacing = 0.12;
      const baseY = -data.length * stackSpacing / 2;

      if (environment === 'books') {
        // Book Stack
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const book = createBook(item.label, item.color, isHl);
          book.position.y = baseY + i * stackSpacing;
          book.position.x = isHl ? 0.2 : 0;
          book.rotation.y = (i % 2 === 0) ? 0 : 0.05;
          groupRef.current!.add(book);

          // TOP label
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas');
            topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!;
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.6, baseY + i * stackSpacing, 0);
            topSprite.scale.set(0.4, 0.15, 1);
            groupRef.current!.add(topSprite);
          }
        });

        // Desk
        const deskGeo = new THREE.BoxGeometry(1.2, 0.04, 0.6);
        const deskMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const desk = new THREE.Mesh(deskGeo, deskMat);
        desk.position.y = baseY - 0.08;
        groupRef.current!.add(desk);

      } else if (environment === 'plates') {
        // Plate Stack
        const plateSpacing = 0.045;
        const plateBaseY = -data.length * plateSpacing / 2;

        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const plate = createPlate(item.label, isHl);
          plate.position.y = plateBaseY + i * plateSpacing;
          plate.position.x = isHl ? 0.15 : 0;
          plate.scale.setScalar(0.7);
          groupRef.current!.add(plate);

          // TOP label
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas');
            topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!;
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.45, plateBaseY + i * plateSpacing, 0);
            topSprite.scale.set(0.35, 0.12, 1);
            groupRef.current!.add(topSprite);
          }
        });

        // Counter/Table
        const counterGeo = new THREE.BoxGeometry(0.9, 0.05, 0.5);
        const counterMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.3 });
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.y = plateBaseY - 0.06;
        groupRef.current!.add(counter);

      } else if (environment === 'boxes') {
        // Cardboard Box Stack
        const boxSpacing = 0.42;
        const boxBaseY = -data.length * boxSpacing / 2 + 0.2;

        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const box = createCardboardBox(item.label, item.color, isHl);
          box.position.y = boxBaseY + i * boxSpacing;
          box.position.x = isHl ? 0.2 : 0;
          box.rotation.y = (i % 2 === 0) ? 0 : 0.08;
          box.scale.setScalar(0.85);
          groupRef.current!.add(box);

          // TOP label
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas');
            topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!;
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.55, boxBaseY + i * boxSpacing, 0);
            topSprite.scale.set(0.35, 0.12, 1);
            groupRef.current!.add(topSprite);
          }
        });

        // Floor/Pallet
        const palletGeo = new THREE.BoxGeometry(0.8, 0.06, 0.6);
        const palletMat = new THREE.MeshStandardMaterial({ color: '#a0522d' });
        const pallet = new THREE.Mesh(palletGeo, palletMat);
        pallet.position.y = boxBaseY - 0.22;
        groupRef.current!.add(pallet);
      }

    } else if (structure === 'queue') {
      // ----- QUEUE -----

      if (environment === 'tollgate') {
        // Car Toll Gate
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const car = createCar(item.color, item.label, isHl);
          car.position.x = startX + i * spacing;
          car.position.y = isHl ? 0.1 : 0;
          car.scale.setScalar(0.85);
          groupRef.current!.add(car);
        });

        // FRONT label
        const frontCanvas = document.createElement('canvas');
        frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!;
        fctx.fillStyle = '#00ff00';
        fctx.font = 'bold 18px Arial';
        fctx.textAlign = 'center';
        fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.25, 0);
        frontSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(frontSprite);

        // REAR label
        const rearCanvas = document.createElement('canvas');
        rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!;
        rctx.fillStyle = '#ff6600';
        rctx.font = 'bold 18px Arial';
        rctx.textAlign = 'center';
        rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0);
        rearSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(rearSprite);

        // Toll Gate Structure
        const gateX = startX - 0.7;
        const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12);
        const poleMat = new THREE.MeshStandardMaterial({ color: '#f1c40f' });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(gateX, 0.2, 0.25);
        groupRef.current!.add(pole);

        const barrierGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
        const barrierMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(gateX - 0.25, 0.45, 0.25);
        barrier.rotation.z = 0.3;
        groupRef.current!.add(barrier);

        // Road
        const roadGeo = new THREE.PlaneGeometry(data.length * spacing + 2, 0.6);
        const roadMat = new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.y = -0.08;
        groupRef.current!.add(road);

        // Road lines
        const lineGeo = new THREE.PlaneGeometry(0.15, 0.03);
        const lineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
        for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.5; x += 0.3) {
          const line = new THREE.Mesh(lineGeo, lineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(x, -0.075, 0);
          groupRef.current!.add(line);
        }

        // EXIT arrow
        const exitCanvas = document.createElement('canvas');
        exitCanvas.width = 80; exitCanvas.height = 48;
        const ectx = exitCanvas.getContext('2d')!;
        ectx.fillStyle = '#00ff00';
        ectx.font = 'bold 36px Arial';
        ectx.textAlign = 'center';
        ectx.fillText('→', 40, 38);
        const exitTex = new THREE.CanvasTexture(exitCanvas);
        const exitSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: exitTex, transparent: true }));
        exitSprite.position.set(gateX - 0.5, 0, 0);
        exitSprite.scale.set(0.4, 0.25, 1);
        groupRef.current!.add(exitSprite);

      } else if (environment === 'tickets') {
        // Ticket Queue
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const ticket = createTicket(item.label, item.color, isHl);
          ticket.position.x = startX + i * spacing;
          ticket.position.y = isHl ? 0.1 : 0;
          ticket.scale.setScalar(0.85);
          groupRef.current!.add(ticket);
        });

        // FRONT/REAR labels
        const frontCanvas = document.createElement('canvas');
        frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!;
        fctx.fillStyle = '#00ff00';
        fctx.font = 'bold 18px Arial';
        fctx.textAlign = 'center';
        fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.25, 0);
        frontSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(frontSprite);

        const rearCanvas = document.createElement('canvas');
        rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!;
        rctx.fillStyle = '#ff6600';
        rctx.font = 'bold 18px Arial';
        rctx.textAlign = 'center';
        rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0);
        rearSprite.scale.set(0.3, 0.12, 1);
        groupRef.current!.add(rearSprite);

        // Counter
        const counterGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4);
        const counterMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.y = -0.15;
        groupRef.current!.add(counter);

      } else if (environment === 'students') {
        // Student Queue
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing;
            human.position.y = isHl ? 0.08 : 0;
            human.scale.setScalar(0.7);
            groupRef.current!.add(human);
          }
        });

        // FRONT/REAR labels
        const frontCanvas = document.createElement('canvas');
        frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!;
        fctx.fillStyle = '#00ff00';
        fctx.font = 'bold 18px Arial';
        fctx.textAlign = 'center';
        fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.22, 0);
        frontSprite.scale.set(0.28, 0.1, 1);
        groupRef.current!.add(frontSprite);

        const rearCanvas = document.createElement('canvas');
        rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!;
        rctx.fillStyle = '#ff6600';
        rctx.font = 'bold 18px Arial';
        rctx.textAlign = 'center';
        rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0);
        rearSprite.scale.set(0.28, 0.1, 1);
        groupRef.current!.add(rearSprite);

        // Door/Exit
        const doorGeo = new THREE.BoxGeometry(0.04, 0.5, 0.3);
        const doorMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(startX - 0.7, 0.1, 0);
        groupRef.current!.add(door);

        const doorFrameGeo = new THREE.BoxGeometry(0.06, 0.55, 0.35);
        const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const doorFrame = new THREE.Mesh(doorFrameGeo, doorFrameMat);
        doorFrame.position.set(startX - 0.72, 0.1, 0);
        groupRef.current!.add(doorFrame);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.5);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.15;
        groupRef.current!.add(floor);
      }
    }

  }, [data, highlightIndex, highlightIndex2, structure, environment, createGroceryBox, createHuman3D, createClipboard, createTrainCar, createDomino, createBook, createPlate, createCardboardBox, createCar, createTicket, createChair, createArrow]);

  // ==================== RENDER CONTAINER ====================
  
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
