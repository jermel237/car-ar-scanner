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
type AppMode = 'person' | 'surface' | 'webxr';
type SelectionMode = 'none' | 'delete' | 'swap-first' | 'swap-second' | 'access' | 'insert';

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

// ==================== STEP-BY-STEP TUTORIAL SYSTEM ====================

interface TutorialStep {
  title: string;
  description: string;
  codeSnippet?: string;
  highlightIndex?: number;
  highlightIndex2?: number;
  animPhase?: string;
  animDuration?: number;
  action?: () => void;
}

interface TutorialState {
  isActive: boolean;
  steps: TutorialStep[];
  currentStep: number;
  isAnimating: boolean;
}

// ==================== 3D TEXT SPRITE (IMPROVED) ====================

function createTextSprite(text: string, color: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  
  // Clear with transparency
  ctx.clearRect(0, 0, 512, 128);
  
  // Add subtle background for readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 15);
  ctx.fill();
  
  // Draw text with shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize * 2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  
  const spriteMat = new THREE.SpriteMaterial({ 
    map: tex, 
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  
  const sprite = new THREE.Sprite(spriteMat);
  sprite.renderOrder = 999;
  return sprite;
}

// ==================== 3D FLOATING TEXT BOX ====================

function create3DTextBox(
  title: string, 
  description: string, 
  step: string,
  position: THREE.Vector3
): THREE.Group {
  const group = new THREE.Group();
  
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Background with gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(30, 30, 60, 0.95)');
  gradient.addColorStop(1, 'rgba(20, 20, 40, 0.95)');
  ctx.fillStyle = gradient;
  ctx.roundRect(0, 0, 512, 256, 20);
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 4;
  ctx.roundRect(2, 2, 508, 252, 18);
  ctx.stroke();
  
  // Step indicator
  ctx.fillStyle = '#667eea';
  ctx.roundRect(15, 15, 80, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(step, 55, 35);
  
  // Title
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(title, 110, 38);
  
  // Description (word wrap)
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Arial';
  const words = description.split(' ');
  let line = '';
  let y = 80;
  const maxWidth = 480;
  const lineHeight = 26;
  
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), 20, y);
      line = word + ' ';
      y += lineHeight;
      if (y > 230) break;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), 20, y);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const material = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false 
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.75, 1);
  sprite.position.copy(position);
  sprite.renderOrder = 1000;
  
  group.add(sprite);
  
  return group;
}

// ==================== 3D ARROW ====================

function create3DArrow(fromX: number, toX: number, yHeight: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;

  const shaftRadius = 0.025;
  const headRadius = 0.06;
  const headLength = 0.1;

  const gap = 0.32;
  const startX = fromX + gap;
  const endX = toX - gap;
  const shaftLen = endX - startX - headLength;

  if (shaftLen <= 0) return arrow;

  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 8);
  const shaftMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.3,
    emissive: color,
    emissiveIntensity: 0.15
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(startX + shaftLen / 2, yHeight, 0);
  arrow.add(shaft);

  const headGeo = new THREE.ConeGeometry(headRadius, headLength, 8);
  const headMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.3,
    emissive: color,
    emissiveIntensity: 0.2
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.rotation.z = -Math.PI / 2;
  head.position.set(endX - headLength / 2, yHeight, 0);
  arrow.add(head);

  const ringGeo = new THREE.TorusGeometry(headRadius * 0.6, 0.008, 6, 12);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(endX, yHeight, 0);
  arrow.add(ring);

  return arrow;
}

// ==================== CLASSROOM CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.8, roughness: 0.3 });
  const seatMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });

  const seatGeo = new THREE.BoxGeometry(0.28, 0.04, 0.26);
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.y = 0;
  chair.add(seat);

  const frameGeo = new THREE.BoxGeometry(0.3, 0.02, 0.28);
  const frame = new THREE.Mesh(frameGeo, metalMat);
  frame.position.y = -0.03;
  chair.add(frame);

  const backGeo = new THREE.BoxGeometry(0.28, 0.22, 0.03);
  const back = new THREE.Mesh(backGeo, seatMat);
  back.position.set(0, 0.14, -0.12);
  chair.add(back);

  const backFrameGeo = new THREE.BoxGeometry(0.3, 0.24, 0.02);
  const backFrame = new THREE.Mesh(backFrameGeo, metalMat);
  backFrame.position.set(0, 0.14, -0.135);
  chair.add(backFrame);

  const legGeo = new THREE.BoxGeometry(0.02, 0.22, 0.02);
  [[-0.11, -0.14, 0.1], [0.11, -0.14, 0.1], [-0.11, -0.14, -0.1], [0.11, -0.14, -0.1]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  const supportGeo = new THREE.BoxGeometry(0.2, 0.015, 0.015);
  const support1 = new THREE.Mesh(supportGeo, metalMat);
  support1.position.set(0, -0.2, 0.1);
  chair.add(support1);
  const support2 = new THREE.Mesh(supportGeo, metalMat);
  support2.position.set(0, -0.2, -0.1);
  chair.add(support2);

  chair.position.x = x;
  return chair;
}

// ==================== CLASSROOM DESK ====================

function createDesk(x: number): THREE.Group {
  const desk = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.6, roughness: 0.4 });

  const topGeo = new THREE.BoxGeometry(0.4, 0.025, 0.28);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.y = 0;
  desk.add(top);

  const legGeo = new THREE.BoxGeometry(0.025, 0.28, 0.025);
  [[-0.17, -0.15, 0.11], [0.17, -0.15, 0.11], [-0.17, -0.15, -0.11], [0.17, -0.15, -0.11]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, ly, lz);
    desk.add(leg);
  });

  const crossGeo = new THREE.BoxGeometry(0.34, 0.02, 0.02);
  const cross = new THREE.Mesh(crossGeo, metalMat);
  cross.position.set(0, -0.22, 0);
  desk.add(cross);

  desk.position.x = x;
  return desk;
}

// ==================== GROCERY PRODUCT ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.28;
  const boxHeight = 0.42;
  const boxDepth = 0.08;

  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.05,
    emissive: isHighlighted ? '#ffff00' : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = boxHeight / 2;
  body.castShadow = true;
  product.add(body);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 140;
  frontCanvas.height = 210;
  const fctx = frontCanvas.getContext('2d')!;

  const grad = fctx.createLinearGradient(0, 0, 0, 210);
  grad.addColorStop(0, color);
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, '#ffffff');
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, 140, 210);

  fctx.fillStyle = '#fff';
  fctx.fillRect(5, 5, 130, 30);
  fctx.fillStyle = '#e74c3c';
  fctx.font = 'bold 12px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('★ BREAKFAST ★', 70, 24);

  fctx.fillStyle = '#f5f5dc';
  fctx.fillRect(25, 75, 90, 50);
  fctx.strokeStyle = '#ddd';
  fctx.lineWidth = 2;
  fctx.strokeRect(25, 75, 90, 50);

  const cerealColors = ['#8B4513', '#D2691E', '#F4A460', '#DEB887'];
  for (let i = 0; i < 8; i++) {
    fctx.fillStyle = cerealColors[i % cerealColors.length];
    fctx.fillRect(30 + (i % 4) * 20, 80 + Math.floor(i / 4) * 18, 12, 12);
  }

  fctx.fillStyle = '#2c3e50';
  fctx.font = 'bold 16px Arial';
  fctx.fillText(label, 70, 155);

  fctx.fillStyle = '#666';
  fctx.font = '10px Arial';
  fctx.fillText('Crunchy & Delicious!', 70, 172);

  fctx.fillStyle = '#27ae60';
  fctx.fillRect(95, 175, 36, 26);
  fctx.fillStyle = '#fff';
  fctx.font = 'bold 7px Arial';
  fctx.fillText('WHOLE', 113, 185);
  fctx.fillText('GRAIN', 113, 195);

  fctx.fillStyle = '#333';
  fctx.font = '9px Arial';
  fctx.fillText('NET WT 375g', 70, 205);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(boxWidth - 0.01, boxHeight - 0.01),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontLabel.position.set(0, boxHeight / 2, boxDepth / 2 + 0.001);
  product.add(frontLabel);

  const topGeo = new THREE.BoxGeometry(boxWidth, 0.01, boxDepth);
  const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.y = boxHeight + 0.005;
  product.add(topMesh);

  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 64;
  tagCanvas.height = 32;
  const tctx = tagCanvas.getContext('2d')!;
  tctx.fillStyle = '#ffeb3b';
  tctx.fillRect(0, 0, 64, 32);
  tctx.strokeStyle = '#f57f17';
  tctx.lineWidth = 2;
  tctx.strokeRect(1, 1, 62, 30);
  tctx.fillStyle = '#c62828';
  tctx.font = 'bold 14px Arial';
  tctx.textAlign = 'center';
  const prices: Record<string, string> = {
    'Coco Crunch': '$4.99', 'Corn Flakes': '$3.49', 'Froot Loops': '$5.29',
    'Cheerios': '$4.79', 'Frosted': '$4.49', 'New': '$3.99'
  };
  tctx.fillText(prices[label] || '$4.99', 32, 22);

  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const priceTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
  );
  priceTag.position.set(0, 0.02, boxDepth / 2 + 0.02);
  product.add(priceTag);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.04, boxHeight + 0.04, boxDepth + 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = boxHeight / 2;
    product.add(glow);

    const arrowGeo = new THREE.ConeGeometry(0.05, 0.08, 4);
    const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrowMesh.position.y = boxHeight + 0.12;
    arrowMesh.rotation.z = Math.PI;
    product.add(arrowMesh);
  }

  return product;
}

// ==================== HUMAN 3D ====================

function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean, isSeated: boolean = false, walkPhase: number = 0): THREE.Group {
  const human = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.15 : 0,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.15 : 0,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#111111' });
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#cc6666' });

  const scale = 0.12;
  const groundY = 0;

  const shoeHeight = 0.18 * scale;
  const lowerLegHeight = 0.7 * scale;
  const upperLegHeight = 0.75 * scale;
  const torsoHeight = 1.0 * scale;
  const neckHeight = 0.15 * scale;
  const headHeight = 0.75 * scale;

  if (isSeated) {
    const seatHeight = groundY + 0.02;

    [-1, 1].forEach((side) => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, shoeHeight, 0.42 * scale), shoeMat);
      shoe.position.set(side * 0.22 * scale, groundY + shoeHeight / 2, 0.4 * scale);
      human.add(shoe);
    });

    [-1, 1].forEach((side) => {
      const lowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, lowerLegHeight, 0.3 * scale), pantsMat);
      lowerLeg.position.set(side * 0.22 * scale, groundY + shoeHeight + lowerLegHeight / 2, 0.38 * scale);
      human.add(lowerLeg);
    });

    const upperLegY = seatHeight + 0.04 * scale;
    [-1, 1].forEach((side) => {
      const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.14 * scale, upperLegHeight), pantsMat);
      upperLeg.position.set(side * 0.22 * scale, upperLegY, 0.18 * scale);
      human.add(upperLeg);
    });

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.18 * scale, 0.38 * scale), pantsMat);
    hips.position.set(0, upperLegY + 0.04 * scale, -0.05 * scale);
    human.add(hips);

    const torsoY = upperLegY + 0.12 * scale + torsoHeight / 2;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, torsoHeight, 0.5 * scale), shirtMat);
    torso.position.set(0, torsoY, -0.05 * scale);
    torso.castShadow = true;
    human.add(torso);

    const neckY = torsoY + torsoHeight / 2 + neckHeight / 2;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, neckHeight, 0.25 * scale), skinMat);
    neck.position.set(0, neckY, -0.05 * scale);
    human.add(neck);

    const headY = neckY + neckHeight / 2 + headHeight / 2;
    const headGroup = new THREE.Group();
    headGroup.position.set(0, headY, -0.05 * scale);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, headHeight, 0.7 * scale), skinMat);
    headGroup.add(head);

    if (appearance.hairStyle !== 'bald') {
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.74 * scale, 0.3 * scale, 0.74 * scale), hairMat);
      hairTop.position.y = 0.3 * scale;
      headGroup.add(hairTop);
    }

    if (appearance.hairStyle === 'long') {
      const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.74 * scale, 0.6 * scale, 0.15 * scale), hairMat);
      hairBack.position.set(0, 0, -0.32 * scale);
      headGroup.add(hairBack);
    }

    const eyeGeo = new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.05 * scale);
    [-0.15, 0.15].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x * scale, 0.05 * scale, 0.35 * scale);
      headGroup.add(eye);
    });

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.05 * scale, 0.05 * scale), mouthMat);
    mouth.position.set(0, -0.15 * scale, 0.35 * scale);
    headGroup.add(mouth);

    human.add(headGroup);

    [-1, 1].forEach((side) => {
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.55 * scale, 0.25 * scale), shirtMat);
      upperArm.position.set(side * 0.6 * scale, torsoY, 0.1 * scale);
      upperArm.rotation.x = -0.8;
      human.add(upperArm);

      const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.22 * scale), skinMat);
      lowerArm.position.set(side * 0.55 * scale, torsoY - 0.15 * scale, 0.35 * scale);
      lowerArm.rotation.x = -1.2;
      human.add(lowerArm);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale), skinMat);
      hand.position.set(side * 0.5 * scale, torsoY - 0.25 * scale, 0.45 * scale);
      human.add(hand);
    });

    if (isHighlighted) {
      const plumbob = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
      );
      plumbob.position.set(0, headY + headHeight / 2 + 0.06, -0.05 * scale);
      human.add(plumbob);
    }

    const labelY = headY + headHeight / 2 + 0.1;
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200;
    labelCanvas.height = 48;
    const lctx = labelCanvas.getContext('2d')!;
    if (isHighlighted) {
      lctx.fillStyle = '#00ff00';
      lctx.beginPath();
      lctx.roundRect(0, 0, 200, 48, 12);
      lctx.fill();
      lctx.fillStyle = '#000';
    } else {
      lctx.fillStyle = 'rgba(0,0,0,0.85)';
      lctx.beginPath();
      lctx.roundRect(0, 0, 200, 48, 12);
      lctx.fill();
      lctx.fillStyle = '#ffffff';
    }
    lctx.font = 'bold 24px Arial';
    lctx.textAlign = 'center';
    lctx.fillText(name, 100, 34);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.set(0, labelY, 0);
    labelSprite.scale.set(0.32, 0.08, 1);
    human.add(labelSprite);

  } else {
    const totalLegHeight = shoeHeight + lowerLegHeight + upperLegHeight;
    const hipY = groundY + totalLegHeight;
    const torsoY = hipY + torsoHeight / 2;
    const neckY = torsoY + torsoHeight / 2;
    const headY = neckY + neckHeight + headHeight / 2;

    [-1, 1].forEach((side, idx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(side * 0.22 * scale, hipY, 0);

      const upperLegPivot = new THREE.Group();
      const upperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, upperLegHeight, 0.32 * scale), pantsMat);
      upperLeg.position.y = -upperLegHeight / 2;
      upperLegPivot.add(upperLeg);

      const lowerLegPivot = new THREE.Group();
      lowerLegPivot.position.y = -upperLegHeight;

      const lowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, lowerLegHeight, 0.3 * scale), pantsMat);
      lowerLeg.position.y = -lowerLegHeight / 2;
      lowerLegPivot.add(lowerLeg);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, shoeHeight, 0.42 * scale), shoeMat);
      shoe.position.set(0, -lowerLegHeight - shoeHeight / 2, 0.05 * scale);
      lowerLegPivot.add(shoe);

      upperLegPivot.add(lowerLegPivot);
      legGroup.add(upperLegPivot);

      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase + (idx === 0 ? 0 : Math.PI)) * 0.5;
        upperLegPivot.rotation.x = swing;
        const kneeBend = Math.max(0, -Math.sin(walkPhase + (idx === 0 ? 0 : Math.PI))) * 0.6;
        lowerLegPivot.rotation.x = kneeBend;
      }

      human.add(legGroup);
    });

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.18 * scale, 0.42 * scale), pantsMat);
    hips.position.set(0, hipY, 0);
    human.add(hips);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, torsoHeight, 0.5 * scale), shirtMat);
    torso.position.set(0, torsoY, 0);
    torso.castShadow = true;
    human.add(torso);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, neckHeight, 0.25 * scale), skinMat);
    neck.position.set(0, neckY + neckHeight / 2, 0);
    human.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, headY, 0);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, headHeight, 0.7 * scale), skinMat);
    headGroup.add(head);

    if (appearance.hairStyle !== 'bald') {
      const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.74 * scale, 0.3 * scale, 0.74 * scale), hairMat);
      hairTop.position.y = 0.3 * scale;
      headGroup.add(hairTop);
    }

    if (appearance.hairStyle === 'long') {
      const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.74 * scale, 0.6 * scale, 0.15 * scale), hairMat);
      hairBack.position.set(0, 0, -0.32 * scale);
      headGroup.add(hairBack);

      [-0.35, 0.35].forEach(x => {
        const hairSide = new THREE.Mesh(new THREE.BoxGeometry(0.15 * scale, 0.5 * scale, 0.3 * scale), hairMat);
        hairSide.position.set(x * scale, -0.05 * scale, -0.1 * scale);
        headGroup.add(hairSide);
      });
    }

    const eyeGeo = new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.05 * scale);
    [-0.15, 0.15].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x * scale, 0.05 * scale, 0.35 * scale);
      headGroup.add(eye);
    });

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.05 * scale, 0.05 * scale), mouthMat);
    mouth.position.set(0, -0.15 * scale, 0.35 * scale);
    headGroup.add(mouth);

    human.add(headGroup);

    [-1, 1].forEach((side, idx) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.575 * scale, torsoY + torsoHeight * 0.35, 0);

      const upperArmPivot = new THREE.Group();
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.55 * scale, 0.25 * scale), shirtMat);
      upperArm.position.y = -0.275 * scale;
      upperArmPivot.add(upperArm);

      const lowerArmPivot = new THREE.Group();
      lowerArmPivot.position.y = -0.55 * scale;

      const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.22 * scale), skinMat);
      lowerArm.position.y = -0.25 * scale;
      lowerArmPivot.add(lowerArm);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale), skinMat);
      hand.position.y = -0.55 * scale;
      lowerArmPivot.add(hand);

      upperArmPivot.add(lowerArmPivot);
      armGroup.add(upperArmPivot);

      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase) * 0.7;
        upperArmPivot.rotation.x = side === -1 ? swing : -swing;
        lowerArmPivot.rotation.x = Math.max(0, Math.sin(walkPhase + (side === -1 ? 0 : Math.PI))) * 0.3;
      }

      human.add(armGroup);
    });

    if (isHighlighted) {
      const plumbob = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
      );
      plumbob.position.set(0, headY + headHeight / 2 + 0.06, 0);
      human.add(plumbob);
    }

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200;
    labelCanvas.height = 48;
    const lctx = labelCanvas.getContext('2d')!;
    if (isHighlighted) {
      lctx.fillStyle = '#00ff00';
      lctx.beginPath();
      lctx.roundRect(0, 0, 200, 48, 12);
      lctx.fill();
      lctx.fillStyle = '#000';
    } else {
      lctx.fillStyle = 'rgba(0,0,0,0.85)';
      lctx.beginPath();
      lctx.roundRect(0, 0, 200, 48, 12);
      lctx.fill();
      lctx.fillStyle = '#ffffff';
    }
    lctx.font = 'bold 24px Arial';
    lctx.textAlign = 'center';
    lctx.fillText(name, 100, 34);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
    labelSprite.position.set(0, headY + headHeight / 2 + 0.1, 0);
    labelSprite.scale.set(0.32, 0.08, 1);
    human.add(labelSprite);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = groundY + 0.001;
  human.add(shadow);

  return human;
}
// ==================== BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean, isOpen: boolean = false, openAmount: number = 0): THREE.Group {
  const book = new THREE.Group();

  const bookWidth = 0.55;
  const bookHeight = 0.07;
  const bookDepth = 0.38;
  const pageInset = 0.015;

  const spineColor = new THREE.Color(color).multiplyScalar(0.7);
  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
    emissive: isHighlighted && !isOpen ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted && !isOpen ? 0.3 : 0,
  });

  const backCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, 0.008, bookDepth), coverMat);
  backCover.position.y = -bookHeight / 2 + 0.004;
  book.add(backCover);

  const pagesBlock = new THREE.Mesh(
    new THREE.BoxGeometry(bookWidth - pageInset * 2, bookHeight - 0.02, bookDepth - pageInset * 2),
    new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 })
  );
  pagesBlock.position.set(pageInset / 2, 0, 0);
  book.add(pagesBlock);

  const pageLineMat = new THREE.MeshBasicMaterial({ color: '#e8e0d0' });
  for (let y = -bookHeight / 2 + 0.01; y <= bookHeight / 2 - 0.01; y += 0.003) {
    const lineRight = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.001, bookDepth - pageInset * 3), pageLineMat);
    lineRight.position.set(bookWidth / 2 - pageInset, y, 0);
    book.add(lineRight);
  }

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, bookHeight, bookDepth),
    new THREE.MeshStandardMaterial({ color: spineColor, roughness: 0.4 })
  );
  spine.position.x = -bookWidth / 2 - 0.0125;
  book.add(spine);

  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  [-0.14, -0.05, 0.05, 0.14].forEach(z => {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.005, bookHeight + 0.005, 0.015), ridgeMat);
    ridge.position.set(-bookWidth / 2 - 0.025, 0, z);
    book.add(ridge);
  });

  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 140;
  spineCanvas.height = 30;
  const sctx = spineCanvas.getContext('2d')!;
  sctx.fillStyle = '#ffd700';
  sctx.font = 'bold 16px serif';
  sctx.textAlign = 'center';
  sctx.fillText(label, 70, 22);
  const spineTex = new THREE.CanvasTexture(spineCanvas);
  const spineLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.05),
    new THREE.MeshBasicMaterial({ map: spineTex, transparent: true })
  );
  spineLabel.position.set(-bookWidth / 2 - 0.026, 0, 0);
  spineLabel.rotation.y = -Math.PI / 2;
  spineLabel.rotation.z = Math.PI / 2;
  book.add(spineLabel);

  const frontCoverGroup = new THREE.Group();
  frontCoverGroup.position.set(-bookWidth / 2, bookHeight / 2 - 0.004, 0);

  const frontCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, 0.008, bookDepth), coverMat);
  frontCover.position.set(bookWidth / 2, 0, 0);
  frontCoverGroup.add(frontCover);

  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 180;
  coverCanvas.height = 140;
  const cctx = coverCanvas.getContext('2d')!;
  cctx.strokeStyle = '#ffd700';
  cctx.lineWidth = 4;
  cctx.strokeRect(8, 8, 164, 124);
  cctx.lineWidth = 1;
  cctx.strokeRect(14, 14, 152, 112);
  cctx.fillStyle = '#ffd700';
  cctx.font = 'bold 24px serif';
  cctx.textAlign = 'center';
  cctx.fillText(label, 90, 75);
  cctx.font = '12px serif';
  cctx.fillText('TEXTBOOK', 90, 98);
  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.28),
    new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
  );
  coverLabel.position.set(bookWidth / 2, 0.005, 0);
  coverLabel.rotation.x = -Math.PI / 2;
  frontCoverGroup.add(coverLabel);

  if (isOpen && openAmount > 0) {
    const easedOpen = openAmount < 0.5 ? 2 * openAmount * openAmount : 1 - Math.pow(-2 * openAmount + 2, 2) / 2;
    frontCoverGroup.rotation.z = easedOpen * Math.PI * 0.55;
  }

  book.add(frontCoverGroup);

  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.12, 0.003),
    new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.6 })
  );
  ribbon.position.set(0.08, 0, bookDepth / 2 + 0.002);
  book.add(ribbon);

  if (isHighlighted && !isOpen) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth + 0.05, bookHeight + 0.02, bookDepth + 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    book.add(glow);
  }

  return book;
}

// ==================== CLIPBOARD (TODO) ====================

function createClipboard(label: string, color: string, isHighlighted: boolean, allTasks?: DataItem[]): THREE.Group {
  const clipboard = new THREE.Group();

  const boardMat = new THREE.MeshStandardMaterial({
    color: '#6d4c2a',
    roughness: 0.65,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.025), boardMat);
  clipboard.add(board);

  const edgeMat = new THREE.MeshStandardMaterial({ color: '#5a3d1f', roughness: 0.7 });
  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.03), edgeMat);
  topEdge.position.y = 0.25;
  clipboard.add(topEdge);

  const clipMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.2 });
  const clipBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), clipMat);
  clipBase.position.set(0, 0.26, 0.02);
  clipboard.add(clipBase);

  const clipArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.06), clipMat);
  clipArm.position.set(0, 0.28, 0.04);
  clipboard.add(clipArm);

  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 190;
  paperCanvas.height = 280;
  const pctx = paperCanvas.getContext('2d')!;

  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 190, 280);

  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 190, 40);
  pctx.fillStyle = '#fff';
  pctx.font = 'bold 18px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO LIST', 95, 28);

  pctx.strokeStyle = '#ddd';
  pctx.lineWidth = 1;
  for (let y = 60; y < 260; y += 28) {
    pctx.beginPath();
    pctx.moveTo(20, y);
    pctx.lineTo(170, y);
    pctx.stroke();
  }

  const items = allTasks ? allTasks.map((t, i) => ({ text: t.label, checked: i < allTasks.length - 1 })) : [
    { text: label, checked: false },
    { text: 'Review notes', checked: true },
    { text: 'Practice code', checked: false },
    { text: 'Take break', checked: true },
  ];

  pctx.font = '14px Arial';
  pctx.textAlign = 'left';
  items.slice(0, 6).forEach((item, i) => {
    const y = 55 + i * 28;

    pctx.strokeStyle = '#333';
    pctx.lineWidth = 2;
    pctx.strokeRect(22, y - 12, 14, 14);

    if (item.checked) {
      pctx.strokeStyle = '#27ae60';
      pctx.lineWidth = 3;
      pctx.beginPath();
      pctx.moveTo(24, y - 4);
      pctx.lineTo(28, y);
      pctx.lineTo(34, y - 10);
      pctx.stroke();
    }

    pctx.fillStyle = item.checked ? '#999' : '#333';
    pctx.fillText(item.text.substring(0, 12), 44, y);

    if (item.checked) {
      pctx.strokeStyle = '#999';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(44, y - 4);
      pctx.lineTo(44 + Math.min(pctx.measureText(item.text).width, 80), y - 4);
      pctx.stroke();
    }
  });

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), new THREE.MeshBasicMaterial({ map: paperTex }));
  paper.position.z = 0.014;
  clipboard.add(paper);

  const penGroup = new THREE.Group();
  const penBodyMat = new THREE.MeshStandardMaterial({ color: '#1a237e', metalness: 0.3, roughness: 0.5 });
  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), penBodyMat);
  penGroup.add(penBody);

  const gripMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.8 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12), gripMat);
  grip.position.y = -0.06;
  penGroup.add(grip);

  const tipMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.03, 12), tipMat);
  tip.position.y = -0.125;
  tip.rotation.z = Math.PI;
  penGroup.add(tip);

  const clipPen = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.004), tipMat);
  clipPen.position.set(0.014, 0.06, 0);
  penGroup.add(clipPen);

  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), penBodyMat);
  capTop.position.y = 0.11;
  penGroup.add(capTop);

  penGroup.position.set(0.22, -0.08, 0.03);
  penGroup.rotation.z = -0.3;
  clipboard.add(penGroup);

  if (isHighlighted) {
    clipboard.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.54, 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    ));
  }

  return clipboard;
}

// ==================== TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.7, 0.32, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.14;
  train.add(body);

  const stripeGeo = new THREE.BoxGeometry(0.72, 0.03, 0.33);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.2;
  train.add(stripe);

  const roofGeo = new THREE.BoxGeometry(0.66, 0.06, 0.28);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.33;
  train.add(roof);

  const underGeo = new THREE.BoxGeometry(0.68, 0.05, 0.26);
  const underMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.7 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.04;
  train.add(under);

  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });
  const spokeMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.7 });

  [[-0.22, -0.05, 0.17], [0.22, -0.05, 0.17], [-0.22, -0.05, -0.17], [0.22, -0.05, -0.17]].forEach(([wx, wy, wz]) => {
    const wheelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    train.add(wheel);

    const hubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.025, 12);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, wy, wz + (wz > 0 ? 0.005 : -0.005));
    train.add(hub);

    for (let i = 0; i < 6; i++) {
      const spokeGeo = new THREE.BoxGeometry(0.008, 0.05, 0.005);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.set(wx, wy, wz);
      spoke.rotation.z = (i * Math.PI) / 3;
      train.add(spoke);
    }
  });

  if (!isEngine) {
    const windowGeo = new THREE.BoxGeometry(0.1, 0.09, 0.01);
    const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.5, roughness: 0.1 });
    [-0.22, 0, 0.22].forEach(x => {
      const wF = new THREE.Mesh(windowGeo, windowMat);
      wF.position.set(x, 0.18, 0.165);
      train.add(wF);
      const wB = new THREE.Mesh(windowGeo, windowMat);
      wB.position.set(x, 0.18, -0.165);
      train.add(wB);
    });
  }

  if (isEngine) {
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.5, roughness: 0.4 });
    const boilerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12);
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(-0.15, 0.16, 0);
    train.add(boiler);

    const frontPlateGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12);
    const frontPlateMat = new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.7 });
    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.rotation.z = Math.PI / 2;
    frontPlate.position.set(-0.36, 0.16, 0);
    train.add(frontPlate);

    const bandMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.8 });
    [0.05, -0.1, -0.25].forEach(x => {
      const bandGeo = new THREE.TorusGeometry(0.125, 0.015, 8, 16);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.rotation.y = Math.PI / 2;
      band.position.set(x, 0.16, 0);
      train.add(band);
    });

    const headlightHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.6 })
    );
    headlightHousing.rotation.z = Math.PI / 2;
    headlightHousing.position.set(-0.4, 0.28, 0);
    train.add(headlightHousing);

    const headlightLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.035, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffaa' })
    );
    headlightLens.rotation.y = -Math.PI / 2;
    headlightLens.position.set(-0.43, 0.28, 0);
    train.add(headlightLens);

    const chimneyBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 })
    );
    chimneyBase.position.set(-0.08, 0.32, 0);
    train.add(chimneyBase);

    const chimneyTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.05, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 })
    );
    chimneyTop.position.set(-0.08, 0.44, 0);
    train.add(chimneyTop);

    const chimneyRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.012, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 })
    );
    chimneyRim.rotation.x = Math.PI / 2;
    chimneyRim.position.set(-0.08, 0.5, 0);
    train.add(chimneyRim);

    const smokePuffs = [
      { y: 0.58, scale: 0.06, opacity: 0.5 },
      { y: 0.68, scale: 0.09, opacity: 0.4 },
      { y: 0.80, scale: 0.12, opacity: 0.3 },
      { y: 0.94, scale: 0.15, opacity: 0.2 },
      { y: 1.10, scale: 0.18, opacity: 0.1 },
    ];
    smokePuffs.forEach(({ y, scale, opacity }, idx) => {
      const smokeGeo = new THREE.SphereGeometry(scale, 8, 8);
      const smokePuffMat = new THREE.MeshBasicMaterial({ color: '#d0d0d0', transparent: true, opacity });
      const smoke = new THREE.Mesh(smokeGeo, smokePuffMat);
      smoke.position.set(-0.08 + (idx * 0.02), y, (Math.random() - 0.5) * 0.08);
      train.add(smoke);
    });

    const steamDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.5 })
    );
    steamDome.position.set(0.05, 0.28, 0);
    train.add(steamDome);

    const sandDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: '#8b4513', metalness: 0.3 })
    );
    sandDome.position.set(-0.2, 0.32, 0);
    train.add(sandDome);

    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7 });
    const catcherBase = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.28), catcherMat);
    catcherBase.position.set(-0.4, 0, 0);
    train.add(catcherBase);

    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.015), catcherMat);
      bar.position.set(-0.43, -0.02, i * 0.035);
      bar.rotation.z = 0.4;
      train.add(bar);
    }

    const cabinMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.32), cabinMat);
    cabin.position.set(0.26, 0.24, 0);
    train.add(cabin);

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.36), roofMat);
    cabRoof.position.set(0.26, 0.38, 0);
    train.add(cabRoof);

    const cabWinMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4 });
    [-0.151, 0.151].forEach(z => {
      const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.1), cabWinMat);
      cabWin.position.set(0.26, 0.28, z);
      train.add(cabWin);
    });

    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.01), cabWinMat);
    rearWin.position.set(0.26, 0.28, 0.165);
    train.add(rearWin);

    const bellMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.9, roughness: 0.1 });
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      bellMat
    );
    bell.rotation.x = Math.PI;
    bell.position.set(0.08, 0.36, 0);
    train.add(bell);

    const bellMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.04, 0.02),
      new THREE.MeshStandardMaterial({ color: '#333' })
    );
    bellMount.position.set(0.08, 0.32, 0);
    train.add(bellMount);

    const pistonMat = new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8 });
    [-0.14, 0.14].forEach(z => {
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), pistonMat);
      piston.rotation.z = Math.PI / 2;
      piston.position.set(-0.25, 0.02, z);
      train.add(piston);

      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.015), pistonMat);
      rod.position.set(-0.12, -0.02, z);
      train.add(rod);
    });
  }

  const hookGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8 });
  [-0.375, 0.375].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);
  });

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isHighlighted ? 'rgba(255,255,0,0.9)' : 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 160, 48, 10);
  ctx.fill();
  ctx.fillStyle = isHighlighted ? '#000' : '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, 80, 34);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = isEngine ? 0.75 : 0.55;
  labelSprite.scale.set(0.42, 0.13, 1);
  train.add(labelSprite);

  if (isHighlighted) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.42, 0.38),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    glow.position.y = 0.14;
    train.add(glow);
  }

  train.rotation.y = Math.PI;

  return train;
}

// ==================== TOLL BOOTH ====================

function createTollBooth(gateOpenAmount: number = 0): THREE.Group {
  const toll = new THREE.Group();
  const groundY = 0;

  const boothMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.6, metalness: 0.3 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.35), boothMat);
  booth.position.set(0, groundY + 0.325, -0.55);
  toll.add(booth);

  const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.8 });
  const boothWindow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.01), windowMat);
  boothWindow.position.set(0, groundY + 0.42, -0.37);
  toll.add(boothWindow);

  const roofMat = new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.5 });
  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.45), roofMat);
  boothRoof.position.set(0, groundY + 0.67, -0.55);
  toll.add(boothRoof);

  const trimMat = new THREE.MeshStandardMaterial({ color: '#f39c12', metalness: 0.5 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.47), trimMat);
  trim.position.set(0, groundY + 0.7, -0.55);
  toll.add(trim);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 120;
  signCanvas.height = 50;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = '#006400';
  sctx.fillRect(0, 0, 120, 50);
  sctx.strokeStyle = '#fff';
  sctx.lineWidth = 3;
  sctx.strokeRect(3, 3, 114, 44);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 24px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('TOLL', 60, 35);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(0, groundY + 0.58, -0.36);
  toll.add(signMesh);

  const postMat = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.5, metalness: 0.3 });
  const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), postMat);
  gatePost.position.set(0, groundY + 0.15, -0.32);
  toll.add(gatePost);

  const gatePivot = new THREE.Group();
  gatePivot.position.set(0, groundY + 0.28, -0.32);

  const armLength = 0.8;
  const gateArmMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const gateArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, armLength), gateArmMat);
  gateArm.position.set(0, 0, armLength / 2);
  gatePivot.add(gateArm);

  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  for (let i = 0; i < 7; i++) {
    const stripeBox = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.04), stripeMat);
    stripeBox.position.set(0, 0, 0.08 + i * 0.1);
    gatePivot.add(stripeBox);
  }

  const endCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.08),
    new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.5 })
  );
  endCap.position.set(0, 0, armLength);
  gatePivot.add(endCap);

  const reflector = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.02),
    new THREE.MeshBasicMaterial({ color: '#ff0000' })
  );
  reflector.position.set(0, 0, armLength + 0.04);
  gatePivot.add(reflector);

  const easedOpen = gateOpenAmount < 0.5
    ? 2 * gateOpenAmount * gateOpenAmount
    : 1 - Math.pow(-2 * gateOpenAmount + 2, 2) / 2;
  gatePivot.rotation.x = -easedOpen * Math.PI * 0.45;

  toll.add(gatePivot);

  const terminalMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.4 });
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.06), terminalMat);
  terminal.position.set(0, groundY + 0.125, -0.38);
  toll.add(terminal);

  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.005),
    new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#00ff00' : '#ffff00' })
  );
  screen.position.set(0, groundY + 0.2, -0.345);
  toll.add(screen);

  const lightHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.06),
    new THREE.MeshStandardMaterial({ color: '#222' })
  );
  lightHousing.position.set(0, groundY + 0.78, -0.55);
  toll.add(lightHousing);

  const greenLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.02),
    new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#00ff00' : '#003300' })
  );
  greenLight.position.set(0, groundY + 0.81, -0.515);
  toll.add(greenLight);

  const redLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.02),
    new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#330000' : '#ff0000' })
  );
  redLight.position.set(0, groundY + 0.75, -0.515);
  toll.add(redLight);

  const bumpMat = new THREE.MeshStandardMaterial({ color: '#f1c40f' });
  [-0.25, 0.25].forEach(x => {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.5), bumpMat);
    bump.position.set(x, groundY + 0.008, 0);
    toll.add(bump);
  });

  return toll;
}

// ==================== CAR ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.3,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.26), bodyMat);
  body.position.y = 0.1;
  car.add(body);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.04, 0.27), bodyMat);
  panel.position.y = 0.04;
  car.add(panel);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.24), bodyMat);
  hood.position.set(-0.18, 0.19, 0);
  car.add(hood);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.24), bodyMat);
  trunk.position.set(0.22, 0.185, 0);
  car.add(trunk);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.23), bodyMat);
  cabin.position.set(0.02, 0.23, 0);
  car.add(cabin);

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.22), bodyMat);
  roofMesh.position.set(0.02, 0.3, 0);
  car.add(roofMesh);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#a8d8ea', metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.75 });

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.21), glassMat);
  windshield.position.set(-0.1, 0.24, 0);
  car.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.21), glassMat);
  rearWindow.position.set(0.14, 0.24, 0);
  car.add(rearWindow);

  [-0.131, 0.131].forEach(z => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.01), glassMat);
    sw.position.set(0.02, 0.24, z);
    car.add(sw);
  });

  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });

  [[-0.16, 0.045, 0.135], [0.16, 0.045, 0.135], [-0.16, 0.045, -0.135], [0.16, 0.045, -0.135]].forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.025), tireMat);
    tire.position.set(wx, wy, wz);
    car.add(tire);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.028), rimMat);
    rim.position.set(wx, wy, wz);
    car.add(rim);
  });

  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  [-0.09, 0.09].forEach(z => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, 0.055), headlightMat);
    hl.position.set(-0.275, 0.1, z);
    car.add(hl);
  });

  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.085, 0.085].forEach(z => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.045), tailMat);
    tl.position.set(0.275, 0.1, z);
    car.add(tl);
  });

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8 }));
  grille.position.set(-0.28, 0.08, 0);
  car.add(grille);

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 96;
  plateCanvas.height = 36;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 96, 36);
  pctx.strokeStyle = '#2c3e50';
  pctx.lineWidth = 2;
  pctx.strokeRect(2, 2, 92, 32);
  pctx.fillStyle = '#2c3e50';
  pctx.font = 'bold 14px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 48, 24);
  const plateTex = new THREE.CanvasTexture(plateCanvas);

  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: plateTex }));
  frontPlate.position.set(-0.281, 0.04, 0);
  frontPlate.rotation.y = -Math.PI / 2;
  car.add(frontPlate);

  const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: plateTex }));
  rearPlate.position.set(0.281, 0.04, 0);
  rearPlate.rotation.y = Math.PI / 2;
  car.add(rearPlate);

  if (isHighlighted) {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.32), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 }));
    glow.position.y = 0.15;
    car.add(glow);
  }

  return car;
}

// ==================== PLATE ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  const plateMat = new THREE.MeshStandardMaterial({
    color: '#f5f5f0',
    roughness: 0.25,
    metalness: 0.1,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0
  });
  const plateBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.38), plateMat);
  plate.add(plateBase);

  const rimMat = new THREE.MeshStandardMaterial({ color: '#e8e8e0', roughness: 0.3, metalness: 0.15 });
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.4), rimMat);
  rim.position.y = 0.012;
  plate.add(rim);

  const innerPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.008, 0.32),
    new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.3 })
  );
  innerPlate.position.y = 0.018;
  plate.add(innerPlate);

  const decorRing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.003, 0.35),
    new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.6 })
  );
  decorRing.position.y = 0.022;
  plate.add(decorRing);

  const riceMat = new THREE.MeshStandardMaterial({ color: '#fffef5', roughness: 0.9 });
  const riceBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.12), riceMat);
  riceBase.position.set(-0.12, 0.04, 0);
  plate.add(riceBase);

  const riceTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.08), riceMat);
  riceTop.position.set(-0.12, 0.065, 0);
  plate.add(riceTop);

  const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.65 });
  const crispyMat = new THREE.MeshStandardMaterial({ color: '#c4792a', roughness: 0.5 });

  const drumstick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.055), chickenMat);
  drumstick.position.set(0.06, 0.05, -0.02);
  drumstick.rotation.z = 0.15;
  plate.add(drumstick);

  const drumCoat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), crispyMat);
  drumCoat.position.set(0.05, 0.055, -0.02);
  plate.add(drumCoat);

  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.07), chickenMat);
  thigh.position.set(0.08, 0.045, 0.06);
  plate.add(thigh);

  const lettuceMat = new THREE.MeshStandardMaterial({ color: '#228b22', roughness: 0.8 });
  const lettuce = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.06), lettuceMat);
  lettuce.position.set(-0.02, 0.025, 0.1);
  plate.add(lettuce);

  const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.6 });
  const tomato = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.04), tomatoMat);
  tomato.position.set(0.04, 0.03, 0.12);
  plate.add(tomato);

  if (isHighlighted) {
    plate.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.06, 0.42),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })
    ));
  }

  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, openAmount: number = 0): THREE.Group {
  const box = new THREE.Group();
  const boxW = 0.48, boxH = 0.34, boxD = 0.38;
  const wallThickness = 0.015;
  const flapThickness = 0.012;

  const cardboardMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0
  });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#c4a574', roughness: 0.9 });
  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const cornerMat = new THREE.MeshStandardMaterial({ color: '#8b6914', roughness: 0.8 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574', roughness: 0.6 });

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(boxW, wallThickness, boxD), cardboardMat);
  bottom.position.y = wallThickness / 2;
  box.add(bottom);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH - wallThickness, wallThickness), cardboardMat);
  frontWall.position.set(0, wallThickness + (boxH - wallThickness) / 2, boxD / 2 - wallThickness / 2);
  box.add(frontWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH - wallThickness, wallThickness), cardboardMat);
  backWall.position.set(0, wallThickness + (boxH - wallThickness) / 2, -boxD / 2 + wallThickness / 2);
  box.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH - wallThickness, boxD - wallThickness * 2), cardboardMat);
  leftWall.position.set(-boxW / 2 + wallThickness / 2, wallThickness + (boxH - wallThickness) / 2, 0);
  box.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH - wallThickness, boxD - wallThickness * 2), cardboardMat);
  rightWall.position.set(boxW / 2 - wallThickness / 2, wallThickness + (boxH - wallThickness) / 2, 0);
  box.add(rightWall);

  const innerFloor = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - wallThickness * 2, 0.005, boxD - wallThickness * 2),
    innerMat
  );
  innerFloor.position.y = wallThickness + 0.003;
  box.add(innerFloor);

  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.025, boxH - wallThickness, 0.025), cornerMat);
    corner.position.set(sx * (boxW / 2 - 0.0125), wallThickness + (boxH - wallThickness) / 2, sz * (boxD / 2 - 0.0125));
    box.add(corner);
  });

  const flapHeight = boxD / 2 - wallThickness;
  const flapWidth = boxW - wallThickness * 2;
  const topY = boxH;

  const easedOpen = openAmount < 0.5
    ? 2 * openAmount * openAmount
    : 1 - Math.pow(-2 * openAmount + 2, 2) / 2;

  const openAngle = Math.PI * 0.55;

  const frontFlapPivot = new THREE.Group();
  frontFlapPivot.position.set(0, topY, boxD / 2 - wallThickness);
  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(flapWidth, flapThickness, flapHeight), flapMat);
  frontFlap.position.set(0, 0, -flapHeight / 2);
  frontFlapPivot.add(frontFlap);
  frontFlapPivot.rotation.x = easedOpen * openAngle;
  box.add(frontFlapPivot);

  const backFlapPivot = new THREE.Group();
  backFlapPivot.position.set(0, topY, -boxD / 2 + wallThickness);
  const backFlap = new THREE.Mesh(new THREE.BoxGeometry(flapWidth, flapThickness, flapHeight), flapMat);
  backFlap.position.set(0, 0, flapHeight / 2);
  backFlapPivot.add(backFlap);
  backFlapPivot.rotation.x = -easedOpen * openAngle;
  box.add(backFlapPivot);

  const sideFlapDepth = boxW / 2 - wallThickness;
  const sideFlapWidth = boxD - wallThickness * 2 - flapHeight * 2;

  const leftFlapPivot = new THREE.Group();
  leftFlapPivot.position.set(-boxW / 2 + wallThickness, topY, 0);
  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(sideFlapDepth, flapThickness, Math.max(0.05, sideFlapWidth)), flapMat);
  leftFlap.position.set(sideFlapDepth / 2, 0, 0);
  leftFlapPivot.add(leftFlap);
  leftFlapPivot.rotation.z = -easedOpen * openAngle;
  box.add(leftFlapPivot);

  const rightFlapPivot = new THREE.Group();
  rightFlapPivot.position.set(boxW / 2 - wallThickness, topY, 0);
  const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(sideFlapDepth, flapThickness, Math.max(0.05, sideFlapWidth)), flapMat);
  rightFlap.position.set(-sideFlapDepth / 2, 0, 0);
  rightFlapPivot.add(rightFlap);
  rightFlapPivot.rotation.z = easedOpen * openAngle;
  box.add(rightFlapPivot);

  if (openAmount < 0.3) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, boxD * 0.7), tapeMat);
    tape.position.set(0, topY + 0.003, 0);
    box.add(tape);
  }

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 120;
  const labelCtx = labelCanvas.getContext('2d')!;
  labelCtx.fillStyle = '#ffffff';
  labelCtx.fillRect(0, 0, 180, 120);
  labelCtx.fillStyle = '#e74c3c';
  labelCtx.fillRect(6, 6, 168, 28);
  labelCtx.fillStyle = '#fff';
  labelCtx.font = 'bold 16px Arial';
  labelCtx.textAlign = 'center';
  labelCtx.fillText('FRAGILE', 90, 26);
  labelCtx.fillStyle = '#2c3e50';
  labelCtx.font = 'bold 28px Arial';
  labelCtx.fillText(label, 90, 68);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), new THREE.MeshBasicMaterial({ map: labelTex }));
  labelMesh.position.set(0, boxH / 2 + wallThickness, boxD / 2 + 0.001);
  box.add(labelMesh);

  if (isHighlighted && openAmount < 0.1) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.04, boxH + 0.04, boxD + 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    glow.position.y = boxH / 2;
    box.add(glow);
  }

  return box;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f8f8f0',
    roughness: 0.25,
    metalness: 0.1,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0
  });

  const tileBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.07), tileMat);
  domino.add(tileBody);

  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.45, 0.065), borderMat);
  border.position.z = -0.005;
  domino.add(border);

  const lineMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3 });
  const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.01), lineMat);
  centerLine.position.z = 0.031;
  domino.add(centerLine);

  const dotMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3 });
  const dotRadius = 0.018;
  const dotDepth = 0.015;

  const numValue = parseInt(value) || 1;
  const topNum = Math.min(Math.ceil(numValue / 2), 6);
  const bottomNum = Math.min(numValue, 6);

  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.04, 0.04], [0.04, -0.04]],
    3: [[-0.04, 0.04], [0, 0], [0.04, -0.04]],
    4: [[-0.04, 0.04], [0.04, 0.04], [-0.04, -0.04], [0.04, -0.04]],
    5: [[-0.04, 0.04], [0.04, 0.04], [0, 0], [-0.04, -0.04], [0.04, -0.04]],
    6: [[-0.04, 0.05], [0.04, 0.05], [-0.04, 0], [0.04, 0], [-0.04, -0.05], [0.04, -0.05]],
  };

  const topDots = dotPositions[topNum] || dotPositions[1];
  topDots.forEach(([dx, dy]) => {
    const dotGeo = new THREE.CylinderGeometry(dotRadius, dotRadius, dotDepth, 12);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(dx, 0.12 + dy, 0.028);
    domino.add(dot);
  });

  const bottomDots = dotPositions[bottomNum] || dotPositions[1];
  bottomDots.forEach(([dx, dy]) => {
    const dotGeo = new THREE.CylinderGeometry(dotRadius, dotRadius, dotDepth, 12);
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(dx, -0.12 + dy, 0.028);
    domino.add(dot);
  });

  if (isHighlighted) {
    domino.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.48, 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })
    ));
  }

  return domino;
}

// ==================== TICKET DISPENSER ====================

function createTicketDispenser(tickets: DataItem[], highlightIndex: number | null, animPhase: string, animProgress: number): THREE.Group {
  const dispenser = new THREE.Group();
  const groundY = 0;

  const machineMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4, metalness: 0.3 });
  const machineBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.5), machineMat);
  machineBody.position.set(0, groundY + 0.45, -0.6);
  dispenser.add(machineBody);

  const topMat = new THREE.MeshStandardMaterial({ color: '#922b21', roughness: 0.5 });
  const machineTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.55), topMat);
  machineTop.position.set(0, groundY + 0.93, -0.6);
  dispenser.add(machineTop);

  const trimMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.7, roughness: 0.3 });
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.03, 0.52), trimMat);
  topTrim.position.set(0, groundY + 0.91, -0.6);
  dispenser.add(topTrim);

  const slotFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.5 })
  );
  slotFrame.position.set(0.18, groundY + 0.35, -0.6);
  dispenser.add(slotFrame);

  const slotHole = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.04, 0.24),
    new THREE.MeshStandardMaterial({ color: '#1a1a1a' })
  );
  slotHole.position.set(0.2, groundY + 0.35, -0.6);
  dispenser.add(slotHole);

  const screenFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.22, 0.34),
    new THREE.MeshStandardMaterial({ color: '#1a1a1a' })
  );
  screenFrame.position.set(0.175, groundY + 0.62, -0.6);
  dispenser.add(screenFrame);

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 170;
  screenCanvas.height = 110;
  const sctx = screenCanvas.getContext('2d')!;
  sctx.fillStyle = '#001a00';
  sctx.fillRect(0, 0, 170, 110);
  sctx.fillStyle = '#00ff00';
  sctx.font = 'bold 16px monospace';
  sctx.textAlign = 'center';
  sctx.fillText('🎫 TICKETS 🎫', 85, 28);
  sctx.font = 'bold 36px monospace';
  sctx.fillText(`${tickets.length}`, 85, 70);
  sctx.font = '14px monospace';
  sctx.fillText('IN QUEUE', 85, 95);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0.19, groundY + 0.62, -0.6);
  screen.rotation.y = Math.PI / 2;
  dispenser.add(screen);

  const lightColors = ['#ff0000', '#00ff00', '#ffff00', '#00ffff'];
  lightColors.forEach((lc, i) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: lc }));
    light.position.set(0.18, groundY + 0.82, -0.6 + (i - 1.5) * 0.08);
    dispenser.add(light);
  });

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 220;
  signCanvas.height = 70;
  const signCtx = signCanvas.getContext('2d')!;
  signCtx.fillStyle = '#f39c12';
  signCtx.fillRect(0, 0, 220, 70);
  signCtx.strokeStyle = '#c0392b';
  signCtx.lineWidth = 5;
  signCtx.strokeRect(5, 5, 210, 60);
  signCtx.fillStyle = '#c0392b';
  signCtx.font = 'bold 28px Arial';
  signCtx.textAlign = 'center';
  signCtx.fillText('🎟️ TICKETS', 110, 48);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.14), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, groundY + 1.02, -0.35);
  dispenser.add(sign);

  const ticketWidth = 0.18;
  const ticketHeight = 0.1;
  const ticketThickness = 0.008;
  const ticketGap = 0.01;
  const totalTicketLength = ticketWidth + ticketGap;

  const ticketStartX = 0.28;
  const ticketY = groundY + 0.35;
  const ticketZ = -0.6;

  tickets.forEach((ticket, i) => {
    const isHl = highlightIndex === i;
    const isFront = i === 0;

    const ticketGroup = new THREE.Group();

    let ticketX = ticketStartX + i * totalTicketLength;
    let ticketScale = 1;
    let ticketOpacity = 1;

    if (animPhase === 'queue-dequeue-drive' && isFront) {
      const progress = animProgress || 0;
      ticketX = ticketStartX - progress * 0.3;
      ticketScale = 1 - progress * 0.8;
      ticketOpacity = 1 - progress;
    }

    if (ticketScale <= 0.01) return;

    ticketGroup.scale.setScalar(ticketScale);

    const ticketMat = new THREE.MeshStandardMaterial({
      color: ticket.color,
      roughness: 0.35,
      emissive: isHl ? '#ffff00' : '#000',
      emissiveIntensity: isHl ? 0.3 : 0,
      transparent: ticketOpacity < 1,
      opacity: ticketOpacity
    });
    const ticketBody = new THREE.Mesh(new THREE.BoxGeometry(ticketWidth, ticketThickness, ticketHeight), ticketMat);
    ticketGroup.add(ticketBody);

    if (i < tickets.length - 1) {
      const perfMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      for (let p = -3; p <= 3; p++) {
        const perf = new THREE.Mesh(new THREE.BoxGeometry(0.008, ticketThickness + 0.002, 0.005), perfMat);
        perf.position.set(ticketWidth / 2 + 0.003, 0, p * 0.012);
        ticketGroup.add(perf);
      }
    }

    const ticketCanvas = document.createElement('canvas');
    ticketCanvas.width = 90;
    ticketCanvas.height = 50;
    const tctx = ticketCanvas.getContext('2d')!;
    tctx.fillStyle = 'rgba(0,0,0,0.35)';
    tctx.fillRect(0, 0, 90, 15);
    tctx.fillStyle = '#fff';
    tctx.font = 'bold 10px Arial';
    tctx.textAlign = 'center';
    tctx.fillText('★ TICKET ★', 45, 11);
    tctx.font = 'bold 18px Arial';
    tctx.fillText(ticket.label, 45, 38);
    const ticketLabelTex = new THREE.CanvasTexture(ticketCanvas);
    const ticketLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(ticketWidth - 0.01, ticketHeight - 0.01),
      new THREE.MeshBasicMaterial({ map: ticketLabelTex, transparent: true })
    );
    ticketLabel.position.y = ticketThickness / 2 + 0.001;
    ticketLabel.rotation.x = -Math.PI / 2;
    ticketGroup.add(ticketLabel);

    if (isHl) {
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(ticketWidth + 0.015, ticketThickness + 0.01, ticketHeight + 0.015),
        new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.22 })
      );
      ticketGroup.add(glow);
    }

    ticketGroup.position.set(ticketX, ticketY, ticketZ);
    dispenser.add(ticketGroup);
  });

  if (tickets.length > 0) {
    const frontSprite = createTextSprite('FRONT', '#00ff00', 16);
    frontSprite.position.set(ticketStartX, groundY + 0.2, ticketZ);
    frontSprite.scale.set(0.22, 0.08, 1);
    dispenser.add(frontSprite);

    const rearSprite = createTextSprite('REAR', '#ff6600', 16);
    rearSprite.position.set(ticketStartX + (tickets.length - 1) * totalTicketLength, groundY + 0.2, ticketZ);
    rearSprite.scale.set(0.22, 0.08, 1);
    dispenser.add(rearSprite);
  }

  const counterWidth = Math.max(1.2, tickets.length * totalTicketLength + 0.6);
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(counterWidth, 0.04, 0.7),
    new THREE.MeshStandardMaterial({ color: '#34495e', metalness: 0.3 })
  );
  counter.position.set(counterWidth / 2 - 0.3, groundY - 0.02, -0.6);
  dispenser.add(counter);

  const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
  const railLength = Math.max(0.5, tickets.length * totalTicketLength + 0.2);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.015, 0.015), railMat);
  topRail.position.set(ticketStartX + railLength / 2 - 0.1, ticketY + 0.02, ticketZ - ticketHeight / 2 - 0.015);
  dispenser.add(topRail);

  const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.015, 0.015), railMat);
  bottomRail.position.set(ticketStartX + railLength / 2 - 0.1, ticketY + 0.02, ticketZ + ticketHeight / 2 + 0.015);
  dispenser.add(bottomRail);

  return dispenser;
}

// ==================== SCHOOL BUILDING ====================

function createSchoolBuilding(): THREE.Group {
  const school = new THREE.Group();
  const groundY = 0;

  const brickMat = new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.8 });
  const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.6), brickMat);
  mainBuilding.position.set(-0.5, groundY + 0.6, 0);
  school.add(mainBuilding);

  const entranceMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 });
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.5), entranceMat);
  entrance.position.set(-0.12, groundY + 0.35, 0);
  school.add(entrance);

  const archMat = new THREE.MeshStandardMaterial({ color: '#daa520', roughness: 0.5 });
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.55), archMat);
  archTop.position.set(-0.12, groundY + 0.72, 0);
  school.add(archTop);

  const doorMat = new THREE.MeshStandardMaterial({ color: '#4a2c2a', roughness: 0.6 });
  [-0.12, 0.12].forEach(offsetZ => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.18), doorMat);
    door.position.set(0.02, groundY + 0.275, offsetZ);
    school.add(door);

    const handleMat = new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: 0.8 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.015), handleMat);
    handle.position.set(0.03, groundY + 0.28, offsetZ + (offsetZ > 0 ? -0.05 : 0.05));
    school.add(handle);
  });

  const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4, roughness: 0.1 });
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.5 });

  [-0.55, -0.35, 0.35, 0.55].forEach(wz => {
    [0.35, 0.65, 0.95].forEach(wy => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.14), windowFrameMat);
      frame.position.set(-0.18, groundY + wy, wz);
      school.add(frame);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.15, 0.11), windowMat);
      glass.position.set(-0.17, groundY + wy, wz);
      school.add(glass);
    });
  });

  const roofMat = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.6 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.7), roofMat);
  roof.position.set(-0.5, groundY + 1.24, 0);
  school.add(roof);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.3), brickMat);
  tower.position.set(-0.5, groundY + 1.38, 0);
  school.add(tower);

  const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.35), roofMat);
  towerRoof.position.set(-0.5, groundY + 1.58, 0);
  school.add(towerRoof);

  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 64;
  clockCanvas.height = 64;
  const cctx = clockCanvas.getContext('2d')!;
  cctx.fillStyle = '#f5f5f5';
  cctx.beginPath();
  cctx.arc(32, 32, 28, 0, Math.PI * 2);
  cctx.fill();
  cctx.strokeStyle = '#333';
  cctx.lineWidth = 2;
  cctx.stroke();
  cctx.fillStyle = '#333';
  cctx.font = 'bold 8px Arial';
  cctx.textAlign = 'center';
  cctx.fillText('12', 32, 12);
  cctx.fillText('3', 54, 35);
  cctx.fillText('6', 32, 58);
  cctx.fillText('9', 10, 35);
  cctx.strokeStyle = '#333';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.moveTo(32, 32);
  cctx.lineTo(32, 14);
  cctx.stroke();
  cctx.lineWidth = 1.5;
  cctx.beginPath();
  cctx.moveTo(32, 32);
  cctx.lineTo(46, 28);
  cctx.stroke();

  const clockTex = new THREE.CanvasTexture(clockCanvas);
  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: clockTex }));
  clockFace.position.set(-0.34, groundY + 1.42, 0);
  clockFace.rotation.y = Math.PI / 2;
  school.add(clockFace);

  const stepMat = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.7 });
  [0.22, 0.12, 0.02].forEach((x, i) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.6), stepMat);
    step.position.set(x, groundY + 0.025 + i * 0.05, 0);
    school.add(step);
  });

  const railMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
  [-0.28, 0.28].forEach(z => {
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.03), railMat);
    post1.position.set(0.22, groundY + 0.15, z);
    school.add(post1);

    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.03), railMat);
    post2.position.set(0.02, groundY + 0.3, z);
    school.add(post2);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.025), railMat);
    rail.position.set(0.12, groundY + 0.32, z);
    rail.rotation.z = -0.25;
    school.add(rail);
  });

  const pillarMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 });
  [-0.28, 0.28].forEach(z => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), pillarMat);
    pillar.position.set(0.02, groundY + 0.425, z);
    school.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.1), pillarMat);
    cap.position.set(0.02, groundY + 0.715, z);
    school.add(cap);
  });

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 80;
  signCanvas.height = 280;
  const schCtx = signCanvas.getContext('2d')!;
  schCtx.fillStyle = '#1a5276';
  schCtx.fillRect(0, 0, 80, 280);
  schCtx.strokeStyle = '#ffd700';
  schCtx.lineWidth = 4;
  schCtx.strokeRect(4, 4, 72, 272);
  schCtx.save();
  schCtx.translate(40, 140);
  schCtx.rotate(-Math.PI / 2);
  schCtx.fillStyle = '#fff';
  schCtx.font = 'bold 22px serif';
  schCtx.textAlign = 'center';
  schCtx.fillText('DS ACADEMY', 0, 8);
  schCtx.restore();
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.7), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(-0.08, groundY + 0.85, 0.55);
  signMesh.rotation.y = Math.PI / 2;
  school.add(signMesh);

  const poleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
  const flagpole = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.02), poleMat);
  flagpole.position.set(0.35, groundY + 0.4, 0.5);
  school.add(flagpole);

  const flagMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.15, 0.25), flagMat);
  flag.position.set(0.35, groundY + 0.7, 0.38);
  school.add(flag);

  const grassMat = new THREE.MeshStandardMaterial({ color: '#228b22', roughness: 0.9 });
  [[-0.6, 0.55], [-0.6, -0.55], [0.25, 0.6], [0.25, -0.6]].forEach(([x, z]) => {
    const grass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.25), grassMat);
    grass.position.set(x, groundY + 0.01, z);
    school.add(grass);
  });

  const flowerMat = new THREE.MeshStandardMaterial({ color: '#ff69b4' });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2ecc71' });
  [[0.25, 0.55], [0.25, -0.55]].forEach(([x, z]) => {
    for (let i = 0; i < 3; i++) {
      const flower = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), flowerMat);
      flower.position.set(x + (i - 1) * 0.06, groundY + 0.05, z);
      school.add(flower);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), leafMat);
      leaf.position.set(x + (i - 1) * 0.06, groundY + 0.025, z);
      school.add(leaf);
    }
  });

  return school;
}

// ==================== ANIMATION HELPER ====================

function applyItemAnimation(
  obj: THREE.Object3D,
  itemIndex: number,
  animPhase: string,
  animData: Record<string, any>,
  structure: DataStructure,
  animProgress: number = 1
): void {
  if (!animPhase) return;

  const isTarget = animData.index === itemIndex;
  const isTarget1 = animData.index1 === itemIndex;
  const isTarget2 = animData.index2 === itemIndex;
  const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const p = ease(animProgress);

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) {
      obj.position.y += 0.4 * p;
      obj.rotation.z = 0.15 * p;
    } else if (animPhase === 'access-bounce' && isTarget) {
      obj.position.y += 0.28 * p;
      obj.scale.setScalar(1 + 0.2 * p);
      obj.rotation.z = -0.1 * p;
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.08 * (1 - p);
    } else if (animPhase === 'insert-appear' && isTarget) {
      obj.position.y += 0.5 * (1 - p);
      obj.scale.setScalar(0.3 + 0.7 * p);
      obj.rotation.y = Math.PI * 2 * (1 - p);
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.7 * (1 - p);
      obj.scale.setScalar(0.5 + 0.5 * p);
      obj.rotation.z = 0.3 * (1 - p);
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.15 * (1 - p);
      obj.scale.setScalar(1 + 0.1 * (1 - p));
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.45 * p;
      obj.rotation.z = 0.4 * p;
      obj.scale.setScalar(1 + 0.2 * p);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.8 * p;
      obj.scale.setScalar(Math.max(0.01, 1 - p));
      obj.rotation.z = 3.0 * p;
    } else if (animPhase === 'delete-close' && animData.deleteIndex !== undefined && itemIndex >= animData.deleteIndex) {
      obj.position.y += 0.06 * (1 - p);
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45 * p;
      obj.rotation.z = (isTarget1 ? 0.15 : -0.15) * p;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.5;
      obj.rotation.z = (isTarget1 ? -0.2 : 0.2) * p;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.12 * (1 - p);
      obj.scale.setScalar(1 + 0.12 * (1 - p));
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.5 * (1 - p);
      obj.scale.setScalar(0.6 + 0.4 * p);
      obj.rotation.z = 0.2 * (1 - p);
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1 * (1 - p);
      obj.scale.setScalar(1 + 0.05 * (1 - p));
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.5 * (1 - p);
      obj.scale.setScalar(0.6 + 0.4 * p);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1 * (1 - p);
      obj.scale.setScalar(1 + 0.05 * (1 - p));
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.5 * p;
      obj.rotation.z = 0.3 * p;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.8 * p;
      obj.scale.setScalar(Math.max(0.01, 1 - p));
      obj.rotation.z = 2.5 * p;
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.2 * p;
      obj.scale.setScalar(1 + 0.15 * p);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.6 * (1 - p);
      obj.scale.setScalar(0.7 + 0.3 * p);
      obj.rotation.z = 0.2 * (1 - p);
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.1 * (1 - p);
      obj.scale.setScalar(1 + 0.08 * (1 - p));
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.4 * p;
      obj.rotation.z = -0.3 * p;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.9 * p;
      obj.scale.setScalar(Math.max(0.01, 1 - p));
      obj.rotation.z = 3.0 * p;
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.15 * p;
      obj.rotation.z = 0.05 * p;
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.08 * (1 - p);
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 1.2 * (1 - p);
      obj.scale.setScalar(0.6 + 0.4 * p);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.2 * (1 - p);
      obj.scale.setScalar(1 + 0.05 * (1 - p));
    } else if (animPhase === 'queue-dequeue-drive' && isTarget) {
      obj.position.x -= 2.5 * p;
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.2 * p;
      obj.scale.setScalar(1 + 0.15 * p);
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
  animData?: Record<string, any>,
  animProgress?: number,
  tutorialText?: { title: string; description: string; step: string } | null
): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if ((child as any).geometry) (child as any).geometry.dispose();
    if ((child as any).material) {
      if (Array.isArray((child as any).material)) {
        (child as any).material.forEach((m: any) => m.dispose());
      } else {
        (child as any).material.dispose();
      }
    }
  }

  const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 1.0 : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;
  const groundY = 0;

  // Add 3D Tutorial Text Box if provided
  if (tutorialText) {
    const textBox = create3DTextBox(
      tutorialText.title,
      tutorialText.description,
      tutorialText.step,
      new THREE.Vector3(0, structure === 'stack' ? 1.8 : 1.2, 0)
    );
    group.add(textBox);
  }

  // ==================== ARRAY ====================
  if (structure === 'array') {
    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.8;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const cerealLabels = ['Coco Crunch', 'Corn Flakes', 'Froot Loops', 'Cheerios', 'Frosted'];
        const product = createGroceryBox(item.color, cerealLabels[i % cerealLabels.length] || item.label, isHl);
        product.position.set(startX + i * spacing, groundY + 0.08, 0);
        if (isHl) product.position.y += 0.08;
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(product);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, groundY - 0.12, 0);
        idx.scale.set(0.28, 0.14, 1);
        group.add(idx);
      });

      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.025, 0.32), shelfMat);
      mainShelf.position.y = groundY + 0.06;
      group.add(mainShelf);

      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.035, 0.012), shelfMat);
      lip.position.set(0, groundY + 0.075, 0.16);
      group.add(lip);

      const poleMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 });
      [-shelfWidth / 2 + 0.05, shelfWidth / 2 - 0.05].forEach(x => {
        [0.14, -0.12].forEach(z => {
          const pole = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), poleMat);
          pole.position.set(x, groundY - 0.05, z);
          group.add(pole);
        });
      });

      const backPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.75),
        new THREE.MeshStandardMaterial({ color: '#f0f0f0', side: THREE.DoubleSide, roughness: 0.9 })
      );
      backPanel.position.set(0, groundY, -0.14);
      group.add(backPanel);

    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.2;
      const floorY = groundY - 0.25;
      const scale = 0.75;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const posX = startX + i * spacing;

        const chair = createChair(0);
        chair.position.set(posX * scale, floorY + 0.25, -0.05 * scale);
        chair.scale.setScalar(scale);
        group.add(chair);

        const desk = createDesk(0);
        desk.position.set(posX * scale, floorY + 0.28, 0.22 * scale);
        desk.scale.setScalar(scale);
        group.add(desk);

        const appearance = item.appearance || {
          skinTone: '#f5c6a0',
          shirtColor: item.color,
          pantsColor: '#2c3e50',
          hairColor: '#3d2314',
          hairStyle: 'short' as const,
          gender: 'male' as const
        };

        const human = createHuman3D(appearance, item.label, isHl, true, 0);
        human.position.set(posX * scale, floorY + 0.25, -0.05 * scale);
        human.scale.setScalar(scale);
        applyItemAnimation(human, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(human);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 20);
        idx.position.set(posX * scale, floorY - 0.06, 0);
        idx.scale.set(0.22, 0.11, 1);
        group.add(idx);
      });

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.4),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = floorY;
      group.add(floor);

      const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 0.9),
        new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 })
      );
      backWall.position.set(0, floorY + 0.45, -0.4);
      group.add(backWall);

      const board = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth * 0.6, 0.4, 0.02),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
      );
      board.position.set(0, floorY + 0.55, -0.38);
      group.add(board);

    } else if (environment === 'todo') {
      // ToDo List - Show as clipboard with individual task items that can be manipulated
      const clipboard = createClipboard('Tasks', '#e74c3c', false, data);
      clipboard.position.set(-0.8, 0, 0);
      clipboard.scale.setScalar(0.9);
      group.add(clipboard);

      // Also show tasks as individual items for manipulation
      const taskStartX = 0.3;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        
        // Create task card
        const taskGroup = new THREE.Group();
        
        const cardMat = new THREE.MeshStandardMaterial({
          color: item.color,
          roughness: 0.4,
          emissive: isHl ? '#ffff00' : '#000',
          emissiveIntensity: isHl ? 0.3 : 0,
        });
        
        const card = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.02), cardMat);
        taskGroup.add(card);
        
        // Task label
        const taskCanvas = document.createElement('canvas');
        taskCanvas.width = 140;
        taskCanvas.height = 72;
        const tctx = taskCanvas.getContext('2d')!;
        tctx.fillStyle = 'rgba(255,255,255,0.95)';
        tctx.fillRect(0, 0, 140, 72);
        tctx.fillStyle = '#333';
        tctx.font = 'bold 20px Arial';
        tctx.textAlign = 'center';
        tctx.fillText(item.label, 70, 32);
        tctx.font = '14px Arial';
        tctx.fillStyle = '#666';
        tctx.fillText(`Task ${i + 1}`, 70, 55);
        
        const taskTex = new THREE.CanvasTexture(taskCanvas);
        const taskLabel = new THREE.Mesh(
          new THREE.PlaneGeometry(0.33, 0.16),
          new THREE.MeshBasicMaterial({ map: taskTex, transparent: true })
        );
        taskLabel.position.z = 0.011;
        taskGroup.add(taskLabel);
        
        if (isHl) {
          const glow = new THREE.Mesh(
            new THREE.BoxGeometry(0.39, 0.22, 0.025),
            new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })
          );
          taskGroup.add(glow);
        }
        
        taskGroup.position.set(taskStartX + (i % 2) * 0.45, 0.15 - Math.floor(i / 2) * 0.25, 0);
        applyItemAnimation(taskGroup, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(taskGroup);
        
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 18);
        idx.position.set(taskStartX + (i % 2) * 0.45, 0.28 - Math.floor(i / 2) * 0.25, 0);
        idx.scale.set(0.2, 0.1, 1);
        group.add(idx);
      });

      // Array representation text
      const arrayStr = `array = [${data.map(d => `"${d.label}"`).join(', ')}]`;
      const arrayLabel = createTextSprite(arrayStr.length > 35 ? arrayStr.substring(0, 32) + '...' : arrayStr, '#00ff00', 12);
      arrayLabel.position.set(0, -0.45, 0);
      arrayLabel.scale.set(0.9, 0.1, 1);
      group.add(arrayLabel);
    }

  // ==================== LINKED LIST ====================
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      const arrowY = 0.14;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const reversedIndex = data.length - 1 - i;
        const posX = startX + reversedIndex * spacing;

        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(posX, isHl ? 0.1 : 0, 0);
        trainCar.scale.setScalar(0.82);
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
        group.add(trainCar);
      });

      for (let i = 0; i < data.length - 1; i++) {
        const arrow = create3DArrow(startX + i * spacing, startX + (i + 1) * spacing, arrowY, false);
        group.add(arrow);
      }

      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + (data.length - 1) * spacing + spacing * 0.7, 0.14, 0);
      nullSprite.scale.set(0.32, 0.22, 1);
      group.add(nullSprite);

      if (data.length > 0) {
        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + (data.length - 1) * spacing + spacing * 0.7, arrowY, false);
        group.add(lastArrow);
      }

      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
      [-0.11, 0.11].forEach(z => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 1.8, 0.018, 0.025), railMat);
        rail.position.set(0, -0.1, z);
        group.add(rail);
      });

      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      for (let x = startX - 0.5; x <= startX + data.length * spacing + 1.0; x += 0.15) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.32), tieMat);
        tie.position.set(x, -0.11, 0);
        group.add(tie);
      }

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.2, 0.9),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.12;
      group.add(ground);

    } else if (environment === 'people') {
      const arrowY = 0.12;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const walkPhase = (animPhase === 'll-traverse' && isHl) ? Math.PI * 0.5 : 0;
          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.72);
          human.rotation.y = 0;
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
          group.add(human);
        }

        if (i < data.length - 1) {
          const arrow = create3DArrow(startX + i * spacing, startX + (i + 1) * spacing, arrowY, false);
          group.add(arrow);
        }
      });

      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0.12, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      if (data.length > 0) {
        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing, arrowY, false);
        group.add(lastArrow);
      }

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2, 0.55),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.16;
      group.add(floor);

    } else if (environment === 'domino') {
      const arrowY = 0;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        domino.scale.setScalar(0.82);
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
        group.add(domino);

        if (i < data.length - 1) {
          const arrow = create3DArrow(startX + i * spacing, startX + (i + 1) * spacing, arrowY, false);
          group.add(arrow);
        }
      });

      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      if (data.length > 0) {
        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing, arrowY, false);
        group.add(lastArrow);
      }

      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 1.2, 0.035, 0.55),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.28;
      group.add(table);
    }

  // ==================== STACK ====================
  } else if (structure === 'stack') {
    if (environment === 'books') {
      const stackSpacing = 0.11;
      const baseY = -data.length * stackSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const isPeeking = isTop && (animPhase === 'stack-peek-open');
        const openAmount = isPeeking ? (animProgress || 0) : 0;

        const book = createBook(item.label, item.color, isHl, isPeeking, openAmount);
        book.position.set(isHl && !isPeeking ? 0.18 : 0, baseY + i * stackSpacing, 0);
        book.rotation.y = (i % 2 === 0) ? 0 : 0.04;
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(book);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.65, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.38, 0.14, 1);
          group.add(topSprite);
        }
      });

      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.035, 0.65),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = baseY - 0.08;
      group.add(desk);

    } else if (environment === 'plates') {
      const plateSpacing = 0.05;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plateItem = createPlate(item.label, isHl);
        plateItem.position.set(isHl ? 0.12 : 0, plateBaseY + i * plateSpacing, 0);
        plateItem.scale.setScalar(0.55);
        applyItemAnimation(plateItem, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(plateItem);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.45, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.32, 0.11, 1);
          group.add(topSprite);
        }
      });

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.055, 0.5),
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.05;
      group.add(counter);

    } else if (environment === 'boxes') {
      const boxSpacing = 0.36;
      const boxBaseY = 0;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;

        let openAmount = 0;
        if (isTop) {
          if (animPhase === 'stack-peek-lift') {
            openAmount = 0;
          } else if (animPhase === 'stack-peek-open') {
            openAmount = animProgress || 0;
          } else if (animPhase === 'stack-peek-settle') {
            openAmount = 1 - (animProgress || 0);
          }
        }

        const cardboardBox = createCardboardBox(item.label, item.color, isHl, openAmount);
        cardboardBox.position.set(0, boxBaseY + i * boxSpacing, 0);
        cardboardBox.rotation.y = (i % 2 === 0) ? 0 : 0.03;
        cardboardBox.scale.setScalar(0.78);
        applyItemAnimation(cardboardBox, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(cardboardBox);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.55, boxBaseY + i * boxSpacing + 0.15, 0);
          topSprite.scale.set(0.32, 0.11, 1);
          group.add(topSprite);
        }
      });

      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.055, 0.6),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.03;
      group.add(pallet);
    }

  // ==================== QUEUE ====================
  } else if (structure === 'queue') {
    if (environment === 'tollgate') {
      let gateOpenAmount = 0;
      if (animPhase === 'queue-dequeue-gate-open') {
        gateOpenAmount = animProgress || 0;
      } else if (animPhase === 'queue-dequeue-drive') {
        gateOpenAmount = 1;
      } else if (animPhase === 'queue-dequeue-gate-close') {
        gateOpenAmount = 1 - (animProgress || 0);
      }

      const tollBooth = createTollBooth(gateOpenAmount);
      tollBooth.position.set(startX - 0.3, groundY, 0);
      tollBooth.scale.setScalar(0.85);
      group.add(tollBooth);

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const carObj = createCar(item.color, item.label, isHl);
        carObj.position.set(startX + i * spacing + 0.5, groundY + (isHl ? 0.06 : 0), 0);
        carObj.scale.setScalar(0.78);
        applyItemAnimation(carObj, i, animPhase || '', animData || {}, 'queue', animProgress);
        group.add(carObj);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX + 0.5, groundY - 0.22, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing + 0.5, groundY - 0.22, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 3.0, 0.7),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = groundY - 0.01;
      group.add(road);

      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 1.0; x <= startX + data.length * spacing + 0.8; x += 0.22) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.022), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, groundY, 0);
        group.add(dash);
      }

      const exitSprite = createTextSprite('← EXIT', '#00ff00', 20);
      exitSprite.position.set(startX - 1.2, groundY + 0.28, 0);
      exitSprite.scale.set(0.32, 0.1, 1);
      group.add(exitSprite);

    } else if (environment === 'tickets') {
      const ticketDispenserGroup = createTicketDispenser(data, highlightIndex, animPhase || '', animProgress || 0);
      group.add(ticketDispenserGroup);

    } else if (environment === 'students') {
      const schoolBuilding = createSchoolBuilding();
      schoolBuilding.position.set(startX - 0.5, groundY, 0);
      schoolBuilding.scale.setScalar(0.5);
      group.add(schoolBuilding);

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isFront = i === 0;

        if (item.appearance) {
          let walkPhase = 0;
          let extraX = 0;
          let studentScale = 0.55;
          let shouldRender = true;

          if (isFront) {
            if (animPhase === 'queue-dequeue-walk') {
              const progress = animProgress || 0;
              walkPhase = progress * Math.PI * 10;
              extraX = -progress * 1.2;
            } else if (animPhase === 'queue-dequeue-enter') {
              const progress = animProgress || 0;
              walkPhase = Math.PI * 10 + progress * Math.PI * 4;
              extraX = -1.2 - progress * 0.4;
              studentScale = 0.55 * Math.max(0.01, 1 - progress * 0.95);
              if (progress > 0.95) shouldRender = false;
            }
          }

          if (shouldRender) {
            const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
            human.position.set(startX + i * spacing + 0.6 + extraX, groundY, 0);
            human.scale.setScalar(studentScale);
            human.rotation.y = -Math.PI / 2;

            if (!(isFront && (animPhase === 'queue-dequeue-walk' || animPhase === 'queue-dequeue-enter'))) {
              applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue', animProgress);
            }

            group.add(human);
          }
        }
      });

      if (data.length > 0) {
        const frontSprite = createTextSprite('FRONT', '#00ff00', 16);
        frontSprite.position.set(startX + 0.6, groundY - 0.18, 0);
        frontSprite.scale.set(0.26, 0.09, 1);
        group.add(frontSprite);

        const rearSprite = createTextSprite('REAR', '#ff6600', 16);
        rearSprite.position.set(startX + (data.length - 1) * spacing + 0.6, groundY - 0.18, 0);
        rearSprite.scale.set(0.26, 0.09, 1);
        group.add(rearSprite);
      }

      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.5),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.set(0.3, groundY - 0.01, 0);
      group.add(pathway);

      const grassMat = new THREE.MeshStandardMaterial({ color: '#228b22', side: THREE.DoubleSide });
      [-0.35, 0.35].forEach(z => {
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.3), grassMat);
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(0.3, groundY - 0.015, z);
        group.add(grass);
      });
    }
  }
}

// ==================== HOME COMPONENT ====================

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [animPhase, setAnimPhase] = useState('');
  const [animData, setAnimData] = useState<Record<string, any>>({});
  const [animProgress, setAnimProgress] = useState(1);

  // ==================== STEP-BY-STEP TUTORIAL STATE ====================
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState<TutorialStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepAnimating, setStepAnimating] = useState(false);
  const [tutorialText, setTutorialText] = useState<{ title: string; description: string; step: string } | null>(null);

  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [swapFirstIndex, setSwapFirstIndex] = useState<number | null>(null);
  const [pendingOperation, setPendingOperation] = useState<string>('');

  const [appMode, setAppMode] = useState<AppMode>('person');
  const [surfacePosition, setSurfacePosition] = useState<Position | null>(null);
  const [surfacePlaced, setSurfacePlaced] = useState(false);
  const [isDraggingSurface, setIsDraggingSurface] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [webxrSupported, setWebxrSupported] = useState(false);
  const [webxrActive, setWebxrActive] = useState(false);
  const [webxrPlaced, setWebxrPlaced] = useState(false);
  const xrSessionRef = useRef<any>(null);
  const xrRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const xrSceneRef = useRef<THREE.Scene | null>(null);
  const xrCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const xrGroupRef = useRef<THREE.Group | null>(null);
  const xrReticleRef = useRef<THREE.Mesh | null>(null);
  const xrHitTestSourceRef = useRef<any>(null);
  const xrContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Data states
  const [groceryItems, setGroceryItems] = useState<DataItem[]>([
    { id: 1, label: 'Coco Crunch', color: '#8B4513' },
    { id: 2, label: 'Corn Flakes', color: '#f39c12' },
    { id: 3, label: 'Froot Loops', color: '#e74c3c' },
    { id: 4, label: 'Cheerios', color: '#f1c40f' },
    { id: 5, label: 'Frosted', color: '#3498db' },
  ]);

  const [students, setStudents] = useState<DataItem[]>([
    { id: 1, label: 'Alex', color: '#3498db', appearance: { skinTone: '#f5c6a0', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Beth', color: '#e91e63', appearance: { skinTone: '#f5c6a0', shirtColor: '#e91e63', pantsColor: '#1a1a2e', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Carl', color: '#27ae60', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
    { id: 4, label: 'Dana', color: '#f39c12', appearance: { skinTone: '#c68642', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#3d2314', hairStyle: 'long', gender: 'female' } },
  ]);

  const [tasks, setTasks] = useState<DataItem[]>([
    { id: 1, label: 'Study', color: '#e74c3c' },
    { id: 2, label: 'Code', color: '#3498db' },
    { id: 3, label: 'Read', color: '#f39c12' },
    { id: 4, label: 'Rest', color: '#2ecc71' },
  ]);

  const [trainCars, setTrainCars] = useState<DataItem[]>([
    { id: 1, label: 'Engine', color: '#e74c3c' },
    { id: 2, label: 'Coal', color: '#34495e' },
    { id: 3, label: 'Cargo', color: '#2ecc71' },
    { id: 4, label: 'Pass', color: '#9b59b6' },
  ]);

  const [peopleLine, setPeopleLine] = useState<DataItem[]>([
    { id: 1, label: 'Alice', color: '#e74c3c', appearance: { skinTone: '#f5c6a0', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 2, label: 'Bob', color: '#3498db', appearance: { skinTone: '#8d5524', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
    { id: 3, label: 'Carol', color: '#2ecc71', appearance: { skinTone: '#c68642', shirtColor: '#2ecc71', pantsColor: '#1a1a2e', hairColor: '#3d2314', hairStyle: 'long', gender: 'female' } },
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
    { id: 3, label: 'Box C', color: '#c0392b' },
  ]);

  const [tollGate, setTollGate] = useState<DataItem[]>([
    { id: 1, label: 'ABC-123', color: '#e74c3c' },
    { id: 2, label: 'XYZ-789', color: '#3498db' },
    { id: 3, label: 'QWE-456', color: '#27ae60' },
  ]);

  const [ticketQueue, setTicketQueue] = useState<DataItem[]>([
    { id: 1, label: 'T-001', color: '#f39c12' },
    { id: 2, label: 'T-002', color: '#e74c3c' },
    { id: 3, label: 'T-003', color: '#9b59b6' },
  ]);

  const [studentQueue, setStudentQueue] = useState<DataItem[]>([
    { id: 1, label: 'Stu 1', color: '#3498db', appearance: { skinTone: '#f5c6a0', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Stu 2', color: '#2ecc71', appearance: { skinTone: '#c68642', shirtColor: '#2ecc71', pantsColor: '#1a1a2e', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Stu 3', color: '#9b59b6', appearance: { skinTone: '#8d5524', shirtColor: '#9b59b6', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
  ]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const smoothAnimate = (duration: number, phase: string, data: Record<string, any>) => {
    return new Promise<void>(resolve => {
      const startTime = Date.now();
      setAnimPhase(phase);
      setAnimData(data);
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setAnimProgress(progress);
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    });
  };

  const getArrayData = () => arrayEnv === 'grocery' ? groceryItems : arrayEnv === 'classroom' ? students : tasks;
  const setArrayData = arrayEnv === 'grocery' ? setGroceryItems : arrayEnv === 'classroom' ? setStudents : setTasks;
  const getLinkedListData = () => linkedListEnv === 'train' ? trainCars : linkedListEnv === 'people' ? peopleLine : dominoNodes;
  const setLinkedListData = linkedListEnv === 'train' ? setTrainCars : linkedListEnv === 'people' ? setPeopleLine : setDominoNodes;
  const getStackData = () => stackEnv === 'books' ? bookStack : stackEnv === 'plates' ? plateStack : boxStack;
  const setStackData = stackEnv === 'books' ? setBookStack : stackEnv === 'plates' ? setPlateStack : setBoxStack;
  const getQueueData = () => queueEnv === 'tollgate' ? tollGate : queueEnv === 'tickets' ? ticketQueue : studentQueue;
  const setQueueData = queueEnv === 'tollgate' ? setTollGate : queueEnv === 'tickets' ? setTicketQueue : setStudentQueue;
  const getCurrentData = () => currentStructure === 'array' ? getArrayData() : currentStructure === 'linkedlist' ? getLinkedListData() : currentStructure === 'stack' ? getStackData() : getQueueData();
  const currentEnvId = currentStructure === 'array' ? arrayEnv : currentStructure === 'linkedlist' ? linkedListEnv : currentStructure === 'stack' ? stackEnv : queueEnv;
  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv : currentStructure === 'linkedlist' ? setLinkedListEnv : currentStructure === 'stack' ? setStackEnv : setQueueEnv;
  const currentData = getCurrentData();

  const zoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.25, 3)), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.3)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  // Helper to generate new items based on environment
  const generateNewItem = (): DataItem => {
    if (arrayEnv === 'classroom') {
      const names = ['Emma', 'Liam', 'Mia', 'Noah', 'Ava', 'Jack', 'Zoe', 'Leo'];
      const skinTones = ['#f5c6a0', '#c68642', '#8d5524'];
      const hairColors = ['#1a1a1a', '#3d2314', '#2c1810', '#d4a574'];
      const shirtColors = ['#1abc9c', '#9b59b6', '#e74c3c', '#3498db', '#f39c12', '#2ecc71'];
      const genders: ('male' | 'female')[] = ['male', 'female'];
      const gender = genders[Math.floor(Math.random() * genders.length)];
      return {
        id: Date.now(),
        label: names[Math.floor(Math.random() * names.length)],
        color: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        appearance: {
          skinTone: skinTones[Math.floor(Math.random() * skinTones.length)],
          shirtColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
          pantsColor: '#2c3e50',
          hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
          hairStyle: gender === 'female' ? 'long' : (['short', 'short', 'bald'] as const)[Math.floor(Math.random() * 3)],
          gender: gender
        }
      };
    } else if (arrayEnv === 'todo') {
      const taskNames = ['Meeting', 'Email', 'Report', 'Call', 'Review', 'Plan', 'Debug', 'Test'];
      const taskColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
      return {
        id: Date.now(),
        label: taskNames[Math.floor(Math.random() * taskNames.length)],
        color: taskColors[Math.floor(Math.random() * taskColors.length)]
      };
    } else {
      const cerealNames = ['Granola', 'Muesli', 'Bran', 'Oats', 'Wheat'];
      const cerealColors = ['#8B4513', '#D2691E', '#CD853F', '#DEB887', '#F4A460'];
      return {
        id: Date.now(),
        label: cerealNames[Math.floor(Math.random() * cerealNames.length)],
        color: cerealColors[Math.floor(Math.random() * cerealColors.length)]
      };
    }
  };

  // ==================== STEP-BY-STEP TUTORIAL FUNCTIONS ====================

  const runTutorialStep = async (step: TutorialStep) => {
    setStepAnimating(true);
    setTutorialText({ title: step.title, description: step.description, step: `Step ${currentStepIndex + 1}` });
    
    if (step.highlightIndex !== undefined) {
      setHighlightIndex(step.highlightIndex);
    }
    if (step.highlightIndex2 !== undefined) {
      setHighlightIndex2(step.highlightIndex2);
    }
    
    if (step.animPhase && step.animDuration) {
      await smoothAnimate(step.animDuration, step.animPhase, { index: step.highlightIndex, index1: step.highlightIndex, index2: step.highlightIndex2 });
    }
    
    if (step.action) {
      step.action();
    }
    
    setStepAnimating(false);
  };

  const nextStep = async () => {
    if (stepAnimating) return;
    
    if (currentStepIndex < tutorialSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      await runTutorialStep(tutorialSteps[nextIdx]);
    } else {
      endTutorial();
    }
  };

  const endTutorial = () => {
    setTutorialActive(false);
    setTutorialSteps([]);
    setCurrentStepIndex(0);
    setTutorialText(null);
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setAnimPhase('');
    setAnimData({});
    setIsAnimating(false);
  };

  const startTutorial = (steps: TutorialStep[]) => {
    if (isAnimating || tutorialActive) return;
    setIsAnimating(true);
    setTutorialActive(true);
    setTutorialSteps(steps);
    setCurrentStepIndex(0);
    runTutorialStep(steps[0]);
  };

  // ==================== APPEND VS INSERT TUTORIAL ====================
  // This replaces the old "Access" operation and teaches the difference

  const appendVsInsertTutorial = () => {
    if (isAnimating || tutorialActive || getArrayData().length >= 6) return;
    
    const data = getArrayData();
    const newItem = generateNewItem();
    const insertIndex = Math.floor(data.length / 2); // Insert in middle to show shifting
    
    const steps: TutorialStep[] = [
      {
        title: "📚 Append vs Insert",
        description: "Let's compare two ways to add elements:\n\n• APPEND: Add to END (fast!)\n• INSERT: Add at specific INDEX (slower)\n\nWatch the difference!",
      },
      {
        title: "⚡ APPEND - Step 1",
        description: `Current array has ${data.length} elements.\nAppend adds to index [${data.length}] - the END.\n\nNo other elements need to move!`,
        highlightIndex: data.length,
      },
      {
        title: "⚡ APPEND - Step 2",
        description: `Simply place the new element:\narray[${data.length}] = "${newItem.label}"\nlength++\n\nTime Complexity: O(1) - Constant!`,
        highlightIndex: data.length,
        animPhase: 'insert-drop',
        animDuration: 600,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => [...prev, newItem]);
        },
      },
      {
        title: "✅ Appended!",
        description: `"${newItem.label}" added at end!\n\nAPPEND = O(1)\n• No shifting required\n• Direct placement at array[length]\n• Fast and efficient!`,
        highlightIndex: data.length,
        animPhase: 'insert-settle',
        animDuration: 400,
      },
      {
        title: "🔄 Now let's INSERT",
        description: `Now we'll INSERT at index [${insertIndex}] (middle).\n\nThis requires SHIFTING elements to make room. Watch carefully!`,
        highlightIndex: insertIndex,
      },
      {
        title: "🔄 INSERT - Shifting",
        description: `Before inserting at [${insertIndex}], we must:\n\nfor i = length-1 down to ${insertIndex}:\n    array[i+1] = array[i]\n\nEach element moves RIGHT by 1!`,
        highlightIndex: insertIndex,
      },
    ];

    // Add steps showing each element shifting
    for (let i = data.length; i > insertIndex; i--) {
      steps.push({
        title: `🔄 Shifting [${i}] → [${i + 1}]`,
        description: `Moving element from index [${i}] to [${i + 1}]\n\narray[${i + 1}] = array[${i}]`,
        highlightIndex: i,
        animPhase: 'access-lift',
        animDuration: 300,
      });
    }

    const newItem2 = generateNewItem();
    steps.push(
      {
        title: "📦 Insert New Element",
        description: `Now there's space at [${insertIndex}]!\n\narray[${insertIndex}] = "${newItem2.label}"`,
        highlightIndex: insertIndex,
        animPhase: 'insert-drop',
        animDuration: 600,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => {
            const arr = [...prev];
            arr.splice(insertIndex, 0, newItem2);
            return arr;
          });
        },
      },
      {
        title: "✅ Inserted!",
        description: `"${newItem2.label}" inserted at [${insertIndex}]!\n\nINSERT = O(n)\n• Must shift ${data.length - insertIndex + 1} elements\n• More elements = more shifting\n• Slower than append!`,
        highlightIndex: insertIndex,
        animPhase: 'insert-settle',
        animDuration: 400,
      },
      {
        title: "📊 Comparison Summary",
        description: `APPEND (end): O(1) - Constant time\n  → Just place at array[length]\n\nINSERT (index): O(n) - Linear time\n  → Must shift elements first\n\n💡 Use append when possible!`,
      }
    );

    startTutorial(steps);
  };

  // ==================== INSERT AT INDEX TUTORIAL ====================

  const arrayInsertTutorial = (insertIndex: number) => {
    const data = getArrayData();
    const newItem = generateNewItem();
    
    const steps: TutorialStep[] = [
      {
        title: "➕ Array Insert",
        description: `Inserting at index [${insertIndex}].\n\nCurrent array: ${data.length} elements\nWe need to make room first!`,
      },
      {
        title: "🔄 Shift Right",
        description: `All elements from [${insertIndex}] must shift RIGHT:\n\nfor (i = ${data.length - 1}; i >= ${insertIndex}; i--)\n    array[i+1] = array[i]`,
        highlightIndex: insertIndex,
      },
    ];

    // Show shifting animation for each element
    for (let i = data.length - 1; i >= insertIndex; i--) {
      steps.push({
        title: `↗️ Shift [${i}] → [${i + 1}]`,
        description: `Moving "${data[i]?.label || 'element'}" one position right`,
        highlightIndex: i,
        animPhase: 'access-lift',
        animDuration: 250,
      });
    }

    steps.push(
      {
        title: "📦 Place Element",
        description: `Space created at [${insertIndex}]!\narray[${insertIndex}] = "${newItem.label}"`,
        highlightIndex: insertIndex,
        animPhase: 'insert-drop',
        animDuration: 600,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => {
            const arr = [...prev];
            arr.splice(insertIndex, 0, newItem);
            return arr;
          });
        },
      },
      {
        title: "✅ Inserted!",
        description: `"${newItem.label}" now at index [${insertIndex}]\n\nTime: O(n) - we shifted ${data.length - insertIndex} elements`,
        highlightIndex: insertIndex,
        animPhase: 'insert-settle',
        animDuration: 400,
      },
      {
        title: "📚 Key Points",
        description: `Insert at [0] = O(n) worst case (shift ALL)\nInsert at [${data.length}] = O(1) best case (no shift)\nInsert in middle = O(n/2) average`,
      }
    );

    startTutorial(steps);
  };

  // ==================== DELETE TUTORIAL ====================

  const arrayDeleteTutorial = (deleteIndex: number) => {
    const data = getArrayData();
    const deletedItem = data[deleteIndex];
    
    const steps: TutorialStep[] = [
      {
        title: "🗑️ Array Delete",
        description: `Deleting "${deletedItem?.label}" at index [${deleteIndex}].\n\nThis will leave a gap that must be filled!`,
        highlightIndex: deleteIndex,
      },
      {
        title: "🎯 Remove Element",
        description: `First, remove the element:\ndeleted = array[${deleteIndex}] // "${deletedItem?.label}"\n\nNow we have a gap at [${deleteIndex}]!`,
        highlightIndex: deleteIndex,
        animPhase: 'delete-lift',
        animDuration: 600,
      },
      {
        title: "💨 Element Gone",
        description: `The element is removed.\n\nBut we can't leave a gap in the array! All elements after must shift LEFT.`,
        highlightIndex: deleteIndex,
        animPhase: 'delete-shrink',
        animDuration: 600,
      },
      {
        title: "🔄 Shift Left",
        description: `Shifting elements to fill the gap:\n\nfor (i = ${deleteIndex}; i < ${data.length - 1}; i++)\n    array[i] = array[i+1]`,
      },
    ];

    // Show each element shifting left
    for (let i = deleteIndex; i < data.length - 1; i++) {
      steps.push({
        title: `↙️ Shift [${i + 1}] → [${i}]`,
        description: `Moving "${data[i + 1]?.label}" left to fill gap`,
        highlightIndex: i,
        animPhase: 'access-settle',
        animDuration: 250,
      });
    }

    steps.push(
      {
        title: "✅ Deleted!",
        description: `"${deletedItem?.label}" removed!\nArray size: ${data.length} → ${data.length - 1}`,
        animPhase: 'delete-close',
        animDuration: 500,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex));
        },
      },
      {
        title: "📚 Key Points",
        description: `Delete at [0] = O(n) worst (shift ALL left)\nDelete at [${data.length - 1}] = O(1) best (no shift)\n\nTime Complexity: O(n) average`,
      }
    );

    startTutorial(steps);
  };

  // ==================== SWAP TUTORIAL ====================

  const arraySwapTutorial = (idx1: number, idx2: number) => {
    const data = getArrayData();
    
    const steps: TutorialStep[] = [
      {
        title: "🔀 Array Swap",
        description: `Swapping elements:\n[${idx1}] "${data[idx1]?.label}" ↔ [${idx2}] "${data[idx2]?.label}"\n\nSwap uses a temporary variable!`,
        highlightIndex: idx1,
        highlightIndex2: idx2,
      },
      {
        title: "📦 Step 1: Save First",
        description: `temp = array[${idx1}]\ntemp = "${data[idx1]?.label}"\n\nWe save this so we don't lose it!`,
        highlightIndex: idx1,
        highlightIndex2: idx2,
        animPhase: 'swap-lift',
        animDuration: 500,
      },
      {
        title: "➡️ Step 2: Copy Second",
        description: `array[${idx1}] = array[${idx2}]\narray[${idx1}] = "${data[idx2]?.label}"\n\nFirst position now has second's value!`,
        highlightIndex: idx1,
        highlightIndex2: idx2,
        animPhase: 'swap-cross',
        animDuration: 500,
      },
      {
        title: "⬅️ Step 3: Use Temp",
        description: `array[${idx2}] = temp\narray[${idx2}] = "${data[idx1]?.label}"\n\nSecond position gets original first!`,
        highlightIndex: idx1,
        highlightIndex2: idx2,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => {
            const arr = [...prev];
            [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
            return arr;
          });
        },
      },
      {
        title: "✅ Swapped!",
        description: `Elements exchanged!\n[${idx1}] = "${data[idx2]?.label}"\n[${idx2}] = "${data[idx1]?.label}"`,
        highlightIndex: idx1,
        highlightIndex2: idx2,
        animPhase: 'swap-drop',
        animDuration: 500,
      },
      {
        title: "📚 Key Points",
        description: `Swap is ALWAYS O(1)!\n\n• Just 3 operations\n• No matter array size\n• Used in sorting algorithms\n• No shifting needed!`,
      },
    ];
    startTutorial(steps);
  };

  // ==================== APPEND TUTORIAL ====================

  const arrayAppendTutorial = () => {
    if (isAnimating || tutorialActive || getArrayData().length >= 6) return;
    
    const data = getArrayData();
    const newIndex = data.length;
    const newItem = generateNewItem();
    
    const steps: TutorialStep[] = [
      {
        title: "➕ Append to End",
        description: `Adding "${newItem.label}" to the END of array.\n\nCurrent length: ${data.length}\nNew element goes at: [${newIndex}]`,
      },
      {
        title: "📍 Direct Placement",
        description: `No shifting needed!\n\narray[${newIndex}] = "${newItem.label}"\nlength = ${newIndex + 1}\n\nWe know exactly where to put it!`,
        highlightIndex: newIndex,
        action: () => {
          (setArrayData as any)((prev: DataItem[]) => [...prev, newItem]);
        },
      },
      {
        title: "⚡ Fast Operation",
        description: `Placing element at end...`,
        highlightIndex: newIndex,
        animPhase: 'insert-drop',
        animDuration: 600,
      },
      {
        title: "✅ Appended!",
        description: `"${newItem.label}" added at index [${newIndex}]!\n\nTime Complexity: O(1) - Constant!\nNo elements were shifted.`,
        highlightIndex: newIndex,
        animPhase: 'insert-settle',
        animDuration: 400,
      },
      {
        title: "📚 Why O(1)?",
        description: `Append is fast because:\n\n• We know length = next index\n• Direct memory access\n• No loops or shifts\n• Same speed for any array size!`,
      },
    ];
    startTutorial(steps);
  };

  // Selection mode handlers
  const startAppendVsInsert = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length >= 5) return;
    appendVsInsertTutorial();
  };

  const startArrayInsert = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length >= 6) return;
    setSelectionMode('insert');
    setPendingOperation('Select index to INSERT at:');
  };

  const startArrayDelete = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length <= 2) return;
    setSelectionMode('delete');
    setPendingOperation('Select index to DELETE:');
  };

  const startArraySwap = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length < 2) return;
    setSelectionMode('swap-first');
    setSwapFirstIndex(null);
    setPendingOperation('Select FIRST index to swap:');
  };

  const startArrayAppend = () => {
    if (isAnimating || tutorialActive || getArrayData().length >= 6) return;
    arrayAppendTutorial();
  };

  const handleIndexSelect = (index: number) => {
    if (selectionMode === 'insert') {
      setSelectionMode('none');
      setPendingOperation('');
      arrayInsertTutorial(index);
    } else if (selectionMode === 'delete') {
      setSelectionMode('none');
      setPendingOperation('');
      arrayDeleteTutorial(index);
    } else if (selectionMode === 'swap-first') {
      setSwapFirstIndex(index);
      setHighlightIndex(index);
      setSelectionMode('swap-second');
      setPendingOperation(`Selected [${index}]. Now select SECOND index:`);
    } else if (selectionMode === 'swap-second' && swapFirstIndex !== null && index !== swapFirstIndex) {
      setSelectionMode('none');
      setPendingOperation('');
      setHighlightIndex(null);
      arraySwapTutorial(swapFirstIndex, index);
      setSwapFirstIndex(null);
    }
  };

  const cancelSelection = () => {
    setSelectionMode('none');
    setPendingOperation('');
    setSwapFirstIndex(null);
    setHighlightIndex(null);
    setHighlightIndex2(null);
  };

  // ==================== LINKED LIST TUTORIALS ====================

  const linkedListInsertHeadTutorial = () => {
    if (isAnimating || tutorialActive || getLinkedListData().length >= 5) return;
    
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#f5c6a0', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#1abc9c' };
    
    const steps: TutorialStep[] = [
      {
        title: "⬅️ Insert at HEAD",
        description: "Adding a new node at the BEGINNING.\n\nThis is the most efficient insertion for linked lists!",
      },
      {
        title: "🔗 Create New Node",
        description: "newNode = new Node(data)\nnewNode.next = null\n\nThe node is created but not connected yet.",
        action: () => {
          (setLinkedListData as any)((prev: DataItem[]) => [newItem, ...prev]);
        },
      },
      {
        title: "🔄 Link to Old Head",
        description: "newNode.next = head\n\nPoint new node to current first node.",
        highlightIndex: 0,
        animPhase: 'll-insert-head',
        animDuration: 600,
      },
      {
        title: "👑 Update Head",
        description: "head = newNode\n\nThe new node is now the head!",
        highlightIndex: 0,
        animPhase: 'll-insert-head-settle',
        animDuration: 400,
      },
      {
        title: "📚 Key Points",
        description: "Insert at HEAD = O(1)\n\n• Just 2 pointer updates\n• No traversal needed\n• No shifting like arrays\n• Super fast!",
      },
    ];
    startTutorial(steps);
  };

  const linkedListInsertTailTutorial = () => {
    if (isAnimating || tutorialActive || getLinkedListData().length >= 5) return;
    
    const data = getLinkedListData();
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#e74c3c' };
    
    const traverseSteps: TutorialStep[] = data.map((item, i) => ({
      title: `🔍 Visiting Node ${i}`,
      description: `current = "${item.label}"\n${i === data.length - 1 ? "current.next == NULL → Found tail!" : "current.next != NULL → Keep going..."}`,
      highlightIndex: i,
      animPhase: 'll-traverse',
      animDuration: 400,
    }));
    
    const steps: TutorialStep[] = [
      {
        title: "➡️ Insert at TAIL",
        description: "Adding a new node at the END.\n\nUnlike arrays, we can't jump to the end!\nWe must traverse from head to find tail.",
      },
      {
        title: "🏃 Start Traversal",
        description: "current = head\n\nBegin at the first node...",
      },
      ...traverseSteps,
      {
        title: "🔗 Link New Node",
        description: "tail.next = newNode\n\nConnect the last node to our new node!",
        highlightIndex: data.length,
        action: () => {
          (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]);
        },
        animPhase: 'll-insert-tail',
        animDuration: 600,
      },
      {
        title: "✅ Inserted!",
        description: `New node added at tail!`,
        highlightIndex: data.length,
        animPhase: 'll-insert-tail-settle',
        animDuration: 400,
      },
      {
        title: "📚 Key Points",
        description: `Insert at TAIL = O(n)\n\n• Must traverse ${data.length} nodes\n• With tail pointer = O(1)\n• Trade-off: memory vs speed`,
      },
    ];
    startTutorial(steps);
  };

  const linkedListDeleteHeadTutorial = () => {
    if (isAnimating || tutorialActive || getLinkedListData().length <= 2) return;
    
    const data = getLinkedListData();
    const steps: TutorialStep[] = [
      {
        title: "🗑️ Delete HEAD",
        description: `Removing "${data[0]?.label}" from the beginning.\n\nThis is very efficient!`,
        highlightIndex: 0,
      },
      {
        title: "📝 Save Reference",
        description: "toDelete = head\n\nSave reference so we can free memory.",
        highlightIndex: 0,
        animPhase: 'll-delete-lift',
        animDuration: 600,
      },
      {
        title: "👑 Update Head",
        description: "head = head.next\n\nHead now points to second node!",
        highlightIndex: 0,
        animPhase: 'll-delete-shrink',
        animDuration: 600,
        action: () => {
          (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1));
        },
      },
      {
        title: "📚 Key Points",
        description: "Delete HEAD = O(1)\n\n• Just one pointer update\n• No traversal needed\n• No shifting like arrays\n• Instant!",
      },
    ];
    startTutorial(steps);
  };

const linkedListTraverseTutorial = () => {
  if (isAnimating || tutorialActive) return;
  
  const data = getLinkedListData();
  
  const steps: TutorialStep[] = [
    // Introduction - Node-pointer relationships
    {
      title: "🔗 Linked List Structure",
      description: "A linked list is made of NODES.\n\nEach node contains:\n• DATA (the value)\n• POINTER (link to next node)\n\nNodes are NOT stored side-by-side in memory!",
    },
    {
      title: "📍 Non-Contiguous Memory",
      description: "Unlike arrays, nodes can be ANYWHERE in memory!\n\nThey're connected only by pointers.\nThis is why we call it 'non-contiguous'.\n\nNo index access - must follow links!",
    },
    {
      title: "👑 Head Pointer",
      description: "The HEAD pointer marks the START.\n\nhead → first node\n\nWithout head, we lose the entire list!\nIt's our only entry point.",
      highlightIndex: 0,
      animPhase: 'll-traverse',
      animDuration: 600,
    },
  ];

  // Sequential traversal steps
  data.forEach((item, i) => {
    steps.push({
      title: `🔍 Traversing Node ${i}`,
      description: `current = "${item.label}"\n\n` +
        `Reading: current.data\n` +
        `Next: current.next ${i < data.length - 1 ? `→ "${data[i + 1]?.label}"` : '→ NULL'}\n\n` +
        `We MUST visit nodes in order!\nCannot skip or jump.`,
      highlightIndex: i,
      animPhase: 'll-traverse',
      animDuration: 500,
    });
  });

  steps.push(
    // Tail pointer concept
    {
      title: "🔚 Tail & NULL",
      description: `Last node's pointer = NULL\n\nThis marks the END of the list.\n\nOptional: Keep a TAIL pointer for O(1) access to end.\nWithout it: must traverse to find tail.`,
      highlightIndex: data.length - 1,
    },
    // Pointer redirection concept
    {
      title: "🔄 Pointer Redirection",
      description: "To INSERT a node:\n\n1. Create new node\n2. newNode.next = target.next\n3. target.next = newNode\n\nJust change pointers!\nNo shifting like arrays.",
    },
    {
      title: "✂️ Deleting Nodes",
      description: "To DELETE a node:\n\n1. Find previous node\n2. previous.next = current.next\n3. Free current node\n\nRedirect pointer to 'skip' the node!",
    },
    // Dynamic memory advantage
    {
      title: "💾 Dynamic Memory",
      description: "Linked List advantages:\n\n✓ Insert/Delete anywhere: O(1)*\n✓ No fixed size\n✓ No wasted space\n✓ Grows/shrinks as needed\n\n*After finding the position",
    },
    // Reversing concept
    {
      title: "🔃 Reversing Links",
      description: "To REVERSE a linked list:\n\nprev = NULL\nwhile (current != NULL):\n  next = current.next\n  current.next = prev\n  prev = current\n  current = next\n\nFlip all pointers!",
    },
    // Summary
    {
      title: "📊 Complexity Summary",
      description: "Access by index: O(n) - must traverse\nSearch: O(n) - must traverse\nInsert at head: O(1)\nInsert at tail: O(1) with tail pointer\nInsert middle: O(n) find + O(1) insert\nDelete: O(n) find + O(1) remove",
    },
  );

  startTutorial(steps);
};

  // ==================== STACK TUTORIALS ====================

  const stackPushTutorial = () => {
    if (isAnimating || tutorialActive || getStackData().length >= 5) return;
    
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art', 'Music'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c', '#3498db'] : ['#7f8c8d'];
    const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] };
    
    const steps: TutorialStep[] = [
      {
        title: "⬆️ Stack PUSH",
        description: `Pushing "${newItem.label}" onto the stack.\n\nPUSH always adds to the TOP!\n(LIFO - Last In, First Out)`,
      },
      {
        title: "📍 Find TOP",
        description: `top = ${data.length - 1}\nnew position = ${data.length}\n\nThe new element goes above everything!`,
        action: () => {
          (setStackData as any)((prev: DataItem[]) => [...prev, newItem]);
        },
      },
      {
        title: "📦 Place on TOP",
        description: `stack[${data.length}] = "${newItem.label}"\ntop++`,
        highlightIndex: data.length,
        animPhase: 'stack-push-drop',
        animDuration: 600,
      },
      {
        title: "✅ Pushed!",
        description: `"${newItem.label}" is now on TOP!`,
        highlightIndex: data.length,
        animPhase: 'stack-push-settle',
        animDuration: 400,
      },
      {
        title: "📚 Key Points",
        description: `PUSH = O(1)\n\n• Always add to top\n• No searching\n• No shifting\n• Instant operation!`,
      },
    ];
    startTutorial(steps);
  };

  const stackPopTutorial = () => {
    if (isAnimating || tutorialActive || getStackData().length <= 1) return;
    
    const data = getStackData();
    const topItem = data[data.length - 1];
    
    const steps: TutorialStep[] = [
      {
        title: "⬇️ Stack POP",
        description: `Removing the TOP element.\n\nPOP only removes from TOP!\nCan't remove from middle or bottom.`,
        highlightIndex: data.length - 1,
      },
      {
        title: "🎯 Identify TOP",
        description: `top = ${data.length - 1}\nvalue = stack[top] = "${topItem.label}"`,
        highlightIndex: data.length - 1,
        animPhase: 'stack-pop-lift',
        animDuration: 500,
      },
      {
        title: "📤 Remove",
        description: `Removing "${topItem.label}"...\ntop--`,
        highlightIndex: data.length - 1,
        animPhase: 'stack-pop-fly',
        animDuration: 600,
        action: () => {
          (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1));
        },
      },
      {
        title: "📚 Key Points",
        description: `POP = O(1)\n\n• Always remove from top\n• Returns the removed item\n• LIFO: Last pushed = first popped`,
      },
    ];
    startTutorial(steps);
  };

  const stackPeekTutorial = () => {
    if (isAnimating || tutorialActive || getStackData().length === 0) return;
    
    const data = getStackData();
    const topItem = data[data.length - 1];
    
    const steps: TutorialStep[] = [
      {
        title: "👁️ Stack PEEK",
        description: "Look at TOP without removing it.\n\nUseful to check before popping!",
        highlightIndex: data.length - 1,
      },
      {
        title: "🔍 Examine TOP",
        description: `return stack[top]\nreturn "${topItem.label}"\n\nElement stays in place!`,
        highlightIndex: data.length - 1,
        animPhase: 'stack-peek-lift',
        animDuration: 800,
      },
      {
        title: "📖 Viewing...",
        description: `TOP = "${topItem.label}"\n\nStack unchanged, just looking!`,
        highlightIndex: data.length - 1,
        animPhase: 'stack-peek-open',
        animDuration: 1500,
      },
      {
        title: "📚 Key Points",
        description: `PEEK = O(1)\n\n• Just return stack[top]\n• Doesn't modify stack\n• Often used before pop`,
        animPhase: 'stack-peek-settle',
        animDuration: 500,
      },
    ];
    startTutorial(steps);
  };

  // ==================== QUEUE TUTORIALS ====================

  const queueEnqueueTutorial = () => {
    if (isAnimating || tutorialActive || getQueueData().length >= 5) return;
    
    const data = getQueueData();
    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#f5c6a0', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } }
      : queueEnv === 'tollgate'
        ? { id: Date.now(), label: `NEW-${Math.floor(Math.random() * 900) + 100}`, color: '#1abc9c' }
        : { id: Date.now(), label: `T-00${data.length + 1}`, color: '#1abc9c' };
    
    const steps: TutorialStep[] = [
      {
        title: "➕ Queue ENQUEUE",
        description: `Adding "${newItem.label}" to queue.\n\nNew elements join at the REAR!\n(FIFO - First In, First Out)`,
      },
      {
        title: "📍 Find REAR",
        description: `rear = ${data.length - 1}\nnew position = ${data.length}\n\nJoin the back of the line!`,
        action: () => {
          (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]);
        },
      },
      {
        title: "🚶 Joining Queue",
        description: `queue[${data.length}] = "${newItem.label}"\nrear++`,
        highlightIndex: data.length,
        animPhase: 'queue-enqueue-enter',
        animDuration: 700,
      },
      {
        title: "✅ Enqueued!",
        description: `"${newItem.label}" joined at rear!`,
        highlightIndex: data.length,
        animPhase: 'queue-enqueue-settle',
        animDuration: 400,
      },
      {
        title: "📚 Key Points",
        description: `ENQUEUE = O(1)\n\n• Add to rear\n• Like joining a line\n• Fair: first come, first served!`,
      },
    ];
    startTutorial(steps);
  };

  const queueDequeueTutorial = () => {
    if (isAnimating || tutorialActive || getQueueData().length <= 1) return;
    
    const data = getQueueData();
    const frontItem = data[0];
    
    const steps: TutorialStep[] = [
      {
        title: "➖ Queue DEQUEUE",
        description: `Removing from FRONT.\n\nFirst one in line gets served first!`,
        highlightIndex: 0,
      },
      {
        title: "🎯 Identify FRONT",
        description: `front = 0\nvalue = queue[front] = "${frontItem.label}"`,
        highlightIndex: 0,
      },
      {
        title: "🚶 Leaving Queue",
        description: `"${frontItem.label}" being served...\nfront++`,
        highlightIndex: 0,
        animPhase: queueEnv === 'tollgate' ? 'queue-dequeue-gate-open' : 'queue-dequeue-walk',
        animDuration: queueEnv === 'tollgate' ? 1000 : 1500,
      },
      {
        title: "👋 Dequeued!",
        description: `"${frontItem.label}" removed from queue!`,
        highlightIndex: 0,
        animPhase: queueEnv === 'tollgate' ? 'queue-dequeue-drive' : 'queue-dequeue-enter',
        animDuration: 1200,
        action: () => {
          (setQueueData as any)((prev: DataItem[]) => prev.slice(1));
        },
      },
      {
        title: "📚 Key Points",
        description: `DEQUEUE = O(1) with circular array\n\n• Remove from front\n• FIFO: Fair ordering\n• Like real-life queues!`,
      },
    ];
    startTutorial(steps);
  };

  const queueFrontTutorial = () => {
    if (isAnimating || tutorialActive || getQueueData().length === 0) return;
    
    const data = getQueueData();
    const frontItem = data[0];
    
    const steps: TutorialStep[] = [
      {
        title: "👁️ Queue FRONT",
        description: "Peek at who's next without removing.",
        highlightIndex: 0,
      },
      {
        title: "🔍 Checking FRONT",
        description: `return queue[front]\nreturn "${frontItem.label}"\n\nThey stay in line!`,
        highlightIndex: 0,
        animPhase: 'queue-front-peek',
        animDuration: 1200,
      },
      {
        title: "📚 Key Points",
        description: `FRONT/PEEK = O(1)\n\n• Just check queue[front]\n• Queue unchanged\n• Useful before dequeue`,
      },
    ];
    startTutorial(steps);
  };

  // ==================== CAMERA & WEBXR SETUP ====================

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); };
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
    await tf.ready(); await tf.setBackend('webgl');
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
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current || appMode !== 'person') return;
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

  useEffect(() => {
    const checkXR = async () => {
      try {
        if ((navigator as any).xr) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-ar');
          setWebxrSupported(supported);
        }
      } catch { setWebxrSupported(false); }
    };
    checkXR();
  }, []);

  const cleanupWebXR = useCallback(() => {
    if (xrRendererRef.current) {
      xrRendererRef.current.setAnimationLoop(null);
      xrRendererRef.current.dispose();
      if (xrContainerRef.current && xrRendererRef.current.domElement.parentNode === xrContainerRef.current)
        xrContainerRef.current.removeChild(xrRendererRef.current.domElement);
    }
    xrSessionRef.current = null; xrRendererRef.current = null; xrSceneRef.current = null;
    xrCameraRef.current = null; xrGroupRef.current = null; xrReticleRef.current = null;
    xrHitTestSourceRef.current = null;
    setWebxrActive(false); setWebxrPlaced(false); setAppMode('surface');
  }, []);

  const stopWebXR = useCallback(() => {
    if (xrSessionRef.current) { try { xrSessionRef.current.end(); } catch (e) { cleanupWebXR(); } }
    else cleanupWebXR();
  }, [cleanupWebXR]);

  const startWebXR = async () => {
    const xr = (navigator as any).xr;
    if (!xr) { alert('WebXR not available.'); setAppMode('surface'); return; }
    try {
      const sessionInit: any = { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'] };
      const overlayEl = document.getElementById('ar-overlay');
      if (overlayEl) sessionInit.domOverlay = { root: overlayEl };
      const session = await xr.requestSession('immersive-ar', sessionInit);
      xrSessionRef.current = session;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
      xrRendererRef.current = renderer;
      if (xrContainerRef.current) xrContainerRef.current.appendChild(renderer.domElement);
      await renderer.xr.setSession(session);
      const scene = new THREE.Scene(); xrSceneRef.current = scene;
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 10, 7); dirLight.castShadow = true; scene.add(dirLight);
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
      xrCameraRef.current = camera;
      const group = new THREE.Group(); group.visible = false; scene.add(group); xrGroupRef.current = group;
      const reticle = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
      reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); xrReticleRef.current = reticle;
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      xrHitTestSourceRef.current = hitTestSource;
      session.addEventListener('select', () => {
        if (xrReticleRef.current?.visible && xrGroupRef.current && !xrGroupRef.current.visible) {
          xrGroupRef.current.position.setFromMatrixPosition(xrReticleRef.current.matrix);
          xrGroupRef.current.visible = true; xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
          xrReticleRef.current.visible = false; setWebxrPlaced(true);
        }
      });
      session.addEventListener('end', () => cleanupWebXR());
      renderer.setAnimationLoop((_ts: number, frame: any) => {
        if (frame && xrHitTestSourceRef.current && xrGroupRef.current && !xrGroupRef.current.visible) {
          const refSpace = renderer.xr.getReferenceSpace();
          if (refSpace) {
            const results = frame.getHitTestResults(xrHitTestSourceRef.current);
            if (results.length > 0) {
              const pose = results[0].getPose(refSpace);
              if (pose && xrReticleRef.current) { xrReticleRef.current.visible = true; xrReticleRef.current.matrix.fromArray(pose.transform.matrix); }
            } else if (xrReticleRef.current) xrReticleRef.current.visible = false;
          }
        }
        renderer.render(scene, camera);
      });
      setWebxrActive(true); setWebxrPlaced(false); setAppMode('webxr');
    } catch (err: any) { console.error(err); alert('WebXR failed.'); setAppMode('surface'); }
  };

  useEffect(() => {
    if (appMode !== 'webxr' || !webxrPlaced || !xrGroupRef.current) return;
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText);
  }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText]);

  useEffect(() => {
    if (xrGroupRef.current && webxrActive && webxrPlaced) xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
  }, [zoomLevel, webxrActive, webxrPlaced]);

  const resetWebXRPlacement = useCallback(() => {
    if (xrGroupRef.current) xrGroupRef.current.visible = false;
    setWebxrPlaced(false);
  }, []);

  const switchToMode = useCallback((mode: AppMode) => {
    if (appMode === 'webxr' && mode !== 'webxr') stopWebXR();
    if (mode === 'webxr') {
      if (!webxrSupported) { alert('WebXR not supported.'); mode = 'surface'; }
      else { startWebXR(); return; }
    }
    setAppMode(mode);
    if (mode === 'surface') { setDetectedPerson(null); setPersonPosition(null); setSurfacePlaced(false); setSurfacePosition(null); }
    else if (mode === 'person') { setSurfacePlaced(false); setSurfacePosition(null); }
  }, [appMode, webxrSupported, stopWebXR]);

  const handleSurfaceTap = useCallback((e: React.MouseEvent) => {
    if (appMode !== 'surface' || surfacePlaced) return;
    const { clientX, clientY } = e;
    if (clientY < 160 || clientY > window.innerHeight - 180) return;
    const vizWidth = Math.min(window.innerWidth - 20, 380);
    const vizHeight = currentStructure === 'stack' ? 300 : 220;
    setSurfacePosition({ x: clientX - vizWidth / 2, y: clientY - vizHeight / 2, width: vizWidth, height: vizHeight });
    setSurfacePlaced(true);
  }, [appMode, surfacePlaced, currentStructure]);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (appMode !== 'surface' || !surfacePlaced || !surfacePosition) return;
    let clientX: number, clientY: number;
    if ('touches' in e) { if (e.touches.length !== 1) return; clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    const v = surfacePosition;
    if (clientX >= v.x && clientX <= v.x + v.width && clientY >= v.y && clientY <= v.y + v.height) {
      setIsDraggingSurface(true); dragOffsetRef.current = { x: clientX - v.x, y: clientY - v.y };
    }
  }, [appMode, surfacePlaced, surfacePosition]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingSurface || !surfacePosition) return;
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    setSurfacePosition(prev => prev ? { ...prev, x: clientX - dragOffsetRef.current.x, y: clientY - dragOffsetRef.current.y } : null);
  }, [isDraggingSurface, surfacePosition]);

  const handleDragEnd = useCallback(() => setIsDraggingSurface(false), []);
  const resetSurfacePlacement = useCallback(() => { setSurfacePlaced(false); setSurfacePosition(null); }, []);

  const activePosition = appMode === 'person' ? personPosition : surfacePosition;
  const showVisualization = appMode === 'person' ? !!detectedPerson : appMode === 'surface' ? surfacePlaced : false;
  const showControls = showVisualization || (appMode === 'webxr' && webxrPlaced);

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

  const envTabs = currentStructure === 'array'
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🎓', label: 'Class' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '🚪', label: 'Queue' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🛣️', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🏫', label: 'School' }];

  return (
    <div id="ar-overlay" style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
      onClick={appMode === 'surface' && !surfacePlaced ? handleSurfaceTap : undefined}
      onTouchStart={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined}
      onTouchMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined}
      onTouchEnd={appMode === 'surface' ? handleDragEnd : undefined}
      onMouseDown={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined}
      onMouseMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined}
      onMouseUp={appMode === 'surface' ? handleDragEnd : undefined}>

      {!webxrActive && <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div ref={xrContainerRef} style={{ position: 'fixed', inset: 0, zIndex: webxrActive ? 1 : -1, pointerEvents: 'none' }} />

      {!webxrActive && showVisualization && activePosition && (
        <Visualization3D position={activePosition} data={currentData} highlightIndex={highlightIndex} highlightIndex2={highlightIndex2}
          structure={currentStructure} environment={currentEnvId} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
          isSurfaceMode={appMode === 'surface'} animPhase={animPhase} animData={animData} animProgress={animProgress} tutorialText={tutorialText} />
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {!webxrActive && <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200 }}>🔄</button>}

        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5 }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5 }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'webxr' ? '#e17055' : 'transparent', color: 'white', opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25 }}>🌐 AR{!webxrSupported && ' ✗'}</button>
        </div>

        {showControls && !tutorialActive && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={zoomIn} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={zoomOut} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={resetZoom} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

        {!tutorialActive && (
          <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
            {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
              <button key={s} onClick={() => { if (!isAnimating && selectionMode === 'none') { setCurrentStructure(s); cancelSelection(); if (appMode === 'surface') { setSurfacePlaced(false); setSurfacePosition(null); } } }}
                style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>
                {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}{currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
              </button>
            ))}
          </div>
        )}

        {showControls && !tutorialActive && (
          <div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && selectionMode === 'none' && (setCurrentEnv as any)(e.id)}
                style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        )}
        
        {webxrActive && <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '10px 18px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 13, fontWeight: 'bold', zIndex: 300 }}>✕ Exit AR</button>}
      </div>

{/* Tutorial Step Display - Minimal Controls */}
{tutorialActive && (
  <div style={{ 
    position: 'fixed', 
    bottom: 100, 
    left: '50%', 
    transform: 'translateX(-50%)', 
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(0,0,0,0.7)',
    padding: '10px 20px',
    borderRadius: 30,
    border: '1px solid rgba(255,255,255,0.2)',
    zIndex: 200 
  }}>
    {/* Step indicator */}
    <span style={{ 
      color: 'rgba(255,255,255,0.8)', 
      fontSize: 12, 
      fontWeight: 'bold',
      minWidth: 50
    }}>
      {currentStepIndex + 1}/{tutorialSteps.length}
    </span>
    
    {/* Progress dots */}
    <div style={{ display: 'flex', gap: 4 }}>
      {tutorialSteps.map((_, i) => (
        <div 
          key={i} 
          style={{ 
            width: 6, 
            height: 6, 
            borderRadius: '50%', 
            background: i <= currentStepIndex ? '#667eea' : 'rgba(255,255,255,0.3)',
            transition: 'background 0.3s'
          }} 
        />
      ))}
    </div>
    
    {/* Skip button */}
    <button 
      onClick={endTutorial} 
      style={{ 
        padding: '10px 20px', 
        background: 'rgba(255,255,255,0.1)', 
        border: '1px solid rgba(255,255,255,0.3)', 
        borderRadius: 20, 
        color: 'white', 
        fontSize: 14, 
        fontWeight: 'bold',
        cursor: 'pointer' 
      }}
    >
      Skip
    </button>
    
    {/* Next button */}
    <button 
      onClick={nextStep} 
      disabled={stepAnimating}
      style={{ 
        padding: '10px 24px', 
        background: stepAnimating ? '#555' : 'linear-gradient(135deg, #667eea, #764ba2)', 
        border: 'none', 
        borderRadius: 20, 
        color: 'white', 
        fontSize: 14, 
        fontWeight: 'bold', 
        cursor: stepAnimating ? 'not-allowed' : 'pointer',
        opacity: stepAnimating ? 0.7 : 1,
        transition: 'all 0.3s'
      }}
    >
      {stepAnimating ? '⏳' : currentStepIndex >= tutorialSteps.length - 1 ? '✓ Done' : 'Next →'}
    </button>
  </div>
)}
      {showControls && !tutorialActive && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          {(appMode === 'surface' && surfacePlaced) && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetSurfacePlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
            </div>
          )}
          {(appMode === 'webxr' && webxrPlaced) && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (<>
              {/* Selection Mode UI */}
              {selectionMode !== 'none' && (
                <div style={{ width: '100%', marginBottom: 10 }}>
                  <div style={{ textAlign: 'center', color: '#ffff00', marginBottom: 8, fontSize: 14, fontWeight: 'bold' }}>
                    {pendingOperation}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {getArrayData().map((_, i) => (
                      <button key={i} onClick={() => handleIndexSelect(i)}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: (highlightIndex === i || swapFirstIndex === i) ? '3px solid #ffff00' : '2px solid rgba(255,255,255,0.5)', background: (highlightIndex === i || swapFirstIndex === i) ? '#ffff00' : 'rgba(255,255,255,0.15)', color: (highlightIndex === i || swapFirstIndex === i) ? '#000' : '#fff', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>
                        [{i}]
                      </button>
                    ))}
                    {selectionMode === 'insert' && (
                      <button onClick={() => handleIndexSelect(getArrayData().length)}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.5)', background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                        [{getArrayData().length}]
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <button onClick={cancelSelection} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(231, 76, 60, 0.3)', color: '#fff', cursor: 'pointer' }}>✕ Cancel</button>
                  </div>
                </div>
              )}

              {/* ALL array environments now have the SAME operations */}
              {selectionMode === 'none' && (
                <>
                  <OpBtn onClick={startAppendVsInsert} disabled={isAnimating || getArrayData().length >= 5} color="#f39c12" label="📚 Learn" />
                  <OpBtn onClick={startArrayAppend} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Append" />
                  <OpBtn onClick={startArrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#3498db" label="📥 Insert" />
                  <OpBtn onClick={startArrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="🗑️ Delete" />
                  <OpBtn onClick={startArraySwap} disabled={isAnimating || getArrayData().length < 2} color="#9b59b6" label="🔀 Swap" />
                </>
              )}
            </>)}
            
{currentStructure === 'linkedlist' && (
  <OpBtn onClick={linkedListTraverseTutorial} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse & Learn" />
)}
            
            {currentStructure === 'stack' && (<>
              <OpBtn onClick={stackPushTutorial} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
              <OpBtn onClick={stackPopTutorial} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" />
              <OpBtn onClick={stackPeekTutorial} disabled={isAnimating} color="#f39c12" label="👁️ Peek" />
            </>)}
            
            {currentStructure === 'queue' && (<>
              <OpBtn onClick={queueEnqueueTutorial} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
              <OpBtn onClick={queueDequeueTutorial} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" />
              <OpBtn onClick={queueFrontTutorial} disabled={isAnimating} color="#f39c12" label="👁️ Front" />
            </>)}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {currentData.length}
          </div>
        </div>
      )}

      {appMode === 'person' && !detectedPerson && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🧑</div><div style={{ marginTop: 8 }}>Point camera at a person</div>
        </div>
      )}
      {appMode === 'surface' && !surfacePlaced && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div><div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div>
          <style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      )}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning...</div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
        </div>
      )}
    </div>
  );
}

function OpBtn({ onClick, disabled, color, label }: { onClick: () => void; disabled: boolean; color: string; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 16px', fontSize: 12, fontWeight: 'bold', border: 'none', borderRadius: 25,
      background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 70,
    }}>{label}</button>
  );
}

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode, animPhase, animData, animProgress, tutorialText }: {
  position: Position; data: DataItem[]; highlightIndex: number | null; highlightIndex2: number | null;
  structure: DataStructure; environment: string; zoomLevel: number; setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean; animPhase: string; animData: Record<string, any>; animProgress: number;
  tutorialText?: { title: string; description: string; step: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);
  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
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
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5); scene.add(backLight);

    const group = new THREE.Group(); groupRef.current = group; scene.add(group);

    let isDragging = false, lastX = 0, lastY = 0, pinchDist: number | null = null, pinchZoom = 1;
    const getDist = (t: TouchList): number | null => { if (t.length < 2) return null; const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); };
    const onTS = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2) { pinchDist = getDist(e.touches); pinchZoom = zoomRef.current; } else if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTM = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2 && pinchDist !== null) { const d = getDist(e.touches); if (d) setZoomLevel(Math.max(0.3, Math.min(3, pinchZoom * (d / pinchDist)))); } else if (e.touches.length === 1 && isDragging) { rotationRef.current.y += (e.touches[0].clientX - lastX) * 0.01; rotationRef.current.x += (e.touches[0].clientY - lastY) * 0.008; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTE = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length < 2) pinchDist = null; if (e.touches.length === 0) isDragging = false; };
    const onMD = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMM = (e: MouseEvent) => { if (!isDragging) return; rotationRef.current.y += (e.clientX - lastX) * 0.01; rotationRef.current.x += (e.clientY - lastY) * 0.008; lastX = e.clientX; lastY = e.clientY; };
    const onMU = () => { isDragging = false; };
    const onWH = (e: WheelEvent) => { e.preventDefault(); setZoomLevel(Math.max(0.3, Math.min(3, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15)))); };

    container.addEventListener('touchstart', onTS, { passive: false });
    container.addEventListener('touchmove', onTM, { passive: false });
    container.addEventListener('touchend', onTE, { passive: false });
    container.addEventListener('mousedown', onMD);
    container.addEventListener('mousemove', onMM);
    container.addEventListener('mouseup', onMU);
    container.addEventListener('mouseleave', onMU);
    container.addEventListener('wheel', onWH, { passive: false });

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
      container.removeEventListener('touchstart', onTS);
      container.removeEventListener('touchmove', onTM);
      container.removeEventListener('touchend', onTE);
      container.removeEventListener('mousedown', onMD);
      container.removeEventListener('mousemove', onMM);
      container.removeEventListener('mouseup', onMU);
      container.removeEventListener('mouseleave', onMU);
      container.removeEventListener('wheel', onWH);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure, renderWidth, renderHeight]);

  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress, tutorialText);
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress, tutorialText]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto', overflow: 'visible' }} />;
}
