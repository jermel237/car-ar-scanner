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
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 45);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
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

// ==================== TOLL BOOTH (ARM LONGER, POST 50% LOWER) ====================

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

  // Gate POST - 50% LOWER
  const postMat = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.5, metalness: 0.3 });
  const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), postMat);
  gatePost.position.set(0, groundY + 0.15, -0.32);
  toll.add(gatePost);

  // Gate pivot - LOWERED
  const gatePivot = new THREE.Group();
  gatePivot.position.set(0, groundY + 0.28, -0.32);

  // ARM - LONGER
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

// ==================== CARDBOARD BOX (FIXED - Aligned, Not Floating) ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, openAmount: number = 0): THREE.Group {
  const box = new THREE.Group();
  const boxW = 0.48, boxH = 0.34, boxD = 0.38;
  const wallThickness = 0.015;

  const cardboardMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0
  });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#c4a574', roughness: 0.9 });
  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });

  // Box center Y offset - so bottom sits at Y=0
  const centerY = boxH / 2;

  // Bottom
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(boxW, wallThickness, boxD), cardboardMat);
  bottom.position.y = wallThickness / 2;
  box.add(bottom);

  // Walls
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH, boxD), cardboardMat);
  leftWall.position.set(-boxW / 2 + wallThickness / 2, centerY, 0);
  box.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, boxH, boxD), cardboardMat);
  rightWall.position.set(boxW / 2 - wallThickness / 2, centerY, 0);
  box.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(boxW - wallThickness * 2, boxH, wallThickness), cardboardMat);
  backWall.position.set(0, centerY, -boxD / 2 + wallThickness / 2);
  box.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(boxW - wallThickness * 2, boxH, wallThickness), cardboardMat);
  frontWall.position.set(0, centerY, boxD / 2 - wallThickness / 2);
  box.add(frontWall);

  // Inner floor
  const innerFloor = new THREE.Mesh(
    new THREE.BoxGeometry(boxW - wallThickness * 2, 0.005, boxD - wallThickness * 2),
    innerMat
  );
  innerFloor.position.y = wallThickness + 0.003;
  box.add(innerFloor);

  // Corner reinforcements
  const cornerMat = new THREE.MeshStandardMaterial({ color: '#8b6914', roughness: 0.8 });
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.03, boxH, 0.03), cornerMat);
    corner.position.set(sx * (boxW / 2 - 0.015), centerY, sz * (boxD / 2 - 0.015));
    box.add(corner);
  });

  // Easing for smooth animation
  const easedOpen = openAmount < 0.5
    ? 2 * openAmount * openAmount
    : 1 - Math.pow(-2 * openAmount + 2, 2) / 2;

  // Top of box where flaps attach
  const topY = boxH;

  // === SIDE FLAPS - These fold INWARD to cover the top ===
  // Length = half box width so they meet in the middle when closed
  const sideFlapLength = boxW / 2 - wallThickness;
  const sideFlapDepth = boxD - wallThickness * 6;

  // Angles: closed = 90° inward, open = slightly outward
  const closedAngle = Math.PI / 2;
  const openAngle = 0.25;

  // Left flap: closed = -90° (folds toward +X), open = +angle
  const leftAngle = -closedAngle + (openAngle + closedAngle) * easedOpen;
  // Right flap: closed = +90° (folds toward -X), open = -angle  
  const rightAngle = closedAngle - (openAngle + closedAngle) * easedOpen;

  // LEFT SIDE FLAP
  const leftFlapPivot = new THREE.Group();
  leftFlapPivot.position.set(-boxW / 2 + wallThickness, topY, 0);
  const leftFlap = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, sideFlapLength, sideFlapDepth),
    flapMat
  );
  leftFlap.position.set(wallThickness / 2, sideFlapLength / 2, 0);
  leftFlapPivot.add(leftFlap);
  leftFlapPivot.rotation.z = leftAngle;
  box.add(leftFlapPivot);

  // RIGHT SIDE FLAP
  const rightFlapPivot = new THREE.Group();
  rightFlapPivot.position.set(boxW / 2 - wallThickness, topY, 0);
  const rightFlap = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, sideFlapLength, sideFlapDepth),
    flapMat
  );
  rightFlap.position.set(-wallThickness / 2, sideFlapLength / 2, 0);
  rightFlapPivot.add(rightFlap);
  rightFlapPivot.rotation.z = rightAngle;
  box.add(rightFlapPivot);

  // === FRONT/BACK FLAPS - Fold on top of side flaps ===
  const fbFlapLength = boxD / 2 - wallThickness;
  const fbFlapWidth = boxW - wallThickness * 4;

  // Front flap: closed = +90° (folds backward toward -Z), open = -angle
  const frontAngle = closedAngle - (openAngle + closedAngle) * easedOpen;
  // Back flap: closed = -90° (folds forward toward +Z), open = +angle
  const backAngle = -closedAngle + (openAngle + closedAngle) * easedOpen;

  // FRONT FLAP
  const frontFlapPivot = new THREE.Group();
  frontFlapPivot.position.set(0, topY, boxD / 2 - wallThickness);
  const frontFlap = new THREE.Mesh(
    new THREE.BoxGeometry(fbFlapWidth, fbFlapLength, wallThickness),
    flapMat
  );
  frontFlap.position.set(0, fbFlapLength / 2, -wallThickness / 2);
  frontFlapPivot.add(frontFlap);
  frontFlapPivot.rotation.x = frontAngle;
  box.add(frontFlapPivot);

  // BACK FLAP
  const backFlapPivot = new THREE.Group();
  backFlapPivot.position.set(0, topY, -boxD / 2 + wallThickness);
  const backFlap = new THREE.Mesh(
    new THREE.BoxGeometry(fbFlapWidth, fbFlapLength, wallThickness),
    flapMat
  );
  backFlap.position.set(0, fbFlapLength / 2, wallThickness / 2);
  backFlapPivot.add(backFlap);
  backFlapPivot.rotation.x = backAngle;
  box.add(backFlapPivot);

  // === TAPE - Sits on top of closed flaps ===
  if (openAmount < 0.2) {
    const tapeOpacity = 1 - (openAmount / 0.2);
    const tapeMat = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      transparent: true,
      opacity: 0.8 * tapeOpacity,
      roughness: 0.3
    });

    // Tape sits on top of flaps (topY + flap thickness when closed)
    const tapeY = topY + sideFlapLength + 0.003;

    // Center tape (along depth)
    const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, boxD * 0.5), tapeMat);
    tape1.position.set(0, tapeY, 0);
    box.add(tape1);

    // Cross tape (along width)
    const tape2 = new THREE.Mesh(new THREE.BoxGeometry(boxW * 0.4, 0.006, 0.05), tapeMat);
    tape2.position.set(0, tapeY, 0);
    box.add(tape2);
  }

  // === LABEL on front ===
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 120;
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
  lctx.strokeStyle = '#e74c3c';
  lctx.lineWidth = 2;
  lctx.beginPath();
  lctx.moveTo(75, 85);
  lctx.lineTo(90, 100);
  lctx.lineTo(105, 85);
  lctx.stroke();

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.22),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, centerY, boxD / 2 + 0.001);
  box.add(labelMesh);

  // Highlight glow
  if (isHighlighted && openAmount < 0.1) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(boxW + 0.06, boxH + 0.1, boxD + 0.06),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 })
    );
    glow.position.y = centerY;
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

  const glossMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08 });
  const gloss = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.4), glossMat);
  gloss.position.z = 0.036;
  domino.add(gloss);

  if (isHighlighted) {
    domino.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.48, 0.04),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })
    ));
  }

  return domino;
}

// ==================== CLIPBOARD ====================

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
  pctx.fillText('TO-DO LIST', 95, 28);

  pctx.strokeStyle = '#ddd';
  pctx.lineWidth = 1;
  for (let y = 60; y < 260; y += 28) {
    pctx.beginPath();
    pctx.moveTo(20, y);
    pctx.lineTo(170, y);
    pctx.stroke();
  }

  const items = [
    { text: label, checked: false },
    { text: 'Review notes', checked: true },
    { text: 'Practice code', checked: false },
    { text: 'Take break', checked: true },
  ];

  pctx.font = '14px Arial';
  pctx.textAlign = 'left';
  items.forEach((item, i) => {
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
    pctx.fillText(item.text, 44, y);

    if (item.checked) {
      pctx.strokeStyle = '#999';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(44, y - 4);
      pctx.lineTo(44 + pctx.measureText(item.text).width, y - 4);
      pctx.stroke();
    }
  });

  pctx.fillStyle = '#f39c12';
  pctx.font = '12px Arial';
  pctx.fillText('★★★', 150, 55);
  pctx.fillText('★★', 150, 83);
  pctx.fillText('★', 150, 111);

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

// ==================== TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  const ticketMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0
  });
  const ticketBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.012), ticketMat);
  ticket.add(ticketBody);

  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6, roughness: 0.3 });
  [0.105, -0.105].forEach(y => {
    const borderH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.014), borderMat);
    borderH.position.y = y;
    ticket.add(borderH);
  });
  [-0.195, 0.195].forEach(x => {
    const borderV = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.014), borderMat);
    borderV.position.x = x;
    ticket.add(borderV);
  });

  const perfMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  for (let y = -0.08; y <= 0.08; y += 0.025) {
    const perf = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.014), perfMat);
    perf.position.set(-0.16, y, 0);
    ticket.add(perf);
  }

  const stubLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.003, 0.2, 0.013),
    new THREE.MeshStandardMaterial({ color: '#333333' })
  );
  stubLine.position.x = -0.13;
  ticket.add(stubLine);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 240;
  frontCanvas.height = 130;
  const fctx = frontCanvas.getContext('2d')!;

  fctx.fillStyle = 'rgba(0,0,0,0.4)';
  fctx.fillRect(0, 0, 240, 32);

  fctx.strokeStyle = '#ffd700';
  fctx.lineWidth = 2;
  fctx.beginPath();
  fctx.moveTo(10, 35);
  fctx.lineTo(230, 35);
  fctx.stroke();
  fctx.beginPath();
  fctx.moveTo(10, 95);
  fctx.lineTo(230, 95);
  fctx.stroke();

  fctx.fillStyle = '#ffffff';
  fctx.font = 'bold 14px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('★ ADMIT ONE ★', 120, 22);

  fctx.font = 'bold 38px Arial';
  fctx.fillText(label, 120, 72);

  fctx.font = '10px Arial';
  fctx.fillStyle = 'rgba(255,255,255,0.8)';
  fctx.fillText('VALID FOR ONE ENTRY', 120, 88);

  fctx.font = 'bold 10px monospace';
  fctx.fillStyle = 'rgba(255,255,255,0.6)';
  fctx.fillText('NO. ' + Math.floor(Math.random() * 90000 + 10000), 120, 120);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.2),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontFace.position.z = 0.007;
  ticket.add(frontFace);

  if (isHighlighted) {
    ticket.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.26, 0.03),
      new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 })
    ));
  }

  return ticket;
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
  const stepWidth = 0.6;

  [0.22, 0.12, 0.02].forEach((x, i) => {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, stepWidth), stepMat);
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

      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.5, 0.04, 0.45),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.28;
      group.add(desk);
    }

  // ==================== LINKED LIST (No HEAD/TAIL, reversed train, NULL at end) ====================
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      const arrowY = 0.14;

      // REVERSED: Engine at the END (right side)
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
        const arrow = create3DArrow(
          startX + i * spacing,
          startX + (i + 1) * spacing,
          arrowY,
          false
        );
        group.add(arrow);
      }

      // NULL after Engine (rightmost)
      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + (data.length - 1) * spacing + spacing * 0.7, 0.14, 0);
      nullSprite.scale.set(0.32, 0.22, 1);
      group.add(nullSprite);

      // Arrow to NULL
      if (data.length > 0) {
        const lastArrow = create3DArrow(
          startX + (data.length - 1) * spacing,
          startX + (data.length - 1) * spacing + spacing * 0.7,
          arrowY,
          false
        );
        group.add(lastArrow);
      }

      // Rails
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
          const arrow = create3DArrow(
            startX + i * spacing,
            startX + (i + 1) * spacing,
            arrowY,
            false
          );
          group.add(arrow);
        }
      });

      // NULL after last person
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0.12, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      if (data.length > 0) {
        const lastArrow = create3DArrow(
          startX + (data.length - 1) * spacing,
          startX + data.length * spacing,
          arrowY,
          false
        );
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
          const arrow = create3DArrow(
            startX + i * spacing,
            startX + (i + 1) * spacing,
            arrowY,
            false
          );
          group.add(arrow);
        }
      });

      // NULL after last domino
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      if (data.length > 0) {
        const lastArrow = create3DArrow(
          startX + (data.length - 1) * spacing,
          startX + data.length * spacing,
          arrowY,
          false
        );
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
      const boxSpacing = 0.4;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.18;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;

        // Calculate open amount for peek animation - ONLY for top box
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
        cardboardBox.position.set(isHl && openAmount === 0 ? 0.18 : 0, boxBaseY + i * boxSpacing, 0);
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

      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.055, 0.6),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.22;
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

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.55, 0.035, 0.38),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.14;
      group.add(counter);

    } else if (environment === 'students') {
      const schoolBuilding = createSchoolBuilding();
      schoolBuilding.position.set(startX - 0.3, groundY, 0);
      schoolBuilding.scale.setScalar(0.5);
      group.add(schoolBuilding);

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const isWalking = (animPhase === 'queue-dequeue-drive') && isHl;
          const walkPhase = isWalking ? (animProgress || 0) * Math.PI * 6 : 0;

          const human = createHuman3D(item.appearance, item.label, isHl, false, walkPhase);
          human.position.set(startX + i * spacing + 0.6, groundY, 0);
          human.scale.setScalar(0.55);
          human.rotation.y = -Math.PI / 2;
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
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
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
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress);
  }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId, animPhase, animData, animProgress]);

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

  // Array operations
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
    setCodeDisplay(`// O(n) Insert`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(200); }
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev]; arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' }); return arr;
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
    setOperationMessage(`Deleting [${deleteIndex}]`);
    setCodeDisplay(`// O(n) Delete`);
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
    await smoothAnimate(400, 'swap-lift', { index1: idx1, index2: idx2 });
    await smoothAnimate(350, 'swap-cross', { index1: idx1, index2: idx2 });
    (setArrayData as any)((prev: DataItem[]) => { const a = [...prev]; [a[idx1], a[idx2]] = [a[idx2], a[idx1]]; return a; });
    await smoothAnimate(400, 'swap-drop', { index1: idx1, index2: idx2 });
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setHighlightIndex2(null);
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // Linked list operations
  const linkedListInsertHead = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    setOperationMessage('Inserting at HEAD...');
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#f5c6a0', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } }
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
      await smoothAnimate(400, 'll-traverse', { index: i });
    }
    setOperationMessage(`Done! ${data.length} nodes`); await delay(700);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // Stack operations
  const stackPush = async () => {
    if (isAnimating || getStackData().length >= 5) return; setIsAnimating(true);
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art'] : stackEnv === 'plates' ? [`Plate ${data.length + 1}`] : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c'] : ['#7f8c8d'];
    const newItem = { id: Date.now(), label: labels[Math.floor(Math.random() * labels.length)], color: colors[Math.floor(Math.random() * colors.length)] };
    setOperationMessage(`Pushing "${newItem.label}"...`);
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
    setOperationMessage(`Peeking TOP...`);
    setCodeDisplay(`// O(1)\nstack.peek()`);
    await smoothAnimate(600, 'stack-peek-lift', { index: data.length - 1 });
    setOperationMessage(`TOP: "${topItem.label}"`);
    await smoothAnimate(1500, 'stack-peek-open', { index: data.length - 1 });
    await delay(800);
    await smoothAnimate(600, 'stack-peek-settle', { index: data.length - 1 });
    setAnimPhase(''); setAnimData({});
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // Queue operations
  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return; setIsAnimating(true);
    const data = getQueueData();
    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#f5c6a0', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#3d2314', hairStyle: 'short', gender: 'male' } }
      : queueEnv === 'tollgate'
        ? { id: Date.now(), label: `NEW-${Math.floor(Math.random() * 900) + 100}`, color: '#1abc9c' }
        : { id: Date.now(), label: `T-00${data.length + 1}`, color: '#1abc9c' };
    setOperationMessage(`Enqueue: "${newItem.label}"...`);
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
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue()`);

    setOperationMessage('Gate opening...');
    await smoothAnimate(1000, 'queue-dequeue-gate-open', { index: 0 });

    setOperationMessage(`${frontItem.label} passing through...`);
    await smoothAnimate(1200, 'queue-dequeue-drive', { index: 0 });

    (setQueueData as any)((prev: DataItem[]) => prev.slice(1));

    setOperationMessage('Gate closing...');
    await smoothAnimate(800, 'queue-dequeue-gate-close', { index: -1 });

    await delay(200);
    setAnimPhase(''); setAnimData({});
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    await smoothAnimate(1000, 'queue-front-peek', { index: 0 });
    setAnimPhase(''); setAnimData({});
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

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
          isSurfaceMode={appMode === 'surface'} animPhase={animPhase} animData={animData} animProgress={animProgress} />
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        {!webxrActive && <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 50, height: 50, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200 }}>🔄</button>}

        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)', zIndex: 200 }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5 }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5 }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'webxr' ? '#e17055' : 'transparent', color: 'white', opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25 }}>🌐 AR{!webxrSupported && ' ✗'}</button>
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
      padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25,
      background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{label}</button>
  );
}

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
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress);
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData, animProgress]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto', overflow: 'visible' }} />;
}
