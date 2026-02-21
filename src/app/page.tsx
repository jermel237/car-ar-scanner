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

// ==================== TEXT SPRITE ====================

function createTextSprite(text: string, color: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 45);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
}

// ==================== ARROW ====================

function createArrow(fromX: number, toX: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;
  const midY = 0;
  const points = [new THREE.Vector3(fromX + 0.35, midY, 0), new THREE.Vector3(toX - 0.35, midY, 0)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  arrow.add(new THREE.Line(lineGeo, lineMat));

  const coneGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color }));
  cone.position.set(toX - 0.4, midY, 0);
  cone.rotation.z = -Math.PI / 2;
  arrow.add(cone);

  const glowPoints = [new THREE.Vector3(fromX + 0.35, midY, 0), new THREE.Vector3(toX - 0.35, midY, 0)];
  const glowGeo = new THREE.BufferGeometry().setFromPoints(glowPoints);
  const glowLine = new THREE.Line(glowGeo, new THREE.LineBasicMaterial({
    color: isHighlighted ? 0xffff00 : 0x00ff00,
    transparent: true,
    opacity: 0.3,
  }));
  glowLine.position.y = 0.01;
  arrow.add(glowLine);

  return arrow;
}

// ==================== CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.22), woodMat);
  seat.position.y = -0.18;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.02), woodMat);
  back.position.set(0, -0.08, -0.1);
  chair.add(back);

  const barGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6);
  [-0.06, 0, 0.06].forEach(bx => {
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.position.set(bx, -0.09, -0.1);
    chair.add(bar);
  });

  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
  [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  const supportGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6);
  const support1 = new THREE.Mesh(supportGeo, woodMat);
  support1.rotation.z = Math.PI / 2;
  support1.position.set(0, -0.28, 0.08);
  chair.add(support1);
  const support2 = new THREE.Mesh(supportGeo, woodMat);
  support2.rotation.z = Math.PI / 2;
  support2.position.set(0, -0.28, -0.08);
  chair.add(support2);

  chair.position.x = x;
  return chair;
}

// ==================== GROCERY PRODUCT ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.3;
  const boxHeight = 0.48;
  const boxDepth = 0.18;

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
  product.add(body);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 128;
  frontCanvas.height = 200;
  const fctx = frontCanvas.getContext('2d')!;

  const grad = fctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#f8f8f8');
  grad.addColorStop(1, '#e8e8e8');
  fctx.fillStyle = grad;
  fctx.fillRect(4, 4, 120, 192);
  fctx.strokeStyle = '#cccccc';
  fctx.lineWidth = 2;
  fctx.strokeRect(4, 4, 120, 192);

  fctx.fillStyle = color;
  fctx.fillRect(4, 4, 120, 45);

  const icons: Record<string, string> = {
    'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚',
    'Apple': '🍎', 'Juice': '🧃', 'New': '🆕'
  };
  fctx.font = '42px Arial';
  fctx.textAlign = 'center';
  fctx.fillText(icons[label] || '📦', 64, 110);

  fctx.fillStyle = '#2c3e50';
  fctx.font = 'bold 20px Arial';
  fctx.fillText(label, 64, 150);

  fctx.fillStyle = '#000';
  for (let i = 20; i < 108; i += 3) {
    fctx.fillRect(i, 175, 1.5, 12 + Math.random() * 6);
  }
  fctx.fillStyle = '#666';
  fctx.font = '10px Arial';
  fctx.fillText('NET WT 500g', 64, 172);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(boxWidth - 0.02, boxHeight - 0.02),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontLabel.position.set(0, boxHeight / 2, boxDepth / 2 + 0.001);
  product.add(frontLabel);

  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 80;
  sideCanvas.height = 200;
  const sctx = sideCanvas.getContext('2d')!;
  sctx.fillStyle = '#f5f5f5';
  sctx.fillRect(0, 0, 80, 200);
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, 80, 30);
  sctx.fillStyle = '#333';
  sctx.font = '9px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('Nutrition', 40, 50);
  sctx.fillText('Facts', 40, 62);
  sctx.strokeStyle = '#ddd';
  sctx.lineWidth = 0.5;
  for (let y = 75; y < 180; y += 12) {
    sctx.beginPath(); sctx.moveTo(5, y); sctx.lineTo(75, y); sctx.stroke();
  }

  const sideTex = new THREE.CanvasTexture(sideCanvas);
  const sideLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(boxDepth - 0.02, boxHeight - 0.02),
    new THREE.MeshBasicMaterial({ map: sideTex, transparent: true })
  );
  sideLabel.position.set(boxWidth / 2 + 0.001, boxHeight / 2, 0);
  sideLabel.rotation.y = Math.PI / 2;
  product.add(sideLabel);

  const topGeo = new THREE.PlaneGeometry(boxWidth, boxDepth);
  const topMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.set(0, boxHeight + 0.001, 0);
  top.rotation.x = -Math.PI / 2;
  product.add(top);

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
    'Milk': '$3.99', 'Bread': '$2.49', 'Eggs': '$4.99',
    'Apple': '$1.29', 'Juice': '$5.49', 'New': '$0.99'
  };
  tctx.fillText(prices[label] || '$2.99', 32, 22);

  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const priceTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.07),
    new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
  );
  priceTag.position.set(0, 0.02, boxDepth / 2 + 0.03);
  product.add(priceTag);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.06, boxHeight + 0.06, boxDepth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = boxHeight / 2;
    product.add(glow);

    const arrowGeo = new THREE.ConeGeometry(0.06, 0.1, 8);
    const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrowMesh.position.y = boxHeight + 0.15;
    arrowMesh.rotation.z = Math.PI;
    product.add(arrowMesh);
  }

  return product;
}

// ==================== ANIMATION HELPER ====================

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

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = 0.15;
    } else if (animPhase === 'access-bounce' && isTarget) {
      obj.position.y += 0.28;
      obj.scale.multiplyScalar(1.2);
      obj.rotation.z = -0.1;
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.08;
    } else if (animPhase === 'insert-shift' && animData.insertIndex !== undefined && itemIndex >= animData.insertIndex) {
      obj.position.y += 0.06;
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.5);
      obj.rotation.z = 0.3;
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.15;
      obj.scale.multiplyScalar(1.1);
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.45;
      obj.rotation.z = 0.4;
      obj.scale.multiplyScalar(1.2);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.8;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 3.0;
    } else if (animPhase === 'delete-close' && animData.deleteIndex !== undefined && itemIndex >= animData.deleteIndex) {
      obj.position.y += 0.06;
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45;
      obj.rotation.z = isTarget1 ? 0.15 : -0.15;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.5;
      obj.rotation.z = isTarget1 ? -0.2 : 0.2;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.12;
      obj.scale.multiplyScalar(1.12);
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.5;
      obj.scale.multiplyScalar(0.6);
      obj.rotation.z = 0.2;
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.5;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.5;
      obj.rotation.z = 0.3;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.8;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 2.5;
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.2;
      obj.scale.multiplyScalar(1.15);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.6;
      obj.scale.multiplyScalar(0.7);
      obj.rotation.z = 0.2;
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.08);
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = -0.3;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.9;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 3.0;
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.25;
      obj.rotation.z = 0.1;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.3;
      obj.scale.multiplyScalar(1.15);
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.08;
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 1.0;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.2;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 0.8;
      obj.scale.multiplyScalar(0.8);
      obj.rotation.y = 0.3;
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.5;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.2;
      obj.scale.multiplyScalar(1.15);
    }
  }
}

// ==================== HUMAN 3D ====================

function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  const headGroup = new THREE.Group();

  const headGeo = new THREE.SphereGeometry(0.09, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.3,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.scale.set(1, 1.08, 0.95);
  headGroup.add(head);

  if (appearance.hairStyle !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.8 });

    if (appearance.hairStyle === 'long') {
      const topHairGeo = new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const topHair = new THREE.Mesh(topHairGeo, hairMat);
      topHair.position.y = 0.015;
      headGroup.add(topHair);

      const backHairGeo = new THREE.CapsuleGeometry(0.04, 0.14, 8, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, -0.08, -0.045);
      headGroup.add(backHair);

      [-0.065, 0.065].forEach(x => {
        const sideHairGeo = new THREE.CapsuleGeometry(0.025, 0.08, 6, 12);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(x, -0.04, -0.02);
        headGroup.add(sideHair);
      });

      if (appearance.gender === 'female') {
        const bangsGeo = new THREE.BoxGeometry(0.14, 0.025, 0.04);
        const bangs = new THREE.Mesh(bangsGeo, hairMat);
        bangs.position.set(0, 0.065, 0.065);
        bangs.rotation.x = 0.2;
        headGroup.add(bangs);
      }
    } else {
      const shortHairGeo = new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const shortHair = new THREE.Mesh(shortHairGeo, hairMat);
      shortHair.position.y = 0.015;
      headGroup.add(shortHair);

      const fadeMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9, transparent: true, opacity: 0.7 });
      [-0.082, 0.082].forEach(x => {
        const fadeGeo = new THREE.SphereGeometry(0.03, 12, 12);
        const fade = new THREE.Mesh(fadeGeo, fadeMat);
        fade.position.set(x, 0.02, 0);
        fade.scale.set(0.4, 0.8, 0.7);
        headGroup.add(fade);
      });
    }
  }

  const eyeWhiteGeo = new THREE.SphereGeometry(0.014, 16, 16);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  const irisGeo = new THREE.SphereGeometry(0.008, 12, 12);
  const irisMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
  const pupilGeo = new THREE.SphereGeometry(0.004, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  const eyeShineGeo = new THREE.SphereGeometry(0.002, 6, 6);
  const eyeShineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  [-0.03, 0.03].forEach(x => {
    const eyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWhite.position.set(x, 0.012, 0.072);
    eyeWhite.scale.set(1, 0.75, 0.5);
    headGroup.add(eyeWhite);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(x, 0.012, 0.082);
    headGroup.add(iris);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x, 0.012, 0.086);
    headGroup.add(pupil);
    const shine = new THREE.Mesh(eyeShineGeo, eyeShineMat);
    shine.position.set(x + 0.003, 0.016, 0.087);
    headGroup.add(shine);
    const eyelidGeo = new THREE.SphereGeometry(0.016, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.3);
    const eyelidMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const eyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
    eyelid.position.set(x, 0.02, 0.07);
    eyelid.scale.set(1, 0.5, 0.5);
    headGroup.add(eyelid);
  });

  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
  [-0.03, 0.03].forEach((x, i) => {
    const browGeo = new THREE.BoxGeometry(0.028, 0.006, 0.008);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.038, 0.072);
    brow.rotation.z = i === 0 ? -0.12 : 0.12;
    headGroup.add(brow);
  });

  const noseGroup = new THREE.Group();
  const noseBridgeGeo = new THREE.BoxGeometry(0.012, 0.025, 0.015);
  const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.8 });
  const noseBridge = new THREE.Mesh(noseBridgeGeo, noseMat);
  noseBridge.position.set(0, 0, 0.08);
  noseGroup.add(noseBridge);
  const noseTipGeo = new THREE.SphereGeometry(0.012, 8, 8);
  const noseTip = new THREE.Mesh(noseTipGeo, noseMat);
  noseTip.position.set(0, -0.01, 0.085);
  noseTip.scale.set(1, 0.7, 0.8);
  noseGroup.add(noseTip);
  const nostrilGeo = new THREE.SphereGeometry(0.004, 6, 6);
  const nostrilMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c' });
  [-0.007, 0.007].forEach(x => {
    const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
    nostril.position.set(x, -0.015, 0.082);
    noseGroup.add(nostril);
  });
  headGroup.add(noseGroup);

  const mouthGroup = new THREE.Group();
  const upperLipGeo = new THREE.TorusGeometry(0.016, 0.003, 8, 16, Math.PI);
  const lipMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 });
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.032, 0.075);
  upperLip.rotation.z = Math.PI;
  upperLip.scale.set(1, 0.5, 1);
  mouthGroup.add(upperLip);
  const lowerLipGeo = new THREE.TorusGeometry(0.014, 0.0035, 8, 16, Math.PI);
  const lowerLipMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const lowerLip = new THREE.Mesh(lowerLipGeo, lowerLipMat);
  lowerLip.position.set(0, -0.038, 0.074);
  lowerLip.scale.set(1, 0.6, 1);
  mouthGroup.add(lowerLip);
  headGroup.add(mouthGroup);

  const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  [-0.087, 0.087].forEach(x => {
    const earGroup = new THREE.Group();
    const outerEarGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const outerEar = new THREE.Mesh(outerEarGeo, earMat);
    outerEar.scale.set(0.4, 0.85, 0.55);
    earGroup.add(outerEar);
    const innerEarGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const innerEarMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.5, emissive: '#331111', emissiveIntensity: 0.1 });
    const innerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
    innerEar.position.z = 0.003;
    innerEar.scale.set(0.3, 0.6, 0.3);
    earGroup.add(innerEar);
    earGroup.position.set(x, 0, 0);
    headGroup.add(earGroup);
  });

  const chinGeo = new THREE.SphereGeometry(0.04, 12, 12);
  const chinMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  const chin = new THREE.Mesh(chinGeo, chinMat);
  chin.position.set(0, -0.06, 0.03);
  chin.scale.set(1, 0.5, 0.8);
  headGroup.add(chin);

  const cheekGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const cheekMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.6, emissive: '#ff9999', emissiveIntensity: 0.05 });
  [-0.05, 0.05].forEach(x => {
    const cheek = new THREE.Mesh(cheekGeo, cheekMat);
    cheek.position.set(x, -0.015, 0.06);
    cheek.scale.set(0.8, 0.6, 0.4);
    headGroup.add(cheek);
  });

  headGroup.position.y = 0.32;
  human.add(headGroup);

  const neckGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.045, 16);
  const neckMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = 0.21;
  human.add(neck);

  const torsoGroup = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.075, 0.058, 0.17, 16);
  const torsoMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.6, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: hlEmit });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torsoGroup.add(torso);
  const collarGeo = new THREE.TorusGeometry(0.055, 0.012, 8, 16, Math.PI * 1.2);
  const collarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.075, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = -Math.PI * 0.1;
  torsoGroup.add(collar);
  const buttonGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  [0.04, 0, -0.04].forEach(y => {
    const button = new THREE.Mesh(buttonGeo, buttonMat);
    button.position.set(0, y, 0.06);
    torsoGroup.add(button);
  });
  const shirtBottomGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.02, 16);
  const shirtBottom = new THREE.Mesh(shirtBottomGeo, torsoMat);
  shirtBottom.position.y = -0.095;
  torsoGroup.add(shirtBottom);
  torsoGroup.position.y = 0.11;
  human.add(torsoGroup);

  const armShirtMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });

  [-1, 1].forEach(side => {
    const armGroup = new THREE.Group();
    const shoulderGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const shoulder = new THREE.Mesh(shoulderGeo, armShirtMat);
    shoulder.position.y = 0.04;
    armGroup.add(shoulder);
    const upperArmGeo = new THREE.CapsuleGeometry(0.016, 0.08, 8, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, armShirtMat);
    armGroup.add(upperArm);
    const cuffGeo = new THREE.CylinderGeometry(0.018, 0.016, 0.015, 12);
    const cuff = new THREE.Mesh(cuffGeo, armShirtMat);
    cuff.position.y = -0.05;
    armGroup.add(cuff);
    const lowerArmGeo = new THREE.CapsuleGeometry(0.013, 0.065, 8, 16);
    const lowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
    lowerArm.position.y = -0.1;
    armGroup.add(lowerArm);
    const wristGeo = new THREE.CylinderGeometry(0.013, 0.012, 0.01, 10);
    const wrist = new THREE.Mesh(wristGeo, skinMat);
    wrist.position.y = -0.14;
    armGroup.add(wrist);
    const handGeo = new THREE.SphereGeometry(0.018, 12, 12);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.155;
    hand.scale.set(0.65, 0.9, 0.45);
    armGroup.add(hand);
    const thumbGeo = new THREE.CapsuleGeometry(0.005, 0.015, 4, 8);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(side * 0.012, -0.155, 0.01);
    thumb.rotation.z = side * 0.5;
    armGroup.add(thumb);
    armGroup.position.set(side * 0.09, 0.1, 0);
    armGroup.rotation.z = side * 0.15;
    human.add(armGroup);
  });

  const beltGeo = new THREE.CylinderGeometry(0.058, 0.055, 0.018, 16);
  const beltMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = 0.025;
  human.add(belt);
  const buckleGeo = new THREE.BoxGeometry(0.02, 0.015, 0.008);
  const buckleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
  const buckle = new THREE.Mesh(buckleGeo, buckleMat);
  buckle.position.set(0, 0.025, 0.055);
  human.add(buckle);

  const hipsGeo = new THREE.CylinderGeometry(0.057, 0.052, 0.04, 16);
  const hipsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  const hips = new THREE.Mesh(hipsGeo, hipsMat);
  hips.position.y = 0.005;
  human.add(hips);

  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  [-0.03, 0.03].forEach(x => {
    const legGroup = new THREE.Group();
    const thighGeo = new THREE.CapsuleGeometry(0.022, 0.055, 8, 16);
    const thigh = new THREE.Mesh(thighGeo, legMat);
    legGroup.add(thigh);
    const kneeGeo = new THREE.SphereGeometry(0.022, 10, 10);
    const knee = new THREE.Mesh(kneeGeo, legMat);
    knee.position.y = -0.04;
    legGroup.add(knee);
    const shinGeo = new THREE.CapsuleGeometry(0.018, 0.05, 8, 16);
    const shin = new THREE.Mesh(shinGeo, legMat);
    shin.position.y = -0.085;
    legGroup.add(shin);
    const ankleGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const ankle = new THREE.Mesh(ankleGeo, legMat);
    ankle.position.y = -0.115;
    legGroup.add(ankle);
    legGroup.position.set(x, -0.05, 0);
    human.add(legGroup);
  });

  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.8 });
  [-0.03, 0.03].forEach(x => {
    const shoeGroup = new THREE.Group();
    const shoeBodyGeo = new THREE.BoxGeometry(0.035, 0.018, 0.05);
    const shoeBody = new THREE.Mesh(shoeBodyGeo, shoeMat);
    shoeGroup.add(shoeBody);
    const toeGeo = new THREE.SphereGeometry(0.017, 8, 8);
    const toe = new THREE.Mesh(toeGeo, shoeMat);
    toe.position.set(0, -0.003, 0.02);
    toe.scale.set(1, 0.5, 0.8);
    shoeGroup.add(toe);
    const soleGeo = new THREE.BoxGeometry(0.036, 0.006, 0.052);
    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.y = -0.012;
    shoeGroup.add(sole);
    const laceGeo = new THREE.BoxGeometry(0.008, 0.002, 0.025);
    const laceMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const lace = new THREE.Mesh(laceGeo, laceMat);
    lace.position.set(0, 0.01, 0);
    shoeGroup.add(lace);
    shoeGroup.position.set(x, -0.155, 0.008);
    human.add(shoeGroup);
  });

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 200;
  labelCanvas.height = 48;
  const lctx = labelCanvas.getContext('2d')!;
  if (isHighlighted) {
    lctx.fillStyle = '#ffff00';
    lctx.beginPath();
    lctx.roundRect(0, 0, 200, 48, 12);
    lctx.fill();
    lctx.fillStyle = '#000';
  } else {
    lctx.fillStyle = 'rgba(0,0,0,0.85)';
    lctx.beginPath();
    lctx.roundRect(0, 0, 200, 48, 12);
    lctx.fill();
    lctx.strokeStyle = 'rgba(255,255,255,0.3)';
    lctx.lineWidth = 2;
    lctx.beginPath();
    lctx.roundRect(1, 1, 198, 46, 12);
    lctx.stroke();
    lctx.fillStyle = '#ffffff';
  }
  lctx.font = 'bold 24px Arial';
  lctx.textAlign = 'center';
  lctx.fillText(name, 100, 34);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 0.5;
  labelSprite.scale.set(0.35, 0.09, 1);
  human.add(labelSprite);

  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.08, 0.13, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.16;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);
    const arrowGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffff00' });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.y = 0.58;
    arrowMesh.rotation.z = Math.PI;
    human.add(arrowMesh);
  }

  return human;
}

// ==================== CLIPBOARD ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  const boardGeo = new THREE.BoxGeometry(0.4, 0.52, 0.018);
  const boardMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.65, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  clipboard.add(new THREE.Mesh(boardGeo, boardMat));

  const edgeGeo = new THREE.BoxGeometry(0.41, 0.53, 0.01);
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.8 });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.z = -0.01;
  clipboard.add(edge);

  const clipBaseGeo = new THREE.BoxGeometry(0.14, 0.04, 0.025);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9, roughness: 0.2 });
  const clipBase = new THREE.Mesh(clipBaseGeo, clipMat);
  clipBase.position.set(0, 0.28, 0.015);
  clipboard.add(clipBase);

  const clipLeverGeo = new THREE.BoxGeometry(0.08, 0.015, 0.03);
  const clipLever = new THREE.Mesh(clipLeverGeo, clipMat);
  clipLever.position.set(0, 0.3, 0.03);
  clipLever.rotation.x = -0.3;
  clipboard.add(clipLever);

  const springGeo = new THREE.TorusGeometry(0.008, 0.002, 6, 12, Math.PI);
  const spring = new THREE.Mesh(springGeo, clipMat);
  spring.position.set(0, 0.285, 0.025);
  spring.rotation.y = Math.PI / 2;
  clipboard.add(spring);

  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 200;
  paperCanvas.height = 300;
  const pctx = paperCanvas.getContext('2d')!;
  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 200, 300);
  pctx.strokeStyle = '#f0ede4';
  pctx.lineWidth = 0.5;
  for (let y = 0; y < 300; y += 3) { pctx.beginPath(); pctx.moveTo(0, y); pctx.lineTo(200, y); pctx.stroke(); }
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 200, 38);
  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 18px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 100, 27);
  pctx.strokeStyle = '#d4d0c8';
  pctx.lineWidth = 0.8;
  const tasks = [
    { text: 'Review notes', done: true }, { text: 'Complete homework', done: true },
    { text: 'Practice coding', done: isHighlighted }, { text: 'Read chapter 5', done: false },
    { text: 'Submit project', done: false }, { text: 'Study for exam', done: false },
    { text: 'Group meeting', done: false }, { text: 'Lab report', done: false },
  ];
  tasks.forEach((task, i) => {
    const y = 55 + i * 22;
    pctx.strokeStyle = '#d4d0c8';
    pctx.beginPath(); pctx.moveTo(12, y + 16); pctx.lineTo(188, y + 16); pctx.stroke();
    pctx.strokeStyle = '#666'; pctx.lineWidth = 1.5; pctx.strokeRect(14, y, 14, 14);
    if (task.done) {
      pctx.strokeStyle = '#27ae60'; pctx.lineWidth = 2.5;
      pctx.beginPath(); pctx.moveTo(16, y + 7); pctx.lineTo(20, y + 12); pctx.lineTo(27, y + 3); pctx.stroke();
      pctx.fillStyle = '#999'; pctx.font = '12px Arial'; pctx.textAlign = 'left'; pctx.fillText(task.text, 34, y + 12);
      pctx.strokeStyle = '#999'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(34, y + 8); pctx.lineTo(34 + pctx.measureText(task.text).width, y + 8); pctx.stroke();
    } else {
      pctx.fillStyle = '#2c3e50'; pctx.font = '12px Arial'; pctx.textAlign = 'left'; pctx.fillText(task.text, 34, y + 12);
    }
  });
  pctx.fillStyle = '#aaa'; pctx.font = '10px Arial'; pctx.textAlign = 'center'; pctx.fillText('Page 1 of 1', 100, 285);
  pctx.strokeStyle = '#e74c3c'; pctx.lineWidth = 1; pctx.beginPath(); pctx.moveTo(10, 40); pctx.lineTo(10, 290); pctx.stroke();

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.48), new THREE.MeshBasicMaterial({ map: paperTex }));
  paper.position.z = 0.011;
  clipboard.add(paper);

  const shadowGeo = new THREE.PlaneGeometry(0.37, 0.49);
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.08 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.z = 0.009;
  clipboard.add(shadow);

  const pencilGroup = new THREE.Group();
  const pencilBodyGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6);
  const pencilMat = new THREE.MeshStandardMaterial({ color: '#f4d03f' });
  pencilGroup.add(new THREE.Mesh(pencilBodyGeo, pencilMat));
  const pencilTipGeo = new THREE.ConeGeometry(0.006, 0.02, 6);
  const pencilTip = new THREE.Mesh(pencilTipGeo, new THREE.MeshStandardMaterial({ color: '#f5deb3' }));
  pencilTip.position.y = -0.1;
  pencilGroup.add(pencilTip);
  const pencilLeadGeo = new THREE.ConeGeometry(0.002, 0.008, 6);
  const pencilLead = new THREE.Mesh(pencilLeadGeo, new THREE.MeshStandardMaterial({ color: '#333' }));
  pencilLead.position.y = -0.114;
  pencilGroup.add(pencilLead);
  const eraserGeo = new THREE.CylinderGeometry(0.007, 0.006, 0.015, 6);
  const eraser = new THREE.Mesh(eraserGeo, new THREE.MeshStandardMaterial({ color: '#e88b8b' }));
  eraser.position.y = 0.098;
  pencilGroup.add(eraser);
  pencilGroup.position.set(0.12, -0.05, 0.02);
  pencilGroup.rotation.z = 0.8;
  clipboard.add(pencilGroup);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.44, 0.56, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    clipboard.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return clipboard;
}

// ==================== TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.7, 0.34, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.6, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.4 : 0 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.12;
  train.add(body);

  const stripeGeo = new THREE.BoxGeometry(0.71, 0.025, 0.305);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.5 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.18;
  train.add(stripe);

  const roofGeo = new THREE.BoxGeometry(0.64, 0.04, 0.26);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.4 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.31;
  train.add(roof);

  const roofCurveGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.64, 16, 1, false, 0, Math.PI);
  const roofCurve = new THREE.Mesh(roofCurveGeo, roofMat);
  roofCurve.position.y = 0.31;
  roofCurve.rotation.z = Math.PI / 2;
  roofCurve.scale.y = 0.25;
  train.add(roofCurve);

  const underGeo = new THREE.BoxGeometry(0.65, 0.04, 0.24);
  const underMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.6 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.06;
  train.add(under);

  const wheelGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.025, 24);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7, roughness: 0.3 });
  const hubCapGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.028, 16);
  const hubCapMat = new THREE.MeshStandardMaterial({ color: '#d4d4d4', metalness: 0.9, roughness: 0.1 });
  const wheelRimGeo = new THREE.TorusGeometry(0.055, 0.005, 8, 24);
  const wheelRimMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 });

  const wheelPositions: [number, number, number][] = [[-0.22, -0.06, 0.15], [0.22, -0.06, 0.15], [-0.22, -0.06, -0.15], [0.22, -0.06, -0.15]];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    train.add(wheel);
    const hubCap = new THREE.Mesh(hubCapGeo, hubCapMat);
    hubCap.rotation.x = Math.PI / 2;
    hubCap.position.set(wx, wy, wz);
    train.add(hubCap);
    const rim = new THREE.Mesh(wheelRimGeo, wheelRimMat);
    rim.position.set(wx, wy, wz > 0 ? wz + 0.013 : wz - 0.013);
    rim.rotation.x = Math.PI / 2;
    train.add(rim);
    const spokeGeo = new THREE.BoxGeometry(0.003, 0.09, 0.003);
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#999' });
    [0, Math.PI / 3, Math.PI * 2 / 3].forEach(angle => {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.set(wx, wy, wz > 0 ? wz + 0.013 : wz - 0.013);
      spoke.rotation.z = angle;
      train.add(spoke);
    });
  });

  if (!isEngine) {
    const windowGeo = new THREE.PlaneGeometry(0.09, 0.08);
    const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.4, roughness: 0.2 });
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.6 });
    [-0.2, 0, 0.2].forEach(x => {
      const wF = new THREE.Mesh(windowGeo, windowMat);
      wF.position.set(x, 0.17, 0.152);
      train.add(wF);
      const frameFGeo = new THREE.BoxGeometry(0.1, 0.09, 0.005);
      const frameF = new THREE.Mesh(frameFGeo, windowFrameMat);
      frameF.position.set(x, 0.17, 0.153);
      train.add(frameF);
      const wB = new THREE.Mesh(windowGeo, windowMat);
      wB.position.set(x, 0.17, -0.152);
      train.add(wB);
    });
  }

  if (isEngine) {
    const boilerGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.28, 24);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.45, roughness: 0.5 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.5, 0.12, 0);
    train.add(boiler);

    const bandGeo = new THREE.TorusGeometry(0.132, 0.008, 8, 24);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    [0.38, 0.48, 0.58].forEach(x => {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(x, 0.12, 0);
      band.rotation.y = Math.PI / 2;
      train.add(band);
    });

    const frontPlateGeo = new THREE.CircleGeometry(0.12, 24);
    const frontPlateMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6, side: THREE.DoubleSide });
    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.position.set(0.64, 0.12, 0);
    frontPlate.rotation.y = Math.PI / 2;
    train.add(frontPlate);

    const headlightGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.04, 16);
    const headlightMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.7 });
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0.66, 0.2, 0);
    headlight.rotation.z = Math.PI / 2;
    train.add(headlight);

    const lensGeo = new THREE.CircleGeometry(0.025, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0.68, 0.2, 0);
    lens.rotation.y = Math.PI / 2;
    train.add(lens);

    const chimneyGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 12);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.5 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.2, 0.4, 0);
    train.add(chimney);
    const capGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.02, 12);
    const cap = new THREE.Mesh(capGeo, chimneyMat);
    cap.position.set(0.2, 0.49, 0);
    train.add(cap);

    const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.35 });
    [{ y: 0.55, s: 0.04 }, { y: 0.62, s: 0.055 }, { y: 0.7, s: 0.07 }, { y: 0.8, s: 0.08 }].forEach(({ y, s }) => {
      const smokeGeo = new THREE.SphereGeometry(s, 8, 8);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.2 + (y - 0.55) * 0.3, y, (Math.random() - 0.5) * 0.08);
      train.add(smoke);
    });

    const catcherGroup = new THREE.Group();
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6 });
    const catcherBaseGeo = new THREE.BoxGeometry(0.06, 0.1, 0.25);
    catcherGroup.add(new THREE.Mesh(catcherBaseGeo, catcherMat));
    [-0.08, 0.08].forEach(z => {
      const barGeo = new THREE.BoxGeometry(0.08, 0.04, 0.015);
      const bar = new THREE.Mesh(barGeo, catcherMat);
      bar.position.set(0.02, -0.03, z);
      bar.rotation.y = z > 0 ? 0.3 : -0.3;
      catcherGroup.add(bar);
    });
    catcherGroup.position.set(0.68, -0.02, 0);
    train.add(catcherGroup);

    const domeGeo = new THREE.SphereGeometry(0.04, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.5 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0.42, 0.25, 0);
    train.add(dome);
  }

  const hookGeo = new THREE.BoxGeometry(0.04, 0.025, 0.025);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8, roughness: 0.2 });
  [-0.37, 0.37].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);
    const ringGeo = new THREE.TorusGeometry(0.015, 0.004, 6, 12);
    const ring = new THREE.Mesh(ringGeo, hookMat);
    ring.position.set(x > 0 ? x + 0.03 : x - 0.03, 0.02, 0);
    ring.rotation.y = Math.PI / 2;
    train.add(ring);
  });

  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isHighlighted ? 'rgba(255,255,0,0.9)' : 'rgba(0,0,0,0.7)';
  ctx.beginPath(); ctx.roundRect(0, 0, 160, 48, 10); ctx.fill();
  ctx.fillStyle = isHighlighted ? '#000' : '#fff';
  ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 80, 34);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 0.5; labelSprite.scale.set(0.45, 0.14, 1);
  train.add(labelSprite);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.75, 0.4, 0.35);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.12;
    train.add(glow);
  }

  return train;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  const tileGeo = new THREE.BoxGeometry(0.24, 0.48, 0.07);
  const tileMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#1abc9c' : '#f5f0e8', roughness: 0.4, metalness: 0.05, emissive: isHighlighted ? '#1abc9c' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  domino.add(new THREE.Mesh(tileGeo, tileMat));

  const borderGeo = new THREE.BoxGeometry(0.25, 0.49, 0.06);
  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.01;
  domino.add(border);

  const grooveGeo = new THREE.BoxGeometry(0.2, 0.012, 0.015);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3 });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.03;
  domino.add(groove);

  const cornerDotGeo = new THREE.CircleGeometry(0.008, 8);
  const cornerDotMat = new THREE.MeshBasicMaterial({ color: '#c0392b', side: THREE.DoubleSide });
  [[-0.09, 0.21], [0.09, 0.21], [-0.09, -0.21], [0.09, -0.21]].forEach(([x, y]) => {
    const cornerDot = new THREE.Mesh(cornerDotGeo, cornerDotMat);
    cornerDot.position.set(x, y, 0.036);
    domino.add(cornerDot);
  });

  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.015, 16);
  const dotMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#fff' : '#1a1a1a', roughness: 0.3, metalness: 0.1 });
  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0.14]], 2: [[-0.05, 0.2], [0.05, 0.08]],
    3: [[-0.05, 0.2], [0, 0.14], [0.05, 0.08]],
    4: [[-0.05, 0.2], [0.05, 0.2], [-0.05, 0.08], [0.05, 0.08]],
  };
  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, 0.028); dot.rotation.x = Math.PI / 2;
    domino.add(dot);
    const recessGeo = new THREE.CircleGeometry(0.022, 12);
    const recessMat = new THREE.MeshBasicMaterial({ color: '#ddd', side: THREE.DoubleSide });
    const recess = new THREE.Mesh(recessGeo, recessMat);
    recess.position.set(x, y, 0.035);
    domino.add(recess);
  });
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-x, -y, 0.028); dot.rotation.x = Math.PI / 2;
    domino.add(dot);
    const recessGeo = new THREE.CircleGeometry(0.022, 12);
    const recessMat = new THREE.MeshBasicMaterial({ color: '#ddd', side: THREE.DoubleSide });
    const recess = new THREE.Mesh(recessGeo, recessMat);
    recess.position.set(-x, -y, 0.035);
    domino.add(recess);
  });

  const numCanvas = document.createElement('canvas');
  numCanvas.width = 32; numCanvas.height = 32;
  const nctx = numCanvas.getContext('2d')!;
  nctx.fillStyle = isHighlighted ? '#fff' : '#666';
  nctx.font = 'bold 20px Arial'; nctx.textAlign = 'center'; nctx.fillText(value, 16, 24);
  const numTex = new THREE.CanvasTexture(numCanvas);
  const numSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex, transparent: true }));
  numSprite.position.set(0.14, 0, 0); numSprite.scale.set(0.08, 0.08, 1);
  domino.add(numSprite);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.28, 0.52, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  const coverGeo = new THREE.BoxGeometry(0.58, 0.075, 0.4);
  const coverMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  book.add(new THREE.Mesh(coverGeo, coverMat));

  const topEdgeGeo = new THREE.BoxGeometry(0.58, 0.003, 0.4);
  const edgeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 });
  const topEdge = new THREE.Mesh(topEdgeGeo, edgeMat);
  topEdge.position.y = 0.039;
  book.add(topEdge);
  const bottomEdge = new THREE.Mesh(topEdgeGeo, edgeMat);
  bottomEdge.position.y = -0.039;
  book.add(bottomEdge);

  const pagesGeo = new THREE.BoxGeometry(0.54, 0.06, 0.37);
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  pages.position.x = 0.015;
  book.add(pages);

  const pageLinesCanvas = document.createElement('canvas');
  pageLinesCanvas.width = 16; pageLinesCanvas.height = 128;
  const plctx = pageLinesCanvas.getContext('2d')!;
  plctx.fillStyle = '#f5f0e0';
  plctx.fillRect(0, 0, 16, 128);
  for (let y = 0; y < 128; y += 2) {
    plctx.fillStyle = y % 4 === 0 ? '#e8e0d0' : '#f0e8d8';
    plctx.fillRect(0, y, 16, 1);
  }
  const pageLinesTex = new THREE.CanvasTexture(pageLinesCanvas);
  const pageSide = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.37), new THREE.MeshBasicMaterial({ map: pageLinesTex }));
  pageSide.position.set(0.29, 0, 0); pageSide.rotation.y = Math.PI / 2;
  book.add(pageSide);

  const spineGeo = new THREE.BoxGeometry(0.025, 0.08, 0.4);
  const spineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.4 });
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -0.3;
  book.add(spine);

  const ridgeGeo = new THREE.BoxGeometry(0.003, 0.082, 0.01);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  [-0.15, -0.05, 0.05, 0.15].forEach(z => {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(-0.313, 0, z);
    book.add(ridge);
  });

  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 32; spineCanvas.height = 160;
  const sctx = spineCanvas.getContext('2d')!;
  sctx.fillStyle = '#ffd700';
  sctx.save(); sctx.translate(16, 80); sctx.rotate(-Math.PI / 2);
  sctx.font = 'bold 18px serif'; sctx.textAlign = 'center'; sctx.fillText(label, 0, 6);
  sctx.restore();
  const spineTex = new THREE.CanvasTexture(spineCanvas);
  const spineLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.35), new THREE.MeshBasicMaterial({ map: spineTex, transparent: true }));
  spineLabel.position.set(-0.314, 0, 0); spineLabel.rotation.y = -Math.PI / 2;
  book.add(spineLabel);

  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 200; coverCanvas.height = 160;
  const cctx = coverCanvas.getContext('2d')!;
  cctx.strokeStyle = '#ffd700'; cctx.lineWidth = 4; cctx.strokeRect(10, 10, 180, 140);
  cctx.strokeStyle = '#ffd700'; cctx.lineWidth = 1; cctx.strokeRect(18, 18, 164, 124);
  cctx.fillStyle = '#ffd700'; cctx.font = 'bold 28px serif'; cctx.textAlign = 'center'; cctx.fillText(label, 100, 85);
  cctx.font = '14px serif'; cctx.fillText('TEXTBOOK', 100, 110);
  cctx.strokeStyle = '#ffd700'; cctx.lineWidth = 2;
  cctx.beginPath(); cctx.moveTo(50, 55); cctx.lineTo(150, 55); cctx.stroke();
  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: coverTex, transparent: true }));
  coverLabel.position.y = 0.039; coverLabel.rotation.x = -Math.PI / 2;
  book.add(coverLabel);

  const ribbonGeo = new THREE.PlaneGeometry(0.015, 0.12);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide, roughness: 0.6 });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0.1, 0, 0.2); ribbon.rotation.x = 0.1;
  book.add(ribbon);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.62, 0.1, 0.44);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    book.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return book;
}

// ==================== PLATE ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  const plateGeo = new THREE.CylinderGeometry(0.3, 0.27, 0.02, 36);
  const plateMat = new THREE.MeshStandardMaterial({ color: '#f8f8f0', roughness: 0.25, metalness: 0.08, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.2 : 0 });
  plate.add(new THREE.Mesh(plateGeo, plateMat));

  const rimGeo = new THREE.TorusGeometry(0.29, 0.014, 12, 36);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e8e8e0', roughness: 0.3, metalness: 0.1 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.01;
  plate.add(rim);

  const innerRingGeo = new THREE.TorusGeometry(0.2, 0.008, 8, 32);
  const innerRingMat = new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = Math.PI / 2; innerRing.position.y = 0.012;
  plate.add(innerRing);

  const outerRingGeo = new THREE.TorusGeometry(0.25, 0.005, 8, 32);
  const outerRing = new THREE.Mesh(outerRingGeo, innerRingMat);
  outerRing.rotation.x = Math.PI / 2; outerRing.position.y = 0.012;
  plate.add(outerRing);

  const centerCanvas = document.createElement('canvas');
  centerCanvas.width = 128; centerCanvas.height = 128;
  const cctx = centerCanvas.getContext('2d')!;
  cctx.fillStyle = '#2980b9';
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const px = 64 + Math.cos(angle) * 25;
    const py = 64 + Math.sin(angle) * 25;
    cctx.beginPath(); cctx.ellipse(px, py, 8, 4, angle, 0, Math.PI * 2); cctx.fill();
  }
  cctx.beginPath(); cctx.arc(64, 64, 6, 0, Math.PI * 2); cctx.fill();
  const centerTex = new THREE.CanvasTexture(centerCanvas);
  const centerDesign = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ map: centerTex, transparent: true, side: THREE.DoubleSide }));
  centerDesign.rotation.x = -Math.PI / 2; centerDesign.position.y = 0.012;
  plate.add(centerDesign);

  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;
  if (plateNum % 3 === 1) {
    const riceGeo = new THREE.SphereGeometry(0.06, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const riceMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.9 });
    const rice = new THREE.Mesh(riceGeo, riceMat);
    rice.position.set(-0.06, 0.013, 0);
    plate.add(rice);
    const chickenGeo = new THREE.CapsuleGeometry(0.025, 0.06, 6, 12);
    const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.7 });
    const chicken = new THREE.Mesh(chickenGeo, chickenMat);
    chicken.position.set(0.06, 0.035, 0.02); chicken.rotation.z = 0.4;
    plate.add(chicken);
    const peaMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const peaGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const pea = new THREE.Mesh(peaGeo, peaMat);
      pea.position.set(0.02 + Math.random() * 0.06 - 0.03, 0.02, -0.06 + Math.random() * 0.04);
      plate.add(pea);
    }
  } else if (plateNum % 3 === 2) {
    const spaghettiMat = new THREE.MeshStandardMaterial({ color: '#f0d58c', roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
      const noodleGeo = new THREE.TorusGeometry(0.04 + Math.random() * 0.03, 0.004, 6, 16);
      const noodle = new THREE.Mesh(noodleGeo, spaghettiMat);
      noodle.position.set((Math.random() - 0.5) * 0.06, 0.02 + i * 0.003, (Math.random() - 0.5) * 0.06);
      noodle.rotation.x = Math.random() * 0.5; noodle.rotation.y = Math.random() * Math.PI;
      plate.add(noodle);
    }
    const sauceGeo = new THREE.SphereGeometry(0.04, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.035, 0); sauce.scale.set(1.2, 0.6, 1.2);
    plate.add(sauce);
    const meatballGeo = new THREE.SphereGeometry(0.025, 10, 10);
    const meatballMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 });
    const meatball = new THREE.Mesh(meatballGeo, meatballMat);
    meatball.position.set(0.02, 0.04, 0.01);
    plate.add(meatball);
  } else {
    const lettuceMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const leafGeo = new THREE.SphereGeometry(0.03, 6, 6);
      const leaf = new THREE.Mesh(leafGeo, lettuceMat);
      leaf.position.set((Math.random() - 0.5) * 0.1, 0.02, (Math.random() - 0.5) * 0.1);
      leaf.scale.set(1.2, 0.4, 1); leaf.rotation.y = Math.random() * Math.PI;
      plate.add(leaf);
    }
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const tomatoGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(-0.02 + i * 0.035, 0.03, -0.02 + i * 0.01);
      plate.add(tomato);
    }
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const cheeseGeo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set(0.04 + Math.random() * 0.04, 0.025, (Math.random() - 0.5) * 0.06);
      cheese.rotation.y = Math.random() * 0.5;
      plate.add(cheese);
    }
  }

  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.03, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean): THREE.Group {
  const box = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.52, 0.36, 0.42);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  box.add(body);

  const creaseMat = new THREE.MeshStandardMaterial({ color: '#7a5530', roughness: 0.9 });
  const vCreaseGeo = new THREE.BoxGeometry(0.012, 0.36, 0.012);
  [[-0.255, 0, 0.205], [0.255, 0, 0.205], [-0.255, 0, -0.205], [0.255, 0, -0.205]].forEach(([x, y, z]) => {
    const crease = new THREE.Mesh(vCreaseGeo, creaseMat);
    crease.position.set(x, y, z);
    box.add(crease);
  });

  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const flapAngle = isOpen ? -1.2 : 0;

  const frontFlapGeo = new THREE.BoxGeometry(0.52, 0.15, 0.01);
  const frontFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  frontFlap.position.set(0, 0.18 + (isOpen ? 0.06 : 0), 0.21);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);
  const backFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  backFlap.position.set(0, 0.18 + (isOpen ? 0.06 : 0), -0.21);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  const sideFlapGeo = new THREE.BoxGeometry(0.01, 0.15, 0.42);
  const leftFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  leftFlap.position.set(-0.26, 0.18 + (isOpen ? 0.04 : 0), 0);
  leftFlap.rotation.z = isOpen ? 0.8 : 0;
  box.add(leftFlap);
  const rightFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  rightFlap.position.set(0.26, 0.18 + (isOpen ? 0.04 : 0), 0);
  rightFlap.rotation.z = isOpen ? -0.8 : 0;
  box.add(rightFlap);

  if (isOpen) {
    const insideGeo = new THREE.PlaneGeometry(0.5, 0.4);
    const insideMat = new THREE.MeshStandardMaterial({ color: '#a0734a', side: THREE.DoubleSide, roughness: 0.9 });
    const insideBottom = new THREE.Mesh(insideGeo, insideMat);
    insideBottom.rotation.x = -Math.PI / 2; insideBottom.position.y = -0.17;
    box.add(insideBottom);
    const itemGeo = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    const itemMat = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.6 });
    const item1 = new THREE.Mesh(itemGeo, itemMat);
    item1.position.set(-0.1, -0.05, 0); item1.rotation.y = 0.2;
    box.add(item1);
    const item2Geo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
    const item2Mat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    const item2 = new THREE.Mesh(item2Geo, item2Mat);
    item2.position.set(0.08, -0.03, 0.05);
    box.add(item2);
    const glowInsideGeo = new THREE.PointLight(0xffff00, 0.5, 0.5);
    glowInsideGeo.position.set(0, 0, 0);
    box.add(glowInsideGeo);
  }

  const tapeGeo = new THREE.BoxGeometry(0.08, 0.005, 0.44);
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574', transparent: true, opacity: 0.7, roughness: 0.3 });
  if (!isOpen) {
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = 0.183;
    box.add(tape);
  }

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 160; labelCanvas.height = 100;
  const lctx = labelCanvas.getContext('2d')!;
  lctx.fillStyle = '#ffffff'; lctx.fillRect(0, 0, 160, 100);
  lctx.strokeStyle = '#333'; lctx.lineWidth = 2; lctx.strokeRect(2, 2, 156, 96);
  lctx.fillStyle = '#e74c3c'; lctx.fillRect(5, 5, 150, 25);
  lctx.fillStyle = '#fff'; lctx.font = 'bold 16px Arial'; lctx.textAlign = 'center'; lctx.fillText('⚠ FRAGILE ⚠', 80, 24);
  lctx.fillStyle = '#000'; lctx.font = 'bold 26px Arial'; lctx.fillText(label, 80, 62);
  lctx.fillStyle = '#666'; lctx.font = '10px Arial'; lctx.fillText('HANDLE WITH CARE', 80, 82);
  lctx.fillStyle = '#333'; lctx.font = '14px Arial'; lctx.fillText('↑ THIS SIDE UP ↑', 80, 95);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ map: labelTex }));
  labelMesh.position.set(0, 0, 0.212);
  box.add(labelMesh);

  [-0.261, 0.261].forEach(x => {
    const handleGeo = new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI);
    const handleMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.8 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(x, 0.05, 0); handle.rotation.y = Math.PI / 2; handle.rotation.z = Math.PI;
    box.add(handle);
  });

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.56, 0.4, 0.46);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return box;
}

// ==================== CAR ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.6, 0.16, 0.3);
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.1;
  car.add(body);

  const skirtGeo = new THREE.BoxGeometry(0.58, 0.03, 0.31);
  const skirtMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = 0.015;
  car.add(skirt);

  const hoodGeo = new THREE.BoxGeometry(0.15, 0.04, 0.28);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(0.22, 0.2, 0); hood.rotation.z = -0.15;
  car.add(hood);

  const cabinGeo = new THREE.BoxGeometry(0.28, 0.13, 0.26);
  const cabinMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(-0.04, 0.24, 0);
  car.add(cabin);

  const roofGeo = new THREE.BoxGeometry(0.25, 0.015, 0.24);
  const roofMat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(-0.04, 0.31, 0);
  car.add(roof);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.7, side: THREE.DoubleSide });

  const windshieldGeo = new THREE.PlaneGeometry(0.24, 0.11);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0.11, 0.24, 0); windshield.rotation.y = Math.PI / 2; windshield.rotation.z = 0.25;
  car.add(windshield);

  const rearWindow = new THREE.Mesh(windshieldGeo, glassMat);
  rearWindow.position.set(-0.19, 0.24, 0); rearWindow.rotation.y = Math.PI / 2; rearWindow.rotation.z = -0.25;
  car.add(rearWindow);

  const sideWinGeo = new THREE.PlaneGeometry(0.1, 0.08);
  [-1, 1].forEach(side => {
    [-0.08, 0.03].forEach(x => {
      const sw = new THREE.Mesh(sideWinGeo, glassMat);
      sw.position.set(x, 0.25, side * 0.131);
      car.add(sw);
    });
  });

  const pillarGeo = new THREE.BoxGeometry(0.015, 0.13, 0.01);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  [-0.131, 0.131].forEach(z => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(-0.025, 0.24, z);
    car.add(pillar);
  });

  const tireGeo = new THREE.TorusGeometry(0.05, 0.02, 12, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.025, 16);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });
  const hubGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.028, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.9 });

  const wheelPos: [number, number, number][] = [[-0.19, 0.0, 0.155], [0.19, 0.0, 0.155], [-0.19, 0.0, -0.155], [0.19, 0.0, -0.155]];
  wheelPos.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat); tire.position.set(wx, wy, wz); car.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; rim.position.set(wx, wy, wz); car.add(rim);
    const hub = new THREE.Mesh(hubGeo, hubMat); hub.rotation.x = Math.PI / 2; hub.position.set(wx, wy, wz); car.add(hub);
    const spokeGeo = new THREE.BoxGeometry(0.004, 0.05, 0.004);
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8 });
    [0, Math.PI / 2.5, Math.PI / 1.25, Math.PI * 1.5 / 2.5, Math.PI * 2 / 1.25].forEach(angle => {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.set(wx, wy, wz > 0 ? wz + 0.014 : wz - 0.014); spoke.rotation.z = angle;
      car.add(spoke);
    });
  });

  const headlightGeo = new THREE.BoxGeometry(0.01, 0.04, 0.06);
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  [-0.1, 0.1].forEach(z => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat); hl.position.set(0.3, 0.1, z); car.add(hl);
    const housingGeo = new THREE.BoxGeometry(0.015, 0.05, 0.07);
    const housingMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5 });
    const housing = new THREE.Mesh(housingGeo, housingMat); housing.position.set(0.298, 0.1, z); car.add(housing);
  });

  const tailGeo = new THREE.BoxGeometry(0.01, 0.035, 0.05);
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.1, 0.1].forEach(z => { const tl = new THREE.Mesh(tailGeo, tailMat); tl.position.set(-0.3, 0.1, z); car.add(tl); });

  const grilleGeo = new THREE.PlaneGeometry(0.01, 0.06);
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7, side: THREE.DoubleSide });
  for (let z = -0.08; z <= 0.08; z += 0.02) {
    const bar = new THREE.Mesh(grilleGeo, grilleMat); bar.position.set(0.301, 0.08, z); bar.rotation.y = Math.PI / 2; car.add(bar);
  }

  [-0.145, 0.145].forEach(z => {
    const mirrorGeo = new THREE.BoxGeometry(0.02, 0.015, 0.025);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: '#333' });
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat); mirror.position.set(0.05, 0.2, z); car.add(mirror);
    const glassGeo = new THREE.PlaneGeometry(0.015, 0.012);
    const mirrorGlass = new THREE.Mesh(glassGeo, glassMat); mirrorGlass.position.set(0.05, 0.2, z > 0 ? z + 0.013 : z - 0.013); car.add(mirrorGlass);
  });

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 96; plateCanvas.height = 36;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 96, 36);
  pctx.strokeStyle = '#333'; pctx.lineWidth = 2; pctx.strokeRect(1, 1, 94, 34);
  pctx.fillStyle = '#2c3e50'; pctx.font = 'bold 16px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 48, 25);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: plateTex }));
  plateMesh.position.set(-0.301, 0.05, 0); plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  const exhaustGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.06, 10);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.3 });
  const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust.position.set(-0.28, -0.02, 0.1); exhaust.rotation.z = Math.PI / 2;
  car.add(exhaust);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.65, 0.35, 0.35);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat); glow.position.y = 0.15; car.add(glow);
  }

  return car;
}

// ==================== TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  const ticketGeo = new THREE.BoxGeometry(0.42, 0.24, 0.015);
  const ticketMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  ticket.add(new THREE.Mesh(ticketGeo, ticketMat));

  const stubGeo = new THREE.BoxGeometry(0.1, 0.24, 0.015);
  const stubMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const stub = new THREE.Mesh(stubGeo, stubMat); stub.position.x = 0.26; ticket.add(stub);

  const dotGeo = new THREE.CircleGeometry(0.005, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let y = -0.1; y <= 0.1; y += 0.015) {
    const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.set(0.205, y, 0.009); ticket.add(dot);
  }

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 220; frontCanvas.height = 120;
  const fctx = frontCanvas.getContext('2d')!;
  fctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -120; i < 340; i += 12) {
    fctx.save(); fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i + 60, 120); fctx.lineTo(i + 66, 120); fctx.lineTo(i + 6, 0); fctx.closePath(); fctx.fill(); fctx.restore();
  }
  fctx.fillStyle = 'rgba(0,0,0,0.3)'; fctx.fillRect(0, 0, 220, 25);
  fctx.fillStyle = '#fff'; fctx.font = 'bold 14px Arial'; fctx.textAlign = 'center'; fctx.fillText('★ ADMIT ONE ★', 90, 18);
  fctx.font = 'bold 36px Arial'; fctx.fillText(label, 90, 68);
  fctx.strokeStyle = 'rgba(255,255,255,0.5)'; fctx.lineWidth = 1; fctx.beginPath(); fctx.moveTo(20, 80); fctx.lineTo(160, 80); fctx.stroke();
  fctx.font = 'bold 12px Arial'; fctx.fillText('⭐ VIP ACCESS ⭐', 90, 98);
  fctx.font = '9px Arial'; fctx.fillStyle = 'rgba(255,255,255,0.6)'; fctx.fillText('VALID TODAY ONLY', 90, 113);
  fctx.save(); fctx.translate(195, 60); fctx.rotate(-Math.PI / 2);
  fctx.fillStyle = '#fff'; fctx.font = 'bold 14px Arial'; fctx.textAlign = 'center'; fctx.fillText(label, 0, 0); fctx.restore();

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.22), new THREE.MeshBasicMaterial({ map: frontTex, transparent: true }));
  frontFace.position.z = 0.009; ticket.add(frontFace);

  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6, roughness: 0.3 });
  const hBorderGeo = new THREE.BoxGeometry(0.43, 0.005, 0.018);
  const topBorder = new THREE.Mesh(hBorderGeo, borderMat); topBorder.position.y = 0.12; ticket.add(topBorder);
  const bottomBorder = new THREE.Mesh(hBorderGeo, borderMat); bottomBorder.position.y = -0.12; ticket.add(bottomBorder);
  const vBorderGeo = new THREE.BoxGeometry(0.005, 0.24, 0.018);
  const leftBorder = new THREE.Mesh(vBorderGeo, borderMat); leftBorder.position.x = -0.21; ticket.add(leftBorder);
  const rightBorder = new THREE.Mesh(vBorderGeo, borderMat); rightBorder.position.x = 0.31; ticket.add(rightBorder);

  const backCanvas = document.createElement('canvas');
  backCanvas.width = 200; backCanvas.height = 60;
  const bctx = backCanvas.getContext('2d')!;
  bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, 200, 60);
  bctx.fillStyle = '#000';
  for (let i = 10; i < 190; i += 3) { const h = 30 + Math.random() * 15; bctx.fillRect(i, 10, 1.5, h); }
  bctx.font = '8px monospace'; bctx.textAlign = 'center'; bctx.fillText(label + '-' + Math.floor(Math.random() * 9999), 100, 55);
  const backTex = new THREE.CanvasTexture(backCanvas);
  const backFace = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.1), new THREE.MeshBasicMaterial({ map: backTex }));
  backFace.position.z = -0.009; backFace.rotation.y = Math.PI; ticket.add(backFace);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.46, 0.28, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    ticket.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return ticket;
}
// ==================== buildSceneContent ====================

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
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  const spacing = structure === 'linkedlist' ? 1.1
    : structure === 'queue' ? 0.95
    : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;

  // ========================================================
  // ==================== ARRAY =============================
  // ========================================================
  if (structure === 'array') {

    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.8;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const product = createGroceryBox(item.color, item.label, isHl);
        product.position.set(startX + i * spacing, 0.08, 0);
        if (isHl) product.position.y += 0.1;
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array');
        group.add(product);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.15, 0);
        idx.scale.set(0.3, 0.15, 1);
        group.add(idx);
      });

      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.03, 0.35), shelfMat);
      mainShelf.position.y = 0.06;
      group.add(mainShelf);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), shelfMat);
      lip.position.set(0, 0.08, 0.175);
      group.add(lip);
      const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.03, 0.35), shelfMat);
      lowerShelf.position.y = -0.35;
      group.add(lowerShelf);
      const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), shelfMat);
      lowerLip.position.set(0, -0.33, 0.175);
      group.add(lowerLip);

      const poleMat = new THREE.MeshStandardMaterial({ color: '#a0a0a0', metalness: 0.8, roughness: 0.2 });
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 12);
      const poleXs = [-shelfWidth / 2 + 0.05, shelfWidth / 2 - 0.05];
      if (data.length > 3) poleXs.push(0);
      poleXs.forEach(x => {
        [0.16, -0.14].forEach(z => {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(x, -0.1, z);
          group.add(pole);
        });
      });

      const stripCanvas = document.createElement('canvas');
      stripCanvas.width = 512; stripCanvas.height = 32;
      const sctx = stripCanvas.getContext('2d')!;
      sctx.fillStyle = '#2e7d32'; sctx.fillRect(0, 0, 512, 32);
      sctx.fillStyle = '#fff'; sctx.font = 'bold 16px Arial'; sctx.textAlign = 'center';
      sctx.fillText('★ FRESH ITEMS ★ BEST PRICE ★ FRESH ITEMS ★ BEST PRICE ★', 256, 22);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.06),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(stripCanvas) })
      );
      strip.position.set(0, 0.05, 0.178);
      group.add(strip);

      const backPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.85),
        new THREE.MeshStandardMaterial({ color: '#f5f5f5', side: THREE.DoubleSide, roughness: 0.9 })
      );
      backPanel.position.set(0, -0.05, -0.16);
      group.add(backPanel);

      const holeMat = new THREE.MeshBasicMaterial({ color: '#ddd', side: THREE.DoubleSide });
      const holeGeo = new THREE.CircleGeometry(0.008, 8);
      for (let hx = -shelfWidth / 2 + 0.1; hx < shelfWidth / 2; hx += 0.08) {
        for (let hy = -0.3; hy < 0.35; hy += 0.08) {
          const hole = new THREE.Mesh(holeGeo, holeMat);
          hole.position.set(hx, hy, -0.158);
          group.add(hole);
        }
      }

      const floorGeo = new THREE.PlaneGeometry(shelfWidth + 0.5, 0.8);
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#e8dcc8', side: THREE.DoubleSide }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.56;
      group.add(floor);

    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.5;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.8);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array');
          group.add(human);

          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.8);
          group.add(chair);

          const deskGeo = new THREE.BoxGeometry(0.3, 0.02, 0.2);
          const deskMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
          const desk = new THREE.Mesh(deskGeo, deskMat);
          desk.position.set(startX + i * spacing, -0.1, 0.2);
          desk.scale.setScalar(0.8);
          group.add(desk);

          const dlegGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
          const dlegMat = new THREE.MeshStandardMaterial({ color: '#666' });
          [[-0.12, -0.19, 0.08], [0.12, -0.19, 0.08], [-0.12, -0.19, -0.08], [0.12, -0.19, -0.08]].forEach(([dx, dy, dz]) => {
            const dleg = new THREE.Mesh(dlegGeo, dlegMat);
            dleg.position.set(startX + i * spacing + dx * 0.8, dy * 0.8 - 0.1, (dz + 0.2) * 0.8);
            group.add(dleg);
          });
        }

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.42, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.5),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.35;
      group.add(floor);

      const tileLineMat = new THREE.MeshBasicMaterial({ color: '#b39b7a', side: THREE.DoubleSide });
      for (let tx = -roomWidth / 2; tx <= roomWidth / 2; tx += 0.4) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 1.5), tileLineMat);
        line.rotation.x = -Math.PI / 2; line.position.set(tx, -0.349, 0);
        group.add(line);
      }

      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.0), wallMat);
      backWall.position.set(0, 0.1, -0.5);
      group.add(backWall);

      const boardGeo = new THREE.BoxGeometry(roomWidth * 0.6, 0.45, 0.02);
      const boardMat2 = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const board = new THREE.Mesh(boardGeo, boardMat2);
      board.position.set(0, 0.25, -0.48);
      group.add(board);

      const frameMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.5 });
      const hFrame = new THREE.BoxGeometry(roomWidth * 0.62, 0.02, 0.03);
      const topFrame = new THREE.Mesh(hFrame, frameMat); topFrame.position.set(0, 0.48, -0.47); group.add(topFrame);
      const botFrame = new THREE.Mesh(hFrame, frameMat); botFrame.position.set(0, 0.02, -0.47); group.add(botFrame);

      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 256; boardCanvas.height = 128;
      const bctx = boardCanvas.getContext('2d')!;
      bctx.fillStyle = '#2c3e50'; bctx.font = 'bold 24px Arial'; bctx.textAlign = 'center';
      bctx.fillText('Data Structures', 128, 40);
      bctx.font = '16px Arial'; bctx.fillText('Array: O(1) Access', 128, 70);
      bctx.fillText('Index: 0, 1, 2, ...', 128, 95);
      const boardTex = new THREE.CanvasTexture(boardCanvas);
      const boardText = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth * 0.55, 0.35),
        new THREE.MeshBasicMaterial({ map: boardTex, transparent: true })
      );
      boardText.position.set(0, 0.25, -0.468);
      group.add(boardText);

      [-roomWidth / 2, roomWidth / 2].forEach(x => {
        const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), wallMat);
        sideWall.position.set(x, 0.1, 0);
        sideWall.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        group.add(sideWall);
      });

      const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.5),
        new THREE.MeshStandardMaterial({ color: '#f5f5f0', side: THREE.DoubleSide })
      );
      ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 0.6;
      group.add(ceiling);

      for (let lx = -roomWidth / 3; lx <= roomWidth / 3; lx += roomWidth / 3) {
        const lightFixture = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.015, 0.08),
          new THREE.MeshBasicMaterial({ color: '#ffffee' })
        );
        lightFixture.position.set(lx, 0.59, 0);
        group.add(lightFixture);
      }

    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0);
        clipboard.scale.setScalar(0.7);
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array');
        group.add(clipboard);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.45, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      const deskWidth = data.length * spacing + 0.5;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(deskWidth, 0.04, 0.5),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.3;
      group.add(desk);

      const edgeGeo2 = new THREE.CylinderGeometry(0.02, 0.02, deskWidth, 16);
      const edge2 = new THREE.Mesh(edgeGeo2, new THREE.MeshStandardMaterial({ color: '#4a3520' }));
      edge2.rotation.z = Math.PI / 2; edge2.position.set(0, -0.3, 0.26);
      group.add(edge2);
    }

  // ========================================================
  // ==================== LINKED LIST =======================
  // ========================================================
  } else if (structure === 'linkedlist') {

    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0);
        trainCar.scale.setScalar(0.85);
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(trainCar);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.15;
          group.add(arrow);
          const ptrLabel = createTextSprite('next →', '#00ff00', 14);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.28, 0);
          ptrLabel.scale.set(0.3, 0.1, 1);
          group.add(ptrLabel);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 22);
      headSprite.position.set(startX, 0.6, 0); headSprite.scale.set(0.35, 0.14, 1);
      group.add(headSprite);
      const tailSprite = createTextSprite('TAIL', '#0066ff', 22);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.6, 0); tailSprite.scale.set(0.35, 0.14, 1);
      group.add(tailSprite);
      const nullSprite = createTextSprite('NULL', '#ff0000', 24);
      nullSprite.position.set(startX + data.length * spacing, 0, 0); nullSprite.scale.set(0.35, 0.25, 1);
      group.add(nullSprite);
      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.15, false);
      nullArrow.position.y = -0.15;
      group.add(nullArrow);

      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
      [-0.12, 0.12].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.12, z);
        group.add(rail);
      });

      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
      for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.18) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(x, -0.13, 0);
        group.add(tie);
      }

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2, 1),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.14;
      group.add(ground);

    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.75);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist');
          group.add(human);
        }
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = 0.1;
          group.add(arrow);
          const ptrLabel = createTextSprite('next →', '#00ff00', 14);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.05, 0);
          ptrLabel.scale.set(0.28, 0.08, 1);
          group.add(ptrLabel);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.55, 0); headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);
      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + data.length * spacing, 0.1, 0); nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);
      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
      nullArrow.position.y = 0.1;
      group.add(nullArrow);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1, 0.6),
        new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.17;
      group.add(floor);

    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        domino.scale.setScalar(0.85);
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(domino);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = -0.35;
          group.add(arrow);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.4, 0); headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, -0.35, 0); nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);
      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
      nullArrow.position.y = -0.35;
      group.add(nullArrow);

      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.8, 0.04, 0.6),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.3;
      group.add(table);

      const edgeMat3 = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 });
      const edgeGeo3 = new THREE.BoxGeometry(data.length * spacing + 0.85, 0.06, 0.04);
      [0.32, -0.32].forEach(z => {
        const edg = new THREE.Mesh(edgeGeo3, edgeMat3);
        edg.position.set(0, -0.3, z);
        group.add(edg);
      });
    }

  // ========================================================
  // ==================== STACK =============================
  // ========================================================
  } else if (structure === 'stack') {

    if (environment === 'books') {
      const stackSpacing = 0.12;
      const baseY = -data.length * stackSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const book = createBook(item.label, item.color, isHl);
        book.position.set(isHl ? 0.2 : 0, baseY + i * stackSpacing, 0);
        book.rotation.y = (i % 2 === 0) ? 0 : 0.05;
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack');
        group.add(book);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 24);
          topSprite.position.set(0.7, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.4, 0.15, 1);
          group.add(topSprite);
        }
      });

      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.04, 0.7),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = baseY - 0.1;
      group.add(desk);

    } else if (environment === 'plates') {
      const plateSpacing = 0.05;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plate = createPlate(item.label, isHl);
        plate.position.set(isHl ? 0.15 : 0, plateBaseY + i * plateSpacing, 0);
        plate.scale.setScalar(0.65);
        applyItemAnimation(plate, i, animPhase || '', animData || {}, 'stack');
        group.add(plate);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 24);
          topSprite.position.set(0.5, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.35, 0.12, 1);
          group.add(topSprite);
        }
      });

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.06, 0.6),
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.06;
      group.add(counter);

      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.3),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      panel.position.set(0, plateBaseY - 0.2, 0.3);
      group.add(panel);

      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256; signCanvas.height = 48;
      const sctx2 = signCanvas.getContext('2d')!;
      sctx2.fillStyle = '#e74c3c'; sctx2.fillRect(0, 0, 256, 48);
      sctx2.fillStyle = '#fff'; sctx2.font = 'bold 28px Arial'; sctx2.textAlign = 'center';
      sctx2.fillText('🍽️ CAFETERIA 🍽️', 128, 35);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signCanvas), transparent: true })
      );
      signSprite.position.set(0, plateBaseY + data.length * plateSpacing + 0.3, 0);
      signSprite.scale.set(0.8, 0.15, 1);
      group.add(signSprite);

    } else if (environment === 'boxes') {
      const boxSpacing = 0.42;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const isPeeking = animPhase === 'stack-peek-open' && isTop && isHl;
        const box = createCardboardBox(item.label, item.color, isHl, isPeeking);
        box.position.set(isHl ? 0.2 : 0, boxBaseY + i * boxSpacing, 0);
        box.rotation.y = (i % 2 === 0) ? 0 : 0.06;
        box.scale.setScalar(0.82);
        applyItemAnimation(box, i, animPhase || '', animData || {}, 'stack');
        group.add(box);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 24);
          topSprite.position.set(0.6, boxBaseY + i * boxSpacing, 0);
          topSprite.scale.set(0.35, 0.12, 1);
          group.add(topSprite);
        }
      });

      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.06, 0.65),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.24;
      group.add(pallet);

      const slatGeo = new THREE.BoxGeometry(0.85, 0.015, 0.08);
      const slatMat = new THREE.MeshStandardMaterial({ color: '#8b6914' });
      [-0.25, 0, 0.25].forEach(z => {
        const slat = new THREE.Mesh(slatGeo, slatMat);
        slat.position.set(0, boxBaseY - 0.28, z);
        group.add(slat);
      });
    }

  // ========================================================
  // ==================== QUEUE =============================
  // ========================================================
  } else if (structure === 'queue') {

    if (environment === 'tollgate') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        car.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        car.scale.setScalar(0.82);
        applyItemAnimation(car, i, animPhase || '', animData || {}, 'queue');
        group.add(car);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 20);
      frontSprite.position.set(startX, -0.22, 0); frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);
      const rearSprite = createTextSprite('REAR', '#ff6600', 20);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0); rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      const gateX = startX - 0.8;
      const poleMat2 = new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.5 });
      const poleGeo2 = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 12);
      [0.25, -0.25].forEach(z => {
        const pole = new THREE.Mesh(poleGeo2, poleMat2);
        pole.position.set(gateX, 0.25, z);
        group.add(pole);
      });

      const topBarGeo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
      const topBar = new THREE.Mesh(topBarGeo, poleMat2);
      topBar.position.set(gateX, 0.6, 0);
      group.add(topBar);

      const barrierGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
      const barrier = new THREE.Mesh(barrierGeo, new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
      barrier.position.set(gateX - 0.25, 0.5, 0); barrier.rotation.z = 0.3;
      group.add(barrier);

      const stripeMat2 = new THREE.MeshStandardMaterial({ color: '#ffffff' });
      for (let sx = -0.2; sx < 0.2; sx += 0.08) {
        const stripeGeo2 = new THREE.BoxGeometry(0.03, 0.045, 0.045);
        const stripeM = new THREE.Mesh(stripeGeo2, stripeMat2);
        stripeM.position.set(gateX - 0.25 + sx, 0.5, 0); stripeM.rotation.z = 0.3;
        group.add(stripeM);
      }

      const signCanvas2 = document.createElement('canvas');
      signCanvas2.width = 128; signCanvas2.height = 48;
      const signCtx = signCanvas2.getContext('2d')!;
      signCtx.fillStyle = '#2c3e50'; signCtx.fillRect(0, 0, 128, 48);
      signCtx.fillStyle = '#fff'; signCtx.font = 'bold 28px Arial'; signCtx.textAlign = 'center'; signCtx.fillText('TOLL', 64, 36);
      const signSprite2 = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signCanvas2), transparent: true })
      );
      signSprite2.position.set(gateX, 0.72, 0); signSprite2.scale.set(0.35, 0.13, 1);
      group.add(signSprite2);

      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.7),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2; road.position.y = -0.08;
      group.add(road);

      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 1; x <= startX + data.length * spacing + 0.5; x += 0.25) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.025), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(x, -0.075, 0);
        group.add(dash);
      }

      const exitSprite = createTextSprite('EXIT →', '#00ff00', 22);
      exitSprite.position.set(gateX - 0.6, 0.3, 0); exitSprite.scale.set(0.35, 0.12, 1);
      group.add(exitSprite);

    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticket = createTicket(item.label, item.color, isHl);
        ticket.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        ticket.scale.setScalar(0.82);
        applyItemAnimation(ticket, i, animPhase || '', animData || {}, 'queue');
        group.add(ticket);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 20);
      frontSprite.position.set(startX, -0.22, 0); frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);
      const rearSprite = createTextSprite('REAR', '#ff6600', 20);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0); rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.15;
      group.add(counter);

      const servingCanvas = document.createElement('canvas');
      servingCanvas.width = 200; servingCanvas.height = 64;
      const svctx = servingCanvas.getContext('2d')!;
      svctx.fillStyle = '#1a1a2e'; svctx.fillRect(0, 0, 200, 64);
      svctx.strokeStyle = '#ffd700'; svctx.lineWidth = 2; svctx.strokeRect(3, 3, 194, 58);
      svctx.fillStyle = '#00ff00'; svctx.font = 'bold 14px Arial'; svctx.textAlign = 'center';
      svctx.fillText('NOW SERVING', 100, 22);
      svctx.font = 'bold 28px Arial'; svctx.fillStyle = '#ff0';
      svctx.fillText(data.length > 0 ? data[0].label : '---', 100, 52);
      const servingSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(servingCanvas), transparent: true })
      );
      servingSprite.position.set(startX - 0.6, 0.2, 0); servingSprite.scale.set(0.45, 0.15, 1);
      group.add(servingSprite);

    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.68);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue');
          group.add(human);
        }
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.2, 0); frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);
      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0); rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      const buildingX = startX - 0.9;
      const wallMat2 = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.8 });
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.8), wallMat2);
      frontWall.position.set(buildingX, 0.2, 0);
      group.add(frontWall);

      const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 });
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.35), doorFrameMat);
      doorFrame.position.set(buildingX + 0.02, 0.1, 0);
      group.add(doorFrame);

      const doorMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.7 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.15), doorMat);
      door.position.set(buildingX + 0.05, 0.08, 0.12); door.rotation.y = -0.8;
      group.add(door);

      const schoolCanvas = document.createElement('canvas');
      schoolCanvas.width = 200; schoolCanvas.height = 48;
      const schCtx = schoolCanvas.getContext('2d')!;
      schCtx.fillStyle = '#1a5276'; schCtx.fillRect(0, 0, 200, 48);
      schCtx.strokeStyle = '#ffd700'; schCtx.lineWidth = 3; schCtx.strokeRect(2, 2, 196, 44);
      schCtx.fillStyle = '#fff'; schCtx.font = 'bold 16px Arial'; schCtx.textAlign = 'center';
      schCtx.fillText('📚 DS ACADEMY 📚', 100, 32);
      const schoolSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(schoolCanvas), transparent: true })
      );
      schoolSprite.position.set(buildingX, 0.62, 0); schoolSprite.scale.set(0.5, 0.12, 1);
      group.add(schoolSprite);

      const roofGeo2 = new THREE.BoxGeometry(0.1, 0.04, 0.85);
      const roofMat2 = new THREE.MeshStandardMaterial({ color: '#c0392b' });
      const roofMesh = new THREE.Mesh(roofGeo2, roofMat2);
      roofMesh.position.set(buildingX, 0.57, 0);
      group.add(roofMesh);

      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.5),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2; pathway.position.y = -0.14;
      group.add(pathway);

      const pathLineMat = new THREE.MeshBasicMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
      [-0.2, 0.2].forEach(z => {
        const pathLine = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.01), pathLineMat);
        pathLine.rotation.x = -Math.PI / 2; pathLine.position.set(0, -0.139, z);
        group.add(pathLine);
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
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animPhase, setAnimPhase] = useState('');
  const [animData, setAnimData] = useState<Record<string, any>>({});

  const [appMode, setAppMode] = useState<AppMode>('person');
  const [surfacePosition, setSurfacePosition] = useState<Position | null>(null);
  const [surfacePlaced, setSurfacePlaced] = useState(false);
  const [isDraggingSurface, setIsDraggingSurface] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Drag & Drop states
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging3D, setIsDragging3D] = useState(false);

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
  const currentEnvId = currentStructure === 'array' ? arrayEnv : currentStructure === 'linkedlist' ? linkedListEnv : currentStructure === 'stack' ? stackEnv : queueEnv;
  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv : currentStructure === 'linkedlist' ? setLinkedListEnv : currentStructure === 'stack' ? setStackEnv : setQueueEnv;
  const currentData = getCurrentData();

  const zoomIn = useCallback(() => setZoomLevel(prev => prev + 0.25), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.1)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  // ==================== CAMERA ====================

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
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  // ==================== PERSON DETECTION ====================

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

  // ==================== WEBXR ====================

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
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-5, 5, -5); scene.add(backLight);
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
      xrCameraRef.current = camera;
      const group = new THREE.Group(); group.visible = false; scene.add(group); xrGroupRef.current = group;
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); xrReticleRef.current = reticle;
      reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ff00 })));
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
    } catch (err: any) { console.error(err); alert('WebXR failed. Using Surface mode.'); setAppMode('surface'); }
  };

  useEffect(() => {
    if (appMode !== 'webxr' || !webxrPlaced || !xrGroupRef.current) return;
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData);
  }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData]);

  useEffect(() => {
    if (xrGroupRef.current && webxrActive && webxrPlaced) xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
  }, [zoomLevel, webxrActive, webxrPlaced]);

  const resetWebXRPlacement = useCallback(() => {
    if (xrGroupRef.current) xrGroupRef.current.visible = false;
    setWebxrPlaced(false);
  }, []);

  // ==================== MODE SWITCHING ====================

  const switchToMode = useCallback((mode: AppMode) => {
    if (appMode === 'webxr' && mode !== 'webxr') stopWebXR();
    if (mode === 'webxr') {
      if (!webxrSupported) { alert('WebXR not supported. Using Surface mode.'); mode = 'surface'; }
      else { startWebXR(); return; }
    }
    setAppMode(mode);
    if (mode === 'surface') { setDetectedPerson(null); setPersonPosition(null); setSurfacePlaced(false); setSurfacePosition(null); }
    else if (mode === 'person') { setSurfacePlaced(false); setSurfacePosition(null); }
  }, [appMode, webxrSupported, stopWebXR]);

  // ==================== SURFACE HANDLERS ====================

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

  // ==================== DRAG & DROP ====================

  const getCurrentSetData = useCallback(() => {
    if (currentStructure === 'array') {
      return arrayEnv === 'grocery' ? setGroceryItems
        : arrayEnv === 'classroom' ? setStudents
        : setTasks;
    } else if (currentStructure === 'linkedlist') {
      return linkedListEnv === 'train' ? setTrainCars
        : linkedListEnv === 'people' ? setPeopleLine
        : setDominoNodes;
    } else if (currentStructure === 'stack') {
      return stackEnv === 'books' ? setBookStack
        : stackEnv === 'plates' ? setPlateStack
        : setBoxStack;
    } else {
      return queueEnv === 'tollgate' ? setTollGate
        : queueEnv === 'tickets' ? setTicketQueue
        : setStudentQueue;
    }
  }, [currentStructure, arrayEnv, linkedListEnv, stackEnv, queueEnv]);

  const handleDragDrop = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || isAnimating) return;

    setIsAnimating(true);
    const data = getCurrentData();

    // Step 1: Highlight the picked item
    setHighlightIndex(fromIndex);
    setOperationMessage(`Dragging "${data[fromIndex].label}" from [${fromIndex}]...`);
    setCodeDisplay(`// Drag & Drop\n// Moving [${fromIndex}] → [${toIndex}]`);
    setAnimPhase('access-lift');
    setAnimData({ index: fromIndex });
    await delay(300);

    // Step 2: Show where it's going
    setHighlightIndex2(toIndex);
    setOperationMessage(`Moving "${data[fromIndex].label}" to [${toIndex}]...`);
    setAnimPhase('swap-lift');
    setAnimData({ index1: fromIndex, index2: toIndex });
    await delay(400);

    // Step 3: Perform the reorder
    const setter = getCurrentSetData();
    (setter as any)((prev: DataItem[]) => {
      const newArr = [...prev];
      const [removed] = newArr.splice(fromIndex, 1);
      newArr.splice(toIndex, 0, removed);
      return newArr;
    });

    // Step 4: Drop animation
    setAnimPhase('swap-drop');
    setAnimData({ index1: toIndex, index2: fromIndex });
    await delay(400);

    // Step 5: Settle
    setAnimPhase('access-settle');
    setAnimData({ index: toIndex });
    setHighlightIndex(toIndex);
    setHighlightIndex2(null);
    setOperationMessage(`Dropped "${data[fromIndex].label}" at [${toIndex}]!`);
    await delay(600);

    // Step 6: Clean up
    setAnimPhase('');
    setAnimData({});
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  }, [isAnimating, getCurrentData, getCurrentSetData]);

  // ==================== ARRAY OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData(), index = Math.floor(Math.random() * data.length);
    setHighlightIndex(index);
    setOperationMessage(`Accessing [${index}]...`);
    setCodeDisplay(`// O(1) Access\narray[${index}]`);
    setAnimPhase('access-lift'); setAnimData({ index }); await delay(400);
    setAnimPhase('access-bounce');
    setOperationMessage(`Found: "${data[index].label}"`); await delay(900);
    setAnimPhase('access-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating || getArrayData().length >= 6) return; setIsAnimating(true);
    const data = getArrayData(), insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(250); }
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' }); return arr;
    });
    setHighlightIndex(insertIndex);
    setAnimPhase('insert-drop'); setAnimData({ index: insertIndex }); await delay(500);
    setAnimPhase('insert-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Inserted!'); await delay(800);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return; setIsAnimating(true);
    const data = getArrayData(), deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]: "${data[deleteIndex].label}"`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    setAnimPhase('delete-lift'); setAnimData({ index: deleteIndex }); await delay(500);
    setAnimPhase('delete-shrink'); await delay(500);
    setHighlightIndex(null); setAnimPhase('delete-close'); setAnimData({ deleteIndex });
    (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex));
    await delay(500);
    setAnimPhase(''); setAnimData({});
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData();
    const idx1 = Math.floor(Math.random() * data.length);
    let idx2 = Math.floor(Math.random() * data.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * data.length);
    setHighlightIndex(idx1); setHighlightIndex2(idx2);
    setOperationMessage(`Swapping [${idx1}] ↔ [${idx2}]`);
    setCodeDisplay('// O(1) Swap');
    setAnimPhase('swap-lift'); setAnimData({ index1: idx1, index2: idx2 }); await delay(500);
    setAnimPhase('swap-cross'); await delay(400);
    (setArrayData as any)((prev: DataItem[]) => { const a = [...prev]; [a[idx1], a[idx2]] = [a[idx2], a[idx1]]; return a; });
    setAnimPhase('swap-drop'); await delay(500);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setHighlightIndex2(null);
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== LINKED LIST OPERATIONS ====================

  const linkedListInsertHead = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    setOperationMessage('Inserting at HEAD...');
    setCodeDisplay('// O(1)\nnewNode.next = head\nhead = newNode');
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#1abc9c' };
    (setLinkedListData as any)((prev: DataItem[]) => [newItem, ...prev]);
    setHighlightIndex(0);
    setAnimPhase('ll-insert-head'); setAnimData({ index: 0 }); await delay(500);
    setAnimPhase('ll-insert-head-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Inserted at HEAD!'); await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    const data = getLinkedListData();
    setOperationMessage('Traversing to TAIL...');
    setCodeDisplay('// O(n) Traverse');
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i); setAnimPhase('ll-traverse'); setAnimData({ index: i }); await delay(350);
    }
    setAnimPhase(''); setAnimData({});
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#e74c3c' };
    (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('ll-insert-tail'); setAnimData({ index: data.length }); await delay(500);
    setAnimPhase('ll-insert-tail-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Inserted at TAIL!'); await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating || getLinkedListData().length <= 2) return; setIsAnimating(true);
    setHighlightIndex(0);
    setOperationMessage('Deleting HEAD...');
    setCodeDisplay('// O(1)\nhead = head.next');
    setAnimPhase('ll-delete-lift'); setAnimData({ index: 0 }); await delay(500);
    setAnimPhase('ll-delete-shrink'); await delay(500);
    (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1));
    setAnimPhase(''); setAnimData({});
    await delay(500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getLinkedListData();
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Visiting: ${data[i].label}`);
      setCodeDisplay(`// Node ${i}\ncurr = curr.next`);
      setAnimPhase('ll-traverse'); setAnimData({ index: i }); await delay(500);
    }
    setAnimPhase(''); setAnimData({});
    setOperationMessage(`Done! ${data.length} nodes`); await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== STACK OPERATIONS ====================

  const stackPush = async () => {
    if (isAnimating || getStackData().length >= 5) return; setIsAnimating(true);
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c'] : ['#7f8c8d'];
    const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] };
    setOperationMessage(`Pushing "${newItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.push("${newItem.label}")`);
    (setStackData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('stack-push-drop'); setAnimData({ index: data.length }); await delay(500);
    setAnimPhase('stack-push-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Pushed!'); await delay(800);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating || getStackData().length <= 1) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping "${topItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`);
    setAnimPhase('stack-pop-lift'); setAnimData({ index: data.length - 1 }); await delay(500);
    setAnimPhase('stack-pop-fly'); await delay(500);
    (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1));
    setAnimPhase(''); setAnimData({});
    await delay(500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating || getStackData().length === 0) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Peeking TOP...`);
    setCodeDisplay(`// O(1)\nstack.peek()`);
    setAnimPhase('stack-peek-lift'); setAnimData({ index: data.length - 1 }); await delay(400);
    setAnimPhase('stack-peek-open');
    setOperationMessage(`TOP: "${topItem.label}"`); await delay(1200);
    setAnimPhase('stack-peek-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== QUEUE OPERATIONS ====================

  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return; setIsAnimating(true);
    const data = getQueueData();
    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: queueEnv === 'tollgate' ? 'New Car' : `T-00${data.length + 1}`, color: '#1abc9c' };
    setOperationMessage(`Enqueue: "${newItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.enqueue("${newItem.label}")`);
    (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('queue-enqueue-enter'); setAnimData({ index: data.length }); await delay(500);
    setAnimPhase('queue-enqueue-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Enqueued!'); await delay(800);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating || getQueueData().length <= 1) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`);
    setAnimPhase('queue-dequeue-exit'); setAnimData({ index: 0 }); await delay(600);
    setAnimPhase('queue-dequeue-gone'); await delay(400);
    (setQueueData as any)((prev: DataItem[]) => prev.slice(1));
    setAnimPhase(''); setAnimData({});
    await delay(500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`);
    setAnimPhase('queue-front-peek'); setAnimData({ index: 0 }); await delay(1500);
    setAnimPhase(''); setAnimData({});
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

  const envTabs = currentStructure === 'array'
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

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
          isSurfaceMode={appMode === 'surface'} animPhase={animPhase} animData={animData}
          onDragDrop={handleDragDrop} />
      )}

      {/* SHADOW REMOVED — was here before */}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {!webxrActive && <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200 }}>🔄</button>}

        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5, cursor: 'pointer' }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5, cursor: 'pointer' }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'webxr' ? '#e17055' : 'transparent', color: 'white', opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25, cursor: webxrSupported ? 'pointer' : 'not-allowed' }}>🌐 WebXR{!webxrSupported && ' ✗'}</button>
        </div>

        {showControls && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={zoomIn} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={zoomOut} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
            <button onPointerDown={resetZoom} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
          </div>
        )}

        <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
            <button key={s} onClick={() => { if (!isAnimating) { setCurrentStructure(s); if (appMode === 'surface') { setSurfacePlaced(false); setSurfacePosition(null); } } }}
              style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}{currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
            </button>
          ))}
        </div>

        {showControls && (
          <div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as any)(e.id)}
                style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        )}

        {operationMessage && <div style={{ position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px', borderRadius: 15, fontSize: 14, border: '1px solid #0f0', whiteSpace: 'nowrap' }}>⚡ {operationMessage}</div>}
        {codeDisplay && <div style={{ position: 'absolute', top: 168, left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444' }}>{codeDisplay}</div>}
        {webxrActive && <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '10px 18px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 13, fontWeight: 'bold', zIndex: 300 }}>✕ Exit AR</button>}
      </div>

      {showControls && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          {appMode === 'surface' && surfacePlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetSurfacePlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 10 }}>or drag to move</span>
            </div>
          )}
          {appMode === 'webxr' && webxrPlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (<>
              <OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
              <OpBtn onClick={arrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Insert" />
              <OpBtn onClick={arrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="➖ Delete" />
              <OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
            </>)}
            {currentStructure === 'linkedlist' && (<>
              <OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" />
              <OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" />
              <OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" />
              <OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" />
            </>)}
            {currentStructure === 'stack' && (<>
              <OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
              <OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" />
              <OpBtn onClick={stackPeek} disabled={isAnimating} color="#f39c12" label="👁️ Peek" />
            </>)}
            {currentStructure === 'queue' && (<>
              <OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
              <OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" />
              <OpBtn onClick={queueFront} disabled={isAnimating} color="#f39c12" label="👁️ Front" />
            </>)}
          </div>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>💡 Long press + drag items to reorder</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {currentData.length}
            {appMode === 'surface' && <span style={{ marginLeft: 10, color: '#00b894' }}>📱 Surface</span>}
            {appMode === 'webxr' && <span style={{ marginLeft: 10, color: '#e17055' }}>🌐 WebXR</span>}
          </div>
        </div>
      )}

      {appMode === 'person' && !detectedPerson && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🧑</div><div style={{ marginTop: 8 }}>Point camera at a person</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>or switch to Surface / WebXR →</div>
        </div>
      )}
      {appMode === 'surface' && !surfacePlaced && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div><div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Tap anywhere to place your data structure</div>
          <style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      )}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning for surfaces...</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Point at floor or table, tap to place</div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); opacity: 0.7; } }`}</style>
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

// ==================== VISUALIZATION 3D (WITH DRAG & DROP) ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode, animPhase, animData, onDragDrop }: {
  position: Position; data: DataItem[]; highlightIndex: number | null; highlightIndex2: number | null;
  structure: DataStructure; environment: string; zoomLevel: number; setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean; animPhase: string; animData: Record<string, any>;
  onDragDrop?: (fromIndex: number, toIndex: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Drag & drop refs
  const dragItemIndexRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragThreshold = 15;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  // Step 1: Helper to get item index from screen position via raycasting
  const getItemIndexAtPosition = useCallback((clientX: number, clientY: number): number | null => {
    if (!sceneRef.current || !cameraRef.current || !groupRef.current) return null;

    const mouse = new THREE.Vector2();
    mouse.x = (clientX / renderWidth) * 2 - 1;
    mouse.y = -(clientY / renderHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(groupRef.current.children, true);
    if (intersects.length === 0) return null;

    // Step 2: Walk up to find which top-level child of group was hit
    let hitObject = intersects[0].object;
    while (hitObject.parent && hitObject.parent !== groupRef.current) {
      hitObject = hitObject.parent;
    }

    // Step 3: Find closest item index based on position
    const spacing = structure === 'linkedlist' ? 1.1
      : structure === 'queue' ? 0.95
      : 0.85;
    const startX = -((data.length - 1) * spacing) / 2;

    // Step 4: For stacks use Y position matching
    if (structure === 'stack') {
      const stackSpacing = environment === 'books' ? 0.12
        : environment === 'plates' ? 0.05
        : 0.42;
      const baseY = -data.length * stackSpacing / 2;

      let closestIndex = -1;
      let closestDist = Infinity;

      for (let i = 0; i < data.length; i++) {
        const itemY = baseY + i * stackSpacing;
        const dist = Math.abs(hitObject.position.y - itemY);
        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
        }
      }

      if (closestIndex >= 0 && closestDist < stackSpacing * 1.5) return closestIndex;
      return null;
    }

    // Step 5: For horizontal structures match by X position
    let closestIndex = -1;
    let closestDist = Infinity;

    for (let i = 0; i < data.length; i++) {
      const itemX = startX + i * spacing;
      const dist = Math.abs(hitObject.position.x - itemX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    if (closestIndex >= 0 && closestDist < spacing * 0.8) return closestIndex;
    return null;
  }, [data.length, structure, environment, renderWidth, renderHeight]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Step 6: Create Three.js scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.2 : 0.5, structure === 'stack' ? 5 : 4.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
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
    const fillLight = new THREE.PointLight(0xffffff, 0.3);
    fillLight.position.set(0, -3, 3); scene.add(fillLight);

    const group = new THREE.Group(); groupRef.current = group; scene.add(group);

    // Step 7: Touch and mouse event handlers with drag & drop
    let isRotating = false, lastX = 0, lastY = 0, pinchDist: number | null = null, pinchZoom = 1;
    const getDist = (t: TouchList): number | null => { if (t.length < 2) return null; const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); };

    // Step 8: Touch start — begin long press timer for drag
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        pinchDist = getDist(e.touches); pinchZoom = zoomRef.current;
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        dragActiveRef.current = false; dragItemIndexRef.current = null; isLongPressRef.current = false;
      } else if (e.touches.length === 1) {
        const cx = e.touches[0].clientX, cy = e.touches[0].clientY;
        dragStartPosRef.current = { x: cx, y: cy }; isLongPressRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
          const itemIndex = getItemIndexAtPosition(cx, cy);
          if (itemIndex !== null) {
            isLongPressRef.current = true; dragActiveRef.current = true; dragItemIndexRef.current = itemIndex;
            if (navigator.vibrate) navigator.vibrate(50);
          }
        }, 400);
        lastX = cx; lastY = cy;
      }
    };

    // Step 9: Touch move — either drag item or rotate scene
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const d = getDist(e.touches); if (d) setZoomLevel(Math.max(0.1, pinchZoom * (d / pinchDist)));
      } else if (e.touches.length === 1) {
        const cx = e.touches[0].clientX, cy = e.touches[0].clientY;
        const dx = cx - dragStartPosRef.current.x, dy = cy - dragStartPosRef.current.y;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (!isLongPressRef.current && moved > dragThreshold) {
          if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
          isRotating = true;
        }
        if (dragActiveRef.current && isLongPressRef.current) {
          // Dragging item — no rotation
        } else if (isRotating) {
          rotationRef.current.y += (cx - lastX) * 0.01; rotationRef.current.x += (cy - lastY) * 0.008;
        }
        lastX = cx; lastY = cy;
      }
    };

    // Step 10: Touch end — find drop target and trigger drag & drop
    const onTE = (e: TouchEvent) => {
      e.preventDefault();
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      if (e.touches.length < 2) pinchDist = null;
      if (e.touches.length === 0) {
        if (dragActiveRef.current && dragItemIndexRef.current !== null && isLongPressRef.current) {
          const dropIndex = getItemIndexAtPosition(lastX, lastY);
          if (dropIndex !== null && dropIndex !== dragItemIndexRef.current && onDragDrop) {
            onDragDrop(dragItemIndexRef.current, dropIndex);
          }
        }
        dragActiveRef.current = false; dragItemIndexRef.current = null; isLongPressRef.current = false; isRotating = false;
      }
    };

    // Step 11: Mouse down — start long press for drag on desktop
    const onMD = (e: MouseEvent) => {
      dragStartPosRef.current = { x: e.clientX, y: e.clientY }; isLongPressRef.current = false;
      const itemIndex = getItemIndexAtPosition(e.clientX, e.clientY);
      if (itemIndex !== null) {
        dragItemIndexRef.current = itemIndex;
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true; dragActiveRef.current = true;
          if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
        }, 300);
      }
      lastX = e.clientX; lastY = e.clientY;
    };

    // Step 12: Mouse move — drag or rotate
    const onMM = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPosRef.current.x, dy = e.clientY - dragStartPosRef.current.y;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (!isLongPressRef.current && moved > dragThreshold) {
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        dragItemIndexRef.current = null; isRotating = true;
      }
      if (dragActiveRef.current && isLongPressRef.current) {
        // Dragging — no rotate
      } else if (isRotating) {
        rotationRef.current.y += (e.clientX - lastX) * 0.01; rotationRef.current.x += (e.clientY - lastY) * 0.008;
      }
      lastX = e.clientX; lastY = e.clientY;
    };

    // Step 13: Mouse up — find drop target
    const onMU = (e: MouseEvent) => {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      if (dragActiveRef.current && dragItemIndexRef.current !== null && isLongPressRef.current) {
        const dropIndex = getItemIndexAtPosition(e.clientX, e.clientY);
        if (dropIndex !== null && dropIndex !== dragItemIndexRef.current && onDragDrop) {
          onDragDrop(dragItemIndexRef.current, dropIndex);
        }
      }
      dragActiveRef.current = false; dragItemIndexRef.current = null; isLongPressRef.current = false; isRotating = false;
      if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    // Step 14: Mouse wheel for zoom
    const onWH = (e: WheelEvent) => { e.preventDefault(); setZoomLevel(Math.max(0.1, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15))); };

    // Step 15: Attach all event listeners
    container.addEventListener('touchstart', onTS, { passive: false });
    container.addEventListener('touchmove', onTM, { passive: false });
    container.addEventListener('touchend', onTE, { passive: false });
    container.addEventListener('mousedown', onMD);
    container.addEventListener('mousemove', onMM);
    container.addEventListener('mouseup', onMU);
    container.addEventListener('mouseleave', onMU);
    container.addEventListener('wheel', onWH, { passive: false });

    // Step 16: Animation loop
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

    // Step 17: Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationId);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
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
  }, [structure, renderWidth, renderHeight, getItemIndexAtPosition, onDragDrop]);

  // Step 18: Rebuild scene when data changes
  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData);
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto', overflow: 'visible' }} />;
}
