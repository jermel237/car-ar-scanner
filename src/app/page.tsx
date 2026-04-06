'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ==================== INTERFACES ====================

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

// ==================== CARTOON CAR ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8ec8e8', metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.6, roughness: 0.3 });
  const lightMat = new THREE.MeshStandardMaterial({ color: '#ffffcc', emissive: '#ffff88', emissiveIntensity: 0.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff4444', emissive: '#ff2222', emissiveIntensity: 0.4 });

  const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.24), bodyMat);
  bodyLower.position.set(0, 0.08, 0);
  car.add(bodyLower);

  const bodySide1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.02), bodyMat);
  bodySide1.position.set(0, 0.1, 0.11);
  car.add(bodySide1);
  const bodySide2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.02), bodyMat);
  bodySide2.position.set(0, 0.1, -0.11);
  car.add(bodySide2);

  const frontCurve = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), bodyMat);
  frontCurve.position.set(-0.24, 0.09, 0);
  car.add(frontCurve);

  const rearCurve = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), bodyMat);
  rearCurve.position.set(0.24, 0.09, 0);
  car.add(rearCurve);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.22), bodyMat);
  hood.position.set(-0.15, 0.13, 0);
  hood.rotation.z = 0.1;
  car.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.22), bodyMat);
  cabin.position.set(0.02, 0.18, 0);
  car.add(cabin);

  const cabinTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.2), bodyMat);
  cabinTop.position.set(0.02, 0.24, 0);
  car.add(cabinTop);

  const cabinFront = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), bodyMat);
  cabinFront.position.set(-0.1, 0.17, 0);
  cabinFront.rotation.z = 0.3;
  car.add(cabinFront);

  const cabinRear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.2), bodyMat);
  cabinRear.position.set(0.13, 0.16, 0);
  cabinRear.rotation.z = -0.25;
  car.add(cabinRear);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.22), bodyMat);
  trunk.position.set(0.2, 0.12, 0);
  car.add(trunk);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.18), glassMat);
  windshield.position.set(-0.07, 0.18, 0);
  windshield.rotation.z = 0.45;
  car.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.16), glassMat);
  rearWindow.position.set(0.11, 0.17, 0);
  rearWindow.rotation.z = -0.35;
  car.add(rearWindow);

  [-0.11, 0.11].forEach(z => {
    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.012), glassMat);
    sideWindow.position.set(0.02, 0.19, z);
    car.add(sideWindow);
  });

  [-0.07, 0.07].forEach(z => {
    const headlightOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), darkMat);
    headlightOuter.rotation.x = Math.PI / 2;
    headlightOuter.position.set(-0.26, 0.1, z);
    car.add(headlightOuter);

    const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.018, 12), lightMat);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(-0.265, 0.1, z);
    car.add(headlight);
  });

  [-0.08, 0.08].forEach(z => {
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.04), tailMat);
    taillight.position.set(0.26, 0.1, z);
    car.add(taillight);
  });

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.1), darkMat);
  grille.position.set(-0.26, 0.08, 0);
  car.add(grille);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.22), darkMat);
  frontBumper.position.set(-0.265, 0.045, 0);
  car.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.22), darkMat);
  rearBumper.position.set(0.265, 0.045, 0);
  car.add(rearBumper);

  const wheelPositions: [number, number, number][] = [
    [-0.14, 0.045, 0.12], [0.14, 0.045, 0.12],
    [-0.14, 0.045, -0.12], [0.14, 0.045, -0.12]
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 16), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, wy, wz);
    car.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.038, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    car.add(rim);

    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), darkMat);
    center.rotation.x = Math.PI / 2;
    center.position.set(wx, wy, wz);
    car.add(center);
  });

  [-0.115, 0.115].forEach(z => {
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.015), bodyMat);
    mirrorArm.position.set(-0.06, 0.16, z);
    car.add(mirrorArm);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.012), darkMat);
    mirror.position.set(-0.055, 0.16, z + (z > 0 ? 0.012 : -0.012));
    car.add(mirror);
  });

  [-0.11, 0.11].forEach(z => {
    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.001, 0.002), darkMat);
    doorLine.position.set(0, 0.1, z);
    car.add(doorLine);
  });

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 100;
  plateCanvas.height = 40;
  const pCtx = plateCanvas.getContext('2d')!;
  pCtx.fillStyle = '#ffffff';
  pCtx.fillRect(0, 0, 100, 40);
  pCtx.strokeStyle = '#333';
  pCtx.lineWidth = 2;
  pCtx.strokeRect(2, 2, 96, 36);
  pCtx.fillStyle = '#1a3c6e';
  pCtx.font = 'bold 18px Arial';
  pCtx.textAlign = 'center';
  pCtx.fillText(label, 50, 28);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  
  const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ map: plateTex }));
  frontPlate.position.set(-0.275, 0.06, 0);
  frontPlate.rotation.y = -Math.PI / 2;
  car.add(frontPlate);

  const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), new THREE.MeshBasicMaterial({ map: plateTex }));
  rearPlate.position.set(0.275, 0.06, 0);
  rearPlate.rotation.y = Math.PI / 2;
  car.add(rearPlate);

  if (isHighlighted) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 })
    );
    glow.position.y = 0.14;
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
// [COPY THE ENTIRE createTicketDispenser FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== SCHOOL BUILDING (UNIVERSITY) ====================
// [COPY THE ENTIRE createSchoolBuilding FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== CARDBOARD BOX ====================
// [COPY THE ENTIRE createCardboardBox FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== TRAIN CAR ====================
// [COPY THE ENTIRE createTrainCar FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== HUMAN 3D ====================
// [COPY THE ENTIRE createHuman3D FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== CLIPBOARD ====================
// [COPY THE ENTIRE createClipboard FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

// ==================== BOOK ====================
// [COPY THE ENTIRE createBook FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]

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
// [COPY THE ENTIRE buildSceneContent FUNCTION FROM YOUR ORIGINAL CODE - IT'S UNCHANGED]
// This is a very large function - copy it exactly from Part 2 of your original code
// ==================== BUILD SCENE CONTENT ====================
// [COPY THE ENTIRE buildSceneContent FUNCTION FROM YOUR ORIGINAL PART 2 CODE]
// It's very long - paste it here exactly as it was

// ==================== HOME COMPONENT ====================

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Checking AR support...');
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

  // Data States
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

  // Tutorial Functions
  const runTutorialStep = async (step: TutorialStep) => {
    setStepAnimating(true);
    setTutorialText({ title: step.title, description: step.description, step: `${currentStepIndex + 1}/${tutorialSteps.length}` });
    
    if (step.highlightIndex !== undefined) setHighlightIndex(step.highlightIndex);
    else setHighlightIndex(null);
    if (step.highlightIndex2 !== undefined) setHighlightIndex2(step.highlightIndex2);
    else setHighlightIndex2(null);
    
    if (step.animPhase && step.animDuration) {
      await smoothAnimate(step.animDuration, step.animPhase, { index: step.highlightIndex, index1: step.highlightIndex, index2: step.highlightIndex2 });
    } else {
      setAnimPhase('');
      setAnimData({});
      setAnimProgress(1);
    }
    
    if (step.action) step.action();
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
      { title: "✅ Popped!", description: `Done! Time: O(1)\nLIFO: Last In, First Out` },
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
        { title: "🚗 Driving Through", description: `"${frontItem.label}" passing through...`, highlightIndex: 0, animPhase: 'queue-dequeue-drive', animDuration: 1500 },
        { title: "🚧 Closing Gate", description: `Gate closing...`, animPhase: 'queue-dequeue-gate-close', animDuration: 800 },
        { title: "🚗 Cars Moving Forward", description: `Other cars moving up...${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, animPhase: 'queue-toll-settle', animDuration: 800 },
        { title: "✅ Dequeued!", description: `"${frontItem.label}" passed through!\n\nTime: O(1)\nFIFO: First In, First Out${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } }
      );
    } else if (queueEnv === 'tickets') {
      steps.push(
        { title: "🎫 Sliding Tickets", description: `All tickets sliding toward dispenser...`, highlightIndex: 0, animPhase: 'queue-dequeue-slide', animDuration: 1500 },
        { title: "📤 Dispensing", description: `"${frontItem.label}" being dispensed...`, highlightIndex: 0, animPhase: 'queue-dequeue-exit', animDuration: 1200 },
        { title: "🎟️ Repositioning", description: `Tickets moving to new positions...${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, animPhase: 'queue-ticket-settle', animDuration: 800 },
        { title: "✅ Dequeued!", description: `"${frontItem.label}" dispensed!\n\nTime: O(1)\nFIFO: First In, First Out${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } }
      );
    } else {
      steps.push(
        { title: "🚶 Walking to Door", description: `"${frontItem.label}" walking toward entrance...`, highlightIndex: 0, animPhase: 'queue-student-walk', animDuration: 1800 },
        { title: "🚪 Entering Building", description: `"${frontItem.label}" entering the university...`, highlightIndex: 0, animPhase: 'queue-student-enter', animDuration: 1000 },
        { title: "👥 Line Moving Forward", description: `Other students moving up in line...${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`, animPhase: 'queue-student-shift', animDuration: 1200 },
        { title: "✅ Settling", description: `Students taking their new positions...`, animPhase: 'queue-student-settle', animDuration: 600 },
        { title: "✅ Dequeued!", description: `"${frontItem.label}" has entered!\n\nTime: O(1)\nFIFO: First In, First Out${data.length - 1 === 0 ? '\n\n⚠️ Queue EMPTY!' : ''}`,
          action: () => { (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); } }
      );
    }
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

  // Selection handlers
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

  // Check WebXR support on mount
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
      try { xrSessionRef.current.end(); } catch (e) { cleanupWebXR(); }
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
    if (!xr) { alert('WebXR not available.'); return; }
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

  const showControls = webxrPlaced;

  // Error screen
  if (error && !webxrSupported) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 80 }}>🌐</div>
        <h2>WebXR AR Required</h2>
        <p style={{ opacity: 0.7, maxWidth: 400 }}>{error}</p>
        <p style={{ opacity: 0.5, fontSize: 14, marginTop: 20 }}>Please use Chrome on Android with AR support.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white', fontSize: 16 }}>🔄 Try Again</button>
      </div>
    );
  }

  // Loading screen
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
        {webxrActive && (
          <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '12px 20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 14, fontWeight: 'bold', zIndex: 300 }}>✕ Exit AR</button>
        )}

        {showControls && !tutorialActive && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={zoomIn} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={zoomOut} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={resetZoom} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

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
          {webxrPlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition AR</button>
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

      {/* Scanning prompt */}
      {webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning surface...</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Point camera at floor, then tap</div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }`}</style>
        </div>
      )}

      {/* Start AR prompt */}
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
