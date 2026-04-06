'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ==================== INTERFACES ====================

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
// [Keep the entire createHuman3D function exactly as it was - it's very long so I'm not repeating it]

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

// [Keep ALL the other 3D creation functions exactly as they were:]
// - createClipboard
// - createBook
// - createTablet
// - createTrainCar
// - createTollBooth
// - createCar
// - createDomino
// - createTicketDispenser
// - createSchoolBuilding
// - createCardboardBox
// - applyItemAnimation
// - buildSceneContent

// I'm skipping them here to save space, but YOU SHOULD KEEP THEM ALL EXACTLY AS THEY ARE

// ... [ALL THE 3D FUNCTIONS FROM PART 1 AND 2 GO HERE - UNCHANGED] ...

// ==================== HOME COMPONENT ====================

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [error, setError] = useState<string | null>(null);
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

  // WebXR States
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

  // Data States - Keep all of these exactly as they were
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

  // Keep all the generateNewItem, tutorial functions, etc. EXACTLY as they were
  // ... [ALL TUTORIAL FUNCTIONS GO HERE - UNCHANGED] ...

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

  // [KEEP ALL TUTORIAL FUNCTIONS EXACTLY AS THEY WERE - arrayAppendTutorial, arrayInsertTutorial, etc.]
  // I'm not repeating them here but YOU MUST KEEP THEM ALL

  // Check WebXR support
  useEffect(() => {
    const checkXR = async () => {
      try {
        if ((navigator as any).xr) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-ar');
          setWebxrSupported(supported);
          if (!supported) {
            setError('WebXR AR is not supported on this device/browser.');
          }
        } else {
          setError('WebXR is not available on this device/browser.');
        }
      } catch {
        setError('Failed to check WebXR support.');
      }
      setIsLoading(false);
    };
    checkXR();
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Update WebXR scene when data changes
  useEffect(() => {
    if (!webxrPlaced || !xrGroupRef.current) return;
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText);
  }, [webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress, tutorialText]);

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
    xrSessionRef.current = null;
    xrRendererRef.current = null;
    xrSceneRef.current = null;
    xrCameraRef.current = null;
    xrGroupRef.current = null;
    xrReticleRef.current = null;
    xrHitTestSourceRef.current = null;
    setWebxrActive(false);
    setWebxrPlaced(false);
  }, []);

  const stopWebXR = useCallback(() => {
    if (xrSessionRef.current) {
      try {
        xrSessionRef.current.end();
      } catch (e) {
        cleanupWebXR();
      }
    } else {
      cleanupWebXR();
    }
  }, [cleanupWebXR]);

  const resetWebXRPlacement = useCallback(() => {
    if (xrGroupRef.current) xrGroupRef.current.visible = false;
    if (xrReticleRef.current) xrReticleRef.current.visible = true;
    setWebxrPlaced(false);
  }, []);

  const startWebXR = async () => {
    const xr = (navigator as any).xr;
    if (!xr) {
      alert('WebXR not available.');
      return;
    }
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
      scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(5, 10, 5);
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
    } catch (err: any) {
      console.error(err);
      alert('WebXR failed: ' + err.message);
    }
  };

  const cancelSelection = () => {
    setSelectionMode('none');
    setPendingOperation('');
    setSwapFirstIndex(null);
    setHighlightIndex(null);
    setHighlightIndex2(null);
  };

  // [Keep all tutorial functions - arrayAppendTutorial, etc.]
  // ... KEEP ALL TUTORIAL FUNCTIONS EXACTLY AS THEY WERE ...

  const showControls = webxrPlaced;

  if (error && !webxrSupported) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 80 }}>🌐</div>
        <h2>WebXR AR Required</h2>
        <p style={{ opacity: 0.7, maxWidth: 400 }}>{error}</p>
        <p style={{ opacity: 0.5, fontSize: 14, marginTop: 20 }}>Please use a WebXR-compatible browser like Chrome on Android with AR support.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white', fontSize: 16 }}>🔄 Try Again</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2>
        <p>{loadingText}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const envTabs = currentStructure === 'array'
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🎓', label: 'Class' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '🧑‍🤝‍🧑', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🛣️', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🏫', label: 'School' }];

  return (
    <div id="ar-overlay" style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <div ref={xrContainerRef} style={{ position: 'fixed', inset: 0, zIndex: webxrActive ? 1 : -1, pointerEvents: 'none' }} />

      {/* Top Controls */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {/* Exit AR Button */}
        {webxrActive && (
          <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '12px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 14, fontWeight: 'bold', zIndex: 300 }}>
            ✕ Exit AR
          </button>
        )}

        {/* Start AR Button (when not active) */}
        {!webxrActive && webxrSupported && (
          <button onClick={startWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '12px 24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: 25, fontSize: 16, fontWeight: 'bold', zIndex: 300 }}>
            🌐 Start AR
          </button>
        )}

        {/* Zoom Controls */}
        {showControls && !tutorialActive && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={zoomIn} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={zoomOut} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={resetZoom} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

        {/* Data Structure Tabs */}
        {!tutorialActive && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
            {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
              <button key={s} onClick={() => { if (!isAnimating && selectionMode === 'none') { setCurrentStructure(s); cancelSelection(); } }}
                style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>
                {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}{currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
              </button>
            ))}
          </div>
        )}

        {/* Environment Tabs */}
        {showControls && !tutorialActive && (
          <div style={{ position: 'absolute', top: 55, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && selectionMode === 'none' && (setCurrentEnv as any)(e.id)}
                style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tutorial Controls */}
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

      {/* Bottom Controls */}
      {showControls && !tutorialActive && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          {/* Reposition Button */}
          {webxrPlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition AR</button>
            </div>
          )}
          
          {/* Operation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* [KEEP ALL OPERATION BUTTONS EXACTLY AS THEY WERE] */}
            {/* Array operations, LinkedList operations, Stack operations, Queue operations */}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Size: {currentData.length}</div>
        </div>
      )}

      {/* Scanning Surface Prompt */}
      {webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning surface...</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Point camera at floor, then tap</div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }`}</style>
        </div>
      )}

      {/* Start AR Prompt (when not active) */}
      {!webxrActive && webxrSupported && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.9)', color: 'white', padding: '40px 50px', borderRadius: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 60 }}>📊</div>
          <h2 style={{ marginTop: 15 }}>Data Structure AR</h2>
          <p style={{ opacity: 0.7, marginTop: 10 }}>Learn data structures in augmented reality</p>
          <button onClick={startWebXR} style={{ marginTop: 25, padding: '15px 40px', background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 30, color: 'white', fontSize: 18, fontWeight: 'bold', cursor: 'pointer' }}>
            🌐 Start AR Experience
          </button>
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
