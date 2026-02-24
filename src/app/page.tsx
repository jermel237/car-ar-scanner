'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

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
type AppMode = 'person' | 'surface' | 'webxr';

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

// ==================== EASING FUNCTIONS (Like GSAP) ====================

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number): number => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutElastic = (t: number): number => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
const easeOutBounce = (t: number): number => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  else return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
const easeInOutBack = (t: number): number => {
  const c1 = 1.70158, c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

// ==================== SMOOTH ANIMATION SYSTEM ====================

interface AnimState {
  progress: number;
  startTime: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startRot: THREE.Euler;
  endRot: THREE.Euler;
  startScale: THREE.Vector3;
  endScale: THREE.Vector3;
  easing: (t: number) => number;
}

const activeAnimations = new Map<string, AnimState>();

function animateObject(
  obj: THREE.Object3D,
  targetPos: THREE.Vector3,
  targetRot: THREE.Euler,
  targetScale: THREE.Vector3,
  duration: number,
  easing: (t: number) => number = easeOutCubic,
  id: string = `${obj.uuid}-${Date.now()}`
): Promise<void> {
  return new Promise((resolve) => {
    activeAnimations.set(id, {
      progress: 0,
      startTime: Date.now(),
      duration,
      startPos: obj.position.clone(),
      endPos: targetPos,
      startRot: obj.rotation.clone(),
      endRot: targetRot,
      startScale: obj.scale.clone(),
      endScale: targetScale,
      easing,
    });

    const animate = () => {
      const state = activeAnimations.get(id);
      if (!state) {
        resolve();
        return;
      }

      const elapsed = Date.now() - state.startTime;
      const rawProgress = Math.min(elapsed / state.duration, 1);
      const easedProgress = state.easing(rawProgress);

      obj.position.lerpVectors(state.startPos, state.endPos, easedProgress);
      obj.rotation.x = lerp(state.startRot.x, state.endRot.x, easedProgress);
      obj.rotation.y = lerp(state.startRot.y, state.endRot.y, easedProgress);
      obj.rotation.z = lerp(state.startRot.z, state.endRot.z, easedProgress);
      obj.scale.lerpVectors(state.startScale, state.endScale, easedProgress);

      if (rawProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        activeAnimations.delete(id);
        resolve();
      }
    };

    animate();
  });
}

// ==================== 3D MODEL LOADER (WITH CACHE) ====================

const modelCache = new Map<string, THREE.Group>();
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

async function loadModel(url: string): Promise<THREE.Group> {
  if (modelCache.has(url)) {
    return modelCache.get(url)!.clone();
  }

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        modelCache.set(url, model);
        resolve(model.clone());
      },
      undefined,
      reject
    );
  });
}

// ==================== FREE 3D MODEL URLS (OPTIMIZED FOR AR) ====================

const MODEL_URLS = {
  // GROCERY ITEMS (From Poly Pizza / Sketchfab - Low Poly)
  milk: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
  bread: 'https://models.readyplayer.me/64f9c5c4c5f5b5c5f5b5c5f5.glb?quality=low', // Placeholder
  apple: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Avocado/glTF-Binary/Avocado.glb',
  
  // BOOKS (Low Poly Book Models)
  book: 'https://models.readyplayer.me/book-low-poly.glb', // Placeholder
  
  // PLATES (Dish Models)
  plate: 'https://models.readyplayer.me/plate-dish.glb', // Placeholder
  
  // BOXES (Cardboard Box)
  box: 'https://models.readyplayer.me/cardboard-box.glb', // Placeholder
  
  // CARS (Low Poly Car)
  car: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
  
  // TRAIN (Simple Train Model)
  train: 'https://models.readyplayer.me/train-car.glb', // Placeholder
  
  // HUMAN (Stylized Character)
  human: 'https://models.readyplayer.me/64f9c5c4c5f5b5c5f5b5c5f5.glb?quality=medium',
  
  // TICKETS
  ticket: 'https://models.readyplayer.me/ticket-card.glb', // Placeholder
};

// ==================== TEXT SPRITE (IMPROVED) ====================

function createTextSprite(
  text: string, 
  color: string, 
  fontSize: number = 20,
  withBackground: boolean = false
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // High DPI support
  canvas.width = 512;
  canvas.height = 128;
  
  ctx.font = `bold ${fontSize * 2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (withBackground) {
    // Rounded background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(10, 20, 492, 88, 20);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 20, 492, 88, 20);
    ctx.stroke();
  }
  
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  
  return new THREE.Sprite(spriteMaterial);
}

// ==================== ARROW (IMPROVED WITH GLOW) ====================

function createArrow(
  fromX: number, 
  toX: number, 
  isHighlighted: boolean
): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;
  const midY = 0;
  
  // Main arrow line
  const points = [
    new THREE.Vector3(fromX + 0.35, midY, 0), 
    new THREE.Vector3(toX - 0.35, midY, 0)
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ 
    color, 
    linewidth: 3,
    transparent: true,
    opacity: 0.9,
  });
  arrow.add(new THREE.Line(lineGeo, lineMat));

  // Arrow head (cone)
  const coneGeo = new THREE.ConeGeometry(0.08, 0.15, 8);
  const coneMat = new THREE.MeshStandardMaterial({ 
    color,
    emissive: color,
    emissiveIntensity: 0.5,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(toX - 0.4, midY, 0);
  cone.rotation.z = -Math.PI / 2;
  arrow.add(cone);

  // Glow effect (larger, transparent line behind)
  if (isHighlighted) {
    const glowPoints = [
      new THREE.Vector3(fromX + 0.35, midY, 0), 
      new THREE.Vector3(toX - 0.35, midY, 0)
    ];
    const glowGeo = new THREE.BufferGeometry().setFromPoints(glowPoints);
    const glowMat = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      linewidth: 8,
    });
    const glowLine = new THREE.Line(glowGeo, glowMat);
    glowLine.position.y = 0.01;
    arrow.add(glowLine);
  }

  return arrow;
}

// ==================== PARTICLE EFFECTS ====================

function createSparkles(position: THREE.Vector3, count: number = 20): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  
  for (let i = 0; i < count; i++) {
    positions.push(
      position.x + (Math.random() - 0.5) * 0.3,
      position.y + (Math.random() - 0.5) * 0.3,
      position.z + (Math.random() - 0.5) * 0.3
    );
    
    colors.push(1, 1, 0); // Yellow
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  
  return new THREE.Points(geometry, material);
}

// ==================== OPTIMIZED HUMAN 3D (SIMPLE GEOMETRIC) ====================
// Fallback if 3D model doesn't load

function createSimpleHuman3D(
  appearance: HumanAppearance, 
  name: string, 
  isHighlighted: boolean
): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  // HEAD (Simple sphere)
  const headGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.3,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.32;
  head.castShadow = true;
  human.add(head);

  // HAIR
  if (appearance.hairStyle !== 'bald') {
    const hairGeo = new THREE.SphereGeometry(0.095, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.34;
    hair.castShadow = true;
    human.add(hair);
  }

  // TORSO
  const torsoGeo = new THREE.CapsuleGeometry(0.07, 0.15, 4, 8);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.1;
  torso.castShadow = true;
  human.add(torso);

  // ARMS
  [-1, 1].forEach(side => {
    const armGeo = new THREE.CapsuleGeometry(0.015, 0.12, 4, 6);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.set(side * 0.09, 0.08, 0);
    arm.rotation.z = side * 0.2;
    arm.castShadow = true;
    human.add(arm);
  });

  // LEGS
  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  [-0.03, 0.03].forEach(x => {
    const legGeo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.08, 0);
    leg.castShadow = true;
    human.add(leg);
  });

  // SHOES
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  [-0.03, 0.03].forEach(x => {
    const shoeGeo = new THREE.BoxGeometry(0.035, 0.02, 0.05);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(x, -0.155, 0.01);
    shoe.castShadow = true;
    human.add(shoe);
  });

  // NAME LABEL
  const labelSprite = createTextSprite(name, isHighlighted ? '#ffff00' : '#ffffff', 18, true);
  labelSprite.position.y = 0.5;
  labelSprite.scale.set(0.4, 0.1, 1);
  human.add(labelSprite);

  // HIGHLIGHT RING
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.08, 0.13, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.16;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);

    // Floating arrow
    const arrowGeo = new THREE.ConeGeometry(0.04, 0.08, 6);
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrow.position.y = 0.58;
    arrow.rotation.z = Math.PI;
    human.add(arrow);
  }

  return human;
}

// ==================== CREATE HUMAN (TRY MODEL, FALLBACK TO SIMPLE) ====================

async function createHuman3D(
  appearance: HumanAppearance, 
  name: string, 
  isHighlighted: boolean
): Promise<THREE.Group> {
  try {
    // Try to load 3D model
    const model = await loadModel(MODEL_URLS.human);
    
    // Apply colors to model materials
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name.includes('shirt') || child.name.includes('torso')) {
          child.material = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
        } else if (child.name.includes('pant') || child.name.includes('leg')) {
          child.material = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
        } else if (child.name.includes('skin') || child.name.includes('head')) {
          child.material = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
        }
      }
    });
    
    model.scale.setScalar(0.6);
    
    // Add label
    const labelSprite = createTextSprite(name, isHighlighted ? '#ffff00' : '#ffffff', 18, true);
    labelSprite.position.y = 0.5;
    labelSprite.scale.set(0.4, 0.1, 1);
    model.add(labelSprite);
    
    return model;
  } catch (error) {
    console.warn('Failed to load 3D human model, using simple version:', error);
    return createSimpleHuman3D(appearance, name, isHighlighted);
  }
}

// ==================== GROCERY BOX (OPTIMIZED) ====================

function createGroceryBox(
  color: string, 
  label: string, 
  isHighlighted: boolean
): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.3;
  const boxHeight = 0.48;
  const boxDepth = 0.18;

  // Main box
  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
    emissive: isHighlighted ? '#ffff00' : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = boxHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  product.add(body);

  // Front label (canvas texture)
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 200;
  labelCanvas.height = 300;
  const ctx = labelCanvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#fefef6';
  ctx.fillRect(0, 0, 200, 300);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 192, 292);

  // Color header
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 200, 40);

  // Icon
  const icons: Record<string, string> = {
    'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚',
    'Apple': '🍎', 'Juice': '🧃', 'New': '🆕'
  };
  ctx.font = '50px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(icons[label] || '📦', 100, 120);

  // Product name
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(label, 100, 180);

  // Barcode
  ctx.fillStyle = '#000';
  for (let i = 20; i < 180; i += 3) {
    ctx.fillRect(i, 220, 2, 15 + Math.random() * 8);
  }

  // Price
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 20px Arial';
  const prices: Record<string, string> = {
    'Milk': '$3.99', 'Bread': '$2.49', 'Eggs': '$4.99',
    'Apple': '$1.29', 'Juice': '$5.49', 'New': '$0.99'
  };
  ctx.fillText(prices[label] || '$2.99', 100, 270);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boxWidth - 0.02, boxHeight - 0.02),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
  );
  labelMesh.position.set(0, boxHeight / 2, boxDepth / 2 + 0.001);
  product.add(labelMesh);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.06, boxHeight + 0.06, boxDepth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = boxHeight / 2;
    product.add(glow);

    // Floating arrow
    const arrowGeo = new THREE.ConeGeometry(0.06, 0.1, 8);
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrow.position.y = boxHeight + 0.15;
    arrow.rotation.z = Math.PI;
    product.add(arrow);
  }

  return product;
}

// ==================== END OF PART 1 ====================
// ==================== PART 2: ALL 3D OBJECTS ====================
// Place this right after Part 1

// ==================== REALISTIC BOOK ====================

function createBook(
  label: string, 
  color: string, 
  isHighlighted: boolean
): THREE.Group {
  const book = new THREE.Group();

  // Book dimensions
  const width = 0.55;
  const height = 0.08;
  const depth = 0.4;

  // Cover material
  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.1,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  // Main cover (top)
  const coverGeo = new THREE.BoxGeometry(width, height * 0.15, depth);
  const topCover = new THREE.Mesh(coverGeo, coverMat);
  topCover.position.y = height / 2;
  topCover.castShadow = true;
  book.add(topCover);

  // Bottom cover
  const bottomCover = new THREE.Mesh(coverGeo, coverMat);
  bottomCover.position.y = -height / 2;
  bottomCover.castShadow = true;
  book.add(bottomCover);

  // Pages (cream colored)
  const pagesGeo = new THREE.BoxGeometry(width - 0.03, height * 0.8, depth - 0.02);
  const pagesMat = new THREE.MeshStandardMaterial({ 
    color: '#f5f0e0', 
    roughness: 0.9,
  });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  pages.position.x = 0.01;
  pages.castShadow = true;
  book.add(pages);

  // Page lines texture (visible from front)
  const pageLineCanvas = document.createElement('canvas');
  pageLineCanvas.width = 32;
  pageLineCanvas.height = 256;
  const plctx = pageLineCanvas.getContext('2d')!;
  plctx.fillStyle = '#f5f0e0';
  plctx.fillRect(0, 0, 32, 256);
  for (let y = 0; y < 256; y += 2) {
    plctx.fillStyle = y % 4 === 0 ? '#e8e0d0' : '#f0e8d8';
    plctx.fillRect(0, y, 32, 1);
  }
  const pageLineTex = new THREE.CanvasTexture(pageLineCanvas);
  
  const pageFront = new THREE.Mesh(
    new THREE.PlaneGeometry(height * 0.75, depth - 0.04),
    new THREE.MeshBasicMaterial({ map: pageLineTex })
  );
  pageFront.position.set(width / 2 - 0.01, 0, 0);
  pageFront.rotation.y = Math.PI / 2;
  book.add(pageFront);

  // Spine (rounded look)
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.7),
    roughness: 0.3,
  });
  const spineGeo = new THREE.BoxGeometry(0.03, height, depth);
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -width / 2 - 0.01;
  spine.castShadow = true;
  book.add(spine);

  // Spine gold text
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 64;
  spineCanvas.height = 256;
  const sctx = spineCanvas.getContext('2d')!;
  sctx.fillStyle = '#ffd700';
  sctx.save();
  sctx.translate(32, 128);
  sctx.rotate(-Math.PI / 2);
  sctx.font = 'bold 24px serif';
  sctx.textAlign = 'center';
  sctx.fillText(label, 0, 8);
  sctx.restore();
  
  const spineTex = new THREE.CanvasTexture(spineCanvas);
  const spineLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(height - 0.01, depth - 0.04),
    new THREE.MeshBasicMaterial({ map: spineTex, transparent: true })
  );
  spineLabel.position.set(-width / 2 - 0.02, 0, 0);
  spineLabel.rotation.y = -Math.PI / 2;
  book.add(spineLabel);

  // Cover title
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 256;
  titleCanvas.height = 200;
  const tctx = titleCanvas.getContext('2d')!;

  // Gold border
  tctx.strokeStyle = '#ffd700';
  tctx.lineWidth = 6;
  tctx.strokeRect(12, 12, 232, 176);
  tctx.lineWidth = 2;
  tctx.strokeRect(22, 22, 212, 156);

  // Title
  tctx.fillStyle = '#ffd700';
  tctx.font = 'bold 36px serif';
  tctx.textAlign = 'center';
  tctx.fillText(label, 128, 100);

  // Subtitle
  tctx.font = '18px serif';
  tctx.fillText('TEXTBOOK', 128, 135);

  const titleTex = new THREE.CanvasTexture(titleCanvas);
  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.08, depth - 0.08),
    new THREE.MeshBasicMaterial({ map: titleTex, transparent: true })
  );
  titleMesh.position.y = height / 2 + 0.001;
  titleMesh.rotation.x = -Math.PI / 2;
  book.add(titleMesh);

  // Bookmark ribbon
  const ribbonGeo = new THREE.PlaneGeometry(0.015, 0.15);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: '#e74c3c',
    side: THREE.DoubleSide,
    roughness: 0.6,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0.1, height / 2 + 0.05, depth / 2 - 0.02);
  ribbon.rotation.x = 0.3;
  book.add(ribbon);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(width + 0.08, height + 0.04, depth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    book.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return book;
}

// ==================== REALISTIC PLATE WITH FOOD ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  // Main plate
  const plateGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.025, 32);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#fefefa',
    roughness: 0.2,
    metalness: 0.1,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  const plateMain = new THREE.Mesh(plateGeo, plateMat);
  plateMain.castShadow = true;
  plateMain.receiveShadow = true;
  plate.add(plateMain);

  // Plate rim
  const rimGeo = new THREE.TorusGeometry(0.27, 0.015, 12, 32);
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#e8e8e0',
    roughness: 0.3,
    metalness: 0.15,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  plate.add(rim);

  // Blue decorative ring (like china)
  const decorGeo = new THREE.TorusGeometry(0.2, 0.006, 8, 32);
  const decorMat = new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 });
  const decor = new THREE.Mesh(decorGeo, decorMat);
  decor.rotation.x = Math.PI / 2;
  decor.position.y = 0.014;
  plate.add(decor);

  // Different food based on plate number
  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;

  if (plateNum % 3 === 1) {
    // MEAL 1: Rice + Chicken + Peas
    
    // Rice mound
    const riceGeo = new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const riceMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.9 });
    const rice = new THREE.Mesh(riceGeo, riceMat);
    rice.position.set(-0.08, 0.015, 0);
    rice.castShadow = true;
    plate.add(rice);

    // Chicken drumstick
    const chickenGroup = new THREE.Group();
    const drumGeo = new THREE.CapsuleGeometry(0.025, 0.08, 6, 12);
    const drumMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.6 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.rotation.z = 0.4;
    chickenGroup.add(drum);
    
    // Bone
    const boneGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6);
    const boneMat = new THREE.MeshStandardMaterial({ color: '#f5deb3' });
    const bone = new THREE.Mesh(boneGeo, boneMat);
    bone.position.y = 0.06;
    bone.rotation.z = 0.4;
    chickenGroup.add(bone);
    
    chickenGroup.position.set(0.06, 0.04, 0.02);
    chickenGroup.castShadow = true;
    plate.add(chickenGroup);

    // Green peas
    const peaMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const peaGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const pea = new THREE.Mesh(peaGeo, peaMat);
      pea.position.set(
        0.02 + (Math.random() - 0.5) * 0.08,
        0.022,
        -0.06 + (Math.random() - 0.5) * 0.06
      );
      pea.castShadow = true;
      plate.add(pea);
    }

  } else if (plateNum % 3 === 2) {
    // MEAL 2: Spaghetti + Sauce + Meatball
    
    // Spaghetti noodles
    const noodleMat = new THREE.MeshStandardMaterial({ color: '#f0d58c', roughness: 0.7 });
    for (let i = 0; i < 10; i++) {
      const noodleGeo = new THREE.TorusGeometry(0.04 + Math.random() * 0.03, 0.004, 6, 16);
      const noodle = new THREE.Mesh(noodleGeo, noodleMat);
      noodle.position.set(
        (Math.random() - 0.5) * 0.08,
        0.02 + i * 0.004,
        (Math.random() - 0.5) * 0.08
      );
      noodle.rotation.x = Math.random() * 0.5;
      noodle.rotation.y = Math.random() * Math.PI;
      noodle.castShadow = true;
      plate.add(noodle);
    }

    // Tomato sauce
    const sauceGeo = new THREE.SphereGeometry(0.05, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4 });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.045, 0);
    sauce.scale.set(1.3, 0.6, 1.3);
    sauce.castShadow = true;
    plate.add(sauce);

    // Meatballs
    const meatMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const meatGeo = new THREE.SphereGeometry(0.025, 10, 10);
      const meat = new THREE.Mesh(meatGeo, meatMat);
      meat.position.set(
        (Math.random() - 0.5) * 0.08,
        0.05,
        (Math.random() - 0.5) * 0.08
      );
      meat.castShadow = true;
      plate.add(meat);
    }

  } else {
    // MEAL 3: Fresh Salad
    
    // Lettuce leaves
    const lettuceMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.SphereGeometry(0.04, 8, 6);
      const leaf = new THREE.Mesh(leafGeo, lettuceMat);
      leaf.position.set(
        (Math.random() - 0.5) * 0.14,
        0.025,
        (Math.random() - 0.5) * 0.14
      );
      leaf.scale.set(1.3, 0.4, 1);
      leaf.rotation.y = Math.random() * Math.PI;
      leaf.castShadow = true;
      plate.add(leaf);
    }

    // Tomato slices
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const tomatoGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 12);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(
        -0.06 + i * 0.04,
        0.035,
        -0.02 + (Math.random() - 0.5) * 0.04
      );
      tomato.castShadow = true;
      plate.add(tomato);
    }

    // Cheese cubes
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const cheeseGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018);
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set(
        0.05 + (Math.random() - 0.5) * 0.06,
        0.03,
        (Math.random() - 0.5) * 0.1
      );
      cheese.rotation.y = Math.random() * 0.5;
      cheese.castShadow = true;
      plate.add(cheese);
    }

    // Cucumber slices
    const cucumberMat = new THREE.MeshStandardMaterial({ color: '#1abc9c', roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const cucGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 12);
      const cuc = new THREE.Mesh(cucGeo, cucumberMat);
      cuc.position.set(
        0.04 + i * 0.025,
        0.038,
        0.06
      );
      cuc.castShadow = true;
      plate.add(cuc);
    }
  }

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== REALISTIC CARDBOARD BOX ====================

function createCardboardBox(
  label: string, 
  color: string, 
  isHighlighted: boolean, 
  isOpen: boolean = false
): THREE.Group {
  const box = new THREE.Group();

  const width = 0.5;
  const height = 0.35;
  const depth = 0.4;

  // Cardboard material
  const cardboardMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  // Main box body
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(bodyGeo, cardboardMat);
  body.castShadow = true;
  body.receiveShadow = true;
  box.add(body);

  // Edge creases (darker lines)
  const creaseMat = new THREE.MeshStandardMaterial({ color: '#7a5530', roughness: 0.9 });
  const creaseGeo = new THREE.BoxGeometry(0.01, height, 0.01);
  
  // Vertical creases
  [
    [-width/2, 0, depth/2],
    [width/2, 0, depth/2],
    [-width/2, 0, -depth/2],
    [width/2, 0, -depth/2],
  ].forEach(([x, y, z]) => {
    const crease = new THREE.Mesh(creaseGeo, creaseMat);
    crease.position.set(x, y, z);
    box.add(crease);
  });

  // Flaps
  const flapAngle = isOpen ? -1.2 : 0;
  const flapMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });

  // Front flap
  const frontFlapGeo = new THREE.BoxGeometry(width, 0.12, 0.01);
  const frontFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  frontFlap.position.set(0, height/2 + (isOpen ? 0.04 : 0), depth/2);
  frontFlap.rotation.x = flapAngle;
  frontFlap.castShadow = true;
  box.add(frontFlap);

  // Back flap
  const backFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  backFlap.position.set(0, height/2 + (isOpen ? 0.04 : 0), -depth/2);
  backFlap.rotation.x = -flapAngle;
  backFlap.castShadow = true;
  box.add(backFlap);

  // Side flaps
  const sideFlapGeo = new THREE.BoxGeometry(0.01, 0.12, depth);
  const leftFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  leftFlap.position.set(-width/2, height/2 + (isOpen ? 0.03 : 0), 0);
  leftFlap.rotation.z = isOpen ? 0.8 : 0;
  leftFlap.castShadow = true;
  box.add(leftFlap);

  const rightFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  rightFlap.position.set(width/2, height/2 + (isOpen ? 0.03 : 0), 0);
  rightFlap.rotation.z = isOpen ? -0.8 : 0;
  rightFlap.castShadow = true;
  box.add(rightFlap);

  // Packing tape (when closed)
  if (!isOpen) {
    const tapeGeo = new THREE.BoxGeometry(0.08, 0.005, depth + 0.02);
    const tapeMat = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
    });
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = height/2 + 0.003;
    box.add(tape);
  }

  // Items inside (when open)
  if (isOpen) {
    const insideMat = new THREE.MeshStandardMaterial({ color: '#a0734a', roughness: 0.9 });
    const insideGeo = new THREE.PlaneGeometry(width - 0.05, depth - 0.05);
    const inside = new THREE.Mesh(insideGeo, insideMat);
    inside.rotation.x = -Math.PI / 2;
    inside.position.y = -height/2 + 0.01;
    box.add(inside);

    // Random items inside
    const item1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: '#3498db' })
    );
    item1.position.set(-0.08, -0.08, 0);
    item1.rotation.y = 0.2;
    item1.castShadow = true;
    box.add(item1);

    const item2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: '#e74c3c' })
    );
    item2.position.set(0.08, -0.04, 0.05);
    item2.castShadow = true;
    box.add(item2);
  }

  // Front label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 200;
  labelCanvas.height = 120;
  const ctx = labelCanvas.getContext('2d')!;

  // White label background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 200, 120);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 194, 114);

  // FRAGILE banner
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(8, 8, 184, 28);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ FRAGILE ⚠', 100, 28);

  // Box name
  ctx.fillStyle = '#000';
  ctx.font = 'bold 28px Arial';
  ctx.fillText(label, 100, 68);

  // Handle with care
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.fillText('HANDLE WITH CARE', 100, 90);
  ctx.fillText('↑ THIS SIDE UP ↑', 100, 108);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.2),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0.02, depth/2 + 0.001);
  box.add(labelMesh);

  // Side handles
  const handleMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.8 });
  [-width/2 - 0.001, width/2 + 0.001].forEach((x, i) => {
    const handleGeo = new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(x, 0.05, 0);
    handle.rotation.y = Math.PI / 2;
    handle.rotation.z = Math.PI;
    box.add(handle);
  });

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(width + 0.06, height + 0.06, depth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return box;
}

// ==================== REALISTIC CAR ====================

function createCar(
  color: string, 
  label: string, 
  isHighlighted: boolean
): THREE.Group {
  const car = new THREE.Group();

  // Car body material
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.3,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  // Lower body
  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.14, 0.28),
    bodyMat
  );
  lowerBody.position.y = 0.08;
  lowerBody.castShadow = true;
  car.add(lowerBody);

  // Body curves (rounded edges feel)
  const frontGeo = new THREE.BoxGeometry(0.08, 0.1, 0.26);
  const front = new THREE.Mesh(frontGeo, bodyMat);
  front.position.set(0.28, 0.06, 0);
  front.rotation.z = 0.2;
  front.castShadow = true;
  car.add(front);

  const backGeo = new THREE.BoxGeometry(0.06, 0.1, 0.26);
  const back = new THREE.Mesh(backGeo, bodyMat);
  back.position.set(-0.28, 0.07, 0);
  back.rotation.z = -0.15;
  back.castShadow = true;
  car.add(back);

  // Cabin (upper body)
  const cabinGeo = new THREE.BoxGeometry(0.28, 0.12, 0.24);
  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.position.set(-0.04, 0.21, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.26, 0.015, 0.22);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(-0.04, 0.28, 0);
  roof.castShadow = true;
  car.add(roof);

  // Windows
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#87ceeb',
    metalness: 0.6,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });

  // Windshield
  const windshieldGeo = new THREE.PlaneGeometry(0.22, 0.1);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0.1, 0.22, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.z = 0.3;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(windshieldGeo, glassMat);
  rearWindow.position.set(-0.18, 0.22, 0);
  rearWindow.rotation.y = Math.PI / 2;
  rearWindow.rotation.z = -0.3;
  car.add(rearWindow);

  // Side windows
  const sideWinGeo = new THREE.PlaneGeometry(0.12, 0.08);
  [-1, 1].forEach(side => {
    const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
    sideWin.position.set(-0.04, 0.22, side * 0.125);
    car.add(sideWin);
  });

  // Wheels
  const wheelGeo = new THREE.TorusGeometry(0.05, 0.02, 12, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 16);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });

  const wheelPositions: [number, number, number][] = [
    [-0.18, 0, 0.145], [0.18, 0, 0.145],
    [-0.18, 0, -0.145], [0.18, 0, -0.145],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;
    car.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    car.add(rim);

    // Hub cap
    const hubGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.028, 8);
    const hub = new THREE.Mesh(hubGeo, rimMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, wy, wz);
    car.add(hub);

    // Spokes
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8 });
    for (let a = 0; a < 5; a++) {
      const spokeGeo = new THREE.BoxGeometry(0.004, 0.05, 0.004);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.set(wx, wy, wz > 0 ? wz + 0.013 : wz - 0.013);
      spoke.rotation.z = (a / 5) * Math.PI * 2;
      car.add(spoke);
    }
  });

  // Headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  const headlightGeo = new THREE.BoxGeometry(0.01, 0.04, 0.05);
  [-0.09, 0.09].forEach(z => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(0.3, 0.08, z);
    car.add(hl);

    // Housing
    const housingGeo = new THREE.BoxGeometry(0.015, 0.05, 0.06);
    const housingMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0.298, 0.08, z);
    car.add(housing);
  });

  // Tail lights
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  const tailGeo = new THREE.BoxGeometry(0.01, 0.03, 0.04);
  [-0.08, 0.08].forEach(z => {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(-0.3, 0.08, z);
    car.add(tl);
  });

  // Front grille
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7 });
  for (let z = -0.07; z <= 0.07; z += 0.02) {
    const barGeo = new THREE.BoxGeometry(0.01, 0.05, 0.006);
    const bar = new THREE.Mesh(barGeo, grilleMat);
    bar.position.set(0.3, 0.06, z);
    car.add(bar);
  }

  // Side mirrors
  const mirrorMat = new THREE.MeshStandardMaterial({ color: '#333' });
  [-0.14, 0.14].forEach(z => {
    const mirrorGeo = new THREE.BoxGeometry(0.02, 0.015, 0.025);
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(0.05, 0.18, z);
    car.add(mirror);
  });

  // License plate
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 120;
  plateCanvas.height = 40;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 120, 40);
  pctx.strokeStyle = '#333';
  pctx.lineWidth = 3;
  pctx.strokeRect(2, 2, 116, 36);
  pctx.fillStyle = '#2c3e50';
  pctx.font = 'bold 18px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 60, 28);

  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.04),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  plateMesh.position.set(-0.301, 0.04, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  // Exhaust
  const exhaustGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.05, 10);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8 });
  const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust.position.set(-0.27, -0.02, 0.08);
  exhaust.rotation.z = Math.PI / 2;
  car.add(exhaust);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.65, 0.32, 0.32);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.13;
    car.add(glow);
  }

  return car;
}

// ==================== TRAIN CAR ====================

function createTrainCar(
  isEngine: boolean, 
  color: string, 
  label: string, 
  isHighlighted: boolean
): THREE.Group {
  const train = new THREE.Group();

  // Main body
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });

  const bodyGeo = new THREE.BoxGeometry(0.65, 0.3, 0.28);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.12;
  body.castShadow = true;
  train.add(body);

  // Decorative stripe
  const stripeGeo = new THREE.BoxGeometry(0.66, 0.025, 0.285);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.17;
  train.add(stripe);

  // Roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.4 });
  const roofGeo = new THREE.BoxGeometry(0.6, 0.04, 0.24);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.29;
  roof.castShadow = true;
  train.add(roof);

  // Undercarriage
  const underGeo = new THREE.BoxGeometry(0.6, 0.04, 0.22);
  const underMat = new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.6 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.06;
  train.add(under);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.025, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7, roughness: 0.3 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#d4d4d4', metalness: 0.9, roughness: 0.1 });

  const wheelPositions: [number, number, number][] = [
    [-0.2, -0.06, 0.14], [0.2, -0.06, 0.14],
    [-0.2, -0.06, -0.14], [0.2, -0.06, -0.14],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    train.add(wheel);

    const hubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.028, 12);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, wy, wz);
    train.add(hub);
  });

  // Windows (for passenger cars)
  if (!isEngine) {
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#87ceeb',
      metalness: 0.4,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    [-0.18, 0, 0.18].forEach(x => {
      const winGeo = new THREE.PlaneGeometry(0.08, 0.07);
      
      const winF = new THREE.Mesh(winGeo, windowMat);
      winF.position.set(x, 0.16, 0.142);
      train.add(winF);

      const winB = new THREE.Mesh(winGeo, windowMat);
      winB.position.set(x, 0.16, -0.142);
      train.add(winB);
    });
  }

  // Engine specific parts
  if (isEngine) {
    // Boiler
    const boilerGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.26, 20);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.45, roughness: 0.5 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.48, 0.12, 0);
    boiler.castShadow = true;
    train.add(boiler);

    // Boiler bands
    const bandGeo = new THREE.TorusGeometry(0.12, 0.008, 8, 20);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    [0.38, 0.48, 0.58].forEach(x => {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(x, 0.12, 0);
      band.rotation.y = Math.PI / 2;
      train.add(band);
    });

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.14, 12);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.5 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.2, 0.38, 0);
    chimney.castShadow = true;
    train.add(chimney);

    // Chimney cap
    const capGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.02, 12);
    const cap = new THREE.Mesh(capGeo, chimneyMat);
    cap.position.set(0.2, 0.46, 0);
    train.add(cap);

    // Smoke puffs
    const smokeMat = new THREE.MeshBasicMaterial({ 
      color: '#bdc3c7', 
      transparent: true, 
      opacity: 0.3 
    });
    [
      { y: 0.52, s: 0.04 },
      { y: 0.6, s: 0.05 },
      { y: 0.7, s: 0.06 },
    ].forEach(({ y, s }) => {
      const smokeGeo = new THREE.SphereGeometry(s, 8, 8);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.2 + (y - 0.52) * 0.2, y, (Math.random() - 0.5) * 0.06);
      train.add(smoke);
    });

    // Headlight
    const hlGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.04, 12);
    const hlMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.7 });
    const headlight = new THREE.Mesh(hlGeo, hlMat);
    headlight.position.set(0.63, 0.18, 0);
    headlight.rotation.z = Math.PI / 2;
    train.add(headlight);

    // Cow catcher
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6 });
    const catcherGeo = new THREE.BoxGeometry(0.05, 0.08, 0.22);
    const catcher = new THREE.Mesh(catcherGeo, catcherMat);
    catcher.position.set(0.65, -0.02, 0);
    train.add(catcher);
  }

  // Coupling hooks
  const hookMat = new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8 });
  [-0.34, 0.34].forEach(x => {
    const hookGeo = new THREE.BoxGeometry(0.04, 0.025, 0.025);
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);
  });

  // Label
  const labelSprite = createTextSprite(label, isHighlighted ? '#000' : '#fff', 20, true);
  labelSprite.position.y = 0.48;
  labelSprite.scale.set(0.45, 0.12, 1);
  train.add(labelSprite);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.7, 0.38, 0.32);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.12;
    train.add(glow);
  }

  return train;
}

// ==================== TICKET ====================

function createTicket(
  label: string, 
  color: string, 
  isHighlighted: boolean
): THREE.Group {
  const ticket = new THREE.Group();

  // Main ticket body
  const ticketMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  const ticketGeo = new THREE.BoxGeometry(0.4, 0.22, 0.012);
  const ticketBody = new THREE.Mesh(ticketGeo, ticketMat);
  ticketBody.castShadow = true;
  ticket.add(ticketBody);

  // Tear-off stub
  const stubGeo = new THREE.BoxGeometry(0.08, 0.22, 0.012);
  const stub = new THREE.Mesh(stubGeo, ticketMat);
  stub.position.x = 0.24;
  ticket.add(stub);

  // Perforation dots
  const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let y = -0.09; y <= 0.09; y += 0.012) {
    const dotGeo = new THREE.CircleGeometry(0.004, 8);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0.19, y, 0.007);
    ticket.add(dot);
  }

  // Front design
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 280;
  frontCanvas.height = 140;
  const ctx = frontCanvas.getContext('2d')!;

  // Diagonal stripes background
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = -140; i < 420; i += 15) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 70, 140);
    ctx.lineTo(i + 78, 140);
    ctx.lineTo(i + 8, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Top banner
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 280, 30);

  // ADMIT ONE
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('★ ADMIT ONE ★', 115, 22);

  // Ticket number
  ctx.font = 'bold 40px Arial';
  ctx.fillText(label, 115, 82);

  // Line
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 95);
  ctx.lineTo(200, 95);
  ctx.stroke();

  // VIP text
  ctx.font = 'bold 14px Arial';
  ctx.fillText('⭐ VIP ACCESS ⭐', 115, 115);

  // Date
  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('VALID TODAY ONLY', 115, 132);

  // Stub text (rotated)
  ctx.save();
  ctx.translate(250, 70);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, 0, 0);
  ctx.restore();

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.2),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontMesh.position.z = 0.007;
  ticket.add(frontMesh);

  // Gold border
  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  
  // Top/bottom borders
  const hBorderGeo = new THREE.BoxGeometry(0.42, 0.006, 0.015);
  const topBorder = new THREE.Mesh(hBorderGeo, borderMat);
  topBorder.position.y = 0.11;
  ticket.add(topBorder);
  
  const bottomBorder = new THREE.Mesh(hBorderGeo, borderMat);
  bottomBorder.position.y = -0.11;
  ticket.add(bottomBorder);

  // Left/right borders
  const vBorderGeo = new THREE.BoxGeometry(0.006, 0.22, 0.015);
  const leftBorder = new THREE.Mesh(vBorderGeo, borderMat);
  leftBorder.position.x = -0.2;
  ticket.add(leftBorder);
  
  const rightBorder = new THREE.Mesh(vBorderGeo, borderMat);
  rightBorder.position.x = 0.28;
  ticket.add(rightBorder);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.44, 0.26, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    ticket.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return ticket;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  // Main tile
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f5f0e8',
    roughness: 0.4,
    metalness: 0.05,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  const tileGeo = new THREE.BoxGeometry(0.22, 0.45, 0.06);
  const tile = new THREE.Mesh(tileGeo, tileMat);
  tile.castShadow = true;
  domino.add(tile);

  // Border
  const borderGeo = new THREE.BoxGeometry(0.23, 0.46, 0.055);
  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.005;
  domino.add(border);

  // Center groove
  const grooveGeo = new THREE.BoxGeometry(0.18, 0.01, 0.012);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3 });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.028;
  domino.add(groove);

  // Dots
  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12);
  const dotMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#fff' : '#1a1a1a',
    roughness: 0.3,
    metalness: 0.1,
  });

  // Dot positions for each half
  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0.14]],
    2: [[-0.05, 0.19], [0.05, 0.09]],
    3: [[-0.05, 0.19], [0, 0.14], [0.05, 0.09]],
    4: [[-0.05, 0.19], [0.05, 0.19], [-0.05, 0.09], [0.05, 0.09]],
  };

  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];

  // Top half dots
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, 0.026);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);
  });

  // Bottom half dots (mirrored)
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-x, -y, 0.026);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);
  });

  // Value label
  const numSprite = createTextSprite(value, isHighlighted ? '#fff' : '#666', 16);
  numSprite.position.set(0.13, 0, 0);
  numSprite.scale.set(0.08, 0.08, 1);
  domino.add(numSprite);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.26, 0.49, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
    });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== CLIPBOARD (TODO) ====================

function createClipboard(
  label: string, 
  color: string, 
  isHighlighted: boolean
): THREE.Group {
  const clipboard = new THREE.Group();

  // Wooden board
  const boardGeo = new THREE.BoxGeometry(0.38, 0.5, 0.016);
  const boardMat = new THREE.MeshStandardMaterial({
    color: '#6d4c2a',
    roughness: 0.65,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  clipboard.add(board);

  // Metal clip
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9, roughness: 0.2 });
  
  const clipBaseGeo = new THREE.BoxGeometry(0.12, 0.035, 0.02);
  const clipBase = new THREE.Mesh(clipBaseGeo, clipMat);
  clipBase.position.set(0, 0.26, 0.012);
  clipboard.add(clipBase);

  const clipLeverGeo = new THREE.BoxGeometry(0.07, 0.012, 0.025);
  const clipLever = new THREE.Mesh(clipLeverGeo, clipMat);
  clipLever.position.set(0, 0.28, 0.025);
  clipLever.rotation.x = -0.3;
  clipboard.add(clipLever);

  // Paper
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 200;
  paperCanvas.height = 280;
  const pctx = paperCanvas.getContext('2d')!;

  // Paper background
  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 200, 280);

  // Texture lines
  pctx.strokeStyle = '#f0ede4';
  pctx.lineWidth = 0.5;
  for (let y = 0; y < 280; y += 3) {
    pctx.beginPath();
    pctx.moveTo(0, y);
    pctx.lineTo(200, y);
    pctx.stroke();
  }

  // Color header
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 200, 35);

  // Title
  pctx.fillStyle = '#fff';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 100, 25);

  // Tasks
  const tasks = [
    { text: 'Review notes', done: true },
    { text: 'Complete homework', done: true },
    { text: 'Practice coding', done: isHighlighted },
    { text: 'Read chapter 5', done: false },
    { text: 'Submit project', done: false },
    { text: 'Study for exam', done: false },
  ];

  const lineY = 50;
  const spacing = 35;

  tasks.forEach((task, i) => {
    const y = lineY + i * spacing;

    // Ruled line
    pctx.strokeStyle = '#d4d0c8';
    pctx.lineWidth = 0.8;
    pctx.beginPath();
    pctx.moveTo(15, y + 18);
    pctx.lineTo(185, y + 18);
    pctx.stroke();

    // Checkbox
    pctx.strokeStyle = '#666';
    pctx.lineWidth = 1.5;
    pctx.strokeRect(18, y, 14, 14);

    if (task.done) {
      // Checkmark
      pctx.strokeStyle = '#27ae60';
      pctx.lineWidth = 2.5;
      pctx.beginPath();
      pctx.moveTo(20, y + 7);
      pctx.lineTo(24, y + 12);
      pctx.lineTo(31, y + 3);
      pctx.stroke();

      // Strikethrough
      pctx.fillStyle = '#999';
      pctx.font = '12px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 38, y + 12);
      
      const textWidth = pctx.measureText(task.text).width;
      pctx.strokeStyle = '#999';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(38, y + 8);
      pctx.lineTo(38 + textWidth, y + 8);
      pctx.stroke();
    } else {
      pctx.fillStyle = '#2c3e50';
      pctx.font = '12px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 38, y + 12);
    }
  });

  // Red margin line
  pctx.strokeStyle = '#e74c3c';
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.moveTo(12, 38);
  pctx.lineTo(12, 270);
  pctx.stroke();

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.45),
    new THREE.MeshBasicMaterial({ map: paperTex })
  );
  paper.position.z = 0.009;
  clipboard.add(paper);

  // Pencil
  const pencilGroup = new THREE.Group();
  
  const pencilBodyGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6);
  const pencilMat = new THREE.MeshStandardMaterial({ color: '#f4d03f' });
  const pencilBody = new THREE.Mesh(pencilBodyGeo, pencilMat);
  pencilGroup.add(pencilBody);

  const pencilTipGeo = new THREE.ConeGeometry(0.005, 0.018, 6);
  const pencilTipMat = new THREE.MeshStandardMaterial({ color: '#f5deb3' });
  const pencilTip = new THREE.Mesh(pencilTipGeo, pencilTipMat);
  pencilTip.position.y = -0.09;
  pencilGroup.add(pencilTip);

  const eraserGeo = new THREE.CylinderGeometry(0.006, 0.005, 0.012, 6);
  const eraserMat = new THREE.MeshStandardMaterial({ color: '#e88b8b' });
  const eraser = new THREE.Mesh(eraserGeo, eraserMat);
  eraser.position.y = 0.086;
  pencilGroup.add(eraser);

  pencilGroup.position.set(0.11, -0.05, 0.018);
  pencilGroup.rotation.z = 0.7;
  clipboard.add(pencilGroup);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.42, 0.54, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    clipboard.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return clipboard;
}

// ==================== CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });

  // Seat
  const seatGeo = new THREE.BoxGeometry(0.2, 0.02, 0.2);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = -0.16;
  seat.castShadow = true;
  chair.add(seat);

  // Back rest
  const backGeo = new THREE.BoxGeometry(0.2, 0.16, 0.015);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, -0.07, -0.09);
  back.castShadow = true;
  chair.add(back);

  // Back rest bars
  const barGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6);
  [-0.055, 0, 0.055].forEach(bx => {
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.position.set(bx, -0.08, -0.09);
    chair.add(bar);
  });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8);
  [
    [-0.075, -0.22, 0.075],
    [0.075, -0.22, 0.075],
    [-0.075, -0.22, -0.075],
    [0.075, -0.22, -0.075],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    chair.add(leg);
  });

  chair.position.x = x;
  return chair;
}

// ==================== END OF PART 2 ====================
// ==================== PART 3: BUILD SCENE + ANIMATIONS + MAIN APP ====================
// Place this right after Part 2

// ==================== IMPROVED ANIMATION HELPER ====================

function applyItemAnimation(
  obj: THREE.Object3D,
  itemIndex: number,
  animPhase: string,
  animData: Record<string, any>,
  structure: DataStructure
): void {
  if (!animPhase) return;

  const isTarget = animData.index === itemIndex;
  const isTarget1 = animData.index1 === itemIndex;
  const isTarget2 = animData.index2 === itemIndex;

  // Smooth animation values using sine waves
  const time = Date.now() * 0.003;
  const bounce = Math.sin(time * 5) * 0.02;
  const wobble = Math.sin(time * 3) * 0.05;

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) {
      obj.position.y += 0.35 + bounce;
      obj.rotation.z = wobble;
    } else if (animPhase === 'access-bounce' && isTarget) {
      obj.position.y += 0.25 + Math.abs(bounce) * 2;
      obj.scale.multiplyScalar(1.15);
      obj.rotation.z = -wobble;
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.08;
    } else if (animPhase === 'insert-shift' && animData.insertIndex !== undefined && itemIndex >= animData.insertIndex) {
      obj.position.y += 0.05;
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.6;
      obj.scale.multiplyScalar(0.6);
      obj.rotation.z = wobble * 2;
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.12 + bounce;
      obj.scale.multiplyScalar(1.08);
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = 0.35 + wobble;
      obj.scale.multiplyScalar(1.15);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 2.5;
    } else if (animPhase === 'delete-close' && animData.deleteIndex !== undefined && itemIndex >= animData.deleteIndex) {
      obj.position.y += 0.05;
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.4 + bounce;
      obj.rotation.z = isTarget1 ? 0.12 + wobble : -0.12 - wobble;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45;
      obj.rotation.z = isTarget1 ? -0.15 : 0.15;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.1 + bounce;
      obj.scale.multiplyScalar(1.1);
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.45 + bounce;
      obj.scale.multiplyScalar(0.65);
      obj.rotation.z = wobble;
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1 + bounce;
      obj.scale.multiplyScalar(1.03);
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.45 + bounce;
      obj.scale.multiplyScalar(0.65);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1 + bounce;
      obj.scale.multiplyScalar(1.03);
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.45;
      obj.rotation.z = 0.25 + wobble;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.75;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 2.2;
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.18 + bounce;
      obj.scale.multiplyScalar(1.12);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.55 + bounce;
      obj.scale.multiplyScalar(0.75);
      obj.rotation.z = wobble;
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.08 + bounce;
      obj.scale.multiplyScalar(1.06);
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.35;
      obj.rotation.z = -0.25 + wobble;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.85;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 2.8;
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.22 + bounce;
      obj.rotation.z = wobble * 0.5;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.28 + bounce;
      obj.scale.multiplyScalar(1.12);
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.06;
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 0.9;
      obj.scale.multiplyScalar(0.65);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.18;
      obj.scale.multiplyScalar(1.04);
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 0.75;
      obj.scale.multiplyScalar(0.82);
      obj.rotation.y = 0.25 + wobble;
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.4;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.18 + bounce;
      obj.scale.multiplyScalar(1.12);
    }
  }
}

// ==================== BUILD SCENE CONTENT ====================

function buildSceneContent(
  group: THREE.Group,
  data: DataItem[],
  highlightIndex: number | null,
  highlightIndex2: number | null,
  structure: DataStructure,
  environment: string,
  animPhase?: string,
  animData?: Record<string, any>
): void {
  // Clear existing children
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  }

  const spacing = structure === 'linkedlist' ? 1.05 
    : structure === 'queue' ? 0.9 
    : 0.8;
  const startX = -((data.length - 1) * spacing) / 2;

  // ========================================================
  // ==================== ARRAY =============================
  // ========================================================
  if (structure === 'array') {

    // ---------- GROCERY SHELF ----------
    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.7;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const product = createGroceryBox(item.color, item.label, isHl);
        product.position.set(startX + i * spacing, 0.08, 0);
        if (isHl) product.position.y += 0.08;
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array');
        group.add(product);

        // Index label
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 18);
        idx.position.set(startX + i * spacing, -0.12, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      // Metal shelf
      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.025, 0.32), shelfMat);
      mainShelf.position.y = 0.06;
      mainShelf.receiveShadow = true;
      group.add(mainShelf);

      // Shelf lip
      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.035, 0.012), shelfMat);
      lip.position.set(0, 0.075, 0.16);
      group.add(lip);

      // Lower shelf
      const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.025, 0.32), shelfMat);
      lowerShelf.position.y = -0.32;
      lowerShelf.receiveShadow = true;
      group.add(lowerShelf);

      // Support poles
      const poleMat = new THREE.MeshStandardMaterial({ color: '#a0a0a0', metalness: 0.8 });
      const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.85, 12);
      const poleXs = [-shelfWidth / 2 + 0.04, shelfWidth / 2 - 0.04];
      if (data.length > 3) poleXs.push(0);

      poleXs.forEach(x => {
        [0.14, -0.12].forEach(z => {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(x, -0.08, z);
          pole.castShadow = true;
          group.add(pole);
        });
      });

      // Price strip
      const stripCanvas = document.createElement('canvas');
      stripCanvas.width = 512;
      stripCanvas.height = 32;
      const sctx = stripCanvas.getContext('2d')!;
      sctx.fillStyle = '#2e7d32';
      sctx.fillRect(0, 0, 512, 32);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 16px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('★ FRESH ITEMS ★ BEST PRICE ★ FRESH ITEMS ★ BEST PRICE ★', 256, 22);
      
      const stripTex = new THREE.CanvasTexture(stripCanvas);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.055),
        new THREE.MeshBasicMaterial({ map: stripTex })
      );
      strip.position.set(0, 0.048, 0.165);
      group.add(strip);

      // Back panel
      const backPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.8),
        new THREE.MeshStandardMaterial({ color: '#f5f5f5', side: THREE.DoubleSide, roughness: 0.9 })
      );
      backPanel.position.set(0, -0.04, -0.14);
      backPanel.receiveShadow = true;
      group.add(backPanel);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 0.4, 0.75),
        new THREE.MeshStandardMaterial({ color: '#e8dcc8', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.52;
      floor.receiveShadow = true;
      group.add(floor);

    // ---------- CLASSROOM ----------
    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.4;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        
        if (item.appearance) {
          const human = createSimpleHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.75);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array');
          group.add(human);

          // Chair
          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.75);
          group.add(chair);

          // Desk
          const deskGeo = new THREE.BoxGeometry(0.28, 0.018, 0.18);
          const deskMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
          const desk = new THREE.Mesh(deskGeo, deskMat);
          desk.position.set(startX + i * spacing, -0.08, 0.18);
          desk.scale.setScalar(0.75);
          desk.castShadow = true;
          desk.receiveShadow = true;
          group.add(desk);
        }

        // Index
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 18);
        idx.position.set(startX + i * spacing, -0.38, 0);
        idx.scale.set(0.22, 0.1, 1);
        group.add(idx);
      });

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.4),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.32;
      floor.receiveShadow = true;
      group.add(floor);

      // Back wall
      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 0.95), wallMat);
      backWall.position.set(0, 0.12, -0.45);
      backWall.receiveShadow = true;
      group.add(backWall);

      // Whiteboard
      const boardGeo = new THREE.BoxGeometry(roomWidth * 0.55, 0.42, 0.018);
      const boardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(0, 0.26, -0.43);
      group.add(board);

      // Board frame
      const frameMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.5 });
      const hFrameGeo = new THREE.BoxGeometry(roomWidth * 0.57, 0.018, 0.025);
      
      const topFrame = new THREE.Mesh(hFrameGeo, frameMat);
      topFrame.position.set(0, 0.47, -0.42);
      group.add(topFrame);
      
      const botFrame = new THREE.Mesh(hFrameGeo, frameMat);
      botFrame.position.set(0, 0.04, -0.42);
      group.add(botFrame);

      // Board content
      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 280;
      boardCanvas.height = 140;
      const bctx = boardCanvas.getContext('2d')!;
      bctx.fillStyle = '#2c3e50';
      bctx.font = 'bold 26px Arial';
      bctx.textAlign = 'center';
      bctx.fillText('Data Structures', 140, 45);
      bctx.font = '18px Arial';
      bctx.fillText('Array: O(1) Access', 140, 78);
      bctx.fillText('Index: 0, 1, 2, ...', 140, 105);
      
      const boardTex = new THREE.CanvasTexture(boardCanvas);
      const boardText = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth * 0.5, 0.32),
        new THREE.MeshBasicMaterial({ map: boardTex, transparent: true })
      );
      boardText.position.set(0, 0.26, -0.42);
      group.add(boardText);

      // Ceiling
      const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.4),
        new THREE.MeshStandardMaterial({ color: '#f5f5f0', side: THREE.DoubleSide })
      );
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = 0.58;
      group.add(ceiling);

      // Ceiling lights
      const lightFixtureMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
      for (let lx = -roomWidth / 3; lx <= roomWidth / 3; lx += roomWidth / 3) {
        const lightFixture = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.012, 0.07),
          lightFixtureMat
        );
        lightFixture.position.set(lx, 0.57, 0);
        group.add(lightFixture);
      }

    // ---------- TODO LIST ----------
    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        clipboard.scale.setScalar(0.68);
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array');
        group.add(clipboard);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 18);
        idx.position.set(startX + i * spacing, -0.42, 0);
        idx.scale.set(0.22, 0.1, 1);
        group.add(idx);
      });

      // Wooden desk
      const deskWidth = data.length * spacing + 0.45;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(deskWidth, 0.035, 0.45),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.28;
      desk.castShadow = true;
      desk.receiveShadow = true;
      group.add(desk);

      // Desk edge
      const edgeGeo = new THREE.CylinderGeometry(0.018, 0.018, deskWidth, 12);
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({ color: '#4a3520' }));
      edge.rotation.z = Math.PI / 2;
      edge.position.set(0, -0.28, 0.24);
      group.add(edge);
    }

  // ========================================================
  // ==================== LINKED LIST =======================
  // ========================================================
  } else if (structure === 'linkedlist') {

    // ---------- TRAIN ----------
    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        trainCar.scale.setScalar(0.8);
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(trainCar);

        // Arrow to next
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.14;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 12);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.26, 0);
          ptrLabel.scale.set(0.28, 0.08, 1);
          group.add(ptrLabel);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 18, true);
      headSprite.position.set(startX, 0.58, 0);
      headSprite.scale.set(0.32, 0.12, 1);
      group.add(headSprite);

      // TAIL label
      const tailSprite = createTextSprite('TAIL', '#0066ff', 18, true);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.58, 0);
      tailSprite.scale.set(0.32, 0.12, 1);
      group.add(tailSprite);

      // NULL label
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.32, 0.22, 1);
      group.add(nullSprite);

      // Arrow to NULL
      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.12, false);
      nullArrow.position.y = -0.14;
      group.add(nullArrow);

      // Rails
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.4, 0.018, 0.025);
      [-0.11, 0.11].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.11, z);
        group.add(rail);
      });

      // Railroad ties
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.035, 0.012, 0.32);
      for (let x = startX - 0.45; x <= startX + data.length * spacing + 0.45; x += 0.16) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(x, -0.12, 0);
        group.add(tie);
      }

      // Ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.95),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.13;
      ground.receiveShadow = true;
      group.add(ground);

    // ---------- PEOPLE LINE ----------
    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createSimpleHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.7);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist');
          group.add(human);
        }

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = 0.08;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 11);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.04, 0);
          ptrLabel.scale.set(0.25, 0.07, 1);
          group.add(ptrLabel);
        }
      });

      // HEAD
      const headSprite = createTextSprite('HEAD', '#ff0000', 16, true);
      headSprite.position.set(startX, 0.52, 0);
      headSprite.scale.set(0.28, 0.1, 1);
      group.add(headSprite);

      // NULL
      const nullSprite = createTextSprite('NULL', '#ff0000', 18);
      nullSprite.position.set(startX + data.length * spacing, 0.08, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.08, false);
      nullArrow.position.y = 0.08;
      group.add(nullArrow);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 0.9, 0.55),
        new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.15;
      floor.receiveShadow = true;
      group.add(floor);

    // ---------- DOMINO ----------
    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        domino.scale.setScalar(0.8);
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(domino);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = -0.32;
          group.add(arrow);
        }
      });

      // HEAD
      const headSprite = createTextSprite('HEAD', '#ff0000', 16, true);
      headSprite.position.set(startX, 0.38, 0);
      headSprite.scale.set(0.28, 0.1, 1);
      group.add(headSprite);

      // NULL
      const nullSprite = createTextSprite('NULL', '#ff0000', 16);
      nullSprite.position.set(startX + data.length * spacing, -0.32, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.08, false);
      nullArrow.position.y = -0.32;
      group.add(nullArrow);

      // Green felt table
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.7, 0.035, 0.55),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.28;
      table.receiveShadow = true;
      group.add(table);

      // Table edge
      const edgeMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 });
      const edgeGeo = new THREE.BoxGeometry(data.length * spacing + 0.75, 0.055, 0.035);
      [0.3, -0.3].forEach(z => {
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(0, -0.28, z);
        group.add(edge);
      });
    }

  // ========================================================
  // ==================== STACK =============================
  // ========================================================
  } else if (structure === 'stack') {

    // ---------- BOOKS ----------
    if (environment === 'books') {
      const stackSpacing = 0.11;
      const baseY = -data.length * stackSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const book = createBook(item.label, item.color, isHl);
        book.position.set(isHl ? 0.18 : 0, baseY + i * stackSpacing, 0);
        book.rotation.y = (i % 2 === 0) ? 0 : 0.04;
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack');
        group.add(book);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 20, true);
          topSprite.position.set(0.65, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.38, 0.12, 1);
          group.add(topSprite);
        }
      });

      // Desk
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.035, 0.65),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = baseY - 0.08;
      desk.castShadow = true;
      desk.receiveShadow = true;
      group.add(desk);

    // ---------- PLATES ----------
    } else if (environment === 'plates') {
      const plateSpacing = 0.045;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plate = createPlate(item.label, isHl);
        plate.position.set(isHl ? 0.12 : 0, plateBaseY + i * plateSpacing, 0);
        plate.scale.setScalar(0.6);
        applyItemAnimation(plate, i, animPhase || '', animData || {}, 'stack');
        group.add(plate);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 20, true);
          topSprite.position.set(0.48, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.32, 0.1, 1);
          group.add(topSprite);
        }
      });

      // Counter
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.055, 0.55),
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.055;
      counter.receiveShadow = true;
      group.add(counter);

      // Front panel
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.28),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      panel.position.set(0, plateBaseY - 0.18, 0.28);
      group.add(panel);

      // Cafeteria sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 280;
      signCanvas.height = 52;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#e74c3c';
      sctx.fillRect(0, 0, 280, 52);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 28px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🍽️ CAFETERIA 🍽️', 140, 38);
      
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: signTex, transparent: true })
      );
      signSprite.position.set(0, plateBaseY + data.length * plateSpacing + 0.28, 0);
      signSprite.scale.set(0.75, 0.14, 1);
      group.add(signSprite);

    // ---------- BOXES ----------
    } else if (environment === 'boxes') {
      const boxSpacing = 0.4;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.18;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const isPeeking = animPhase === 'stack-peek-open' && isTop && isHl;
        const box = createCardboardBox(item.label, item.color, isHl, isPeeking);
        box.position.set(isHl ? 0.18 : 0, boxBaseY + i * boxSpacing, 0);
        box.rotation.y = (i % 2 === 0) ? 0 : 0.05;
        box.scale.setScalar(0.78);
        applyItemAnimation(box, i, animPhase || '', animData || {}, 'stack');
        group.add(box);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 20, true);
          topSprite.position.set(0.58, boxBaseY + i * boxSpacing, 0);
          topSprite.scale.set(0.32, 0.1, 1);
          group.add(topSprite);
        }
      });

      // Pallet
      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.055, 0.6),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.22;
      pallet.receiveShadow = true;
      group.add(pallet);

      // Pallet slats
      const slatGeo = new THREE.BoxGeometry(0.8, 0.012, 0.07);
      const slatMat = new THREE.MeshStandardMaterial({ color: '#8b6914' });
      [-0.22, 0, 0.22].forEach(z => {
        const slat = new THREE.Mesh(slatGeo, slatMat);
        slat.position.set(0, boxBaseY - 0.26, z);
        group.add(slat);
      });
    }

  // ========================================================
  // ==================== QUEUE =============================
  // ========================================================
  } else if (structure === 'queue') {

    // ---------- TOLLGATE ----------
    if (environment === 'tollgate') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        car.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
        car.scale.setScalar(0.78);
        applyItemAnimation(car, i, animPhase || '', animData || {}, 'queue');
        group.add(car);
      });

      // FRONT label
      const frontSprite = createTextSprite('FRONT', '#00ff00', 16, true);
      frontSprite.position.set(startX, -0.2, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      // REAR label
      const rearSprite = createTextSprite('REAR', '#ff6600', 16, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // Toll gate
      const gateX = startX - 0.75;
      const poleMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.5 });
      const poleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.65, 12);
      
      [0.22, -0.22].forEach(z => {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(gateX, 0.22, z);
        pole.castShadow = true;
        group.add(pole);
      });

      // Top bar
      const topBarGeo = new THREE.BoxGeometry(0.055, 0.055, 0.5);
      const topBar = new THREE.Mesh(topBarGeo, poleMat);
      topBar.position.set(gateX, 0.56, 0);
      group.add(topBar);

      // Barrier arm
      const barrierGeo = new THREE.BoxGeometry(0.45, 0.035, 0.035);
      const barrierMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(gateX - 0.22, 0.48, 0);
      barrier.rotation.z = 0.28;
      group.add(barrier);

      // Stripes on barrier
      const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
      for (let sx = -0.18; sx < 0.18; sx += 0.07) {
        const stripeGeo = new THREE.BoxGeometry(0.025, 0.04, 0.04);
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(gateX - 0.22 + sx, 0.48, 0);
        stripe.rotation.z = 0.28;
        group.add(stripe);
      }

      // TOLL sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 140;
      signCanvas.height = 52;
      const signCtx = signCanvas.getContext('2d')!;
      signCtx.fillStyle = '#2c3e50';
      signCtx.fillRect(0, 0, 140, 52);
      signCtx.fillStyle = '#fff';
      signCtx.font = 'bold 28px Arial';
      signCtx.textAlign = 'center';
      signCtx.fillText('TOLL', 70, 38);
      
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: signTex, transparent: true })
      );
      signSprite.position.set(gateX, 0.68, 0);
      signSprite.scale.set(0.32, 0.12, 1);
      group.add(signSprite);

      // Road
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.3, 0.65),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.07;
      road.receiveShadow = true;
      group.add(road);

      // Road dashed lines
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 0.9; x <= startX + data.length * spacing + 0.45; x += 0.22) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.022), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, -0.065, 0);
        group.add(dash);
      }

      // EXIT arrow
      const exitSprite = createTextSprite('EXIT →', '#00ff00', 18);
      exitSprite.position.set(gateX - 0.55, 0.28, 0);
      exitSprite.scale.set(0.32, 0.1, 1);
      group.add(exitSprite);

    // ---------- TICKETS ----------
    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticket = createTicket(item.label, item.color, isHl);
        ticket.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        ticket.scale.setScalar(0.78);
        applyItemAnimation(ticket, i, animPhase || '', animData || {}, 'queue');
        group.add(ticket);
      });

      // FRONT
      const frontSprite = createTextSprite('FRONT', '#00ff00', 16, true);
      frontSprite.position.set(startX, -0.2, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      // REAR
      const rearSprite = createTextSprite('REAR', '#ff6600', 16, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // Counter
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.55, 0.035, 0.38),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.14;
      counter.receiveShadow = true;
      group.add(counter);

      // NOW SERVING sign
      const servingCanvas = document.createElement('canvas');
      servingCanvas.width = 220;
      servingCanvas.height = 70;
      const svctx = servingCanvas.getContext('2d')!;
      svctx.fillStyle = '#1a1a2e';
      svctx.fillRect(0, 0, 220, 70);
      svctx.strokeStyle = '#ffd700';
      svctx.lineWidth = 3;
      svctx.strokeRect(4, 4, 212, 62);
      svctx.fillStyle = '#00ff00';
      svctx.font = 'bold 14px Arial';
      svctx.textAlign = 'center';
      svctx.fillText('NOW SERVING', 110, 24);
      svctx.font = 'bold 30px Arial';
      svctx.fillStyle = '#ff0';
      svctx.fillText(data.length > 0 ? data[0].label : '---', 110, 56);
      
      const servingTex = new THREE.CanvasTexture(servingCanvas);
      const servingSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: servingTex, transparent: true })
      );
      servingSprite.position.set(startX - 0.55, 0.18, 0);
      servingSprite.scale.set(0.42, 0.14, 1);
      group.add(servingSprite);

    // ---------- STUDENTS ----------
    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createSimpleHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.65);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue');
          group.add(human);
        }
      });

      // FRONT
      const frontSprite = createTextSprite('FRONT', '#00ff00', 14, true);
      frontSprite.position.set(startX, -0.18, 0);
      frontSprite.scale.set(0.25, 0.08, 1);
      group.add(frontSprite);

      // REAR
      const rearSprite = createTextSprite('REAR', '#ff6600', 14, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.18, 0);
      rearSprite.scale.set(0.25, 0.08, 1);
      group.add(rearSprite);

      // School building entrance
      const buildingX = startX - 0.85;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.8 });

      // Front wall
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.65, 0.75), wallMat);
      frontWall.position.set(buildingX, 0.18, 0);
      frontWall.castShadow = true;
      group.add(frontWall);

      // Door frame
      const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 });
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.32), doorFrameMat);
      doorFrame.position.set(buildingX + 0.018, 0.08, 0);
      group.add(doorFrame);

      // Door (open)
      const doorMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.7 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.42, 0.14), doorMat);
      door.position.set(buildingX + 0.045, 0.06, 0.11);
      door.rotation.y = -0.75;
      group.add(door);

      // School sign
      const schoolCanvas = document.createElement('canvas');
      schoolCanvas.width = 220;
      schoolCanvas.height = 52;
      const schCtx = schoolCanvas.getContext('2d')!;
      schCtx.fillStyle = '#1a5276';
      schCtx.fillRect(0, 0, 220, 52);
      schCtx.strokeStyle = '#ffd700';
      schCtx.lineWidth = 3;
      schCtx.strokeRect(3, 3, 214, 46);
      schCtx.fillStyle = '#fff';
      schCtx.font = 'bold 17px Arial';
      schCtx.textAlign = 'center';
      schCtx.fillText('📚 DS ACADEMY 📚', 110, 35);
      
      const schoolTex = new THREE.CanvasTexture(schoolCanvas);
      const schoolSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: schoolTex, transparent: true })
      );
      schoolSprite.position.set(buildingX, 0.58, 0);
      schoolSprite.scale.set(0.48, 0.11, 1);
      group.add(schoolSprite);

      // Roof
      const roofGeo = new THREE.BoxGeometry(0.09, 0.035, 0.8);
      const roofMat = new THREE.MeshStandardMaterial({ color: '#c0392b' });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.set(buildingX, 0.53, 0);
      roofMesh.castShadow = true;
      group.add(roofMesh);

      // Pathway
      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.7, 0.48),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.y = -0.13;
      pathway.receiveShadow = true;
      group.add(pathway);

      // Path lines
      const pathLineMat = new THREE.MeshBasicMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
      [-0.18, 0.18].forEach(z => {
        const pathLine = new THREE.Mesh(
          new THREE.PlaneGeometry(data.length * spacing + 1.4, 0.008),
          pathLineMat
        );
        pathLine.rotation.x = -Math.PI / 2;
        pathLine.position.set(0, -0.125, z);
        group.add(pathLine);
      });
    }
  }
}

// ==================== SIMPLE HUMAN 3D (Optimized Fallback) ====================

function createSimpleHuman3D(
  appearance: HumanAppearance, 
  name: string, 
  isHighlighted: boolean
): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  // HEAD
  const headGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.3,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.32;
  head.castShadow = true;
  human.add(head);

  // HAIR
  if (appearance.hairStyle !== 'bald') {
    const hairGeo = new THREE.SphereGeometry(0.095, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.34;
    hair.castShadow = true;
    human.add(hair);
  }

  // TORSO
  const torsoGeo = new THREE.CapsuleGeometry(0.07, 0.15, 4, 8);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.1;
  torso.castShadow = true;
  human.add(torso);

  // ARMS
  [-1, 1].forEach(side => {
    const armGeo = new THREE.CapsuleGeometry(0.015, 0.12, 4, 6);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.set(side * 0.09, 0.08, 0);
    arm.rotation.z = side * 0.2;
    arm.castShadow = true;
    human.add(arm);
  });

  // LEGS
  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  [-0.03, 0.03].forEach(x => {
    const legGeo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.08, 0);
    leg.castShadow = true;
    human.add(leg);
  });

  // SHOES
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  [-0.03, 0.03].forEach(x => {
    const shoeGeo = new THREE.BoxGeometry(0.035, 0.02, 0.05);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(x, -0.155, 0.01);
    shoe.castShadow = true;
    human.add(shoe);
  });

  // NAME LABEL
  const labelSprite = createTextSprite(name, isHighlighted ? '#ffff00' : '#ffffff', 18, true);
  labelSprite.position.y = 0.5;
  labelSprite.scale.set(0.4, 0.1, 1);
  human.add(labelSprite);

  // HIGHLIGHT
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.08, 0.13, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.16;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);

    const arrowGeo = new THREE.ConeGeometry(0.04, 0.08, 6);
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrow.position.y = 0.58;
    arrow.rotation.z = Math.PI;
    human.add(arrow);
  }

  return human;
}

// ==================== END OF PART 3 ====================
