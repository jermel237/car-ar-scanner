// ==================== 3D VISUALIZATION COMPONENT ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode }: {
  position: Position;
  data: DataItem[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  structure: DataStructure;
  environment: string;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  // ==================== CHANGED: Full screen size, no box limits ====================
  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  // Anchor point (where 3D centers around)
  const anchorX = position.x + position.width / 2;
  const anchorY = position.y + position.height / 2;

  // ==================== ALL YOUR 3D MODEL CREATORS (EXACTLY THE SAME) ====================

  const createGroceryBox = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.55, 0.32);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8, emissive: isHighlighted ? '#ffff00' : '#000000', emissiveIntensity: isHighlighted ? 0.4 : 0 });
    box.add(new THREE.Mesh(bodyGeo, bodyMat));
    const flapGeo = new THREE.BoxGeometry(0.22, 0.02, 0.32);
    const flapMat = new THREE.MeshStandardMaterial({ color: color });
    const leftFlap = new THREE.Mesh(flapGeo, flapMat);
    leftFlap.position.set(-0.12, 0.28, 0); leftFlap.rotation.z = -0.4; box.add(leftFlap);
    const rightFlap = new THREE.Mesh(flapGeo, flapMat);
    rightFlap.position.set(0.12, 0.28, 0); rightFlap.rotation.z = 0.4; box.add(rightFlap);
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(5, 5, 118, 70);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, 118, 70);
    ctx.fillStyle = '#000'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 64, 50);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
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
    const headMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: hlEmit * 0.3 });
    headGroup.add(new THREE.Mesh(headGeo, headMat));
    if (appearance.hairStyle !== 'bald') {
      const hairGeo = appearance.hairStyle === 'long' ? new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55) : new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
      const hair = new THREE.Mesh(hairGeo, hairMat); hair.position.y = 0.015; headGroup.add(hair);
      if (appearance.hairStyle === 'long') {
        const backHairGeo = new THREE.CapsuleGeometry(0.035, 0.1, 8, 16);
        const backHair = new THREE.Mesh(backHairGeo, hairMat); backHair.position.set(0, -0.07, -0.04); headGroup.add(backHair);
      }
    }
    const eyeGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#fff' });
    const pupilGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    [-0.028, 0.028].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat); eye.position.set(x, 0.01, 0.075); eye.scale.z = 0.5; headGroup.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat); pupil.position.set(x, 0.01, 0.085); headGroup.add(pupil);
    });
    const browGeo = new THREE.BoxGeometry(0.025, 0.005, 0.005);
    const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
    [-0.028, 0.028].forEach((x, i) => { const brow = new THREE.Mesh(browGeo, browMat); brow.position.set(x, 0.035, 0.075); brow.rotation.z = i === 0 ? -0.1 : 0.1; headGroup.add(brow); });
    const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const nose = new THREE.Mesh(noseGeo, noseMat); nose.position.set(0, -0.005, 0.085); nose.rotation.x = Math.PI; headGroup.add(nose);
    const smileGeo = new THREE.TorusGeometry(0.018, 0.003, 8, 16, Math.PI);
    const smileMat = new THREE.MeshStandardMaterial({ color: '#c0392b' });
    const smile = new THREE.Mesh(smileGeo, smileMat); smile.position.set(0, -0.035, 0.075); smile.rotation.x = Math.PI; headGroup.add(smile);
    const earGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-0.085, 0.085].forEach(x => { const ear = new THREE.Mesh(earGeo, earMat); ear.position.set(x, 0, 0); ear.scale.set(0.5, 0.8, 0.6); headGroup.add(ear); });
    headGroup.position.y = 0.32; human.add(headGroup);
    const neckGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.04, 16);
    const neckMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const neck = new THREE.Mesh(neckGeo, neckMat); neck.position.y = 0.21; human.add(neck);
    const torsoGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16);
    const torsoMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: hlEmit });
    const torso = new THREE.Mesh(torsoGeo, torsoMat); torso.position.y = 0.11; human.add(torso);
    const armGeo = new THREE.CapsuleGeometry(0.014, 0.09, 8, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
    const skinArmMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    [-1, 1].forEach(side => {
      const armGroup = new THREE.Group();
      armGroup.add(new THREE.Mesh(armGeo, armMat));
      const lowerArmGeo = new THREE.CapsuleGeometry(0.011, 0.06, 8, 16);
      const lowerArm = new THREE.Mesh(lowerArmGeo, skinArmMat); lowerArm.position.y = -0.09; armGroup.add(lowerArm);
      const handGeo = new THREE.SphereGeometry(0.018, 12, 12);
      const hand = new THREE.Mesh(handGeo, skinArmMat); hand.position.y = -0.14; hand.scale.set(0.7, 0.9, 0.5); armGroup.add(hand);
      armGroup.position.set(side * 0.085, 0.1, 0); armGroup.rotation.z = side * 0.2; human.add(armGroup);
    });
    const hipsGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.04, 16);
    const hipsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    const hips = new THREE.Mesh(hipsGeo, hipsMat); hips.position.y = 0.01; human.add(hips);
    const legGeo = new THREE.CapsuleGeometry(0.02, 0.1, 8, 16);
    const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
    [-0.028, 0.028].forEach(x => { const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(x, -0.07, 0); human.add(leg); });
    const shoeGeo = new THREE.BoxGeometry(0.032, 0.015, 0.045);
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    [-0.028, 0.028].forEach(x => { const shoe = new THREE.Mesh(shoeGeo, shoeMat); shoe.position.set(x, -0.135, 0.008); human.add(shoe); });
    const labelCanvas = document.createElement('canvas'); labelCanvas.width = 128; labelCanvas.height = 32;
    const lctx = labelCanvas.getContext('2d')!;
    lctx.fillStyle = isHighlighted ? '#ffff00' : 'rgba(0,0,0,0.8)';
    lctx.beginPath(); lctx.roundRect(0, 0, 128, 32, 8); lctx.fill();
    lctx.fillStyle = isHighlighted ? '#000' : '#fff'; lctx.font = 'bold 18px Arial'; lctx.textAlign = 'center'; lctx.fillText(name, 64, 22);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.y = 0.48; labelSprite.scale.set(0.32, 0.08, 1); human.add(labelSprite);
    if (isHighlighted) {
      const ringGeo = new THREE.RingGeometry(0.07, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = -0.14; ring.rotation.x = -Math.PI / 2; human.add(ring);
    }
    return human;
  }, []);

  const createClipboard = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const clipboard = new THREE.Group();
    const boardGeo = new THREE.BoxGeometry(0.38, 0.5, 0.025);
    const boardMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
    clipboard.add(new THREE.Mesh(boardGeo, boardMat));
    const clipGeo = new THREE.BoxGeometry(0.12, 0.05, 0.04);
    const clipMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.8 });
    const clip = new THREE.Mesh(clipGeo, clipMat); clip.position.set(0, 0.27, 0.025); clipboard.add(clip);
    const paperCanvas = document.createElement('canvas'); paperCanvas.width = 128; paperCanvas.height = 180;
    const pctx = paperCanvas.getContext('2d')!;
    pctx.fillStyle = '#ffffff'; pctx.fillRect(0, 0, 128, 180);
    pctx.fillStyle = color; pctx.fillRect(0, 0, 128, 30);
    pctx.fillStyle = '#ffffff'; pctx.font = 'bold 16px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 64, 22);
    pctx.strokeStyle = '#e0e0e0'; pctx.lineWidth = 1;
    for (let y = 50; y < 170; y += 18) { pctx.beginPath(); pctx.moveTo(10, y); pctx.lineTo(118, y); pctx.stroke(); }
    pctx.strokeStyle = '#333'; pctx.lineWidth = 2; pctx.strokeRect(12, 55, 14, 14);
    if (isHighlighted) { pctx.strokeStyle = '#2ecc71'; pctx.lineWidth = 3; pctx.beginPath(); pctx.moveTo(14, 62); pctx.lineTo(19, 67); pctx.lineTo(26, 57); pctx.stroke(); }
    const paperTex = new THREE.CanvasTexture(paperCanvas);
    const paperMat = new THREE.MeshBasicMaterial({ map: paperTex });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.45), paperMat); paper.position.z = 0.015; clipboard.add(paper);
    return clipboard;
  }, []);

  const createTrainCar = useCallback((isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const train = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.65, 0.32, 0.28);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.3, roughness: 0.7, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.4 : 0 });
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 0.1; train.add(body);
    const roofGeo = new THREE.BoxGeometry(0.6, 0.05, 0.26);
    const roofMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.y = 0.285; train.add(roof);
    const underGeo = new THREE.BoxGeometry(0.6, 0.04, 0.22);
    const underMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const under = new THREE.Mesh(underGeo, underMat); under.position.y = -0.08; train.add(under);
    const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    [[-0.2, -0.06, 0.14], [0.2, -0.06, 0.14], [-0.2, -0.06, -0.14], [0.2, -0.06, -0.14]].forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, y, z); train.add(wheel);
      const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
      const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
      const hub = new THREE.Mesh(hubGeo, hubMat); hub.rotation.x = Math.PI / 2; hub.position.set(x, y, z); train.add(hub);
    });
    if (!isEngine) {
      const windowGeo = new THREE.PlaneGeometry(0.08, 0.07);
      const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.3 });
      [-0.18, 0, 0.18].forEach(x => {
        const wF = new THREE.Mesh(windowGeo, windowMat); wF.position.set(x, 0.15, 0.141); train.add(wF);
        const wB = new THREE.Mesh(windowGeo, windowMat); wB.position.set(x, 0.15, -0.141); train.add(wB);
      });
    }
    if (isEngine) {
      const boilerGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.22, 20);
      const boilerMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.4 });
      const boiler = new THREE.Mesh(boilerGeo, boilerMat); boiler.rotation.z = Math.PI / 2; boiler.position.set(0.44, 0.1, 0); train.add(boiler);
      const chimneyGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12);
      const chimneyMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat); chimney.position.set(0.15, 0.38, 0); train.add(chimney);
      const smokeGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.5 });
      [0.48, 0.55, 0.63].forEach((y, i) => { const smoke = new THREE.Mesh(smokeGeo, smokeMat); smoke.position.set(0.15, y, 0); smoke.scale.setScalar(1 + i * 0.25); train.add(smoke); });
      const catcherGeo = new THREE.BoxGeometry(0.04, 0.08, 0.22);
      const catcherMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
      const catcher = new THREE.Mesh(catcherGeo, catcherMat); catcher.position.set(0.55, -0.02, 0); train.add(catcher);
    }
    const hookGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
    const hookMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
    [-0.34, 0.34].forEach(x => { const hook = new THREE.Mesh(hookGeo, hookMat); hook.position.set(x, 0, 0); train.add(hook); });
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isHighlighted ? '#ffff00' : '#fff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 64, 24);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.y = 0.45; labelSprite.scale.set(0.4, 0.1, 1); train.add(labelSprite);
    return train;
  }, []);

  const createDomino = useCallback((value: string, isHighlighted: boolean): THREE.Group => {
    const domino = new THREE.Group();
    const tileGeo = new THREE.BoxGeometry(0.22, 0.45, 0.06);
    const tileMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#1abc9c' : '#ecf0f1', emissive: isHighlighted ? '#1abc9c' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
    domino.add(new THREE.Mesh(tileGeo, tileMat));
    const lineGeo = new THREE.BoxGeometry(0.18, 0.008, 0.01);
    const lineMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const line = new THREE.Mesh(lineGeo, lineMat); line.position.z = 0.031; domino.add(line);
    const borderGeo = new THREE.BoxGeometry(0.23, 0.46, 0.02);
    const borderMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
    const border = new THREE.Mesh(borderGeo, borderMat); border.position.z = -0.025; domino.add(border);
    const dotGeo = new THREE.CircleGeometry(0.018, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#2c3e50', side: THREE.DoubleSide });
    const val = parseInt(value) || 1;
    const topDotPositions: [number, number][] = [];
    if (val >= 1) topDotPositions.push([0, 0.14]);
    if (val >= 2) topDotPositions.push([-0.05, 0.2]);
    if (val >= 3) topDotPositions.push([0.05, 0.08]);
    topDotPositions.forEach(([x, y]) => { const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.set(x, y, 0.032); domino.add(dot); });
    topDotPositions.forEach(([x, y]) => { const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.set(-x, -y, 0.032); domino.add(dot); });
    if (isHighlighted) {
      const glowGeo = new THREE.BoxGeometry(0.26, 0.49, 0.02);
      const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.3 });
      domino.add(new THREE.Mesh(glowGeo, glowMat));
    }
    return domino;
  }, []);

  const createBook = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const book = new THREE.Group();
    const coverGeo = new THREE.BoxGeometry(0.55, 0.07, 0.38);
    const coverMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0 });
    book.add(new THREE.Mesh(coverGeo, coverMat));
    const pagesGeo = new THREE.BoxGeometry(0.52, 0.055, 0.35);
    const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc' });
    const pages = new THREE.Mesh(pagesGeo, pagesMat); pages.position.x = 0.01; book.add(pages);
    const spineGeo = new THREE.BoxGeometry(0.02, 0.07, 0.38);
    const spineMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
    const spine = new THREE.Mesh(spineGeo, spineMat); spine.position.x = -0.285; book.add(spine);
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffd700'; ctx.save(); ctx.translate(16, 64); ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.fillText(label, 0, 6); ctx.restore();
    const spineTex = new THREE.CanvasTexture(canvas);
    const spineLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.32), new THREE.MeshBasicMaterial({ map: spineTex, transparent: true }));
    spineLabel.position.set(-0.296, 0, 0); spineLabel.rotation.y = -Math.PI / 2; book.add(spineLabel);
    const coverCanvas = document.createElement('canvas'); coverCanvas.width = 128; coverCanvas.height = 128;
    const cctx = coverCanvas.getContext('2d')!;
    cctx.fillStyle = '#ffd700'; cctx.font = 'bold 24px serif'; cctx.textAlign = 'center'; cctx.fillText(label, 64, 70);
    const coverTex = new THREE.CanvasTexture(coverCanvas);
    const coverLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshBasicMaterial({ map: coverTex, transparent: true }));
    coverLabel.position.y = 0.036; coverLabel.rotation.x = -Math.PI / 2; book.add(coverLabel);
    return book;
  }, []);

  const createPlate = useCallback((label: string, isHighlighted: boolean): THREE.Group => {
    const plate = new THREE.Group();
    const plateGeo = new THREE.CylinderGeometry(0.28, 0.26, 0.025, 32);
    const plateMat = new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 0.3, metalness: 0.1, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
    plate.add(new THREE.Mesh(plateGeo, plateMat));
    const rimGeo = new THREE.TorusGeometry(0.27, 0.012, 16, 32);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#bdc3c7' });
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.012; plate.add(rim);
    const innerRingGeo = new THREE.RingGeometry(0.12, 0.16, 32);
    const innerRingMat = new THREE.MeshStandardMaterial({ color: '#3498db', side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat); innerRing.rotation.x = -Math.PI / 2; innerRing.position.y = 0.014; plate.add(innerRing);
    const centerGeo = new THREE.CircleGeometry(0.06, 32);
    const centerMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide });
    const center = new THREE.Mesh(centerGeo, centerMat); center.rotation.x = -Math.PI / 2; center.position.y = 0.015; plate.add(center);
    return plate;
  }, []);

  const createCardboardBox = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const box = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0 });
    box.add(new THREE.Mesh(bodyGeo, bodyMat));
    const tapeGeo = new THREE.BoxGeometry(0.08, 0.01, 0.42);
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574' });
    const tape = new THREE.Mesh(tapeGeo, tapeMat); tape.position.y = 0.18; box.add(tape);
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
    const vEdgeGeo = new THREE.BoxGeometry(0.01, 0.35, 0.01);
    [[-0.245, 0, 0.195], [0.245, 0, 0.195], [-0.245, 0, -0.195], [0.245, 0, -0.195]].forEach(([x, y, z]) => {
      const edge = new THREE.Mesh(vEdgeGeo, edgeMat); edge.position.set(x, y, z); box.add(edge);
    });
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 80);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, 124, 76);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(5, 5, 118, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('FRAGILE', 64, 20);
    ctx.fillStyle = '#000'; ctx.font = 'bold 22px Arial'; ctx.fillText(label, 64, 55);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ map: labelTex }));
    labelMesh.position.z = 0.201; box.add(labelMesh);
    return box;
  }, []);

  const createCar = useCallback((color: string, label: string, isHighlighted: boolean): THREE.Group => {
    const car = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.18, 0.28);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.4, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0 });
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 0.08; car.add(body);
    const cabinGeo = new THREE.BoxGeometry(0.3, 0.12, 0.24);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat); cabin.position.set(-0.05, 0.22, 0); car.add(cabin);
    const windshieldGeo = new THREE.PlaneGeometry(0.24, 0.1);
    const windshieldMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.3, side: THREE.DoubleSide });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0.1, 0.22, 0); windshield.rotation.y = Math.PI / 2; windshield.rotation.z = 0.2; car.add(windshield);
    const rearWindow = new THREE.Mesh(windshieldGeo, windshieldMat);
    rearWindow.position.set(-0.2, 0.22, 0); rearWindow.rotation.y = Math.PI / 2; rearWindow.rotation.z = -0.2; car.add(rearWindow);
    const sideWindowGeo = new THREE.PlaneGeometry(0.18, 0.08);
    [-1, 1].forEach(side => { const sw = new THREE.Mesh(sideWindowGeo, windshieldMat); sw.position.set(-0.05, 0.22, side * 0.121); car.add(sw); });
    const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
    [[-0.18, -0.02, 0.14], [0.18, -0.02, 0.14], [-0.18, -0.02, -0.14], [0.18, -0.02, -0.14]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); car.add(w);
      const h = new THREE.Mesh(hubGeo, hubMat); h.rotation.x = Math.PI / 2; h.position.set(x, y, z); car.add(h);
    });
    const lightGeo = new THREE.CircleGeometry(0.025, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    [-0.08, 0.08].forEach(z => { const l = new THREE.Mesh(lightGeo, lightMat); l.position.set(0.276, 0.08, z); l.rotation.y = Math.PI / 2; car.add(l); });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    [-0.08, 0.08].forEach(z => { const t = new THREE.Mesh(lightGeo, tailMat); t.position.set(-0.276, 0.08, z); t.rotation.y = -Math.PI / 2; car.add(t); });
    const plateCanvas = document.createElement('canvas'); plateCanvas.width = 64; plateCanvas.height = 24;
    const pctx = plateCanvas.getContext('2d')!;
    pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 64, 24);
    pctx.fillStyle = '#000'; pctx.font = 'bold 12px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 32, 17);
    const plateTex = new THREE.CanvasTexture(plateCanvas);
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), new THREE.MeshBasicMaterial({ map: plateTex }));
    plateMesh.position.set(-0.276, 0.02, 0); plateMesh.rotation.y = -Math.PI / 2; car.add(plateMesh);
    return car;
  }, []);

  const createTicket = useCallback((label: string, color: string, isHighlighted: boolean): THREE.Group => {
    const ticket = new THREE.Group();
    const ticketGeo = new THREE.BoxGeometry(0.4, 0.22, 0.01);
    const ticketMat = new THREE.MeshStandardMaterial({ color: color, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.35 : 0 });
    ticket.add(new THREE.Mesh(ticketGeo, ticketMat));
    const stubGeo = new THREE.BoxGeometry(0.1, 0.22, 0.01);
    const stubMat = new THREE.MeshStandardMaterial({ color: color });
    const stub = new THREE.Mesh(stubGeo, stubMat); stub.position.x = 0.25; ticket.add(stub);
    const dotGeo = new THREE.CircleGeometry(0.005, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
    for (let y = -0.1; y <= 0.1; y += 0.02) { const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.set(0.195, y, 0.006); ticket.add(dot); }
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 180; i += 10) { ctx.fillRect(i, 0, 5, 100); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('ADMIT ONE', 70, 25);
    ctx.font = 'bold 28px Arial'; ctx.fillText(label, 70, 60);
    ctx.font = '12px Arial'; ctx.fillText('⭐ VIP ⭐', 70, 85);
    ctx.font = 'bold 14px Arial'; ctx.save(); ctx.translate(155, 50); ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore();
    const ticketTex = new THREE.CanvasTexture(canvas);
    const ticketLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), new THREE.MeshBasicMaterial({ map: ticketTex, transparent: true }));
    ticketLabel.position.z = 0.006; ticket.add(ticketLabel);
    return ticket;
  }, []);

  const createChair = useCallback((x: number): THREE.Group => {
    const chair = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
    const seatGeo = new THREE.BoxGeometry(0.22, 0.025, 0.22);
    const seat = new THREE.Mesh(seatGeo, woodMat); seat.position.y = -0.18; chair.add(seat);
    const backGeo = new THREE.BoxGeometry(0.22, 0.18, 0.02);
    const back = new THREE.Mesh(backGeo, woodMat); back.position.set(0, -0.08, -0.1); chair.add(back);
    const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
    [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat); leg.position.set(lx, ly, lz); chair.add(leg);
    });
    chair.position.x = x;
    return chair;
  }, []);

  const createArrow = useCallback((fromX: number, toX: number, isHighlighted: boolean): THREE.Group => {
    const arrow = new THREE.Group();
    const color = isHighlighted ? 0xffff00 : 0x00ff00;
    const points = [new THREE.Vector3(fromX + 0.35, 0, 0), new THREE.Vector3(toX - 0.35, 0, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color });
    arrow.add(new THREE.Line(lineGeo, lineMat));
    const coneGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
    const coneMat = new THREE.MeshBasicMaterial({ color });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(toX - 0.4, 0, 0); cone.rotation.z = -Math.PI / 2;
    arrow.add(cone);
    return arrow;
  }, []);

  // ==================== CHANGED: THREE.JS SETUP - Full screen renderer ====================

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // CHANGED: Use full screen dimensions
    const camera = new THREE.PerspectiveCamera(50, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.2 : 0.5, structure === 'stack' ? 5 : 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // CHANGED: Full screen size
    renderer.setSize(renderWidth, renderHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

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

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // CHANGED: Removed zoom limits - now unlimited
    let isDragging = false, lastX = 0, lastY = 0;
    let pinchDist: number | null = null, pinchZoom = 1;

    const getDistance = (t: TouchList): number | null => {
      if (t.length < 2) return null;
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) { pinchDist = getDistance(e.touches); pinchZoom = zoomRef.current; }
      else if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const dist = getDistance(e.touches);
        // CHANGED: No max limit on zoom
        if (dist) { const scale = dist / pinchDist; setZoomLevel(Math.max(0.1, pinchZoom * scale)); }
      } else if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
        rotationRef.current.y += dx * 0.01;
        rotationRef.current.x = Math.max(-1.5, Math.min(1.5, rotationRef.current.x + dy * 0.008));
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) pinchDist = null;
      if (e.touches.length === 0) isDragging = false;
    };
    const onMouseDown = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      rotationRef.current.y += (e.clientX - lastX) * 0.01;
      rotationRef.current.x = Math.max(-1.5, Math.min(1.5, rotationRef.current.x + (e.clientY - lastY) * 0.008));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // CHANGED: No max limit on zoom
      setZoomLevel(Math.max(0.1, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15)));
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

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
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure, renderWidth, renderHeight]);

  // ==================== UPDATE SCENE (EXACTLY THE SAME) ====================

  useEffect(() => {
    if (!groupRef.current) return;
    while (groupRef.current.children.length > 0) groupRef.current.remove(groupRef.current.children[0]);

    const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 0.9 : 0.85;
    const startX = -((data.length - 1) * spacing) / 2;

    if (structure === 'array') {
      if (environment === 'grocery') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          const box = createGroceryBox(item.color, item.label, isHl);
          box.position.x = startX + i * spacing; box.position.y = isHl ? 0.15 : 0;
          groupRef.current!.add(box);
          const indexCanvas = document.createElement('canvas'); indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.45, 0); indexSprite.scale.set(0.3, 0.15, 1);
          groupRef.current!.add(indexSprite);
        });
        const shelfGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.5);
        const shelfMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 });
        const shelf = new THREE.Mesh(shelfGeo, shelfMat); shelf.position.y = -0.32; groupRef.current!.add(shelf);
        const supportGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        [-data.length * spacing / 2 - 0.2, data.length * spacing / 2 + 0.2].forEach(x => {
          const support = new THREE.Mesh(supportGeo, shelfMat); support.position.set(x, -0.55, 0); groupRef.current!.add(support);
        });
      } else if (environment === 'classroom') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing; human.position.y = isHl ? 0.08 : 0; human.scale.setScalar(0.8);
            groupRef.current!.add(human);
            const chair = createChair(startX + i * spacing); chair.scale.setScalar(0.8); groupRef.current!.add(chair);
          }
          const indexCanvas = document.createElement('canvas'); indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.38, 0); indexSprite.scale.set(0.25, 0.12, 1);
          groupRef.current!.add(indexSprite);
        });
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.8);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.32; groupRef.current!.add(floor);
      } else if (environment === 'todo') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i || highlightIndex2 === i;
          const clipboard = createClipboard(item.label, item.color, isHl);
          clipboard.position.x = startX + i * spacing; clipboard.position.y = isHl ? 0.12 : 0; clipboard.scale.setScalar(0.75);
          groupRef.current!.add(clipboard);
          const indexCanvas = document.createElement('canvas'); indexCanvas.width = 64; indexCanvas.height = 32;
          const ctx = indexCanvas.getContext('2d')!;
          ctx.fillStyle = isHl ? '#ffff00' : '#ffffff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText(`[${i}]`, 32, 24);
          const indexTex = new THREE.CanvasTexture(indexCanvas);
          const indexSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: indexTex, transparent: true }));
          indexSprite.position.set(startX + i * spacing, -0.45, 0); indexSprite.scale.set(0.25, 0.12, 1);
          groupRef.current!.add(indexSprite);
        });
        const deskGeo = new THREE.BoxGeometry(data.length * spacing + 0.5, 0.03, 0.4);
        const deskMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const desk = new THREE.Mesh(deskGeo, deskMat); desk.position.y = -0.28; groupRef.current!.add(desk);
      }
    } else if (structure === 'linkedlist') {
      if (environment === 'train') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
          trainCar.position.x = startX + i * spacing; trainCar.position.y = isHl ? 0.12 : 0; trainCar.scale.setScalar(0.85);
          groupRef.current!.add(trainCar);
          if (i < data.length - 1) { const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); arrow.position.y = -0.15; groupRef.current!.add(arrow); }
        });
        const headCanvas = document.createElement('canvas'); headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!; hctx.fillStyle = '#ff0000'; hctx.font = 'bold 20px Arial'; hctx.textAlign = 'center'; hctx.fillText('HEAD', 40, 24);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.55, 0); headSprite.scale.set(0.35, 0.14, 1); groupRef.current!.add(headSprite);
        const tailCanvas = document.createElement('canvas'); tailCanvas.width = 80; tailCanvas.height = 32;
        const tctx = tailCanvas.getContext('2d')!; tctx.fillStyle = '#0066ff'; tctx.font = 'bold 20px Arial'; tctx.textAlign = 'center'; tctx.fillText('TAIL', 40, 24);
        const tailTex = new THREE.CanvasTexture(tailCanvas);
        const tailSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tailTex, transparent: true }));
        tailSprite.position.set(startX + (data.length - 1) * spacing, 0.55, 0); tailSprite.scale.set(0.35, 0.14, 1); groupRef.current!.add(tailSprite);
        const nullCanvas = document.createElement('canvas'); nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!; nctx.fillStyle = '#ff0000'; nctx.font = 'bold 22px Arial'; nctx.textAlign = 'center'; nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, 0, 0); nullSprite.scale.set(0.35, 0.25, 1); groupRef.current!.add(nullSprite);
        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.15, false);
        nullArrow.position.y = -0.15; groupRef.current!.add(nullArrow);
        const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
        const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
        [-0.12, 0.12].forEach(z => { const rail = new THREE.Mesh(railGeo, railMat); rail.position.set(0, -0.12, z); groupRef.current!.add(rail); });
        const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
        const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.2) {
          const tie = new THREE.Mesh(tieGeo, tieMat); tie.position.set(x, -0.13, 0); groupRef.current!.add(tie);
        }
      } else if (environment === 'people') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing; human.position.y = isHl ? 0.08 : 0; human.scale.setScalar(0.75);
            groupRef.current!.add(human);
          }
          if (i < data.length - 1) { const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); arrow.position.y = 0.1; groupRef.current!.add(arrow); }
        });
        const headCanvas = document.createElement('canvas'); headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!; hctx.fillStyle = '#ff0000'; hctx.font = 'bold 18px Arial'; hctx.textAlign = 'center'; hctx.fillText('HEAD', 40, 22);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.55, 0); headSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(headSprite);
        const nullCanvas = document.createElement('canvas'); nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!; nctx.fillStyle = '#ff0000'; nctx.font = 'bold 20px Arial'; nctx.textAlign = 'center'; nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, 0.1, 0); nullSprite.scale.set(0.3, 0.2, 1); groupRef.current!.add(nullSprite);
        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
        nullArrow.position.y = 0.1; groupRef.current!.add(nullArrow);
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.5);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.17; groupRef.current!.add(floor);
      } else if (environment === 'domino') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const domino = createDomino(item.label, isHl);
          domino.position.x = startX + i * spacing; domino.position.y = isHl ? 0.1 : 0; domino.scale.setScalar(0.9);
          groupRef.current!.add(domino);
          if (i < data.length - 1) { const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); arrow.position.y = -0.35; groupRef.current!.add(arrow); }
        });
        const headCanvas = document.createElement('canvas'); headCanvas.width = 80; headCanvas.height = 32;
        const hctx = headCanvas.getContext('2d')!; hctx.fillStyle = '#ff0000'; hctx.font = 'bold 18px Arial'; hctx.textAlign = 'center'; hctx.fillText('HEAD', 40, 22);
        const headTex = new THREE.CanvasTexture(headCanvas);
        const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: headTex, transparent: true }));
        headSprite.position.set(startX, 0.4, 0); headSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(headSprite);
        const nullCanvas = document.createElement('canvas'); nullCanvas.width = 64; nullCanvas.height = 48;
        const nctx = nullCanvas.getContext('2d')!; nctx.fillStyle = '#ff0000'; nctx.font = 'bold 18px Arial'; nctx.textAlign = 'center'; nctx.fillText('NULL', 32, 32);
        const nullTex = new THREE.CanvasTexture(nullCanvas);
        const nullSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nullTex, transparent: true }));
        nullSprite.position.set(startX + data.length * spacing, -0.35, 0); nullSprite.scale.set(0.3, 0.2, 1); groupRef.current!.add(nullSprite);
        const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
        nullArrow.position.y = -0.35; groupRef.current!.add(nullArrow);
        const tableGeo = new THREE.BoxGeometry(data.length * spacing + 0.8, 0.03, 0.5);
        const tableMat = new THREE.MeshStandardMaterial({ color: '#27ae60' });
        const table = new THREE.Mesh(tableGeo, tableMat); table.position.y = -0.28; groupRef.current!.add(table);
      }
    } else if (structure === 'stack') {
      const stackSpacing = 0.12;
      const baseY = -data.length * stackSpacing / 2;
      if (environment === 'books') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const book = createBook(item.label, item.color, isHl);
          book.position.y = baseY + i * stackSpacing; book.position.x = isHl ? 0.2 : 0; book.rotation.y = (i % 2 === 0) ? 0 : 0.05;
          groupRef.current!.add(book);
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas'); topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.6, baseY + i * stackSpacing, 0); topSprite.scale.set(0.4, 0.15, 1); groupRef.current!.add(topSprite);
          }
        });
        const deskGeo = new THREE.BoxGeometry(1.2, 0.04, 0.6);
        const deskMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const desk = new THREE.Mesh(deskGeo, deskMat); desk.position.y = baseY - 0.08; groupRef.current!.add(desk);
      } else if (environment === 'plates') {
        const plateSpacing = 0.045;
        const plateBaseY = -data.length * plateSpacing / 2;
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const plate = createPlate(item.label, isHl);
          plate.position.y = plateBaseY + i * plateSpacing; plate.position.x = isHl ? 0.15 : 0; plate.scale.setScalar(0.7);
          groupRef.current!.add(plate);
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas'); topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.45, plateBaseY + i * plateSpacing, 0); topSprite.scale.set(0.35, 0.12, 1); groupRef.current!.add(topSprite);
          }
        });
        const counterGeo = new THREE.BoxGeometry(0.9, 0.05, 0.5);
        const counterMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.3 });
        const counter = new THREE.Mesh(counterGeo, counterMat); counter.position.y = plateBaseY - 0.06; groupRef.current!.add(counter);
      } else if (environment === 'boxes') {
        const boxSpacing = 0.42;
        const boxBaseY = -data.length * boxSpacing / 2 + 0.2;
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const box = createCardboardBox(item.label, item.color, isHl);
          box.position.y = boxBaseY + i * boxSpacing; box.position.x = isHl ? 0.2 : 0; box.rotation.y = (i % 2 === 0) ? 0 : 0.08; box.scale.setScalar(0.85);
          groupRef.current!.add(box);
          if (i === data.length - 1) {
            const topCanvas = document.createElement('canvas'); topCanvas.width = 80; topCanvas.height = 32;
            const ctx = topCanvas.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText('← TOP', 40, 24);
            const topTex = new THREE.CanvasTexture(topCanvas);
            const topSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: topTex, transparent: true }));
            topSprite.position.set(0.55, boxBaseY + i * boxSpacing, 0); topSprite.scale.set(0.35, 0.12, 1); groupRef.current!.add(topSprite);
          }
        });
        const palletGeo = new THREE.BoxGeometry(0.8, 0.06, 0.6);
        const palletMat = new THREE.MeshStandardMaterial({ color: '#a0522d' });
        const pallet = new THREE.Mesh(palletGeo, palletMat); pallet.position.y = boxBaseY - 0.22; groupRef.current!.add(pallet);
      }
    } else if (structure === 'queue') {
      if (environment === 'tollgate') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const car = createCar(item.color, item.label, isHl);
          car.position.x = startX + i * spacing; car.position.y = isHl ? 0.1 : 0; car.scale.setScalar(0.85);
          groupRef.current!.add(car);
        });
        const frontCanvas = document.createElement('canvas'); frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!; fctx.fillStyle = '#00ff00'; fctx.font = 'bold 18px Arial'; fctx.textAlign = 'center'; fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.25, 0); frontSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(frontSprite);
        const rearCanvas = document.createElement('canvas'); rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!; rctx.fillStyle = '#ff6600'; rctx.font = 'bold 18px Arial'; rctx.textAlign = 'center'; rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0); rearSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(rearSprite);
        const gateX = startX - 0.7;
        const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12);
        const poleMat = new THREE.MeshStandardMaterial({ color: '#f1c40f' });
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(gateX, 0.2, 0.25); groupRef.current!.add(pole);
        const barrierGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
        const barrierMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
        const barrier = new THREE.Mesh(barrierGeo, barrierMat); barrier.position.set(gateX - 0.25, 0.45, 0.25); barrier.rotation.z = 0.3; groupRef.current!.add(barrier);
        const roadGeo = new THREE.PlaneGeometry(data.length * spacing + 2, 0.6);
        const roadMat = new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide });
        const road = new THREE.Mesh(roadGeo, roadMat); road.rotation.x = -Math.PI / 2; road.position.y = -0.08; groupRef.current!.add(road);
        const lineGeo = new THREE.PlaneGeometry(0.15, 0.03);
        const lineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
        for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.5; x += 0.3) {
          const dashLine = new THREE.Mesh(lineGeo, lineMat); dashLine.rotation.x = -Math.PI / 2; dashLine.position.set(x, -0.075, 0); groupRef.current!.add(dashLine);
        }
        const exitCanvas = document.createElement('canvas'); exitCanvas.width = 80; exitCanvas.height = 48;
        const ectx = exitCanvas.getContext('2d')!; ectx.fillStyle = '#00ff00'; ectx.font = 'bold 36px Arial'; ectx.textAlign = 'center'; ectx.fillText('→', 40, 38);
        const exitTex = new THREE.CanvasTexture(exitCanvas);
        const exitSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: exitTex, transparent: true }));
        exitSprite.position.set(gateX - 0.5, 0, 0); exitSprite.scale.set(0.4, 0.25, 1); groupRef.current!.add(exitSprite);
      } else if (environment === 'tickets') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          const ticket = createTicket(item.label, item.color, isHl);
          ticket.position.x = startX + i * spacing; ticket.position.y = isHl ? 0.1 : 0; ticket.scale.setScalar(0.85);
          groupRef.current!.add(ticket);
        });
        const frontCanvas = document.createElement('canvas'); frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!; fctx.fillStyle = '#00ff00'; fctx.font = 'bold 18px Arial'; fctx.textAlign = 'center'; fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.25, 0); frontSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(frontSprite);
        const rearCanvas = document.createElement('canvas'); rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!; rctx.fillStyle = '#ff6600'; rctx.font = 'bold 18px Arial'; rctx.textAlign = 'center'; rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0); rearSprite.scale.set(0.3, 0.12, 1); groupRef.current!.add(rearSprite);
        const counterGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4);
        const counterMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
        const counter = new THREE.Mesh(counterGeo, counterMat); counter.position.y = -0.15; groupRef.current!.add(counter);
      } else if (environment === 'students') {
        data.forEach((item, i) => {
          const isHl = highlightIndex === i;
          if (item.appearance) {
            const human = createHuman3D(item.appearance, item.label, isHl);
            human.position.x = startX + i * spacing; human.position.y = isHl ? 0.08 : 0; human.scale.setScalar(0.7);
            groupRef.current!.add(human);
          }
        });
        const frontCanvas = document.createElement('canvas'); frontCanvas.width = 80; frontCanvas.height = 32;
        const fctx = frontCanvas.getContext('2d')!; fctx.fillStyle = '#00ff00'; fctx.font = 'bold 18px Arial'; fctx.textAlign = 'center'; fctx.fillText('FRONT', 40, 22);
        const frontTex = new THREE.CanvasTexture(frontCanvas);
        const frontSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frontTex, transparent: true }));
        frontSprite.position.set(startX, -0.22, 0); frontSprite.scale.set(0.28, 0.1, 1); groupRef.current!.add(frontSprite);
        const rearCanvas = document.createElement('canvas'); rearCanvas.width = 80; rearCanvas.height = 32;
        const rctx = rearCanvas.getContext('2d')!; rctx.fillStyle = '#ff6600'; rctx.font = 'bold 18px Arial'; rctx.textAlign = 'center'; rctx.fillText('REAR', 40, 22);
        const rearTex = new THREE.CanvasTexture(rearCanvas);
        const rearSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rearTex, transparent: true }));
        rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0); rearSprite.scale.set(0.28, 0.1, 1); groupRef.current!.add(rearSprite);
        const doorGeo = new THREE.BoxGeometry(0.04, 0.5, 0.3);
        const doorMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
        const door = new THREE.Mesh(doorGeo, doorMat); door.position.set(startX - 0.7, 0.1, 0); groupRef.current!.add(door);
        const doorFrameGeo = new THREE.BoxGeometry(0.06, 0.55, 0.35);
        const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
        const doorFrame = new THREE.Mesh(doorFrameGeo, doorFrameMat); doorFrame.position.set(startX - 0.72, 0.1, 0); groupRef.current!.add(doorFrame);
        const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.5);
        const floorMat = new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.15; groupRef.current!.add(floor);
      }
    }
  }, [data, highlightIndex, highlightIndex2, structure, environment, createGroceryBox, createHuman3D, createClipboard, createTrainCar, createDomino, createBook, createPlate, createCardboardBox, createCar, createTicket, createChair, createArrow]);

  // ==================== CHANGED: Container is now full screen, no box ====================

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        // CHANGED: Full screen overlay, no box
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 50,
        touchAction: 'none',
        pointerEvents: 'auto',
        // CHANGED: No border, no background, no clipping
        overflow: 'visible',
      }}
    />
  );
}
