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
type AppMode = 'person' | 'surface' | 'webxr'; // ← NEW: added webxr

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

// ==================== STANDALONE 3D MODEL CREATORS ====================
// Extracted so both Visualization3D AND WebXR can reuse them

function createTextSprite(text: string, color: string, fontSize: number = 20): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
}

function createArrow(fromX: number, toX: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;
  const points = [new THREE.Vector3(fromX + 0.35, 0, 0), new THREE.Vector3(toX - 0.35, 0, 0)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  arrow.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color })));
  const coneGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color }));
  cone.position.set(toX - 0.4, 0, 0);
  cone.rotation.z = -Math.PI / 2;
  arrow.add(cone);
  return arrow;
}

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.22), woodMat);
  seat.position.y = -0.18; chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.02), woodMat);
  back.position.set(0, -0.08, -0.1); chair.add(back);
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
  [[-0.08, -0.25, 0.08], [0.08, -0.25, 0.08], [-0.08, -0.25, -0.08], [0.08, -0.25, -0.08]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });
  chair.position.x = x;
  return chair;
}

// ==================== GROCERY BOX ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const box = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.45, 0.55, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.8,
    emissive: isHighlighted ? '#ffff00' : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0
  });
  box.add(new THREE.Mesh(bodyGeo, bodyMat));

  const flapGeo = new THREE.BoxGeometry(0.22, 0.02, 0.32);
  const flapMat = new THREE.MeshStandardMaterial({ color });
  const leftFlap = new THREE.Mesh(flapGeo, flapMat);
  leftFlap.position.set(-0.12, 0.28, 0);
  leftFlap.rotation.z = -0.4;
  box.add(leftFlap);
  const rightFlap = new THREE.Mesh(flapGeo, flapMat);
  rightFlap.position.set(0.12, 0.28, 0);
  rightFlap.rotation.z = 0.4;
  box.add(rightFlap);

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(5, 5, 118, 70);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, 118, 70);
  ctx.fillStyle = '#000'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
  ctx.fillText(label, 64, 50);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.22),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
  );
  labelMesh.position.z = 0.165;
  box.add(labelMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.5, 0.6, 0.37);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }
  return box;
}


function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  // ===== HEAD =====
  const headGroup = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(0.09, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.3
  });
  headGroup.add(new THREE.Mesh(headGeo, headMat));

  // ===== HAIR =====
  if (appearance.hairStyle !== 'bald') {
    const hairGeo = appearance.hairStyle === 'long'
      ? new THREE.SphereGeometry(0.095, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55)
      : new THREE.SphereGeometry(0.093, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.015;
    headGroup.add(hair);
    if (appearance.hairStyle === 'long') {
      const backHairGeo = new THREE.CapsuleGeometry(0.035, 0.1, 8, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, -0.07, -0.04);
      headGroup.add(backHair);
    }
  }

  // ===== EYES =====
  const eyeGeo = new THREE.SphereGeometry(0.012, 16, 16);
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#fff' });
  const pupilGeo = new THREE.SphereGeometry(0.006, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
  [-0.028, 0.028].forEach(x => {
    const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(x, 0.01, 0.075);
    eye.scale.z = 0.5;
    headGroup.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x, 0.01, 0.085);
    headGroup.add(pupil);
  });

  // ===== EYEBROWS =====
  const browGeo = new THREE.BoxGeometry(0.025, 0.005, 0.005);
  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor });
  [-0.028, 0.028].forEach((x, i) => {
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.035, 0.075);
    brow.rotation.z = i === 0 ? -0.1 : 0.1;
    headGroup.add(brow);
  });

  // ===== NOSE =====
  const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
  const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.005, 0.085);
  nose.rotation.x = Math.PI;
  headGroup.add(nose);

  // ===== SMILE =====
  const smileGeo = new THREE.TorusGeometry(0.018, 0.003, 8, 16, Math.PI);
  const smileMat = new THREE.MeshStandardMaterial({ color: '#c0392b' });
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.position.set(0, -0.035, 0.075);
  smile.rotation.x = Math.PI;
  headGroup.add(smile);

  // ===== EARS =====
  const earGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
  [-0.085, 0.085].forEach(x => {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(x, 0, 0);
    ear.scale.set(0.5, 0.8, 0.6);
    headGroup.add(ear);
  });

  headGroup.position.y = 0.32;
  human.add(headGroup);

  // ===== NECK =====
  const neckGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.04, 16);
  const neckMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = 0.21;
  human.add(neck);

  // ===== TORSO =====
  const torsoGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.16, 16);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.11;
  human.add(torso);

  // ===== ARMS =====
  const armGeo = new THREE.CapsuleGeometry(0.014, 0.09, 8, 16);
  const armMat = new THREE.MeshStandardMaterial({ color: appearance.shirtColor });
  const skinArmMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone });
  [-1, 1].forEach(side => {
    const armGroup = new THREE.Group();
    armGroup.add(new THREE.Mesh(armGeo, armMat));
    const lowerArmGeo = new THREE.CapsuleGeometry(0.011, 0.06, 8, 16);
    const lowerArm = new THREE.Mesh(lowerArmGeo, skinArmMat);
    lowerArm.position.y = -0.09;
    armGroup.add(lowerArm);
    const handGeo = new THREE.SphereGeometry(0.018, 12, 12);
    const hand = new THREE.Mesh(handGeo, skinArmMat);
    hand.position.y = -0.14;
    hand.scale.set(0.7, 0.9, 0.5);
    armGroup.add(hand);
    armGroup.position.set(side * 0.085, 0.1, 0);
    armGroup.rotation.z = side * 0.2;
    human.add(armGroup);
  });

  // ===== HIPS =====
  const hipsGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.04, 16);
  const hipsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
  const hips = new THREE.Mesh(hipsGeo, hipsMat);
  hips.position.y = 0.01;
  human.add(hips);

  // ===== LEGS =====
  const legGeo = new THREE.CapsuleGeometry(0.02, 0.1, 8, 16);
  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor });
  [-0.028, 0.028].forEach(x => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.07, 0);
    human.add(leg);
  });

  // ===== SHOES =====
  const shoeGeo = new THREE.BoxGeometry(0.032, 0.015, 0.045);
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  [-0.028, 0.028].forEach(x => {
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(x, -0.135, 0.008);
    human.add(shoe);
  });

  // ===== NAME LABEL =====
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128; labelCanvas.height = 32;
  const lctx = labelCanvas.getContext('2d')!;
  lctx.fillStyle = isHighlighted ? '#ffff00' : 'rgba(0,0,0,0.8)';
  lctx.beginPath();
  lctx.roundRect(0, 0, 128, 32, 8);
  lctx.fill();
  lctx.fillStyle = isHighlighted ? '#000' : '#fff';
  lctx.font = 'bold 18px Arial';
  lctx.textAlign = 'center';
  lctx.fillText(name, 64, 22);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTex, transparent: true })
  );
  labelSprite.position.y = 0.48;
  labelSprite.scale.set(0.32, 0.08, 1);
  human.add(labelSprite);

  // ===== HIGHLIGHT RING =====
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.07, 0.12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.14;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);
  }

  return human;
}


function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  // Wooden board
  const boardGeo = new THREE.BoxGeometry(0.38, 0.5, 0.025);
  const boardMat = new THREE.MeshStandardMaterial({
    color: '#8b4513', roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0
  });
  clipboard.add(new THREE.Mesh(boardGeo, boardMat));

  // Metal clip at top
  const clipGeo = new THREE.BoxGeometry(0.12, 0.05, 0.04);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.8 });
  const clip = new THREE.Mesh(clipGeo, clipMat);
  clip.position.set(0, 0.27, 0.025);
  clipboard.add(clip);

  // Paper with task details
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 128; paperCanvas.height = 180;
  const pctx = paperCanvas.getContext('2d')!;
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, 128, 180);
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 128, 30);
  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 64, 22);
  pctx.strokeStyle = '#e0e0e0';
  pctx.lineWidth = 1;
  for (let y = 50; y < 170; y += 18) {
    pctx.beginPath();
    pctx.moveTo(10, y);
    pctx.lineTo(118, y);
    pctx.stroke();
  }
  // Checkbox
  pctx.strokeStyle = '#333';
  pctx.lineWidth = 2;
  pctx.strokeRect(12, 55, 14, 14);
  // Checkmark if highlighted
  if (isHighlighted) {
    pctx.strokeStyle = '#2ecc71';
    pctx.lineWidth = 3;
    pctx.beginPath();
    pctx.moveTo(14, 62);
    pctx.lineTo(19, 67);
    pctx.lineTo(26, 57);
    pctx.stroke();
  }
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.45),
    new THREE.MeshBasicMaterial({ map: paperTex })
  );
  paper.position.z = 0.015;
  clipboard.add(paper);

  return clipboard;
}

// ==================== TRAIN CAR (Train environment) ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  // Main body
  const bodyGeo = new THREE.BoxGeometry(0.65, 0.32, 0.28);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, metalness: 0.3, roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.4 : 0
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.1;
  train.add(body);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.6, 0.05, 0.26);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
  roof.position.y = 0.285;
  train.add(roof);

  // Undercarriage
  const underGeo = new THREE.BoxGeometry(0.6, 0.04, 0.22);
  const under = new THREE.Mesh(underGeo, new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
  under.position.y = -0.08;
  train.add(under);

  // Wheels with hubs
  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
  const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12);
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
  const wheelPositions: [number, number, number][] = [
    [-0.2, -0.06, 0.14], [0.2, -0.06, 0.14],
    [-0.2, -0.06, -0.14], [0.2, -0.06, -0.14]
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, y, z);
    train.add(wheel);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, y, z);
    train.add(hub);
  });

  // Windows (only for non-engine cars)
  if (!isEngine) {
    const windowGeo = new THREE.PlaneGeometry(0.08, 0.07);
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#87ceeb', side: THREE.DoubleSide, metalness: 0.3
    });
    [-0.18, 0, 0.18].forEach(x => {
      const wF = new THREE.Mesh(windowGeo, windowMat);
      wF.position.set(x, 0.15, 0.141);
      train.add(wF);
      const wB = new THREE.Mesh(windowGeo, windowMat);
      wB.position.set(x, 0.15, -0.141);
      train.add(wB);
    });
  }

  // Engine-specific parts
  if (isEngine) {
    // Boiler
    const boilerGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.22, 20);
    const boiler = new THREE.Mesh(boilerGeo, new THREE.MeshStandardMaterial({
      color: '#c0392b', metalness: 0.4
    }));
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.44, 0.1, 0);
    train.add(boiler);

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12);
    const chimney = new THREE.Mesh(chimneyGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
    chimney.position.set(0.15, 0.38, 0);
    train.add(chimney);

    // Smoke puffs
    const smokeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: '#bdc3c7', transparent: true, opacity: 0.5
    });
    [0.48, 0.55, 0.63].forEach((y, i) => {
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.15, y, 0);
      smoke.scale.setScalar(1 + i * 0.25);
      train.add(smoke);
    });

    // Cow catcher
    const catcherGeo = new THREE.BoxGeometry(0.04, 0.08, 0.22);
    const catcher = new THREE.Mesh(catcherGeo, new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
    catcher.position.set(0.55, -0.02, 0);
    train.add(catcher);
  }

  // Coupling hooks on both sides
  const hookGeo = new THREE.BoxGeometry(0.03, 0.02, 0.02);
  const hookMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.7 });
  [-0.34, 0.34].forEach(x => {
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(x, 0, 0);
    train.add(hook);
  });

  // Floating label
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isHighlighted ? '#ffff00' : '#fff';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, 64, 24);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTex, transparent: true })
  );
  labelSprite.position.y = 0.45;
  labelSprite.scale.set(0.4, 0.1, 1);
  train.add(labelSprite);

  return train;
}

// ==================== DOMINO (Domino environment) ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  // Main tile
  const tileGeo = new THREE.BoxGeometry(0.22, 0.45, 0.06);
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#ecf0f1',
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0
  });
  domino.add(new THREE.Mesh(tileGeo, tileMat));

  // Center dividing line
  const lineGeo = new THREE.BoxGeometry(0.18, 0.008, 0.01);
  const line = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
  line.position.z = 0.031;
  domino.add(line);

  // Border backing
  const borderGeo = new THREE.BoxGeometry(0.23, 0.46, 0.02);
  const border = new THREE.Mesh(borderGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
  border.position.z = -0.025;
  domino.add(border);

  // Dots based on value
  const dotGeo = new THREE.CircleGeometry(0.018, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#2c3e50', side: THREE.DoubleSide });
  const val = parseInt(value) || 1;

  // Top half dots
  const topDots: [number, number][] = [];
  if (val >= 1) topDots.push([0, 0.14]);
  if (val >= 2) topDots.push([-0.05, 0.2]);
  if (val >= 3) topDots.push([0.05, 0.08]);
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, 0.032);
    domino.add(dot);
  });

  // Bottom half dots (mirrored)
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-x, -y, 0.032);
    domino.add(dot);
  });

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.26, 0.49, 0.02);
    const glowMat = new THREE.MeshBasicMaterial({
      color: '#ffff00', transparent: true, opacity: 0.3
    });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== BOOK (Books stack environment) ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  // Cover
  const coverGeo = new THREE.BoxGeometry(0.55, 0.07, 0.38);
  const coverMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.35 : 0
  });
  book.add(new THREE.Mesh(coverGeo, coverMat));

  // Pages inside
  const pagesGeo = new THREE.BoxGeometry(0.52, 0.055, 0.35);
  const pages = new THREE.Mesh(pagesGeo, new THREE.MeshStandardMaterial({ color: '#f5f5dc' }));
  pages.position.x = 0.01;
  book.add(pages);

  // Spine
  const spineGeo = new THREE.BoxGeometry(0.02, 0.07, 0.38);
  const spine = new THREE.Mesh(spineGeo, new THREE.MeshStandardMaterial({ color: '#5d4037' }));
  spine.position.x = -0.285;
  book.add(spine);

  // Spine text (rotated)
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 32; spineCanvas.height = 128;
  const sctx = spineCanvas.getContext('2d')!;
  sctx.fillStyle = '#ffd700';
  sctx.save();
  sctx.translate(16, 64);
  sctx.rotate(-Math.PI / 2);
  sctx.font = 'bold 18px serif';
  sctx.textAlign = 'center';
  sctx.fillText(label, 0, 6);
  sctx.restore();
  const spineTex = new THREE.CanvasTexture(spineCanvas);
  const spineLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 0.32),
    new THREE.MeshBasicMaterial({ map: spineTex, transparent: true })
  );
  spineLabel.position.set(-0.296, 0, 0);
  spineLabel.rotation.y = -Math.PI / 2;
  book.add(spineLabel);

  // Cover title text
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 128; coverCanvas.height = 128;
  const cctx = coverCanvas.getContext('2d')!;
  cctx.fillStyle = '#ffd700';
  cctx.font = 'bold 24px serif';
  cctx.textAlign = 'center';
  cctx.fillText(label, 64, 70);
  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.25),
    new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
  );
  coverLabel.position.y = 0.036;
  coverLabel.rotation.x = -Math.PI / 2;
  book.add(coverLabel);

  return book;
}


function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  // Main plate disc
  const plateGeo = new THREE.CylinderGeometry(0.28, 0.26, 0.025, 32);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#ecf0f1', roughness: 0.3, metalness: 0.1,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0
  });
  plate.add(new THREE.Mesh(plateGeo, plateMat));

  // Outer rim ring
  const rimGeo = new THREE.TorusGeometry(0.27, 0.012, 16, 32);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: '#bdc3c7' }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  plate.add(rim);

  // Decorative inner ring (blue band)
  const innerRingGeo = new THREE.RingGeometry(0.12, 0.16, 32);
  const innerRing = new THREE.Mesh(innerRingGeo, new THREE.MeshStandardMaterial({
    color: '#3498db', side: THREE.DoubleSide
  }));
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.014;
  plate.add(innerRing);

  // Center decoration (red circle)
  const centerGeo = new THREE.CircleGeometry(0.06, 32);
  const center = new THREE.Mesh(centerGeo, new THREE.MeshStandardMaterial({
    color: '#e74c3c', side: THREE.DoubleSide
  }));
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.015;
  plate.add(center);

  return plate;
}

// ==================== CARDBOARD BOX (Boxes stack environment) ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const box = new THREE.Group();

  // Main body
  const bodyGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.9,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.35 : 0
  });
  box.add(new THREE.Mesh(bodyGeo, bodyMat));

  // Packing tape on top
  const tapeGeo = new THREE.BoxGeometry(0.08, 0.01, 0.42);
  const tape = new THREE.Mesh(tapeGeo, new THREE.MeshStandardMaterial({ color: '#d4a574' }));
  tape.position.y = 0.18;
  box.add(tape);

  // Corner edges (darker brown)
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#8b4513' });
  const vEdgeGeo = new THREE.BoxGeometry(0.01, 0.35, 0.01);
  const edgePositions: [number, number, number][] = [
    [-0.245, 0, 0.195], [0.245, 0, 0.195],
    [-0.245, 0, -0.195], [0.245, 0, -0.195]
  ];
  edgePositions.forEach(([x, y, z]) => {
    const edge = new THREE.Mesh(vEdgeGeo, edgeMat);
    edge.position.set(x, y, z);
    box.add(edge);
  });

  // Front label with FRAGILE warning
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  // White label background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 124, 76);
  // Red FRAGILE banner
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(5, 5, 118, 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FRAGILE', 64, 20);
  // Box name
  ctx.fillStyle = '#000';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(label, 64, 55);
  const labelTex = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.22),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.z = 0.201;
  box.add(labelMesh);

  return box;
}

// ==================== CAR (Tollgate queue environment) ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();

  // Lower body
  const bodyGeo = new THREE.BoxGeometry(0.55, 0.18, 0.28);
  const bodyMat = new THREE.MeshStandardMaterial({
    color, metalness: 0.6, roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.35 : 0
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.08;
  car.add(body);

  // Cabin (upper body)
  const cabinGeo = new THREE.BoxGeometry(0.3, 0.12, 0.24);
  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.position.set(-0.05, 0.22, 0);
  car.add(cabin);

  // Windshield (front)
  const windshieldGeo = new THREE.PlaneGeometry(0.24, 0.1);
  const windshieldMat = new THREE.MeshStandardMaterial({
    color: '#87ceeb', metalness: 0.3, side: THREE.DoubleSide
  });
  const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
  windshield.position.set(0.1, 0.22, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.z = 0.2;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(windshieldGeo, windshieldMat);
  rearWindow.position.set(-0.2, 0.22, 0);
  rearWindow.rotation.y = Math.PI / 2;
  rearWindow.rotation.z = -0.2;
  car.add(rearWindow);

  // Side windows
  const sideWindowGeo = new THREE.PlaneGeometry(0.18, 0.08);
  [-1, 1].forEach(side => {
    const sw = new THREE.Mesh(sideWindowGeo, windshieldMat);
    sw.position.set(-0.05, 0.22, side * 0.121);
    car.add(sw);
  });

  // Wheels with chrome hubs
  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12);
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
  const wheelPositions: [number, number, number][] = [
    [-0.18, -0.02, 0.14], [0.18, -0.02, 0.14],
    [-0.18, -0.02, -0.14], [0.18, -0.02, -0.14]
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, y, z);
    car.add(w);
    const h = new THREE.Mesh(hubGeo, hubMat);
    h.rotation.x = Math.PI / 2;
    h.position.set(x, y, z);
    car.add(h);
  });

  // Headlights (front, yellow)
  const lightGeo = new THREE.CircleGeometry(0.025, 16);
  [-0.08, 0.08].forEach(z => {
    const hl = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ffffcc' }));
    hl.position.set(0.276, 0.08, z);
    hl.rotation.y = Math.PI / 2;
    car.add(hl);
    // Tail lights (rear, red)
    const tl = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ff0000' }));
    tl.position.set(-0.276, 0.08, z);
    tl.rotation.y = -Math.PI / 2;
    car.add(tl);
  });

  // License plate on rear
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 64; plateCanvas.height = 24;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 64, 24);
  pctx.fillStyle = '#000';
  pctx.font = 'bold 12px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 32, 17);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.04),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  plateMesh.position.set(-0.276, 0.02, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  return car;
}

// ==================== TICKET (Tickets queue environment) ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  // Main ticket body
  const ticketGeo = new THREE.BoxGeometry(0.4, 0.22, 0.01);
  const ticketMat = new THREE.MeshStandardMaterial({
    color,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.35 : 0
  });
  ticket.add(new THREE.Mesh(ticketGeo, ticketMat));

  // Tear-off stub
  const stubGeo = new THREE.BoxGeometry(0.1, 0.22, 0.01);
  const stub = new THREE.Mesh(stubGeo, new THREE.MeshStandardMaterial({ color }));
  stub.position.x = 0.25;
  ticket.add(stub);

  // Perforation dots (tear line)
  const dotGeo = new THREE.CircleGeometry(0.005, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let y = -0.1; y <= 0.1; y += 0.02) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0.195, y, 0.006);
    ticket.add(dot);
  }

  // Ticket face with design
  const canvas = document.createElement('canvas');
  canvas.width = 180; canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  // Striped background
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 180; i += 10) {
    ctx.fillRect(i, 0, 5, 100);
  }
  // "ADMIT ONE" header
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ADMIT ONE', 70, 25);
  // Ticket number (large)
  ctx.font = 'bold 28px Arial';
  ctx.fillText(label, 70, 60);
  // VIP stars
  ctx.font = '12px Arial';
  ctx.fillText('⭐ VIP ⭐', 70, 85);
  // Stub side text (rotated)
  ctx.font = 'bold 14px Arial';
  ctx.save();
  ctx.translate(155, 50);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(label, 0, 0);
  ctx.restore();
  const ticketTex = new THREE.CanvasTexture(canvas);
  const ticketLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.2),
    new THREE.MeshBasicMaterial({ map: ticketTex, transparent: true })
  );
  ticketLabel.position.z = 0.006;
  ticket.add(ticketLabel);

  return ticket;
}

function buildSceneContent(
  group: THREE.Group,
  data: DataItem[],
  highlightIndex: number | null,
  highlightIndex2: number | null,
  structure: DataStructure,
  environment: string
): void {
  // Clear existing children
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  const spacing = structure === 'linkedlist' ? 1.1
    : structure === 'queue' ? 0.9
    : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;

  // ========================================================
  // ==================== ARRAY =============================
  // ========================================================
  if (structure === 'array') {

    // ---------- GROCERY SHELF ----------
    if (environment === 'grocery') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const box = createGroceryBox(item.color, item.label, isHl);
        box.position.set(startX + i * spacing, isHl ? 0.15 : 0, 0);
        group.add(box);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.45, 0);
        idx.scale.set(0.3, 0.15, 1);
        group.add(idx);
      });

      // Wooden shelf
      const shelfGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.5);
      const shelfMat = new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.8 });
      const shelf = new THREE.Mesh(shelfGeo, shelfMat);
      shelf.position.y = -0.32;
      group.add(shelf);

      // Shelf supports
      const supportGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
      [-data.length * spacing / 2 - 0.2, data.length * spacing / 2 + 0.2].forEach(x => {
        const support = new THREE.Mesh(supportGeo, shelfMat);
        support.position.set(x, -0.55, 0);
        group.add(support);
      });

    // ---------- CLASSROOM SEATS ----------
    } else if (environment === 'classroom') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.8);
          group.add(human);
          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.8);
          group.add(chair);
        }
        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.38, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      // Classroom floor
      const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.8);
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
        color: '#7f8c8d', side: THREE.DoubleSide
      }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.32;
      group.add(floor);

    // ---------- TODO TASKS ----------
    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0);
        clipboard.scale.setScalar(0.75);
        group.add(clipboard);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.45, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      // Desk surface
      const deskGeo = new THREE.BoxGeometry(data.length * spacing + 0.5, 0.03, 0.4);
      const desk = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({ color: '#5d4037' }));
      desk.position.y = -0.28;
      group.add(desk);
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
        trainCar.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0);
        trainCar.scale.setScalar(0.85);
        group.add(trainCar);

        // Arrow to next node
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = -0.15;
          group.add(arrow);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.55, 0);
      headSprite.scale.set(0.35, 0.14, 1);
      group.add(headSprite);

      // TAIL label
      const tailSprite = createTextSprite('TAIL', '#0066ff', 20);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.55, 0);
      tailSprite.scale.set(0.35, 0.14, 1);
      group.add(tailSprite);

      // NULL terminator
      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.35, 0.25, 1);
      group.add(nullSprite);

      // Arrow to NULL
      const nullArrow = createArrow(
        startX + (data.length - 1) * spacing,
        startX + data.length * spacing - 0.15,
        false
      );
      nullArrow.position.y = -0.15;
      group.add(nullArrow);

      // Railroad rails
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
      [-0.12, 0.12].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.12, z);
        group.add(rail);
      });

      // Railroad ties
      const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      for (let x = startX - 0.5; x <= startX + data.length * spacing + 0.5; x += 0.2) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(x, -0.13, 0);
        group.add(tie);
      }

    // ---------- PEOPLE LINE ----------
    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.75);
          group.add(human);
        }
        // Arrow to next person
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = 0.1;
          group.add(arrow);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 18);
      headSprite.position.set(startX, 0.55, 0);
      headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);

      // NULL terminator
      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, 0.1, 0);
      nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);

      // Arrow to NULL
      const nullArrow = createArrow(
        startX + (data.length - 1) * spacing,
        startX + data.length * spacing - 0.1,
        false
      );
      nullArrow.position.y = 0.1;
      group.add(nullArrow);

      // Floor
      const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1, 0.5);
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
        color: '#95a5a6', side: THREE.DoubleSide
      }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.17;
      group.add(floor);

    // ---------- DOMINO ----------
    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        domino.scale.setScalar(0.9);
        group.add(domino);

        // Arrow to next domino
        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = -0.35;
          group.add(arrow);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 18);
      headSprite.position.set(startX, 0.4, 0);
      headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);

      // NULL terminator
      const nullSprite = createTextSprite('NULL', '#ff0000', 18);
      nullSprite.position.set(startX + data.length * spacing, -0.35, 0);
      nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);

      // Arrow to NULL
      const nullArrow = createArrow(
        startX + (data.length - 1) * spacing,
        startX + data.length * spacing - 0.1,
        false
      );
      nullArrow.position.y = -0.35;
      group.add(nullArrow);

      // Green felt table
      const tableGeo = new THREE.BoxGeometry(data.length * spacing + 0.8, 0.03, 0.5);
      const table = new THREE.Mesh(tableGeo, new THREE.MeshStandardMaterial({ color: '#27ae60' }));
      table.position.y = -0.28;
      group.add(table);
    }

  // ========================================================
  // ==================== STACK =============================
  // ========================================================
  } else if (structure === 'stack') {

    // ---------- BOOKS ----------
    if (environment === 'books') {
      const stackSpacing = 0.12;
      const baseY = -data.length * stackSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const book = createBook(item.label, item.color, isHl);
        book.position.set(isHl ? 0.2 : 0, baseY + i * stackSpacing, 0);
        book.rotation.y = (i % 2 === 0) ? 0 : 0.05;
        group.add(book);

        // TOP label on topmost book
        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.6, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.4, 0.15, 1);
          group.add(topSprite);
        }
      });

      // Desk under books
      const deskGeo = new THREE.BoxGeometry(1.2, 0.04, 0.6);
      const desk = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({ color: '#5d4037' }));
      desk.position.y = baseY - 0.08;
      group.add(desk);

    // ---------- PLATES ----------
    } else if (environment === 'plates') {
      const plateSpacing = 0.045;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plate = createPlate(item.label, isHl);
        plate.position.set(isHl ? 0.15 : 0, plateBaseY + i * plateSpacing, 0);
        plate.scale.setScalar(0.7);
        group.add(plate);

        // TOP label on topmost plate
        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.45, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.35, 0.12, 1);
          group.add(topSprite);
        }
      });

      // Counter surface
      const counterGeo = new THREE.BoxGeometry(0.9, 0.05, 0.5);
      const counter = new THREE.Mesh(counterGeo, new THREE.MeshStandardMaterial({
        color: '#7f8c8d', metalness: 0.3
      }));
      counter.position.y = plateBaseY - 0.06;
      group.add(counter);

    // ---------- BOXES ----------
    } else if (environment === 'boxes') {
      const boxSpacing = 0.42;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const box = createCardboardBox(item.label, item.color, isHl);
        box.position.set(isHl ? 0.2 : 0, boxBaseY + i * boxSpacing, 0);
        box.rotation.y = (i % 2 === 0) ? 0 : 0.08;
        box.scale.setScalar(0.85);
        group.add(box);

        // TOP label on topmost box
        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 22);
          topSprite.position.set(0.55, boxBaseY + i * boxSpacing, 0);
          topSprite.scale.set(0.35, 0.12, 1);
          group.add(topSprite);
        }
      });

      // Pallet under boxes
      const palletGeo = new THREE.BoxGeometry(0.8, 0.06, 0.6);
      const pallet = new THREE.Mesh(palletGeo, new THREE.MeshStandardMaterial({ color: '#a0522d' }));
      pallet.position.y = boxBaseY - 0.22;
      group.add(pallet);
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
        car.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        car.scale.setScalar(0.85);
        group.add(car);
      });

      // FRONT label
      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.25, 0);
      frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);

      // REAR label
      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0);
      rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      // Toll gate structure
      const gateX = startX - 0.7;
      const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12);
      const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#f1c40f' }));
      pole.position.set(gateX, 0.2, 0.25);
      group.add(pole);

      // Barrier arm
      const barrierGeo = new THREE.BoxGeometry(0.5, 0.04, 0.04);
      const barrier = new THREE.Mesh(barrierGeo, new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
      barrier.position.set(gateX - 0.25, 0.45, 0.25);
      barrier.rotation.z = 0.3;
      group.add(barrier);

      // Road surface
      const roadGeo = new THREE.PlaneGeometry(data.length * spacing + 2, 0.6);
      const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({
        color: '#34495e', side: THREE.DoubleSide
      }));
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.08;
      group.add(road);

      // Road dashed lines
      const dashLineGeo = new THREE.PlaneGeometry(0.15, 0.03);
      const dashLineMat = new THREE.MeshStandardMaterial({
        color: '#ffffff', side: THREE.DoubleSide
      });
      for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.5; x += 0.3) {
        const dashLine = new THREE.Mesh(dashLineGeo, dashLineMat);
        dashLine.rotation.x = -Math.PI / 2;
        dashLine.position.set(x, -0.075, 0);
        group.add(dashLine);
      }

      // Exit arrow
      const exitSprite = createTextSprite('→', '#00ff00', 36);
      exitSprite.position.set(gateX - 0.5, 0, 0);
      exitSprite.scale.set(0.4, 0.25, 1);
      group.add(exitSprite);

    // ---------- TICKETS ----------
    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticket = createTicket(item.label, item.color, isHl);
        ticket.position.set(startX + i * spacing, isHl ? 0.1 : 0, 0);
        ticket.scale.setScalar(0.85);
        group.add(ticket);
      });

      // FRONT label
      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.25, 0);
      frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);

      // REAR label
      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.25, 0);
      rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      // Counter surface
      const counterGeo = new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4);
      const counter = new THREE.Mesh(counterGeo, new THREE.MeshStandardMaterial({ color: '#2c3e50' }));
      counter.position.y = -0.15;
      group.add(counter);

    // ---------- STUDENTS ----------
    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.7);
          group.add(human);
        }
      });

      // FRONT label
      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.22, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      // REAR label
      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // Door
      const doorGeo = new THREE.BoxGeometry(0.04, 0.5, 0.3);
      const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: '#8b4513' }));
      door.position.set(startX - 0.7, 0.1, 0);
      group.add(door);

      // Door frame
      const doorFrameGeo = new THREE.BoxGeometry(0.06, 0.55, 0.35);
      const doorFrame = new THREE.Mesh(doorFrameGeo, new THREE.MeshStandardMaterial({ color: '#5d4037' }));
      doorFrame.position.set(startX - 0.72, 0.1, 0);
      group.add(doorFrame);

      // Floor
      const floorGeo = new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.5);
      const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
        color: '#bdc3c7', side: THREE.DoubleSide
      }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.15;
      group.add(floor);
    }
  }
}



export default function Home() {
  // ==================== REFS ====================
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ==================== CORE STATE ====================
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Starting...');
  const [model, setModel] = useState<any>(null);
  const [detectedPerson, setDetectedPerson] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [personPosition, setPersonPosition] = useState<Position | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // ==================== STRUCTURE & ENVIRONMENT ====================
  const [currentStructure, setCurrentStructure] = useState<DataStructure>('array');
  const [arrayEnv, setArrayEnv] = useState<ArrayEnvironment>('grocery');
  const [linkedListEnv, setLinkedListEnv] = useState<LinkedListEnvironment>('train');
  const [stackEnv, setStackEnv] = useState<StackEnvironment>('books');
  const [queueEnv, setQueueEnv] = useState<QueueEnvironment>('tollgate');

  // ==================== ANIMATION STATE ====================
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [highlightIndex2, setHighlightIndex2] = useState<number | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [codeDisplay, setCodeDisplay] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // ==================== MODE STATE ====================
  const [appMode, setAppMode] = useState<AppMode>('person');
  const [surfacePosition, setSurfacePosition] = useState<Position | null>(null);
  const [surfacePlaced, setSurfacePlaced] = useState(false);
  const [isDraggingSurface, setIsDraggingSurface] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ==================== NEW: WEBXR STATE ====================
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

  // ==================== ALL DATA ARRAYS ====================

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

  // ==================== HELPER FUNCTIONS ====================

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

  // ==================== COMPUTED VALUES ====================

  const currentEnvId = currentStructure === 'array' ? arrayEnv
    : currentStructure === 'linkedlist' ? linkedListEnv
    : currentStructure === 'stack' ? stackEnv
    : queueEnv;

  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv
    : currentStructure === 'linkedlist' ? setLinkedListEnv
    : currentStructure === 'stack' ? setStackEnv
    : setQueueEnv;

  const currentData = getCurrentData();


  // ==================== ZOOM ====================

  const zoomIn = useCallback(() => setZoomLevel(prev => prev + 0.25), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.1)), []);
  const resetZoom = useCallback(() => setZoomLevel(1.0), []);

  // ==================== CAMERA ====================

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      if (stream) stream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); };
          }
        });
      }
      setStream(newStream);
    } catch (err) {
      throw new Error('Cannot access camera.');
    }
  }, [stream]);

  const switchCamera = async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    try { await startCamera(newFacing); } catch (err) { console.error(err); }
  };

  const loadModel = async () => {
    setLoadingText('Loading AI...');
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    await tf.setBackend('webgl');
    setLoadingText('Loading detector...');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    return await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  };

  // ==================== INIT ====================

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('Starting camera...');
        await startCamera('environment');
        const loadedModel = await loadModel();
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };
    init();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // ==================== PERSON DETECTION (person mode only) ====================

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current) return;
    if (appMode !== 'person') return;

    let animationId: number, running = true, lastDetection = 0;
    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;
      const now = Date.now();
      if (now - lastDetection < 100) { animationId = requestAnimationFrame(detect); return; }
      lastDetection = now;
      const video = videoRef.current, canvas = canvasRef.current;
      if (video.readyState !== 4) { animationId = requestAnimationFrame(detect); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      try {
        const predictions = await model.detect(video);
        const humans = predictions.filter((p: any) => p.class === 'person' && p.score > 0.5);
        if (humans.length > 0) {
          const [x, y, width, height] = humans[0].bbox;
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;
          setDetectedPerson({ bbox: humans[0].bbox, class: humans[0].class, score: humans[0].score });
          setPersonPosition({ x: x * scaleX, y: y * scaleY, width: width * scaleX, height: height * scaleY });
        } else {
          setDetectedPerson(null);
          setPersonPosition(null);
        }
      } catch (e) { console.error(e); }
      if (running) animationId = requestAnimationFrame(detect);
    };
    detect();
    return () => { running = false; if (animationId) cancelAnimationFrame(animationId); };
  }, [model, appMode]);

  // ==================== NEW: WEBXR SUPPORT CHECK ====================

  useEffect(() => {
    const checkXR = async () => {
      try {
        if ((navigator as any).xr) {
          const supported = await (navigator as any).xr.isSessionSupported('immersive-ar');
          setWebxrSupported(supported);
        }
      } catch {
        setWebxrSupported(false);
      }
    };
    checkXR();
  }, []);

  // ==================== NEW: START WEBXR ====================

  const startWebXR = async () => {
    const xr = (navigator as any).xr;
    if (!xr) {
      alert('WebXR not available. Using Surface mode.');
      setAppMode('surface');
      return;
    }

    try {
      // Build session options
      const sessionInit: any = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
      };
      const overlayEl = document.getElementById('ar-overlay');
      if (overlayEl) {
        sessionInit.domOverlay = { root: overlayEl };
      }

      // Request immersive AR session
      const session = await xr.requestSession('immersive-ar', sessionInit);
      xrSessionRef.current = session;

      // Create Three.js renderer for XR
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local');
      xrRendererRef.current = renderer;

      // Append canvas to container
      if (xrContainerRef.current) {
        xrContainerRef.current.appendChild(renderer.domElement);
      }

      // Bind session to renderer
      await renderer.xr.setSession(session);

      // Create scene
      const scene = new THREE.Scene();
      xrSceneRef.current = scene;

      // Lighting (same as Visualization3D)
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 10, 7);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-5, 5, -5);
      scene.add(backLight);

      // Camera (Three.js updates it from XR pose automatically)
      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
      xrCameraRef.current = camera;

      // Content group (placed on real surface)
      const group = new THREE.Group();
      group.visible = false;
      scene.add(group);
      xrGroupRef.current = group;

      // Reticle (green ring showing where to place)
      const reticleGeo = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2);
      const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
      xrReticleRef.current = reticle;

      // Center dot on reticle
      const dotGeo = new THREE.CircleGeometry(0.02, 16).rotateX(-Math.PI / 2);
      const dotMesh = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
      dotMesh.position.y = 0.001;
      reticle.add(dotMesh);

      // Pulsing outer ring on reticle
      const pulseGeo = new THREE.RingGeometry(0.11, 0.12, 32).rotateX(-Math.PI / 2);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });
      const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
      pulseRing.position.y = 0.001;
      reticle.add(pulseRing);

      // Request hit-test source
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      xrHitTestSourceRef.current = hitTestSource;

      // SELECT event → tap to place content on detected surface
      session.addEventListener('select', () => {
        if (xrReticleRef.current?.visible && xrGroupRef.current && !xrGroupRef.current.visible) {
          // Place group at reticle position
          xrGroupRef.current.position.setFromMatrixPosition(xrReticleRef.current.matrix);
          xrGroupRef.current.visible = true;
          xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);

          // Hide reticle
          xrReticleRef.current.visible = false;

          setWebxrPlaced(true);
        }
      });

      // SESSION END event → cleanup
      session.addEventListener('end', () => {
        cleanupWebXR();
      });

      // Animation loop (Three.js XR mode)
      renderer.setAnimationLoop((_timestamp: number, frame: any) => {
        if (frame && xrHitTestSourceRef.current && xrGroupRef.current && !xrGroupRef.current.visible) {
          // Hit-test: find real surfaces
          const refSpace = renderer.xr.getReferenceSpace();
          if (refSpace) {
            const results = frame.getHitTestResults(xrHitTestSourceRef.current);
            if (results.length > 0) {
              const hit = results[0];
              const pose = hit.getPose(refSpace);
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

      // Update state
      setWebxrActive(true);
      setWebxrPlaced(false);
      setAppMode('webxr');

    } catch (err: any) {
      console.error('WebXR error:', err);
      alert('WebXR failed: ' + (err.message || 'Unknown error') + '\nUsing Surface mode.');
      setAppMode('surface');
    }
  };

  // ==================== NEW: CLEANUP WEBXR ====================

  const cleanupWebXR = useCallback(() => {
    // Stop animation loop
    if (xrRendererRef.current) {
      xrRendererRef.current.setAnimationLoop(null);
      xrRendererRef.current.dispose();
      // Remove canvas from container
      if (xrContainerRef.current && xrRendererRef.current.domElement.parentNode === xrContainerRef.current) {
        xrContainerRef.current.removeChild(xrRendererRef.current.domElement);
      }
    }

    // Clear all refs
    xrSessionRef.current = null;
    xrRendererRef.current = null;
    xrSceneRef.current = null;
    xrCameraRef.current = null;
    xrGroupRef.current = null;
    xrReticleRef.current = null;
    xrHitTestSourceRef.current = null;

    // Reset state
    setWebxrActive(false);
    setWebxrPlaced(false);
    setAppMode('surface');
  }, []);

  const stopWebXR = useCallback(() => {
    if (xrSessionRef.current) {
      try {
        xrSessionRef.current.end(); // triggers 'end' event → cleanupWebXR
      } catch (e) {
        cleanupWebXR(); // fallback if .end() fails
      }
    } else {
      cleanupWebXR();
    }
  }, [cleanupWebXR]);

  // ==================== NEW: WEBXR SCENE UPDATE ====================
  // When data/highlights change during WebXR, rebuild 3D content

  useEffect(() => {
    if (appMode !== 'webxr' || !webxrPlaced || !xrGroupRef.current) return;
    buildSceneContent(xrGroupRef.current, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId);
  }, [appMode, webxrPlaced, currentData, highlightIndex, highlightIndex2, currentStructure, currentEnvId]);

  // ==================== NEW: WEBXR ZOOM UPDATE ====================

  useEffect(() => {
    if (xrGroupRef.current && webxrActive && webxrPlaced) {
      xrGroupRef.current.scale.setScalar(0.3 * zoomLevel);
    }
  }, [zoomLevel, webxrActive, webxrPlaced]);

  // ==================== NEW: WEBXR REPOSITION ====================

  const resetWebXRPlacement = useCallback(() => {
    if (xrGroupRef.current) {
      xrGroupRef.current.visible = false;
    }
    setWebxrPlaced(false);
  }, []);

  // ==================== MODE SWITCHING ====================

  const switchToMode = useCallback((mode: AppMode) => {
    // If leaving WebXR, stop it
    if (appMode === 'webxr' && mode !== 'webxr') {
      stopWebXR();
      // stopWebXR sets appMode to 'surface', we override below
    }

    if (mode === 'webxr') {
      if (!webxrSupported) {
        alert('WebXR AR is not supported on this device.\nUsing Surface mode instead.');
        mode = 'surface';
      } else {
        startWebXR();
        return; // startWebXR sets appMode internally
      }
    }

    setAppMode(mode);
    if (mode === 'surface') {
      setDetectedPerson(null);
      setPersonPosition(null);
      setSurfacePlaced(false);
      setSurfacePosition(null);
    } else if (mode === 'person') {
      setSurfacePlaced(false);
      setSurfacePosition(null);
    }
  }, [appMode, webxrSupported, stopWebXR]);

  // ==================== SURFACE HANDLERS (same as before) ====================

  const handleSurfaceTap = useCallback((e: React.MouseEvent) => {
    if (appMode !== 'surface' || surfacePlaced) return;
    const clientX = e.clientX, clientY = e.clientY;
    if (clientY < 160 || clientY > window.innerHeight - 180) return;
    const vizWidth = Math.min(window.innerWidth - 20, 380);
    const vizHeight = currentStructure === 'stack' ? 300 : 220;
    setSurfacePosition({
      x: clientX - vizWidth / 2,
      y: clientY - vizHeight / 2,
      width: vizWidth,
      height: vizHeight,
    });
    setSurfacePlaced(true);
  }, [appMode, surfacePlaced, currentStructure]);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (appMode !== 'surface' || !surfacePlaced || !surfacePosition) return;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length !== 1) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const viz = surfacePosition;
    if (clientX >= viz.x && clientX <= viz.x + viz.width &&
      clientY >= viz.y && clientY <= viz.y + viz.height) {
      setIsDraggingSurface(true);
      dragOffsetRef.current = { x: clientX - viz.x, y: clientY - viz.y };
    }
  }, [appMode, surfacePlaced, surfacePosition]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingSurface || !surfacePosition) return;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    setSurfacePosition(prev => prev ? {
      ...prev,
      x: clientX - dragOffsetRef.current.x,
      y: clientY - dragOffsetRef.current.y,
    } : null);
  }, [isDraggingSurface, surfacePosition]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingSurface(false);
  }, []);

  const resetSurfacePlacement = useCallback(() => {
    setSurfacePlaced(false);
    setSurfacePosition(null);
  }, []);

  // ==================== ACTIVE POSITION & VISIBILITY ====================

  const activePosition = appMode === 'person' ? personPosition : surfacePosition;
  const showVisualization = appMode === 'person' ? !!detectedPerson : appMode === 'surface' ? surfacePlaced : false;
  const showControls = showVisualization || (appMode === 'webxr' && webxrPlaced);

   // ==================== PART 8: All Operations ====================
  // This continues INSIDE the Home() function, right after Part 7

  // ==================== ARRAY OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData(), index = Math.floor(Math.random() * data.length);
    setHighlightIndex(index);
    setOperationMessage(`Accessing [${index}]: "${data[index].label}"`);
    setCodeDisplay(`// O(1) Access\narray[${index}] → "${data[index].label}"`);
    await delay(2000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating || getArrayData().length >= 6) return; setIsAnimating(true);
    const data = getArrayData(), insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(300); }
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev];
      arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' });
      return arr;
    });
    setHighlightIndex(insertIndex);
    setOperationMessage(`Inserted!`);
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return; setIsAnimating(true);
    const data = getArrayData(), deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]...`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    await delay(1000);
    (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex));
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getArrayData();
    const idx1 = Math.floor(Math.random() * data.length);
    let idx2 = Math.floor(Math.random() * data.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * data.length);
    setHighlightIndex(idx1); setHighlightIndex2(idx2);
    setOperationMessage(`Swapping [${idx1}] ↔ [${idx2}]`);
    setCodeDisplay(`// O(1) Swap`);
    await delay(1500);
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev];
      [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
      return arr;
    });
    await delay(1000);
    setHighlightIndex(null); setHighlightIndex2(null);
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== LINKED LIST OPERATIONS ====================

  const linkedListInsertHead = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    setOperationMessage('Inserting at HEAD...');
    setCodeDisplay(`// O(1)\nnewNode.next = head\nhead = newNode`);
    await delay(1000);
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#1abc9c' };
    (setLinkedListData as any)((prev: DataItem[]) => [newItem, ...prev]);
    setHighlightIndex(0);
    setOperationMessage('Inserted at HEAD!');
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return; setIsAnimating(true);
    const data = getLinkedListData();
    setOperationMessage('Traversing to TAIL...');
    setCodeDisplay(`// O(n) Traverse`);
    for (let i = 0; i < data.length; i++) { setHighlightIndex(i); await delay(400); }
    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#e74c3c' };
    (setLinkedListData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    setOperationMessage('Inserted at TAIL!');
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating || getLinkedListData().length <= 2) return; setIsAnimating(true);
    setHighlightIndex(0);
    setOperationMessage('Deleting HEAD...');
    setCodeDisplay(`// O(1)\nhead = head.next`);
    await delay(1500);
    (setLinkedListData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return; setIsAnimating(true);
    const data = getLinkedListData();
    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Visiting: ${data[i].label}`);
      setCodeDisplay(`// Node ${i}\ncurr = curr.next`);
      await delay(600);
    }
    setOperationMessage(`Done! ${data.length} nodes`);
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== STACK OPERATIONS ====================

  const stackPush = async () => {
    if (isAnimating || getStackData().length >= 5) return; setIsAnimating(true);
    const data = getStackData();
    const labels = stackEnv === 'books' ? ['Physics', 'English', 'Art']
      : stackEnv === 'plates' ? [`Plate ${data.length + 1}`]
      : [`Box ${String.fromCharCode(65 + data.length)}`];
    const colors = stackEnv === 'books' ? ['#9b59b6', '#e74c3c', '#1abc9c'] : ['#7f8c8d'];
    const newItem = {
      id: Date.now(),
      label: labels[Math.floor(Math.random() * labels.length)],
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    setOperationMessage(`Pushing "${newItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.push("${newItem.label}")`);
    await delay(500);
    (setStackData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating || getStackData().length <= 1) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping "${topItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`);
    await delay(1500);
    (setStackData as any)((prev: DataItem[]) => prev.slice(0, -1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating || getStackData().length === 0) return; setIsAnimating(true);
    const data = getStackData(), topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`TOP: "${topItem.label}"`);
    setCodeDisplay(`// O(1)\nstack.peek() → "${topItem.label}"`);
    await delay(2000);
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
    await delay(500);
    (setQueueData as any)((prev: DataItem[]) => [...prev, newItem]);
    setHighlightIndex(data.length);
    await delay(1500);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating || getQueueData().length <= 1) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`);
    await delay(1500);
    (setQueueData as any)((prev: DataItem[]) => prev.slice(1));
    await delay(1000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return; setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`);
    await delay(2000);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== PART 9: Render + OpBtn + Visualization3D ====================
  // This continues INSIDE the Home() function, right after Part 8

  // ==================== ERROR SCREEN ====================

  if (error) return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ fontSize: 80 }}>📷</div>
      <h2>Camera Access Needed</h2>
      <button onClick={() => window.location.reload()} style={{ marginTop: 30, padding: '15px 40px', background: '#667eea', border: 'none', borderRadius: 30, color: 'white' }}>🔄 Try Again</button>
    </div>
  );

  // ==================== LOADING SCREEN ====================

  if (isLoading) return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ width: 70, height: 70, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <h2 style={{ marginTop: 25 }}>📊 Data Structure AR</h2>
      <p>{loadingText}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ==================== ENVIRONMENT TABS DATA ====================

  const envTabs = currentStructure === 'array'
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  // ==================== MAIN RENDER ====================

  return (
    <div
      id="ar-overlay"
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
      onClick={appMode === 'surface' && !surfacePlaced ? handleSurfaceTap : undefined}
      onTouchStart={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined}
      onTouchMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined}
      onTouchEnd={appMode === 'surface' ? handleDragEnd : undefined}
      onMouseDown={appMode === 'surface' && surfacePlaced ? handleDragStart : undefined}
      onMouseMove={appMode === 'surface' && isDraggingSurface ? handleDragMove : undefined}
      onMouseUp={appMode === 'surface' ? handleDragEnd : undefined}
    >
      {/* ===== VIDEO (hidden during WebXR) ===== */}
      {!webxrActive && (
        <video ref={videoRef} playsInline muted autoPlay style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'
        }} />
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ===== WEBXR RENDERER CONTAINER ===== */}
      <div ref={xrContainerRef} style={{
        position: 'fixed', inset: 0,
        zIndex: webxrActive ? 1 : -1,
        pointerEvents: 'none',
      }} />

      {/* ===== 3D VISUALIZATION (person/surface modes only) ===== */}
      {!webxrActive && showVisualization && activePosition && (
        <Visualization3D
          position={activePosition}
          data={currentData}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          structure={currentStructure}
          environment={currentEnvId}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          isSurfaceMode={appMode === 'surface'}
        />
      )}

      {/* ===== SURFACE MODE SHADOW ===== */}
      {!webxrActive && appMode === 'surface' && surfacePlaced && surfacePosition && (
        <div style={{
          position: 'absolute',
          left: surfacePosition.x + 40,
          top: surfacePosition.y + surfacePosition.height,
          width: surfacePosition.width - 80,
          height: 25,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
          borderRadius: '50%',
          zIndex: 49,
          pointerEvents: 'none',
        }} />
      )}

      {/* ===== TOP BAR ===== */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>

        {/* Camera Switch (hidden in WebXR) */}
        {!webxrActive && (
          <button onClick={switchCamera} style={{
            position: 'absolute', top: 10, right: 10, width: 50, height: 50,
            borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 24, zIndex: 200,
          }}>🔄</button>
        )}

        {/* ===== MODE TOGGLE (3 buttons now) ===== */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3,
          border: '1px solid rgba(255,255,255,0.2)', zIndex: 200,
        }}>
          <button onClick={() => switchToMode('person')} style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
            background: appMode === 'person' ? '#667eea' : 'transparent',
            color: 'white', opacity: appMode === 'person' ? 1 : 0.5, cursor: 'pointer',
            transition: 'all 0.3s',
          }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
            background: appMode === 'surface' ? '#00b894' : 'transparent',
            color: 'white', opacity: appMode === 'surface' ? 1 : 0.5, cursor: 'pointer',
            transition: 'all 0.3s',
          }}>📱 Surface</button>
          <button onClick={() => switchToMode('webxr')} style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20,
            background: appMode === 'webxr' ? '#e17055' : 'transparent',
            color: 'white',
            opacity: appMode === 'webxr' ? 1 : webxrSupported ? 0.5 : 0.25,
            cursor: webxrSupported ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
          }}>🌐 WebXR{!webxrSupported && ' ✗'}</button>
        </div>

        {/* ===== ZOOM CONTROLS ===== */}
        {showControls && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onPointerDown={zoomIn} style={{
              width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff',
              background: '#667eea', color: 'white', fontSize: 28, fontWeight: 'bold',
            }}>+</button>
            <div style={{
              width: 50, height: 50, borderRadius: '50%', background: '#000',
              border: '3px solid #0f0', color: '#0f0', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{Math.round(zoomLevel * 100)}%</div>
            <button onPointerDown={zoomOut} style={{
              width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff',
              background: '#f5576c', color: 'white', fontSize: 32, fontWeight: 'bold',
            }}>−</button>
            <button onPointerDown={resetZoom} style={{
              width: 50, height: 50, borderRadius: '50%', border: '3px solid #fff',
              background: '#4facfe', color: 'white', fontSize: 20,
            }}>⟲</button>
          </div>
        )}

        {/* ===== DATA STRUCTURE TABS ===== */}
        <div style={{
          position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25,
        }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
            <button key={s} onClick={() => {
              if (!isAnimating) {
                setCurrentStructure(s);
                if (appMode === 'surface') { setSurfacePlaced(false); setSurfacePosition(null); }
                // WebXR: content rebuilds automatically via useEffect
              }
            }} style={{
              padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20,
              background: currentStructure === s ? '#667eea' : 'transparent',
              color: 'white', opacity: currentStructure === s ? 1 : 0.6,
            }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}
              {currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
            </button>
          ))}
        </div>

        {/* ===== ENVIRONMENT TABS ===== */}
        {showControls && (
          <div style={{
            position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20,
          }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as any)(e.id)} style={{
                padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15,
                background: currentEnvId === e.id ? '#00b894' : 'transparent',
                color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6,
              }}>{e.icon} {e.label}</button>
            ))}
          </div>
        )}

        {/* ===== OPERATION MESSAGES ===== */}
        {operationMessage && (
          <div style={{
            position: 'absolute', top: 128, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px',
            borderRadius: 15, fontSize: 14, border: '1px solid #0f0', whiteSpace: 'nowrap',
          }}>⚡ {operationMessage}</div>
        )}
        {codeDisplay && (
          <div style={{
            position: 'absolute', top: 168, left: '50%', transform: 'translateX(-50%)',
            background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10,
            fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444',
          }}>{codeDisplay}</div>
        )}

        {/* ===== WEBXR EXIT BUTTON ===== */}
        {webxrActive && (
          <button onClick={stopWebXR} style={{
            position: 'absolute', top: 10, right: 10, padding: '10px 18px',
            background: '#e74c3c', color: 'white', border: 'none', borderRadius: 20,
            fontSize: 13, fontWeight: 'bold', zIndex: 300,
          }}>✕ Exit AR</button>
        )}
      </div>

      {/* ===== BOTTOM PANEL (operations) ===== */}
      {showControls && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '20px 10px 30px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)',
          zIndex: 100,
        }}>

          {/* Reposition buttons */}
          {appMode === 'surface' && surfacePlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetSurfacePlacement} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 'bold',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20,
                background: 'rgba(255,255,255,0.1)', color: 'white',
              }}>📍 Reposition</button>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 10 }}>
                or drag to move
              </span>
            </div>
          )}
          {appMode === 'webxr' && webxrPlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetWebXRPlacement} style={{
                padding: '8px 20px', fontSize: 12, fontWeight: 'bold',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20,
                background: 'rgba(255,255,255,0.1)', color: 'white',
              }}>📍 Reposition on Floor</button>
            </div>
          )}

          {/* Operation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentStructure === 'array' && (
              <>
                <OpBtn onClick={arrayAccess} disabled={isAnimating} color="#f39c12" label="📍 Access" />
                <OpBtn onClick={arrayInsert} disabled={isAnimating || getArrayData().length >= 6} color="#2ecc71" label="➕ Insert" />
                <OpBtn onClick={arrayDelete} disabled={isAnimating || getArrayData().length <= 2} color="#e74c3c" label="➖ Delete" />
                <OpBtn onClick={arraySwap} disabled={isAnimating} color="#9b59b6" label="🔀 Swap" />
              </>
            )}
            {currentStructure === 'linkedlist' && (
              <>
                <OpBtn onClick={linkedListInsertHead} disabled={isAnimating || getLinkedListData().length >= 5} color="#2ecc71" label="⬅️ +Head" />
                <OpBtn onClick={linkedListInsertTail} disabled={isAnimating || getLinkedListData().length >= 5} color="#3498db" label="➡️ +Tail" />
                <OpBtn onClick={linkedListDeleteHead} disabled={isAnimating || getLinkedListData().length <= 2} color="#e74c3c" label="🗑️ -Head" />
                <OpBtn onClick={linkedListTraverse} disabled={isAnimating} color="#9b59b6" label="🔍 Traverse" />
              </>
            )}
            {currentStructure === 'stack' && (
              <>
                <OpBtn onClick={stackPush} disabled={isAnimating || getStackData().length >= 5} color="#2ecc71" label="⬆️ Push" />
                <OpBtn onClick={stackPop} disabled={isAnimating || getStackData().length <= 1} color="#e74c3c" label="⬇️ Pop" />
                <OpBtn onClick={stackPeek} disabled={isAnimating} color="#f39c12" label="👁️ Peek" />
              </>
            )}
            {currentStructure === 'queue' && (
              <>
                <OpBtn onClick={queueEnqueue} disabled={isAnimating || getQueueData().length >= 5} color="#2ecc71" label="➕ Enqueue" />
                <OpBtn onClick={queueDequeue} disabled={isAnimating || getQueueData().length <= 1} color="#e74c3c" label="➖ Dequeue" />
                <OpBtn onClick={queueFront} disabled={isAnimating} color="#f39c12" label="👁️ Front" />
              </>
            )}
          </div>

          {/* Status bar */}
          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {currentData.length}
            {appMode === 'surface' && <span style={{ marginLeft: 10, color: '#00b894' }}>📱 Surface</span>}
            {appMode === 'webxr' && <span style={{ marginLeft: 10, color: '#e17055' }}>🌐 WebXR AR</span>}
          </div>
        </div>
      )}

      {/* ===== PROMPT MESSAGES ===== */}

      {/* Person mode: no person detected */}
      {appMode === 'person' && !detectedPerson && !webxrActive && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px',
          borderRadius: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }}>🧑</div>
          <div style={{ marginTop: 8 }}>Point camera at a person</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>
            or switch to Surface / WebXR →
          </div>
        </div>
      )}

      {/* Surface mode: not placed */}
      {appMode === 'surface' && !surfacePlaced && !webxrActive && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px',
          borderRadius: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>
            Tap anywhere on screen to place<br />your data structure
          </div>
          <style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      )}

      {/* WebXR mode: looking for surface */}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px',
          borderRadius: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, animation: 'xrPulse 2s ease infinite' }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>
            Scanning for surfaces...
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>
            Point at a floor or table<br />
            Tap the green ring to place
          </div>
          <style>{`@keyframes xrPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }`}</style>
        </div>
      )}

    </div>
  );
}

// ==================== OPERATION BUTTON COMPONENT ====================

function OpBtn({ onClick, disabled, color, label }: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  label: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 18px', fontSize: 13, fontWeight: 'bold', border: 'none', borderRadius: 25,
      background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  );
}

// ==================== VISUALIZATION3D COMPONENT (SIMPLIFIED) ====================
// Now uses buildSceneContent() instead of inline scene building

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, isSurfaceMode }: {
  position: Position;
  data: DataItem[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  structure: DataStructure;
  environment: string;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  isSurfaceMode: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0 });
  const zoomRef = useRef(zoomLevel);

  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);

  const renderWidth = window.innerWidth;
  const renderHeight = window.innerHeight;

  // ===== THREE.JS SETUP (renderer, camera, controls, animation) =====
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.2 : 0.5, structure === 'stack' ? 5 : 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(renderWidth, renderHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLight(0xffffff, 0.3)).position.set(-5, 5, -5);
    scene.add(new THREE.PointLight(0xffffff, 0.3)).position.set(0, -3, 3);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // Touch/Mouse controls
    let isDragging = false, lastX = 0, lastY = 0;
    let pinchDist: number | null = null, pinchZoom = 1;
    const getDist = (t: TouchList): number | null => {
      if (t.length < 2) return null;
      const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) { pinchDist = getDist(e.touches); pinchZoom = zoomRef.current; }
      else if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const d = getDist(e.touches);
        if (d) setZoomLevel(Math.max(0.1, pinchZoom * (d / pinchDist)));
      } else if (e.touches.length === 1 && isDragging) {
        rotationRef.current.y += (e.touches[0].clientX - lastX) * 0.01;
        rotationRef.current.x += (e.touches[0].clientY - lastY) * 0.008;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      }
    };
    const onTE = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) pinchDist = null;
      if (e.touches.length === 0) isDragging = false;
    };
    const onMD = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMM = (e: MouseEvent) => {
      if (!isDragging) return;
      rotationRef.current.y += (e.clientX - lastX) * 0.01;
      rotationRef.current.x += (e.clientY - lastY) * 0.008;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onMU = () => { isDragging = false; };
    const onWH = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(Math.max(0.1, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15)));
    };

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

  // ===== SCENE CONTENT UPDATE (uses shared buildSceneContent) =====
  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment);
  }, [data, highlightIndex, highlightIndex2, structure, environment]);

  // ===== RENDER =====
  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 50,
        touchAction: 'none',
        pointerEvents: 'auto',
        overflow: 'visible',
      }}
    />
  );
}

// ==================== END OF PART 9 ====================
// ==================== END OF FILE ====================
