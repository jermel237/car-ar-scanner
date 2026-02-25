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

// ==================== FIXED HUMAN 3D (Longer legs for classroom) ====================

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
  
  // INCREASED leg heights for better proportions
  const shoeHeight = 0.18 * scale;
  const lowerLegHeight = 0.7 * scale;  // Increased from 0.55
  const upperLegHeight = 0.75 * scale;  // Increased from 0.6
  const torsoHeight = 1.0 * scale;
  const neckHeight = 0.15 * scale;
  const headHeight = 0.75 * scale;

  if (isSeated) {
    // ===== SEATED POSITION (for classroom) =====
    const seatHeight = groundY + 0.02;
    
    // SHOES - on ground, forward
    [-1, 1].forEach((side) => {
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 * scale, shoeHeight, 0.42 * scale),
        shoeMat
      );
      shoe.position.set(side * 0.22 * scale, groundY + shoeHeight / 2, 0.4 * scale);
      human.add(shoe);
    });

    // LOWER LEGS - longer, vertical from shoes
    [-1, 1].forEach((side) => {
      const lowerLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * scale, lowerLegHeight, 0.3 * scale),
        pantsMat
      );
      lowerLeg.position.set(side * 0.22 * scale, groundY + shoeHeight + lowerLegHeight / 2, 0.38 * scale);
      human.add(lowerLeg);
    });

    // UPPER LEGS - horizontal on seat (longer)
    const upperLegY = seatHeight + 0.04 * scale;
    [-1, 1].forEach((side) => {
      const upperLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 * scale, 0.14 * scale, upperLegHeight),
        pantsMat
      );
      upperLeg.position.set(side * 0.22 * scale, upperLegY, 0.18 * scale);
      human.add(upperLeg);
    });

    // HIPS
    const hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.75 * scale, 0.18 * scale, 0.38 * scale),
      pantsMat
    );
    hips.position.set(0, upperLegY + 0.04 * scale, -0.05 * scale);
    human.add(hips);

    // TORSO
    const torsoY = upperLegY + 0.12 * scale + torsoHeight / 2;
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, torsoHeight, 0.5 * scale),
      shirtMat
    );
    torso.position.set(0, torsoY, -0.05 * scale);
    torso.castShadow = true;
    human.add(torso);

    // NECK
    const neckY = torsoY + torsoHeight / 2 + neckHeight / 2;
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, neckHeight, 0.25 * scale),
      skinMat
    );
    neck.position.set(0, neckY, -0.05 * scale);
    human.add(neck);

    // HEAD
    const headY = neckY + neckHeight / 2 + headHeight / 2;
    const headGroup = new THREE.Group();
    headGroup.position.set(0, headY, -0.05 * scale);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 * scale, headHeight, 0.7 * scale),
      skinMat
    );
    headGroup.add(head);

    // Hair
    if (appearance.hairStyle !== 'bald') {
      const hairTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.74 * scale, 0.3 * scale, 0.74 * scale),
        hairMat
      );
      hairTop.position.y = 0.3 * scale;
      headGroup.add(hairTop);
    }

    if (appearance.hairStyle === 'long') {
      const hairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.74 * scale, 0.6 * scale, 0.15 * scale),
        hairMat
      );
      hairBack.position.set(0, 0, -0.32 * scale);
      headGroup.add(hairBack);
    }

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.05 * scale);
    [-0.15, 0.15].forEach(x => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x * scale, 0.05 * scale, 0.35 * scale);
      headGroup.add(eye);
    });

    // Mouth
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * scale, 0.05 * scale, 0.05 * scale),
      mouthMat
    );
    mouth.position.set(0, -0.15 * scale, 0.35 * scale);
    headGroup.add(mouth);

    human.add(headGroup);

    // ARMS
    [-1, 1].forEach((side) => {
      const upperArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.25 * scale, 0.55 * scale, 0.25 * scale),
        shirtMat
      );
      upperArm.position.set(side * 0.6 * scale, torsoY, 0.1 * scale);
      upperArm.rotation.x = -0.8;
      human.add(upperArm);

      const lowerArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.22 * scale),
        skinMat
      );
      lowerArm.position.set(side * 0.55 * scale, torsoY - 0.15 * scale, 0.35 * scale);
      lowerArm.rotation.x = -1.2;
      human.add(lowerArm);

      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale),
        skinMat
      );
      hand.position.set(side * 0.5 * scale, torsoY - 0.25 * scale, 0.45 * scale);
      human.add(hand);
    });

    // Plumbob
    if (isHighlighted) {
      const plumbob = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
      );
      plumbob.position.set(0, headY + headHeight / 2 + 0.06, -0.05 * scale);
      human.add(plumbob);
    }

    // Name label
    const labelY = headY + headHeight / 2 + 0.1;
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200; labelCanvas.height = 48;
    const lctx = labelCanvas.getContext('2d')!;
    if (isHighlighted) {
      lctx.fillStyle = '#00ff00';
      lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill();
      lctx.fillStyle = '#000';
    } else {
      lctx.fillStyle = 'rgba(0,0,0,0.85)';
      lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill();
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
    // ===== STANDING/WALKING POSITION =====
    
    const totalLegHeight = shoeHeight + lowerLegHeight + upperLegHeight;
    const hipY = groundY + totalLegHeight;
    const torsoY = hipY + torsoHeight / 2;
    const neckY = torsoY + torsoHeight / 2;
    const headY = neckY + neckHeight + headHeight / 2;

    // LEGS with walking animation
    [-1, 1].forEach((side, idx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(side * 0.22 * scale, hipY, 0);

      const upperLegPivot = new THREE.Group();
      
      const upperLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 * scale, upperLegHeight, 0.32 * scale),
        pantsMat
      );
      upperLeg.position.y = -upperLegHeight / 2;
      upperLegPivot.add(upperLeg);

      const lowerLegPivot = new THREE.Group();
      lowerLegPivot.position.y = -upperLegHeight;

      const lowerLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.3 * scale, lowerLegHeight, 0.3 * scale),
        pantsMat
      );
      lowerLeg.position.y = -lowerLegHeight / 2;
      lowerLegPivot.add(lowerLeg);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.32 * scale, shoeHeight, 0.42 * scale),
        shoeMat
      );
      shoe.position.set(0, -lowerLegHeight - shoeHeight / 2, 0.05 * scale);
      lowerLegPivot.add(shoe);

      upperLegPivot.add(lowerLegPivot);
      legGroup.add(upperLegPivot);

      // Walking animation
      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase + (idx === 0 ? 0 : Math.PI)) * 0.5;
        upperLegPivot.rotation.x = swing;
        const kneeBend = Math.max(0, -Math.sin(walkPhase + (idx === 0 ? 0 : Math.PI))) * 0.6;
        lowerLegPivot.rotation.x = kneeBend;
      }

      human.add(legGroup);
    });

    // HIPS
    const hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.75 * scale, 0.18 * scale, 0.42 * scale),
      pantsMat
    );
    hips.position.set(0, hipY, 0);
    human.add(hips);

    // TORSO
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, torsoHeight, 0.5 * scale),
      shirtMat
    );
    torso.position.set(0, torsoY, 0);
    torso.castShadow = true;
    human.add(torso);

    // NECK
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, neckHeight, 0.25 * scale),
      skinMat
    );
    neck.position.set(0, neckY + neckHeight / 2, 0);
    human.add(neck);

    // HEAD GROUP
    const headGroup = new THREE.Group();
    headGroup.position.set(0, headY, 0);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.7 * scale, headHeight, 0.7 * scale),
      skinMat
    );
    headGroup.add(head);

    if (appearance.hairStyle !== 'bald') {
      const hairTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.74 * scale, 0.3 * scale, 0.74 * scale),
        hairMat
      );
      hairTop.position.y = 0.3 * scale;
      headGroup.add(hairTop);
    }

    if (appearance.hairStyle === 'long') {
      const hairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.74 * scale, 0.6 * scale, 0.15 * scale),
        hairMat
      );
      hairBack.position.set(0, 0, -0.32 * scale);
      headGroup.add(hairBack);

      [-0.35, 0.35].forEach(x => {
        const hairSide = new THREE.Mesh(
          new THREE.BoxGeometry(0.15 * scale, 0.5 * scale, 0.3 * scale),
          hairMat
        );
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

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * scale, 0.05 * scale, 0.05 * scale),
      mouthMat
    );
    mouth.position.set(0, -0.15 * scale, 0.35 * scale);
    headGroup.add(mouth);

    human.add(headGroup);

    // ARMS with swing
    [-1, 1].forEach((side, idx) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(side * 0.575 * scale, torsoY + torsoHeight * 0.35, 0);

      const upperArmPivot = new THREE.Group();
      
      const upperArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.25 * scale, 0.55 * scale, 0.25 * scale),
        shirtMat
      );
      upperArm.position.y = -0.275 * scale;
      upperArmPivot.add(upperArm);

      const lowerArmPivot = new THREE.Group();
      lowerArmPivot.position.y = -0.55 * scale;

      const lowerArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.22 * scale),
        skinMat
      );
      lowerArm.position.y = -0.25 * scale;
      lowerArmPivot.add(lowerArm);

      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * scale, 0.18 * scale, 0.18 * scale),
        skinMat
      );
      hand.position.y = -0.55 * scale;
      lowerArmPivot.add(hand);

      upperArmPivot.add(lowerArmPivot);
      armGroup.add(upperArmPivot);

      // Arm swing
      if (walkPhase > 0) {
        const swing = Math.sin(walkPhase) * 0.7;
        upperArmPivot.rotation.x = side === -1 ? swing : -swing;
        lowerArmPivot.rotation.x = Math.max(0, Math.sin(walkPhase + (side === -1 ? 0 : Math.PI))) * 0.3;
      }

      human.add(armGroup);
    });

    // Plumbob
    if (isHighlighted) {
      const plumbob = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })
      );
      plumbob.position.set(0, headY + headHeight / 2 + 0.06, 0);
      human.add(plumbob);
    }

    // Name label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 200; labelCanvas.height = 48;
    const lctx = labelCanvas.getContext('2d')!;
    if (isHighlighted) {
      lctx.fillStyle = '#00ff00';
      lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill();
      lctx.fillStyle = '#000';
    } else {
      lctx.fillStyle = 'rgba(0,0,0,0.85)';
      lctx.beginPath(); lctx.roundRect(0, 0, 200, 48, 12); lctx.fill();
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

  // Shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = groundY + 0.001;
  human.add(shadow);

  return human;
}

// ==================== TEACHER WITH GLASSES ====================

function createTeacher(): THREE.Group {
  const teacher = new THREE.Group();
  
  const scale = 0.14; // Slightly bigger than students
  const groundY = 0;
  
  const skinMat = new THREE.MeshStandardMaterial({ color: '#e0b89c', roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.6 }); // Dark formal shirt
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#3d2314', roughness: 0.8 });
  const glassesMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 });
  const lensMat = new THREE.MeshStandardMaterial({ color: '#a8d8ea', transparent: true, opacity: 0.3, metalness: 0.5 });
  
  const shoeHeight = 0.15 * scale;
  const lowerLegHeight = 0.6 * scale;
  const upperLegHeight = 0.65 * scale;
  const torsoHeight = 1.1 * scale;
  const neckHeight = 0.12 * scale;
  const headHeight = 0.7 * scale;
  
  const totalLegHeight = shoeHeight + lowerLegHeight + upperLegHeight;
  const hipY = groundY + totalLegHeight;
  const torsoY = hipY + torsoHeight / 2;
  const neckY = torsoY + torsoHeight / 2;
  const headY = neckY + neckHeight + headHeight / 2;

  // LEGS
  [-1, 1].forEach((side) => {
    const upperLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * scale, upperLegHeight, 0.28 * scale),
      pantsMat
    );
    upperLeg.position.set(side * 0.18 * scale, hipY - upperLegHeight / 2, 0);
    teacher.add(upperLeg);

    const lowerLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.26 * scale, lowerLegHeight, 0.26 * scale),
      pantsMat
    );
    lowerLeg.position.set(side * 0.18 * scale, groundY + shoeHeight + lowerLegHeight / 2, 0);
    teacher.add(lowerLeg);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28 * scale, shoeHeight, 0.38 * scale),
      shoeMat
    );
    shoe.position.set(side * 0.18 * scale, groundY + shoeHeight / 2, 0.03 * scale);
    teacher.add(shoe);
  });

  // HIPS
  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(0.65 * scale, 0.15 * scale, 0.35 * scale),
    pantsMat
  );
  hips.position.set(0, hipY, 0);
  teacher.add(hips);

  // TORSO
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.85 * scale, torsoHeight, 0.45 * scale),
    shirtMat
  );
  torso.position.set(0, torsoY, 0);
  teacher.add(torso);

  // TIE
  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale, 0.5 * scale, 0.03 * scale),
    new THREE.MeshStandardMaterial({ color: '#c0392b' })
  );
  tie.position.set(0, torsoY - 0.1 * scale, 0.24 * scale);
  teacher.add(tie);

  // NECK
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.22 * scale, neckHeight, 0.22 * scale),
    skinMat
  );
  neck.position.set(0, neckY + neckHeight / 2, 0);
  teacher.add(neck);

  // HEAD
  const headGroup = new THREE.Group();
  headGroup.position.set(0, headY, 0);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.65 * scale, headHeight, 0.65 * scale),
    skinMat
  );
  headGroup.add(head);

  // Hair (short professional)
  const hairTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.68 * scale, 0.2 * scale, 0.68 * scale),
    hairMat
  );
  hairTop.position.y = 0.28 * scale;
  headGroup.add(hairTop);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08 * scale, 0.06 * scale, 0.04 * scale);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#111111' });
  [-0.12, 0.12].forEach(x => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x * scale, 0.05 * scale, 0.33 * scale);
    headGroup.add(eye);
  });

  // GLASSES with clear lenses
  // Left frame
  const glassFrame1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, 0.12 * scale, 0.02 * scale),
    glassesMat
  );
  glassFrame1.position.set(-0.12 * scale, 0.05 * scale, 0.34 * scale);
  headGroup.add(glassFrame1);

  // Right frame
  const glassFrame2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, 0.12 * scale, 0.02 * scale),
    glassesMat
  );
  glassFrame2.position.set(0.12 * scale, 0.05 * scale, 0.34 * scale);
  headGroup.add(glassFrame2);

  // Bridge
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.06 * scale, 0.02 * scale, 0.02 * scale),
    glassesMat
  );
  bridge.position.set(0, 0.08 * scale, 0.34 * scale);
  headGroup.add(bridge);

  // Temple arms
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 * scale, 0.015 * scale, 0.015 * scale),
      glassesMat
    );
    arm.position.set(side * 0.28 * scale, 0.08 * scale, 0.2 * scale);
    headGroup.add(arm);
  });

  // Clear lenses
  [-0.12, 0.12].forEach(x => {
    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * scale, 0.08 * scale, 0.005 * scale),
      lensMat
    );
    lens.position.set(x * scale, 0.05 * scale, 0.35 * scale);
    headGroup.add(lens);
  });

  // Mouth (slight smile)
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.15 * scale, 0.04 * scale, 0.04 * scale),
    new THREE.MeshStandardMaterial({ color: '#cc8888' })
  );
  mouth.position.set(0, -0.12 * scale, 0.33 * scale);
  headGroup.add(mouth);

  teacher.add(headGroup);

  // ARMS (down at sides)
  [-1, 1].forEach((side) => {
    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * scale, 0.5 * scale, 0.22 * scale),
      shirtMat
    );
    upperArm.position.set(side * 0.54 * scale, torsoY + 0.1 * scale, 0);
    teacher.add(upperArm);

    const lowerArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * scale, 0.45 * scale, 0.2 * scale),
      skinMat
    );
    lowerArm.position.set(side * 0.54 * scale, torsoY - 0.35 * scale, 0);
    teacher.add(lowerArm);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.15 * scale, 0.15 * scale, 0.15 * scale),
      skinMat
    );
    hand.position.set(side * 0.54 * scale, torsoY - 0.62 * scale, 0);
    teacher.add(hand);
  });

  // Shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = groundY + 0.001;
  teacher.add(shadow);

  return teacher;
}

// ==================== BOOK - ONLY FRONT COVER OPENS (NO PAGE GLITCH) ====================

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

  // Back cover (bottom)
  const backCover = new THREE.Mesh(
    new THREE.BoxGeometry(bookWidth, 0.008, bookDepth),
    coverMat
  );
  backCover.position.y = -bookHeight / 2 + 0.004;
  book.add(backCover);

  // Pages block (static - no animation)
  const pagesBlock = new THREE.Mesh(
    new THREE.BoxGeometry(bookWidth - pageInset * 2, bookHeight - 0.02, bookDepth - pageInset * 2),
    new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 })
  );
  pagesBlock.position.set(pageInset / 2, 0, 0);
  book.add(pagesBlock);

  // Page lines on edges (static)
  const pageLineMat = new THREE.MeshBasicMaterial({ color: '#e8e0d0' });
  for (let y = -bookHeight / 2 + 0.01; y <= bookHeight / 2 - 0.01; y += 0.003) {
    const lineRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.002, 0.001, bookDepth - pageInset * 3),
      pageLineMat
    );
    lineRight.position.set(bookWidth / 2 - pageInset, y, 0);
    book.add(lineRight);

    const lineFront = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth - pageInset * 3, 0.001, 0.002),
      pageLineMat
    );
    lineFront.position.set(pageInset / 2, y, bookDepth / 2 - pageInset);
    book.add(lineFront);
  }

  // Spine
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, bookHeight, bookDepth),
    new THREE.MeshStandardMaterial({ color: spineColor, roughness: 0.4 })
  );
  spine.position.x = -bookWidth / 2 - 0.0125;
  book.add(spine);

  // Spine decorations
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  [-0.14, -0.05, 0.05, 0.14].forEach(z => {
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, bookHeight + 0.005, 0.015),
      ridgeMat
    );
    ridge.position.set(-bookWidth / 2 - 0.025, 0, z);
    book.add(ridge);
  });

  // Spine title
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 140; spineCanvas.height = 30;
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

  // FRONT COVER - ANIMATED OPENING (only this moves)
  const frontCoverGroup = new THREE.Group();
  frontCoverGroup.position.set(-bookWidth / 2, bookHeight / 2 - 0.004, 0);

  const frontCover = new THREE.Mesh(
    new THREE.BoxGeometry(bookWidth, 0.008, bookDepth),
    coverMat
  );
  frontCover.position.set(bookWidth / 2, 0, 0);
  frontCoverGroup.add(frontCover);

  // Cover title on front
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 180; coverCanvas.height = 140;
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

  // ANIMATE ONLY FRONT COVER - smooth opening
  if (isOpen && openAmount > 0) {
    const easedOpen = openAmount < 0.5 
      ? 2 * openAmount * openAmount 
      : 1 - Math.pow(-2 * openAmount + 2, 2) / 2;
    frontCoverGroup.rotation.z = easedOpen * Math.PI * 0.55; // Opens to ~100 degrees
  }

  book.add(frontCoverGroup);

  // Bookmark ribbon
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.12, 0.003),
    new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.6 })
  );
  ribbon.position.set(0.08, 0, bookDepth / 2 + 0.002);
  book.add(ribbon);

  // Highlight glow (only when not open)
  if (isHighlighted && !isOpen) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth + 0.05, bookHeight + 0.02, bookDepth + 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    book.add(glow);
  }

  return book;
}

// ==================== END OF PART 1 ====================
// ==================== PART 2: Train, Toll Gate, Cars, School, Plates, Boxes ====================

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

  const wheelGeo = new THREE.BoxGeometry(0.1, 0.1, 0.03);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.8, roughness: 0.2 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });

  [[-0.22, -0.05, 0.16], [0.22, -0.05, 0.16], [-0.22, -0.05, -0.16], [0.22, -0.05, -0.16]].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    train.add(wheel);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.035), hubMat);
    hub.position.set(wx, wy, wz);
    train.add(hub);
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
    const boilerGeo = new THREE.BoxGeometry(0.32, 0.22, 0.22);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.5, roughness: 0.4 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.position.set(0.18, 0.14, 0);
    train.add(boiler);

    const frontPlateGeo = new THREE.BoxGeometry(0.02, 0.2, 0.2);
    const frontPlateMat = new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.7 });
    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.position.set(0.35, 0.14, 0);
    train.add(frontPlate);

    const headlightGeo = new THREE.BoxGeometry(0.05, 0.06, 0.06);
    const headlightMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(0.38, 0.22, 0);
    train.add(headlight);

    const chimneyGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.12, 0.38, 0);
    train.add(chimney);

    const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.4 });
    [{ y: 0.52, s: 0.06 }, { y: 0.62, s: 0.08 }, { y: 0.74, s: 0.1 }].forEach(({ y, s }) => {
      const smoke = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), smokeMat);
      smoke.position.set(0.12 + (y - 0.52) * 0.15, y, (Math.random() - 0.5) * 0.06);
      train.add(smoke);
    });

    const catcherGeo = new THREE.BoxGeometry(0.08, 0.1, 0.25);
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7 });
    const catcher = new THREE.Mesh(catcherGeo, catcherMat);
    catcher.position.set(0.38, 0, 0);
    train.add(catcher);

    const cabinGeo = new THREE.BoxGeometry(0.22, 0.2, 0.3);
    const cabinMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.24, 0.22, 0);
    train.add(cabin);

    const cabWinGeo = new THREE.BoxGeometry(0.01, 0.08, 0.08);
    const cabWinMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4 });
    [-0.151, 0.151].forEach(z => {
      const cabWin = new THREE.Mesh(cabWinGeo, cabWinMat);
      cabWin.position.set(-0.24, 0.26, z);
      train.add(cabWin);
    });

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.34), roofMat);
    cabRoof.position.set(-0.24, 0.33, 0);
    train.add(cabRoof);
  }

  const hookGeo = new THREE.BoxGeometry(0.05, 0.03, 0.03);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8 });
  [-0.375, 0.375].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0.02, 0);
    train.add(hook);
  });

  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isHighlighted ? 'rgba(255,255,0,0.9)' : 'rgba(0,0,0,0.75)';
  ctx.beginPath(); ctx.roundRect(0, 0, 160, 48, 10); ctx.fill();
  ctx.fillStyle = isHighlighted ? '#000' : '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, 80, 34);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 0.55;
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

  return train;
}

// ==================== TOLL BOOTH (Barrier LOWERED, on side, across road) ====================

function createTollBooth(gateOpenAmount: number = 0): THREE.Group {
  const toll = new THREE.Group();
  const groundY = 0;

  // Booth structure - on the side
  const boothMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.6, metalness: 0.3 });
  const booth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.35), boothMat);
  booth.position.set(0, groundY + 0.325, -0.55);
  toll.add(booth);

  // Booth window
  const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.8 });
  const boothWindow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.01), windowMat);
  boothWindow.position.set(0, groundY + 0.42, -0.37);
  toll.add(boothWindow);

  // Booth roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.5 });
  const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.45), roofMat);
  boothRoof.position.set(0, groundY + 0.67, -0.55);
  toll.add(boothRoof);

  // Roof trim
  const trimMat = new THREE.MeshStandardMaterial({ color: '#f39c12', metalness: 0.5 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.47), trimMat);
  trim.position.set(0, groundY + 0.7, -0.55);
  toll.add(trim);

  // TOLL sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 120; signCanvas.height = 50;
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

  // Gate post - SHORTER (lowered)
  const postMat = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.5, metalness: 0.3 });
  const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), postMat);
  gatePost.position.set(0, groundY + 0.175, -0.32);
  toll.add(gatePost);

  // Gate arm pivot - LOWERED position
  const gatePivot = new THREE.Group();
  gatePivot.position.set(0, groundY + 0.32, -0.32);

  // Gate arm - extends across road
  const gateArmMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
  const gateArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), gateArmMat);
  gateArm.position.set(0, 0, 0.35);
  gatePivot.add(gateArm);

  // White stripes on gate arm
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  for (let i = 0; i < 5; i++) {
    const stripeBox = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.08), stripeMat);
    stripeBox.position.set(0, 0, 0.1 + i * 0.12);
    gatePivot.add(stripeBox);
  }

  // End cap
  const endCap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.5 }));
  endCap.position.set(0, 0, 0.7);
  gatePivot.add(endCap);

  // Red reflector
  const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: '#ff0000' }));
  reflector.position.set(0, 0, 0.74);
  gatePivot.add(reflector);

  // ANIMATE GATE OPENING - rotates UP
  if (gateOpenAmount > 0) {
    const easedOpen = gateOpenAmount < 0.5 
      ? 2 * gateOpenAmount * gateOpenAmount 
      : 1 - Math.pow(-2 * gateOpenAmount + 2, 2) / 2;
    gatePivot.rotation.x = -easedOpen * Math.PI * 0.45;
  }

  toll.add(gatePivot);

  // Payment terminal
  const terminalMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.4 });
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.06), terminalMat);
  terminal.position.set(0, groundY + 0.3, -0.38);
  toll.add(terminal);

  // Terminal screen
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.005), new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#00ff00' : '#ffff00' }));
  screen.position.set(0, groundY + 0.38, -0.345);
  toll.add(screen);

  // Lane lights
  const lightHousing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: '#222' }));
  lightHousing.position.set(0, groundY + 0.78, -0.55);
  toll.add(lightHousing);

  const greenLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#00ff00' : '#003300' }));
  greenLight.position.set(0, groundY + 0.81, -0.515);
  toll.add(greenLight);

  const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: gateOpenAmount > 0.5 ? '#330000' : '#ff0000' }));
  redLight.position.set(0, groundY + 0.75, -0.515);
  toll.add(redLight);

  // Speed bumps
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
    color, metalness: 0.7, roughness: 0.3,
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
  plateCanvas.width = 96; plateCanvas.height = 36;
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

  const plateMat = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.25, metalness: 0.1, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.2 : 0 });
  plate.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.38), plateMat));

  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.025, 0.4), new THREE.MeshStandardMaterial({ color: '#e8e8e0', roughness: 0.3, metalness: 0.15 }));
  rim.position.y = 0.01;
  plate.add(rim);

  const riceMat = new THREE.MeshStandardMaterial({ color: '#fffef0', roughness: 0.9 });
  const rice = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.12), riceMat);
  rice.position.set(-0.12, 0.045, 0);
  plate.add(rice);

  const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.65 });
  const drumstick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.06), chickenMat);
  drumstick.position.set(0.08, 0.045, 0);
  plate.add(drumstick);

  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), chickenMat);
  thigh.position.set(0.1, 0.04, 0.08);
  plate.add(thigh);

  if (isHighlighted) {
    plate.add(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.42), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })));
  }

  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean, isPeeking?: boolean): THREE.Group {
  const box = new THREE.Group();
  const boxW = 0.48, boxH = 0.34, boxD = 0.38;

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: (isHighlighted && !isPeeking) ? '#ffff00' : '#000', emissiveIntensity: (isHighlighted && !isPeeking) ? 0.3 : 0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), bodyMat);
  box.add(body);

  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
  const flapAngle = isOpen ? -1.3 : 0;

  const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(boxW, 0.12, 0.012), flapMat);
  frontFlap.position.set(0, boxH / 2 + (isOpen ? 0.04 : 0), boxD / 2);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);

  const backFlap = new THREE.Mesh(new THREE.BoxGeometry(boxW, 0.12, 0.012), flapMat);
  backFlap.position.set(0, boxH / 2 + (isOpen ? 0.04 : 0), -boxD / 2);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  if (!isOpen) {
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574', transparent: true, opacity: 0.7, roughness: 0.3 });
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, boxD + 0.01), tapeMat);
    tape.position.y = boxH / 2 + 0.004;
    box.add(tape);
  }

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180; labelCanvas.height = 120;
  const lctx = labelCanvas.getContext('2d')!;
  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, 180, 120);
  lctx.fillStyle = '#e74c3c';
  lctx.fillRect(6, 6, 168, 28);
  lctx.fillStyle = '#fff';
  lctx.font = 'bold 16px Arial';
  lctx.textAlign = 'center';
  lctx.fillText('FRAGILE', 90, 26);
  lctx.fillStyle = '#2c3e50';
  lctx.font = 'bold 28px Arial';
  lctx.fillText(label, 90, 68);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), new THREE.MeshBasicMaterial({ map: labelTex }));
  labelMesh.position.set(0, 0, boxD / 2 + 0.001);
  box.add(labelMesh);

  if (isHighlighted && !isPeeking) {
    box.add(new THREE.Mesh(new THREE.BoxGeometry(boxW + 0.06, boxH + 0.06, boxD + 0.06), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })));
  }

  return box;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  const tileMat = new THREE.MeshStandardMaterial({ color: isHighlighted ? '#1abc9c' : '#fafafa', roughness: 0.35, emissive: isHighlighted ? '#1abc9c' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  domino.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.06), tileMat));

  const border = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.45, 0.055), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 }));
  border.position.z = -0.005;
  domino.add(border);

  const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
  line.position.z = 0.028;
  domino.add(line);

  if (isHighlighted) {
    domino.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.48, 0.04), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })));
  }

  return domino;
}

// ==================== CLIPBOARD ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  const boardMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.65, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.25 : 0 });
  clipboard.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.02), boardMat));

  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 190; paperCanvas.height = 280;
  const pctx = paperCanvas.getContext('2d')!;
  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 190, 280);
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 190, 36);
  pctx.fillStyle = '#fff';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 95, 26);

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), new THREE.MeshBasicMaterial({ map: paperTex }));
  paper.position.z = 0.012;
  clipboard.add(paper);

  if (isHighlighted) {
    clipboard.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.04), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })));
  }

  return clipboard;
}

// ==================== TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  const ticketMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: isHighlighted ? '#ffff00' : '#000', emissiveIntensity: isHighlighted ? 0.3 : 0 });
  ticket.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.012), ticketMat));

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 200; frontCanvas.height = 110;
  const fctx = frontCanvas.getContext('2d')!;
  fctx.fillStyle = 'rgba(0,0,0,0.35)';
  fctx.fillRect(0, 0, 200, 24);
  fctx.fillStyle = '#fff';
  fctx.font = 'bold 12px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('ADMIT ONE', 100, 17);
  fctx.font = 'bold 32px Arial';
  fctx.fillText(label, 100, 62);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), new THREE.MeshBasicMaterial({ map: frontTex, transparent: true }));
  frontFace.position.z = 0.007;
  ticket.add(frontFace);

  if (isHighlighted) {
    ticket.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.03), new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })));
  }

  return ticket;
}

// ==================== SCHOOL BUILDING (No teacher, stairs fixed) ====================

function createSchoolBuilding(): THREE.Group {
  const school = new THREE.Group();
  const groundY = 0;

  // Main building at LEFT
  const brickMat = new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.8 });
  const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 1.6), brickMat);
  mainBuilding.position.set(-0.5, groundY + 0.6, 0);
  school.add(mainBuilding);

  // Entrance facing RIGHT
  const entranceMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.6 });
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.5), entranceMat);
  entrance.position.set(-0.15, groundY + 0.35, 0);
  school.add(entrance);

  // Arch
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: '#daa520', roughness: 0.5 }));
  archTop.position.set(-0.15, groundY + 0.72, 0);
  school.add(archTop);

  // Doors facing RIGHT
  const doorMat = new THREE.MeshStandardMaterial({ color: '#4a2c2a', roughness: 0.6 });
  [-0.12, 0.12].forEach(offsetZ => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.18), doorMat);
    door.position.set(-0.04, groundY + 0.275, offsetZ);
    school.add(door);
  });

  // Windows
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

  // Roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.6 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.7), roofMat);
  roof.position.set(-0.5, groundY + 1.24, 0);
  school.add(roof);

  // Clock tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.3), brickMat);
  tower.position.set(-0.5, groundY + 1.38, 0);
  school.add(tower);

  // Clock face
  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 64; clockCanvas.height = 64;
  const cctx = clockCanvas.getContext('2d')!;
  cctx.fillStyle = '#f5f5f5';
  cctx.beginPath(); cctx.arc(32, 32, 28, 0, Math.PI * 2); cctx.fill();
  cctx.strokeStyle = '#333'; cctx.lineWidth = 2; cctx.stroke();
  cctx.beginPath(); cctx.moveTo(32, 32); cctx.lineTo(32, 12); cctx.stroke();
  cctx.beginPath(); cctx.moveTo(32, 32); cctx.lineTo(48, 32); cctx.stroke();
  const clockTex = new THREE.CanvasTexture(clockCanvas);
  const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: clockTex }));
  clockFace.position.set(-0.34, groundY + 1.42, 0);
  clockFace.rotation.y = Math.PI / 2;
  school.add(clockFace);

  // FIXED STAIRS - facing LEFT toward building (negative X direction)
  const stepMat = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.7 });
  // Stairs go from right to left, smallest step closest to door
  [0, 1, 2].forEach((i) => {
    const stepWidth = 0.5 - i * 0.05;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, stepWidth), stepMat);
    // Position: start from door (-0.04) and go outward (+X)
    step.position.set(-0.04 + i * 0.08, groundY + 0.02 + i * 0.04, 0);
    school.add(step);
  });

  // Pillars
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 });
  [-0.28, 0.28].forEach(z => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), pillarMat);
    pillar.position.set(-0.02, groundY + 0.35, z);
    school.add(pillar);
  });

  // School sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 70; signCanvas.height = 320;
  const schCtx = signCanvas.getContext('2d')!;
  schCtx.fillStyle = '#1a5276';
  schCtx.fillRect(0, 0, 70, 320);
  schCtx.save();
  schCtx.translate(35, 160);
  schCtx.rotate(-Math.PI / 2);
  schCtx.fillStyle = '#fff';
  schCtx.font = 'bold 24px serif';
  schCtx.textAlign = 'center';
  schCtx.fillText('DS ACADEMY', 0, 8);
  schCtx.restore();
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.8), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(-0.13, groundY + 0.82, 0);
  signMesh.rotation.y = Math.PI / 2;
  school.add(signMesh);

  // Grass
  const grassMat = new THREE.MeshStandardMaterial({ color: '#228b22', roughness: 0.9 });
  [-0.7, 0.7].forEach(z => {
    const grass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.25), grassMat);
    grass.position.set(0.2, groundY + 0.008, z);
    school.add(grass);
  });

  return school;
}

// ==================== END OF PART 2 ====================
// ==================== PART 3: Animations, buildSceneContent, Home, Visualization3D ====================

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
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.2;
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
    } else if (animPhase === 'queue-dequeue-gate-open' && isTarget) {
      // Phase 1: Gate opens, car/student stays still
    } else if (animPhase === 'queue-dequeue-drive' && isTarget) {
      // Phase 2: Car/student drives/walks through and exits to the LEFT (no shrinking!)
      obj.position.x -= 2.5 * p;  // Just move far to the left
    } else if (animPhase === 'queue-dequeue-gate-close') {
      // Phase 3: Gate closes, item already gone
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
      const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(shelfWidth, 0.75), new THREE.MeshStandardMaterial({ color: '#f0f0f0', side: THREE.DoubleSide, roughness: 0.9 }));
      backPanel.position.set(0, groundY, -0.14);
      group.add(backPanel);
    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.2;
      const floorY = groundY - 0.25;
      const scale = 0.75;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const posX = startX + i * spacing;
        if (item.appearance) {
          const chair = createChair(0);
          chair.position.set(posX * scale, floorY + 0.25, -0.05 * scale);
          chair.scale.setScalar(scale);
          group.add(chair);
          const desk = createDesk(0);
          desk.position.set(posX * scale, floorY + 0.28, 0.22 * scale);
          desk.scale.setScalar(scale);
          group.add(desk);
          const human = createHuman3D(item.appearance, item.label, isHl, true, 0);
          human.position.set(posX * scale, floorY + 0.25, -0.05 * scale);
          human.scale.setScalar(scale);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array', animProgress);
          group.add(human);
        }
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 20);
        idx.position.set(posX * scale, floorY - 0.06, 0);
        idx.scale.set(0.22, 0.11, 1);
        group.add(idx);
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.4), new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide, roughness: 0.8 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = floorY;
      group.add(floor);
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 0.9), new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 }));
      backWall.position.set(0, floorY + 0.45, -0.4);
      group.add(backWall);
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
      const desk = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.5, 0.04, 0.45), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 }));
      desk.position.y = -0.28;
      group.add(desk);
    }

  // ==================== LINKED LIST ====================
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        trainCar.scale.setScalar(0.82);
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
        group.add(trainCar);
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing + 0.35, startX + (i + 1) * spacing - 0.35, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.12;
          group.add(arrow);
        }
      });
      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.55, 0);
      headSprite.scale.set(0.32, 0.12, 1);
      group.add(headSprite);
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
      [-0.11, 0.11].forEach(z => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 1.4, 0.018, 0.025), railMat);
        rail.position.set(0, -0.1, z);
        group.add(rail);
      });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.9), new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.12;
      group.add(ground);
    } else if (environment === 'people') {
      const roomX = startX - 1.2;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#d4a373', roughness: 0.8 });
      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.9), wallMat);
      frontWall.position.set(roomX, 0.2, 0);
      group.add(frontWall);
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const walkPhase = (animPhase === 'll-traverse' && isHl) ? Math.PI * 0.5 : 0;
          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
          human.scale.setScalar(0.72);
          human.rotation.y = -Math.PI / 2;
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist', animProgress);
          group.add(human);
        }
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing + 0.3, startX + (i + 1) * spacing - 0.3, false);
          arrow.position.y = 0.08;
          group.add(arrow);
        }
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2, 0.55), new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.16;
      group.add(floor);
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
      const table = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.75, 0.035, 0.55), new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 }));
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
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack', animProgress);
        group.add(book);
        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.65, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.38, 0.14, 1);
          group.add(topSprite);
        }
      });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.035, 0.65), new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 }));
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
      const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.055, 0.5), new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4, roughness: 0.4 }));
      counter.position.y = plateBaseY - 0.05;
      group.add(counter);
    } else if (environment === 'boxes') {
      const boxSpacing = 0.4;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.18;
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const isPeeking = isTop && (animPhase === 'stack-peek-open');
        const cardboardBox = createCardboardBox(item.label, item.color, isHl, isPeeking, isPeeking);
        cardboardBox.position.set(isHl && !isPeeking ? 0.18 : 0, boxBaseY + i * boxSpacing, 0);
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
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.055, 0.6), new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 }));
      pallet.position.y = boxBaseY - 0.22;
      group.add(pallet);
    }

  // ==================== QUEUE ====================
  } else if (structure === 'queue') {
    if (environment === 'tollgate') {
      let gateOpenAmount = 0;
      if (animPhase === 'queue-dequeue-gate-open') gateOpenAmount = animProgress || 0;
      else if (animPhase === 'queue-dequeue-drive') gateOpenAmount = 1;
      else if (animPhase === 'queue-dequeue-gate-close') gateOpenAmount = 1 - (animProgress || 0);

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

      const road = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 3.0, 0.7), new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide }));
      road.rotation.x = -Math.PI / 2;
      road.position.y = groundY - 0.01;
      group.add(road);

      const exitSprite = createTextSprite('← EXIT', '#00ff00', 20);
      exitSprite.position.set(startX - 1.5, groundY + 0.28, 0);
      exitSprite.scale.set(0.32, 0.1, 1);
      group.add(exitSprite);

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

      const counter = new THREE.Mesh(new THREE.BoxGeometry(data.length * spacing + 0.55, 0.035, 0.38), new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 }));
      counter.position.y = -0.14;
      group.add(counter);

    } else if (environment === 'students') {
      const schoolBuilding = createSchoolBuilding();
      schoolBuilding.position.set(startX - 0.3, groundY, 0);
      schoolBuilding.scale.setScalar(0.5);
      group.add(schoolBuilding);

      // Students facing LEFT toward school
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const isWalking = (animPhase === 'queue-dequeue-drive') && isHl;
          const walkPhase = isWalking ? (animProgress || 0) * Math.PI * 6 : 0;
          
          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing + 0.6, groundY, 0);
          human.scale.setScalar(0.55);
          human.rotation.y = -Math.PI / 2; // Face LEFT toward school
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue', animProgress);
          group.add(human);
        }
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 16);
      frontSprite.position.set(startX + 0.6, groundY - 0.18, 0);
      frontSprite.scale.set(0.26, 0.09, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 16);
      rearSprite.position.set(startX + (data.length - 1) * spacing + 0.6, groundY - 0.18, 0);
      rearSprite.scale.set(0.26, 0.09, 1);
      group.add(rearSprite);

      const pathway = new THREE.Mesh(new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.5), new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide }));
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
