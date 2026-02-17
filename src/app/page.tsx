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

// DATA STRUCTURE TYPES
type DataStructure = 'array' | 'linkedlist' | 'stack' | 'queue';

// ENVIRONMENT TYPES
type ArrayEnvironment = 'grocery' | 'classroom' | 'todo';
type LinkedListEnvironment = 'train' | 'people' | 'domino';
type StackEnvironment = 'books' | 'plates' | 'boxes';
type QueueEnvironment = 'tollgate' | 'tickets' | 'students';

// DATA INTERFACES
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

interface LinkedListNode {
  id: number;
  data: string;
  color: string;
  emoji: string;
}

interface StackItem {
  id: number;
  label: string;
  color: string;
  emoji: string;
}

interface QueueItem {
  id: number;
  label: string;
  color: string;
  emoji: string;
}

// ==================== MAIN COMPONENT ====================

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // APP STATE
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [model, setModel] = useState<any>(null);
  const [detectedPerson, setDetectedPerson] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [personPosition, setPersonPosition] = useState<Position | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  
  // NAVIGATION STATE
  const [currentStructure, setCurrentStructure] = useState<DataStructure>('array');
  const [arrayEnv, setArrayEnv] = useState<ArrayEnvironment>('grocery');
  const [linkedListEnv, setLinkedListEnv] = useState<LinkedListEnvironment>('train');
  const [stackEnv, setStackEnv] = useState<StackEnvironment>('books');
  const [queueEnv, setQueueEnv] = useState<QueueEnvironment>('tollgate');
  
  // ANIMATION STATE
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [pointerHighlight, setPointerHighlight] = useState<number | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // ==================== ARRAY DATA ====================
  
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([
    { id: 1, name: 'Milk', color: '#3498db' },
    { id: 2, name: 'Bread', color: '#e67e22' },
    { id: 3, name: 'Eggs', color: '#f1c40f' },
    { id: 4, name: 'Apple', color: '#e74c3c' },
    { id: 5, name: 'Juice', color: '#9b59b6' },
  ]);
  
  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: 'Alex', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' }},
    { id: 2, name: 'Beth', appearance: { skinTone: '#f5d0c5', shirtColor: '#e91e63', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' }},
    { id: 3, name: 'Carl', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' }},
    { id: 4, name: 'Dana', appearance: { skinTone: '#ffcd94', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' }},
    { id: 5, name: 'Erik', appearance: { skinTone: '#ffe0bd', shirtColor: '#9b59b6', pantsColor: '#34495e', hairColor: '#b86b3e', hairStyle: 'short', gender: 'male' }},
  ]);
  
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Study', priority: 'high' },
    { id: 2, text: 'Code', priority: 'high' },
    { id: 3, text: 'Read', priority: 'medium' },
    { id: 4, text: 'Rest', priority: 'low' },
  ]);

  // ==================== LINKED LIST DATA ====================
  
  const [trainCars, setTrainCars] = useState<LinkedListNode[]>([
    { id: 1, data: 'Engine', color: '#e74c3c', emoji: '🚂' },
    { id: 2, data: 'Coal', color: '#3498db', emoji: '🚃' },
    { id: 3, data: 'Cargo', color: '#2ecc71', emoji: '🚃' },
    { id: 4, data: 'Passenger', color: '#9b59b6', emoji: '🚃' },
  ]);

  const [peopleLine, setPeopleLine] = useState<LinkedListNode[]>([
    { id: 1, data: 'Alice', color: '#e74c3c', emoji: '👩' },
    { id: 2, data: 'Bob', color: '#3498db', emoji: '👨' },
    { id: 3, data: 'Carol', color: '#2ecc71', emoji: '👩' },
    { id: 4, data: 'David', color: '#9b59b6', emoji: '👨' },
  ]);

  const [dominoNodes, setDominoNodes] = useState<LinkedListNode[]>([
    { id: 1, data: '1', color: '#1abc9c', emoji: '🁣' },
    { id: 2, data: '2', color: '#3498db', emoji: '🁤' },
    { id: 3, data: '3', color: '#9b59b6', emoji: '🁥' },
    { id: 4, data: '4', color: '#e74c3c', emoji: '🁦' },
  ]);

  // ==================== STACK DATA ====================
  
  const [bookStack, setBookStack] = useState<StackItem[]>([
    { id: 1, label: 'Math', color: '#3498db', emoji: '📘' },
    { id: 2, label: 'Science', color: '#2ecc71', emoji: '📗' },
    { id: 3, label: 'History', color: '#e67e22', emoji: '📙' },
  ]);

  const [plateStack, setPlateStack] = useState<StackItem[]>([
    { id: 1, label: 'Plate 1', color: '#ecf0f1', emoji: '🍽️' },
    { id: 2, label: 'Plate 2', color: '#bdc3c7', emoji: '🍽️' },
    { id: 3, label: 'Plate 3', color: '#95a5a6', emoji: '🍽️' },
  ]);

  const [boxStack, setBoxStack] = useState<StackItem[]>([
    { id: 1, label: 'Box A', color: '#e67e22', emoji: '📦' },
    { id: 2, label: 'Box B', color: '#d35400', emoji: '📦' },
    { id: 3, label: 'Box C', color: '#e74c3c', emoji: '📦' },
  ]);

  // ==================== QUEUE DATA ====================
  
  const [tollGate, setTollGate] = useState<QueueItem[]>([
    { id: 1, label: 'Red Car', color: '#e74c3c', emoji: '🚗' },
    { id: 2, label: 'Blue Car', color: '#3498db', emoji: '🚙' },
    { id: 3, label: 'Green Car', color: '#2ecc71', emoji: '🚕' },
  ]);

  const [ticketQueue, setTicketQueue] = useState<QueueItem[]>([
    { id: 1, label: 'Ticket 1', color: '#f39c12', emoji: '🎫' },
    { id: 2, label: 'Ticket 2', color: '#e74c3c', emoji: '🎫' },
    { id: 3, label: 'Ticket 3', color: '#9b59b6', emoji: '🎫' },
  ]);

  const [studentQueue, setStudentQueue] = useState<QueueItem[]>([
    { id: 1, label: 'Student 1', color: '#3498db', emoji: '🧑‍🎓' },
    { id: 2, label: 'Student 2', color: '#2ecc71', emoji: '👩‍🎓' },
    { id: 3, label: 'Student 3', color: '#9b59b6', emoji: '🧑‍🎓' },
  ]);

  // ==================== ZOOM FUNCTIONS ====================
  
  const zoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5)), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  // ==================== CAMERA FUNCTIONS ====================

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); };
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
    try { await startCamera(newFacing); } catch (err) { console.error(err); }
  };

  const loadModel = async () => {
    try {
      setLoadingText('Loading AI...');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      await tf.setBackend('webgl');
      setLoadingText('Loading detector...');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      return await cocoSsd.load({ base: 'lite_mobilenet_v2' });
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
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    let animationId: number;
    let running = true;
    let lastDetection = 0;

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;
      const now = Date.now();
      if (now - lastDetection < 100) { animationId = requestAnimationFrame(detect); return; }
      lastDetection = now;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== 4) { animationId = requestAnimationFrame(detect); return; }
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
          setDetectedPerson({ bbox: person.bbox, class: person.class, score: person.score });
          setPersonPosition({ x: x * scaleX, y: y * scaleY, width: width * scaleX, height: height * scaleY });
        } else {
          setDetectedPerson(null);
          setPersonPosition(null);
        }
      } catch (e) { console.error('Detection error:', e); }
      if (running) animationId = requestAnimationFrame(detect);
    };
    detect();
    return () => { running = false; if (animationId) cancelAnimationFrame(animationId); };
  }, [model]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ==================== ARRAY OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const items = arrayEnv === 'grocery' ? groceryItems : arrayEnv === 'classroom' ? students : tasks;
    const index = Math.floor(Math.random() * items.length);
    const item = arrayEnv === 'grocery' ? (items[index] as GroceryItem).name : 
                 arrayEnv === 'classroom' ? (items[index] as Student).name : 
                 (items[index] as Task).text;
    setHighlightIndex(index);
    setOperationMessage(`Accessing index ${index}: "${item}"`);
    setCodeDisplay(`// O(1) Random Access\narray[${index}] = "${item}"`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating) return;
    const items = arrayEnv === 'grocery' ? groceryItems : arrayEnv === 'classroom' ? students : tasks;
    if (items.length >= 6) return;
    setIsAnimating(true);
    const insertIndex = Math.floor(Math.random() * (items.length + 1));
    setOperationMessage(`Inserting at index ${insertIndex}...`);
    setCodeDisplay(`// O(n) - Shift elements\narray.insert(${insertIndex}, item)`);
    
    for (let i = items.length - 1; i >= insertIndex; i--) {
      setHighlightIndex(i);
      await delay(300);
    }
    
    if (arrayEnv === 'grocery') {
      const newItems = [{ name: 'Cheese', color: '#1abc9c' }, { name: 'Butter', color: '#e91e63' }];
      const newItem = newItems[Math.floor(Math.random() * newItems.length)];
      setGroceryItems(prev => { const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), ...newItem }); return arr; });
    } else if (arrayEnv === 'todo') {
      setTasks(prev => { const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), text: 'New Task', priority: 'medium' }); return arr; });
    }
    
    setHighlightIndex(insertIndex);
    setOperationMessage(`Inserted at index ${insertIndex}!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating) return;
    const items = arrayEnv === 'grocery' ? groceryItems : arrayEnv === 'classroom' ? students : tasks;
    if (items.length <= 2) return;
    setIsAnimating(true);
    const deleteIndex = Math.floor(Math.random() * items.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting index ${deleteIndex}...`);
    setCodeDisplay(`// O(n) - Shift elements\narray.delete(${deleteIndex})`);
    await delay(1000);
    
    if (arrayEnv === 'grocery') setGroceryItems(prev => prev.filter((_, i) => i !== deleteIndex));
    else if (arrayEnv === 'todo') setTasks(prev => prev.filter((_, i) => i !== deleteIndex));
    
    setOperationMessage(`Deleted!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating || arrayEnv !== 'classroom') return;
    setIsAnimating(true);
    const idx1 = Math.floor(Math.random() * students.length);
    let idx2 = Math.floor(Math.random() * students.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * students.length);
    
    setHighlightIndex(idx1);
    setHighlightIndex2(idx2);
    setOperationMessage(`Swapping ${students[idx1].name} ↔ ${students[idx2].name}`);
    setCodeDisplay(`// O(1) Swap\ntemp = arr[${idx1}]\narr[${idx1}] = arr[${idx2}]\narr[${idx2}] = temp`);
    await delay(1500);
    setStudents(prev => { const arr = [...prev]; [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]; return arr; });
    await delay(1000);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== LINKED LIST OPERATIONS ====================

  const getLinkedListData = () => linkedListEnv === 'train' ? trainCars : linkedListEnv === 'people' ? peopleLine : dominoNodes;
  const setLinkedListData = linkedListEnv === 'train' ? setTrainCars : linkedListEnv === 'people' ? setPeopleLine : setDominoNodes;

  const linkedListInsertHead = async () => {
    if (isAnimating) return;
    const data = getLinkedListData();
    if (data.length >= 5) return;
    setIsAnimating(true);
    
    const newNodes = linkedListEnv === 'train' 
      ? [{ data: 'New Car', color: '#1abc9c', emoji: '🚃' }]
      : linkedListEnv === 'people'
      ? [{ data: 'New Person', color: '#1abc9c', emoji: '🧑' }]
      : [{ data: '0', color: '#1abc9c', emoji: '🁢' }];
    const newNode = newNodes[0];
    
    setOperationMessage(`Inserting at HEAD...`);
    setCodeDisplay(`// O(1) Insert Head\nnewNode.next = head\nhead = newNode`);
    setPointerHighlight(0);
    await delay(1000);
    
    setLinkedListData(prev => [{ id: Date.now(), ...newNode }, ...prev]);
    setHighlightIndex(0);
    setOperationMessage(`Inserted at HEAD!`);
    await delay(1500);
    setHighlightIndex(null);
    setPointerHighlight(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating) return;
    const data = getLinkedListData();
    if (data.length >= 5) return;
    setIsAnimating(true);
    
    setOperationMessage(`Traversing to TAIL...`);
    setCodeDisplay(`// O(n) Traverse\nwhile(curr.next != null)\n  curr = curr.next`);
    
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      await delay(400);
    }
    
    const newNode = linkedListEnv === 'train' 
      ? { data: 'Caboose', color: '#e74c3c', emoji: '🚃' }
      : linkedListEnv === 'people'
      ? { data: 'Last', color: '#e74c3c', emoji: '🧑' }
      : { data: String(data.length + 1), color: '#e74c3c', emoji: '🁧' };
    
    setLinkedListData(prev => [...prev, { id: Date.now(), ...newNode }]);
    setCodeDisplay(`// O(1) Insert\ntail.next = newNode`);
    setOperationMessage(`Inserted at TAIL!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating) return;
    const data = getLinkedListData();
    if (data.length <= 2) return;
    setIsAnimating(true);
    
    setHighlightIndex(0);
    setOperationMessage(`Deleting HEAD: ${data[0].data}`);
    setCodeDisplay(`// O(1) Delete Head\ntemp = head\nhead = head.next\ndelete temp`);
    await delay(1500);
    
    setLinkedListData(prev => prev.slice(1));
    setOperationMessage(`HEAD deleted!`);
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return;
    const data = getLinkedListData();
    setIsAnimating(true);
    
    setOperationMessage(`Traversing...`);
    setCodeDisplay(`curr = head`);
    
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setCodeDisplay(`// Node ${i}: ${data[i].data}\ncurr = curr.next`);
      setOperationMessage(`Visiting: ${data[i].emoji} ${data[i].data}`);
      await delay(600);
    }
    
    setCodeDisplay(`// curr == NULL\n// Done!`);
    setOperationMessage(`Traversed ${data.length} nodes!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== STACK OPERATIONS ====================

  const getStackData = () => stackEnv === 'books' ? bookStack : stackEnv === 'plates' ? plateStack : boxStack;
  const setStackData = stackEnv === 'books' ? setBookStack : stackEnv === 'plates' ? setPlateStack : setBoxStack;

  const stackPush = async () => {
    if (isAnimating) return;
    const data = getStackData();
    if (data.length >= 5) return;
    setIsAnimating(true);
    
    const newItems = stackEnv === 'books'
      ? [{ label: 'Physics', color: '#9b59b6', emoji: '📕' }, { label: 'Chemistry', color: '#e74c3c', emoji: '📓' }]
      : stackEnv === 'plates'
      ? [{ label: `Plate ${data.length + 1}`, color: '#7f8c8d', emoji: '🍽️' }]
      : [{ label: `Box ${String.fromCharCode(65 + data.length)}`, color: '#c0392b', emoji: '📦' }];
    const newItem = newItems[Math.floor(Math.random() * newItems.length)];
    
    setOperationMessage(`Pushing ${newItem.emoji} ${newItem.label}...`);
    setCodeDisplay(`// O(1) Push\nstack.push("${newItem.label}")\n// TOP = ${data.length}`);
    await delay(500);
    
    setStackData(prev => [...prev, { id: Date.now(), ...newItem }]);
    setHighlightIndex(data.length);
    setOperationMessage(`Pushed! TOP is now ${newItem.label}`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating) return;
    const data = getStackData();
    if (data.length <= 1) return;
    setIsAnimating(true);
    
    const topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping ${topItem.emoji} ${topItem.label}...`);
    setCodeDisplay(`// O(1) Pop\nitem = stack.pop()\n// Returns: "${topItem.label}"`);
    await delay(1500);
    
    setStackData(prev => prev.slice(0, -1));
    setOperationMessage(`Popped ${topItem.label}!`);
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating) return;
    const data = getStackData();
    if (data.length === 0) return;
    setIsAnimating(true);
    
    const topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`TOP: ${topItem.emoji} ${topItem.label}`);
    setCodeDisplay(`// O(1) Peek\ntop = stack.peek()\n// Returns: "${topItem.label}"\n// Stack unchanged`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== QUEUE OPERATIONS ====================

  const getQueueData = () => queueEnv === 'tollgate' ? tollGate : queueEnv === 'tickets' ? ticketQueue : studentQueue;
  const setQueueData = queueEnv === 'tollgate' ? setTollGate : queueEnv === 'tickets' ? setTicketQueue : setStudentQueue;

  const queueEnqueue = async () => {
    if (isAnimating) return;
    const data = getQueueData();
    if (data.length >= 5) return;
    setIsAnimating(true);
    
    const newItems = queueEnv === 'tollgate'
      ? [{ label: 'Truck', color: '#8e44ad', emoji: '🚚' }, { label: 'Van', color: '#16a085', emoji: '🚐' }]
      : queueEnv === 'tickets'
      ? [{ label: `Ticket ${data.length + 1}`, color: '#e67e22', emoji: '🎫' }]
      : [{ label: `Student ${data.length + 1}`, color: '#3498db', emoji: '🧑‍🎓' }];
    const newItem = newItems[Math.floor(Math.random() * newItems.length)];
    
    setOperationMessage(`${newItem.emoji} Joining at REAR...`);
    setCodeDisplay(`// O(1) Enqueue\nqueue.enqueue("${newItem.label}")\n// Added to REAR`);
    setHighlightIndex(data.length);
    await delay(500);
    
    setQueueData(prev => [...prev, { id: Date.now(), ...newItem }]);
    setOperationMessage(`${newItem.emoji} Joined queue!`);
    await delay(1500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating) return;
    const data = getQueueData();
    if (data.length <= 1) return;
    setIsAnimating(true);
    
    const frontItem = data[0];
    setHighlightIndex(0);
    setOperationMessage(`${frontItem.emoji} Leaving from FRONT...`);
    setCodeDisplay(`// O(1) Dequeue\nitem = queue.dequeue()\n// Returns: "${frontItem.label}"`);
    await delay(1500);
    
    setQueueData(prev => prev.slice(1));
    setOperationMessage(`${frontItem.emoji} Left queue!`);
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating) return;
    const data = getQueueData();
    if (data.length === 0) return;
    setIsAnimating(true);
    
    const frontItem = data[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: ${frontItem.emoji} ${frontItem.label}`);
    setCodeDisplay(`// O(1) Front\nfront = queue.front()\n// Returns: "${frontItem.label}"\n// Queue unchanged`);
    await delay(2000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== GET CURRENT DATA ====================

  const getCurrentData = () => {
    if (currentStructure === 'array') {
      if (arrayEnv === 'grocery') return groceryItems.map(i => ({ label: i.name, color: i.color, emoji: '📦' }));
      if (arrayEnv === 'classroom') return students.map(s => ({ label: s.name, color: s.appearance.shirtColor, emoji: '🧑', appearance: s.appearance }));
      return tasks.map(t => ({ label: t.text, color: t.priority === 'high' ? '#e74c3c' : t.priority === 'medium' ? '#f39c12' : '#2ecc71', emoji: '📝' }));
    }
    if (currentStructure === 'linkedlist') {
      const data = getLinkedListData();
      return data.map(n => ({ label: n.data, color: n.color, emoji: n.emoji }));
    }
    if (currentStructure === 'stack') {
      const data = getStackData();
      return data.map(s => ({ label: s.label, color: s.color, emoji: s.emoji }));
    }
    if (currentStructure === 'queue') {
      const data = getQueueData();
      return data.map(q => ({ label: q.label, color: q.color, emoji: q.emoji }));
    }
    return [];
  };

  // ==================== RENDER ====================

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ fontSize: 80 }}>📷</div>
        <h2>Camera Access Needed</h2>
        <p style={{ opacity: 0.7 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white', fontSize: 16 }}>🔄 Try Again</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2>
        <p style={{ opacity: 0.7 }}>{loadingText}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const structureInfo = {
    array: { icon: '📊', title: 'Array' },
    linkedlist: { icon: '🔗', title: 'Linked List' },
    stack: { icon: '📚', title: 'Stack' },
    queue: { icon: '🚗', title: 'Queue' }
  }[currentStructure];

  const envTabs = currentStructure === 'array' 
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
    ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
    : currentStructure === 'stack'
    ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
    : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  const currentEnvId = currentStructure === 'array' ? arrayEnv : currentStructure === 'linkedlist' ? linkedListEnv : currentStructure === 'stack' ? stackEnv : queueEnv;
  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv : currentStructure === 'linkedlist' ? setLinkedListEnv : currentStructure === 'stack' ? setStackEnv : setQueueEnv;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 3D VISUALIZATION */}
      {personPosition && (
        <Visualization3D
          position={personPosition}
          data={getCurrentData()}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          pointerHighlight={pointerHighlight}
          structure={currentStructure}
          environment={currentEnvId}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      )}

      {/* TOP UI */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        
        {/* Camera Switch */}
        <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, cursor: 'pointer' }}>🔄</button>

        {/* Zoom Controls */}
        {detectedPerson && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200 }}>
            <button onPointerDown={(e) => { e.preventDefault(); zoomIn(); }} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', fontSize: 28, fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(0,0,0,0.9)', border: '3px solid #00ff00', color: '#00ff00', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={(e) => { e.preventDefault(); zoomOut(); }} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: 'linear-gradient(135deg, #f093fb, #f5576c)', color: 'white', fontSize: 32, fontWeight: 'bold', cursor: 'pointer' }}>−</button>
            <button onPointerDown={(e) => { e.preventDefault(); resetZoom(); }} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', color: 'white', fontSize: 20, cursor: 'pointer' }}>⟲</button>
          </div>
        )}

        {/* Data Structure Tabs */}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(struct => (
            <button key={struct} onClick={() => !isAnimating && setCurrentStructure(struct)}
              style={{
                padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
                background: currentStructure === struct ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: 'white', cursor: 'pointer', opacity: currentStructure === struct ? 1 : 0.6
              }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[struct]}
              {currentStructure === struct && <span style={{ marginLeft: 4 }}>{{ array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[struct]}</span>}
            </button>
          ))}
        </div>

        {/* Environment Tabs */}
        {detectedPerson && (
          <div style={{ position: 'absolute', top: 55, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(env => (
              <button key={env.id} onClick={() => !isAnimating && (setCurrentEnv as any)(env.id)}
                style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 15,
                  background: currentEnvId === env.id ? '#00b894' : 'transparent',
                  color: 'white', cursor: 'pointer', opacity: currentEnvId === env.id ? 1 : 0.6
                }}>
                {env.icon} {env.label}
              </button>
            ))}
          </div>
        )}

        {/* Operation Message */}
        {operationMessage && (
          <div style={{ position: 'absolute', top: 95, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#00ff00', padding: '10px 20px', borderRadius: 15, fontSize: 14, fontWeight: 'bold', border: '1px solid #00ff00' }}>
            ⚡ {operationMessage}
          </div>
        )}

        {/* Code Display */}
        {codeDisplay && (
          <div style={{ position: 'absolute', top: 135, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,30,0.95)', color: '#00ff00', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444', maxWidth: '90%' }}>
            {codeDisplay}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      {detectedPerson && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px', paddingBottom: 30, background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            
            {/* ARRAY OPERATIONS */}
            {currentStructure === 'array' && (
              <>
                <OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpBtn onClick={arrayInsert} disabled={isAnimating || arrayEnv === 'classroom'} color="#2ecc71" label="➕ Insert" />
                <OpBtn onClick={arrayDelete} disabled={isAnimating || arrayEnv === 'classroom'} color="#e74c3c" label="➖ Delete" />
                {arrayEnv === 'classroom' && <OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />}
              </>
            )}

            {/* LINKED LIST OPERATIONS */}
            {currentStructure === 'linkedlist' && (
              <>
                <OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" />
                <OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" />
                <OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" />
                <OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" />
              </>
            )}

            {/* STACK OPERATIONS */}
            {currentStructure === 'stack' && (
              <>
                <OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
                <OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" />
                <OpBtn onClick={stackPeek} disabled={isAnimating || getStackData().length === 0} color="#f39c12" label="👁️ Peek" />
              </>
            )}

            {/* QUEUE OPERATIONS */}
            {currentStructure === 'queue' && (
              <>
                <OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
                <OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" />
                <OpBtn onClick={queueFront} disabled={isAnimating || getQueueData().length === 0} color="#f39c12" label="👁️ Front" />
              </>
            )}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {getCurrentData().length}
            {currentStructure === 'stack' && ` | TOP: ${getStackData().length - 1}`}
            {currentStructure === 'queue' && ` | FRONT: 0 | REAR: ${getQueueData().length - 1}`}
          </div>
        </div>
      )}

      {/* Scanning Prompt */}
      {!detectedPerson && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, fontSize: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📱</div>
          <div>Point camera at a person</div>
        </div>
      )}
    </div>
  );
}

// ==================== OPERATION BUTTON ====================

function OpBtn({ onClick, disabled, color, label }: { onClick: () => void; disabled: boolean; color: string; label: string; }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25,
        background: disabled ? 'rgba(100,100,100,0.5)' : color,
        color: 'white', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, touchAction: 'manipulation'
      }}>
      {label}
    </button>
  );
}

// ==================== 3D VISUALIZATION ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, pointerHighlight, structure, environment, zoomLevel, setZoomLevel }: {
  position: Position;
  data: { label: string; color: string; emoji: string; appearance?: HumanAppearance }[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  pointerHighlight: number | null;
  structure: DataStructure;
  environment: string;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.2, y: 0 });
  const zoomRef = useRef(zoomLevel);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const size = {
    width: Math.min(window.innerWidth - 20, 360),
    height: structure === 'stack' ? 250 : 180,
    x: position.x + position.width / 2 - Math.min(window.innerWidth - 20, 360) / 2,
    y: position.y + position.height / 2 - (structure === 'stack' ? 125 : 90)
  };

  // CREATE TEXTURE
  const createTexture = useCallback((label: string, bgColor: string, hl: boolean, emoji?: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = hl ? '#ffff00' : bgColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
    ctx.fillStyle = hl ? '#000' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (emoji && structure !== 'array') {
      ctx.font = '40px Arial';
      ctx.fillText(emoji, 64, 45);
      ctx.font = 'bold 16px Arial';
      ctx.fillText(label.slice(0, 8), 64, 90);
    } else {
      ctx.font = label.length <= 4 ? 'bold 32px Arial' : 'bold 20px Arial';
      ctx.fillText(label.slice(0, 8), 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [structure]);

  // CREATE ARROW (for linked list)
  const createArrow = useCallback((fromX: number, toX: number, hl: boolean): THREE.Group => {
    const arrow = new THREE.Group();
    const color = hl ? 0xffff00 : 0x00ff00;
    
    // Line
    const points = [new THREE.Vector3(fromX + 0.4, 0, 0), new THREE.Vector3(toX - 0.4, 0, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    arrow.add(new THREE.Line(lineGeo, lineMat));
    
    // Arrowhead
    const coneGeo = new THREE.ConeGeometry(0.08, 0.15, 8);
    const coneMat = new THREE.MeshBasicMaterial({ color });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(toX - 0.45, 0, 0);
    cone.rotation.z = -Math.PI / 2;
    arrow.add(cone);
    
    return arrow;
  }, []);

  // INITIALIZE THREE.JS
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.5 : 0.5, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.width, size.height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // Touch controls
    let isDragging = false, lastX = 0, lastY = 0;
    let pinchDist: number | null = null, pinchZoom = 1;

    const getDistance = (t: TouchList) => t.length < 2 ? null : Math.sqrt((t[0].clientX - t[1].clientX) ** 2 + (t[0].clientY - t[1].clientY) ** 2);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) { pinchDist = getDistance(e.touches); pinchZoom = zoomRef.current; }
      else if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const dist = getDistance(e.touches);
        if (dist) setZoomLevel(Math.max(0.5, Math.min(2.5, pinchZoom * (dist / pinchDist))));
      } else if (e.touches.length === 1 && isDragging) {
        rotationRef.current.y += (e.touches[0].clientX - lastX) * 0.01;
        rotationRef.current.x = Math.max(-0.5, Math.min(0.5, rotationRef.current.x + (e.touches[0].clientY - lastY) * 0.01));
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length < 2) pinchDist = null; if (e.touches.length === 0) isDragging = false; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoomLevel(Math.max(0.5, Math.min(2.5, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15)))); };

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
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure]);

  // UPDATE VISUALIZATION
  useEffect(() => {
    if (!groupRef.current) return;
    while (groupRef.current.children.length > 0) groupRef.current.remove(groupRef.current.children[0]);

    const boxSize = 0.7;
    const spacing = structure === 'linkedlist' ? 1.2 : 0.85;

    if (structure === 'stack') {
      // STACK: Vertical layout
      data.forEach((item, i) => {
        const hl = highlightIndex === i;
        const tex = createTexture(item.label, item.color, hl, item.emoji);
        const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
        const geo = new THREE.BoxGeometry(boxSize * 1.2, boxSize * 0.5, boxSize);
        const cube = new THREE.Mesh(geo, mat);
        cube.position.y = i * 0.45 - (data.length - 1) * 0.225;
        cube.position.x = hl ? 0.3 : 0;
        groupRef.current!.add(cube);

        // TOP label
        if (i === data.length - 1) {
          const canvas = document.createElement('canvas');
          canvas.width = 128; canvas.height = 32;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('← TOP', 64, 22);
          const t = new THREE.CanvasTexture(canvas);
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
          s.position.set(0.7, i * 0.45 - (data.length - 1) * 0.225, 0);
          s.scale.set(0.6, 0.15, 1);
          groupRef.current!.add(s);
        }
      });
    } else if (structure === 'queue') {
      // QUEUE: Horizontal with FRONT/REAR labels
      const startX = -((data.length - 1) * spacing) / 2;
      data.forEach((item, i) => {
        const hl = highlightIndex === i;
        const tex = createTexture(item.label, item.color, hl, item.emoji);
        const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
        const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const cube = new THREE.Mesh(geo, mat);
        cube.position.x = startX + i * spacing;
        cube.position.y = hl ? 0.25 : 0;
        groupRef.current!.add(cube);

        // FRONT/REAR labels
        if (i === 0 || i === data.length - 1) {
          const canvas = document.createElement('canvas');
          canvas.width = 128; canvas.height = 32;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = i === 0 ? '#00ff00' : '#ff6600';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(i === 0 ? 'FRONT' : 'REAR', 64, 22);
          const t = new THREE.CanvasTexture(canvas);
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
          s.position.set(startX + i * spacing, -0.6, 0);
          s.scale.set(0.5, 0.12, 1);
          groupRef.current!.add(s);
        }
      });

      // Exit arrow
      const exitCanvas = document.createElement('canvas');
      exitCanvas.width = 64; exitCanvas.height = 64;
      const ectx = exitCanvas.getContext('2d')!;
      ectx.fillStyle = '#00ff00';
      ectx.font = 'bold 40px Arial';
      ectx.textAlign = 'center';
      ectx.fillText('→', 32, 45);
      const exitTex = new THREE.CanvasTexture(exitCanvas);
      const exitSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: exitTex, transparent: true }));
      exitSprite.position.set(startX - 0.7, 0, 0);
      exitSprite.scale.set(0.5, 0.5, 1);
      groupRef.current!.add(exitSprite);

    } else if (structure === 'linkedlist') {
      // LINKED LIST: Horizontal with pointer arrows
      const startX = -((data.length - 1) * spacing) / 2;
      data.forEach((item, i) => {
        const hl = highlightIndex === i;
        const tex = createTexture(item.label, item.color, hl, item.emoji);
        const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
        const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const cube = new THREE.Mesh(geo, mat);
        cube.position.x = startX + i * spacing;
        cube.position.y = hl ? 0.25 : 0;
        groupRef.current!.add(cube);

        // Pointer arrow to next node
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, pointerHighlight === i);
          groupRef.current!.add(arrow);
        }

        // HEAD/TAIL labels
        if (i === 0 || i === data.length - 1) {
          const canvas = document.createElement('canvas');
          canvas.width = 128; canvas.height = 32;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = i === 0 ? '#ff0000' : '#0066ff';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(i === 0 ? 'HEAD' : 'TAIL', 64, 22);
          const t = new THREE.CanvasTexture(canvas);
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
          s.position.set(startX + i * spacing, 0.6, 0);
          s.scale.set(0.5, 0.12, 1);
          groupRef.current!.add(s);
        }
      });

      // NULL at end
      const nullCanvas = document.createElement('canvas');
      nullCanvas.width = 64; nullCanvas.height = 64;
      const nctx = nullCanvas.getContext('2d')!;
      nctx.fillStyle = '#ff0000';
      nctx.font = 'bold 24px Arial';
      nctx.textAlign = 'center';
      nctx.fillText('NULL', 32, 40);
      const nullTex = new THREE.CanvasTexture(nullCanvas);
      const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
      nullSprite.position.set(startX + data.length * spacing - 0.3, 0, 0);
      nullSprite.scale.set(0.5, 0.5, 1);
      groupRef.current!.add(nullSprite);

      // Arrow to NULL
      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
      groupRef.current!.add(nullArrow);

    } else {
      // ARRAY: Horizontal boxes
      const startX = -((data.length - 1) * spacing) / 2;
      data.forEach((item, i) => {
        const hl1 = highlightIndex === i;
        const hl2 = highlightIndex2 === i;
        const hl = hl1 || hl2;
        const tex = createTexture(item.label, hl1 ? '#ffff00' : hl2 ? '#ff00ff' : item.color, false);
        const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.1, roughness: 0.5 });
        const geo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const cube = new THREE.Mesh(geo, mat);
        cube.position.x = startX + i * spacing;
        cube.position.y = hl ? 0.25 : 0;
        groupRef.current!.add(cube);

        // Index label
        const c = document.createElement('canvas');
        c.width = 64; c.height = 32;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = hl1 ? '#ffff00' : hl2 ? '#ff00ff' : '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`[${i}]`, 32, 22);
        const t = new THREE.CanvasTexture(c);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
        s.position.set(startX + i * spacing, -0.55, 0);
        s.scale.set(0.35, 0.17, 1);
        groupRef.current!.add(s);
      });
    }

  }, [data, highlightIndex, highlightIndex2, pointerHighlight, structure, createTexture, createArrow]);

  return (
    <div ref={containerRef}
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
