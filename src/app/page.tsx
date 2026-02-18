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
type AppMode = 'person' | 'webxr';

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

  // ==================== WEBXR STATE ====================
  const [appMode, setAppMode] = useState<AppMode>('person');
  const [webxrSupported, setWebxrSupported] = useState(false);
  const [webxrActive, setWebxrActive] = useState(false);
  const [webxrPlaced, setWebxrPlaced] = useState(false);
  const [webxrStatus, setWebxrStatus] = useState('');
  const webxrSessionRef = useRef<any>(null);
  const webxrRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const webxrSceneRef = useRef<THREE.Scene | null>(null);
  const webxrCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const webxrGroupRef = useRef<THREE.Group | null>(null);
  const webxrHitTestSourceRef = useRef<any>(null);
  const webxrReticleRef = useRef<THREE.Mesh | null>(null);
  const webxrPlacedPositionRef = useRef<THREE.Matrix4 | null>(null);

  // ==================== ALL DATA ====================

  const [groceryItems, setGroceryItems] = useState<DataItem[]>([
    { id: 1, label: 'Milk', color: '#3498db' },
    { id: 2, label: 'Bread', color: '#e67e22' },
    { id: 3, label: 'Eggs', color: '#f1c40f' },
    { id: 4, label: 'Apple', color: '#e74c3c' },
    { id: 5, label: 'Juice', color: '#9b59b6' },
  ]);

  const [students, setStudents] = useState<DataItem[]>([
    { id: 1, label: 'Alex', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Beth', color: '#e91e63', appearance: { skinTone: '#f5d0c5', shirtColor: '#e91e63', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Carl', color: '#27ae60', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
    { id: 4, label: 'Dana', color: '#f39c12', appearance: { skinTone: '#ffcd94', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' } },
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
    { id: 1, label: 'Alice', color: '#e74c3c', appearance: { skinTone: '#ffdbac', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 2, label: 'Bob', color: '#3498db', appearance: { skinTone: '#8d5524', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
    { id: 3, label: 'Carol', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' } },
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
    { id: 1, label: 'Stu 1', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Stu 2', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Stu 3', color: '#9b59b6', appearance: { skinTone: '#8d5524', shirtColor: '#9b59b6', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
  ]);

  // ==================== HELPERS ====================

  const zoomIn = useCallback(() => setZoomLevel(prev => prev + 0.25), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.1)), []);
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

  // ==================== CHECK WEBXR SUPPORT ====================

  useEffect(() => {
    const checkWebXR = async () => {
      if (navigator.xr) {
        try {
          const supported = await navigator.xr.isSessionSupported('immersive-ar');
          setWebxrSupported(supported);
        } catch (e) {
          setWebxrSupported(false);
        }
      } else {
        setWebxrSupported(false);
      }
    };
    checkWebXR();
  }, []);

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

  // ==================== PERSON DETECTION ====================

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    if (appMode !== 'person') return;

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
  }, [model, appMode]);

  // ==================== WEBXR SESSION ====================

  const startWebXR = useCallback(async () => {
    if (!navigator.xr || !webxrSupported) {
      setWebxrStatus('WebXR not supported on this device');
      return;
    }

    try {
      setWebxrStatus('Starting AR session...');

      // Stop regular camera
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.style.display = 'none';

      // Create WebXR renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.setClearColor(0x000000, 0);
      webxrRendererRef.current = renderer;

      // Add canvas to DOM
      const webxrCanvas = renderer.domElement;
      webxrCanvas.style.position = 'fixed';
      webxrCanvas.style.top = '0';
      webxrCanvas.style.left = '0';
      webxrCanvas.style.width = '100vw';
      webxrCanvas.style.height = '100vh';
      webxrCanvas.style.zIndex = '5';
      document.body.appendChild(webxrCanvas);

      // Scene
      const scene = new THREE.Scene();
      webxrSceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
      webxrCameraRef.current = camera;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 10, 7);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-5, 5, -5);
      scene.add(backLight);

      // Reticle (circle on floor showing where to place)
      const reticleGeo = new THREE.RingGeometry(0.05, 0.07, 32);
      const reticleMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.rotation.x = -Math.PI / 2;
      reticle.visible = false;
      scene.add(reticle);
      webxrReticleRef.current = reticle;

      // Inner dot
      const dotGeo = new THREE.CircleGeometry(0.02, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      reticle.add(dot);

      // 3D Group (will hold data structure)
      const group = new THREE.Group();
      group.visible = false;
      scene.add(group);
      webxrGroupRef.current = group;

      // Request AR session
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('webxr-overlay')! }
      });

      webxrSessionRef.current = session;
      renderer.xr.setReferenceSpaceType('local');
      await renderer.xr.setSession(session);

      // Hit test source
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      webxrHitTestSourceRef.current = hitTestSource;

      setWebxrActive(true);
      setWebxrPlaced(false);
      setWebxrStatus('Point at floor, then tap to place');

      // Select event (tap to place)
      session.addEventListener('select', () => {
        if (webxrReticleRef.current && webxrReticleRef.current.visible && !webxrPlaced) {
          const matrix = new THREE.Matrix4();
          matrix.copy(webxrReticleRef.current.matrix);
          webxrPlacedPositionRef.current = matrix;

          if (webxrGroupRef.current) {
            webxrGroupRef.current.position.setFromMatrixPosition(matrix);
            webxrGroupRef.current.visible = true;
            webxrGroupRef.current.scale.setScalar(0.3);
          }

          if (webxrReticleRef.current) {
            webxrReticleRef.current.visible = false;
          }

          setWebxrPlaced(true);
          setWebxrStatus('Placed! Use operations below');
        }
      });

      // Session end
      session.addEventListener('end', () => {
        setWebxrActive(false);
        setWebxrPlaced(false);
        setWebxrStatus('');
        webxrSessionRef.current = null;
        webxrHitTestSourceRef.current = null;

        // Remove WebXR canvas
        if (webxrCanvas.parentNode) {
          webxrCanvas.parentNode.removeChild(webxrCanvas);
        }

        // Restart regular camera
        if (videoRef.current) videoRef.current.style.display = 'block';
        startCamera(cameraFacing);
      });

      // Render loop
      renderer.setAnimationLoop((timestamp: number, frame: any) => {
        if (!frame) return;

        // Hit test (find floor)
        if (webxrHitTestSourceRef.current && !webxrPlaced) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          if (referenceSpace) {
            const hitTestResults = frame.getHitTestResults(webxrHitTestSourceRef.current);
            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              const pose = hit.getPose(referenceSpace);
              if (pose && webxrReticleRef.current) {
                webxrReticleRef.current.visible = true;
                webxrReticleRef.current.matrix.fromArray(pose.transform.matrix);
                webxrReticleRef.current.position.setFromMatrixPosition(webxrReticleRef.current.matrix);
                webxrReticleRef.current.quaternion.setFromRotationMatrix(webxrReticleRef.current.matrix);
              }
            } else {
              if (webxrReticleRef.current) webxrReticleRef.current.visible = false;
            }
          }
        }

        renderer.render(scene, camera);
      });

    } catch (err: any) {
      console.error('WebXR error:', err);
      setWebxrStatus(`Error: ${err.message}`);
      setWebxrActive(false);

      // Restart regular camera
      if (videoRef.current) videoRef.current.style.display = 'block';
      startCamera(cameraFacing);
    }
  }, [webxrSupported, stream, cameraFacing, startCamera, webxrPlaced]);

  const stopWebXR = useCallback(() => {
    if (webxrSessionRef.current) {
      webxrSessionRef.current.end();
    }
  }, []);

  // ==================== MODE SWITCHING ====================

  const switchToMode = useCallback((mode: AppMode) => {
    if (mode === appMode) return;

    if (mode === 'webxr') {
      if (!webxrSupported) {
        setWebxrStatus('❌ WebXR not supported on this device/browser');
        return;
      }
      setAppMode('webxr');
      setDetectedPerson(null);
      setPersonPosition(null);
      startWebXR();
    } else {
      // Switch back to person mode
      if (webxrActive) stopWebXR();
      setAppMode('person');
      setWebxrStatus('');
      setWebxrPlaced(false);
    }
  }, [appMode, webxrSupported, webxrActive, startWebXR, stopWebXR]);

  // ==================== UPDATE WEBXR 3D SCENE ====================

  useEffect(() => {
    if (!webxrActive || !webxrPlaced || !webxrGroupRef.current) return;

    // Clear previous
    while (webxrGroupRef.current.children.length > 0) {
      webxrGroupRef.current.remove(webxrGroupRef.current.children[0]);
    }

    // We dispatch a custom event to tell the scene builder to update
    // The actual 3D building happens in Part 2
    window.dispatchEvent(new CustomEvent('webxr-update-scene', {
      detail: {
        group: webxrGroupRef.current,
        data: getCurrentData(),
        structure: currentStructure,
        environment: currentStructure === 'array' ? arrayEnv :
          currentStructure === 'linkedlist' ? linkedListEnv :
            currentStructure === 'stack' ? stackEnv : queueEnv,
        highlightIndex,
        highlightIndex2,
      }
    }));
  }, [webxrActive, webxrPlaced, getCurrentData(), currentStructure, arrayEnv, linkedListEnv, stackEnv, queueEnv, highlightIndex, highlightIndex2]);

  // ==================== DETERMINE ACTIVE STATE ====================

  const showVisualization = appMode === 'person' ? !!detectedPerson : (webxrActive && webxrPlaced);
  const showPersonViz = appMode === 'person' && !!detectedPerson && personPosition;

  // ==================== OPERATIONS (EXACTLY THE SAME) ====================

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
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
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
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
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
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
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

  if (error) return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ fontSize: 80 }}>📷</div>
      <h2>Camera Access Needed</h2>
      <button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white' }}>🔄 Try Again</button>
    </div>
  );

  if (isLoading) return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2>
      <p>{loadingText}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const currentEnvId = currentStructure === 'array' ? arrayEnv : currentStructure === 'linkedlist' ? linkedListEnv : currentStructure === 'stack' ? stackEnv : queueEnv;
  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv : currentStructure === 'linkedlist' ? setLinkedListEnv : currentStructure === 'stack' ? setStackEnv : setQueueEnv;
  const envTabs = currentStructure === 'array'
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* WebXR DOM Overlay - UI shown during AR session */}
      <div id="webxr-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {/* All UI elements go here during WebXR */}
        </div>
      </div>

      {/* Person Mode 3D */}
      {showPersonViz && personPosition && (
        <Visualization3D
          position={personPosition}
          data={getCurrentData()}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          structure={currentStructure}
          environment={currentEnvId}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
        />
      )}

      {/* ==================== TOP BAR ==================== */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 300 }}>

        {/* Camera Switch (only in person mode) */}
        {appMode === 'person' && (
          <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 300 }}>🔄</button>
        )}

        {/* WebXR: Exit button */}
        {appMode === 'webxr' && webxrActive && (
          <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid #e74c3c', background: 'rgba(231,76,60,0.8)', color: 'white', fontSize: 18, fontWeight: 'bold', zIndex: 300 }}>✕</button>
        )}

        {/* MODE TOGGLE */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3,
          border: '1px solid rgba(255,255,255,0.2)', zIndex: 300,
        }}>
          <button onClick={() => switchToMode('person')} style={{
            padding: '8px 14px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
            background: appMode === 'person' ? '#667eea' : 'transparent',
            color: 'white', opacity: appMode === 'person' ? 1 : 0.5, cursor: 'pointer',
          }}>🧑 Person</button>
          <button onClick={() => switchToMode('webxr')} style={{
            padding: '8px 14px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
            background: appMode === 'webxr' ? '#00b894' : 'transparent',
            color: 'white', opacity: appMode === 'webxr' ? 1 : (webxrSupported ? 0.5 : 0.3), cursor: 'pointer',
          }}>🌐 WebXR {!webxrSupported && '⚠️'}</button>
        </div>

        {/* Zoom Controls (person mode only) */}
        {appMode === 'person' && showPersonViz && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={() => zoomIn()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={() => zoomOut()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={() => resetZoom()} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

        {/* Data Structure Tabs */}
        <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25, zIndex: 300 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
            <button key={s} onClick={() => !isAnimating && setCurrentStructure(s)} style={{
              padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20,
              background: currentStructure === s ? '#667eea' : 'transparent',
              color: 'white', opacity: currentStructure === s ? 1 : 0.6,
            }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]} {currentStructure === s && { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
            </button>
          ))}
        </div>

        {/* Environment Tabs */}
        {showVisualization && (
          <div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20, zIndex: 300 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as any)(e.id)} style={{
                padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15,
                background: currentEnvId === e.id ? '#00b894' : 'transparent',
                color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6,
              }}>{e.icon} {e.label}</button>
            ))}
          </div>
        )}

        {/* Operation Messages */}
        {operationMessage && (
          <div style={{ position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px', borderRadius: 15, fontSize: 14, border: '1px solid #0f0', whiteSpace: 'nowrap', zIndex: 300 }}>
            ⚡ {operationMessage}
          </div>
        )}
        {codeDisplay && (
          <div style={{ position: 'absolute', top: 168, left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444', zIndex: 300 }}>
            {codeDisplay}
          </div>
        )}

        {/* WebXR Status */}
        {webxrStatus && (
          <div style={{ position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#00b894', padding: '10px 20px', borderRadius: 15, fontSize: 13, border: '1px solid #00b894', whiteSpace: 'nowrap', zIndex: 300 }}>
            🌐 {webxrStatus}
          </div>
        )}
      </div>

      {/* ==================== BOTTOM PANEL ==================== */}
      {showVisualization && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (
              <>
                <OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpBtn onClick={arrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Insert" />
                <OpBtn onClick={arrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="➖ Delete" />
                <OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
              </>
            )}
            {currentStructure === 'linkedlist' && (
              <>
                <OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" />
                <OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" />
                <OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" />
                <OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" />
              </>
            )}
            {currentStructure === 'stack' && (
              <>
                <OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
                <OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" />
                <OpBtn onClick={stackPeek} disabled={isAnimating} color="#f39c12" label="👁️ Peek" />
              </>
            )}
            {currentStructure === 'queue' && (
              <>
                <OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
                <OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" />
                <OpBtn onClick={queueFront} disabled={isAnimating} color="#f39c12" label="👁️ Front" />
              </>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {getCurrentData().length}
            {appMode === 'webxr' && <span style={{ marginLeft: 10, color: '#00b894' }}>🌐 WebXR Mode</span>}
          </div>
        </div>
      )}

      {/* ==================== PROMPT MESSAGES ==================== */}

      {/* Person mode: no person */}
      {appMode === 'person' && !detectedPerson && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center', zIndex: 200 }}>
          <div style={{ fontSize: 40 }}>🧑</div>
          <div style={{ marginTop: 8 }}>Point camera at a person</div>
          {webxrSupported && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>or switch to WebXR mode →</div>
          )}
        </div>
      )}

      {/* WebXR: not active yet */}
      {appMode === 'webxr' && !webxrActive && !webxrStatus && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center', zIndex: 200 }}>
          <div style={{ fontSize: 40 }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>Starting WebXR...</div>
        </div>
      )}

      {/* WebXR: active but not placed */}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center', zIndex: 200 }}>
          <div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap Floor to Place</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>
            Point camera at floor/table<br />Green circle = detected surface<br />Tap to place 3D model
          </div>
          <style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      )}

      {/* WebXR not supported warning */}
      {appMode === 'webxr' && !webxrSupported && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(231,76,60,0.9)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center', zIndex: 200 }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>WebXR Not Supported</div>
          <div style={{ fontSize: 12, marginTop: 5 }}>
            This device/browser doesn&apos;t support WebXR.<br />
            Use Chrome on Android for WebXR.<br />
            Switch to Person mode instead.
          </div>
          <button onClick={() => switchToMode('person')} style={{
            marginTop: 15, padding: '10px 25px', background: '#667eea',
            border: 'none', borderRadius: 20, color: 'white', fontWeight: 'bold', fontSize: 14,
          }}>🧑 Switch to Person Mode</button>
        </div>
      )}
    </div>
  );
}

// ==================== OPERATION BUTTON ====================

function OpBtn({ onClick, disabled, color, label }: { onClick: () => void; disabled: boolean; color: string; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25,
      background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  );
}

// ==================== 3D VISUALIZATION COMPONENT ====================
// Used for PERSON MODE (WebXR has its own renderer)

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

  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  // ==================== 3D MODEL CREATORS ====================
  // These are also used by WebXR mode via the shared builder

  const createGroceryBox = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.55, 0.32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.8,
      emissive: isHighlighted ? '#ffff00' : '#000000',
      emissiveIntensity: isHighlighted ? 0.4 : 0
    });
    box.add(new THREE.Mesh(bodyGeo, bodyMat));

    const flapGeo = new THREE.BoxGeometry(0.22, 0.02, 0.32);
    const flapMat = new THREE.MeshStandardMaterial({ color });
    const leftFlap = new THREE.Mesh(flapGeo, flapMat);
    leftFlap.position.set(-0.12, 0.28, 0); leftFlap.rotation.z = -0.4; box.add(leftFlap);
    const rightFlap = new THREE.Mesh(flapGeo, flapMat);
    rightFlap.position.set(0.12, 0.28, 0); rightFlap.rotation.z = 0.4; box.add(rightFlap);

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(5, 5, 118, 70);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, 118, 70);
    ctx.fillStyle = '#000'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
    ctx.fillText(label, 64, 50);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.22),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
    );
    labelMesh.position.z = 0.165; box.add(labelMesh);

    if (isHighlighted) {
      const glowGeo = new THREE.BoxGeometry(0.5, 0.6, 0.37);
      const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
      box.add(new THREE.Mesh(glowGeo, glowMat));
    }
    return box;
  }, []);

  const createHuman3D = useCallback((appearance: HumanAppearance, name: string, isHighlighted: boolean): THREE.Group => {
    const human = new THREE.Group();
    const hlEmit = isHighlighted ? 0.4 : 0;

    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.09, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: appearance.skinTone,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: hlEmit * 0.3
    });
    headGroup.add(new THREE.Mesh(headGeo, headMat));

    if (appearance.hairStyle !== 'bald') {
      const hairGeo = appearance.hairStyle === 'long'
        ? new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55)
        : new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
      const hair = new THREE.Mesh(hairGeo, hairMat); hair.position.y = 0.015; headGroup.add(hair);
      if (appearance.hairStyle === 'long') {
        const backHairGeo = new THREE.CapsuleGeometry(0.035, 0.1, 8, 16);
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, -0.07, -0.04); headGroup.add(backHair);
      }
    }

    const eyeGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#fff' });
    const pupilGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    [-0.028, 0.028].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      eye.position.set(x, 0.01, 0.075); eye.scale.z = 0.5; headGroup.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(x, 0.01, 0.085); headGroup.add(pupil);
    });

    const browGeo = new THREE.BoxGeometry(0.025, 0.005, 0.005);
    const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
    [-0.028, 0.028].forEach((x, i) => {
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(x, 0.035, 0.075); brow.rotation.z = i === 0 ? -0.1 : 0.1;
      headGroup.add(brow);
    });

    const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: appearance.skinTone }));
    nose.position.set(0, -0.005, 0.085); nose.rotation.x = Math.PI; headGroup.add(nose);

    const smileGeo = new THREE.TorusGeometry(0.018, 0.003, 8, 16, Math.PI);
    const smile = new THREE.Mesh(smileGeo, new THREE.MeshStandardMaterial({ color: '#c0392b' }));
    smile.position.set(0, -0.035, 0.075); smile.rotation.x = Math.PI; headGroup.add(smile);

    const earGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-0.085, 0.085].forEach(x => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(x, 0, 0); ear.scale.set(0.5, 0.8, 0.6); headGroup.add(ear);
    });

    headGroup.position.y = 0.32; human.add(headGroup);

    const neckGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.04, 16);
    const neck = new THREE.Mesh(neckGeo, new THREE.MeshStandardMaterial({ color: appearance.skinTone }));
    neck.position.y = 0.21; human.add(neck);

    const torsoGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: appearance.shirtColor,
      emissive: isHighlighted ? '#ffff00' : '#000',
      emissiveIntensity: hlEmit
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.11; human.add(torso);

    const armGeo = new THREE.CapsuleGeometry(0.014, 0.09, 8, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
    const skinArmMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-1, 1].forEach(side => {
      const armGroup = new THREE.Group();
      armGroup.add(new THREE.Mesh(armGeo, armMat));
      const lowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.06, 8, 16), skinArmMat);
      lowerArm.position.y = -0.09; armGroup.add(lowerArm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), skinArmMat);
      hand.position.y = -0.14; hand.scale.set(0.7, 0.9, 0.5); armGroup.add(hand);
      armGroup.position.set(side * 0.085, 0.1, 0); armGroup.rotation.z = side * 0.2;
      human.add(armGroup);
    });

    const hips = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: appearance.pantsColor })
    );
    hips.position.y = 0.01; human.add(hips);

    const legGeo = new THREE.CapsuleGeometry(0.02, 0.1, 8, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    [-0.028, 0.028].forEach(x => {
      const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(x, -0.07, 0); human.add(leg);
    });

    const shoeGeo = new THREE.BoxGeometry(0.032, 0.015, 0.045);
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    [-0.028, 0.028].forEach(x => {
      const shoe = new THREE.Mesh(shoeGeo, shoeMat); shoe.position.set(x, -0.135, 0.008); human.add(shoe);
    });

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128; labelCanvas.height = 32;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = isHighlighted ? '#ffff00' : 'rgba(0,0,0,0.8)';
    lctx.beginPath(); lctx.roundRect(0, 0, 128, 32, 8); lctx.fill();
    lctx.fillStyle = isHighlighted ? '#000' : '#fff';
    lctx.font = 'bold 18px Arial'; lctx.textAlign = 'center'; lctx.fillText(name, 64, 22);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.y = 0.48; labelSprite.scale.set(0.32, 0.08, 1); human.add(labelSprite);

    if (isHighlighted) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.12, 32),
        new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
      );
      ring.position.y = -0.14; ring.rotation.x = -Math.PI / 2; human.add(ring);
    }
    return human;
  }, []);

  const createClipboard = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const clipboard = new THREE.Group();
    const boardMat = new THREE.MeshStandardMaterial({
      color: '#8b4513', roughness: 0.7,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0
    });
    clipboard.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.025), boardMat));
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.8 })
    );
    clip.position.set(0, 0.27, 0.025); clipboard.add(clip);

    const paperCanvas = document.createElement('canvas');
    paperCanvas.width = 128; paperCanvas.height = 180;
    const pctx = paperCanvas.getContext('2d')!;
    pctx.fillStyle = '#ffffff'; pctx.fillRect(0, 0, 128, 180);
    pctx.fillStyle = color; pctx.fillRect(0, 0, 128, 30);
    pctx.fillStyle = '#ffffff'; pctx.font = 'bold 16px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 64, 22);
    pctx.strokeStyle = '#e0e0e0'; pctx.lineWidth = 1;
    for (let y = 50; y < 170; y += 18) { pctx.beginPath(); pctx.moveTo(10, y); pctx.lineTo(118, y); pctx.stroke(); }
    pctx.strokeStyle = '#333'; pctx.lineWidth = 2; pctx.strokeRect(12, 55, 14, 14);
    if (isHighlighted) {
      pctx.strokeStyle = '#2ecc71'; pctx.lineWidth = 3;
      pctx.beginPath(); pctx.moveTo(14, 62); pctx.lineTo(19, 67); pctx.lineTo(26, 57); pctx.stroke();
    }
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.45),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(paperCanvas) })
    );
    paper.position.z = 0.015; clipboard.add(paper);
    return clipboard;
  }, []);

  const createTrainCar = useCallback((isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const train = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color, metalness: 0.3, roughness: 0.7,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.4 : 0
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.28), bodyMat);
    body.position.y = 0.1; train.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
    roof.position.y = 0.285; train.add(roof);

    const under = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
    under.position.y = -0.08; train.add(under);

    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
    [[-0.2, -0.06, 0.14], [0.2, -0.06, 0.14], [-0.2, -0.06, -0.14], [0.2, -0.06, -0.14]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); train.add(w);
      const h = new THREE.Mesh(hubGeo, hubMat); h.rotation.x = Math.PI / 2; h.position.set(x, y, z); train.add(h);
    });

    if (!isEngine) {
      const winGeo = new THREE.PlaneGeometry(0.08, 0.07);
      const winMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.3 });
      [-0.18, 0, 0.18].forEach(x => {
        const wF = new THREE.Mesh(winGeo, winMat); wF.position.set(x, 0.15, 0.141); train.add(wF);
        const wB = new THREE.Mesh(winGeo, winMat); wB.position.set(x, 0.15, -0.141); train.add(wB);
      });
    }

    if (isEngine) {
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 20), new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.4 }));
      boiler.rotation.z = Math.PI / 2; boiler.position.set(0.44, 0.1, 0); train.add(boiler);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
      chimney.position.set(0.15, 0.38, 0); train.add(chimney);
      const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.5 });
      [0.48, 0.55, 0.63].forEach((y, i) => {
        const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), smokeMat);
        smoke.position.set(0.15, y, 0); smoke.scale.setScalar(1 + i * 0.25); train.add(smoke);
      });
      const catcher = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
      catcher.position.set(0.55, -0.02, 0); train.add(catcher);
    }

    const hookMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
    [-0.34, 0.34].forEach(x => {
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), hookMat);
      hook.position.set(x, 0, 0); train.add(hook);
    });

    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isHighlighted ? '#ffff00' : '#fff';
    ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 64, 24);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    labelSprite.position.y = 0.45; labelSprite.scale.set(0.4, 0.1, 1); train.add(labelSprite);
    return train;
  }, []);

  const createDomino = useCallback((value: string, isHighlighted: boolean): THREE.Group => {
    const domino = new THREE.Group();
    const tileMat = new THREE.MeshStandardMaterial({
      color: isHighlighted ? '#1abc9c' : '#ecf0f1',
      emissive: isHighlighted ? '#1abc9c' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0
    });
    domino.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.06), tileMat));
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.01), new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
    line.position.z = 0.031; domino.add(line);
    const border = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.46, 0.02), new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
    border.position.z = -0.025; domino.add(border);

    const dotGeo = new THREE.CircleGeometry(0.018, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#2c3e50', side: THREE.DoubleSide });
    const val = parseInt(value) || 1;
    const topDots: [number, number][] = [];
    if (val >= 1) topDots.push([0, 0.14]);
    if (val >= 2) topDots.push([-0.05, 0.2]);
    if (val >= 3) topDots.push([0.05, 0.08]);
    topDots.forEach(([x, y]) => { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(x, y, 0.032); domino.add(d); });
    topDots.forEach(([x, y]) => { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(-x, -y, 0.032); domino.add(d); });

    if (isHighlighted) {
      domino.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.49, 0.02), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.3 })));
    }
    return domino;
  }, []);

  const createBook = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const book = new THREE.Group();
    const coverMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.6,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    book.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.38), coverMat));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.055, 0.35), new THREE.MeshStandardMaterial({ color: '#f5f5dc' }));
    pages.position.x = 0.01; book.add(pages);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.38), new THREE.MeshStandardMaterial({ color: '#5d4037' }));
    spine.position.x = -0.285; book.add(spine);

    const sCanvas = document.createElement('canvas'); sCanvas.width = 32; sCanvas.height = 128;
    const sctx = sCanvas.getContext('2d')!;
    sctx.fillStyle = '#ffd700'; sctx.save(); sctx.translate(16, 64); sctx.rotate(-Math.PI / 2);
    sctx.font = 'bold 18px serif'; sctx.textAlign = 'center'; sctx.fillText(label, 0, 6); sctx.restore();
    const sLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sCanvas), transparent: true }));
    sLabel.position.set(-0.296, 0, 0); sLabel.rotation.y = -Math.PI / 2; book.add(sLabel);

    const cCanvas = document.createElement('canvas'); cCanvas.width = 128; cCanvas.height = 128;
    const cctx = cCanvas.getContext('2d')!;
    cctx.fillStyle = '#ffd700'; cctx.font = 'bold 24px serif'; cctx.textAlign = 'center'; cctx.fillText(label, 64, 70);
    const cLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cCanvas), transparent: true }));
    cLabel.position.y = 0.036; cLabel.rotation.x = -Math.PI / 2; book.add(cLabel);
    return book;
  }, []);

  const createPlate = useCallback((_label: string, isHighlighted: boolean): THREE.Group => {
    const plate = new THREE.Group();
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#ecf0f1', roughness: 0.3, metalness: 0.1,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0
    });
    plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.025, 32), plateMat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 16, 32), new THREE.MeshStandardMaterial({ color: '#bdc3c7' }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.012; plate.add(rim);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 32), new THREE.MeshStandardMaterial({ color: '#3498db', side: THREE.DoubleSide }));
    innerRing.rotation.x = -Math.PI / 2; innerRing.position.y = 0.014; plate.add(innerRing);
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide }));
    center.rotation.x = -Math.PI / 2; center.position.y = 0.015; plate.add(center);
    return plate;
  }, []);

  const createCardboardBox = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.9,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    box.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), bodyMat));
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.42), new THREE.MeshStandardMaterial({ color: '#d4a574' }));
    tape.position.y = 0.18; box.add(tape);
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
    [[-0.245, 0, 0.195], [0.245, 0, 0.195], [-0.245, 0, -0.195], [0.245, 0, -0.195]].forEach(([x, y, z]) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.35, 0.01), edgeMat);
      edge.position.set(x, y, z); box.add(edge);
    });

    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 80);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 124, 76);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(5, 5, 118, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('FRAGILE', 64, 20);
    ctx.fillStyle = '#000'; ctx.font = 'bold 22px Arial'; ctx.fillText(label, 64, 55);
    const lMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
    lMesh.position.z = 0.201; box.add(lMesh);
    return box;
  }, []);

  const createCar = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color, metalness: 0.6, roughness: 0.4,
      emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), bodyMat); body.position.y = 0.08; car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.24), bodyMat); cabin.position.set(-0.05, 0.22, 0); car.add(cabin);

    const wsMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.3, side: THREE.DoubleSide });
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.1), wsMat);
    ws.position.set(0.1, 0.22, 0); ws.rotation.y = Math.PI / 2; ws.rotation.z = 0.2; car.add(ws);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.1), wsMat);
    rw.position.set(-0.2, 0.22, 0); rw.rotation.y = Math.PI / 2; rw.rotation.z = -0.2; car.add(rw);
    [-1, 1].forEach(s => { const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.08), wsMat); sw.position.set(-0.05, 0.22, s * 0.121); car.add(sw); });

    const wGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20);
    const wMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const hGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12);
    const hMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
    [[-0.18, -0.02, 0.14], [0.18, -0.02, 0.14], [-0.18, -0.02, -0.14], [0.18, -0.02, -0.14]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wGeo, wMat); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); car.add(w);
      const h = new THREE.Mesh(hGeo, hMat); h.rotation.x = Math.PI / 2; h.position.set(x, y, z); car.add(h);
    });

    const lGeo = new THREE.CircleGeometry(0.025, 16);
    [-0.08, 0.08].forEach(z => {
      car.add(Object.assign(new THREE.Mesh(lGeo, new THREE.MeshBasicMaterial({ color: '#ffffcc' })), { position: new THREE.Vector3(0.276, 0.08, z), rotation: new THREE.Euler(0, Math.PI / 2, 0) }));
      car.add(Object.assign(new THREE.Mesh(lGeo, new THREE.MeshBasicMaterial({ color: '#ff0000' })), { position: new THREE.Vector3(-0.276, 0.08, z), rotation: new THREE.Euler(0, -Math.PI / 2, 0) }));
    });

    const pCanvas = document.createElement('canvas'); pCanvas.width = 64; pCanvas.height = 24;
    const pctx = pCanvas.getContext('2d')!;
    pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 64, 24);
    pctx.fillStyle = '#000'; pctx.font = 'bold 12px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 32, 17);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pCanvas) }));
    plate.position.set(-0.276, 0.02, 0); plate.rotation.y = -Math.PI / 2; car.add(plate);
    return car;
  }, []);

  const createTicket = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const ticket = new THREE.Group();
    const tMat = new THREE.MeshStandardMaterial({ color, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0 });
    ticket.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.01), tMat));
    const stub = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.01), new THREE.MeshStandardMaterial({ color }));
    stub.position.x = 0.25; ticket.add(stub);
    const dotGeo = new THREE.CircleGeometry(0.005, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
    for (let y = -0.1; y <= 0.1; y += 0.02) { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(0.195, y, 0.006); ticket.add(d); }

    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 180; i += 10) ctx.fillRect(i, 0, 5, 100);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('ADMIT ONE', 70, 25);
    ctx.font = 'bold 28px Arial'; ctx.fillText(label, 70, 60);
    const tLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    tLabel.position.z = 0.006; ticket.add(tLabel);
    return ticket;
  }, []);

  const createChair = useCallback((x: number): THREE.Group => {
    const chair = new THREE.Group();
    const wMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
    chair.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.22), wMat), { position: new THREE.Vector3(0, -0.18, 0) }));
    chair.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.02), wMat), { position: new THREE.Vector3(0, -0.08, -0.1) }));
    const lGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
    [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(lGeo, wMat); leg.position.set(lx, ly, lz); chair.add(leg);
    });
    chair.position.x = x;
    return chair;
  }, []);

  const createArrow = useCallback((fromX: number, toX: number, isHighlighted: boolean): THREE.Group => {
    const arrow = new THREE.Group();
    const color = isHighlighted ? 0xffff00 : 0x00ff00;
    const points = [new THREE.Vector3(fromX + 0.35, 0, 0), new THREE.Vector3(toX - 0.35, 0, 0)];
    arrow.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color })));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), new THREE.MeshBasicMaterial({ color }));
    cone.position.set(toX - 0.4, 0, 0); cone.rotation.z = -Math.PI / 2; arrow.add(cone);
    return arrow;
  }, []);

  const createTextSprite = useCallback((text: string, color: string, fontSize: number = 20): THREE.Sprite => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color; ctx.font = `bold ${fontSize}px Arial`; ctx.textAlign = 'center'; ctx.fillText(text, 64, 32);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  }, []);

  // ==================== SHARED SCENE BUILDER ====================
  // Used by BOTH person mode AND WebXR mode

  const buildScene = useCallback((group: THREE.Group, data: DataItem[], str: DataStructure, env: string, hlIdx: number | null, hlIdx2: number | null) => {
    while (group.children.length > 0) group.remove(group.children[0]);

    const spacing = str === 'linkedlist' ? 1.1 : str === 'queue' ? 0.9 : 0.85;
    const startX = -((data.length - 1) * spacing) / 2;

    if (str === 'array') {
      if (env === 'grocery') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i || hlIdx2 === i;
          const box = createGroceryBox(item.color, item.label, isHl);
          box.position.set(startX + i * spacing, isHl ? 0.15 : 0, 0); group.add(box);
          const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
          idx.position.set(startX + i * spacing, -0.45, 0); idx.scale.set(0.3, 0.15, 1); group.add(idx);
        });
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 }));
        shelf.position.y = -0.32; group.add(shelf);
        [-data.length * spacing / 2 - 0.2, data.length * spacing / 2 + 0.2].forEach(x => {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: '#5d4037' }));
          s.position.set(x, -0.55, 0); group.add(s);
        });
      } else if (env === 'classroom') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i || hlIdx2 === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0); human.scale.setScalar(0.8); group.add(human);
            const chair = createChair(startX + i * spacing); chair.scale.setScalar(0.8); group.add(chair);
          }
          const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
          idx.position.set(startX + i * spacing, -0.38, 0); idx.scale.set(0.25, 0.12, 1); group.add(idx);
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1, 0.8), new THREE.MeshStandardMaterial({ color: '#7f8c8d', side: THREE.DoubleSide }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.32; group.add(floor);
      } else if (env === 'todo') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i || hlIdx2 === i;
          const cb = createClipboard(item.label, item.color, isHl);
          cb.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0); cb.scale.setScalar(0.75); group.add(cb);
          const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
          idx.position.set(startX + i * spacing, -0.45, 0); idx.scale.set(0.25, 0.12, 1); group.add(idx);
        });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.5, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: '#5d4037' }));
        desk.position.y = -0.28; group.add(desk);
      }
    } else if (str === 'linkedlist') {
      const addLinkedListLabels = () => {
        const hs = createTextSprite('HEAD', '#ff0000', 20); hs.position.set(startX, 0.55, 0); hs.scale.set(0.35, 0.14, 1); group.add(hs);
        const ns = createTextSprite('NULL', '#ff0000', 22); ns.position.set(startX + data.length * spacing, env === 'people' ? 0.1 : (env === 'domino' ? -0.35 : 0), 0); ns.scale.set(0.35, 0.25, 1); group.add(ns);
        const na = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.15, false);
        na.position.y = env === 'people' ? 0.1 : (env === 'domino' ? -0.35 : -0.15); group.add(na);
      };

      if (env === 'train') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const tc = createTrainCar(i === 0, item.color, item.label, isHl);
          tc.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0); tc.scale.setScalar(0.85); group.add(tc);
          if (i < data.length - 1) { const a = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); a.position.y = -0.15; group.add(a); }
        });
        const ts = createTextSprite('TAIL', '#0066ff', 20); ts.position.set(startX + (data.length - 1) * spacing, 0.55, 0); ts.scale.set(0.35, 0.14, 1); group.add(ts);
        addLinkedListLabels();
        const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
        const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
        [-0.12, 0.12].forEach(z => { const r = new THREE.Mesh(railGeo, railMat); r.position.set(0, -0.12, z); group.add(r); });
        const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
        const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.2) { const t = new THREE.Mesh(tieGeo, tieMat); t.position.set(x, -0.13, 0); group.add(t); }
      } else if (env === 'people') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          if (item.appearance) { const h = createHuman3D(item.appearance, item.label, isHl); h.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0); h.scale.setScalar(0.75); group.add(h); }
          if (i < data.length - 1) { const a = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); a.position.y = 0.1; group.add(a); }
        });
        addLinkedListLabels();
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1, 0.5), new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.17; group.add(floor);
      } else if (env === 'domino') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const d = createDomino(item.label, isHl); d.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0); d.scale.setScalar(0.9); group.add(d);
          if (i < data.length - 1) { const a = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); a.position.y = -0.35; group.add(a); }
        });
        addLinkedListLabels();
        const table = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.8, 0.03, 0.5), new THREE.MeshStandardMaterial({ color: '#27ae60' }));
        table.position.y = -0.28; group.add(table);
      }
    } else if (str === 'stack') {
      const stackSpacing = 0.12;
      const baseY = -data.length * stackSpacing / 2;
      const addTopLabel = (yPos: number) => {
        const ts = createTextSprite('← TOP', '#ff0000', 22);
        ts.position.set(0.6, yPos, 0); ts.scale.set(0.4, 0.15, 1); group.add(ts);
      };

      if (env === 'books') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const b = createBook(item.label, item.color, isHl);
          b.position.set(isHl ? 0.2 : 0, baseY + i * stackSpacing, 0); b.rotation.y = (i % 2 === 0) ? 0 : 0.05; group.add(b);
          if (i === data.length - 1) addTopLabel(baseY + i * stackSpacing);
        });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: '#5d4037' }));
        desk.position.y = baseY - 0.08; group.add(desk);
      } else if (env === 'plates') {
        const ps = 0.045; const pBase = -data.length * ps / 2;
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const p = createPlate(item.label, isHl); p.position.set(isHl ? 0.15 : 0, pBase + i * ps, 0); p.scale.setScalar(0.7); group.add(p);
          if (i === data.length - 1) { const ts = createTextSprite('← TOP', '#ff0000', 22); ts.position.set(0.45, pBase + i * ps, 0); ts.scale.set(0.35, 0.12, 1); group.add(ts); }
        });
        const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.3 }));
        counter.position.y = pBase - 0.06; group.add(counter);
      } else if (env === 'boxes') {
        const bs = 0.42; const bBase = -data.length * bs / 2 + 0.2;
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const b = createCardboardBox(item.label, item.color, isHl);
          b.position.set(isHl ? 0.2 : 0, bBase + i * bs, 0); b.rotation.y = (i % 2 === 0) ? 0 : 0.08; b.scale.setScalar(0.85); group.add(b);
          if (i === data.length - 1) { const ts = createTextSprite('← TOP', '#ff0000', 22); ts.position.set(0.55, bBase + i * bs, 0); ts.scale.set(0.35, 0.12, 1); group.add(ts); }
        });
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: '#a0522d' }));
        pallet.position.y = bBase - 0.22; group.add(pallet);
      }
    } else if (str === 'queue') {
      const addQueueLabels = () => {
        const fs = createTextSprite('FRONT', '#00ff00', 18); fs.position.set(startX, -0.25, 0); fs.scale.set(0.3, 0.12, 1); group.add(fs);
        const rs = createTextSprite('REAR', '#ff6600', 18); rs.position.set(startX + (data.length - 1) * spacing, -0.25, 0); rs.scale.set(0.3, 0.12, 1); group.add(rs);
      };

      if (env === 'tollgate') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const c = createCar(item.color, item.label, isHl);
          c.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0); c.scale.setScalar(0.85); group.add(c);
        });
        addQueueLabels();
        const gateX = startX - 0.7;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12), new THREE.MeshStandardMaterial({ color: '#f1c40f' }));
        pole.position.set(gateX, 0.2, 0.25); group.add(pole);
        const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
        barrier.position.set(gateX - 0.25, 0.45, 0.25); barrier.rotation.z = 0.3; group.add(barrier);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2, 0.6), new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide }));
        road.rotation.x = -Math.PI / 2; road.position.y = -0.08; group.add(road);
        const lineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
        for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.5; x += 0.3) {
          const dl = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.03), lineMat); dl.rotation.x = -Math.PI / 2; dl.position.set(x, -0.075, 0); group.add(dl);
        }
        const es = createTextSprite('→', '#00ff00', 36); es.position.set(gateX - 0.5, 0, 0); es.scale.set(0.4, 0.25, 1); group.add(es);
      } else if (env === 'tickets') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          const t = createTicket(item.label, item.color, isHl);
          t.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0); t.scale.setScalar(0.85); group.add(t);
        });
        addQueueLabels();
        const counter = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4), new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
        counter.position.y = -0.15; group.add(counter);
      } else if (env === 'students') {
        data.forEach((item, i) => {
          const isHl = hlIdx === i;
          if (item.appearance) { const h = createHuman3D(item.appearance, item.label, isHl); h.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0); h.scale.setScalar(0.7); group.add(h); }
        });
        addQueueLabels();
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.3), new THREE.MeshStandardMaterial({ color: '#8b4513' }));
        door.position.set(startX - 0.7, 0.1, 0); group.add(door);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.35), new THREE.MeshStandardMaterial({ color: '#5d4037' }));
        frame.position.set(startX - 0.72, 0.1, 0); group.add(frame);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.5), new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.15; group.add(floor);
      }
    }
  }, [createGroceryBox, createHuman3D, createClipboard, createTrainCar, createDomino, createBook, createPlate, createCardboardBox, createCar, createTicket, createChair, createArrow, createTextSprite]);

  // ==================== LISTEN FOR WEBXR SCENE UPDATES ====================

  useEffect(() => {
    const handleWebXRUpdate = (e: any) => {
      const { group, data: d, structure: s, environment: env, highlightIndex: hi, highlightIndex2: hi2 } = e.detail;
      buildScene(group, d, s, env, hi, hi2);
    };
    window.addEventListener('webxr-update-scene', handleWebXRUpdate);
    return () => window.removeEventListener('webxr-update-scene', handleWebXRUpdate);
  }, [buildScene]);

  // ==================== THREE.JS SETUP (PERSON MODE) ====================

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene(); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.2 : 0.5, structure === 'stack' ? 5 : 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(renderWidth, renderHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7); dirLight.castShadow = true; scene.add(dirLight);
    scene.add(Object.assign(new THREE.DirectionalLight(0xffffff, 0.3), { position: new THREE.Vector3(-5, 5, -5) }));
    scene.add(Object.assign(new THREE.PointLight(0xffffff, 0.3), { position: new THREE.Vector3(0, -3, 3) }));

    const group = new THREE.Group(); groupRef.current = group; scene.add(group);

    let isDragging = false, lastX = 0, lastY = 0;
    let pinchDist: number | null = null, pinchZoom = 1;
    const getDist = (t: TouchList): number | null => {
      if (t.length < 2) return null;
      return Math.sqrt((t[0].clientX - t[1].clientX) ** 2 + (t[0].clientY - t[1].clientY) ** 2);
    };

    const onTS = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2) { pinchDist = getDist(e.touches); pinchZoom = zoomRef.current; } else if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTM = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2 && pinchDist !== null) { const d = getDist(e.touches); if (d) setZoomLevel(Math.max(0.1, pinchZoom * (d / pinchDist))); } else if (e.touches.length === 1 && isDragging) { rotationRef.current.y += (e.touches[0].clientX - lastX) * 0.01; rotationRef.current.x += (e.touches[0].clientY - lastY) * 0.008; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTE = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length < 2) pinchDist = null; if (e.touches.length === 0) isDragging = false; };
    const onMD = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMM = (e: MouseEvent) => { if (!isDragging) return; rotationRef.current.y += (e.clientX - lastX) * 0.01; rotationRef.current.x += (e.clientY - lastY) * 0.008; lastX = e.clientX; lastY = e.clientY; };
    const onMU = () => { isDragging = false; };
    const onWh = (e: WheelEvent) => { e.preventDefault(); setZoomLevel(Math.max(0.1, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15))); };

    container.addEventListener('touchstart', onTS, { passive: false });
    container.addEventListener('touchmove', onTM, { passive: false });
    container.addEventListener('touchend', onTE, { passive: false });
    container.addEventListener('mousedown', onMD); container.addEventListener('mousemove', onMM);
    container.addEventListener('mouseup', onMU); container.addEventListener('mouseleave', onMU);
    container.addEventListener('wheel', onWh, { passive: false });

    let animId: number;
    const animate = () => {
      if (groupRef.current) { groupRef.current.rotation.x = rotationRef.current.x; groupRef.current.rotation.y = rotationRef.current.y; groupRef.current.scale.setScalar(zoomRef.current); }
      renderer.render(scene, camera); animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('touchstart', onTS); container.removeEventListener('touchmove', onTM); container.removeEventListener('touchend', onTE);
      container.removeEventListener('mousedown', onMD); container.removeEventListener('mousemove', onMM); container.removeEventListener('mouseup', onMU); container.removeEventListener('mouseleave', onMU);
      container.removeEventListener('wheel', onWh);
      renderer.dispose(); if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure, renderWidth, renderHeight]);

  // ==================== UPDATE PERSON MODE SCENE ====================

  useEffect(() => {
    if (!groupRef.current) return;
    buildScene(groupRef.current, data, structure, environment, highlightIndex, highlightIndex2);
  }, [data, highlightIndex, highlightIndex2, structure, environment, buildScene]);

  // ==================== RENDER ====================

  return (
    <div ref={containerRef} style={{
      position: 'absolute', left: 0, top: 0,
      width: '100vw', height: '100vh',
      zIndex: 50, touchAction: 'none',
      pointerEvents: 'auto', overflow: 'visible',
    }} />
  );
}
// ==================== PART 2 GOES BELOW ====================
