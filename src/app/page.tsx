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

// ==================== REALISTIC CHAIR (Classroom) ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.8, roughness: 0.3 });

  // Seat cushion
  const seatGeo = new THREE.BoxGeometry(0.28, 0.04, 0.26);
  const seatMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.y = -0.12;
  chair.add(seat);

  // Seat frame
  const frameGeo = new THREE.BoxGeometry(0.3, 0.02, 0.28);
  const frame = new THREE.Mesh(frameGeo, metalMat);
  frame.position.y = -0.15;
  chair.add(frame);

  // Back rest with padding
  const backGeo = new THREE.BoxGeometry(0.28, 0.22, 0.03);
  const backMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.set(0, 0.02, -0.12);
  chair.add(back);

  // Back frame
  const backFrameGeo = new THREE.BoxGeometry(0.3, 0.24, 0.02);
  const backFrame = new THREE.Mesh(backFrameGeo, metalMat);
  backFrame.position.set(0, 0.02, -0.135);
  chair.add(backFrame);

  // Metal legs
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8);
  [[-0.11, -0.27, 0.1], [0.11, -0.27, 0.1], [-0.11, -0.27, -0.1], [0.11, -0.27, -0.1]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  // Cross support bars
  const supportGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6);
  const support1 = new THREE.Mesh(supportGeo, metalMat);
  support1.rotation.z = Math.PI / 2;
  support1.position.set(0, -0.32, 0.1);
  chair.add(support1);
  const support2 = new THREE.Mesh(supportGeo, metalMat);
  support2.rotation.z = Math.PI / 2;
  support2.position.set(0, -0.32, -0.1);
  chair.add(support2);

  chair.position.x = x;
  return chair;
}

// ==================== CEREAL BOX (Grocery) ====================

function createCerealBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.28;
  const boxHeight = 0.42;
  const boxDepth = 0.08;

  // Main cereal box body
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

  // Front label with cereal branding
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 140;
  frontCanvas.height = 210;
  const fctx = frontCanvas.getContext('2d')!;

  // Background gradient
  const grad = fctx.createLinearGradient(0, 0, 0, 210);
  grad.addColorStop(0, color);
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, '#ffffff');
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, 140, 210);

  // Top banner
  fctx.fillStyle = '#fff';
  fctx.fillRect(5, 5, 130, 30);
  fctx.fillStyle = '#e74c3c';
  fctx.font = 'bold 12px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('★ BREAKFAST ★', 70, 24);

  // Cereal bowl illustration
  fctx.fillStyle = '#f5f5dc';
  fctx.beginPath();
  fctx.ellipse(70, 100, 40, 25, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.strokeStyle = '#ddd';
  fctx.lineWidth = 2;
  fctx.stroke();

  // Cereal pieces in bowl
  const cerealColors = ['#8B4513', '#D2691E', '#F4A460', '#DEB887'];
  for (let i = 0; i < 12; i++) {
    fctx.fillStyle = cerealColors[i % cerealColors.length];
    fctx.beginPath();
    fctx.ellipse(50 + Math.random() * 40, 90 + Math.random() * 15, 6, 4, Math.random(), 0, Math.PI * 2);
    fctx.fill();
  }

  // Milk splash
  fctx.fillStyle = 'rgba(255,255,255,0.8)';
  fctx.beginPath();
  fctx.ellipse(90, 85, 15, 8, -0.3, 0, Math.PI * 2);
  fctx.fill();

  // Product name
  fctx.fillStyle = '#2c3e50';
  fctx.font = 'bold 18px Arial';
  fctx.fillText(label, 70, 155);

  // Tagline
  fctx.fillStyle = '#666';
  fctx.font = '10px Arial';
  fctx.fillText('Crunchy & Delicious!', 70, 172);

  // Nutrition badge
  fctx.fillStyle = '#27ae60';
  fctx.beginPath();
  fctx.arc(115, 185, 18, 0, Math.PI * 2);
  fctx.fill();
  fctx.fillStyle = '#fff';
  fctx.font = 'bold 8px Arial';
  fctx.fillText('WHOLE', 115, 183);
  fctx.fillText('GRAIN', 115, 193);

  // Weight
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

  // Side nutrition panel
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 40;
  sideCanvas.height = 210;
  const sctx = sideCanvas.getContext('2d')!;
  sctx.fillStyle = '#f8f8f8';
  sctx.fillRect(0, 0, 40, 210);
  sctx.fillStyle = '#333';
  sctx.font = 'bold 6px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('Nutrition', 20, 15);
  sctx.fillText('Facts', 20, 24);
  
  // Nutrition lines
  sctx.strokeStyle = '#ddd';
  sctx.lineWidth = 0.5;
  for (let y = 35; y < 200; y += 10) {
    sctx.beginPath();
    sctx.moveTo(3, y);
    sctx.lineTo(37, y);
    sctx.stroke();
  }

  const sideTex = new THREE.CanvasTexture(sideCanvas);
  const sideLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(boxDepth - 0.01, boxHeight - 0.01),
    new THREE.MeshBasicMaterial({ map: sideTex, transparent: true })
  );
  sideLabel.position.set(boxWidth / 2 + 0.001, boxHeight / 2, 0);
  sideLabel.rotation.y = Math.PI / 2;
  product.add(sideLabel);

  // Top flap
  const topGeo = new THREE.BoxGeometry(boxWidth, 0.01, boxDepth);
  const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = boxHeight + 0.005;
  product.add(top);

  // Price tag
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
    'Coco Crunch': '$4.99',
    'Corn Flakes': '$3.49',
    'Froot Loops': '$5.29',
    'Cheerios': '$4.79',
    'Frosted': '$4.49',
    'New': '$3.99'
  };
  tctx.fillText(prices[label] || '$4.99', 32, 22);

  const tagTex = new THREE.CanvasTexture(tagCanvas);
  const priceTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshBasicMaterial({ map: tagTex, transparent: true })
  );
  priceTag.position.set(0, 0.02, boxDepth / 2 + 0.02);
  product.add(priceTag);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.04, boxHeight + 0.04, boxDepth + 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = boxHeight / 2;
    product.add(glow);

    const arrowGeo = new THREE.ConeGeometry(0.05, 0.08, 8);
    const arrowMesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#ffff00' }));
    arrowMesh.position.y = boxHeight + 0.12;
    arrowMesh.rotation.z = Math.PI;
    product.add(arrowMesh);
  }

  return product;
}

// ==================== REALISTIC HUMAN 3D (Sims-like) ====================

function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean, isSeated: boolean = false, walkPhase: number = 0): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  // ===== HEAD =====
  const headGroup = new THREE.Group();

  // Head shape
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

  // ===== HAIR =====
  if (appearance.hairStyle !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({
      color: appearance.hairColor,
      roughness: 0.8,
    });

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

      const fadeMat = new THREE.MeshStandardMaterial({
        color: appearance.hairColor,
        roughness: 0.9,
        transparent: true,
        opacity: 0.7,
      });
      [-0.082, 0.082].forEach(x => {
        const fadeGeo = new THREE.SphereGeometry(0.03, 12, 12);
        const fade = new THREE.Mesh(fadeGeo, fadeMat);
        fade.position.set(x, 0.02, 0);
        fade.scale.set(0.4, 0.8, 0.7);
        headGroup.add(fade);
      });
    }
  }

  // ===== FACE DETAILS =====
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

  // Eyebrows
  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
  [-0.03, 0.03].forEach((x, i) => {
    const browGeo = new THREE.BoxGeometry(0.028, 0.006, 0.008);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.038, 0.072);
    brow.rotation.z = i === 0 ? -0.12 : 0.12;
    headGroup.add(brow);
  });

  // Nose
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

  // Mouth
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

  // Ears
  const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  [-0.087, 0.087].forEach(x => {
    const earGroup = new THREE.Group();
    const outerEarGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const outerEar = new THREE.Mesh(outerEarGeo, earMat);
    outerEar.scale.set(0.4, 0.85, 0.55);
    earGroup.add(outerEar);

    const innerEarGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const innerEarMat = new THREE.MeshStandardMaterial({
      color: appearance.skinTone,
      roughness: 0.5,
      emissive: '#331111',
      emissiveIntensity: 0.1,
    });
    const innerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
    innerEar.position.z = 0.003;
    innerEar.scale.set(0.3, 0.6, 0.3);
    earGroup.add(innerEar);

    earGroup.position.set(x, 0, 0);
    headGroup.add(earGroup);
  });

  // Chin
  const chinGeo = new THREE.SphereGeometry(0.04, 12, 12);
  const chinMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  const chin = new THREE.Mesh(chinGeo, chinMat);
  chin.position.set(0, -0.06, 0.03);
  chin.scale.set(1, 0.5, 0.8);
  headGroup.add(chin);

  // Cheeks
  const cheekGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const cheekMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.6,
    emissive: '#ff9999',
    emissiveIntensity: 0.05,
  });
  [-0.05, 0.05].forEach(x => {
    const cheek = new THREE.Mesh(cheekGeo, cheekMat);
    cheek.position.set(x, -0.015, 0.06);
    cheek.scale.set(0.8, 0.6, 0.4);
    headGroup.add(cheek);
  });

  headGroup.position.y = isSeated ? 0.28 : 0.32;
  human.add(headGroup);

  // ===== NECK =====
  const neckGeo = new THREE.CylinderGeometry(0.024, 0.03, 0.045, 16);
  const neckMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = isSeated ? 0.17 : 0.21;
  human.add(neck);

  // ===== TORSO =====
  const torsoGroup = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.075, 0.058, 0.17, 16);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torsoGroup.add(torso);

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.055, 0.012, 8, 16, Math.PI * 1.2);
  const collarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.075, 0.02);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.z = -Math.PI * 0.1;
  torsoGroup.add(collar);

  // Buttons
  const buttonGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  [0.04, 0, -0.04].forEach(y => {
    const button = new THREE.Mesh(buttonGeo, buttonMat);
    button.position.set(0, y, 0.06);
    torsoGroup.add(button);
  });

  // Shirt bottom
  const shirtBottomGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.02, 16);
  const shirtBottom = new THREE.Mesh(shirtBottomGeo, torsoMat);
  shirtBottom.position.y = -0.095;
  torsoGroup.add(shirtBottom);

  torsoGroup.position.y = isSeated ? 0.07 : 0.11;
  human.add(torsoGroup);

  // ===== ARMS =====
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

    armGroup.position.set(side * 0.09, isSeated ? 0.06 : 0.1, 0);
    
    if (isSeated) {
      // Arms resting on desk
      armGroup.rotation.x = -0.8;
      armGroup.rotation.z = side * 0.3;
    } else {
      armGroup.rotation.z = side * 0.15;
      // Walking arm swing
      if (walkPhase > 0) {
        armGroup.rotation.x = Math.sin(walkPhase) * 0.3 * side;
      }
    }
    human.add(armGroup);
  });

  // ===== BELT =====
  const beltGeo = new THREE.CylinderGeometry(0.058, 0.055, 0.018, 16);
  const beltMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = isSeated ? -0.01 : 0.025;
  human.add(belt);

  // Belt buckle
  const buckleGeo = new THREE.BoxGeometry(0.02, 0.015, 0.008);
  const buckleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
  const buckle = new THREE.Mesh(buckleGeo, buckleMat);
  buckle.position.set(0, isSeated ? -0.01 : 0.025, 0.055);
  human.add(buckle);

  // ===== HIPS / PANTS TOP =====
  const hipsGeo = new THREE.CylinderGeometry(0.057, 0.052, 0.04, 16);
  const hipsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  const hips = new THREE.Mesh(hipsGeo, hipsMat);
  hips.position.y = isSeated ? -0.035 : 0.005;
  human.add(hips);

  // ===== LEGS =====
  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });

  [-0.03, 0.03].forEach((x, legIndex) => {
    const legGroup = new THREE.Group();

    if (isSeated) {
      // Seated legs - thighs horizontal, lower legs vertical
      const thighGeo = new THREE.CapsuleGeometry(0.022, 0.08, 8, 16);
      const thigh = new THREE.Mesh(thighGeo, legMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.z = 0.06;
      legGroup.add(thigh);

      const kneeGeo = new THREE.SphereGeometry(0.022, 10, 10);
      const knee = new THREE.Mesh(kneeGeo, legMat);
      knee.position.set(0, 0, 0.12);
      legGroup.add(knee);

      const shinGeo = new THREE.CapsuleGeometry(0.018, 0.08, 8, 16);
      const shin = new THREE.Mesh(shinGeo, legMat);
      shin.position.set(0, -0.06, 0.12);
      legGroup.add(shin);

      const ankleGeo = new THREE.SphereGeometry(0.016, 8, 8);
      const ankle = new THREE.Mesh(ankleGeo, legMat);
      ankle.position.set(0, -0.12, 0.12);
      legGroup.add(ankle);

      legGroup.position.set(x, -0.06, 0);
    } else {
      // Standing/walking legs
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
      
      // Walking leg swing
      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase + (legIndex === 0 ? 0 : Math.PI)) * 0.4;
        legGroup.rotation.x = swing;
      }
    }
    
    human.add(legGroup);
  });

  // ===== SHOES =====
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.8 });

  [-0.03, 0.03].forEach((x, shoeIndex) => {
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

    if (isSeated) {
      shoeGroup.position.set(x, -0.19, 0.12);
    } else {
      shoeGroup.position.set(x, -0.155, 0.008);
      
      // Walking foot movement
      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase + (shoeIndex === 0 ? 0 : Math.PI)) * 0.4;
        if (swing > 0) {
          shoeGroup.position.y += swing * 0.03;
          shoeGroup.position.z += swing * 0.02;
        }
      }
    }
    
    human.add(shoeGroup);
  });

  // ===== NAME LABEL =====
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
  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTex, transparent: true })
  );
  labelSprite.position.y = isSeated ? 0.46 : 0.5;
  labelSprite.scale.set(0.35, 0.09, 1);
  human.add(labelSprite);

  // ===== HIGHLIGHT EFFECTS =====
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.08, 0.13, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = isSeated ? -0.2 : -0.16;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);

    const arrowGeo = new THREE.ConeGeometry(0.04, 0.08, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffff00' });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.y = isSeated ? 0.54 : 0.58;
    arrowMesh.rotation.z = Math.PI;
    human.add(arrowMesh);
  }

  return human;
}

// ==================== END OF PART 1 ====================
// ==================== PART 2: Train, Tollgate, Cars, Boxes, Plates, Dominos ====================
// Place right after Part 1

// ==================== REALISTIC TRAIN CAR (Facing Right Direction) ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  // Main body
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

  // Body stripe
  const stripeGeo = new THREE.BoxGeometry(0.72, 0.03, 0.33);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.2;
  train.add(stripe);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.66, 0.04, 0.28);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.32;
  train.add(roof);

  // Curved roof top
  const roofCurveGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.66, 16, 1, false, 0, Math.PI);
  const roofCurve = new THREE.Mesh(roofCurveGeo, roofMat);
  roofCurve.position.y = 0.32;
  roofCurve.rotation.z = Math.PI / 2;
  roofCurve.scale.y = 0.22;
  train.add(roofCurve);

  // Undercarriage
  const underGeo = new THREE.BoxGeometry(0.68, 0.05, 0.26);
  const underMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.7 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.04;
  train.add(under);

  // Wheels (detailed)
  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 24);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 });
  const hubCapGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.032, 16);
  const hubCapMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });

  const wheelPositions: [number, number, number][] = [
    [-0.22, -0.05, 0.16], [0.22, -0.05, 0.16],
    [-0.22, -0.05, -0.16], [0.22, -0.05, -0.16],
  ];
  
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    train.add(wheel);

    const hubCap = new THREE.Mesh(hubCapGeo, hubCapMat);
    hubCap.rotation.x = Math.PI / 2;
    hubCap.position.set(wx, wy, wz);
    train.add(hubCap);

    // Wheel spokes
    const spokeGeo = new THREE.BoxGeometry(0.004, 0.08, 0.004);
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#888' });
    [0, Math.PI / 3, Math.PI * 2 / 3].forEach(angle => {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.set(wx, wy, wz > 0 ? wz + 0.016 : wz - 0.016);
      spoke.rotation.z = angle;
      train.add(spoke);
    });
  });

  // Windows (for passenger cars)
  if (!isEngine) {
    const windowGeo = new THREE.PlaneGeometry(0.1, 0.09);
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#87ceeb',
      side: THREE.DoubleSide,
      metalness: 0.5,
      roughness: 0.1,
    });
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#444', metalness: 0.7 });

    [-0.22, 0, 0.22].forEach(x => {
      // Front side windows
      const wF = new THREE.Mesh(windowGeo, windowMat);
      wF.position.set(x, 0.18, 0.162);
      train.add(wF);

      // Window frame
      const frameGeo = new THREE.BoxGeometry(0.11, 0.1, 0.008);
      const frameF = new THREE.Mesh(frameGeo, windowFrameMat);
      frameF.position.set(x, 0.18, 0.163);
      train.add(frameF);

      // Back side windows
      const wB = new THREE.Mesh(windowGeo, windowMat);
      wB.position.set(x, 0.18, -0.162);
      train.add(wB);
    });
  }

  // Engine specific parts - FACING RIGHT (positive X direction)
  if (isEngine) {
    // Boiler (main cylinder) - positioned at FRONT (right side)
    const boilerGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.32, 24);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.5, roughness: 0.4 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.18, 0.14, 0);  // Front of engine
    train.add(boiler);

    // Boiler bands
    const bandGeo = new THREE.TorusGeometry(0.125, 0.01, 8, 24);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    [0.08, 0.2, 0.32].forEach(x => {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(x, 0.14, 0);
      band.rotation.y = Math.PI / 2;
      train.add(band);
    });

    // Boiler front plate
    const frontPlateGeo = new THREE.CircleGeometry(0.11, 24);
    const frontPlateMat = new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.7, side: THREE.DoubleSide });
    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.position.set(0.35, 0.14, 0);
    frontPlate.rotation.y = Math.PI / 2;
    train.add(frontPlate);

    // Headlight - at the FRONT
    const headlightGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.05, 16);
    const headlightMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0.38, 0.22, 0);
    headlight.rotation.z = Math.PI / 2;
    train.add(headlight);

    // Headlight lens
    const lensGeo = new THREE.CircleGeometry(0.028, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0.405, 0.22, 0);
    lens.rotation.y = Math.PI / 2;
    train.add(lens);

    // Chimney/Smokestack
    const chimneyGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.18, 12);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.12, 0.38, 0);
    train.add(chimney);

    // Chimney cap
    const capGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.025, 12);
    const cap = new THREE.Mesh(capGeo, chimneyMat);
    cap.position.set(0.12, 0.48, 0);
    train.add(cap);

    // Smoke puffs
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.4 });
    [
      { y: 0.54, s: 0.04 },
      { y: 0.62, s: 0.06 },
      { y: 0.72, s: 0.08 },
      { y: 0.84, s: 0.1 },
    ].forEach(({ y, s }) => {
      const smokeGeo = new THREE.SphereGeometry(s, 8, 8);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.12 + (y - 0.54) * 0.15, y, (Math.random() - 0.5) * 0.08);
      train.add(smoke);
    });

    // Cow catcher at FRONT
    const catcherGroup = new THREE.Group();
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7 });
    
    // V-shape bars
    for (let i = 0; i < 5; i++) {
      const barGeo = new THREE.BoxGeometry(0.12, 0.015, 0.015);
      const bar = new THREE.Mesh(barGeo, catcherMat);
      bar.position.set(0.06, -0.02 + i * 0.025, (i - 2) * 0.04);
      bar.rotation.y = (i - 2) * 0.15;
      catcherGroup.add(bar);
    }
    
    // Base bar
    const baseBarGeo = new THREE.BoxGeometry(0.02, 0.12, 0.22);
    const baseBar = new THREE.Mesh(baseBarGeo, catcherMat);
    baseBar.position.set(0, 0.02, 0);
    catcherGroup.add(baseBar);

    catcherGroup.position.set(0.4, 0, 0);
    train.add(catcherGroup);

    // Steam dome
    const domeGeo = new THREE.SphereGeometry(0.045, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.6 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(-0.08, 0.26, 0);
    train.add(dome);

    // Cabin (engineer's cab) at BACK
    const cabinGeo = new THREE.BoxGeometry(0.22, 0.2, 0.3);
    const cabinMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.24, 0.22, 0);
    train.add(cabin);

    // Cabin windows
    const cabWinGeo = new THREE.PlaneGeometry(0.08, 0.08);
    const cabWinMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4, side: THREE.DoubleSide });
    [-0.151, 0.151].forEach(z => {
      const cabWin = new THREE.Mesh(cabWinGeo, cabWinMat);
      cabWin.position.set(-0.24, 0.26, z);
      train.add(cabWin);
    });

    // Cabin roof
    const cabRoofGeo = new THREE.BoxGeometry(0.25, 0.02, 0.34);
    const cabRoof = new THREE.Mesh(cabRoofGeo, roofMat);
    cabRoof.position.set(-0.24, 0.33, 0);
    train.add(cabRoof);
  }

  // Coupling hooks (connectors)
  const hookGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.2 });
  [-0.375, 0.375].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);

    // Hook ring
    const ringGeo = new THREE.TorusGeometry(0.018, 0.005, 6, 12);
    const ring = new THREE.Mesh(ringGeo, hookMat);
    ring.position.set(x > 0 ? x + 0.035 : x - 0.035, 0.02, 0);
    ring.rotation.y = Math.PI / 2;
    train.add(ring);
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
  labelSprite.position.y = 0.55;
  labelSprite.scale.set(0.42, 0.13, 1);
  train.add(labelSprite);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.78, 0.42, 0.38);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.14;
    train.add(glow);
  }

  return train;
}

// ==================== REALISTIC EXPRESSWAY TOLL BOOTH ====================

function createTollBooth(): THREE.Group {
  const toll = new THREE.Group();

  // Main booth structure
  const boothGeo = new THREE.BoxGeometry(0.5, 0.7, 0.4);
  const boothMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.6, metalness: 0.3 });
  const booth = new THREE.Mesh(boothGeo, boothMat);
  booth.position.y = 0.35;
  toll.add(booth);

  // Booth window (large glass)
  const windowGeo = new THREE.PlaneGeometry(0.35, 0.25);
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: '#87ceeb', 
    metalness: 0.6, 
    roughness: 0.1, 
    transparent: true, 
    opacity: 0.8,
    side: THREE.DoubleSide 
  });
  const boothWindow = new THREE.Mesh(windowGeo, windowMat);
  boothWindow.position.set(0.251, 0.45, 0);
  boothWindow.rotation.y = Math.PI / 2;
  toll.add(boothWindow);

  // Window frame
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.5 });
  const frameH = new THREE.BoxGeometry(0.02, 0.27, 0.38);
  const frameTop = new THREE.Mesh(frameH, frameMat);
  frameTop.position.set(0.252, 0.45, 0);
  toll.add(frameTop);

  // Booth roof (overhang)
  const roofGeo = new THREE.BoxGeometry(0.7, 0.05, 0.55);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.5 });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = 0.73;
  toll.add(roofMesh);

  // Roof edge trim
  const trimGeo = new THREE.BoxGeometry(0.72, 0.03, 0.57);
  const trimMat = new THREE.MeshStandardMaterial({ color: '#f39c12', metalness: 0.5 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.y = 0.76;
  toll.add(trim);

  // Support pillars (on both sides of road)
  const pillarGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.2, 12);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
  [-0.4, 0.4].forEach(z => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(-0.28, 0.6, z);
    toll.add(pillar);
  });

  // Overhead gantry
  const gantryGeo = new THREE.BoxGeometry(0.08, 0.08, 1.0);
  const gantry = new THREE.Mesh(gantryGeo, pillarMat);
  gantry.position.set(-0.28, 1.2, 0);
  toll.add(gantry);

  // TOLL sign on gantry
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 200;
  signCanvas.height = 80;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = '#006400';
  sctx.fillRect(0, 0, 200, 80);
  sctx.strokeStyle = '#fff';
  sctx.lineWidth = 4;
  sctx.strokeRect(4, 4, 192, 72);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 36px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('TOLL', 100, 52);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.2),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signMesh.position.set(-0.28, 1.0, 0);
  signMesh.rotation.y = Math.PI / 2;
  toll.add(signMesh);

  // Barrier arm (gate)
  const barrierPivot = new THREE.Group();
  
  const barrierArmGeo = new THREE.BoxGeometry(1.2, 0.06, 0.06);
  const barrierArmMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const barrierArm = new THREE.Mesh(barrierArmGeo, barrierArmMat);
  barrierArm.position.x = 0.6;
  barrierPivot.add(barrierArm);

  // Red and white stripes on barrier
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  for (let i = 0; i < 6; i++) {
    const stripeGeo = new THREE.BoxGeometry(0.08, 0.065, 0.065);
    const stripeBox = new THREE.Mesh(stripeGeo, stripeMat);
    stripeBox.position.set(0.2 + i * 0.16, 0, 0);
    barrierPivot.add(stripeBox);
  }

  // Reflective end cap
  const endCapGeo = new THREE.BoxGeometry(0.08, 0.1, 0.1);
  const endCapMat = new THREE.MeshStandardMaterial({ color: '#f39c12', metalness: 0.7 });
  const endCap = new THREE.Mesh(endCapGeo, endCapMat);
  endCap.position.x = 1.2;
  barrierPivot.add(endCap);

  barrierPivot.position.set(0.3, 0.5, 0);
  toll.add(barrierPivot);

  // Barrier motor housing
  const motorGeo = new THREE.BoxGeometry(0.15, 0.2, 0.15);
  const motorMat = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.5 });
  const motor = new THREE.Mesh(motorGeo, motorMat);
  motor.position.set(0.3, 0.45, 0);
  toll.add(motor);

  // Payment terminal
  const terminalGeo = new THREE.BoxGeometry(0.12, 0.25, 0.1);
  const terminalMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.4 });
  const terminal = new THREE.Mesh(terminalGeo, terminalMat);
  terminal.position.set(0.35, 0.35, -0.2);
  toll.add(terminal);

  // Terminal screen
  const screenGeo = new THREE.PlaneGeometry(0.08, 0.06);
  const screenMat = new THREE.MeshBasicMaterial({ color: '#00ff00' });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0.41, 0.42, -0.2);
  screen.rotation.y = Math.PI / 2;
  toll.add(screen);

  // Card slot
  const slotGeo = new THREE.BoxGeometry(0.005, 0.04, 0.06);
  const slotMat = new THREE.MeshBasicMaterial({ color: '#111' });
  const slot = new THREE.Mesh(slotGeo, slotMat);
  slot.position.set(0.415, 0.32, -0.2);
  toll.add(slot);

  // Lane lights (green = open)
  const lightGeo = new THREE.CircleGeometry(0.05, 16);
  const greenLightMat = new THREE.MeshBasicMaterial({ color: '#00ff00', side: THREE.DoubleSide });
  const greenLight = new THREE.Mesh(lightGeo, greenLightMat);
  greenLight.position.set(-0.28, 0.9, 0);
  greenLight.rotation.y = Math.PI / 2;
  toll.add(greenLight);

  // Lane number
  const laneCanvas = document.createElement('canvas');
  laneCanvas.width = 64;
  laneCanvas.height = 64;
  const lctx = laneCanvas.getContext('2d')!;
  lctx.fillStyle = '#1a1a1a';
  lctx.fillRect(0, 0, 64, 64);
  lctx.fillStyle = '#fff';
  lctx.font = 'bold 40px Arial';
  lctx.textAlign = 'center';
  lctx.fillText('1', 32, 48);
  const laneTex = new THREE.CanvasTexture(laneCanvas);
  const laneSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.15),
    new THREE.MeshBasicMaterial({ map: laneTex })
  );
  laneSign.position.set(-0.28, 1.35, 0);
  laneSign.rotation.y = Math.PI / 2;
  toll.add(laneSign);

  // Ground marking arrows
  const arrowCanvas = document.createElement('canvas');
  arrowCanvas.width = 64;
  arrowCanvas.height = 128;
  const actx = arrowCanvas.getContext('2d')!;
  actx.fillStyle = '#fff';
  actx.beginPath();
  actx.moveTo(32, 10);
  actx.lineTo(54, 50);
  actx.lineTo(42, 50);
  actx.lineTo(42, 118);
  actx.lineTo(22, 118);
  actx.lineTo(22, 50);
  actx.lineTo(10, 50);
  actx.closePath();
  actx.fill();
  const arrowTex = new THREE.CanvasTexture(arrowCanvas);
  const groundArrow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.3),
    new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true })
  );
  groundArrow.rotation.x = -Math.PI / 2;
  groundArrow.position.set(0.8, 0.01, 0);
  toll.add(groundArrow);

  return toll;
}

// ==================== REALISTIC CAR (Facing Toll - Left Direction) ====================

function createCar(color: string, label: string, isHighlighted: boolean, drivePhase: number = 0): THREE.Group {
  const car = new THREE.Group();

  // Car body - sedan style
  const bodyGeo = new THREE.BoxGeometry(0.55, 0.14, 0.26);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.3,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.1;
  car.add(body);

  // Body contour (side panels)
  const panelGeo = new THREE.BoxGeometry(0.53, 0.04, 0.27);
  const panelMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.y = 0.04;
  car.add(panel);

  // Hood (front - LEFT side since car faces left toward toll)
  const hoodGeo = new THREE.BoxGeometry(0.18, 0.04, 0.24);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(-0.18, 0.19, 0);
  hood.rotation.z = 0.12;
  car.add(hood);

  // Trunk (back - RIGHT side)
  const trunkGeo = new THREE.BoxGeometry(0.12, 0.035, 0.24);
  const trunk = new THREE.Mesh(trunkGeo, bodyMat);
  trunk.position.set(0.22, 0.185, 0);
  trunk.rotation.z = -0.08;
  car.add(trunk);

  // Cabin (greenhouse)
  const cabinGeo = new THREE.BoxGeometry(0.24, 0.12, 0.23);
  const cabinMat = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0.02, 0.23, 0);
  car.add(cabin);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.22, 0.018, 0.22);
  const roofMesh = new THREE.Mesh(roofGeo, bodyMat);
  roofMesh.position.set(0.02, 0.3, 0);
  car.add(roofMesh);

  // Windshield (front - faces LEFT)
  const windshieldGeo = new THREE.PlaneGeometry(0.21, 0.1);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#a8d8ea',
    metalness: 0.6,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(-0.1, 0.24, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.z = 0.22;
  car.add(windshield);

  // Rear window (faces RIGHT)
  const rearWindow = new THREE.Mesh(windshieldGeo, glassMat);
  rearWindow.position.set(0.14, 0.24, 0);
  rearWindow.rotation.y = Math.PI / 2;
  rearWindow.rotation.z = -0.22;
  car.add(rearWindow);

  // Side windows
  const sideWinGeo = new THREE.PlaneGeometry(0.1, 0.08);
  [-0.131, 0.131].forEach(z => {
    // Front side window
    const swF = new THREE.Mesh(sideWinGeo, glassMat);
    swF.position.set(-0.02, 0.24, z);
    car.add(swF);
    
    // Rear side window
    const swR = new THREE.Mesh(sideWinGeo, glassMat);
    swR.position.set(0.08, 0.24, z);
    car.add(swR);
  });

  // B-pillar (between windows)
  const pillarGeo = new THREE.BoxGeometry(0.015, 0.12, 0.012);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  [-0.131, 0.131].forEach(z => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(0.03, 0.23, z);
    car.add(pillar);
  });

  // Wheels with rotation animation
  const wheelRotation = drivePhase * 3;
  const tireGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.025, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.028, 16);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });

  const wheelPos: [number, number, number][] = [
    [-0.16, 0.045, 0.135], [0.16, 0.045, 0.135],
    [-0.16, 0.045, -0.135], [0.16, 0.045, -0.135],
  ];

  wheelPos.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();
    
    // Tire
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.x = Math.PI / 2;
    wheelGroup.add(tire);

    // Rim
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    wheelGroup.add(rim);

    // Spokes
    const spokeGeo = new THREE.BoxGeometry(0.003, 0.04, 0.003);
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.position.z = wz > 0 ? 0.014 : -0.014;
      spoke.rotation.z = (i / 5) * Math.PI * 2 + wheelRotation;
      wheelGroup.add(spoke);
    }

    wheelGroup.position.set(wx, wy, wz);
    
    // Wheel spin animation
    if (drivePhase > 0) {
      wheelGroup.rotation.z = wheelRotation;
    }
    
    car.add(wheelGroup);
  });

  // Headlights (FRONT - LEFT side)
  const headlightGeo = new THREE.BoxGeometry(0.015, 0.035, 0.055);
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  const headlightHousing = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.6 });
  [-0.09, 0.09].forEach(z => {
    // Light
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(-0.275, 0.1, z);
    car.add(hl);
    
    // Housing
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.045, 0.065),
      headlightHousing
    );
    housing.position.set(-0.278, 0.1, z);
    car.add(housing);
  });

  // Tail lights (BACK - RIGHT side)
  const tailGeo = new THREE.BoxGeometry(0.015, 0.03, 0.045);
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.085, 0.085].forEach(z => {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(0.275, 0.1, z);
    car.add(tl);
  });

  // Front grille (faces LEFT)
  const grilleGeo = new THREE.BoxGeometry(0.01, 0.05, 0.12);
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8 });
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.position.set(-0.28, 0.08, 0);
  car.add(grille);

  // Chrome grille bars
  const barMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9 });
  for (let i = -2; i <= 2; i++) {
    const barGeo = new THREE.BoxGeometry(0.012, 0.008, 0.11);
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(-0.282, 0.06 + i * 0.012, 0);
    car.add(bar);
  }

  // Side mirrors
  const mirrorMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  [-0.135, 0.135].forEach(z => {
    const mirrorGeo = new THREE.BoxGeometry(0.025, 0.018, 0.03);
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(-0.06, 0.2, z);
    car.add(mirror);

    // Mirror glass
    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.015, 0.012),
      glassMat
    );
    mirrorGlass.position.set(-0.06, 0.2, z > 0 ? z + 0.016 : z - 0.016);
    car.add(mirrorGlass);
  });

  // License plate (FRONT - faces LEFT toward toll)
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
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.045),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  plateMesh.position.set(-0.281, 0.04, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  // Exhaust pipe
  const exhaustGeo = new THREE.CylinderGeometry(0.01, 0.012, 0.05, 10);
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#444', metalness: 0.8, roughness: 0.3 });
  const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust.position.set(0.26, 0.02, 0.08);
  exhaust.rotation.z = Math.PI / 2;
  car.add(exhaust);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.6, 0.32, 0.32);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.15;
    car.add(glow);
  }

  return car;
}

// ==================== REALISTIC FRIED CHICKEN & RICE PLATE ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  // Main plate
  const plateGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.025, 36);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#f5f5f0',
    roughness: 0.25,
    metalness: 0.1,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  plate.add(new THREE.Mesh(plateGeo, plateMat));

  // Plate rim
  const rimGeo = new THREE.TorusGeometry(0.27, 0.015, 12, 36);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e8e8e0', roughness: 0.3, metalness: 0.15 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  plate.add(rim);

  // Decorative blue band
  const bandGeo = new THREE.TorusGeometry(0.22, 0.006, 8, 32);
  const bandMat = new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.014;
  plate.add(band);

  // ===== RICE (mound on one side) =====
  const riceGeo = new THREE.SphereGeometry(0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const riceMat = new THREE.MeshStandardMaterial({ color: '#fffef0', roughness: 0.9 });
  const rice = new THREE.Mesh(riceGeo, riceMat);
  rice.position.set(-0.08, 0.015, 0.02);
  rice.scale.set(1.2, 0.6, 1);
  plate.add(rice);

  // Rice grains texture (small bumps)
  for (let i = 0; i < 25; i++) {
    const grainGeo = new THREE.SphereGeometry(0.008, 6, 6);
    const grain = new THREE.Mesh(grainGeo, riceMat);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.06;
    grain.position.set(
      -0.08 + Math.cos(angle) * radius,
      0.04 + Math.random() * 0.015,
      0.02 + Math.sin(angle) * radius
    );
    grain.scale.set(1, 0.4, 0.5);
    grain.rotation.y = Math.random() * Math.PI;
    plate.add(grain);
  }

  // ===== FRIED CHICKEN PIECES =====
  const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.65 });
  const crispyMat = new THREE.MeshStandardMaterial({ color: '#c9883a', roughness: 0.8 });

  // Main chicken piece (drumstick)
  const drumstickGeo = new THREE.CapsuleGeometry(0.035, 0.08, 8, 16);
  const drumstick = new THREE.Mesh(drumstickGeo, chickenMat);
  drumstick.position.set(0.06, 0.05, -0.02);
  drumstick.rotation.z = 0.4;
  drumstick.rotation.x = 0.2;
  plate.add(drumstick);

  // Drumstick bone tip
  const boneGeo = new THREE.CylinderGeometry(0.006, 0.004, 0.03, 8);
  const boneMat = new THREE.MeshStandardMaterial({ color: '#f5ebe0' });
  const bone = new THREE.Mesh(boneGeo, boneMat);
  bone.position.set(0.02, 0.08, -0.04);
  bone.rotation.z = 0.4;
  plate.add(bone);

  // Chicken thigh piece
  const thighGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const thigh = new THREE.Mesh(thighGeo, chickenMat);
  thigh.position.set(0.08, 0.04, 0.04);
  thigh.scale.set(1.2, 0.7, 1);
  plate.add(thigh);

  // Crispy coating details
  for (let i = 0; i < 8; i++) {
    const crispGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const crisp = new THREE.Mesh(crispGeo, crispyMat);
    crisp.position.set(
      0.06 + (Math.random() - 0.5) * 0.06,
      0.04 + Math.random() * 0.02,
      (Math.random() - 0.5) * 0.06
    );
    crisp.scale.set(1, 0.5, 1);
    plate.add(crisp);
  }

  // Wing piece
  const wingGeo = new THREE.CapsuleGeometry(0.02, 0.04, 6, 12);
  const wing = new THREE.Mesh(wingGeo, chickenMat);
  wing.position.set(0.12, 0.035, -0.04);
  wing.rotation.z = -0.3;
  plate.add(wing);

  // ===== VEGETABLES (small garnish) =====
  // Cucumber slices
  const cucumberMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.5 });
  const cucumberInnerMat = new THREE.MeshStandardMaterial({ color: '#a8e6cf', roughness: 0.4 });
  
  for (let i = 0; i < 3; i++) {
    const cucumberGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 12);
    const cucumber = new THREE.Mesh(cucumberGeo, cucumberMat);
    cucumber.position.set(-0.15 + i * 0.025, 0.018, -0.08);
    plate.add(cucumber);

    const innerGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.009, 12);
    const inner = new THREE.Mesh(innerGeo, cucumberInnerMat);
    inner.position.set(-0.15 + i * 0.025, 0.019, -0.08);
    plate.add(inner);
  }

  // Tomato slice
  const tomatoGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 12);
  const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
  tomato.position.set(-0.12, 0.018, 0.1);
  plate.add(tomato);

  // Lettuce leaf
  const lettuceMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.7, side: THREE.DoubleSide });
  const lettuceGeo = new THREE.PlaneGeometry(0.06, 0.04);
  const lettuce = new THREE.Mesh(lettuceGeo, lettuceMat);
  lettuce.position.set(0.14, 0.02, 0.08);
  lettuce.rotation.x = -0.3;
  lettuce.rotation.z = 0.2;
  plate.add(lettuce);

  // ===== SAUCE =====
  const sauceGeo = new THREE.SphereGeometry(0.025, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const sauceMat = new THREE.MeshStandardMaterial({ color: '#8b0000', roughness: 0.4 });
  const sauce = new THREE.Mesh(sauceGeo, sauceMat);
  sauce.position.set(0.16, 0.015, -0.06);
  sauce.scale.set(1.2, 0.4, 1);
  plate.add(sauce);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== REALISTIC CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean): THREE.Group {
  const box = new THREE.Group();

  const boxW = 0.48;
  const boxH = 0.34;
  const boxD = 0.38;

  // Main body with cardboard texture
  const bodyGeo = new THREE.BoxGeometry(boxW, boxH, boxD);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  box.add(body);

  // Corrugation lines (texture effect)
  const lineMat = new THREE.MeshBasicMaterial({ color: '#a0734a', transparent: true, opacity: 0.3 });
  for (let y = -boxH / 2 + 0.03; y < boxH / 2; y += 0.025) {
    const lineGeo = new THREE.BoxGeometry(boxW + 0.001, 0.002, boxD + 0.001);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.y = y;
    box.add(line);
  }

  // Corner edges (darker creases)
  const creaseMat = new THREE.MeshStandardMaterial({ color: '#7a5530', roughness: 0.9 });
  const vCreaseGeo = new THREE.BoxGeometry(0.015, boxH, 0.015);
  [
    [-boxW / 2, 0, boxD / 2], [boxW / 2, 0, boxD / 2],
    [-boxW / 2, 0, -boxD / 2], [boxW / 2, 0, -boxD / 2]
  ].forEach(([x, y, z]) => {
    const crease = new THREE.Mesh(vCreaseGeo, creaseMat);
    crease.position.set(x, y, z);
    box.add(crease);
  });

  // ===== FLAPS =====
  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const flapAngle = isOpen ? -1.3 : 0;

  // Front and back flaps
  const fbFlapGeo = new THREE.BoxGeometry(boxW, 0.12, 0.012);
  
  const frontFlap = new THREE.Mesh(fbFlapGeo, flapMat);
  frontFlap.position.set(0, boxH / 2 + (isOpen ? 0.04 : 0), boxD / 2);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);

  const backFlap = new THREE.Mesh(fbFlapGeo, flapMat);
  backFlap.position.set(0, boxH / 2 + (isOpen ? 0.04 : 0), -boxD / 2);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  // Side flaps
  const sideFlapGeo = new THREE.BoxGeometry(0.012, 0.12, boxD);
  
  const leftFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  leftFlap.position.set(-boxW / 2, boxH / 2 + (isOpen ? 0.03 : 0), 0);
  leftFlap.rotation.z = isOpen ? 0.9 : 0;
  box.add(leftFlap);

  const rightFlap = new THREE.Mesh(sideFlapGeo, flapMat);
  rightFlap.position.set(boxW / 2, boxH / 2 + (isOpen ? 0.03 : 0), 0);
  rightFlap.rotation.z = isOpen ? -0.9 : 0;
  box.add(rightFlap);

  // Inside visible when open
  if (isOpen) {
    const insideGeo = new THREE.PlaneGeometry(boxW - 0.02, boxD - 0.02);
    const insideMat = new THREE.MeshStandardMaterial({ color: '#a0734a', side: THREE.DoubleSide, roughness: 0.9 });
    const insideBottom = new THREE.Mesh(insideGeo, insideMat);
    insideBottom.rotation.x = -Math.PI / 2;
    insideBottom.position.y = -boxH / 2 + 0.01;
    box.add(insideBottom);

    // Items inside
    const item1Geo = new THREE.BoxGeometry(0.1, 0.08, 0.08);
    const item1Mat = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.6 });
    const item1 = new THREE.Mesh(item1Geo, item1Mat);
    item1.position.set(-0.08, -0.08, 0);
    item1.rotation.y = 0.15;
    box.add(item1);

    const item2Geo = new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12);
    const item2Mat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    const item2 = new THREE.Mesh(item2Geo, item2Mat);
    item2.position.set(0.06, -0.06, 0.04);
    box.add(item2);

    const item3Geo = new THREE.SphereGeometry(0.04, 12, 12);
    const item3Mat = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.6 });
    const item3 = new THREE.Mesh(item3Geo, item3Mat);
    item3.position.set(0.02, -0.1, -0.06);
    box.add(item3);
  }

  // Packing tape (when closed)
  if (!isOpen) {
    const tapeGeo = new THREE.BoxGeometry(0.1, 0.008, boxD + 0.01);
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574', transparent: true, opacity: 0.7, roughness: 0.3 });
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = boxH / 2 + 0.004;
    box.add(tape);

    // Cross tape
    const tape2 = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.01, 0.008, 0.08),
      tapeMat
    );
    tape2.position.y = boxH / 2 + 0.004;
    box.add(tape2);
  }

  // Front label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 120;
  const lctx = labelCanvas.getContext('2d')!;

  // White label background
  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, 180, 120);
  lctx.strokeStyle = '#333';
  lctx.lineWidth = 3;
  lctx.strokeRect(3, 3, 174, 114);

  // FRAGILE banner
  lctx.fillStyle = '#e74c3c';
  lctx.fillRect(6, 6, 168, 28);
  lctx.fillStyle = '#fff';
  lctx.font = 'bold 16px Arial';
  lctx.textAlign = 'center';
  lctx.fillText('⚠ FRAGILE ⚠', 90, 26);

  // Box name
  lctx.fillStyle = '#2c3e50';
  lctx.font = 'bold 28px Arial';
  lctx.fillText(label, 90, 68);

  // Handle with care
  lctx.fillStyle = '#666';
  lctx.font = '11px Arial';
  lctx.fillText('HANDLE WITH CARE', 90, 88);

  // Up arrows
  lctx.fillStyle = '#333';
  lctx.font = '14px Arial';
  lctx.fillText('↑ THIS SIDE UP ↑', 90, 108);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.22),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0, boxD / 2 + 0.001);
  box.add(labelMesh);

  // Side handles
  [-boxW / 2 - 0.001, boxW / 2 + 0.001].forEach((x, i) => {
    // Handle cutout
    const handleGeo = new THREE.TorusGeometry(0.04, 0.01, 6, 12, Math.PI);
    const handleMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.8 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(x, 0.05, 0);
    handle.rotation.y = i === 0 ? -Math.PI / 2 : Math.PI / 2;
    handle.rotation.z = Math.PI;
    box.add(handle);
  });

  // Weight/shipping info on side
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 80;
  sideCanvas.height = 60;
  const sctx = sideCanvas.getContext('2d')!;
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, 80, 60);
  sctx.strokeStyle = '#999';
  sctx.strokeRect(1, 1, 78, 58);
  sctx.fillStyle = '#333';
  sctx.font = '10px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('WT: 5.2 kg', 40, 25);
  sctx.fillText('VOL: 0.06m³', 40, 42);
  const sideTex = new THREE.CanvasTexture(sideCanvas);
  const sideMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.1),
    new THREE.MeshBasicMaterial({ map: sideTex })
  );
  sideMesh.position.set(boxW / 2 + 0.001, -0.05, 0);
  sideMesh.rotation.y = Math.PI / 2;
  box.add(sideMesh);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxW + 0.06, boxH + 0.06, boxD + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return box;
}

// ==================== IMPROVED DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  // Main tile (white with black dots - classic domino)
  const tileGeo = new THREE.BoxGeometry(0.22, 0.44, 0.06);
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#fafafa',
    roughness: 0.35,
    metalness: 0.05,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  domino.add(new THREE.Mesh(tileGeo, tileMat));

  // Black border
  const borderGeo = new THREE.BoxGeometry(0.23, 0.45, 0.055);
  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.005;
  domino.add(border);

  // Center dividing line
  const lineGeo = new THREE.BoxGeometry(0.18, 0.015, 0.008);
  const lineMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3 });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.z = 0.028;
  domino.add(line);

  // Dots
  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16);
  const dotMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#fff' : '#1a1a1a',
    roughness: 0.3,
    metalness: 0.1,
  });

  // Dot positions for standard domino patterns
  const dotPatterns: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.05, 0.05], [0.05, -0.05]],
    3: [[-0.05, 0.05], [0, 0], [0.05, -0.05]],
    4: [[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]],
    5: [[-0.05, 0.05], [0.05, 0.05], [0, 0], [-0.05, -0.05], [0.05, -0.05]],
    6: [[-0.05, 0.05], [0.05, 0.05], [-0.05, 0], [0.05, 0], [-0.05, -0.05], [0.05, -0.05]],
  };

  const topVal = Math.min(val, 6);
  const bottomVal = Math.min((val + 2) % 6 + 1, 6);

  // Top half dots
  const topDots = dotPatterns[topVal] || dotPatterns[1];
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y * 0.8 + 0.12, 0.028);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);

    // Dot inset (shadow)
    const insetGeo = new THREE.CircleGeometry(0.02, 12);
    const insetMat = new THREE.MeshBasicMaterial({ color: '#e0e0e0', side: THREE.DoubleSide });
    const inset = new THREE.Mesh(insetGeo, insetMat);
    inset.position.set(x, y * 0.8 + 0.12, 0.031);
    domino.add(inset);
  });

  // Bottom half dots
  const bottomDots = dotPatterns[bottomVal] || dotPatterns[1];
  bottomDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y * 0.8 - 0.12, 0.028);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);

    const insetGeo = new THREE.CircleGeometry(0.02, 12);
    const insetMat = new THREE.MeshBasicMaterial({ color: '#e0e0e0', side: THREE.DoubleSide });
    const inset = new THREE.Mesh(insetGeo, insetMat);
    inset.position.set(x, y * 0.8 - 0.12, 0.031);
    domino.add(inset);
  });

  // Value label (small, on side)
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 32;
  numCanvas.height = 32;
  const nctx = numCanvas.getContext('2d')!;
  nctx.fillStyle = isHighlighted ? '#fff' : '#555';
  nctx.font = 'bold 20px Arial';
  nctx.textAlign = 'center';
  nctx.fillText(value, 16, 24);
  const numTex = new THREE.CanvasTexture(numCanvas);
  const numSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex, transparent: true }));
  numSprite.position.set(0.13, 0, 0);
  numSprite.scale.set(0.06, 0.06, 1);
  domino.add(numSprite);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.26, 0.48, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== IMPROVED CLIPBOARD (To-Do) ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  // Wooden board
  const boardGeo = new THREE.BoxGeometry(0.38, 0.5, 0.02);
  const boardMat = new THREE.MeshStandardMaterial({
    color: '#6d4c2a',
    roughness: 0.65,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  clipboard.add(new THREE.Mesh(boardGeo, boardMat));

  // Board edge
  const edgeGeo = new THREE.BoxGeometry(0.39, 0.51, 0.012);
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.8 });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.z = -0.01;
  clipboard.add(edge);

  // Metal clip
  const clipBaseGeo = new THREE.BoxGeometry(0.12, 0.04, 0.025);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9, roughness: 0.2 });
  const clipBase = new THREE.Mesh(clipBaseGeo, clipMat);
  clipBase.position.set(0, 0.27, 0.015);
  clipboard.add(clipBase);

  const clipLeverGeo = new THREE.BoxGeometry(0.08, 0.015, 0.03);
  const clipLever = new THREE.Mesh(clipLeverGeo, clipMat);
  clipLever.position.set(0, 0.29, 0.03);
  clipLever.rotation.x = -0.3;
  clipboard.add(clipLever);

  // Paper
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 190;
  paperCanvas.height = 280;
  const pctx = paperCanvas.getContext('2d')!;

  // Paper background
  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 190, 280);

  // Color header
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 190, 36);

  // Title
  pctx.fillStyle = '#fff';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 95, 26);

  // Tasks
  const tasks = [
    { text: 'Review notes', done: true },
    { text: 'Complete homework', done: true },
    { text: 'Practice coding', done: isHighlighted },
    { text: 'Read chapter 5', done: false },
    { text: 'Submit project', done: false },
    { text: 'Study for exam', done: false },
  ];

  tasks.forEach((task, i) => {
    const y = 55 + i * 32;

    // Ruled line
    pctx.strokeStyle = '#d4d0c8';
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(10, y + 18);
    pctx.lineTo(180, y + 18);
    pctx.stroke();

    // Checkbox
    pctx.strokeStyle = '#666';
    pctx.lineWidth = 2;
    pctx.strokeRect(12, y, 16, 16);

    if (task.done) {
      // Checkmark
      pctx.strokeStyle = '#27ae60';
      pctx.lineWidth = 3;
      pctx.beginPath();
      pctx.moveTo(14, y + 8);
      pctx.lineTo(19, y + 13);
      pctx.lineTo(27, y + 4);
      pctx.stroke();

      // Strikethrough text
      pctx.fillStyle = '#999';
      pctx.font = '13px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 35, y + 13);
      pctx.strokeStyle = '#999';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(35, y + 9);
      pctx.lineTo(35 + pctx.measureText(task.text).width, y + 9);
      pctx.stroke();
    } else {
      pctx.fillStyle = '#2c3e50';
      pctx.font = '13px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 35, y + 13);
    }
  });

  // Red margin line
  pctx.strokeStyle = '#e74c3c';
  pctx.lineWidth = 1.5;
  pctx.beginPath();
  pctx.moveTo(8, 38);
  pctx.lineTo(8, 270);
  pctx.stroke();

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.46),
    new THREE.MeshBasicMaterial({ map: paperTex })
  );
  paper.position.z = 0.012;
  clipboard.add(paper);

  // Pencil
  const pencilGroup = new THREE.Group();
  const pencilBodyGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6);
  const pencilMat = new THREE.MeshStandardMaterial({ color: '#f4d03f' });
  const pencilBody = new THREE.Mesh(pencilBodyGeo, pencilMat);
  pencilGroup.add(pencilBody);

  const pencilTipGeo = new THREE.ConeGeometry(0.006, 0.018, 6);
  const pencilTipMat = new THREE.MeshStandardMaterial({ color: '#f5deb3' });
  const pencilTip = new THREE.Mesh(pencilTipGeo, pencilTipMat);
  pencilTip.position.y = -0.09;
  pencilGroup.add(pencilTip);

  const eraserGeo = new THREE.CylinderGeometry(0.007, 0.006, 0.014, 6);
  const eraserMat = new THREE.MeshStandardMaterial({ color: '#e88b8b' });
  const eraser = new THREE.Mesh(eraserGeo, eraserMat);
  eraser.position.y = 0.088;
  pencilGroup.add(eraser);

  pencilGroup.position.set(0.11, -0.06, 0.02);
  pencilGroup.rotation.z = 0.75;
  clipboard.add(pencilGroup);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.42, 0.54, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    clipboard.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return clipboard;
}

// ==================== IMPROVED TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  // Main ticket body
  const ticketGeo = new THREE.BoxGeometry(0.4, 0.22, 0.012);
  const ticketMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  ticket.add(new THREE.Mesh(ticketGeo, ticketMat));

  // Tear-off stub
  const stubGeo = new THREE.BoxGeometry(0.09, 0.22, 0.012);
  const stubMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const stub = new THREE.Mesh(stubGeo, stubMat);
  stub.position.x = 0.245;
  ticket.add(stub);

  // Perforation
  const dotGeo = new THREE.CircleGeometry(0.004, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let y = -0.09; y <= 0.09; y += 0.012) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0.195, y, 0.007);
    ticket.add(dot);
  }

  // Front design
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 200;
  frontCanvas.height = 110;
  const fctx = frontCanvas.getContext('2d')!;

  // Background pattern
  fctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = -110; i < 310; i += 15) {
    fctx.beginPath();
    fctx.moveTo(i, 0);
    fctx.lineTo(i + 55, 110);
    fctx.lineTo(i + 60, 110);
    fctx.lineTo(i + 5, 0);
    fctx.closePath();
    fctx.fill();
  }

  // Top banner
  fctx.fillStyle = 'rgba(0,0,0,0.35)';
  fctx.fillRect(0, 0, 200, 24);
  fctx.fillStyle = '#fff';
  fctx.font = 'bold 12px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('★ ADMIT ONE ★', 85, 17);

  // Ticket number
  fctx.font = 'bold 32px Arial';
  fctx.fillText(label, 85, 62);

  // Decorative line
  fctx.strokeStyle = 'rgba(255,255,255,0.6)';
  fctx.lineWidth = 1.5;
  fctx.beginPath();
  fctx.moveTo(20, 74);
  fctx.lineTo(150, 74);
  fctx.stroke();

  // VIP
  fctx.font = 'bold 11px Arial';
  fctx.fillText('⭐ VIP ACCESS ⭐', 85, 90);

  // Date
  fctx.font = '8px Arial';
  fctx.fillStyle = 'rgba(255,255,255,0.7)';
  fctx.fillText('VALID TODAY ONLY', 85, 104);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.2),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontFace.position.z = 0.007;
  ticket.add(frontFace);

  // Gold borders
  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6, roughness: 0.3 });
  const hBorderGeo = new THREE.BoxGeometry(0.41, 0.006, 0.015);
  [0.11, -0.11].forEach(y => {
    const border = new THREE.Mesh(hBorderGeo, borderMat);
    border.position.y = y;
    ticket.add(border);
  });

  const vBorderGeo = new THREE.BoxGeometry(0.006, 0.22, 0.015);
  [-0.2, 0.29].forEach(x => {
    const border = new THREE.Mesh(vBorderGeo, borderMat);
    border.position.x = x;
    ticket.add(border);
  });

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.44, 0.26, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    ticket.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return ticket;
}

// ==================== IMPROVED BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  // Cover
  const coverGeo = new THREE.BoxGeometry(0.55, 0.07, 0.38);
  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  book.add(new THREE.Mesh(coverGeo, coverMat));

  // Cover edges
  const edgeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 });
  const topEdgeGeo = new THREE.BoxGeometry(0.55, 0.004, 0.38);
  const topEdge = new THREE.Mesh(topEdgeGeo, edgeMat);
  topEdge.position.y = 0.037;
  book.add(topEdge);
  const bottomEdge = new THREE.Mesh(topEdgeGeo, edgeMat);
  bottomEdge.position.y = -0.037;
  book.add(bottomEdge);

  // Pages
  const pagesGeo = new THREE.BoxGeometry(0.52, 0.055, 0.36);
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  pages.position.x = 0.012;
  book.add(pages);

  // Page lines on side
  const lineMat = new THREE.MeshBasicMaterial({ color: '#e8e0d0' });
  for (let y = -0.022; y <= 0.022; y += 0.003) {
    const lineGeo = new THREE.PlaneGeometry(0.055, 0.001);
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(0.27, y, 0);
    line.rotation.y = Math.PI / 2;
    book.add(line);
  }

  // Spine
  const spineGeo = new THREE.BoxGeometry(0.025, 0.075, 0.38);
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.7),
    roughness: 0.4,
  });
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -0.288;
  book.add(spine);

  // Spine ridges
  const ridgeGeo = new THREE.BoxGeometry(0.004, 0.078, 0.012);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  [-0.14, -0.05, 0.05, 0.14].forEach(z => {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(-0.3, 0, z);
    book.add(ridge);
  });

  // Cover title
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 180;
  coverCanvas.height = 140;
  const cctx = coverCanvas.getContext('2d')!;

  // Gold border
  cctx.strokeStyle = '#ffd700';
  cctx.lineWidth = 4;
  cctx.strokeRect(8, 8, 164, 124);
  cctx.lineWidth = 1;
  cctx.strokeRect(14, 14, 152, 112);

  // Title
  cctx.fillStyle = '#ffd700';
  cctx.font = 'bold 24px serif';
  cctx.textAlign = 'center';
  cctx.fillText(label, 90, 75);

  // Subtitle
  cctx.font = '12px serif';
  cctx.fillText('TEXTBOOK', 90, 98);

  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.28),
    new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
  );
  coverLabel.position.y = 0.037;
  coverLabel.rotation.x = -Math.PI / 2;
  book.add(coverLabel);

  // Bookmark
  const ribbonGeo = new THREE.PlaneGeometry(0.012, 0.1);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide, roughness: 0.6 });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0.08, 0, 0.19);
  ribbon.rotation.x = 0.1;
  book.add(ribbon);

  // Highlight
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.6, 0.09, 0.42);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    book.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return book;
}

// ==================== END OF PART 2 ====================
// ==================== PART 3: Animations, buildSceneContent, Home, Visualization3D ====================
// Place right after Part 2

// ==================== SMOOTH ANIMATION HELPER ====================

function applyItemAnimation(
  obj: THREE.Object3D,
  itemIndex: number,
  animPhase: string,
  animData: Record<string, any>,
  structure: DataStructure,
  animProgress: number = 1 // 0 to 1 for smooth interpolation
): void {
  if (!animPhase) return;

  const isTarget = animData.index === itemIndex;
  const isTarget1 = animData.index1 === itemIndex;
  const isTarget2 = animData.index2 === itemIndex;
  const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
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
    } else if (animPhase === 'insert-shift' && animData.insertIndex !== undefined && itemIndex >= animData.insertIndex) {
      obj.position.y += 0.06 * p;
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
      obj.position.y += 0.25 * p;
      obj.rotation.z = 0.1 * p;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.3;
      obj.scale.setScalar(1 + 0.15 * p);
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
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 1.0 * p;
      obj.scale.setScalar(1 - 0.3 * p);
      obj.rotation.y = 0.3 * p;
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.5;
      obj.scale.setScalar(0.01);
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
  animProgress?: number
): void {
  // Clear existing
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

  // ========================================================
  // ==================== ARRAY =============================
  // ========================================================
  if (structure === 'array') {

    // ---------- GROCERY (Cereal Shelf) ----------
    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.8;

      // Cereals on shelf
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const cerealLabels = ['Coco Crunch', 'Corn Flakes', 'Froot Loops', 'Cheerios', 'Frosted'];
        const product = createCerealBox(item.color, cerealLabels[i % cerealLabels.length] || item.label, isHl);
        product.position.set(startX + i * spacing, 0.08, 0);
        if (isHl) product.position.y += 0.08;
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(product);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.12, 0);
        idx.scale.set(0.28, 0.14, 1);
        group.add(idx);
      });

      // Metal shelf
      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.025, 0.32), shelfMat);
      mainShelf.position.y = 0.06;
      group.add(mainShelf);

      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.035, 0.012), shelfMat);
      lip.position.set(0, 0.075, 0.16);
      group.add(lip);

      // Shelf poles
      const poleMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8 });
      const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.8, 12);
      [-shelfWidth / 2 + 0.05, shelfWidth / 2 - 0.05].forEach(x => {
        [0.14, -0.12].forEach(z => {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(x, -0.05, z);
          group.add(pole);
        });
      });

      // Price strip
      const stripCanvas = document.createElement('canvas');
      stripCanvas.width = 512; stripCanvas.height = 32;
      const sctx = stripCanvas.getContext('2d')!;
      sctx.fillStyle = '#e74c3c';
      sctx.fillRect(0, 0, 512, 32);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 16px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('★ BREAKFAST CEREALS ★ SPECIAL OFFERS ★ BREAKFAST CEREALS ★', 256, 22);
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.055),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(stripCanvas) })
      );
      strip.position.set(0, 0.048, 0.165);
      group.add(strip);

      // Back panel
      const backPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth, 0.75),
        new THREE.MeshStandardMaterial({ color: '#f0f0f0', side: THREE.DoubleSide, roughness: 0.9 })
      );
      backPanel.position.set(0, 0, -0.14);
      group.add(backPanel);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 0.4, 0.7),
        new THREE.MeshStandardMaterial({ color: '#ddd', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.45;
      group.add(floor);

    // ---------- CLASSROOM (Seated Students) ----------
    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          // Create seated human
          const human = createHuman3D(item.appearance, item.label, isHl, true, 0);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.75);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array', animProgress);
          group.add(human);

          // Chair (positioned so human sits on it)
          const chair = createChair(startX + i * spacing);
          chair.position.y = 0.05;
          chair.scale.setScalar(0.75);
          group.add(chair);

          // Desk in front
          const deskGeo = new THREE.BoxGeometry(0.35, 0.025, 0.22);
          const deskMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
          const desk = new THREE.Mesh(deskGeo, deskMat);
          desk.position.set(startX + i * spacing, 0.02, 0.22);
          desk.scale.setScalar(0.75);
          group.add(desk);

          // Desk legs
          const dlegGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6);
          const dlegMat = new THREE.MeshStandardMaterial({ color: '#555' });
          [[-0.14, 0.1], [0.14, 0.1], [-0.14, -0.08], [0.14, -0.08]].forEach(([dx, dz]) => {
            const dleg = new THREE.Mesh(dlegGeo, dlegMat);
            dleg.position.set((startX + i * spacing + dx) * 0.75, -0.12, (0.22 + dz) * 0.75);
            group.add(dleg);
          });

          // Book/notebook on desk
          const bookGeo = new THREE.BoxGeometry(0.12, 0.015, 0.08);
          const bookMat = new THREE.MeshStandardMaterial({ color: '#3498db' });
          const bookOnDesk = new THREE.Mesh(bookGeo, bookMat);
          bookOnDesk.position.set((startX + i * spacing) * 0.75, 0.04, 0.18);
          group.add(bookOnDesk);
        }

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 20);
        idx.position.set(startX + i * spacing, -0.35, 0);
        idx.scale.set(0.22, 0.11, 1);
        group.add(idx);
      });

      // Floor (wood pattern)
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.4),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.28;
      group.add(floor);

      // Back wall
      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 0.9), wallMat);
      backWall.position.set(0, 0.12, -0.45);
      group.add(backWall);

      // Whiteboard
      const boardGeo = new THREE.BoxGeometry(roomWidth * 0.6, 0.4, 0.02);
      const boardMat2 = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const board = new THREE.Mesh(boardGeo, boardMat2);
      board.position.set(0, 0.22, -0.43);
      group.add(board);

      // Board frame
      const frameMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.5 });
      const hFrame = new THREE.BoxGeometry(roomWidth * 0.62, 0.02, 0.025);
      [0.43, 0.01].forEach(y => {
        const frame = new THREE.Mesh(hFrame, frameMat);
        frame.position.set(0, y, -0.42);
        group.add(frame);
      });

      // Board text
      const boardCanvas = document.createElement('canvas');
      boardCanvas.width = 256; boardCanvas.height = 128;
      const bctx = boardCanvas.getContext('2d')!;
      bctx.fillStyle = '#2c3e50';
      bctx.font = 'bold 22px Arial';
      bctx.textAlign = 'center';
      bctx.fillText('Data Structures', 128, 38);
      bctx.font = '15px Arial';
      bctx.fillText('Array: O(1) Access', 128, 68);
      bctx.fillText('Index: 0, 1, 2, ...', 128, 92);
      const boardTex = new THREE.CanvasTexture(boardCanvas);
      const boardText = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth * 0.5, 0.32),
        new THREE.MeshBasicMaterial({ map: boardTex, transparent: true })
      );
      boardText.position.set(0, 0.22, -0.418);
      group.add(boardText);

      // Ceiling
      const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.4),
        new THREE.MeshStandardMaterial({ color: '#f5f5f0', side: THREE.DoubleSide })
      );
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = 0.55;
      group.add(ceiling);

      // Ceiling lights
      for (let lx = -roomWidth / 3; lx <= roomWidth / 3; lx += roomWidth / 3) {
        const lightFixture = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.012, 0.07),
          new THREE.MeshBasicMaterial({ color: '#ffffee' })
        );
        lightFixture.position.set(lx, 0.54, 0);
        group.add(lightFixture);
      }

    // ---------- TODO LIST ----------
    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        clipboard.scale.setScalar(0.68);
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array', animProgress);
        group.add(clipboard);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 20);
        idx.position.set(startX + i * spacing, -0.42, 0);
        idx.scale.set(0.22, 0.11, 1);
        group.add(idx);
      });

      // Wooden desk
      const deskWidth = data.length * spacing + 0.5;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(deskWidth, 0.04, 0.45),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.28;
      group.add(desk);

      // Desk edge
      const edgeGeo = new THREE.CylinderGeometry(0.02, 0.02, deskWidth, 16);
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({ color: '#4a3520' }));
      edge.rotation.z = Math.PI / 2;
      edge.position.set(0, -0.28, 0.24);
      group.add(edge);
    }

  // ========================================================
  // ==================== LINKED LIST =======================
  // ========================================================
  } else if (structure === 'linkedlist') {

    // ---------- TRAIN (Facing Right) ----------
    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        trainCar.scale.setScalar(0.82);
        // Train faces RIGHT (positive X) - no rotation needed
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
        group.add(trainCar);

        // Connection arrows between cars
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing + 0.35, startX + (i + 1) * spacing - 0.35, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.12;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 12);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.24, 0);
          ptrLabel.scale.set(0.26, 0.08, 1);
          group.add(ptrLabel);
        }
      });

      // HEAD / TAIL / NULL labels
      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.55, 0);
      headSprite.scale.set(0.32, 0.12, 1);
      group.add(headSprite);

      const tailSprite = createTextSprite('TAIL', '#0066ff', 20);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.55, 0);
      tailSprite.scale.set(0.32, 0.12, 1);
      group.add(tailSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.32, 0.22, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing + 0.35, startX + data.length * spacing - 0.12, false);
      nullArrow.position.y = -0.12;
      group.add(nullArrow);

      // Rails
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.4, 0.018, 0.025);
      [-0.11, 0.11].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.1, z);
        group.add(rail);
      });

      // Railway ties
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.035, 0.012, 0.32);
      for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.15) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(x, -0.11, 0);
        group.add(tie);
      }

      // Ground (gravel)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.9),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.12;
      group.add(ground);

    // ---------- PEOPLE LINE (Walking toward door) ----------
    } else if (environment === 'people') {
      // Create house/room with door
      const roomX = startX - 1.2;

      // House front wall
      const wallMat = new THREE.MeshStandardMaterial({ color: '#d4a373', roughness: 0.8 });
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.9), wallMat);
      frontWall.position.set(roomX, 0.2, 0);
      group.add(frontWall);

      // Door frame
      const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 });
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.38), doorFrameMat);
      doorFrame.position.set(roomX + 0.02, 0.1, 0);
      group.add(doorFrame);

      // Door (open position - swung inward)
      const doorMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.7 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.32), doorMat);
      door.position.set(roomX - 0.08, 0.08, 0.15);
      door.rotation.y = -0.9; // Door swung open
      group.add(door);

      // Door handle
      const handleGeo = new THREE.SphereGeometry(0.02, 8, 8);
      const handleMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(roomX - 0.06, 0.08, 0.02);
      group.add(handle);

      // Roof
      const roofGeo = new THREE.BoxGeometry(0.15, 0.04, 0.95);
      const roofMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(roomX, 0.6, 0);
      group.add(roof);

      // Welcome mat
      const matGeo = new THREE.PlaneGeometry(0.25, 0.15);
      const matMat = new THREE.MeshStandardMaterial({ color: '#2e7d32', side: THREE.DoubleSide });
      const welcomeMat = new THREE.Mesh(matGeo, matMat);
      welcomeMat.rotation.x = -Math.PI / 2;
      welcomeMat.position.set(roomX + 0.2, -0.155, 0);
      group.add(welcomeMat);

      // "WELCOME" sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 180; signCanvas.height = 50;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#1a5276';
      sctx.fillRect(0, 0, 180, 50);
      sctx.strokeStyle = '#ffd700';
      sctx.lineWidth = 3;
      sctx.strokeRect(3, 3, 174, 44);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 20px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🏠 WELCOME 🏠', 90, 34);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signCanvas), transparent: true })
      );
      signSprite.position.set(roomX, 0.72, 0);
      signSprite.scale.set(0.45, 0.12, 1);
      group.add(signSprite);

      // People in line (walking toward door)
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          // Calculate walk phase based on position (closer to door = more walking animation)
          const walkPhase = (animPhase === 'll-traverse' && isHl) ? Math.PI * 0.5 : 0;
          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.72);
          // Face toward door (left/negative X)
          human.rotation.y = -Math.PI / 2;
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
          group.add(human);
        }
        
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing + 0.3, startX + (i + 1) * spacing - 0.3, false);
          arrow.position.y = 0.08;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 11);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.04, 0);
          ptrLabel.scale.set(0.24, 0.07, 1);
          group.add(ptrLabel);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 18);
      headSprite.position.set(startX, 0.5, 0);
      headSprite.scale.set(0.28, 0.1, 1);
      group.add(headSprite);

      // NULL at end
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0.08, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing + 0.3, startX + data.length * spacing - 0.1, false);
      nullArrow.position.y = 0.08;
      group.add(nullArrow);

      // Floor/pathway
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2, 0.55),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.16;
      group.add(floor);

    // ---------- DOMINO ----------
    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        domino.scale.setScalar(0.82);
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
        group.add(domino);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing + 0.25, startX + (i + 1) * spacing - 0.25, false);
          arrow.position.y = -0.32;
          group.add(arrow);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 18);
      headSprite.position.set(startX, 0.38, 0);
      headSprite.scale.set(0.28, 0.1, 1);
      group.add(headSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 18);
      nullSprite.position.set(startX + data.length * spacing, -0.32, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing + 0.25, startX + data.length * spacing - 0.1, false);
      nullArrow.position.y = -0.32;
      group.add(nullArrow);

      // Green felt table
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.75, 0.035, 0.55),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.28;
      group.add(table);

      // Table edge
      const edgeMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 });
      const edgeGeo = new THREE.BoxGeometry(data.length * spacing + 0.8, 0.055, 0.035);
      [0.29, -0.29].forEach(z => {
        const edg = new THREE.Mesh(edgeGeo, edgeMat);
        edg.position.set(0, -0.28, z);
        group.add(edg);
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
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(book);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.65, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.38, 0.14, 1);
          group.add(topSprite);
        }
      });

      // Desk
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.035, 0.65),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = baseY - 0.08;
      group.add(desk);

    // ---------- PLATES (Fried Chicken & Rice) ----------
    } else if (environment === 'plates') {
      const plateSpacing = 0.045;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plateItem = createPlate(item.label, isHl);
        plateItem.position.set(isHl ? 0.12 : 0, plateBaseY + i * plateSpacing, 0);
        plateItem.scale.setScalar(0.62);
        applyItemAnimation(plateItem, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(plateItem);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.48, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.32, 0.11, 1);
          group.add(topSprite);
        }
      });

      // Counter
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.055, 0.55),
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.05;
      group.add(counter);

      // Counter front panel
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.28),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      panel.position.set(0, plateBaseY - 0.18, 0.28);
      group.add(panel);

      // CAFETERIA sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256; signCanvas.height = 48;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#e74c3c';
      sctx.fillRect(0, 0, 256, 48);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 26px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🍗 CAFETERIA 🍚', 128, 35);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(signCanvas), transparent: true })
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
        const cardboardBox = createCardboardBox(item.label, item.color, isHl, isPeeking);
        cardboardBox.position.set(isHl ? 0.18 : 0, boxBaseY + i * boxSpacing, 0);
        cardboardBox.rotation.y = (i % 2 === 0) ? 0 : 0.05;
        cardboardBox.scale.setScalar(0.78);
        applyItemAnimation(cardboardBox, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(cardboardBox);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.55, boxBaseY + i * boxSpacing, 0);
          topSprite.scale.set(0.32, 0.11, 1);
          group.add(topSprite);
        }
      });

      // Pallet
      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.055, 0.6),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.22;
      group.add(pallet);

      // Pallet slats
      const slatGeo = new THREE.BoxGeometry(0.8, 0.012, 0.075);
      const slatMat = new THREE.MeshStandardMaterial({ color: '#8b6914' });
      [-0.22, 0, 0.22].forEach(z => {
        const slat = new THREE.Mesh(slatGeo, slatMat);
        slat.position.set(0, boxBaseY - 0.25, z);
        group.add(slat);
      });
    }

  // ========================================================
  // ==================== QUEUE =============================
  // ========================================================
  } else if (structure === 'queue') {

    // ---------- TOLLGATE (Expressway) ----------
    if (environment === 'tollgate') {
      // Create toll booth
      const tollBooth = createTollBooth();
      tollBooth.position.set(startX - 0.9, 0, 0);
      tollBooth.scale.setScalar(0.85);
      group.add(tollBooth);

      // Cars in queue (facing LEFT toward toll booth)
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const drivePhase = (animPhase === 'queue-dequeue-exit' && isHl) ? animProgress || 0 : 0;
        const carObj = createCar(item.color, item.label, isHl, drivePhase);
        carObj.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
        carObj.scale.setScalar(0.78);
        // Car faces LEFT (toward toll) - rotate 180 degrees
        carObj.rotation.y = Math.PI;
        applyItemAnimation(carObj, i, animPhase || '', animData || {}, 'queue', animProgress);
        group.add(carObj);
      });

      // FRONT / REAR labels
      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.2, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // Road
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.65),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.06;
      group.add(road);

      // Road markings (dashed center line)
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.5; x += 0.22) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.022), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, -0.055, 0);
        group.add(dash);
      }

      // Road edge lines
      [-0.28, 0.28].forEach(z => {
        const edgeLine = new THREE.Mesh(
          new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.02),
          dashMat
        );
        edgeLine.rotation.x = -Math.PI / 2;
        edgeLine.position.set(0, -0.055, z);
        group.add(edgeLine);
      });

      // EXIT arrow
      const exitSprite = createTextSprite('EXIT →', '#00ff00', 20);
      exitSprite.position.set(startX - 1.4, 0.28, 0);
      exitSprite.scale.set(0.32, 0.1, 1);
      group.add(exitSprite);

    // ---------- TICKETS ----------
    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticketObj = createTicket(item.label, item.color, isHl);
        ticketObj.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        ticketObj.scale.setScalar(0.78);
        applyItemAnimation(ticketObj, i, animPhase || '', animData || {}, 'queue', animProgress);
        group.add(ticketObj);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.2, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // Counter
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.55, 0.035, 0.38),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.14;
      group.add(counter);

      // NOW SERVING sign
      const servingCanvas = document.createElement('canvas');
      servingCanvas.width = 200; servingCanvas.height = 64;
      const svctx = servingCanvas.getContext('2d')!;
      svctx.fillStyle = '#1a1a2e';
      svctx.fillRect(0, 0, 200, 64);
      svctx.strokeStyle = '#ffd700';
      svctx.lineWidth = 2;
      svctx.strokeRect(3, 3, 194, 58);
      svctx.fillStyle = '#00ff00';
      svctx.font = 'bold 13px Arial';
      svctx.textAlign = 'center';
      svctx.fillText('NOW SERVING', 100, 20);
      svctx.font = 'bold 26px Arial';
      svctx.fillStyle = '#ff0';
      svctx.fillText(data.length > 0 ? data[0].label : '---', 100, 50);
      const servingSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(servingCanvas), transparent: true })
      );
      servingSprite.position.set(startX - 0.55, 0.18, 0);
      servingSprite.scale.set(0.42, 0.14, 1);
      group.add(servingSprite);

    // ---------- STUDENTS (Queue with School Building) ----------
    } else if (environment === 'students') {
      // School building entrance
      const buildingX = startX - 1.0;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7 });

      // Main building front
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.9), wallMat);
      frontWall.position.set(buildingX, 0.22, 0);
      group.add(frontWall);

      // Entrance arch
      const archMat = new THREE.MeshStandardMaterial({ color: '#922b21', roughness: 0.6 });
      const archGeo = new THREE.BoxGeometry(0.12, 0.6, 0.4);
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(buildingX + 0.02, 0.12, 0);
      group.add(arch);

      // Door (double doors, open)
      const doorMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.6 });
      [-0.12, 0.12].forEach((z, di) => {
        const doorGeo = new THREE.BoxGeometry(0.02, 0.5, 0.15);
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(buildingX + 0.06, 0.08, z);
        doorMesh.rotation.y = di === 0 ? 0.7 : -0.7;
        group.add(doorMesh);
      });

      // School windows
      const winMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4 });
      [-0.35, 0.35].forEach(z => {
        const winGeo = new THREE.PlaneGeometry(0.08, 0.12);
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(buildingX + 0.052, 0.38, z);
        win.rotation.y = Math.PI / 2;
        group.add(win);
      });

      // School sign
      const schoolCanvas = document.createElement('canvas');
      schoolCanvas.width = 200; schoolCanvas.height = 48;
      const schCtx = schoolCanvas.getContext('2d')!;
      schCtx.fillStyle = '#1a5276';
      schCtx.fillRect(0, 0, 200, 48);
      schCtx.strokeStyle = '#ffd700';
      schCtx.lineWidth = 3;
      schCtx.strokeRect(2, 2, 196, 44);
      schCtx.fillStyle = '#fff';
      schCtx.font = 'bold 15px Arial';
      schCtx.textAlign = 'center';
      schCtx.fillText('📚 DS ACADEMY 📚', 100, 32);
      const schoolSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(schoolCanvas), transparent: true })
      );
      schoolSprite.position.set(buildingX, 0.68, 0);
      schoolSprite.scale.set(0.48, 0.11, 1);
      group.add(schoolSprite);

      // Roof
      const roofGeo = new THREE.BoxGeometry(0.14, 0.035, 0.95);
      const roofMat2 = new THREE.MeshStandardMaterial({ color: '#7f8c8d' });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat2);
      roofMesh.position.set(buildingX, 0.63, 0);
      group.add(roofMesh);

      // Students in queue (facing left toward door)
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const walkPhase = (animPhase === 'queue-dequeue-exit' && isHl) ? (animProgress || 0) * Math.PI * 2 : 0;
          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.65);
          // Face toward school entrance (left)
          human.rotation.y = -Math.PI / 2;
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue', animProgress);
          group.add(human);
        }
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 16);
      frontSprite.position.set(startX, -0.18, 0);
      frontSprite.scale.set(0.26, 0.09, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 16);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.18, 0);
      rearSprite.scale.set(0.26, 0.09, 1);
      group.add(rearSprite);

      // Floor/pathway
      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.48),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.y = -0.13;
      group.add(pathway);

      // Path guide lines
      const pathLineMat = new THREE.MeshBasicMaterial({ color: '#95a5a6', side: THREE.DoubleSide });
      [-0.18, 0.18].forEach(z => {
        const pathLine = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.008), pathLineMat);
        pathLine.rotation.x = -Math.PI / 2;
        pathLine.position.set(0, -0.125, z);
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
  const [animProgress, setAnimProgress] = useState(1);

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

  // Animation frame ref for smooth animations
  const animFrameRef = useRef<number | null>(null);

  // ==================== DATA ====================

  const [groceryItems, setGroceryItems] = useState<DataItem[]>([
    { id: 1, label: 'Coco Crunch', color: '#8B4513' },
    { id: 2, label: 'Corn Flakes', color: '#f39c12' },
    { id: 3, label: 'Froot Loops', color: '#e74c3c' },
    { id: 4, label: 'Cheerios', color: '#f1c40f' },
    { id: 5, label: 'Frosted', color: '#3498db' },
  ]);

  const [students, setStudents] = useState<DataItem[]>([
    { id: 1, label: 'Alex', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Beth', color: '#e91e63', appearance: { skinTone: '#f5d0c5', shirtColor: '#e91e63', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Carl', color: '#27ae60', appearance: { skinTone: '#8d5524', shirtColor: '#27ae60', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
    { id: 4, label: 'Dana', color: '#f39c12', appearance: { skinTone: '#ffcd94', shirtColor: '#f39c12', pantsColor: '#3498db', hairColor: '#d4a574', hairStyle: 'long', gender: 'female' } },
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
    { id: 1, label: 'Stu 1', color: '#3498db', appearance: { skinTone: '#ffdbac', shirtColor: '#3498db', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } },
    { id: 2, label: 'Stu 2', color: '#2ecc71', appearance: { skinTone: '#f5d0c5', shirtColor: '#2ecc71', pantsColor: '#8e44ad', hairColor: '#2c1810', hairStyle: 'long', gender: 'female' } },
    { id: 3, label: 'Stu 3', color: '#9b59b6', appearance: { skinTone: '#8d5524', shirtColor: '#9b59b6', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } },
  ]);

  // ==================== HELPERS ====================

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Smooth animation helper
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
    return () => { 
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
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
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress);
  }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress]);

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

  // ==================== ARRAY OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData(), index = Math.floor(Math.random() * data.length);
    setHighlightIndex(index);
    setOperationMessage(`Accessing [${index}]...`);
    setCodeDisplay(`// O(1) Access\narray[${index}]`);
    await smoothAnimate(400, 'access-lift', { index });
    setOperationMessage(`Found: "${data[index].label}"`);
    await smoothAnimate(600, 'access-bounce', { index });
    await smoothAnimate(350, 'access-settle', { index });
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating || getArrayData().length >= 6) return; setIsAnimating(true);
    const data = getArrayData(), insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(200); }
    const newLabel = arrayEnv === 'grocery' ? 'New Cereal' : 'New';
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), label: newLabel, color: '#1abc9c' }); return arr;
    });
    setHighlightIndex(insertIndex);
    await smoothAnimate(450, 'insert-drop', { index: insertIndex });
    await smoothAnimate(350, 'insert-settle', { index: insertIndex });
    setOperationMessage('Inserted!'); await delay(600);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return; setIsAnimating(true);
    const data = getArrayData(), deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]: "${data[deleteIndex].label}"`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    await smoothAnimate(450, 'delete-lift', { index: deleteIndex });
    await smoothAnimate(400, 'delete-shrink', { index: deleteIndex });
    setHighlightIndex(null);
    (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex));
    await smoothAnimate(350, 'delete-close', { deleteIndex });
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
    await smoothAnimate(400, 'swap-lift', { index1: idx1, index2: idx2 });
    await smoothAnimate(350, 'swap-cross', { index1: idx1, index2: idx2 });
    (setArrayData as any)((prev: DataItem[]) => { const a = [...prev]; [a[idx1], a[idx2]] = [a[idx2], a[idx1]]; return a; });
    await smoothAnimate(400, 'swap-drop', { index1: idx1, index2: idx2 });
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
    await smoothAnimate(450, 'll-insert-head', { index: 0 });
    await smoothAnimate(350, 'll-insert-head-settle', { index: 0 });
    setOperationMessage('Inserted at HEAD!'); await delay(700);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    const data = getLinkedListData();
    setOperationMessage('Traversing to TAIL...');
    setCodeDisplay('// O(n) Traverse');
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      await smoothAnimate(300, 'll-traverse', { index: i });
    }
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#e74c3c' };
    (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    await smoothAnimate(450, 'll-insert-tail', { index: data.length });
    await smoothAnimate(350, 'll-insert-tail-settle', { index: data.length });
    setOperationMessage('Inserted at TAIL!'); await delay(700);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating || getLinkedListData().length <= 2) return; setIsAnimating(true);
    setHighlightIndex(0);
    setOperationMessage('Deleting HEAD...');
    setCodeDisplay('// O(1)\nhead = head.next');
    await smoothAnimate(450, 'll-delete-lift', { index: 0 });
    await smoothAnimate(400, 'll-delete-shrink', { index: 0 });
    (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(300);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getLinkedListData();
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Visiting: ${data[i].label}`);
      setCodeDisplay(`// Node ${i}\ncurr = curr.next`);
      await smoothAnimate(400, 'll-traverse', { index: i });
    }
    setOperationMessage(`Done! ${data.length} nodes`); await delay(700);
    setAnimPhase(''); setAnimData({});
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
    await smoothAnimate(450, 'stack-push-drop', { index: data.length });
    await smoothAnimate(350, 'stack-push-settle', { index: data.length });
    setOperationMessage('Pushed!'); await delay(600);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating || getStackData().length <= 1) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping "${topItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`);
    await smoothAnimate(400, 'stack-pop-lift', { index: data.length - 1 });
    await smoothAnimate(400, 'stack-pop-fly', { index: data.length - 1 });
    (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1));
    await delay(300);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating || getStackData().length === 0) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Peeking TOP...`);
    setCodeDisplay(`// O(1)\nstack.peek()`);
    await smoothAnimate(350, 'stack-peek-lift', { index: data.length - 1 });
    setOperationMessage(`TOP: "${topItem.label}"`);
    await smoothAnimate(800, 'stack-peek-open', { index: data.length - 1 });
    await smoothAnimate(350, 'stack-peek-settle', { index: data.length - 1 });
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== QUEUE OPERATIONS ====================

  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return; setIsAnimating(true);
    const data = getQueueData();
    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : queueEnv === 'tollgate'
        ? { id: Date.now(), label: `NEW-${Math.floor(Math.random() * 900) + 100}`, color: '#1abc9c' }
        : { id: Date.now(), label: `T-00${data.length + 1}`, color: '#1abc9c' };
    setOperationMessage(`Enqueue: "${newItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.enqueue("${newItem.label}")`);
    (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    await smoothAnimate(500, 'queue-enqueue-enter', { index: data.length });
    await smoothAnimate(350, 'queue-enqueue-settle', { index: data.length });
    setOperationMessage('Enqueued!'); await delay(600);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating || getQueueData().length <= 1) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`);
    await smoothAnimate(550, 'queue-dequeue-exit', { index: 0 });
    await smoothAnimate(350, 'queue-dequeue-gone', { index: 0 });
    (setQueueData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(300);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`);
    await smoothAnimate(1000, 'queue-front-peek', { index: 0 });
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
    ? [{ id: 'grocery', icon: '🥣', label: 'Cereals' }, { id: 'classroom', icon: '🧑‍🎓', label: 'Class' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '🚪', label: 'Queue' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍗', label: 'Food' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
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
          isSurfaceMode={appMode === 'surface'} animPhase={animPhase} animData={animData} animProgress={animProgress} />
      )}

      {!webxrActive && appMode === 'surface' && surfacePlaced && surfacePosition && (
        <div style={{ position: 'absolute', left: surfacePosition.x + 40, top: surfacePosition.y + surfacePosition.height, width: surfacePosition.width - 80, height: 25,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)', borderRadius: '50%', zIndex: 49, pointerEvents: 'none' }} />
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {!webxrActive && <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200 }}>🔄</button>}

        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5, cursor: 'pointer' }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5, cursor: 'pointer' }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'webxr' ? '#e17055' : 'transparent', color: 'white', opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25, cursor: webxrSupported ? 'pointer' : 'not-allowed' }}>🌐 AR{!webxrSupported && ' ✗'}</button>
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
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {currentData.length}
            {appMode === 'surface' && <span style={{ marginLeft: 10, color: '#00b894' }}>📱 Surface</span>}
            {appMode === 'webxr' && <span style={{ marginLeft: 10, color: '#e17055' }}>🌐 WebXR</span>}
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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Tap to place</div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
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
      transition: 'transform 0.1s', cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{label}</button>
  );
}

// ==================== VISUALIZATION 3D ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode, animPhase, animData, animProgress }: {
  position: Position; data: DataItem[]; highlightIndex: number | null; highlightIndex2: number | null;
  structure: DataStructure; environment: string; zoomLevel: number; setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean; animPhase: string; animData: Record<string, any>; animProgress: number;
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
    const fillLight = new THREE.PointLight(0xffffff, 0.3);
    fillLight.position.set(0, -3, 3); scene.add(fillLight);

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
    container.addEventListener('mousedown', onMD); container.addEventListener('mousemove', onMM);
    container.addEventListener('mouseup', onMU); container.addEventListener('mouseleave', onMU);
    container.addEventListener('wheel', onWH, { passive: false });

    let animationId: number;
    const animate = () => {
      if (groupRef.current) { groupRef.current.rotation.x = rotationRef.current.x; groupRef.current.rotation.y = rotationRef.current.y; groupRef.current.scale.setScalar(zoomRef.current); }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('touchstart', onTS); container.removeEventListener('touchmove', onTM); container.removeEventListener('touchend', onTE);
      container.removeEventListener('mousedown', onMD); container.removeEventListener('mousemove', onMM); container.removeEventListener('mouseup', onMU); container.removeEventListener('mouseleave', onMU);
      container.removeEventListener('wheel', onWH);
      renderer.dispose(); if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [structure, renderWidth, renderHeight]);

  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress);
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto', overflow: 'visible' }} />;
}

// ==================== END OF PART 3 ====================
