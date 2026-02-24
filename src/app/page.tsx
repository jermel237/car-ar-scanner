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

// ==================== DISPOSE HELPER (NEW) ====================

function disposeGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => {
          if ((m as any).map) (m as any).map.dispose();
          m.dispose();
        });
      } else if (child.material) {
        if ((child.material as any).map) (child.material as any).map.dispose();
        child.material.dispose();
      }
    }
    if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
    if ((child as any).children?.length > 0) {
      disposeGroup(child as THREE.Group);
    }
  }
}

// ==================== PARTICLE SYSTEM (NEW) ====================

function createParticleSystem(): THREE.Points {
  const count = 80;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 3 - 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    speeds[i] = Math.random() * 0.3 + 0.1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  (geo as any)._speeds = speeds;
  const mat = new THREE.PointsMaterial({
    color: 0x667eea,
    size: 0.025,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

// ==================== GROUND GRID (NEW) ====================

function createGroundGrid(): THREE.Group {
  const gridGroup = new THREE.Group();
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  gridGroup.add(ground);

  const gridHelper = new THREE.GridHelper(12, 24, 0x667eea, 0x334477);
  gridHelper.position.y = -0.59;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.15;
  gridGroup.add(gridHelper);

  const glowCircleGeo = new THREE.RingGeometry(0.5, 2.5, 64);
  const glowCircleMat = new THREE.MeshBasicMaterial({
    color: 0x667eea, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
  });
  const glowCircle = new THREE.Mesh(glowCircleGeo, glowCircleMat);
  glowCircle.rotation.x = -Math.PI / 2;
  glowCircle.position.y = -0.58;
  gridGroup.add(glowCircle);
  return gridGroup;
}

// ==================== PULSING HIGHLIGHT RING (NEW) ====================

function createPulsingHighlightRing(radius: number = 0.15): THREE.Group {
  const ringGroup = new THREE.Group();
  ringGroup.userData.isGlow = true;
  const innerRingGeo = new THREE.RingGeometry(radius - 0.02, radius, 48);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  ringGroup.add(innerRing);

  const outerRingGeo = new THREE.RingGeometry(radius, radius + 0.06, 48);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.userData.isGlow = true;
  ringGroup.add(outerRing);

  const dashCount = 12;
  for (let i = 0; i < dashCount; i++) {
    const angle = (i / dashCount) * Math.PI * 2;
    const dashGeo = new THREE.BoxGeometry(0.015, 0.003, 0.003);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(Math.cos(angle) * (radius + 0.04), 0, Math.sin(angle) * (radius + 0.04));
    dash.rotation.y = angle;
    ringGroup.add(dash);
  }
  ringGroup.userData.rotates = true;
  return ringGroup;
}

// ==================== TEXT SPRITE (IMPROVED) ====================

function createTextSprite(text: string, color: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const isHighlightColor = color === '#ffff00' || color === '#ff0000' || color === '#00ff00' || color === '#ff4444' || color === '#ff8800';

  ctx.font = `bold ${fontSize + 8}px 'Segoe UI', Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const pillW = Math.min(480, Math.max(metrics.width + 50, 80));
  const pillH = 60;
  const px = (512 - pillW) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(px, 30, pillW, pillH, 30);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, 30, pillW, pillH, 30);
  ctx.stroke();

  if (isHighlightColor) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 60);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

// ==================== ARROW (IMPROVED) ====================

function createArrow(fromX: number, toX: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;
  const midY = 0;
  const points = [new THREE.Vector3(fromX + 0.35, midY, 0), new THREE.Vector3(toX - 0.35, midY, 0)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  arrow.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.9 })));

  const coneGeo = new THREE.ConeGeometry(0.07, 0.14, 12);
  const coneMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: isHighlighted ? 0.6 : 0.3, metalness: 0.3, roughness: 0.4,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(toX - 0.4, midY, 0);
  cone.rotation.z = -Math.PI / 2;
  cone.castShadow = true;
  if (isHighlighted) cone.userData.pulseEmissive = true;
  arrow.add(cone);

  const glowGeo = new THREE.BufferGeometry().setFromPoints(points);
  const glowLine = new THREE.Line(glowGeo, new THREE.LineBasicMaterial({
    color: isHighlighted ? 0xffff00 : 0x00ff00, transparent: true, opacity: 0.3,
  }));
  glowLine.position.y = 0.01;
  glowLine.userData.isArrowGlow = true;
  arrow.add(glowLine);

  const arrowLength = toX - fromX - 0.7;
  const dotCount = Math.max(2, Math.floor(arrowLength / 0.12));
  const flowDotGeo = new THREE.SphereGeometry(0.015, 8, 8);
  for (let d = 0; d < dotCount; d++) {
    const flowDotMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const flowDot = new THREE.Mesh(flowDotGeo, flowDotMat);
    const progress = d / dotCount;
    flowDot.position.set(fromX + 0.35 + progress * arrowLength, midY, 0);
    flowDot.userData.isGlow = true;
    arrow.add(flowDot);
  }
  return arrow;
}

// ==================== CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.22), woodMat);
  seat.position.y = -0.18; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.02), woodMat);
  back.position.set(0, -0.08, -0.1); chair.add(back);
  const barGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6);
  [-0.06, 0, 0.06].forEach(bx => { const bar = new THREE.Mesh(barGeo, woodMat); bar.position.set(bx, -0.09, -0.1); chair.add(bar); });
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
  [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat); leg.position.set(lx, ly, lz); chair.add(leg);
  });
  const supportGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6);
  const s1 = new THREE.Mesh(supportGeo, woodMat); s1.rotation.z = Math.PI / 2; s1.position.set(0, -0.28, 0.08); chair.add(s1);
  const s2 = new THREE.Mesh(supportGeo, woodMat); s2.rotation.z = Math.PI / 2; s2.position.set(0, -0.28, -0.08); chair.add(s2);
  chair.position.x = x;
  return chair;
}

// ==================== GROCERY BOX ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.3, boxHeight = 0.48, boxDepth = 0.18;
  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: 0.05,
    emissive: isHighlighted ? '#ffff00' : '#000000', emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = boxHeight / 2; body.castShadow = true;
  if (isHighlighted) body.userData.pulseEmissive = true;
  product.add(body);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 128; frontCanvas.height = 200;
  const fctx = frontCanvas.getContext('2d')!;
  const grad = fctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#f8f8f8'); grad.addColorStop(1, '#e8e8e8');
  fctx.fillStyle = grad; fctx.fillRect(4, 4, 120, 192);
  fctx.strokeStyle = '#cccccc'; fctx.lineWidth = 2; fctx.strokeRect(4, 4, 120, 192);
  fctx.fillStyle = color; fctx.fillRect(4, 4, 120, 45);
  const icons: Record<string, string> = { 'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚', 'Apple': '🍎', 'Juice': '🧃', 'New': '🆕' };
  fctx.font = '42px Arial'; fctx.textAlign = 'center'; fctx.fillText(icons[label] || '📦', 64, 110);
  fctx.fillStyle = '#2c3e50'; fctx.font = 'bold 20px Arial'; fctx.fillText(label, 64, 150);
  fctx.fillStyle = '#000';
  for (let i = 20; i < 108; i += 3) fctx.fillRect(i, 175, 1.5, 12 + Math.random() * 6);
  fctx.fillStyle = '#666'; fctx.font = '10px Arial'; fctx.fillText('NET WT 500g', 64, 172);
  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontLabel = new THREE.Mesh(new THREE.PlaneGeometry(boxWidth - 0.02, boxHeight - 0.02), new THREE.MeshBasicMaterial({ map: frontTex, transparent: true }));
  frontLabel.position.set(0, boxHeight / 2, boxDepth / 2 + 0.001); product.add(frontLabel);

  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 80; sideCanvas.height = 200;
  const sctx = sideCanvas.getContext('2d')!;
  sctx.fillStyle = '#f5f5f5'; sctx.fillRect(0, 0, 80, 200);
  sctx.fillStyle = color; sctx.fillRect(0, 0, 80, 30);
  sctx.fillStyle = '#333'; sctx.font = '9px Arial'; sctx.textAlign = 'center';
  sctx.fillText('Nutrition', 40, 50); sctx.fillText('Facts', 40, 62);
  sctx.strokeStyle = '#ddd'; sctx.lineWidth = 0.5;
  for (let y = 75; y < 180; y += 12) { sctx.beginPath(); sctx.moveTo(5, y); sctx.lineTo(75, y); sctx.stroke(); }
  const sideTex = new THREE.CanvasTexture(sideCanvas);
  const sideLabel = new THREE.Mesh(new THREE.PlaneGeometry(boxDepth - 0.02, boxHeight - 0.02), new THREE.MeshBasicMaterial({ map: sideTex, transparent: true }));
  sideLabel.position.set(boxWidth / 2 + 0.001, boxHeight / 2, 0); sideLabel.rotation.y = Math.PI / 2; product.add(sideLabel);

  const topMat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(boxWidth, boxDepth), topMat);
  top.position.set(0, boxHeight + 0.001, 0); top.rotation.x = -Math.PI / 2; product.add(top);

  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 64; tagCanvas.height = 32;
  const tctx = tagCanvas.getContext('2d')!;
  tctx.fillStyle = '#ffeb3b'; tctx.fillRect(0, 0, 64, 32);
  tctx.strokeStyle = '#f57f17'; tctx.lineWidth = 2; tctx.strokeRect(1, 1, 62, 30);
  tctx.fillStyle = '#c62828'; tctx.font = 'bold 14px Arial'; tctx.textAlign = 'center';
  const prices: Record<string, string> = { 'Milk': '$3.99', 'Bread': '$2.49', 'Eggs': '$4.99', 'Apple': '$1.29', 'Juice': '$5.49', 'New': '$0.99' };
  tctx.fillText(prices[label] || '$2.99', 32, 22);
  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const priceTag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }));
  priceTag.position.set(0, 0.02, boxDepth / 2 + 0.03); product.add(priceTag);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.06, boxHeight + 0.06, boxDepth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat); glow.position.y = boxHeight / 2;
    glow.userData.isGlow = true; product.add(glow);
    const arrowGeo = new THREE.ConeGeometry(0.06, 0.1, 8);
    const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrowMesh.position.y = boxHeight + 0.15; arrowMesh.rotation.z = Math.PI; product.add(arrowMesh);
  }
  return product;
}

// ==================== ANIMATION HELPER ====================

function applyItemAnimation(obj: THREE.Object3D, itemIndex: number, animPhase: string, animData: Record<string, any>, structure: DataStructure): void {
  if (!animPhase) return;
  const isTarget = animData.index === itemIndex;
  const isTarget1 = animData.index1 === itemIndex;
  const isTarget2 = animData.index2 === itemIndex;

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) { obj.position.y += 0.4; obj.rotation.z = 0.15; }
    else if (animPhase === 'access-bounce' && isTarget) { obj.position.y += 0.28; obj.scale.multiplyScalar(1.2); obj.rotation.z = -0.1; }
    else if (animPhase === 'access-settle' && isTarget) { obj.position.y += 0.08; }
    else if (animPhase === 'insert-shift' && animData.insertIndex !== undefined && itemIndex >= animData.insertIndex) { obj.position.y += 0.06; }
    else if (animPhase === 'insert-drop' && isTarget) { obj.position.y += 0.7; obj.scale.multiplyScalar(0.5); obj.rotation.z = 0.3; }
    else if (animPhase === 'insert-settle' && isTarget) { obj.position.y += 0.15; obj.scale.multiplyScalar(1.1); }
    else if (animPhase === 'delete-lift' && isTarget) { obj.position.y += 0.45; obj.rotation.z = 0.4; obj.scale.multiplyScalar(1.2); }
    else if (animPhase === 'delete-shrink' && isTarget) { obj.position.y += 0.8; obj.scale.multiplyScalar(0.01); obj.rotation.z = 3.0; }
    else if (animPhase === 'delete-close' && animData.deleteIndex !== undefined && itemIndex >= animData.deleteIndex) { obj.position.y += 0.06; }
    else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) { obj.position.y += 0.45; obj.rotation.z = isTarget1 ? 0.15 : -0.15; }
    else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) { obj.position.y += 0.5; obj.rotation.z = isTarget1 ? -0.2 : 0.2; }
    else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) { obj.position.y += 0.12; obj.scale.multiplyScalar(1.12); }
  }
  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) { obj.position.y += 0.5; obj.scale.multiplyScalar(0.6); obj.rotation.z = 0.2; }
    else if (animPhase === 'll-insert-head-settle' && isTarget) { obj.position.y += 0.1; obj.scale.multiplyScalar(1.05); }
    else if (animPhase === 'll-insert-tail' && isTarget) { obj.position.y += 0.5; obj.scale.multiplyScalar(0.6); }
    else if (animPhase === 'll-insert-tail-settle' && isTarget) { obj.position.y += 0.1; obj.scale.multiplyScalar(1.05); }
    else if (animPhase === 'll-delete-lift' && isTarget) { obj.position.y += 0.5; obj.rotation.z = 0.3; }
    else if (animPhase === 'll-delete-shrink' && isTarget) { obj.position.y += 0.8; obj.scale.multiplyScalar(0.01); obj.rotation.z = 2.5; }
    else if (animPhase === 'll-traverse' && isTarget) { obj.position.y += 0.2; obj.scale.multiplyScalar(1.15); }
  }
  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) { obj.position.y += 0.6; obj.scale.multiplyScalar(0.7); obj.rotation.z = 0.2; }
    else if (animPhase === 'stack-push-settle' && isTarget) { obj.position.y += 0.1; obj.scale.multiplyScalar(1.08); }
    else if (animPhase === 'stack-pop-lift' && isTarget) { obj.position.y += 0.4; obj.rotation.z = -0.3; }
    else if (animPhase === 'stack-pop-fly' && isTarget) { obj.position.y += 0.9; obj.scale.multiplyScalar(0.01); obj.rotation.z = 3.0; }
    else if (animPhase === 'stack-peek-lift' && isTarget) { obj.position.y += 0.25; obj.rotation.z = 0.1; }
    else if (animPhase === 'stack-peek-open' && isTarget) { obj.position.y += 0.3; obj.scale.multiplyScalar(1.15); }
    else if (animPhase === 'stack-peek-settle' && isTarget) { obj.position.y += 0.08; }
  }
  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) { obj.position.x += 1.0; obj.scale.multiplyScalar(0.6); }
    else if (animPhase === 'queue-enqueue-settle' && isTarget) { obj.position.x += 0.2; obj.scale.multiplyScalar(1.05); }
    else if (animPhase === 'queue-dequeue-exit' && isTarget) { obj.position.x -= 0.8; obj.scale.multiplyScalar(0.8); obj.rotation.y = 0.3; }
    else if (animPhase === 'queue-dequeue-gone' && isTarget) { obj.position.x -= 1.5; obj.scale.multiplyScalar(0.01); }
    else if (animPhase === 'queue-front-peek' && isTarget) { obj.position.y += 0.2; obj.scale.multiplyScalar(1.15); }
  }
}

// ==================== HUMAN 3D ====================

function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;
  const headGroup = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(0.09, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: hlEmit * 0.3 });
  const head = new THREE.Mesh(headGeo, headMat); head.scale.set(1, 1.08, 0.95); headGroup.add(head);

  if (appearance.hairStyle !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.8 });
    if (appearance.hairStyle === 'long') {
      const topHairGeo = new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const topHair = new THREE.Mesh(topHairGeo, hairMat); topHair.position.y = 0.015; headGroup.add(topHair);
      const backHairGeo = new THREE.CapsuleGeometry(0.04, 0.14, 8, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat); backHair.position.set(0, -0.08, -0.045); headGroup.add(backHair);
      [-0.065, 0.065].forEach(x => { const sg = new THREE.CapsuleGeometry(0.025, 0.08, 6, 12); const sh = new THREE.Mesh(sg, hairMat); sh.position.set(x, -0.04, -0.02); headGroup.add(sh); });
      if (appearance.gender === 'female') { const bg = new THREE.BoxGeometry(0.14, 0.025, 0.04); const b = new THREE.Mesh(bg, hairMat); b.position.set(0, 0.065, 0.065); b.rotation.x = 0.2; headGroup.add(b); }
    } else {
      const shortHairGeo = new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const shortHair = new THREE.Mesh(shortHairGeo, hairMat); shortHair.position.y = 0.015; headGroup.add(shortHair);
      const fadeMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9, transparent: true, opacity: 0.7 });
      [-0.082, 0.082].forEach(x => { const fg = new THREE.SphereGeometry(0.03, 12, 12); const f = new THREE.Mesh(fg, fadeMat); f.position.set(x, 0.02, 0); f.scale.set(0.4, 0.8, 0.7); headGroup.add(f); });
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
    const ew = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ew.position.set(x, 0.012, 0.072); ew.scale.set(1, 0.75, 0.5); headGroup.add(ew);
    const ir = new THREE.Mesh(irisGeo, irisMat); ir.position.set(x, 0.012, 0.082); headGroup.add(ir);
    const pu = new THREE.Mesh(pupilGeo, pupilMat); pu.position.set(x, 0.012, 0.086); headGroup.add(pu);
    const sh = new THREE.Mesh(eyeShineGeo, eyeShineMat); sh.position.set(x + 0.003, 0.016, 0.087); headGroup.add(sh);
    const elg = new THREE.SphereGeometry(0.016, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.3);
    const elm = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
    const el = new THREE.Mesh(elg, elm); el.position.set(x, 0.02, 0.07); el.scale.set(1, 0.5, 0.5); headGroup.add(el);
  });

  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
  [-0.03, 0.03].forEach((x, i) => { const bg = new THREE.BoxGeometry(0.028, 0.006, 0.008); const b = new THREE.Mesh(bg, browMat); b.position.set(x, 0.038, 0.072); b.rotation.z = i === 0 ? -0.12 : 0.12; headGroup.add(b); });

  const noseGroup = new THREE.Group();
  const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.8 });
  const nb = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.015), noseMat); nb.position.set(0, 0, 0.08); noseGroup.add(nb);
  const nt = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), noseMat); nt.position.set(0, -0.01, 0.085); nt.scale.set(1, 0.7, 0.8); noseGroup.add(nt);
  const nostrilMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c' });
  [-0.007, 0.007].forEach(x => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), nostrilMat); n.position.set(x, -0.015, 0.082); noseGroup.add(n); });
  headGroup.add(noseGroup);

  const mouthGroup = new THREE.Group();
  const lipMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 });
  const ul = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 8, 16, Math.PI), lipMat);
  ul.position.set(0, -0.032, 0.075); ul.rotation.z = Math.PI; ul.scale.set(1, 0.5, 1); mouthGroup.add(ul);
  const llm = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const ll = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 8, 16, Math.PI), llm);
  ll.position.set(0, -0.038, 0.074); ll.scale.set(1, 0.6, 1); mouthGroup.add(ll);
  headGroup.add(mouthGroup);

  const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  [-0.087, 0.087].forEach(x => {
    const eg = new THREE.Group();
    const oe = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), earMat); oe.scale.set(0.4, 0.85, 0.55); eg.add(oe);
    const iem = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.5, emissive: '#331111', emissiveIntensity: 0.1 });
    const ie = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), iem); ie.position.z = 0.003; ie.scale.set(0.3, 0.6, 0.3); eg.add(ie);
    eg.position.set(x, 0, 0); headGroup.add(eg);
  });

  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 }));
  chin.position.set(0, -0.06, 0.03); chin.scale.set(1, 0.5, 0.8); headGroup.add(chin);
  const cheekMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.6, emissive: '#ff9999', emissiveIntensity: 0.05 });
  [-0.05, 0.05].forEach(x => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), cheekMat); c.position.set(x, -0.015, 0.06); c.scale.set(0.8, 0.6, 0.4); headGroup.add(c); });
  headGroup.position.y = 0.32; human.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.045, 16), new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 }));
  neck.position.y = 0.21; human.add(neck);

  const torsoGroup = new THREE.Group();
  const torsoMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.6, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: hlEmit });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 0.17, 16), torsoMat);
  if (isHighlighted) torso.userData.pulseEmissive = true;
  torsoGroup.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  collar.position.set(0, 0.075, 0.02); collar.rotation.x = Math.PI / 2; collar.rotation.z = -Math.PI * 0.1; torsoGroup.add(collar);
  const buttonGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  [0.04, 0, -0.04].forEach(y => { const b = new THREE.Mesh(buttonGeo, buttonMat); b.position.set(0, y, 0.06); torsoGroup.add(b); });
  const shirtBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 16), torsoMat);
  shirtBottom.position.y = -0.095; torsoGroup.add(shirtBottom);
  torsoGroup.position.y = 0.11; human.add(torsoGroup);

  const armShirtMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  [-1, 1].forEach(side => {
    const ag = new THREE.Group();
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 12), armShirtMat); shoulder.position.y = 0.04; ag.add(shoulder);
    const ua = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.08, 8, 16), armShirtMat); ag.add(ua);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.015, 12), armShirtMat); cuff.position.y = -0.05; ag.add(cuff);
    const la = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.065, 8, 16), skinMat); la.position.y = -0.1; ag.add(la);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.01, 10), skinMat); wrist.position.y = -0.14; ag.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), skinMat); hand.position.y = -0.155; hand.scale.set(0.65, 0.9, 0.45); ag.add(hand);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.015, 4, 8), skinMat); thumb.position.set(side * 0.012, -0.155, 0.01); thumb.rotation.z = side * 0.5; ag.add(thumb);
    ag.position.set(side * 0.09, 0.1, 0); ag.rotation.z = side * 0.15; human.add(ag);
  });

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.055, 0.018, 16), new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.3 }));
  belt.position.y = 0.025; human.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.008), new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 }));
  buckle.position.set(0, 0.025, 0.055); human.add(buckle);
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.052, 0.04, 16), new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 }));
  hips.position.y = 0.005; human.add(hips);

  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  [-0.03, 0.03].forEach(x => {
    const lg = new THREE.Group();
    lg.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.055, 8, 16), legMat));
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), legMat); knee.position.y = -0.04; lg.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 8, 16), legMat); shin.position.y = -0.085; lg.add(shin);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), legMat); ankle.position.y = -0.115; lg.add(ankle);
    lg.position.set(x, -0.05, 0); human.add(lg);
  });

  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.8 });
  [-0.03, 0.03].forEach(x => {
    const sg = new THREE.Group();
    sg.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.05), shoeMat));
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), shoeMat); toe.position.set(0, -0.003, 0.02); toe.scale.set(1, 0.5, 0.8); sg.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.006, 0.052), soleMat); sole.position.y = -0.012; sg.add(sole);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.025), new THREE.MeshStandardMaterial({ color: '#ffffff' })); lace.position.set(0, 0.01, 0); sg.add(lace);
    sg.position.set(x, -0.155, 0.008); human.add(sg);
  });

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 200; labelCanvas.height = 48;
  const lctx = labelCanvas.getContext('2d')!;
  if (isHighlighted) { lctx.fillStyle = '#ffff00'; lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill(); lctx.fillStyle = '#000'; }
  else { lctx.fillStyle = 'rgba(0,0,0,0.85)'; lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill(); lctx.strokeStyle = 'rgba(255,255,255,0.3)'; lctx.lineWidth = 2; lctx.beginPath(); lctx.roundRect(1, 1, 198, 46, 12); lctx.stroke(); lctx.fillStyle = '#ffffff'; }
  lctx.font = 'bold 24px Arial'; lctx.textAlign = 'center'; lctx.fillText(name, 100, 34);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 0.5; labelSprite.scale.set(0.35, 0.09, 1); human.add(labelSprite);

  if (isHighlighted) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.13, 32), new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
    ring.position.y = -0.16; ring.rotation.x = -Math.PI / 2; ring.userData.isGlow = true; human.add(ring);
    const am = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 8), new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    am.position.y = 0.58; am.rotation.z = Math.PI; human.add(am);
  }
  return human;
}

// ==================== CLIPBOARD ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();
  const boardMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.65, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  clipboard.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.52, 0.018), boardMat));
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.53, 0.01), new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.8 }));
  edge.position.z = -0.01; clipboard.add(edge);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9, roughness: 0.2 });
  const clipBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.025), clipMat); clipBase.position.set(0, 0.28, 0.015); clipboard.add(clipBase);
  const clipLever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.03), clipMat); clipLever.position.set(0, 0.3, 0.03); clipLever.rotation.x = -0.3; clipboard.add(clipLever);
  const spring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12, Math.PI), clipMat); spring.position.set(0, 0.285, 0.025); spring.rotation.y = Math.PI / 2; clipboard.add(spring);

  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 200; paperCanvas.height = 300;
  const pctx = paperCanvas.getContext('2d')!;
  pctx.fillStyle = '#fefef6'; pctx.fillRect(0, 0, 200, 300);
  pctx.strokeStyle = '#f0ede4'; pctx.lineWidth = 0.5;
  for (let y = 0; y < 300; y += 3) { pctx.beginPath(); pctx.moveTo(0, y); pctx.lineTo(200, y); pctx.stroke(); }
  pctx.fillStyle = color; pctx.fillRect(0, 0, 200, 38);
  pctx.fillStyle = '#ffffff'; pctx.font = 'bold 18px Arial'; pctx.textAlign = 'center'; pctx.fillText('TO-DO: ' + label, 100, 27);
  pctx.strokeStyle = '#d4d0c8'; pctx.lineWidth = 0.8;
  const tasks = [{ text: 'Review notes', done: true }, { text: 'Complete homework', done: true }, { text: 'Practice coding', done: isHighlighted }, { text: 'Read chapter 5', done: false }, { text: 'Submit project', done: false }, { text: 'Study for exam', done: false }, { text: 'Group meeting', done: false }, { text: 'Lab report', done: false }];
  tasks.forEach((task, i) => {
    const y = 55 + i * 22;
    pctx.strokeStyle = '#d4d0c8'; pctx.beginPath(); pctx.moveTo(12, y + 16); pctx.lineTo(188, y + 16); pctx.stroke();
    pctx.strokeStyle = '#666'; pctx.lineWidth = 1.5; pctx.strokeRect(14, y, 14, 14);
    if (task.done) {
      pctx.strokeStyle = '#27ae60'; pctx.lineWidth = 2.5; pctx.beginPath(); pctx.moveTo(16, y + 7); pctx.lineTo(20, y + 12); pctx.lineTo(27, y + 3); pctx.stroke();
      pctx.fillStyle = '#999'; pctx.font = '12px Arial'; pctx.textAlign = 'left'; pctx.fillText(task.text, 34, y + 12);
      pctx.strokeStyle = '#999'; pctx.lineWidth = 1; pctx.beginPath(); pctx.moveTo(34, y + 8); pctx.lineTo(34 + pctx.measureText(task.text).width, y + 8); pctx.stroke();
    } else { pctx.fillStyle = '#2c3e50'; pctx.font = '12px Arial'; pctx.textAlign = 'left'; pctx.fillText(task.text, 34, y + 12); }
  });
  pctx.fillStyle = '#aaa'; pctx.font = '10px Arial'; pctx.textAlign = 'center'; pctx.fillText('Page 1 of 1', 100, 285);
  pctx.strokeStyle = '#e74c3c'; pctx.lineWidth = 1; pctx.beginPath(); pctx.moveTo(10, 40); pctx.lineTo(10, 290); pctx.stroke();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(paperCanvas) }));
  paper.position.z = 0.011; clipboard.add(paper);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.49), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.08 }));
  shadow.position.z = 0.009; clipboard.add(shadow);

  const pencilGroup = new THREE.Group();
  pencilGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), new THREE.MeshStandardMaterial({ color: '#f4d03f' })));
  const pTip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), new THREE.MeshStandardMaterial({ color: '#f5deb3' })); pTip.position.y = -0.1; pencilGroup.add(pTip);
  const pLead = new THREE.Mesh(new THREE.ConeGeometry(0.002, 0.008, 6), new THREE.MeshStandardMaterial({ color: '#333' })); pLead.position.y = -0.114; pencilGroup.add(pLead);
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.015, 6), new THREE.MeshStandardMaterial({ color: '#e88b8b' })); eraser.position.y = 0.098; pencilGroup.add(eraser);
  pencilGroup.position.set(0.12, -0.05, 0.02); pencilGroup.rotation.z = 0.8; clipboard.add(pencilGroup);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.04), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })); g.userData.isGlow = true; clipboard.add(g); }
  return clipboard;
}

// ==================== TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.6, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.4 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.3), bodyMat); body.position.y = 0.12; body.castShadow = true;
  if (isHighlighted) body.userData.pulseEmissive = true;
  train.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.025, 0.305), new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.5 })); stripe.position.y = 0.18; train.add(stripe);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.4 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.26), roofMat); roof.position.y = 0.31; train.add(roof);
  const roofCurve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.64, 16, 1, false, 0, Math.PI), roofMat);
  roofCurve.position.y = 0.31; roofCurve.rotation.z = Math.PI / 2; roofCurve.scale.y = 0.25; train.add(roofCurve);
  const under = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.6 })); under.position.y = -0.06; train.add(under);

  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7, roughness: 0.3 });
  const hubCapMat = new THREE.MeshStandardMaterial({ color: '#d4d4d4', metalness: 0.9, roughness: 0.1 });
  const wheelRimMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 });
  const wPositions: [number, number, number][] = [[-0.22, -0.06, 0.15], [0.22, -0.06, 0.15], [-0.22, -0.06, -0.15], [0.22, -0.06, -0.15]];
  wPositions.forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.025, 24), wheelMat); w.rotation.x = Math.PI / 2; w.position.set(wx, wy, wz); train.add(w);
    const hc = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.028, 16), hubCapMat); hc.rotation.x = Math.PI / 2; hc.position.set(wx, wy, wz); train.add(hc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 8, 24), wheelRimMat); rim.position.set(wx, wy, wz > 0 ? wz + 0.013 : wz - 0.013); rim.rotation.x = Math.PI / 2; train.add(rim);
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#999' });
    [0, Math.PI / 3, Math.PI * 2 / 3].forEach(angle => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.09, 0.003), spokeMat); s.position.set(wx, wy, wz > 0 ? wz + 0.013 : wz - 0.013); s.rotation.z = angle; train.add(s); });
  });

  if (!isEngine) {
    const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.4, roughness: 0.2 });
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.6 });
    [-0.2, 0, 0.2].forEach(x => {
      train.add(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.08), windowMat)).position.set(x, 0.17, 0.152);
      const ff = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.005), windowFrameMat); ff.position.set(x, 0.17, 0.153); train.add(ff);
      train.add(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.08), windowMat)).position.set(x, 0.17, -0.152);
    });
  }

  if (isEngine) {
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.45, roughness: 0.5 });
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.28, 24), boilerMat); boiler.rotation.z = Math.PI / 2; boiler.position.set(0.5, 0.12, 0); train.add(boiler);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    [0.38, 0.48, 0.58].forEach(x => { const b = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.008, 8, 24), bandMat); b.position.set(x, 0.12, 0); b.rotation.y = Math.PI / 2; train.add(b); });
    const fp = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6, side: THREE.DoubleSide })); fp.position.set(0.64, 0.12, 0); fp.rotation.y = Math.PI / 2; train.add(fp);
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.7 })); hl.position.set(0.66, 0.2, 0); hl.rotation.z = Math.PI / 2; train.add(hl);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), new THREE.MeshBasicMaterial({ color: '#ffffcc' })); lens.position.set(0.68, 0.2, 0); lens.rotation.y = Math.PI / 2; train.add(lens);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.5 });
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.16, 12), chimneyMat); chimney.position.set(0.2, 0.4, 0); train.add(chimney);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.02, 12), chimneyMat); cap.position.set(0.2, 0.49, 0); train.add(cap);
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.35 });
    [{ y: 0.55, s: 0.04 }, { y: 0.62, s: 0.055 }, { y: 0.7, s: 0.07 }, { y: 0.8, s: 0.08 }].forEach(({ y, s }) => {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), smokeMat); smoke.position.set(0.2 + (y - 0.55) * 0.3, y, (Math.random() - 0.5) * 0.08); train.add(smoke);
    });
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6 });
    const cg = new THREE.Group(); cg.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.25), catcherMat));
    [-0.08, 0.08].forEach(z => { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.015), catcherMat); bar.position.set(0.02, -0.03, z); bar.rotation.y = z > 0 ? 0.3 : -0.3; cg.add(bar); });
    cg.position.set(0.68, -0.02, 0); train.add(cg);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.5 }));
    dome.position.set(0.42, 0.25, 0); train.add(dome);
  }

  const hookMat = new THREE.MeshStandardMaterial({ color: '#666', metalness: 0.8, roughness: 0.2 });
  [-0.37, 0.37].forEach(x => {
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.025), hookMat); hook.position.set(x, 0.02, 0); train.add(hook);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 6, 12), hookMat); ring.position.set(x > 0 ? x + 0.03 : x - 0.03, 0.02, 0); ring.rotation.y = Math.PI / 2; train.add(ring);
  });

  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isHighlighted ? 'rgba(255,255,0,0.9)' : 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(0, 0, 160, 48, 10); ctx.fill();
  ctx.fillStyle = isHighlighted ? '#000' : '#fff'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, 80, 34);
  const ls = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  ls.position.y = 0.5; ls.scale.set(0.45, 0.14, 1); train.add(ls);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.4, 0.35), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 })); g.position.y = 0.12; g.userData.isGlow = true; train.add(g); }
  return train;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();
  const tileMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#1abc9c' : '#f5f0e8', roughness: 0.4, metalness: 0.05, emissive: isHighlighted ? '#1abc9c' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  if (isHighlighted) tileMat.userData = { pulseEmissive: true };
  domino.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.07), tileMat));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.49, 0.06), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 })); border.position.z = -0.01; domino.add(border);
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.015), new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3 })); groove.position.z = 0.03; domino.add(groove);
  const cdg = new THREE.CircleGeometry(0.008, 8); const cdm = new THREE.MeshBasicMaterial({ color: '#c0392b', side: THREE.DoubleSide });
  [[-0.09, 0.21], [0.09, 0.21], [-0.09, -0.21], [0.09, -0.21]].forEach(([x, y]) => { const d = new THREE.Mesh(cdg, cdm); d.position.set(x, y, 0.036); domino.add(d); });

  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.015, 16);
  const dotMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#fff' : '#1a1a1a', roughness: 0.3, metalness: 0.1 });
  const dotPositions: Record<number, [number, number][]> = { 1: [[0, 0.14]], 2: [[-0.05, 0.2], [0.05, 0.08]], 3: [[-0.05, 0.2], [0, 0.14], [0.05, 0.08]], 4: [[-0.05, 0.2], [0.05, 0.2], [-0.05, 0.08], [0.05, 0.08]] };
  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];
  topDots.forEach(([x, y]) => { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(x, y, 0.028); d.rotation.x = Math.PI / 2; domino.add(d); });
  topDots.forEach(([x, y]) => { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(-x, -y, 0.028); d.rotation.x = Math.PI / 2; domino.add(d); });

  const nc = document.createElement('canvas'); nc.width = 32; nc.height = 32;
  const nctx = nc.getContext('2d')!; nctx.fillStyle = isHighlighted ? '#fff' : '#666'; nctx.font = 'bold 20px Arial'; nctx.textAlign = 'center'; nctx.fillText(value, 16, 24);
  const ns = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(nc), transparent: true })); ns.position.set(0.14, 0, 0); ns.scale.set(0.08, 0.08, 1); domino.add(ns);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 0.03), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })); g.userData.isGlow = true; domino.add(g); }
  return domino;
}

// ==================== BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();
  const coverMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.075, 0.4), coverMat); cover.castShadow = true;
  if (isHighlighted) cover.userData.pulseEmissive = true;
  book.add(cover);
  const edgeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 });
  const te = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.003, 0.4), edgeMat); te.position.y = 0.039; book.add(te);
  const be = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.003, 0.4), edgeMat); be.position.y = -0.039; book.add(be);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.37), new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 })); pages.position.x = 0.015; book.add(pages);

  const plc = document.createElement('canvas'); plc.width = 16; plc.height = 128;
  const plctx = plc.getContext('2d')!; plctx.fillStyle = '#f5f0e0'; plctx.fillRect(0, 0, 16, 128);
  for (let y = 0; y < 128; y += 2) { plctx.fillStyle = y % 4 === 0 ? '#e8e0d0' : '#f0e8d8'; plctx.fillRect(0, y, 16, 1); }
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.37), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(plc) }));
  ps.position.set(0.29, 0, 0); ps.rotation.y = Math.PI / 2; book.add(ps);

  const spineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.4 });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.4), spineMat); spine.position.x = -0.3; book.add(spine);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  [-0.15, -0.05, 0.05, 0.15].forEach(z => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.082, 0.01), ridgeMat); r.position.set(-0.313, 0, z); book.add(r); });

  const sc = document.createElement('canvas'); sc.width = 32; sc.height = 160;
  const sctx = sc.getContext('2d')!; sctx.fillStyle = '#ffd700'; sctx.save(); sctx.translate(16, 80); sctx.rotate(-Math.PI / 2);
  sctx.font = 'bold 18px serif'; sctx.textAlign = 'center'; sctx.fillText(label, 0, 6); sctx.restore();
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true }));
  sl.position.set(-0.314, 0, 0); sl.rotation.y = -Math.PI / 2; book.add(sl);

  const cc = document.createElement('canvas'); cc.width = 200; cc.height = 160;
  const cctx = cc.getContext('2d')!; cctx.strokeStyle = '#ffd700'; cctx.lineWidth = 4; cctx.strokeRect(10, 10, 180, 140);
  cctx.lineWidth = 1; cctx.strokeRect(18, 18, 164, 124);
  cctx.fillStyle = '#ffd700'; cctx.font = 'bold 28px serif'; cctx.textAlign = 'center'; cctx.fillText(label, 100, 85);
  cctx.font = '14px serif'; cctx.fillText('TEXTBOOK', 100, 110);
  cctx.strokeStyle = '#ffd700'; cctx.lineWidth = 2; cctx.beginPath(); cctx.moveTo(50, 55); cctx.lineTo(150, 55); cctx.stroke();
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true }));
  cl.position.y = 0.039; cl.rotation.x = -Math.PI / 2; book.add(cl);

  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.12), new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide, roughness: 0.6 }));
  ribbon.position.set(0.1, 0, 0.2); ribbon.rotation.x = 0.1; book.add(ribbon);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.44), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })); g.userData.isGlow = true; book.add(g); }
  return book;
}

// ==================== PLATE ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: '#f8f8f0', roughness: 0.25, metalness: 0.08, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.2 : 0 });
  const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.02, 36), plateMat); pm.castShadow = true; plate.add(pm);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.014, 12, 36), new THREE.MeshStandardMaterial({ color: '#e8e8e0', roughness: 0.3, metalness: 0.1 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; plate.add(rim);
  const ir = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 8, 32), new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 }));
  ir.rotation.x = Math.PI / 2; ir.position.y = 0.012; plate.add(ir);
  const or2 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.005, 8, 32), new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 }));
  or2.rotation.x = Math.PI / 2; or2.position.y = 0.012; plate.add(or2);

  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;
  if (plateNum % 3 === 1) {
    const rice = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.9 }));
    rice.position.set(-0.06, 0.013, 0); plate.add(rice);
    const chicken = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.06, 6, 12), new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.7 }));
    chicken.position.set(0.06, 0.035, 0.02); chicken.rotation.z = 0.4; plate.add(chicken);
    const peaMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.6 });
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), peaMat); p.position.set(0.02 + Math.random() * 0.06 - 0.03, 0.02, -0.06 + Math.random() * 0.04); plate.add(p); }
  } else if (plateNum % 3 === 2) {
    const spagMat = new THREE.MeshStandardMaterial({ color: '#f0d58c', roughness: 0.7 });
    for (let i = 0; i < 8; i++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.04 + Math.random() * 0.03, 0.004, 6, 16), spagMat); n.position.set((Math.random() - 0.5) * 0.06, 0.02 + i * 0.003, (Math.random() - 0.5) * 0.06); n.rotation.x = Math.random() * 0.5; n.rotation.y = Math.random() * Math.PI; plate.add(n); }
    const sauce = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 }));
    sauce.position.set(0, 0.035, 0); sauce.scale.set(1.2, 0.6, 1.2); plate.add(sauce);
    const mb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 })); mb.position.set(0.02, 0.04, 0.01); plate.add(mb);
  } else {
    const lm = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.7 });
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), lm); l.position.set((Math.random() - 0.5) * 0.1, 0.02, (Math.random() - 0.5) * 0.1); l.scale.set(1.2, 0.4, 1); l.rotation.y = Math.random() * Math.PI; plate.add(l); }
    const tm = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 12), tm); t.position.set(-0.02 + i * 0.035, 0.03, -0.02 + i * 0.01); plate.add(t); }
    const cm = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 });
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.015), cm); c.position.set(0.04 + Math.random() * 0.04, 0.025, (Math.random() - 0.5) * 0.06); c.rotation.y = Math.random() * 0.5; plate.add(c); }
  }

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 32), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })); g.userData.isGlow = true; plate.add(g); }
  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean): THREE.Group {
  const box = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.42), bodyMat); body.castShadow = true;
  if (isHighlighted) body.userData.pulseEmissive = true;
  box.add(body);

  const creaseMat = new THREE.MeshStandardMaterial({ color: '#7a5530', roughness: 0.9 });
  [[-0.255, 0, 0.205], [0.255, 0, 0.205], [-0.255, 0, -0.205], [0.255, 0, -0.205]].forEach(([x, y, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.012), creaseMat); c.position.set(x, y, z); box.add(c);
  });

  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const flapAngle = isOpen ? -1.2 : 0;
  const ff = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.01), flapMat); ff.position.set(0, 0.18 + (isOpen ? 0.06 : 0), 0.21); ff.rotation.x = flapAngle; box.add(ff);
  const bf = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.01), flapMat); bf.position.set(0, 0.18 + (isOpen ? 0.06 : 0), -0.21); bf.rotation.x = -flapAngle; box.add(bf);
  const lf = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 0.42), flapMat); lf.position.set(-0.26, 0.18 + (isOpen ? 0.04 : 0), 0); lf.rotation.z = isOpen ? 0.8 : 0; box.add(lf);
  const rf = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 0.42), flapMat); rf.position.set(0.26, 0.18 + (isOpen ? 0.04 : 0), 0); rf.rotation.z = isOpen ? -0.8 : 0; box.add(rf);

  if (isOpen) {
    const insideBottom = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#a0734a', side: THREE.DoubleSide, roughness: 0.9 }));
    insideBottom.rotation.x = -Math.PI / 2; insideBottom.position.y = -0.17; box.add(insideBottom);
    const item1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.6 })); item1.position.set(-0.1, -0.05, 0); item1.rotation.y = 0.2; box.add(item1);
    const item2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 })); item2.position.set(0.08, -0.03, 0.05); box.add(item2);
    box.add(new THREE.PointLight(0xffff00, 0.5, 0.5));
  }

  if (!isOpen) { const tape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.44), new THREE.MeshStandardMaterial({ color: '#d4a574', transparent: true, opacity: 0.7, roughness: 0.3 })); tape.position.y = 0.183; box.add(tape); }

  const lc = document.createElement('canvas'); lc.width = 160; lc.height = 100;
  const lctx = lc.getContext('2d')!;
  lctx.fillStyle = '#ffffff'; lctx.fillRect(0, 0, 160, 100); lctx.strokeStyle = '#333'; lctx.lineWidth = 2; lctx.strokeRect(2, 2, 156, 96);
  lctx.fillStyle = '#e74c3c'; lctx.fillRect(5, 5, 150, 25); lctx.fillStyle = '#fff'; lctx.font = 'bold 16px Arial'; lctx.textAlign = 'center'; lctx.fillText('⚠ FRAGILE ⚠', 80, 24);
  lctx.fillStyle = '#000'; lctx.font = 'bold 26px Arial'; lctx.fillText(label, 80, 62);
  lctx.fillStyle = '#666'; lctx.font = '10px Arial'; lctx.fillText('HANDLE WITH CARE', 80, 82);
  lctx.fillStyle = '#333'; lctx.font = '14px Arial'; lctx.fillText('↑ THIS SIDE UP ↑', 80, 95);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc) })); lm.position.set(0, 0, 0.212); box.add(lm);

  [-0.261, 0.261].forEach(x => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.8 })); h.position.set(x, 0.05, 0); h.rotation.y = Math.PI / 2; h.rotation.z = Math.PI; box.add(h); });

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.46), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })); g.userData.isGlow = true; box.add(g); }
  return box;
}

// ==================== CAR ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), bodyMat); body.position.y = 0.1; body.castShadow = true;
  if (isHighlighted) body.userData.pulseEmissive = true;
  car.add(body);
  car.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.31), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 }))).position.y = 0.015;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.28), bodyMat); hood.position.set(0.22, 0.2, 0); hood.rotation.z = -0.15; car.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.26), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 })); cabin.position.set(-0.04, 0.24, 0); car.add(cabin);
  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.015, 0.24), new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 })); roofMesh.position.set(-0.04, 0.31, 0); car.add(roofMesh);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.11), glassMat); ws.position.set(0.11, 0.24, 0); ws.rotation.y = Math.PI / 2; ws.rotation.z = 0.25; car.add(ws);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.11), glassMat); rw.position.set(-0.19, 0.24, 0); rw.rotation.y = Math.PI / 2; rw.rotation.z = -0.25; car.add(rw);
  [-1, 1].forEach(side => { [-0.08, 0.03].forEach(x => { const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.08), glassMat); sw.position.set(x, 0.25, side * 0.131); car.add(sw); }); });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  [-0.131, 0.131].forEach(z => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.13, 0.01), pillarMat); p.position.set(-0.025, 0.24, z); car.add(p); });

  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.9 });
  const wPos: [number, number, number][] = [[-0.19, 0.0, 0.155], [0.19, 0.0, 0.155], [-0.19, 0.0, -0.155], [0.19, 0.0, -0.155]];
  wPos.forEach(([wx, wy, wz]) => {
    car.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 12, 24), tireMat)).position.set(wx, wy, wz);
    const rim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 16), rimMat); rim2.rotation.x = Math.PI / 2; rim2.position.set(wx, wy, wz); car.add(rim2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.028, 8), hubMat); hub.rotation.x = Math.PI / 2; hub.position.set(wx, wy, wz); car.add(hub);
    const spokeMat2 = new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8 });
    [0, Math.PI / 2.5, Math.PI / 1.25, Math.PI * 1.5 / 2.5, Math.PI * 2 / 1.25].forEach(angle => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.004), spokeMat2); s.position.set(wx, wy, wz > 0 ? wz + 0.014 : wz - 0.014); s.rotation.z = angle; car.add(s); });
  });

  const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  [-0.1, 0.1].forEach(z => { car.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.06), hlMat)).position.set(0.3, 0.1, z); const hh = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.07), new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5 })); hh.position.set(0.298, 0.1, z); car.add(hh); });
  [-0.1, 0.1].forEach(z => { car.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.035, 0.05), new THREE.MeshBasicMaterial({ color: '#ff2222' }))).position.set(-0.3, 0.1, z); });
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7, side: THREE.DoubleSide });
  for (let z = -0.08; z <= 0.08; z += 0.02) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.06), grilleMat); b.position.set(0.301, 0.08, z); b.rotation.y = Math.PI / 2; car.add(b); }
  [-0.145, 0.145].forEach(z => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.025), new THREE.MeshStandardMaterial({ color: '#333' })); m.position.set(0.05, 0.2, z); car.add(m); const mg = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.012), glassMat); mg.position.set(0.05, 0.2, z > 0 ? z + 0.013 : z - 0.013); car.add(mg); });

  const pc = document.createElement('canvas'); pc.width = 96; pc.height = 36;
  const pctx = pc.getContext('2d')!; pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, 96, 36); pctx.strokeStyle = '#333'; pctx.lineWidth = 2; pctx.strokeRect(1, 1, 94, 34);
  pctx.fillStyle = '#2c3e50'; pctx.font = 'bold 16px Arial'; pctx.textAlign = 'center'; pctx.fillText(label, 48, 25);
  const pmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc) })); pmesh.position.set(-0.301, 0.05, 0); pmesh.rotation.y = -Math.PI / 2; car.add(pmesh);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.06, 10), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.3 })); exhaust.position.set(-0.28, -0.02, 0.1); exhaust.rotation.z = Math.PI / 2; car.add(exhaust);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 })); g.position.y = 0.15; g.userData.isGlow = true; car.add(g); }
  return car;
}

// ==================== TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();
  const ticketMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  const tmesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.015), ticketMat);
  if (isHighlighted) tmesh.userData.pulseEmissive = true;
  ticket.add(tmesh);
  const stub = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.015), new THREE.MeshStandardMaterial({ color, roughness: 0.5 })); stub.position.x = 0.26; ticket.add(stub);
  const dotGeo = new THREE.CircleGeometry(0.005, 8); const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let y = -0.1; y <= 0.1; y += 0.015) { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(0.205, y, 0.009); ticket.add(d); }

  const fc = document.createElement('canvas'); fc.width = 220; fc.height = 120;
  const fctx = fc.getContext('2d')!;
  fctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -120; i < 340; i += 12) { fctx.save(); fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i + 60, 120); fctx.lineTo(i + 66, 120); fctx.lineTo(i + 6, 0); fctx.closePath(); fctx.fill(); fctx.restore(); }
  fctx.fillStyle = 'rgba(0,0,0,0.3)'; fctx.fillRect(0, 0, 220, 25);
  fctx.fillStyle = '#fff'; fctx.font = 'bold 14px Arial'; fctx.textAlign = 'center'; fctx.fillText('★ ADMIT ONE ★', 90, 18);
  fctx.font = 'bold 36px Arial'; fctx.fillText(label, 90, 68);
  fctx.strokeStyle = 'rgba(255,255,255,0.5)'; fctx.lineWidth = 1; fctx.beginPath(); fctx.moveTo(20, 80); fctx.lineTo(160, 80); fctx.stroke();
  fctx.font = 'bold 12px Arial'; fctx.fillText('⭐ VIP ACCESS ⭐', 90, 98);
  fctx.font = '9px Arial'; fctx.fillStyle = 'rgba(255,255,255,0.6)'; fctx.fillText('VALID TODAY ONLY', 90, 113);
  fctx.save(); fctx.translate(195, 60); fctx.rotate(-Math.PI / 2); fctx.fillStyle = '#fff'; fctx.font = 'bold 14px Arial'; fctx.fillText(label, 0, 0); fctx.restore();
  const ff = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true })); ff.position.z = 0.009; ticket.add(ff);

  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6, roughness: 0.3 });
  const hbg = new THREE.BoxGeometry(0.43, 0.005, 0.018);
  ticket.add(new THREE.Mesh(hbg, borderMat)).position.y = 0.12;
  ticket.add(new THREE.Mesh(hbg, borderMat)).position.y = -0.12;
  const vbg = new THREE.BoxGeometry(0.005, 0.24, 0.018);
  ticket.add(new THREE.Mesh(vbg, borderMat)).position.x = -0.21;
  ticket.add(new THREE.Mesh(vbg, borderMat)).position.x = 0.31;

  const bc = document.createElement('canvas'); bc.width = 200; bc.height = 60;
  const bctx = bc.getContext('2d')!; bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, 200, 60); bctx.fillStyle = '#000';
  for (let i = 10; i < 190; i += 3) { bctx.fillRect(i, 10, 1.5, 30 + Math.random() * 15); }
  bctx.font = '8px monospace'; bctx.textAlign = 'center'; bctx.fillText(label + '-' + Math.floor(Math.random() * 9999), 100, 55);
  const bf2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })); bf2.position.z = -0.009; bf2.rotation.y = Math.PI; ticket.add(bf2);

  if (isHighlighted) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.03), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })); g.userData.isGlow = true; ticket.add(g); }
  return ticket;
}

// ==================== END OF PART 1 ====================
// ==================== SEND "next" FOR PART 2 ====================

// ==================== PART 2 START ====================
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
  disposeGroup(group);

  const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 0.95 : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;

  // ========== ARRAY ==========
  if (structure === 'array') {
    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.8;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const product = createGroceryBox(item.color, item.label, isHl);
        const baseY = isHl ? 0.18 : 0.08;
        product.position.set(startX + i * spacing, baseY, 0);
        if (isHl) { product.userData.isHighlighted = true; product.userData.baseY = baseY; const ring = createPulsingHighlightRing(0.2); ring.position.set(startX + i * spacing, 0.07, 0); group.add(ring); }
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array');
        group.add(product);
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#aaaaaa', 18);
        idx.position.set(startX + i * spacing, -0.18, 0); idx.scale.set(0.35, 0.12, 1); group.add(idx);
      });

      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.03, 0.35), shelfMat); mainShelf.position.y = 0.06; mainShelf.receiveShadow = true; mainShelf.castShadow = true; group.add(mainShelf);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), shelfMat); lip.position.set(0, 0.08, 0.175); group.add(lip);
      const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.03, 0.35), shelfMat); lowerShelf.position.y = -0.35; lowerShelf.receiveShadow = true; group.add(lowerShelf);
      const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), shelfMat); lowerLip.position.set(0, -0.33, 0.175); group.add(lowerLip);

      const poleMat = new THREE.MeshStandardMaterial({ color: '#a0a0a0', metalness: 0.9, roughness: 0.15 });
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 12);
      const poleXs = [-shelfWidth / 2 + 0.05, shelfWidth / 2 - 0.05];
      if (data.length > 3) poleXs.push(0);
      poleXs.forEach(x => { [0.16, -0.14].forEach(z => { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(x, -0.1, z); p.castShadow = true; group.add(p); }); });

      const stripCanvas = document.createElement('canvas'); stripCanvas.width = 512; stripCanvas.height = 32;
      const sctx = stripCanvas.getContext('2d')!; sctx.fillStyle = '#2e7d32'; sctx.fillRect(0, 0, 512, 32);
      sctx.fillStyle = '#fff'; sctx.font = 'bold 16px Arial'; sctx.textAlign = 'center';
      sctx.fillText('★ FRESH ITEMS ★ BEST PRICE ★ FRESH ITEMS ★ BEST PRICE ★', 256, 22);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(shelfWidth, 0.06), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(stripCanvas) }));
      strip.position.set(0, 0.05, 0.178); group.add(strip);

      const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(shelfWidth, 0.85), new THREE.MeshStandardMaterial({ color: '#f5f5f5', side: THREE.DoubleSide, roughness: 0.9 }));
      backPanel.position.set(0, -0.05, -0.16); group.add(backPanel);
      const holeMat = new THREE.MeshBasicMaterial({ color: '#ddd', side: THREE.DoubleSide });
      const holeGeo = new THREE.CircleGeometry(0.008, 8);
      for (let hx = -shelfWidth / 2 + 0.1; hx < shelfWidth / 2; hx += 0.08) {
        for (let hy = -0.3; hy < 0.35; hy += 0.08) { const h = new THREE.Mesh(holeGeo, holeMat); h.position.set(hx, hy, -0.158); group.add(h); }
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(shelfWidth + 0.5, 0.8), new THREE.MeshStandardMaterial({ color: '#e8dcc8', side: THREE.DoubleSide }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.56; floor.receiveShadow = true; group.add(floor);

    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.5;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          const baseY = isHl ? 0.08 : 0;
          human.position.set(startX + i * spacing, baseY, 0); human.scale.setScalar(0.8);
          if (isHl) { human.userData.isHighlighted = true; human.userData.baseY = baseY; const ring = createPulsingHighlightRing(0.12); ring.position.set(startX + i * spacing, -0.34, 0); group.add(ring); }
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array'); group.add(human);
          const chair = createChair(startX + i * spacing); chair.scale.setScalar(0.8); group.add(chair);
          const desk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 }));
          desk.position.set(startX + i * spacing, -0.1, 0.2); desk.scale.setScalar(0.8); desk.castShadow = true; desk.receiveShadow = true; group.add(desk);
          const dlegGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6); const dlegMat = new THREE.MeshStandardMaterial({ color: '#666' });
          [[-0.12, -0.19, 0.08], [0.12, -0.19, 0.08], [-0.12, -0.19, -0.08], [0.12, -0.19, -0.08]].forEach(([dx, dy, dz]) => {
            const dl = new THREE.Mesh(dlegGeo, dlegMat); dl.position.set(startX + i * spacing + dx * 0.8, dy * 0.8 - 0.1, (dz + 0.2) * 0.8); group.add(dl);
          });
        }
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#aaaaaa', 18);
        idx.position.set(startX + i * spacing, -0.45, 0); idx.scale.set(0.28, 0.1, 1); group.add(idx);
      });

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.5), new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.35; floor.receiveShadow = true; group.add(floor);
      const tileLineMat = new THREE.MeshBasicMaterial({ color: '#b39b7a', side: THREE.DoubleSide });
      for (let tx = -roomWidth / 2; tx <= roomWidth / 2; tx += 0.4) { const line = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 1.5), tileLineMat); line.rotation.x = -Math.PI / 2; line.position.set(tx, -0.349, 0); group.add(line); }
      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      group.add(new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.0), wallMat)).position.set(0, 0.1, -0.5);
      const board = new THREE.Mesh(new THREE.BoxGeometry(roomWidth * 0.6, 0.45, 0.02), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
      board.position.set(0, 0.25, -0.48); group.add(board);
      const frameMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.5 });
      const hFrame = new THREE.BoxGeometry(roomWidth * 0.62, 0.02, 0.03);
      group.add(new THREE.Mesh(hFrame, frameMat)).position.set(0, 0.48, -0.47);
      group.add(new THREE.Mesh(hFrame, frameMat)).position.set(0, 0.02, -0.47);
      const bc2 = document.createElement('canvas'); bc2.width = 256; bc2.height = 128;
      const bctx2 = bc2.getContext('2d')!; bctx2.fillStyle = '#2c3e50'; bctx2.font = 'bold 24px Arial'; bctx2.textAlign = 'center';
      bctx2.fillText('Data Structures', 128, 40); bctx2.font = '16px Arial'; bctx2.fillText('Array: O(1) Access', 128, 70); bctx2.fillText('Index: 0, 1, 2, ...', 128, 95);
      const bt = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth * 0.55, 0.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc2), transparent: true }));
      bt.position.set(0, 0.25, -0.468); group.add(bt);
      [-roomWidth / 2, roomWidth / 2].forEach(x => { const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), wallMat); sw.position.set(x, 0.1, 0); sw.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; group.add(sw); });
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.5), new THREE.MeshStandardMaterial({ color: '#f5f5f0', side: THREE.DoubleSide }));
      ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 0.6; group.add(ceiling);
      for (let lx = -roomWidth / 3; lx <= roomWidth / 3; lx += roomWidth / 3) { const lf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffee' })); lf.position.set(lx, 0.59, 0); group.add(lf); }

    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        const baseY = isHl ? 0.12 : 0;
        clipboard.position.set(startX + i * spacing, baseY, 0); clipboard.scale.setScalar(0.7);
        if (isHl) { clipboard.userData.isHighlighted = true; clipboard.userData.baseY = baseY; }
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array'); group.add(clipboard);
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#aaaaaa', 18);
        idx.position.set(startX + i * spacing, -0.48, 0); idx.scale.set(0.28, 0.1, 1); group.add(idx);
      });
      const deskWidth = data.length * spacing + 0.5;
      const desk = new THREE.Mesh(new THREE.BoxGeometry(deskWidth, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 }));
      desk.position.y = -0.3; desk.receiveShadow = true; desk.castShadow = true; group.add(desk);
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, deskWidth, 16), new THREE.MeshStandardMaterial({ color: '#4a3520' }));
      edge.rotation.z = Math.PI / 2; edge.position.set(0, -0.3, 0.26); group.add(edge);
    }

  // ========== LINKED LIST ==========
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        const baseY = isHl ? 0.12 : 0;
        trainCar.position.set(startX + i * spacing, baseY, 0); trainCar.scale.setScalar(0.85);
        if (isHl) { trainCar.userData.isHighlighted = true; trainCar.userData.baseY = baseY; }
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist'); group.add(trainCar);
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.15; group.add(arrow);
          const pl = createTextSprite('next →', '#00ff00', 12); pl.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.3, 0); pl.scale.set(0.3, 0.08, 1); group.add(pl);
        }
      });
      const headS = createTextSprite('HEAD', '#ff4444', 20); headS.position.set(startX, 0.6, 0); headS.scale.set(0.35, 0.12, 1); group.add(headS);
      const tailS = createTextSprite('TAIL', '#4488ff', 20); tailS.position.set(startX + (data.length - 1) * spacing, 0.6, 0); tailS.scale.set(0.35, 0.12, 1); group.add(tailS);
      const nullS = createTextSprite('NULL', '#ff4444', 22); nullS.position.set(startX + data.length * spacing, 0, 0); nullS.scale.set(0.35, 0.2, 1); group.add(nullS);
      const nullA = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.15, false); nullA.position.y = -0.15; group.add(nullA);

      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
      [-0.12, 0.12].forEach(z => { const r = new THREE.Mesh(railGeo, railMat); r.position.set(0, -0.12, z); r.castShadow = true; group.add(r); });
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
      for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.18) { const t = new THREE.Mesh(tieGeo, tieMat); t.position.set(x, -0.13, 0); t.receiveShadow = true; group.add(t); }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2, 1), new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.14; ground.receiveShadow = true; group.add(ground);

    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          const baseY = isHl ? 0.08 : 0;
          human.position.set(startX + i * spacing, baseY, 0); human.scale.setScalar(0.75);
          if (isHl) { human.userData.isHighlighted = true; human.userData.baseY = baseY; const ring = createPulsingHighlightRing(0.12); ring.position.set(startX + i * spacing, -0.16, 0); group.add(ring); }
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist'); group.add(human);
        }
        if (i < data.length - 1) { const a = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); a.position.y = 0.1; group.add(a); const pl = createTextSprite('next →', '#00ff00', 12); pl.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.05, 0); pl.scale.set(0.28, 0.07, 1); group.add(pl); }
      });
      const headS = createTextSprite('HEAD', '#ff4444', 18); headS.position.set(startX, 0.55, 0); headS.scale.set(0.3, 0.1, 1); group.add(headS);
      const nullS = createTextSprite('NULL', '#ff4444', 20); nullS.position.set(startX + data.length * spacing, 0.1, 0); nullS.scale.set(0.3, 0.15, 1); group.add(nullS);
      const nullA = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false); nullA.position.y = 0.1; group.add(nullA);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1, 0.6), new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.17; floor.receiveShadow = true; group.add(floor);

    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        const baseY = isHl ? 0.1 : 0;
        domino.position.set(startX + i * spacing, baseY, 0); domino.scale.setScalar(0.85);
        if (isHl) { domino.userData.isHighlighted = true; domino.userData.baseY = baseY; }
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist'); group.add(domino);
        if (i < data.length - 1) { const a = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false); a.position.y = -0.35; group.add(a); }
      });
      const headS = createTextSprite('HEAD', '#ff4444', 18); headS.position.set(startX, 0.4, 0); headS.scale.set(0.3, 0.1, 1); group.add(headS);
      const nullS = createTextSprite('NULL', '#ff4444', 18); nullS.position.set(startX + data.length * spacing, -0.35, 0); nullS.scale.set(0.3, 0.15, 1); group.add(nullS);
      const nullA = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false); nullA.position.y = -0.35; group.add(nullA);
      const table = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.8, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 }));
      table.position.y = -0.3; table.receiveShadow = true; table.castShadow = true; group.add(table);
      const edgeMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 });
      const edgeGeo = new THREE.BoxGeometry(data.length * spacing + 0.85, 0.06, 0.04);
      [0.32, -0.32].forEach(z => { group.add(new THREE.Mesh(edgeGeo, edgeMat)).position.set(0, -0.3, z); });
    }

  // ========== STACK ==========
  } else if (structure === 'stack') {
    if (environment === 'books') {
      const stackSpacing = 0.12; const baseStackY = -data.length * stackSpacing / 2;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const book = createBook(item.label, item.color, isHl);
        const baseY = baseStackY + i * stackSpacing;
        book.position.set(isHl ? 0.2 : 0, baseY, 0); book.rotation.y = (i % 2 === 0) ? 0 : 0.05;
        if (isHl) { book.userData.isHighlighted = true; book.userData.baseY = baseY; }
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack'); group.add(book);
        if (i === data.length - 1) { const ts = createTextSprite('← TOP', '#ff4444', 22); ts.position.set(0.75, baseY, 0); ts.scale.set(0.4, 0.12, 1); group.add(ts); }
      });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 }));
      desk.position.y = baseStackY - 0.1; desk.receiveShadow = true; desk.castShadow = true; group.add(desk);

    } else if (environment === 'plates') {
      const plateSpacing = 0.05; const plateBaseY = -data.length * plateSpacing / 2;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plate = createPlate(item.label, isHl);
        const baseY = plateBaseY + i * plateSpacing;
        plate.position.set(isHl ? 0.15 : 0, baseY, 0); plate.scale.setScalar(0.65);
        if (isHl) { plate.userData.isHighlighted = true; plate.userData.baseY = baseY; }
        applyItemAnimation(plate, i, animPhase || '', animData || {}, 'stack'); group.add(plate);
        if (i === data.length - 1) { const ts = createTextSprite('← TOP', '#ff4444', 22); ts.position.set(0.55, baseY, 0); ts.scale.set(0.35, 0.1, 1); group.add(ts); }
      });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 }));
      counter.position.y = plateBaseY - 0.06; counter.receiveShadow = true; group.add(counter);
      group.add(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide }))).position.set(0, plateBaseY - 0.2, 0.3);
      const sc = document.createElement('canvas'); sc.width = 256; sc.height = 48;
      const sctx2 = sc.getContext('2d')!; sctx2.fillStyle = '#e74c3c'; sctx2.fillRect(0, 0, 256, 48); sctx2.fillStyle = '#fff'; sctx2.font = 'bold 28px Arial'; sctx2.textAlign = 'center'; sctx2.fillText('🍽️ CAFETERIA 🍽️', 128, 35);
      const ss = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true }));
      ss.position.set(0, plateBaseY + data.length * plateSpacing + 0.3, 0); ss.scale.set(0.8, 0.15, 1); group.add(ss);

    } else if (environment === 'boxes') {
      const boxSpacing = 0.42; const boxBaseY = -data.length * boxSpacing / 2 + 0.2;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i; const isTop = i === data.length - 1;
        const isPeeking = animPhase === 'stack-peek-open' && isTop && isHl;
        const boxObj = createCardboardBox(item.label, item.color, isHl, isPeeking);
        const baseY = boxBaseY + i * boxSpacing;
        boxObj.position.set(isHl ? 0.2 : 0, baseY, 0); boxObj.rotation.y = (i % 2 === 0) ? 0 : 0.06; boxObj.scale.setScalar(0.82);
        if (isHl) { boxObj.userData.isHighlighted = true; boxObj.userData.baseY = baseY; }
        applyItemAnimation(boxObj, i, animPhase || '', animData || {}, 'stack'); group.add(boxObj);
        if (isTop) { const ts = createTextSprite('← TOP', '#ff4444', 22); ts.position.set(0.65, baseY, 0); ts.scale.set(0.35, 0.1, 1); group.add(ts); }
      });
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.65), new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 }));
      pallet.position.y = boxBaseY - 0.24; pallet.receiveShadow = true; group.add(pallet);
      const slatGeo = new THREE.BoxGeometry(0.85, 0.015, 0.08); const slatMat = new THREE.MeshStandardMaterial({ color: '#8b6914' });
      [-0.25, 0, 0.25].forEach(z => { group.add(new THREE.Mesh(slatGeo, slatMat)).position.set(0, boxBaseY - 0.28, z); });
    }

  // ========== QUEUE ==========
  } else if (structure === 'queue') {
    if (environment === 'tollgate') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        const baseY = isHl ? 0.08 : 0;
        car.position.set(startX + i * spacing, baseY, 0); car.scale.setScalar(0.82);
        if (isHl) { car.userData.isHighlighted = true; car.userData.baseY = baseY; }
        applyItemAnimation(car, i, animPhase || '', animData || {}, 'queue'); group.add(car);
      });
      const fs = createTextSprite('FRONT', '#00ff00', 18); fs.position.set(startX, -0.24, 0); fs.scale.set(0.3, 0.1, 1); group.add(fs);
      const rs = createTextSprite('REAR', '#ff8800', 18); rs.position.set(startX + (data.length - 1) * spacing, -0.24, 0); rs.scale.set(0.3, 0.1, 1); group.add(rs);

      const gateX = startX - 0.8;
      const poleMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.6 });
      const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 12);
      [0.25, -0.25].forEach(z => { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(gateX, 0.25, z); p.castShadow = true; group.add(p); });
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), poleMat)).position.set(gateX, 0.6, 0);
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: '#e74c3c' })); barrier.position.set(gateX - 0.25, 0.5, 0); barrier.rotation.z = 0.3; group.add(barrier);
      const stMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
      for (let sx = -0.2; sx < 0.2; sx += 0.08) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.045), stMat); s.position.set(gateX - 0.25 + sx, 0.5, 0); s.rotation.z = 0.3; group.add(s); }
      const signC = document.createElement('canvas'); signC.width = 128; signC.height = 48;
      const signCtx = signC.getContext('2d')!; signCtx.fillStyle = '#2c3e50'; signCtx.fillRect(0, 0, 128, 48); signCtx.fillStyle = '#fff'; signCtx.font = 'bold 28px Arial'; signCtx.textAlign = 'center'; signCtx.fillText('TOLL', 64, 36);
      const signS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signC), transparent: true })); signS.position.set(gateX, 0.72, 0); signS.scale.set(0.35, 0.13, 1); group.add(signS);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.7), new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide }));
      road.rotation.x = -Math.PI / 2; road.position.y = -0.08; road.receiveShadow = true; group.add(road);
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 1; x <= startX + data.length * spacing + 0.5; x += 0.25) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.025), dashMat); d.rotation.x = -Math.PI / 2; d.position.set(x, -0.075, 0); group.add(d); }
      const es = createTextSprite('EXIT →', '#00ff00', 20); es.position.set(gateX - 0.6, 0.3, 0); es.scale.set(0.35, 0.1, 1); group.add(es);

    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticket = createTicket(item.label, item.color, isHl);
        const baseY = isHl ? 0.1 : 0;
        ticket.position.set(startX + i * spacing, baseY, 0); ticket.scale.setScalar(0.82);
        if (isHl) { ticket.userData.isHighlighted = true; ticket.userData.baseY = baseY; }
        applyItemAnimation(ticket, i, animPhase || '', animData || {}, 'queue'); group.add(ticket);
      });
      const fs = createTextSprite('FRONT', '#00ff00', 18); fs.position.set(startX, -0.24, 0); fs.scale.set(0.3, 0.1, 1); group.add(fs);
      const rs = createTextSprite('REAR', '#ff8800', 18); rs.position.set(startX + (data.length - 1) * spacing, -0.24, 0); rs.scale.set(0.3, 0.1, 1); group.add(rs);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4), new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 }));
      counter.position.y = -0.15; counter.receiveShadow = true; group.add(counter);
      const svC = document.createElement('canvas'); svC.width = 200; svC.height = 64;
      const svctx = svC.getContext('2d')!; svctx.fillStyle = '#1a1a2e'; svctx.fillRect(0, 0, 200, 64); svctx.strokeStyle = '#ffd700'; svctx.lineWidth = 2; svctx.strokeRect(3, 3, 194, 58);
      svctx.fillStyle = '#00ff00'; svctx.font = 'bold 14px Arial'; svctx.textAlign = 'center'; svctx.fillText('NOW SERVING', 100, 22);
      svctx.font = 'bold 28px Arial'; svctx.fillStyle = '#ff0'; svctx.fillText(data.length > 0 ? data[0].label : '---', 100, 52);
      const svS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(svC), transparent: true })); svS.position.set(startX - 0.6, 0.2, 0); svS.scale.set(0.45, 0.15, 1); group.add(svS);

    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          const baseY = isHl ? 0.08 : 0;
          human.position.set(startX + i * spacing, baseY, 0); human.scale.setScalar(0.68);
          if (isHl) { human.userData.isHighlighted = true; human.userData.baseY = baseY; const ring = createPulsingHighlightRing(0.1); ring.position.set(startX + i * spacing, -0.13, 0); group.add(ring); }
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue'); group.add(human);
        }
      });
      const fs = createTextSprite('FRONT', '#00ff00', 16); fs.position.set(startX, -0.22, 0); fs.scale.set(0.28, 0.08, 1); group.add(fs);
      const rs = createTextSprite('REAR', '#ff8800', 16); rs.position.set(startX + (data.length - 1) * spacing, -0.22, 0); rs.scale.set(0.28, 0.08, 1); group.add(rs);

      const buildingX = startX - 0.9;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.8 });
      const fw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.8), wallMat); fw.position.set(buildingX, 0.2, 0); fw.castShadow = true; group.add(fw);
      const dfm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.35), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 })); dfm.position.set(buildingX + 0.02, 0.1, 0); group.add(dfm);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.45, 0.15), new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.7 })); door.position.set(buildingX + 0.05, 0.08, 0.12); door.rotation.y = -0.8; group.add(door);
      group.add(new THREE.PointLight(0xffcc66, 0.5, 1)).position.set(buildingX - 0.1, 0.15, 0);
      const schC = document.createElement('canvas'); schC.width = 200; schC.height = 48;
      const schCtx = schC.getContext('2d')!; schCtx.fillStyle = '#1a5276'; schCtx.fillRect(0, 0, 200, 48); schCtx.strokeStyle = '#ffd700'; schCtx.lineWidth = 3; schCtx.strokeRect(2, 2, 196, 44);
      schCtx.fillStyle = '#fff'; schCtx.font = 'bold 16px Arial'; schCtx.textAlign = 'center'; schCtx.fillText('📚 DS ACADEMY 📚', 100, 32);
      const schS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(schC), transparent: true })); schS.position.set(buildingX, 0.62, 0); schS.scale.set(0.5, 0.12, 1); group.add(schS);
      const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.85), new THREE.MeshStandardMaterial({ color: '#c0392b' })); roofMesh.position.set(buildingX, 0.57, 0); group.add(roofMesh);
      const pathway = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.5), new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide }));
      pathway.rotation.x = -Math.PI / 2; pathway.position.y = -0.14; pathway.receiveShadow = true; group.add(pathway);
      const plMat = new THREE.MeshBasicMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
      [-0.2, 0.2].forEach(z => { const pl = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.01), plMat); pl.rotation.x = -Math.PI / 2; pl.position.set(0, -0.139, z); group.add(pl); });
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

  // ===== DATA =====
  const [groceryItems, setGroceryItems] = useState<DataItem[]>([{ id: 1, label: 'Milk', color: '#3498db' }, { id: 2, label: 'Bread', color: '#e67e22' }, { id: 3, label: 'Eggs', color: '#f1c40f' }, { id: 4, label: 'Apple', color: '#e74c3c' }, { id: 5, label: 'Juice', color: '#9b59b6' }]);
  const [students, setStudents] = useState<DataItem[]>([{ id: 1, label: 'Alex', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }, { id: 2, label: 'Beth', color: '#e91e63', appearance: { skinTone: '#f5d0c5', shirtColor: '#e91e63', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } }, { id: 3, label: 'Carl', color: '#27ae60', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }, { id: 4, label: 'Dana', color: '#f39c12', appearance: { skinTone: '#ffcd94', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' } }]);
  const [tasks, setTasks] = useState<DataItem[]>([{ id: 1, label: 'Study', color: '#e74c3c' }, { id: 2, label: 'Code', color: '#e74c3c' }, { id: 3, label: 'Read', color: '#f39c12' }, { id: 4, label: 'Rest', color: '#2ecc71' }]);
  const [trainCars, setTrainCars] = useState<DataItem[]>([{ id: 1, label: 'Engine', color: '#e74c3c' }, { id: 2, label: 'Coal', color: '#3498db' }, { id: 3, label: 'Cargo', color: '#2ecc71' }, { id: 4, label: 'Pass', color: '#9b59b6' }]);
  const [peopleLine, setPeopleLine] = useState<DataItem[]>([{ id: 1, label: 'Alice', color: '#e74c3c', appearance: { skinTone: '#ffdbac', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } }, { id: 2, label: 'Bob', color: '#3498db', appearance: { skinTone: '#8d5524', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }, { id: 3, label: 'Carol', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' } }]);
  const [dominoNodes, setDominoNodes] = useState<DataItem[]>([{ id: 1, label: '1', color: '#ecf0f1' }, { id: 2, label: '2', color: '#ecf0f1' }, { id: 3, label: '3', color: '#ecf0f1' }, { id: 4, label: '4', color: '#ecf0f1' }]);
  const [bookStack, setBookStack] = useState<DataItem[]>([{ id: 1, label: 'Math', color: '#3498db' }, { id: 2, label: 'Science', color: '#2ecc71' }, { id: 3, label: 'History', color: '#e67e22' }]);
  const [plateStack, setPlateStack] = useState<DataItem[]>([{ id: 1, label: 'Plate 1', color: '#ecf0f1' }, { id: 2, label: 'Plate 2', color: '#bdc3c7' }, { id: 3, label: 'Plate 3', color: '#95a5a6' }]);
  const [boxStack, setBoxStack] = useState<DataItem[]>([{ id: 1, label: 'Box A', color: '#e67e22' }, { id: 2, label: 'Box B', color: '#d35400' }, { id: 3, label: 'Box C', color: '#e74c3c' }]);
  const [tollGate, setTollGate] = useState<DataItem[]>([{ id: 1, label: 'Red', color: '#e74c3c' }, { id: 2, label: 'Blue', color: '#3498db' }, { id: 3, label: 'Green', color: '#2ecc71' }]);
  const [ticketQueue, setTicketQueue] = useState<DataItem[]>([{ id: 1, label: 'T-001', color: '#f39c12' }, { id: 2, label: 'T-002', color: '#e74c3c' }, { id: 3, label: 'T-003', color: '#9b59b6' }]);
  const [studentQueue, setStudentQueue] = useState<DataItem[]>([{ id: 1, label: 'Stu 1', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }, { id: 2, label: 'Stu 2', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } }, { id: 3, label: 'Stu 3', color: '#9b59b6', appearance: { skinTone: '#8d5524', shirtColor: '#9b59b6', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }]);

  // ===== HELPERS =====
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
  const zoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.1)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  // ===== CAMERA =====
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = newStream; await new Promise<void>((resolve) => { if (videoRef.current) videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); }; }); }
      setStream(newStream);
    } catch (err) { throw new Error('Cannot access camera.'); }
  }, [stream]);

  const switchCamera = async () => { const nf = cameraFacing === 'environment' ? 'user' : 'environment'; setCameraFacing(nf); try { await startCamera(nf); } catch (err) { console.error(err); } };

  const loadModel = async () => {
    setLoadingText('Loading AI...'); const tf = await import('@tensorflow/tfjs'); await tf.ready(); await tf.setBackend('webgl');
    setLoadingText('Loading detector...'); const cocoSsd = await import('@tensorflow-models/coco-ssd'); return await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  };

  useEffect(() => {
    const init = async () => { try { setLoadingText('Starting camera...'); await startCamera('environment'); const lm = await loadModel(); setModel(lm); setIsLoading(false); } catch (err: any) { setError(err.message); setIsLoading(false); } };
    init(); return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  // ===== PERSON DETECTION =====
  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current || appMode !== 'person') return;
    let animationId: number, running = true, lastDetection = 0;
    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;
      const now = Date.now(); if (now - lastDetection < 100) { animationId = requestAnimationFrame(detect); return; } lastDetection = now;
      const video = videoRef.current, canvas = canvasRef.current; if (video.readyState !== 4) { animationId = requestAnimationFrame(detect); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      try {
        const predictions = await model.detect(video); const humans = predictions.filter((p: any) => p.class === 'person' && p.score > 0.5);
        if (humans.length > 0) { const [x, y, width, height] = humans[0].bbox; const scaleX = window.innerWidth / canvas.width, scaleY = window.innerHeight / canvas.height; setDetectedPerson({ bbox: humans[0].bbox, class: humans[0].class, score: humans[0].score }); setPersonPosition({ x: x * scaleX, y: y * scaleY, width: width * scaleX, height: height * scaleY }); }
        else { setDetectedPerson(null); setPersonPosition(null); }
      } catch (e) { console.error(e); }
      if (running) animationId = requestAnimationFrame(detect);
    };
    detect(); return () => { running = false; if (animationId) cancelAnimationFrame(animationId); };
  }, [model, appMode]);

  // ===== WEBXR =====
  useEffect(() => { const checkXR = async () => { try { if ((navigator as any).xr) { const s = await (navigator as any).xr.isSessionSupported('immersive-ar'); setWebxrSupported(s); } } catch { setWebxrSupported(false); } }; checkXR(); }, []);

  const cleanupWebXR = useCallback(() => {
    if (xrRendererRef.current) { xrRendererRef.current.setAnimationLoop(null); xrRendererRef.current.dispose(); if (xrContainerRef.current && xrRendererRef.current.domElement.parentNode === xrContainerRef.current) xrContainerRef.current.removeChild(xrRendererRef.current.domElement); }
    xrSessionRef.current = null; xrRendererRef.current = null; xrSceneRef.current = null; xrCameraRef.current = null; xrGroupRef.current = null; xrReticleRef.current = null; xrHitTestSourceRef.current = null;
    setWebxrActive(false); setWebxrPlaced(false); setAppMode('surface');
  }, []);

  const stopWebXR = useCallback(() => { if (xrSessionRef.current) { try { xrSessionRef.current.end(); } catch (e) { cleanupWebXR(); } } else cleanupWebXR(); }, [cleanupWebXR]);

  const startWebXR = async () => {
    const xr = (navigator as any).xr; if (!xr) { alert('WebXR not available.'); setAppMode('surface'); return; }
    try {
      const sessionInit: any = { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'] };
      const overlayEl = document.getElementById('ar-overlay'); if (overlayEl) sessionInit.domOverlay = { root: overlayEl };
      const session = await xr.requestSession('immersive-ar', sessionInit); xrSessionRef.current = session;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight); renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local'); xrRendererRef.current = renderer;
      if (xrContainerRef.current) xrContainerRef.current.appendChild(renderer.domElement); await renderer.xr.setSession(session);
      const scene = new THREE.Scene(); xrSceneRef.current = scene; scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(5, 10, 7); dirLight.castShadow = true; scene.add(dirLight);
      scene.add(new THREE.DirectionalLight(0xffffff, 0.3)).position.set(-5, 5, -5);
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100); xrCameraRef.current = camera;
      const group = new THREE.Group(); group.visible = false; scene.add(group); xrGroupRef.current = group;
      const reticle = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
      reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); xrReticleRef.current = reticle;
      reticle.add(new THREE.Mesh(new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00ff00 })));
      const viewerSpace = await session.requestReferenceSpace('viewer'); const hitTestSource = await session.requestHitTestSource({ space: viewerSpace }); xrHitTestSourceRef.current = hitTestSource;
      session.addEventListener('select', () => { if (xrReticleRef.current?.visible && xrGroupRef.current && !xrGroupRef.current.visible) { xrGroupRef.current.position.setFromMatrixPosition(xrReticleRef.current.matrix); xrGroupRef.current.visible = true; xrGroupRef.current.scale.setScalar(0.3 * zoomLevel); xrReticleRef.current.visible = false; setWebxrPlaced(true); } });
      session.addEventListener('end', () => cleanupWebXR());
      renderer.setAnimationLoop((_ts: number, frame: any) => {
        if (frame && xrHitTestSourceRef.current && xrGroupRef.current && !xrGroupRef.current.visible) { const refSpace = renderer.xr.getReferenceSpace(); if (refSpace) { const results = frame.getHitTestResults(xrHitTestSourceRef.current); if (results.length > 0) { const pose = results[0].getPose(refSpace); if (pose && xrReticleRef.current) { xrReticleRef.current.visible = true; xrReticleRef.current.matrix.fromArray(pose.transform.matrix); } } else if (xrReticleRef.current) xrReticleRef.current.visible = false; } }
        renderer.render(scene, camera);
      });
      setWebxrActive(true); setWebxrPlaced(false); setAppMode('webxr');
    } catch (err: any) { console.error(err); alert('WebXR failed. Using Surface mode.'); setAppMode('surface'); }
  };

  useEffect(() => { if (appMode !== 'webxr' || !webxrPlaced || !xrGroupRef.current) return; buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData); }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData]);
  useEffect(() => { if (xrGroupRef.current && webxrActive && webxrPlaced) xrGroupRef.current.scale.setScalar(0.3 * zoomLevel); }, [zoomLevel, webxrActive, webxrPlaced]);
  const resetWebXRPlacement = useCallback(() => { if (xrGroupRef.current) xrGroupRef.current.visible = false; setWebxrPlaced(false); }, []);

  // ===== MODE SWITCHING =====
  const switchToMode = useCallback((mode: AppMode) => {
    if (appMode === 'webxr' && mode !== 'webxr') stopWebXR();
    if (mode === 'webxr') { if (!webxrSupported) { alert('WebXR not supported.'); mode = 'surface'; } else { startWebXR(); return; } }
    setAppMode(mode);
    if (mode === 'surface') { setDetectedPerson(null); setPersonPosition(null); setSurfacePlaced(false); setSurfacePosition(null); }
    else if (mode === 'person') { setSurfacePlaced(false); setSurfacePosition(null); }
  }, [appMode, webxrSupported, stopWebXR]);

  // ===== SURFACE =====
  const handleSurfaceTap = useCallback((e: React.MouseEvent) => {
    if (appMode !== 'surface' || surfacePlaced) return; const { clientX, clientY } = e;
    if (clientY < 160 || clientY > window.innerHeight - 180) return;
    const vizWidth = Math.min(window.innerWidth - 20, 380); const vizHeight = currentStructure === 'stack' ? 300 : 220;
    setSurfacePosition({ x: clientX - vizWidth / 2, y: clientY - vizHeight / 2, width: vizWidth, height: vizHeight }); setSurfacePlaced(true);
  }, [appMode, surfacePlaced, currentStructure]);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (appMode !== 'surface' || !surfacePlaced || !surfacePosition) return;
    let clientX: number, clientY: number;
    if ('touches' in e) { if (e.touches.length !== 1) return; clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } else { clientX = e.clientX; clientY = e.clientY; }
    const v = surfacePosition; if (clientX >= v.x && clientX <= v.x + v.width && clientY >= v.y && clientY <= v.y + v.height) { setIsDraggingSurface(true); dragOffsetRef.current = { x: clientX - v.x, y: clientY - v.y }; }
  }, [appMode, surfacePlaced, surfacePosition]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingSurface || !surfacePosition) return; let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } else { clientX = e.clientX; clientY = e.clientY; }
    setSurfacePosition(prev => prev ? { ...prev, x: clientX - dragOffsetRef.current.x, y: clientY - dragOffsetRef.current.y } : null);
  }, [isDraggingSurface, surfacePosition]);

  const handleDragEnd = useCallback(() => setIsDraggingSurface(false), []);
  const resetSurfacePlacement = useCallback(() => { setSurfacePlaced(false); setSurfacePosition(null); }, []);
  const activePosition = appMode === 'person' ? personPosition : surfacePosition;
  const showVisualization = appMode === 'person' ? !!detectedPerson : appMode === 'surface' ? surfacePlaced : false;
  const showControls = showVisualization || (appMode === 'webxr' && webxrPlaced);

  // ===== ARRAY OPS =====
  const arrayAccess = async () => { if (isAnimating) return; setIsAnimating(true); const data = getArrayData(), index = Math.floor(Math.random() * data.length); setHighlightIndex(index); setOperationMessage(`Accessing [${index}]...`); setCodeDisplay(`// O(1) Access\narray[${index}]`); setAnimPhase('access-lift'); setAnimData({ index }); await delay(400); setAnimPhase('access-bounce'); setOperationMessage(`Found: "${data[index].label}"`); await delay(900); setAnimPhase('access-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const arrayInsert = async () => { if (isAnimating || getArrayData().length >= 6) return; setIsAnimating(true); const data = getArrayData(), insertIndex = Math.floor(Math.random() * (data.length + 1)); setOperationMessage(`Inserting at [${insertIndex}]...`); setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`); for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(250); } (setArrayData as any)((prev: DataItem[]) => { const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' }); return arr; }); setHighlightIndex(insertIndex); setAnimPhase('insert-drop'); setAnimData({ index: insertIndex }); await delay(500); setAnimPhase('insert-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setOperationMessage('Inserted!'); await delay(800); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const arrayDelete = async () => { if (isAnimating || getArrayData().length <= 2) return; setIsAnimating(true); const data = getArrayData(), deleteIndex = Math.floor(Math.random() * data.length); setHighlightIndex(deleteIndex); setOperationMessage(`Deleting [${deleteIndex}]: "${data[deleteIndex].label}"`); setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`); setAnimPhase('delete-lift'); setAnimData({ index: deleteIndex }); await delay(500); setAnimPhase('delete-shrink'); await delay(500); setHighlightIndex(null); setAnimPhase('delete-close'); setAnimData({ deleteIndex }); (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex)); await delay(500); setAnimPhase(''); setAnimData({}); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const arraySwap = async () => { if (isAnimating) return; setIsAnimating(true); const data = getArrayData(); const idx1 = Math.floor(Math.random() * data.length); let idx2 = Math.floor(Math.random() * data.length); while (idx2 === idx1) idx2 = Math.floor(Math.random() * data.length); setHighlightIndex(idx1); setHighlightIndex2(idx2); setOperationMessage(`Swapping [${idx1}] ↔ [${idx2}]`); setCodeDisplay('// O(1) Swap'); setAnimPhase('swap-lift'); setAnimData({ index1: idx1, index2: idx2 }); await delay(500); setAnimPhase('swap-cross'); await delay(400); (setArrayData as any)((prev: DataItem[]) => { const a = [...prev]; [a[idx1], a[idx2]] = [a[idx2], a[idx1]]; return a; }); setAnimPhase('swap-drop'); await delay(500); setAnimPhase(''); setAnimData({}); setHighlightIndex(null); setHighlightIndex2(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };

  // ===== LINKED LIST OPS =====
  const linkedListInsertHead = async () => { if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true); setOperationMessage('Inserting at HEAD...'); setCodeDisplay('// O(1)\nnewNode.next = head\nhead = newNode'); const newItem: DataItem = linkedListEnv === 'people' ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } } : { id: Date.now(), label: 'New', color: '#1abc9c' }; (setLinkedListData as any)((prev: DataItem[]) => [newItem, ...prev]); setHighlightIndex(0); setAnimPhase('ll-insert-head'); setAnimData({ index: 0 }); await delay(500); setAnimPhase('ll-insert-head-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setOperationMessage('Inserted at HEAD!'); await delay(1000); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const linkedListInsertTail = async () => { if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true); const data = getLinkedListData(); setOperationMessage('Traversing to TAIL...'); setCodeDisplay('// O(n) Traverse'); for (let i = 0; i < data.length; i++) { setHighlightIndex(i); setAnimPhase('ll-traverse'); setAnimData({ index: i }); await delay(350); } setAnimPhase(''); setAnimData({}); const newItem: DataItem = linkedListEnv === 'people' ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } } : { id: Date.now(), label: 'New', color: '#e74c3c' }; (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]); setHighlightIndex(data.length); setAnimPhase('ll-insert-tail'); setAnimData({ index: data.length }); await delay(500); setAnimPhase('ll-insert-tail-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setOperationMessage('Inserted at TAIL!'); await delay(1000); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const linkedListDeleteHead = async () => { if (isAnimating || getLinkedListData().length <= 2) return; setIsAnimating(true); setHighlightIndex(0); setOperationMessage('Deleting HEAD...'); setCodeDisplay('// O(1)\nhead = head.next'); setAnimPhase('ll-delete-lift'); setAnimData({ index: 0 }); await delay(500); setAnimPhase('ll-delete-shrink'); await delay(500); (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1)); setAnimPhase(''); setAnimData({}); await delay(500); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const linkedListTraverse = async () => { if (isAnimating) return; setIsAnimating(true); const data = getLinkedListData(); for (let i = 0; i < data.length; i++) { setHighlightIndex(i); setOperationMessage(`Visiting: ${data[i].label}`); setCodeDisplay(`// Node ${i}\ncurr = curr.next`); setAnimPhase('ll-traverse'); setAnimData({ index: i }); await delay(500); } setAnimPhase(''); setAnimData({}); setOperationMessage(`Done! ${data.length} nodes`); await delay(1000); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };

  // ===== STACK OPS =====
  const stackPush = async () => { if (isAnimating || getStackData().length >= 5) return; setIsAnimating(true); const data = getStackData(); const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`]; const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c'] : ['#7f8c8d']; const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] }; setOperationMessage(`Pushing "${newItem.label}"...`); setCodeDisplay(`// O(1) LIFO\nstack.push("${newItem.label}")`); (setStackData as any)((prev: DataItem[]) => [...prev, newItem]); setHighlightIndex(data.length); setAnimPhase('stack-push-drop'); setAnimData({ index: data.length }); await delay(500); setAnimPhase('stack-push-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setOperationMessage('Pushed!'); await delay(800); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const stackPop = async () => { if (isAnimating || getStackData().length <= 1) return; setIsAnimating(true); const data = getStackData(), topItem = data[data.length - 1]; setHighlightIndex(data.length - 1); setOperationMessage(`Popping "${topItem.label}"...`); setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`); setAnimPhase('stack-pop-lift'); setAnimData({ index: data.length - 1 }); await delay(500); setAnimPhase('stack-pop-fly'); await delay(500); (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1)); setAnimPhase(''); setAnimData({}); await delay(500); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const stackPeek = async () => { if (isAnimating || getStackData().length === 0) return; setIsAnimating(true); const data = getStackData(), topItem = data[data.length - 1]; setHighlightIndex(data.length - 1); setOperationMessage(`Peeking TOP...`); setCodeDisplay(`// O(1)\nstack.peek()`); setAnimPhase('stack-peek-lift'); setAnimData({ index: data.length - 1 }); await delay(400); setAnimPhase('stack-peek-open'); setOperationMessage(`TOP: "${topItem.label}"`); await delay(1200); setAnimPhase('stack-peek-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };

  // ===== QUEUE OPS =====
  const queueEnqueue = async () => { if (isAnimating || getQueueData().length >= 5) return; setIsAnimating(true); const data = getQueueData(); const newItem: DataItem = queueEnv === 'students' ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } } : { id: Date.now(), label: queueEnv === 'tollgate' ? 'New Car' : `T-00${data.length + 1}`, color: '#1abc9c' }; setOperationMessage(`Enqueue: "${newItem.label}"...`); setCodeDisplay(`// O(1) FIFO\nqueue.enqueue("${newItem.label}")`); (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]); setHighlightIndex(data.length); setAnimPhase('queue-enqueue-enter'); setAnimData({ index: data.length }); await delay(500); setAnimPhase('queue-enqueue-settle'); await delay(400); setAnimPhase(''); setAnimData({}); setOperationMessage('Enqueued!'); await delay(800); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const queueDequeue = async () => { if (isAnimating || getQueueData().length <= 1) return; setIsAnimating(true); const frontItem = getQueueData()[0]; setHighlightIndex(0); setOperationMessage(`Dequeue: "${frontItem.label}"...`); setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`); setAnimPhase('queue-dequeue-exit'); setAnimData({ index: 0 }); await delay(600); setAnimPhase('queue-dequeue-gone'); await delay(400); (setQueueData as any)((prev: DataItem[]) => prev.slice(1)); setAnimPhase(''); setAnimData({}); await delay(500); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };
  const queueFront = async () => { if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true); const frontItem = getQueueData()[0]; setHighlightIndex(0); setOperationMessage(`FRONT: "${frontItem.label}"`); setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`); setAnimPhase('queue-front-peek'); setAnimData({ index: 0 }); await delay(1500); setAnimPhase(''); setAnimData({}); setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false); };

  // ===== RENDER =====
  if (error) return (<div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}><div style={{ fontSize: 80 }}>📷</div><h2>Camera Access Needed</h2><button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white' }}>🔄 Try Again</button></div>);
  if (isLoading) return (<div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}><div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2><p>{loadingText}</p><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>);

  const envTabs = currentStructure === 'array' ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }] : currentStructure === 'linkedlist' ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }] : currentStructure === 'stack' ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }] : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  return (
    <div id="ar-overlay" style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }} onClick={appMode === 'surface' && !surfacePlaced ? handleSurfaceTap : undefined} onTouchStart={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined} onTouchMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined} onTouchEnd={appMode === 'surface' ? handleDragEnd : undefined} onMouseDown={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined} onMouseMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined} onMouseUp={appMode === 'surface' ? handleDragEnd : undefined}>
      {!webxrActive && <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div ref={xrContainerRef} style={{ position: 'fixed', inset: 0, zIndex: webxrActive ? 1 : -1, pointerEvents: 'none' }} />
      {!webxrActive && showVisualization && activePosition && (<Visualization3D position={activePosition} data={currentData} highlightIndex={highlightIndex} highlightIndex2={highlightIndex2} structure={currentStructure} environment={currentEnvId} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} isSurfaceMode={appMode === 'surface'} animPhase={animPhase} animData={animData} />)}
      {!webxrActive && appMode === 'surface' && surfacePlaced && surfacePosition && (<div style={{ position: 'absolute', left: surfacePosition.x + 40, top: surfacePosition.y + surfacePosition.height, width: surfacePosition.width - 80, height: 25, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)', borderRadius: '50%', zIndex: 49, pointerEvents: 'none' }} />)}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {!webxrActive && <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200 }}>🔄</button>}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5, cursor: 'pointer' }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5, cursor: 'pointer' }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'webxr' ? '#e17055' : 'transparent', color: 'white', opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25, cursor: webxrSupported ? 'pointer' : 'not-allowed' }}>🌐 WebXR{!webxrSupported && ' ✗'}</button>
        </div>

        {showControls && (<div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onPointerDown={zoomIn} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold' }}>+</button>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
          <button onPointerDown={zoomOut} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold' }}>−</button>
          <button onPointerDown={resetZoom} style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 20 }}>⟲</button>
        </div>)}

        <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (<button key={s} onClick={() => { if (!isAnimating) { setCurrentStructure(s); if (appMode === 'surface') { setSurfacePlaced(false); setSurfacePosition(null); } } }} style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>{{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}{currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}</button>))}
        </div>

        {showControls && (<div style={{ position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
          {envTabs.map(e => (<button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as any)(e.id)} style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>{e.icon} {e.label}</button>))}
        </div>)}

        {operationMessage && <div style={{ position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px', borderRadius: 15, fontSize: 14, border: '1px solid #0f0', whiteSpace: 'nowrap' }}>⚡ {operationMessage}</div>}
        {codeDisplay && <div style={{ position: 'absolute', top: 168, left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444' }}>{codeDisplay}</div>}
        {webxrActive && <button onClick={stopWebXR} style={{ position: 'absolute', top: 10, right: 10, padding: '10px 18px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20, fontSize: 13, fontWeight: 'bold', zIndex: 300 }}>✕ Exit AR</button>}
      </div>

      {showControls && (<div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
        {appMode === 'surface' && surfacePlaced && (<div style={{ textAlign: 'center', marginBottom: 10 }}><button onClick={resetSurfacePlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 10 }}>or drag to move</span></div>)}
        {appMode === 'webxr' && webxrPlaced && (<div style={{ textAlign: 'center', marginBottom: 10 }}><button onClick={resetWebXRPlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button></div>)}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {currentStructure === 'array' && (<><OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" /><OpBtn onClick={arrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Insert" /><OpBtn onClick={arrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="➖ Delete" /><OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" /></>)}
          {currentStructure === 'linkedlist' && (<><OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" /><OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" /><OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" /><OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" /></>)}
          {currentStructure === 'stack' && (<><OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" /><OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" /><OpBtn onClick={stackPeek} disabled={isAnimating} color="#f39c12" label="👁️ Peek" /></>)}
          {currentStructure === 'queue' && (<><OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" /><OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" /><OpBtn onClick={queueFront} disabled={isAnimating} color="#f39c12" label="👁️ Front" /></>)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Size: {currentData.length}{appMode === 'surface' && <span style={{ marginLeft: 10, color: '#00b894' }}>📱 Surface</span>}{appMode === 'webxr' && <span style={{ marginLeft: 10, color: '#e17055' }}>🌐 WebXR</span>}</div>
      </div>)}

      {appMode === 'person' && !detectedPerson && !webxrActive && (<div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}><div style={{ fontSize: 40 }}>🧑</div><div style={{ marginTop: 8 }}>Point camera at a person</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>or switch to Surface / WebXR →</div></div>)}
      {appMode === 'surface' && !surfacePlaced && !webxrActive && (<div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}><div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div><div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Tap anywhere to place your data structure</div><style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style></div>)}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (<div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}><div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div><div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning for surfaces...</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Point at floor or table, tap to place</div><style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); opacity: 0.7; } }`}</style></div>)}
    </div>
  );
}

// ==================== OPERATION BUTTON ====================

function OpBtn({ onClick, disabled, color, label }: { onClick: () => void; disabled: boolean; color: string; label: string }) {
  return (<button onClick={onClick} disabled={disabled} style={{ padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25, background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1 }}>{label}</button>);
}

// ==================== VISUALIZATION 3D (IMPROVED) ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode, animPhase, animData }: {
  position: Position; data: DataItem[]; highlightIndex: number | null; highlightIndex2: number | null;
  structure: DataStructure; environment: string; zoomLevel: number; setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean; animPhase: string; animData: Record<string, any>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);
  const isDraggingRef = useRef(false);
  const autoRotateRef = useRef(true);
  const timeRef = useRef(0);
  const particlesRef = useRef<THREE.Points | null>(null);
  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.04);

    const camera = new THREE.PerspectiveCamera(42, renderWidth / renderHeight, 0.1, 100);
    camera.position.set(0, structure === 'stack' ? 1.8 : 1.0, structure === 'stack' ? 5.5 : 5.0);
    camera.lookAt(0, structure === 'stack' ? 0.3 : 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(renderWidth, renderHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Cinematic Lighting
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.5));
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.1);
    keyLight.position.set(5, 10, 5); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.near = 0.1; keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -5; keyLight.shadow.camera.right = 5; keyLight.shadow.camera.top = 5; keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.001; keyLight.shadow.radius = 4; scene.add(keyLight);
    scene.add(new THREE.DirectionalLight(0x8ec8ff, 0.35)).position.set(-6, 4, -3);
    scene.add(new THREE.DirectionalLight(0xffd700, 0.5)).position.set(-2, 3, -8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const spotLight = new THREE.SpotLight(0xffffff, 0.4, 12, Math.PI / 6, 0.5, 1);
    spotLight.position.set(0, 6, 2); spotLight.target.position.set(0, 0, 0); spotLight.castShadow = true; spotLight.shadow.mapSize.set(512, 512);
    scene.add(spotLight); scene.add(spotLight.target);

    scene.add(createGroundGrid());
    const particles = createParticleSystem(); particlesRef.current = particles; scene.add(particles);

    // Sky sphere
    const envGeo = new THREE.SphereGeometry(30, 32, 32);
    const envCanvas = document.createElement('canvas'); envCanvas.width = 256; envCanvas.height = 256;
    const ectx = envCanvas.getContext('2d')!;
    const envGrad = ectx.createLinearGradient(0, 0, 0, 256);
    envGrad.addColorStop(0, '#0a0a2e'); envGrad.addColorStop(0.3, '#0d1b3e'); envGrad.addColorStop(0.7, '#1a1a2e'); envGrad.addColorStop(1, '#0a0a15');
    ectx.fillStyle = envGrad; ectx.fillRect(0, 0, 256, 256);
    ectx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let s = 0; s < 60; s++) { ectx.beginPath(); ectx.arc(Math.random() * 256, Math.random() * 128, Math.random() * 1.5 + 0.3, 0, Math.PI * 2); ectx.fill(); }
    const envTex = new THREE.CanvasTexture(envCanvas);
    scene.add(new THREE.Mesh(envGeo, new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide, transparent: true, opacity: 0.5, depthWrite: false })));

    const group = new THREE.Group(); groupRef.current = group; scene.add(group);

    // Input
    let isDragging = false, lastX = 0, lastY = 0, pinchDist: number | null = null, pinchZoom = 1, dragVelocityY = 0;
    const getDist = (t: TouchList): number | null => { if (t.length < 2) return null; const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); };
    const onTS = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2) { pinchDist = getDist(e.touches); pinchZoom = zoomRef.current; } else if (e.touches.length === 1) { isDragging = true; isDraggingRef.current = true; autoRotateRef.current = false; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTM = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 2 && pinchDist !== null) { const d = getDist(e.touches); if (d) setZoomLevel(Math.max(0.1, Math.min(4, pinchZoom * (d / pinchDist)))); } else if (e.touches.length === 1 && isDragging) { const dx = e.touches[0].clientX - lastX; const dy = e.touches[0].clientY - lastY; rotationRef.current.y += dx * 0.008; rotationRef.current.x = Math.max(-1, Math.min(1, rotationRef.current.x + dy * 0.006)); dragVelocityY = dx * 0.008; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; } };
    const onTE = (e: TouchEvent) => { e.preventDefault(); if (e.touches.length < 2) pinchDist = null; if (e.touches.length === 0) { isDragging = false; isDraggingRef.current = false; setTimeout(() => { autoRotateRef.current = true; }, 3000); } };
    const onMD = (e: MouseEvent) => { isDragging = true; isDraggingRef.current = true; autoRotateRef.current = false; lastX = e.clientX; lastY = e.clientY; };
    const onMM = (e: MouseEvent) => { if (!isDragging) return; const dx = e.clientX - lastX; const dy = e.clientY - lastY; rotationRef.current.y += dx * 0.008; rotationRef.current.x = Math.max(-1, Math.min(1, rotationRef.current.x + dy * 0.006)); dragVelocityY = dx * 0.008; lastX = e.clientX; lastY = e.clientY; };
    const onMU = () => { isDragging = false; isDraggingRef.current = false; setTimeout(() => { autoRotateRef.current = true; }, 3000); };
    const onWH = (e: WheelEvent) => { e.preventDefault(); setZoomLevel(Math.max(0.1, Math.min(4, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15)))); };

    container.addEventListener('touchstart', onTS, { passive: false }); container.addEventListener('touchmove', onTM, { passive: false }); container.addEventListener('touchend', onTE, { passive: false });
    container.addEventListener('mousedown', onMD); container.addEventListener('mousemove', onMM); container.addEventListener('mouseup', onMU); container.addEventListener('mouseleave', onMU);
    container.addEventListener('wheel', onWH, { passive: false });

    let animationId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta(); timeRef.current += delta; const t = timeRef.current;
      if (autoRotateRef.current && !isDraggingRef.current) rotationRef.current.y += delta * 0.12;
      if (!isDragging && Math.abs(dragVelocityY) > 0.0001) { rotationRef.current.y += dragVelocityY; dragVelocityY *= 0.95; }

      if (particlesRef.current) {
        const posArr = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const speeds = (particlesRef.current.geometry as any)._speeds as Float32Array;
        for (let i = 0; i < posArr.length; i += 3) { posArr[i + 1] += speeds[i / 3] * delta; posArr[i] += Math.sin(t * 0.5 + i) * delta * 0.02; if (posArr[i + 1] > 3) { posArr[i + 1] = -0.5; posArr[i] = (Math.random() - 0.5) * 10; posArr[i + 2] = (Math.random() - 0.5) * 6; } }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
        (particlesRef.current.material as THREE.PointsMaterial).opacity = 0.3 + Math.sin(t * 1.5) * 0.15;
      }

      if (groupRef.current) {
        groupRef.current.traverse((child) => {
          if (child.userData.isHighlighted && child.userData.baseY !== undefined) child.position.y = child.userData.baseY + Math.sin(t * 3) * 0.04;
          if (child.userData.isGlow && (child as THREE.Mesh).material) { const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial; if (mat.opacity !== undefined) mat.opacity = 0.08 + Math.sin(t * 4) * 0.08; }
          if (child.userData.rotates) child.rotation.y = t * 1.5;
          if (child.userData.isArrowGlow && (child as THREE.Line).material) { (((child as THREE.Line).material) as THREE.LineBasicMaterial).opacity = 0.2 + Math.sin(t * 3) * 0.15; }
          if (child.userData.pulseEmissive && (child as THREE.Mesh).material) { const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial; if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.3 + Math.sin(t * 3) * 0.2; }
        });
        groupRef.current.rotation.x = rotationRef.current.x; groupRef.current.rotation.y = rotationRef.current.y; groupRef.current.scale.setScalar(zoomRef.current);
      }
      spotLight.intensity = 0.3 + Math.sin(t * 0.8) * 0.1;
      renderer.render(scene, camera); animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('touchstart', onTS); container.removeEventListener('touchmove', onTM); container.removeEventListener('touchend', onTE);
      container.removeEventListener('mousedown', onMD); container.removeEventListener('mousemove', onMM); container.removeEventListener('mouseup', onMU); container.removeEventListener('mouseleave', onMU);
      container.removeEventListener('wheel', onWH); renderer.dispose(); envTex.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure, renderWidth, renderHeight]);

  useEffect(() => {
    if (!groupRef.current) return;
    disposeGroup(groupRef.current);
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData);
    if (groupRef.current) groupRef.current.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto', overflow: 'visible' }} />;
}

// ==================== END OF PART 2 ====================
