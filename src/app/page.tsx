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

// ==================== 3D TEXT SPRITE ====================

function createTextSprite(text: string, color: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, 512, 128);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 15);
  ctx.fill();
  
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
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(30, 30, 60, 0.95)');
  gradient.addColorStop(1, 'rgba(20, 20, 40, 0.95)');
  ctx.fillStyle = gradient;
  ctx.roundRect(0, 0, 512, 256, 20);
  ctx.fill();
  
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 4;
  ctx.roundRect(2, 2, 508, 252, 18);
  ctx.stroke();
  
  ctx.fillStyle = '#667eea';
  ctx.roundRect(15, 15, 80, 30, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(step, 55, 35);
  
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(title, 110, 38);
  
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
// ==================== CLIPBOARD (TODO) ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
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
  pctx.fillText('TO-DO', 95, 28);

  pctx.strokeStyle = '#ddd';
  pctx.lineWidth = 1;
  for (let y = 60; y < 260; y += 28) {
    pctx.beginPath();
    pctx.moveTo(20, y);
    pctx.lineTo(170, y);
    pctx.stroke();
  }

  pctx.fillStyle = '#333';
  pctx.font = 'bold 22px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 95, 100);

  pctx.strokeStyle = '#333';
  pctx.lineWidth = 2;
  pctx.strokeRect(22, 130, 14, 14);
  pctx.strokeRect(22, 160, 14, 14);
  pctx.strokeRect(22, 190, 14, 14);

  pctx.fillStyle = '#666';
  pctx.font = '14px Arial';
  pctx.textAlign = 'left';
  pctx.fillText('Task item 1', 44, 142);
  pctx.fillText('Task item 2', 44, 172);
  pctx.fillText('Task item 3', 44, 202);

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

// ==================== TABLET FOR TODO ====================

function createTablet(tasks: DataItem[], highlightIndex: number | null): THREE.Group {
  const tablet = new THREE.Group();

  const tabletWidth = 0.65;
  const tabletHeight = 0.45;
  const tabletDepth = 0.02;

  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.3, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(tabletWidth, tabletDepth, tabletHeight), bodyMat);
  tablet.add(body);

  const bezelMat = new THREE.MeshStandardMaterial({ color: '#0a0a15', roughness: 0.2 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(tabletWidth - 0.02, tabletDepth + 0.001, tabletHeight - 0.02), bezelMat);
  bezel.position.y = 0.001;
  tablet.add(bezel);

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 400;
  screenCanvas.height = 280;
  const ctx = screenCanvas.getContext('2d')!;

  ctx.fillStyle = '#1e272e';
  ctx.fillRect(0, 0, 400, 280);

  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(0, 0, 400, 50);
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('📝 TO-DO LIST', 200, 35);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(10, 55, 380, 25);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Active Tasks: ${tasks.length}`, 20, 72);
  ctx.textAlign = 'right';
  const now = new Date();
  ctx.fillText(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`, 380, 72);

  const taskStartY = 90;
  const taskHeight = 38;
  const maxVisibleTasks = 4;

  tasks.slice(0, maxVisibleTasks).forEach((task, i) => {
    const y = taskStartY + i * taskHeight;
    const isHl = highlightIndex === i;

    if (isHl) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    } else {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
    }
    ctx.fillRect(10, y, 380, taskHeight - 2);

    ctx.strokeStyle = task.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(20, y + 8, 20, 20);

    ctx.fillStyle = task.color;
    ctx.fillRect(50, y + 5, 4, taskHeight - 12);

    ctx.fillStyle = isHl ? '#ffff00' : '#fff';
    ctx.font = isHl ? 'bold 18px Arial' : '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(task.label, 65, y + 23);

    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`[${i}]`, 380, y + 23);
  });

  if (tasks.length > maxVisibleTasks) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`+ ${tasks.length - maxVisibleTasks} more tasks...`, 200, 260);
  }

  if (tasks.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No tasks yet!', 200, 160);
    ctx.font = '14px Arial';
    ctx.fillText('Tap "Append" to add a task', 200, 185);
  }

  const screenTex = new THREE.CanvasTexture(screenCanvas);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(tabletWidth - 0.04, tabletHeight - 0.04), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = tabletDepth / 2 + 0.001;
  tablet.add(screen);

  const homeBtn = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5 }));
  homeBtn.rotation.x = -Math.PI / 2;
  homeBtn.position.set(0, tabletDepth / 2 + 0.001, tabletHeight / 2 - 0.025);
  tablet.add(homeBtn);

  const camera = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), new THREE.MeshBasicMaterial({ color: '#222' }));
  camera.rotation.x = -Math.PI / 2;
  camera.position.set(0, tabletDepth / 2 + 0.001, -tabletHeight / 2 + 0.025);
  tablet.add(camera);

  const standMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.3 });
  const standBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.01), standMat);
  standBack.position.set(0, -0.05, -0.15);
  standBack.rotation.x = -0.5;
  tablet.add(standBack);

  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.01, 0.12), standMat);
  standBase.position.set(0, -0.12, -0.05);
  tablet.add(standBase);

  return tablet;
}

// ==================== TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  // Main body - grey color
  const bodyGeo = new THREE.BoxGeometry(0.7, 0.32, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#555555',
    metalness: 0.4,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.14;
  train.add(body);

  // Stripe - black
  const stripeGeo = new THREE.BoxGeometry(0.72, 0.03, 0.33);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#222222', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.2;
  train.add(stripe);

  // Roof - dark grey
  const roofGeo = new THREE.BoxGeometry(0.66, 0.06, 0.28);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.33;
  train.add(roof);

  // Undercarriage - black
  const underGeo = new THREE.BoxGeometry(0.68, 0.05, 0.26);
  const underMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.7 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.04;
  train.add(under);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.9, roughness: 0.1 });
  const spokeMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.7 });

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

  // Windows - dark
  if (!isEngine) {
    const windowGeo = new THREE.BoxGeometry(0.1, 0.09, 0.01);
    const windowMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.5, roughness: 0.1 });
    [-0.22, 0, 0.22].forEach(x => {
      const wF = new THREE.Mesh(windowGeo, windowMat);
      wF.position.set(x, 0.18, 0.165);
      train.add(wF);
      const wB = new THREE.Mesh(windowGeo, windowMat);
      wB.position.set(x, 0.18, -0.165);
      train.add(wB);
    });
  }

  // Engine specific parts
  if (isEngine) {
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.5, roughness: 0.4 });
    const boilerGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12);
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(-0.15, 0.16, 0);
    train.add(boiler);

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

    const cabinMat = new THREE.MeshStandardMaterial({ color: '#666666', metalness: 0.4 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.32), cabinMat);
    cabin.position.set(0.26, 0.24, 0);
    train.add(cabin);

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.36), roofMat);
    cabRoof.position.set(0.26, 0.38, 0);
    train.add(cabRoof);
  }

  // Connectors - dark grey
  const hookGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.8 });
  [-0.375, 0.375].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);
  });

  // Label
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

  const easedOpen = gateOpenAmount < 0.5
    ? 2 * gateOpenAmount * gateOpenAmount
    : 1 - Math.pow(-2 * gateOpenAmount + 2, 2) / 2;
  gatePivot.rotation.x = -easedOpen * Math.PI * 0.45;

  toll.add(gatePivot);

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

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.23), bodyMat);
  cabin.position.set(0.02, 0.23, 0);
  car.add(cabin);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#a8d8ea', metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.75 });

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.21), glassMat);
  windshield.position.set(-0.1, 0.24, 0);
  car.add(windshield);

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

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 96;
  plateCanvas.height = 36;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 96, 36);
  pctx.fillStyle = '#2c3e50';
  pctx.font = 'bold 14px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 48, 24);
  const plateTex = new THREE.CanvasTexture(plateCanvas);

  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: plateTex }));
  frontPlate.position.set(-0.281, 0.04, 0);
  frontPlate.rotation.y = -Math.PI / 2;
  car.add(frontPlate);

  if (isHighlighted) {
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.32), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 }));
    glow.position.y = 0.15;
    car.add(glow);
  }

  return car;
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
  const ticketGap = 0.002;
  const totalTicketLength = ticketWidth + ticketGap;

  const ticketStartX = 0.28;
  const ticketY = groundY + 0.35;
  const ticketZ = -0.6;

  const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const isSliding = animPhase === 'queue-dequeue-slide';
const isExiting = animPhase === 'queue-dequeue-exit';

let slideOffset = 0;
const slideDistance = totalTicketLength;

if (isSliding) {
  const easedProgress = easeInOut(animProgress || 0);
  slideOffset = -easedProgress * slideDistance;
} else if (isExiting) {
  // Keep tickets at slid position during exit
  slideOffset = -slideDistance;
}

  tickets.forEach((ticket, i) => {
    const isHl = highlightIndex === i;
    const isFront = i === 0;

    const ticketGroup = new THREE.Group();

let ticketX = ticketStartX + i * totalTicketLength;
if (isSliding || isExiting) {
  ticketX += slideOffset;
}
    
    let ticketScale = 1;
    let ticketOpacity = 1;
    let shouldRender = true;

    if (isFront && isExiting) {
      const progress = animProgress || 0;
      const easedProgress = easeInOut(progress);
      
      ticketX = ticketStartX - slideDistance - easedProgress * 0.2;
      ticketScale = Math.max(0.01, 1 - easedProgress * 0.95);
      ticketOpacity = Math.max(0, 1 - easedProgress);
      
      if (progress > 0.95) {
        shouldRender = false;
      }
    }

    if (!shouldRender || ticketScale <= 0.01) return;

    ticketGroup.scale.setScalar(ticketScale);

    const ticketMat = new THREE.MeshStandardMaterial({
      color: ticket.color,
      roughness: 0.35,
      emissive: isHl && !isExiting ? '#ffff00' : '#000',
      emissiveIntensity: isHl && !isExiting ? 0.3 : 0,
      transparent: ticketOpacity < 1,
      opacity: ticketOpacity
    });
    const ticketBody = new THREE.Mesh(new THREE.BoxGeometry(ticketWidth, ticketThickness, ticketHeight), ticketMat);
    ticketGroup.add(ticketBody);

    if (i < tickets.length - 1 && !(isFront && isExiting)) {
      const connectorMat = new THREE.MeshStandardMaterial({
        color: ticket.color,
        roughness: 0.4,
        transparent: ticketOpacity < 1,
        opacity: ticketOpacity * 0.8
      });
      const connector = new THREE.Mesh(
        new THREE.BoxGeometry(ticketGap + 0.01, ticketThickness * 0.6, ticketHeight * 0.3),
        connectorMat
      );
      connector.position.set(ticketWidth / 2 + ticketGap / 2, 0, 0);
      ticketGroup.add(connector);
    }

    const ticketCanvas = document.createElement('canvas');
    ticketCanvas.width = 90;
    ticketCanvas.height = 50;
    const tctx = ticketCanvas.getContext('2d')!;
    tctx.fillStyle = 'rgba(0,0,0,0.4)';
    tctx.fillRect(0, 0, 90, 14);
    tctx.fillStyle = '#fff';
    tctx.font = 'bold 9px Arial';
    tctx.textAlign = 'center';
    tctx.fillText('★ TICKET ★', 45, 10);
    tctx.font = 'bold 18px Arial';
    tctx.fillText(ticket.label, 45, 36);
    const ticketLabelTex = new THREE.CanvasTexture(ticketCanvas);
    const ticketLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(ticketWidth - 0.01, ticketHeight - 0.01),
      new THREE.MeshBasicMaterial({ map: ticketLabelTex, transparent: true, opacity: ticketOpacity })
    );
    ticketLabel.position.y = ticketThickness / 2 + 0.001;
    ticketLabel.rotation.x = -Math.PI / 2;
    ticketGroup.add(ticketLabel);

    if (isHl && !isExiting) {
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
    let frontLabelX = ticketStartX;
    if (isSliding) {
      frontLabelX += slideOffset;
    }
    
    if (!isExiting) {
      const frontSprite = createTextSprite('FRONT', '#00ff00', 16);
      frontSprite.position.set(frontLabelX, groundY + 0.2, ticketZ);
      frontSprite.scale.set(0.22, 0.08, 1);
      dispenser.add(frontSprite);
    }

    let rearLabelX = ticketStartX + (tickets.length - 1) * totalTicketLength;
    if (isSliding) {
      rearLabelX += slideOffset;
    }
    const rearSprite = createTextSprite('REAR', '#ff6600', 16);
    rearSprite.position.set(rearLabelX, groundY + 0.2, ticketZ);
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

  return dispenser;
}

// ==================== SCHOOL BUILDING (UNIVERSITY) ====================

function createSchoolBuilding(): THREE.Group {
  const school = new THREE.Group();
  const groundY = 0;

  const wallMat = new THREE.MeshStandardMaterial({ color: '#f5e6d3', roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.5, metalness: 0.3 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#e8dcc8', roughness: 0.4 });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.8 });
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8, roughness: 0.2 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#a0a0a0', roughness: 0.8 });

  // Main building
  const mainBuildingWidth = 2.4;
  const mainBuildingHeight = 1.8;
  const mainBuildingDepth = 0.8;

  const mainBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(mainBuildingDepth, mainBuildingHeight, mainBuildingWidth),
    wallMat
  );
  mainBuilding.position.set(-0.4, groundY + mainBuildingHeight / 2, 0);
  school.add(mainBuilding);

  // Entrance section
  const entranceWidth = 1.0;
  const entranceHeight = 1.5;
  const entranceDepth = 0.35;

  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(entranceDepth, entranceHeight, entranceWidth),
    wallMat
  );
  entrance.position.set(0, groundY + entranceHeight / 2, 0);
  school.add(entrance);

  // Flat roof above entrance
  const entranceRoof = new THREE.Mesh(
    new THREE.BoxGeometry(entranceDepth + 0.15, 0.1, entranceWidth + 0.2),
    concreteMat
  );
  entranceRoof.position.set(0.05, groundY + entranceHeight + 0.05, 0);
  school.add(entranceRoof);

  // Decorative trim under entrance roof
  const entranceTrim = new THREE.Mesh(
    new THREE.BoxGeometry(entranceDepth + 0.12, 0.04, entranceWidth + 0.15),
    pillarMat
  );
  entranceTrim.position.set(0.03, groundY + entranceHeight, 0);
  school.add(entranceTrim);

  // Only 2 pillars
  const pillarRadius = 0.07;
  const pillarHeight = entranceHeight - 0.2;
  const pillarPositions = [-0.38, 0.38];

  pillarPositions.forEach(z => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(pillarRadius, pillarRadius * 1.15, pillarHeight, 16),
      pillarMat
    );
    pillar.position.set(0.18, groundY + pillarHeight / 2 + 0.1, z);
    school.add(pillar);

    const pillarBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.18),
      pillarMat
    );
    pillarBase.position.set(0.18, groundY + 0.06, z);
    school.add(pillarBase);

    const pillarCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, 0.16),
      pillarMat
    );
    pillarCap.position.set(0.18, groundY + pillarHeight + 0.13, z);
    school.add(pillarCap);
  });

  // Big double doors in the middle
  const doorWidth = 0.22;
  const doorHeight = 0.7;
  const doorGap = 0.02;

  // Door frame
  const bigFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, doorHeight + 0.12, doorWidth * 2 + doorGap + 0.1),
    new THREE.MeshStandardMaterial({ color: '#3e2723', roughness: 0.5 })
  );
  bigFrame.position.set(0.19, groundY + doorHeight / 2 + 0.06, 0);
  school.add(bigFrame);

  // Door header
  const doorHeader = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, doorWidth * 2 + doorGap + 0.12),
    new THREE.MeshStandardMaterial({ color: '#3e2723', roughness: 0.5 })
  );
  doorHeader.position.set(0.19, groundY + doorHeight + 0.08, 0);
  school.add(doorHeader);

  // Left door
  const leftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, doorHeight, doorWidth),
    doorMat
  );
  leftDoor.position.set(0.2, groundY + doorHeight / 2, -doorWidth / 2 - doorGap / 2);
  school.add(leftDoor);

  // Right door
  const rightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, doorHeight, doorWidth),
    doorMat
  );
  rightDoor.position.set(0.2, groundY + doorHeight / 2, doorWidth / 2 + doorGap / 2);
  school.add(rightDoor);

  // Door handles
  const leftHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    goldMat
  );
  leftHandle.position.set(0.22, groundY + doorHeight / 2, -doorGap / 2 - 0.03);
  school.add(leftHandle);

  const rightHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    goldMat
  );
  rightHandle.position.set(0.22, groundY + doorHeight / 2, doorGap / 2 + 0.03);
  school.add(rightHandle);

  // Door windows
  [-1, 1].forEach(side => {
    const doorWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth * 0.5, doorHeight * 0.3),
      windowMat
    );
    doorWindow.position.set(0.215, groundY + doorHeight * 0.72, side * (doorWidth / 2 + doorGap / 2));
    doorWindow.rotation.y = Math.PI / 2;
    school.add(doorWindow);
  });

  // Windows on main building
  const windowPositions = [
    { z: -0.95, floors: [0.4, 0.9, 1.4] },
    { z: -0.7, floors: [0.4, 0.9, 1.4] },
    { z: 0.95, floors: [0.4, 0.9, 1.4] },
    { z: 0.7, floors: [0.4, 0.9, 1.4] },
    { z: -0.35, floors: [1.05, 1.45] },
    { z: 0.35, floors: [1.05, 1.45] },
  ];

  windowPositions.forEach(wp => {
    wp.floors.forEach(floorY => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.2, 0.12),
        windowFrameMat
      );
      frame.position.set(0, groundY + floorY, wp.z);
      school.add(frame);

      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.1),
        windowMat
      );
      glass.position.set(0.02, groundY + floorY, wp.z);
      glass.rotation.y = Math.PI / 2;
      school.add(glass);

      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.018, 0.14),
        concreteMat
      );
      sill.position.set(0.01, groundY + floorY - 0.11, wp.z);
      school.add(sill);
    });
  });

  // Clock tower
  const towerWidth = 0.4;
  const towerHeight = 0.6;

  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, towerHeight, towerWidth),
    wallMat
  );
  tower.position.set(-0.4, groundY + mainBuildingHeight + towerHeight / 2, 0);
  school.add(tower);

  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.32, 4),
    roofMat
  );
  towerRoof.position.set(-0.4, groundY + mainBuildingHeight + towerHeight + 0.16, 0);
  towerRoof.rotation.y = Math.PI / 4;
  school.add(towerRoof);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.03, 0.15, 8),
    goldMat
  );
  spire.position.set(-0.4, groundY + mainBuildingHeight + towerHeight + 0.4, 0);
  school.add(spire);

  // Clock - facing students
  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 128;
  clockCanvas.height = 128;
  const cctx = clockCanvas.getContext('2d')!;
  cctx.fillStyle = '#fff';
  cctx.beginPath();
  cctx.arc(64, 64, 56, 0, Math.PI * 2);
  cctx.fill();
  cctx.strokeStyle = '#8B4513';
  cctx.lineWidth = 5;
  cctx.stroke();
  cctx.fillStyle = '#333';
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const x = 64 + Math.cos(angle) * 42;
    const y = 64 + Math.sin(angle) * 42;
    cctx.beginPath();
    cctx.arc(x, y, i % 3 === 0 ? 4 : 2.5, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.strokeStyle = '#333';
  cctx.lineCap = 'round';
  cctx.lineWidth = 4;
  cctx.beginPath();
  cctx.moveTo(64, 64);
  cctx.lineTo(64 + Math.cos(-60 * Math.PI / 180) * 22, 64 + Math.sin(-60 * Math.PI / 180) * 22);
  cctx.stroke();
  cctx.lineWidth = 2.5;
  cctx.beginPath();
  cctx.moveTo(64, 64);
  cctx.lineTo(64, 28);
  cctx.stroke();
  cctx.fillStyle = '#8B4513';
  cctx.beginPath();
  cctx.arc(64, 64, 4, 0, Math.PI * 2);
  cctx.fill();

  const clockTex = new THREE.CanvasTexture(clockCanvas);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 32),
    new THREE.MeshBasicMaterial({ map: clockTex })
  );
  clock.position.set(-0.25, groundY + mainBuildingHeight + towerHeight / 2 + 0.1, 0);
  clock.rotation.y = -Math.PI / 2;
  school.add(clock);

  // Main roof
  const mainRoof = new THREE.Mesh(
    new THREE.BoxGeometry(mainBuildingDepth + 0.12, 0.08, mainBuildingWidth + 0.12),
    roofMat
  );
  mainRoof.position.set(-0.4, groundY + mainBuildingHeight + 0.04, 0);
  school.add(mainRoof);

  const roofTrim = new THREE.Mesh(
    new THREE.BoxGeometry(mainBuildingDepth + 0.15, 0.04, mainBuildingWidth + 0.15),
    pillarMat
  );
  roofTrim.position.set(-0.4, groundY + mainBuildingHeight, 0);
  school.add(roofTrim);

  // University sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 400;
  signCanvas.height = 80;
  const signCtx = signCanvas.getContext('2d')!;
  signCtx.fillStyle = '#1a5276';
  signCtx.fillRect(0, 0, 400, 80);
  signCtx.strokeStyle = '#ffd700';
  signCtx.lineWidth = 4;
  signCtx.strokeRect(4, 4, 392, 72);
  signCtx.fillStyle = '#ffd700';
  signCtx.font = 'bold 26px Georgia, serif';
  signCtx.textAlign = 'center';
  signCtx.fillText('UNIVERSITY OF', 200, 32);
  signCtx.font = 'bold 22px Georgia, serif';
  signCtx.fillText('DATA STRUCTURES', 200, 60);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.14),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signMesh.position.set(0.18, groundY + entranceHeight + 0.2, 0);
  signMesh.rotation.y = -Math.PI / 2;
  school.add(signMesh);

  // Side wings
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, mainBuildingHeight * 0.85, 0.5),
      wallMat
    );
    wing.position.set(-0.55, groundY + mainBuildingHeight * 0.85 / 2, side * 1.0);
    school.add(wing);

    const wingRoof = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.06, 0.55),
      roofMat
    );
    wingRoof.position.set(-0.55, groundY + mainBuildingHeight * 0.85 + 0.03, side * 1.0);
    school.add(wingRoof);

    [0.35, 0.75, 1.15].forEach(wy => {
      const wingWindow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.11),
        windowMat
      );
      wingWindow.position.set(-0.29, groundY + wy, side * 1.0);
      wingWindow.rotation.y = Math.PI / 2;
      school.add(wingWindow);
    });
  });

  // Philippine Flag - FIXED: properly attached to pole
  const createPhilippineFlag = (posZ: number) => {
    const flagGroup = new THREE.Group();

    const poleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
    
    // Flag pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 1.2, 12),
      poleMat
    );
    pole.position.y = 0.6;
    flagGroup.add(pole);

    // Pole base
    const poleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.08, 12),
      poleMat
    );
    poleBase.position.y = 0.04;
    flagGroup.add(poleBase);

    // Pole top ball
    const poleTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 12, 12),
      goldMat
    );
    poleTop.position.y = 1.22;
    flagGroup.add(poleTop);

    // Philippine Flag canvas
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 200;
    flagCanvas.height = 100;
    const fctx = flagCanvas.getContext('2d')!;

    // Blue stripe (top)
    fctx.fillStyle = '#0038a8';
    fctx.fillRect(0, 0, 200, 50);
    
    // Red stripe (bottom)
    fctx.fillStyle = '#ce1126';
    fctx.fillRect(0, 50, 200, 50);

    // White triangle
    fctx.fillStyle = '#ffffff';
    fctx.beginPath();
    fctx.moveTo(0, 0);
    fctx.lineTo(100, 50);
    fctx.lineTo(0, 100);
    fctx.closePath();
    fctx.fill();

    // Sun
    fctx.fillStyle = '#fcd116';
    const sunX = 33, sunY = 50;
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45) * Math.PI / 180;
      fctx.beginPath();
      fctx.moveTo(sunX, sunY);
      const x1 = sunX + Math.cos(angle - 0.12) * 20;
      const y1 = sunY + Math.sin(angle - 0.12) * 20;
      const x2 = sunX + Math.cos(angle + 0.12) * 20;
      const y2 = sunY + Math.sin(angle + 0.12) * 20;
      fctx.lineTo(x1, y1);
      fctx.lineTo(x2, y2);
      fctx.closePath();
      fctx.fill();
    }
    fctx.beginPath();
    fctx.arc(sunX, sunY, 10, 0, Math.PI * 2);
    fctx.fill();

    // Stars
    const drawStar = (cx: number, cy: number, size: number) => {
      fctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const x = cx + Math.cos(angle) * size;
        const y = cy + Math.sin(angle) * size;
        if (i === 0) fctx.moveTo(x, y);
        else fctx.lineTo(x, y);
        const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
        fctx.lineTo(cx + Math.cos(innerAngle) * (size * 0.4), cy + Math.sin(innerAngle) * (size * 0.4));
      }
      fctx.closePath();
      fctx.fill();
    };
    drawStar(12, 50, 7);
    drawStar(42, 15, 6);
    drawStar(42, 85, 6);

    const flagTex = new THREE.CanvasTexture(flagCanvas);
    
    // Flag with wave effect
    const flagWidth = 0.28;
    const flagHeight = 0.14;
    const flagGeo = new THREE.PlaneGeometry(flagWidth, flagHeight, 8, 1);
    const positions = flagGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      positions.setZ(i, Math.sin((x / flagWidth + 0.5) * Math.PI * 1.5) * 0.012);
    }
    flagGeo.computeVertexNormals();

    const flagMesh = new THREE.Mesh(
      flagGeo,
      new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 })
    );
    // Flag attached to pole - position so left edge is at pole
    flagMesh.position.set(0.02, 1.1, flagWidth / 2);
    flagMesh.rotation.y = -Math.PI / 2;
    flagGroup.add(flagMesh);

    flagGroup.position.set(0.35, groundY, posZ);
    return flagGroup;
  };

  school.add(createPhilippineFlag(0.7));
  school.add(createPhilippineFlag(-0.7));

  // Plaza
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.5),
    new THREE.MeshStandardMaterial({ color: '#d4c4b0', roughness: 0.9, side: THREE.DoubleSide })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.rotation.z = Math.PI / 2;
  plaza.position.set(0.8, groundY - 0.005, 0);
  school.add(plaza);

  const pathLine = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.006, 0.4),
    new THREE.MeshStandardMaterial({ color: '#a89078', roughness: 0.8 })
  );
  pathLine.position.set(0.8, groundY - 0.002, 0);
  school.add(pathLine);

  // Bushes
  const bushMat = new THREE.MeshStandardMaterial({ color: '#228b22', roughness: 0.9 });
  [[-0.5, 0.6], [-0.5, -0.6], [0.22, 0.52], [0.22, -0.52]].forEach(([x, z]) => {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bushMat);
    bush.position.set(x, groundY + 0.06, z);
    bush.scale.y = 0.7;
    school.add(bush);
  });

  // Lamp posts
  const lampMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.6 });
  [0.58, -0.58].forEach(z => {
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 8), lampMat);
    lampPost.position.set(0.55, groundY + 0.25, z);
    school.add(lampPost);

    const lampHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#ffffcc', emissive: '#ffff99', emissiveIntensity: 0.3 })
    );
    lampHead.position.set(0.55, groundY + 0.52, z);
    school.add(lampHead);
  });

  return school;
}
// ==================== CARDBOARD BOX (ONLY LEFT/RIGHT FLAPS) ====================

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

  // Bottom
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(boxW, wallThickness, boxD), cardboardMat);
  bottom.position.y = wallThickness / 2;
  box.add(bottom);

  // Front wall
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, wallThickness), cardboardMat);
  frontWall.position.set(0, wallThickness + boxH / 2, boxD / 2 - wallThickness / 2);
  box.add(frontWall);

  // Back wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, wallThickness), cardboardMat);
  backWall.position.set(0, wallThickness + boxH / 2, -boxD / 2 + wallThickness / 2);
  box.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH, boxD - wallThickness * 2), cardboardMat);
  leftWall.position.set(-boxW / 2 + wallThickness / 2, wallThickness + boxH / 2, 0);
  box.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH, boxD - wallThickness * 2), cardboardMat);
  rightWall.position.set(boxW / 2 - wallThickness / 2, wallThickness + boxH / 2, 0);
  box.add(rightWall);

  // Inner floor
  const innerFloor = new THREE.Mesh(new THREE.BoxGeometry(boxW - wallThickness * 2, 0.005, boxD - wallThickness * 2), innerMat);
  innerFloor.position.y = wallThickness + 0.003;
  box.add(innerFloor);

  // Corner reinforcements
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.02, boxH, 0.02), cornerMat);
    corner.position.set(sx * (boxW / 2 - 0.01), wallThickness + boxH / 2, sz * (boxD / 2 - 0.01));
    box.add(corner);
  });

  const topY = wallThickness + boxH;
  const easedOpen = openAmount < 0.5 ? 2 * openAmount * openAmount : 1 - Math.pow(-2 * openAmount + 2, 2) / 2;
  
  // Two-phase animation:
  // Phase 1 (0 to 0.5): Flaps go UP (from flat to vertical)
  // Phase 2 (0.5 to 1): Flaps fall OUTWARD (past vertical)
  
  let flapAngle = 0;
  
  if (easedOpen <= 0.5) {
    // Phase 1: Go UP (0 to 90 degrees)
    const phase1Progress = easedOpen * 2;
    flapAngle = phase1Progress * (Math.PI / 2);
  } else {
    // Phase 2: Fall OUTWARD (90 to 135 degrees)
    const phase2Progress = (easedOpen - 0.5) * 2;
    flapAngle = (Math.PI / 2) + phase2Progress * (Math.PI / 4);
  }

  // Flap dimensions - each flap covers half the top
  const flapWidth = (boxW - wallThickness * 2) / 2;
  const flapDepth = boxD - wallThickness * 2;

  // LEFT FLAP - pivots from LEFT EDGE, opens UP then falls OUTWARD (to the left)
  const leftFlapPivot = new THREE.Group();
  leftFlapPivot.position.set(-boxW / 2 + wallThickness, topY, 0); // Pivot at LEFT edge
  
  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(flapWidth, flapThickness, flapDepth), flapMat);
  leftFlap.position.set(flapWidth / 2, 0, 0); // Flap extends INWARD (toward center)
  leftFlapPivot.add(leftFlap);
  
  // Rotate: positive Z = flap goes UP then falls LEFT (outward)
  leftFlapPivot.rotation.z = flapAngle;
  box.add(leftFlapPivot);

  // RIGHT FLAP - pivots from RIGHT EDGE, opens UP then falls OUTWARD (to the right)
  const rightFlapPivot = new THREE.Group();
  rightFlapPivot.position.set(boxW / 2 - wallThickness, topY, 0); // Pivot at RIGHT edge
  
  const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(flapWidth, flapThickness, flapDepth), flapMat);
  rightFlap.position.set(-flapWidth / 2, 0, 0); // Flap extends INWARD (toward center)
  rightFlapPivot.add(rightFlap);
  
  // Rotate: negative Z = flap goes UP then falls RIGHT (outward)
  rightFlapPivot.rotation.z = -flapAngle;
  box.add(rightFlapPivot);

  // Tape in the middle (only when closed) - vertical |
  if (openAmount < 0.1) {
    const tapeWidth = 0.06;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(tapeWidth, 0.004, flapDepth * 0.9), tapeMat);
    tape.position.set(0, topY + flapThickness + 0.002, 0);
    box.add(tape);
  }

  // Label on front
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
  labelCtx.fillText(label, 90, 75);
  labelCtx.fillStyle = '#666';
  labelCtx.font = '12px Arial';
  labelCtx.fillText('HANDLE WITH CARE', 90, 100);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshBasicMaterial({ map: labelTex }));
  labelMesh.position.set(0, wallThickness + boxH / 2, boxD / 2 + 0.001);
  box.add(labelMesh);

  // Highlight glow
  if (isHighlighted && openAmount < 0.1) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.04, boxH + 0.1, boxD + 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    glow.position.y = wallThickness + boxH / 2;
    box.add(glow);
  }

  return box;
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
  // Disable ALL highlighting during tutorial or animation
  if (tutorialText || (animPhase && animPhase !== '')) {
    highlightIndex = null;
    highlightIndex2 = null;
  }
  const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 1.0 : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;
  const groundY = 0;

  if (tutorialText) {
    let textY = 1.2;
    if (structure === 'stack') {
      textY = 1.8;
    } else if (structure === 'array' && environment === 'grocery') {
      textY = 1.6;
    }
    
    const textBox = create3DTextBox(
      tutorialText.title,
      tutorialText.description,
      tutorialText.step,
      new THREE.Vector3(0, textY, 0)
    );
    group.add(textBox);
  }

  // ==================== ARRAY ====================
  if (structure === 'array') {
    if (environment === 'grocery') {
      const itemsPerRow = 4;
      const rowSpacing = 0.55;
      const itemSpacing = 0.38;
      
      const numRows = Math.max(2, Math.ceil(data.length / itemsPerRow));
      const shelfWidth = itemsPerRow * itemSpacing + 0.4;
      
      const metalMat = new THREE.MeshStandardMaterial({ color: '#666666', metalness: 0.8, roughness: 0.3 });
      const shelfBoardMat = new THREE.MeshStandardMaterial({ color: '#d0d0d0', metalness: 0.3, roughness: 0.5 });
      
      [-shelfWidth/2 - 0.05, shelfWidth/2 + 0.05].forEach(x => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, numRows * rowSpacing + 0.3, 0.04), metalMat);
        post.position.set(x, (numRows * rowSpacing) / 2 - 0.1, -0.15);
        group.add(post);
        
        const postFront = new THREE.Mesh(new THREE.BoxGeometry(0.04, numRows * rowSpacing + 0.3, 0.04), metalMat);
        postFront.position.set(x, (numRows * rowSpacing) / 2 - 0.1, 0.15);
        group.add(postFront);
      });
      
      const backPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 0.2, numRows * rowSpacing + 0.4),
        new THREE.MeshStandardMaterial({ color: '#f5f5f5', side: THREE.DoubleSide, roughness: 0.9 })
      );
      backPanel.position.set(0, (numRows * rowSpacing) / 2, -0.18);
      group.add(backPanel);
      
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 1, 1.5),
        new THREE.MeshStandardMaterial({ color: '#e0e0e0', side: THREE.DoubleSide, roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = groundY - 0.02;
      group.add(floor);
      
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 200;
      signCanvas.height = 60;
      const signCtx = signCanvas.getContext('2d')!;
      signCtx.fillStyle = '#e74c3c';
      signCtx.fillRect(0, 0, 200, 60);
      signCtx.fillStyle = '#fff';
      signCtx.font = 'bold 24px Arial';
      signCtx.textAlign = 'center';
      signCtx.fillText('🛒 CEREALS', 100, 40);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.15), new THREE.MeshBasicMaterial({ map: signTex }));
      signMesh.position.set(0, numRows * rowSpacing + 0.25, -0.15);
      group.add(signMesh);
      
      for (let row = 0; row < numRows; row++) {
        const shelfY = groundY + 0.08 + row * rowSpacing;
        
        const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.02, 0.35), shelfBoardMat);
        shelfBoard.position.set(0, shelfY, 0);
        group.add(shelfBoard);
        
        const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), metalMat);
        lip.position.set(0, shelfY + 0.02, 0.17);
        group.add(lip);
        
        const priceRail = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth - 0.1, 0.025, 0.008), new THREE.MeshStandardMaterial({ color: '#333333' }));
        priceRail.position.set(0, shelfY + 0.035, 0.175);
        group.add(priceRail);
        
        const rowStartIdx = row * itemsPerRow;
        const rowItems = data.slice(rowStartIdx, rowStartIdx + itemsPerRow);
        
        rowItems.forEach((item, i) => {
          const actualIndex = rowStartIdx + i;
          const isHl = highlightIndex === actualIndex || highlightIndex2 === actualIndex;
          const itemX = -((itemsPerRow - 1) * itemSpacing) / 2 + i * itemSpacing;
          
          const cerealLabels = ['Coco Crunch', 'Corn Flakes', 'Froot Loops', 'Cheerios', 'Frosted', 'Granola'];
          const product = createGroceryBox(item.color, cerealLabels[actualIndex % cerealLabels.length] || item.label, isHl);
          product.position.set(itemX, shelfY + 0.08, 0);
          if (isHl) product.position.y += 0.06;
          applyItemAnimation(product, actualIndex, animPhase || '', animData || {}, 'array', animProgress);
          group.add(product);

          const idx = createTextSprite(`[${actualIndex}]`, isHl ? '#ffff00' : '#ffffff', 18);
          idx.position.set(itemX, shelfY - 0.08, 0.2);
          idx.scale.set(0.22, 0.11, 1);
          group.add(idx);
        });
      }

    } else if (environment === 'classroom') {
      const roomWidth = Math.max(2.5, data.length * spacing + 1.5);
      const roomDepth = 2.2;
      const roomHeight = 1.2;
      const floorY = groundY - 0.25;
      const scale = 0.7;

      const floorMat = new THREE.MeshStandardMaterial({ color: '#c4a882', roughness: 0.7 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = floorY;
      group.add(floor);

      const wallMat = new THREE.MeshStandardMaterial({ color: '#f5f0e6', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
      backWall.position.set(0, floorY + roomHeight / 2, -roomDepth / 2);
      group.add(backWall);

      const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
      leftWall.rotation.y = Math.PI / 2;
      leftWall.position.set(-roomWidth / 2, floorY + roomHeight / 2, 0);
      group.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, roomHeight), wallMat);
      rightWall.rotation.y = -Math.PI / 2;
      rightWall.position.set(roomWidth / 2, floorY + roomHeight / 2, 0);
      group.add(rightWall);

      const boardWidth = roomWidth * 0.6;
      const boardHeight = 0.45;
      
      // Board frame (3D box)
      const frameMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 });
      const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + 0.06, boardHeight + 0.06, 0.03), frameMat);
      boardFrame.position.set(0, floorY + 0.7, -roomDepth / 2 + 0.02);
      group.add(boardFrame);
      
      // Plain white board (3D box - not image)
      const whiteBoardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const whiteBoard = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, boardHeight, 0.02), whiteBoardMat);
      whiteBoard.position.set(0, floorY + 0.7, -roomDepth / 2 + 0.04);
      group.add(whiteBoard);

      // Board tray
      const trayMat = new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.5 });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(boardWidth * 0.4, 0.02, 0.05), trayMat);
      tray.position.set(0, floorY + 0.45, -roomDepth / 2 + 0.05);
      group.add(tray);

      // Clock
      const clockCanvas = document.createElement('canvas');
      clockCanvas.width = 64;
      clockCanvas.height = 64;
      const cctx = clockCanvas.getContext('2d')!;
      cctx.fillStyle = '#fff';
      cctx.beginPath();
      cctx.arc(32, 32, 28, 0, Math.PI * 2);
      cctx.fill();
      cctx.strokeStyle = '#333';
      cctx.lineWidth = 3;
      cctx.stroke();
      cctx.beginPath();
      cctx.moveTo(32, 32);
      cctx.lineTo(32, 12);
      cctx.moveTo(32, 32);
      cctx.lineTo(45, 32);
      cctx.stroke();
      const clockTex = new THREE.CanvasTexture(clockCanvas);
      const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: clockTex }));
      clock.position.set(roomWidth / 2 - 0.15, floorY + 0.9, -roomDepth / 2 + 0.02);
      group.add(clock);

      const studentsPerRow = 3;
      const rowSpacing = 0.5;
      const colSpacing = 0.65;

      data.forEach((item, i) => {
        const row = Math.floor(i / studentsPerRow);
        const col = i % studentsPerRow;
        const isHl = highlightIndex === i || highlightIndex2 === i;
        
        const rowItemCount = Math.min(studentsPerRow, data.length - row * studentsPerRow);
        const rowStartX = -((rowItemCount - 1) * colSpacing) / 2;
        const posX = rowStartX + col * colSpacing;
        const posZ = -0.5 + row * rowSpacing; // Students closer to whiteboard (back)

        const chair = createChair(0);
        chair.position.set(posX, floorY + 0.25, posZ);
        chair.scale.setScalar(scale);
        group.add(chair);

        const desk = createDesk(0);
        desk.position.set(posX, floorY + 0.28, posZ + 0.25);
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
        human.position.set(posX, floorY + 0.25, posZ);
        human.scale.setScalar(scale);
        applyItemAnimation(human, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(human);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 20);
        idx.position.set(posX, floorY - 0.06, posZ + 0.3);
        idx.scale.set(0.22, 0.11, 1);
        group.add(idx);
      });

       } else if (environment === 'todo') {
      const floorY = groundY - 0.25;
      const scale = 0.65;
      const deskSpacing = 0.55;
      const numDesks = Math.max(4, data.length);
      const rowStartX = -((numDesks - 1) * deskSpacing) / 2;

      const floorMat = new THREE.MeshStandardMaterial({ color: '#c4a882', roughness: 0.7 });
      const floorWidth = Math.max(2.5, numDesks * deskSpacing + 1);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, 1.2), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = floorY;
      group.add(floor);

      const wallMat = new THREE.MeshStandardMaterial({ color: '#f5f0e6', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, 0.9), wallMat);
      backWall.position.set(0, floorY + 0.45, -0.6);
      group.add(backWall);

      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 300;
      boardCanvas.height = 100;
      const bctx = boardCanvas.getContext('2d')!;
      bctx.fillStyle = '#e74c3c';
      bctx.fillRect(0, 0, 300, 100);
      bctx.fillStyle = '#fff';
      bctx.font = 'bold 28px Arial';
      bctx.textAlign = 'center';
      bctx.fillText('📝 TO-DO LIST', 150, 40);
      bctx.font = '18px Arial';
      bctx.fillText(`Tasks: ${data.length}`, 150, 75);
      const boardTex = new THREE.CanvasTexture(boardCanvas);
      const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.17), new THREE.MeshBasicMaterial({ map: boardTex }));
      boardMesh.position.set(0, floorY + 0.65, -0.59);
      group.add(boardMesh);

      for (let i = 0; i < numDesks; i++) {
        const posX = rowStartX + i * deskSpacing;

        const desk = createDesk(0);
        desk.position.set(posX, floorY + 0.28, 0);
        desk.scale.setScalar(scale);
        group.add(desk);

        const idx = createTextSprite(`[${i}]`, i < data.length ? '#ffffff' : '#555555', 16);
        idx.position.set(posX, floorY + 0.08, 0.2);
        idx.scale.set(0.18, 0.09, 1);
        group.add(idx);
      }

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const posX = rowStartX + i * deskSpacing;

        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(posX, floorY + 0.38, 0);
        clipboard.scale.setScalar(0.35);
        clipboard.rotation.x = -0.3;
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(clipboard);

        if (isHl) {
          const hlIdx = createTextSprite(`[${i}]`, '#ffff00', 18);
          hlIdx.position.set(posX, floorY + 0.08, 0.2);
          hlIdx.scale.set(0.2, 0.1, 1);
          group.add(hlIdx);
        }
      });
    }
  // ==================== LINKED LIST ====================
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      const arrowY = 0.14;

      // Train Station at the back
      const station = new THREE.Group();
      
      // Platform
      const platformMat = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.8 });
      const platform = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, data.length * spacing + 2), 0.15, 0.8), platformMat);
      platform.position.set(0, -0.02, -0.7);
      station.add(platform);

      // Platform edge (yellow safety line)
      const safetyMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 });
      const safetyLine = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, data.length * spacing + 2), 0.02, 0.08), safetyMat);
      safetyLine.position.set(0, 0.06, -0.32);
      station.add(safetyLine);

      // Station roof pillars
      const pillarMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.5, roughness: 0.4 });
      const pillarPositions = [-1.2, -0.4, 0.4, 1.2];
      pillarPositions.forEach(x => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), pillarMat);
        pillar.position.set(x, 0.35, -0.9);
        station.add(pillar);
      });

      // Station roof
      const roofMat = new THREE.MeshStandardMaterial({ color: '#34495e', metalness: 0.3, roughness: 0.5 });
      const stationRoof = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3.2, data.length * spacing + 2.2), 0.08, 1.0), roofMat);
      stationRoof.position.set(0, 0.78, -0.8);
      station.add(stationRoof);

      // Roof overhang (front)
      const overhang = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3.2, data.length * spacing + 2.2), 0.03, 0.3), roofMat);
      overhang.position.set(0, 0.72, -0.35);
      station.add(overhang);

      // Station back wall
      const backWallMat = new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 0.7 });
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, data.length * spacing + 2), 0.7, 0.05), backWallMat);
      backWall.position.set(0, 0.4, -1.1);
      station.add(backWall);

      // Station sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 300;
      signCanvas.height = 60;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#2c3e50';
      sctx.fillRect(0, 0, 300, 60);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 28px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🚄 LINKED LIST STATION', 150, 40);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.16), new THREE.MeshBasicMaterial({ map: signTex }));
      sign.position.set(0, 0.55, -1.07);
      station.add(sign);

      // Benches on platform
      const benchMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
      [-0.8, 0.8].forEach(x => {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.12), benchMat);
        seat.position.set(x, 0.15, -0.85);
        station.add(seat);
        [-0.12, 0.12].forEach(lx => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.1), benchMat);
          leg.position.set(x + lx, 0.1, -0.85);
          station.add(leg);
        });
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.02), benchMat);
        back.position.set(x, 0.24, -0.9);
        station.add(back);
      });

      // Information display board
      const displayMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.3 });
      const display = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.03), displayMat);
      display.position.set(0, 0.35, -1.07);
      station.add(display);

      // Display screen content
      const displayCanvas = document.createElement('canvas');
      displayCanvas.width = 200;
      displayCanvas.height = 120;
      const dctx = displayCanvas.getContext('2d')!;
      dctx.fillStyle = '#000';
      dctx.fillRect(0, 0, 200, 120);
      dctx.fillStyle = '#00ff00';
      dctx.font = 'bold 14px monospace';
      dctx.fillText('NEXT TRAIN', 10, 25);
      dctx.fillStyle = '#fff';
      dctx.font = '12px monospace';
      dctx.fillText(`Cars: ${data.length}`, 10, 50);
      dctx.fillText('Status: BOARDING', 10, 70);
      dctx.fillStyle = '#f1c40f';
      dctx.fillText('▶ Platform 1', 10, 95);
      const displayTex = new THREE.CanvasTexture(displayCanvas);
      const displayScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.21), new THREE.MeshBasicMaterial({ map: displayTex }));
      displayScreen.position.set(0, 0.35, -1.05);
      station.add(displayScreen);

      // Clock on platform
      const clockCanvas = document.createElement('canvas');
      clockCanvas.width = 64;
      clockCanvas.height = 64;
      const cctx = clockCanvas.getContext('2d')!;
      cctx.fillStyle = '#fff';
      cctx.beginPath();
      cctx.arc(32, 32, 28, 0, Math.PI * 2);
      cctx.fill();
      cctx.strokeStyle = '#333';
      cctx.lineWidth = 3;
      cctx.stroke();
      cctx.beginPath();
      cctx.moveTo(32, 32);
      cctx.lineTo(32, 12);
      cctx.moveTo(32, 32);
      cctx.lineTo(45, 32);
      cctx.stroke();
      const clockTex = new THREE.CanvasTexture(clockCanvas);
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), new THREE.MeshBasicMaterial({ map: clockTex }));
      clock.position.set(-1.0, 0.55, -1.07);
      station.add(clock);

      // Vending machine
      const vendingMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
      const vending = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.12), vendingMat);
      vending.position.set(1.3, 0.22, -0.9);
      station.add(vending);
      
      const vendScreen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.01), new THREE.MeshBasicMaterial({ color: '#87ceeb' }));
      vendScreen.position.set(1.3, 0.28, -0.83);
      station.add(vendScreen);

      group.add(station);

      // Train cars
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

      // Arrows between cars
      for (let i = 0; i < data.length - 1; i++) {
        const arrow = create3DArrow(startX + i * spacing, startX + (i + 1) * spacing, arrowY, false);
        group.add(arrow);
      }

      // NULL at the end
      if (data.length > 0) {
        const nullSprite = createTextSprite('NULL', '#ff0000', 22);
        nullSprite.position.set(startX + (data.length - 1) * spacing + spacing * 0.7, 0.14, 0);
        nullSprite.scale.set(0.32, 0.22, 1);
        group.add(nullSprite);

        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + (data.length - 1) * spacing + spacing * 0.7, arrowY, false);
        group.add(lastArrow);
      }

      // Modern rails
      const railMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8, roughness: 0.2 });
      [-0.11, 0.11].forEach(z => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2.5, data.length * spacing + 2), 0.025, 0.03), railMat);
        rail.position.set(0, -0.08, z);
        group.add(rail);
      });

      // Rail ties
      const tieMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.8 });
      const numTies = Math.max(10, Math.floor(data.length * spacing / 0.15));
      const tieStart = -Math.max(1.2, data.length * spacing / 2 + 0.5);
      for (let i = 0; i < numTies; i++) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.35), tieMat);
        tie.position.set(tieStart + i * 0.25, -0.09, 0);
        group.add(tie);
      }

      // Ground/gravel
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(3.5, data.length * spacing + 2.5), 1.8),
        new THREE.MeshStandardMaterial({ color: '#6b6b6b', side: THREE.DoubleSide, roughness: 0.9 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.1;
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
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
          group.add(human);
        }

        if (i < data.length - 1) {
          const arrow = create3DArrow(startX + i * spacing, startX + (i + 1) * spacing, arrowY, false);
          group.add(arrow);
        }
      });

      if (data.length > 0) {
        const nullSprite = createTextSprite('NULL', '#ff0000', 20);
        nullSprite.position.set(startX + data.length * spacing, 0.12, 0);
        nullSprite.scale.set(0.28, 0.18, 1);
        group.add(nullSprite);

        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing, arrowY, false);
        group.add(lastArrow);
      }

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(2, data.length * spacing + 2), 0.55),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.16;
      group.add(floor);

    } else if (environment === 'domino') {
      const arrowY = 0;

      // Casino table
      const tableGroup = new THREE.Group();

      // Main table (oval shape using stretched cylinder)
      const feltMat = new THREE.MeshStandardMaterial({ color: '#0d5c2e', roughness: 0.9 });
      const tableTop = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.05, 32),
        feltMat
      );
      tableTop.position.y = -0.28;
      tableTop.scale.set(Math.max(1.5, data.length * spacing / 2 + 0.8), 1, 0.6);
      tableGroup.add(tableTop);

      // Table edge (wood trim)
      const woodMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.6, metalness: 0.1 });
      const tableEdge = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.04, 8, 32),
        woodMat
      );
      tableEdge.position.y = -0.26;
      tableEdge.rotation.x = Math.PI / 2;
      tableEdge.scale.set(Math.max(1.5, data.length * spacing / 2 + 0.8), 0.6, 1);
      tableGroup.add(tableEdge);

      // Inner gold trim
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8, roughness: 0.3 });
      const innerTrim = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.015, 8, 32),
        goldTrimMat
      );
      innerTrim.position.y = -0.25;
      innerTrim.rotation.x = Math.PI / 2;
      innerTrim.scale.set(Math.max(1.4, data.length * spacing / 2 + 0.7), 0.55, 1);
      tableGroup.add(innerTrim);

      // Table legs
      const legMat = new THREE.MeshStandardMaterial({ color: '#3d2510', roughness: 0.5 });
      [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 12), legMat);
        leg.position.set(x * Math.max(1.3, data.length * spacing / 2 + 0.5), -0.45, z * 0.5);
        tableGroup.add(leg);
      });

      // Felt pattern lines
      const linesMat = new THREE.MeshBasicMaterial({ color: '#0a4a24' });
      for (let i = -3; i <= 3; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.001, 0.5), linesMat);
        line.position.set(i * 0.3, -0.254, 0);
        tableGroup.add(line);
      }

      // Casino chips stacks (decoration)
      const chipColors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
      [[-1.0, -0.2], [-1.0, 0.2], [1.0, -0.2], [1.0, 0.2]].forEach(([x, z], idx) => {
        const stackHeight = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < stackHeight; i++) {
          const chipMat = new THREE.MeshStandardMaterial({ 
            color: chipColors[(idx + i) % chipColors.length], 
            metalness: 0.3, 
            roughness: 0.5 
          });
          const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), chipMat);
          chip.position.set(
            x * Math.max(1.2, data.length * spacing / 2 + 0.4), 
            -0.24 + i * 0.013, 
            z * 0.4
          );
          tableGroup.add(chip);

          // Chip edge detail
          const edgeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.2 });
          const edge = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.003, 4, 16), edgeMat);
          edge.rotation.x = Math.PI / 2;
          edge.position.set(
            x * Math.max(1.2, data.length * spacing / 2 + 0.4), 
            -0.24 + i * 0.013, 
            z * 0.4
          );
          tableGroup.add(edge);
        }
      });

      // Dealer area marker
      const dealerMat = new THREE.MeshBasicMaterial({ color: '#0a4a24' });
      const dealerArea = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 32), dealerMat);
      dealerArea.rotation.x = -Math.PI / 2;
      dealerArea.position.set(0, -0.252, -0.35);
      tableGroup.add(dealerArea);

      // "DEALER" text
      const dealerCanvas = document.createElement('canvas');
      dealerCanvas.width = 100;
      dealerCanvas.height = 30;
      const dctx = dealerCanvas.getContext('2d')!;
      dctx.fillStyle = '#d4af37';
      dctx.font = 'bold 18px serif';
      dctx.textAlign = 'center';
      dctx.fillText('DEALER', 50, 22);
      const dealerTex = new THREE.CanvasTexture(dealerCanvas);
      const dealerLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.06),
        new THREE.MeshBasicMaterial({ map: dealerTex, transparent: true })
      );
      dealerLabel.rotation.x = -Math.PI / 2;
      dealerLabel.position.set(0, -0.251, -0.38);
      tableGroup.add(dealerLabel);

      // Card shoe (where cards come from)
      const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 });
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.1), shoeMat);
      shoe.position.set(-0.9 * Math.max(1.2, data.length * spacing / 2 + 0.3), -0.21, -0.25);
      tableGroup.add(shoe);

      // Cards in shoe
      const cardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      for (let i = 0; i < 5; i++) {
        const card = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.001, 0.08), cardMat);
        card.position.set(
          -0.9 * Math.max(1.2, data.length * spacing / 2 + 0.3) - 0.02 + i * 0.012, 
          -0.17 + i * 0.003, 
          -0.25
        );
        card.rotation.z = 0.1;
        tableGroup.add(card);
      }

      // Discard tray
      const trayMat = new THREE.MeshStandardMaterial({ color: '#8b0000', roughness: 0.5 });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.08), trayMat);
      tray.position.set(0.9 * Math.max(1.2, data.length * spacing / 2 + 0.3), -0.235, -0.25);
      tableGroup.add(tray);

      // Casino sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 200;
      signCanvas.height = 60;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#1a1a2e';
      sctx.fillRect(0, 0, 200, 60);
      sctx.strokeStyle = '#d4af37';
      sctx.lineWidth = 3;
      sctx.strokeRect(3, 3, 194, 54);
      sctx.fillStyle = '#d4af37';
      sctx.font = 'bold 22px serif';
      sctx.textAlign = 'center';
      sctx.fillText('♠ LINKED LIST ♣', 100, 28);
      sctx.font = '14px serif';
      sctx.fillText('♥ CASINO ♦', 100, 48);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.15),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signMesh.position.set(0, 0.3, -0.5);
      tableGroup.add(signMesh);

      // Ambient lights (decorative spheres)
      const lightMat = new THREE.MeshStandardMaterial({ 
        color: '#ffff99', 
        emissive: '#ffff66', 
        emissiveIntensity: 0.5 
      });
      [-0.6, 0.6].forEach(x => {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), lightMat);
        light.position.set(x * Math.max(1.3, data.length * spacing / 2 + 0.5), 0.25, -0.45);
        tableGroup.add(light);

        // Light pole
        const poleMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), poleMat);
        pole.position.set(x * Math.max(1.3, data.length * spacing / 2 + 0.5), 0, -0.45);
        tableGroup.add(pole);
      });

      group.add(tableGroup);

      // Dominoes
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

      // NULL at the end
      if (data.length > 0) {
        const nullSprite = createTextSprite('NULL', '#ff0000', 20);
        nullSprite.position.set(startX + data.length * spacing, 0, 0);
        nullSprite.scale.set(0.28, 0.18, 1);
        group.add(nullSprite);

        const lastArrow = create3DArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing, arrowY, false);
        group.add(lastArrow);
      }

      // Floor under table (carpet)
      const carpetMat = new THREE.MeshStandardMaterial({ color: '#8b0000', roughness: 0.95 });
      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(4, data.length * spacing + 3), 2),
        carpetMat
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.y = -0.63;
      group.add(carpet);
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
      const plateThickness = 0.02;
      const plateRadius = 0.18;
      const plateGap = 0.003;
      const baseY = groundY - 0.1;

      const standMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.6, roughness: 0.4 });
      
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.04, 32), standMat);
      base.position.y = baseY;
      group.add(base);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16), standMat);
      pole.position.y = baseY + 0.07;
      group.add(pole);

      const springBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 32), standMat);
      springBase.position.y = baseY + 0.12;
      group.add(springBase);

      const counterMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.3, roughness: 0.5 });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), counterMat);
      counter.position.y = baseY - 0.05;
      group.add(counter);

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const plateY = baseY + 0.14 + i * (plateThickness + plateGap);
        const plateGroup = new THREE.Group();
        
        const plateMat = new THREE.MeshStandardMaterial({
          color: '#ffffff',
          roughness: 0.2,
          metalness: 0.05,
          emissive: isHl ? '#ffff00' : '#000',
          emissiveIntensity: isHl ? 0.3 : 0
        });
        
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(plateRadius, plateRadius - 0.01, plateThickness, 32), plateMat);
        plateGroup.add(plate);

        const rimMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.3 });
        const rim = new THREE.Mesh(new THREE.TorusGeometry(plateRadius - 0.005, 0.005, 8, 32), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = plateThickness / 2;
        plateGroup.add(rim);
        
        let animY = 0;
        let animScale = 1;
        
        if (isTop && animPhase === 'stack-pop-lift') {
          animY = 0.15 * (animProgress || 0);
        } else if (isTop && animPhase === 'stack-pop-fly') {
          const p = animProgress || 0;
          animY = 0.15 + 0.4 * p;
          animScale = Math.max(0.01, 1 - p);
          plateGroup.rotation.z = p * 2;
        } else if (isTop && animPhase === 'stack-peek-lift') {
          animY = 0.1 * (animProgress || 0);
        } else if (isTop && animPhase === 'stack-push-drop') {
          animY = 0.35 * (1 - (animProgress || 0));
          animScale = 0.7 + 0.3 * (animProgress || 0);
        } else if (isTop && animPhase === 'stack-push-settle') {
          animY = 0.05 * (1 - (animProgress || 0));
        }
        
        plateGroup.position.y = plateY + animY;
        plateGroup.scale.setScalar(animScale);
        
        if (isHl && animPhase !== 'stack-pop-fly') {
          const glow = new THREE.Mesh(
            new THREE.CylinderGeometry(plateRadius + 0.02, plateRadius + 0.02, plateThickness + 0.01, 32),
            new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })
          );
          plateGroup.add(glow);
        }
        
        group.add(plateGroup);
      });

      if (data.length > 0) {
        const topY = baseY + 0.14 + (data.length - 1) * (plateThickness + plateGap) + 0.06;
        const topSprite = createTextSprite('← TOP', '#ff0000', 20);
        topSprite.position.set(0.4, topY, 0);
        topSprite.scale.set(0.3, 0.1, 1);
        group.add(topSprite);
      }

    } else if (environment === 'boxes') {
      const boxSpacing = 0.36;
      const boxBaseY = 0;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;

        let openAmount = 0;
        if (isTop) {
          if (animPhase === 'stack-peek-open') {
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
    let gateOpenAmount = 0;
    if (animPhase === 'queue-dequeue-gate-open') {
      gateOpenAmount = animProgress || 0;
    } else if (animPhase === 'queue-dequeue-drive') {
      gateOpenAmount = 1;
    } else if (animPhase === 'queue-dequeue-gate-close') {
      gateOpenAmount = 1 - (animProgress || 0);
    }

    if (environment === 'tollgate') {
      const tollBooth = createTollBooth(gateOpenAmount);
      tollBooth.position.set(startX - 0.3, groundY, 0);
      tollBooth.scale.setScalar(0.85);
      group.add(tollBooth);

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isFront = i === 0;
        
        let extraX = 0;
        let carScale = 0.78;
        let shouldRender = true;

        if (isFront) {
          if (animPhase === 'queue-dequeue-drive') {
            const progress = animProgress || 0;
            extraX = -progress * 2.5;
          } else if (animPhase === 'queue-dequeue-gate-close') {
            extraX = -2.5;
            carScale = 0.78 * Math.max(0.01, 1 - (animProgress || 0));
            if ((animProgress || 0) > 0.5) shouldRender = false;
          }
        } else {
          if (animPhase === 'queue-dequeue-gate-open') {
            const progress = animProgress || 0;
            extraX = -progress * spacing * 0.3;
          } else if (animPhase === 'queue-dequeue-drive') {
            const progress = animProgress || 0;
            extraX = -spacing * 0.3 - progress * spacing * 0.7;
          } else if (animPhase === 'queue-dequeue-gate-close') {
            extraX = -spacing;
          }
        }

        if (shouldRender) {
          const carObj = createCar(item.color, item.label, isHl);
          carObj.position.set(startX + i * spacing + 0.5 + extraX, groundY + (isHl ? 0.06 : 0), 0);
          carObj.scale.setScalar(carScale);
          
          if (!animPhase?.startsWith('queue-dequeue')) {
            applyItemAnimation(carObj, i, animPhase || '', animData || {}, 'queue', animProgress);
          }
          
          group.add(carObj);
        }
      });

      if (data.length > 0) {
        const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
        frontSprite.position.set(startX + 0.5, groundY - 0.22, 0);
        frontSprite.scale.set(0.28, 0.1, 1);
        group.add(frontSprite);

        const rearSprite = createTextSprite('REAR', '#ff6600', 18);
        rearSprite.position.set(startX + (data.length - 1) * spacing + 0.5, groundY - 0.22, 0);
        rearSprite.scale.set(0.28, 0.1, 1);
        group.add(rearSprite);
      }

      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(3, data.length * spacing + 3.0), 0.7),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = groundY - 0.01;
      group.add(road);

    } else if (environment === 'tickets') {
      const ticketDispenserGroup = createTicketDispenser(data, highlightIndex, animPhase || '', animProgress || 0);
      group.add(ticketDispenserGroup);

    } else if (environment === 'students') {
      const schoolBuilding = createSchoolBuilding();
      schoolBuilding.position.set(startX - 0.8, groundY, 0);
      schoolBuilding.scale.setScalar(0.5);
      schoolBuilding.rotation.y = 0;
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
          } else {
            if (animPhase === 'queue-dequeue-walk') {
              const progress = animProgress || 0;
              walkPhase = progress * Math.PI * 6;
              extraX = -progress * spacing * 0.5;
            } else if (animPhase === 'queue-dequeue-enter') {
              const progress = animProgress || 0;
              walkPhase = Math.PI * 6 + progress * Math.PI * 4;
              extraX = -spacing * 0.5 - progress * spacing * 0.5;
            }
          }

          if (shouldRender) {
            const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
            human.position.set(startX + i * spacing + 0.6 + extraX, groundY, 0);
            human.scale.setScalar(studentScale);
            human.rotation.y = -Math.PI / 2;
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
        new THREE.PlaneGeometry(Math.max(2.5, data.length * spacing + 2.5), 0.5),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.set(0.3, groundY - 0.01, 0);
      group.add(pathway);
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

  const runTutorialStep = async (step: TutorialStep) => {
    setStepAnimating(true);
    setTutorialText({ title: step.title, description: step.description, step: `${currentStepIndex + 1}/${tutorialSteps.length}` });
    
    if (step.highlightIndex !== undefined) {
      setHighlightIndex(step.highlightIndex);
    } else {
      setHighlightIndex(null);
    }
    if (step.highlightIndex2 !== undefined) {
      setHighlightIndex2(step.highlightIndex2);
    } else {
      setHighlightIndex2(null);
    }
    
    if (step.animPhase && step.animDuration) {
      await smoothAnimate(step.animDuration, step.animPhase, { index: step.highlightIndex, index1: step.highlightIndex, index2: step.highlightIndex2 });
    } else {
      // Clear animation state when step has no animation
      setAnimPhase('');
      setAnimData({});
      setAnimProgress(1);
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

  // ==================== ARRAY TUTORIALS ====================

  const arrayAppendTutorial = () => {
    if (isAnimating || tutorialActive || getArrayData().length >= 8) return;
    
    const data = getArrayData();
    const newIndex = data.length;
    const newItem = generateNewItem();
    
    const steps: TutorialStep[] = [
      { title: "➕ Append to End", description: `Adding "${newItem.label}" to the END.\n\nCurrent length: ${data.length}\nNew element at: [${newIndex}]` },
      { title: "📍 Direct Placement", description: `No shifting needed!\n\narray[${newIndex}] = "${newItem.label}"\nlength = ${newIndex + 1}`, highlightIndex: newIndex,
        action: () => { (setArrayData as any)((prev: DataItem[]) => [...prev, newItem]); } },
      { title: "⚡ Placing...", description: `Placing element at end...`, highlightIndex: newIndex, animPhase: 'insert-drop', animDuration: 600 },
      { title: "✅ Appended!", description: `"${newItem.label}" added!\n\nTime: O(1) - Constant!\nNo shifting needed.`, highlightIndex: newIndex, animPhase: 'insert-settle', animDuration: 400 },
    ];
    startTutorial(steps);
  };

  const arrayInsertTutorial = (insertIndex: number) => {
    const data = getArrayData();
    const newItem = generateNewItem();
    
    const steps: TutorialStep[] = [
      { title: "➕ Array Insert", description: `Inserting at index [${insertIndex}].\n\nMust shift elements first!` },
    ];

    for (let i = data.length - 1; i >= insertIndex; i--) {
      steps.push({ title: `↗️ Shift [${i}] → [${i + 1}]`, description: `Moving element right`, highlightIndex: i, animPhase: 'access-lift', animDuration: 250 });
    }

    steps.push(
      { title: "📦 Place Element", description: `array[${insertIndex}] = "${newItem.label}"`, highlightIndex: insertIndex, animPhase: 'insert-drop', animDuration: 600,
        action: () => { (setArrayData as any)((prev: DataItem[]) => { const arr = [...prev]; arr.splice(insertIndex, 0, newItem); return arr; }); } },
      { title: "✅ Inserted!", description: `Done! Time: O(n)`, highlightIndex: insertIndex, animPhase: 'insert-settle', animDuration: 400 },
    );
    startTutorial(steps);
  };

  const arrayDeleteTutorial = (deleteIndex: number) => {
    const data = getArrayData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Cannot Delete!", description: "Array is EMPTY!\n\nNo elements to delete.\nAdd elements first." }]);
      return;
    }
    
    const deletedItem = data[deleteIndex];
    
    const steps: TutorialStep[] = [
      { title: "🗑️ Array Delete", description: `Deleting "${deletedItem?.label}" at [${deleteIndex}]`, highlightIndex: deleteIndex },
      { title: "🎯 Remove Element", description: `Removing element...`, highlightIndex: deleteIndex, animPhase: 'delete-lift', animDuration: 600 },
      { title: "💨 Element Gone", description: `Removed! ${data.length > 1 ? 'Now shift left.' : 'Array empty!'}`, highlightIndex: deleteIndex, animPhase: 'delete-shrink', animDuration: 600 },
    ];

    if (data.length > 1 && deleteIndex < data.length - 1) {
      for (let i = deleteIndex; i < data.length - 1; i++) {
        steps.push({ title: `↙️ Shift [${i + 1}] → [${i}]`, description: `Filling gap`, highlightIndex: i, animPhase: 'access-settle', animDuration: 250 });
      }
    }

    steps.push({ title: "✅ Deleted!", description: `Size: ${data.length} → ${data.length - 1}${data.length - 1 === 0 ? '\n\n⚠️ Array EMPTY!' : ''}`, animPhase: 'delete-close', animDuration: 500,
      action: () => { (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex)); } });
    
    startTutorial(steps);
  };

  const arraySwapTutorial = (idx1: number, idx2: number) => {
    const data = getArrayData();
    
    const steps: TutorialStep[] = [
      { title: "🔀 Array Swap", description: `Swapping [${idx1}] ↔ [${idx2}]`, highlightIndex: idx1, highlightIndex2: idx2 },
      { title: "📦 Save temp", description: `temp = array[${idx1}]`, highlightIndex: idx1, highlightIndex2: idx2, animPhase: 'swap-lift', animDuration: 500 },
      { title: "➡️ Copy", description: `array[${idx1}] = array[${idx2}]`, highlightIndex: idx1, highlightIndex2: idx2, animPhase: 'swap-cross', animDuration: 500 },
      { title: "⬅️ Use temp", description: `array[${idx2}] = temp`, highlightIndex: idx1, highlightIndex2: idx2,
        action: () => { (setArrayData as any)((prev: DataItem[]) => { const arr = [...prev]; [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]; return arr; }); } },
      { title: "✅ Swapped!", description: `Done! Time: O(1)`, highlightIndex: idx1, highlightIndex2: idx2, animPhase: 'swap-drop', animDuration: 500 },
    ];
    startTutorial(steps);
  };

  // ==================== LINKED LIST TUTORIAL ====================

  const linkedListTraverseTutorial = () => {
    if (isAnimating || tutorialActive) return;
    
    const data = getLinkedListData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Empty List!", description: "List is EMPTY!\n\nAdd nodes first." }]);
      return;
    }
    
    const steps: TutorialStep[] = [
      { title: "🔗 Linked List", description: "Each node has DATA + POINTER.\nNodes are NOT contiguous in memory!" },
      { title: "👑 Head Pointer", description: "HEAD marks the start.\nWithout it, we lose the list!", highlightIndex: 0, animPhase: 'll-traverse', animDuration: 600 },
    ];

    data.forEach((item, i) => {
      steps.push({
        title: `🔍 Node ${i}`, description: `current = "${item.label}"\nnext → ${i < data.length - 1 ? `"${data[i + 1]?.label}"` : 'NULL'}`,
        highlightIndex: i, animPhase: 'll-traverse', animDuration: 500,
      });
    });

    steps.push(
      { title: "🔚 End (NULL)", description: `Last node points to NULL.\nTraversal complete!`, highlightIndex: data.length - 1 },
      { title: "🔄 Insert/Delete", description: "To INSERT: redirect pointers\nTo DELETE: skip the node\n\nNo shifting like arrays!" },
      { title: "📊 Complexity", description: "Access: O(n) - must traverse\nInsert/Delete: O(1)*\n\n*after finding position" },
    );

    startTutorial(steps);
  };

  // ==================== STACK TUTORIALS ====================

  const stackPushTutorial = () => {
    if (isAnimating || tutorialActive || getStackData().length >= 5) return;
    
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = ['#9b59b6', '#e74c3c', '#1abc9c', '#3498db', '#7f8c8d'];
    const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] };
    
    const steps: TutorialStep[] = [
      { title: "⬆️ Stack PUSH", description: `Pushing "${newItem.label}" onto stack.\n\nAlways adds to TOP! (LIFO)` },
      { title: "📍 Find TOP", description: `top = ${data.length - 1}\nnew position = ${data.length}`,
        action: () => { (setStackData as any)((prev: DataItem[]) => [...prev, newItem]); } },
      { title: "📦 Place on TOP", description: `stack[${data.length}] = "${newItem.label}"`, highlightIndex: data.length, animPhase: 'stack-push-drop', animDuration: 600 },
      { title: "✅ Pushed!", description: `Done! Time: O(1)`, highlightIndex: data.length, animPhase: 'stack-push-settle', animDuration: 400 },
    ];
    startTutorial(steps);
  };

  const stackPopTutorial = () => {
    if (isAnimating || tutorialActive) return;
    
    const data = getStackData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Stack Underflow!", description: "Stack is EMPTY!\n\nCannot pop.\nPush elements first!" }]);
      return;
    }
    
    const topItem = data[data.length - 1];
    
    const steps: TutorialStep[] = [
      { title: "⬇️ Stack POP", description: `Removing TOP element.\n\nOnly TOP can be removed!`, highlightIndex: data.length - 1 },
      { title: "🎯 Identify TOP", description: `top = "${topItem.label}"`, highlightIndex: data.length - 1, animPhase: 'stack-pop-lift', animDuration: 500 },
      { title: "📤 Remove", description: `Removing...${data.length - 1 === 0 ? '\n\n⚠️ Stack will be EMPTY!' : ''}`, highlightIndex: data.length - 1, animPhase: 'stack-pop-fly', animDuration: 600,
        action: () => { (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1)); } },
      { title: "✅ Popped!", description: `Done! Time: O(1)\nLIFO: Last In, First Out`, },
    ];
    startTutorial(steps);
  };

  const stackPeekTutorial = () => {
    if (isAnimating || tutorialActive) return;
    
    const data = getStackData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Stack Empty!", description: "Nothing to peek!\nStack is empty." }]);
      return;
    }
    
    const topItem = data[data.length - 1];
    
    const steps: TutorialStep[] = [
      { title: "👁️ Stack PEEK", description: "Look at TOP without removing.", highlightIndex: data.length - 1 },
      { title: "🔍 Viewing TOP", description: `TOP = "${topItem.label}"\n\nStack unchanged!`, highlightIndex: data.length - 1, animPhase: 'stack-peek-lift', animDuration: 600 },
      { title: "📖 Opening...", description: `Examining "${topItem.label}"...`, highlightIndex: data.length - 1, animPhase: 'stack-peek-open', animDuration: 1200 },
      { title: "✅ Done!", description: `Peek = O(1)\nElement stays in place.`, animPhase: 'stack-peek-settle', animDuration: 500 },
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
      { title: "➕ Queue ENQUEUE", description: `Adding "${newItem.label}" to queue.\n\nJoins at REAR! (FIFO)` },
      { title: "📍 Find REAR", description: `rear = ${data.length - 1}\nnew position = ${data.length}`,
        action: () => { (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]); } },
      { title: "🚶 Joining", description: `Joining at rear...`, highlightIndex: data.length, animPhase: 'queue-enqueue-enter', animDuration: 700 },
      { title: "✅ Enqueued!", description: `Done! Time: O(1)`, highlightIndex: data.length, animPhase: 'queue-enqueue-settle', animDuration: 400 },
    ];
    startTutorial(steps);
  };

  const queueDequeueTutorial = () => {
    if (isAnimating || tutorialActive) return;
    
    const data = getQueueData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Queue Empty!", description: "Queue is EMPTY!\n\nNo one to dequeue.\nEnqueue first!" }]);
      return;
    }
    
    const frontItem = data[0];
    
    let steps: TutorialStep[] = [
      { title: "➖ Queue DEQUEUE", description: `Removing from FRONT.\n\nFirst in line served first!`, highlightIndex: 0 },
      { title: "🎯 Identify FRONT", description: `front = "${frontItem.label}"`, highlightIndex: 0 },
    ];

    if (queueEnv === 'tollgate') {
      steps.push(
        { title: "🚧 Opening Gate", description: `Gate opening...`, highlightIndex: 0, animPhase: 'queue-dequeue-gate-open', animDuration: 1000 },
        { title: "🚗 Driving Through", description: `"${frontItem.label}" passing...`, highlightIndex: 0, animPhase: 'queue-dequeue-drive', animDuration: 1500,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } },
        { title: "🚧 Closing Gate", description: `Gate closing.${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, animPhase: 'queue-dequeue-gate-close', animDuration: 800 }
      );
    } else if (queueEnv === 'tickets') {
      steps.push(
        { title: "🎫 Sliding Tickets", description: `All tickets sliding toward dispenser...`, highlightIndex: 0, animPhase: 'queue-dequeue-slide', animDuration: 2000 },
        { title: "📤 Dispensing", description: `"${frontItem.label}" dispensed!${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, highlightIndex: 0, animPhase: 'queue-dequeue-exit', animDuration: 1500,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } }
      );
    } else {
      steps.push(
        { title: "🚶 Walking", description: `"${frontItem.label}" walking to door...`, highlightIndex: 0, animPhase: 'queue-dequeue-walk', animDuration: 1500 },
        { title: "🚪 Entering", description: `"${frontItem.label}" entering...${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, highlightIndex: 0, animPhase: 'queue-dequeue-enter', animDuration: 1200,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } }
      );
    }

    steps.push({ title: "✅ Dequeued!", description: `Done! Time: O(1)\nFIFO: First In, First Out` });

    startTutorial(steps);
  };

  const queueFrontTutorial = () => {
    if (isAnimating || tutorialActive) return;
    
    const data = getQueueData();
    
    if (data.length === 0) {
      startTutorial([{ title: "⚠️ Queue Empty!", description: "Nothing to peek!\nQueue is empty." }]);
      return;
    }
    
    const frontItem = data[0];
    
    const steps: TutorialStep[] = [
      { title: "👁️ Queue FRONT", description: "Peek at who's next.", highlightIndex: 0 },
      { title: "🔍 Checking", description: `FRONT = "${frontItem.label}"\n\nStays in queue!`, highlightIndex: 0, animPhase: 'queue-front-peek', animDuration: 1200 },
      { title: "✅ Done!", description: `Peek = O(1)\nQueue unchanged.` },
    ];
    startTutorial(steps);
  };

  const startArrayInsert = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length >= 8) return;
    setSelectionMode('insert');
    setPendingOperation('Select index to INSERT at:');
  };

  const startArrayDelete = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive) return;
    if (getArrayData().length === 0) {
      startTutorial([{ title: "⚠️ Cannot Delete!", description: "Array is EMPTY!" }]);
      return;
    }
    setSelectionMode('delete');
    setPendingOperation('Select index to DELETE:');
  };

  const startArraySwap = () => {
    if (isAnimating || selectionMode !== 'none' || tutorialActive || getArrayData().length < 2) return;
    setSelectionMode('swap-first');
    setSwapFirstIndex(null);
    setPendingOperation('Select FIRST index to swap:');
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
      setPendingOperation(`Selected [${index}]. Now select SECOND:`);
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

  // Update WebXR scene when data changes
useEffect(() => {
  if (appMode !== 'webxr' || !webxrPlaced || !xrGroupRef.current) return;
  buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText);
}, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText]);

// Update zoom in WebXR
useEffect(() => {
  if (xrGroupRef.current && webxrActive && webxrPlaced) {
    xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
  }
}, [zoomLevel, webxrActive, webxrPlaced]);

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

  const resetWebXRPlacement = useCallback(() => {
  if (xrGroupRef.current) xrGroupRef.current.visible = false;
  if (xrReticleRef.current) xrReticleRef.current.visible = true;
  setWebxrPlaced(false);
}, []);

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
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    xrRendererRef.current = renderer;
    if (xrContainerRef.current) xrContainerRef.current.appendChild(renderer.domElement);
    await renderer.xr.setSession(session);
    const scene = new THREE.Scene();
    xrSceneRef.current = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    xrCameraRef.current = camera;
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    xrGroupRef.current = group;
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    xrReticleRef.current = reticle;
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    xrHitTestSourceRef.current = hitTestSource;
    session.addEventListener('select', () => {
      if (xrReticleRef.current?.visible && xrGroupRef.current && !xrGroupRef.current.visible) {
        xrGroupRef.current.position.setFromMatrixPosition(xrReticleRef.current.matrix);
        xrGroupRef.current.visible = true;
        xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
        xrReticleRef.current.visible = false;
        setWebxrPlaced(true);
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
            if (pose && xrReticleRef.current) {
              xrReticleRef.current.visible = true;
              xrReticleRef.current.matrix.fromArray(pose.transform.matrix);
            }
          } else if (xrReticleRef.current) {
            xrReticleRef.current.visible = false;
          }
        }
      }
      renderer.render(scene, camera);
    });
    setWebxrActive(true);
    setWebxrPlaced(false);
    setAppMode('webxr');
  } catch (err: any) {
    console.error(err);
    alert('WebXR failed: ' + err.message);
    setAppMode('surface');
  }
};

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
        {webxrActive && <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '12px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 14, fontWeight: 'bold', zIndex: 300 }}>✕ Exit AR</button>}
        
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
      </div>

      {tutorialActive && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 30, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', minWidth: 50 }}>{currentStepIndex + 1}/{tutorialSteps.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {tutorialSteps.map((_, i) => (<div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= currentStepIndex ? '#667eea' : 'rgba(255,255,255,0.3)', transition: 'background 0.3s' }} />))}
          </div>
          <button onClick={endTutorial} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, color: 'white', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>Skip</button>
          <button onClick={nextStep} disabled={stepAnimating} style={{ padding: '10px 24px', background: stepAnimating ? '#555' : 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 20, color: 'white', fontSize: 14, fontWeight: 'bold', cursor: stepAnimating ? 'not-allowed' : 'pointer', opacity: stepAnimating ? 0.7 : 1 }}>
            {stepAnimating ? '⏳' : currentStepIndex >= tutorialSteps.length - 1 ? '✓ Done' : 'Next →'}
          </button>
        </div>
      )}

      {showControls && !tutorialActive && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
           {(appMode === 'webxr' && webxrPlaced) && (
  <div style={{ textAlign: 'center', marginBottom: 10 }}>
    <button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition AR</button>
  </div>
)}
          {(appMode === 'surface' && surfacePlaced) && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetSurfacePlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (<>
              {selectionMode !== 'none' && (
                <div style={{ width: '100%', marginBottom: 10 }}>
                  <div style={{ textAlign: 'center', color: '#ffff00', marginBottom: 8, fontSize: 14, fontWeight: 'bold' }}>{pendingOperation}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {getArrayData().map((_, i) => (
                      <button key={i} onClick={() => handleIndexSelect(i)}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: (highlightIndex === i || swapFirstIndex === i) ? '3px solid #ffff00' : '2px solid rgba(255,255,255,0.5)', background: (highlightIndex === i || swapFirstIndex === i) ? '#ffff00' : 'rgba(255,255,255,0.15)', color: (highlightIndex === i || swapFirstIndex === i) ? '#000' : '#fff', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>[{i}]</button>
                    ))}
                    {selectionMode === 'insert' && (
                      <button onClick={() => handleIndexSelect(getArrayData().length)}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.5)', background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>[{getArrayData().length}]</button>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <button onClick={cancelSelection} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(231, 76, 60, 0.3)', color: '#fff', cursor: 'pointer' }}>✕ Cancel</button>
                  </div>
                </div>
              )}
              {selectionMode === 'none' && (<>
                <OpBtn onClick={arrayAppendTutorial} disabled={isAnimating || getArrayData().length >= 8} color="#2ecc71" label="➕ Append" />
                <OpBtn onClick={startArrayInsert} disabled={isAnimating || getArrayData().length >= 8} color="#3498db" label="📥 Insert" />
                <OpBtn onClick={startArrayDelete} disabled={isAnimating} color="#e74c3c" label="🗑️ Delete" />
                <OpBtn onClick={startArraySwap} disabled={isAnimating || getArrayData().length < 2} color="#9b59b6" label="🔀 Swap" />
              </>)}
            </>)}
            
            {currentStructure === 'linkedlist' && (
              <OpBtn onClick={linkedListTraverseTutorial} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse & Learn" />
            )}
            
            {currentStructure === 'stack' && (<>
              <OpBtn onClick={stackPushTutorial} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
              <OpBtn onClick={stackPopTutorial} disabled={isAnimating} color="#e74c3c" label="⬇️ Pop" />
              <OpBtn onClick={stackPeekTutorial} disabled={isAnimating} color="#f39c12" label="👁️ Peek" />
            </>)}
            
            {currentStructure === 'queue' && (<>
              <OpBtn onClick={queueEnqueueTutorial} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
              <OpBtn onClick={queueDequeueTutorial} disabled={isAnimating} color="#e74c3c" label="➖ Dequeue" />
              <OpBtn onClick={queueFrontTutorial} disabled={isAnimating} color="#f39c12" label="👁️ Front" />
            </>)}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Size: {currentData.length}</div>
        </div>
      )}
      
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
  <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
    <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
    <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning surface...</div>
    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Point camera at floor, then tap</div>
    <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }`}</style>
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
