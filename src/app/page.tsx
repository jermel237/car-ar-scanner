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

// ==================== ARROW ====================

function createArrow(fromX: number, toX: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;
  const midY = 0;
  
  const points = [new THREE.Vector3(fromX + 0.35, midY, 0), new THREE.Vector3(toX - 0.35, midY, 0)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 3 });
  arrow.add(new THREE.Line(lineGeo, lineMat));

  const coneGeo = new THREE.ConeGeometry(0.08, 0.15, 12);
  const coneMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(toX - 0.4, midY, 0);
  cone.rotation.z = -Math.PI / 2;
  arrow.add(cone);

  return arrow;
}

// ==================== REALISTIC HUMAN 3D ====================

function createHuman3D(appearance: HumanAppearance, name: string, isHighlighted: boolean, facingDirection: number = 0): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.3 : 0;

  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.6,
    metalness: 0.0,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.2,
  });

  const bodyScale = 0.9;
  
  // HEAD GROUP
  const headGroup = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.12, 32, 32);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.scale.set(0.85, 1.0, 0.9);
  headGroup.add(head);

  // Face
  const faceGeo = new THREE.SphereGeometry(0.11, 32, 32);
  const face = new THREE.Mesh(faceGeo, skinMat);
  face.scale.set(0.8, 0.85, 0.5);
  face.position.set(0, -0.02, 0.04);
  headGroup.add(face);

  // EYES
  [-0.035, 0.035].forEach((x) => {
    // Eyeball
    const eyeballGeo = new THREE.SphereGeometry(0.018, 24, 24);
    const eyeballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1 });
    const eyeball = new THREE.Mesh(eyeballGeo, eyeballMat);
    eyeball.position.set(x, 0.02, 0.09);
    eyeball.scale.set(1, 0.85, 0.7);
    headGroup.add(eyeball);

    // Iris
    const irisGeo = new THREE.CircleGeometry(0.008, 24);
    const irisMat = new THREE.MeshBasicMaterial({ color: '#4a3728' });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(x, 0.02, 0.102);
    headGroup.add(iris);

    // Pupil
    const pupilGeo = new THREE.CircleGeometry(0.004, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x, 0.02, 0.103);
    headGroup.add(pupil);

    // Eye shine
    const shineGeo = new THREE.CircleGeometry(0.002, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.position.set(x + 0.003, 0.025, 0.104);
    headGroup.add(shine);
  });

  // EYEBROWS
  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
  [-0.035, 0.035].forEach((x, idx) => {
    const browGeo = new THREE.BoxGeometry(0.035, 0.008, 0.01);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.055, 0.085);
    brow.rotation.z = idx === 0 ? -0.1 : 0.1;
    headGroup.add(brow);
  });

  // NOSE
  const noseGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, -0.01, 0.11);
  nose.scale.set(1, 0.7, 0.8);
  headGroup.add(nose);

  // MOUTH
  const mouthGeo = new THREE.TorusGeometry(0.02, 0.005, 8, 16, Math.PI);
  const lipMat = new THREE.MeshStandardMaterial({ color: appearance.gender === 'female' ? '#c44569' : '#b87a6b', roughness: 0.4 });
  const mouth = new THREE.Mesh(mouthGeo, lipMat);
  mouth.position.set(0, -0.05, 0.09);
  mouth.scale.set(1, 0.6, 1);
  headGroup.add(mouth);

  // EARS
  [-0.1, 0.1].forEach(x => {
    const earGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(x, 0.01, 0);
    ear.scale.set(0.4, 0.8, 0.6);
    headGroup.add(ear);
  });

  // HAIR
  const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.8 });

  if (appearance.hairStyle !== 'bald') {
    if (appearance.hairStyle === 'long') {
      const hairBaseGeo = new THREE.SphereGeometry(0.13, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6);
      const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
      hairBase.position.set(0, 0.02, -0.01);
      hairBase.scale.set(0.9, 0.95, 0.95);
      headGroup.add(hairBase);

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const strandGeo = new THREE.CapsuleGeometry(0.02, 0.15, 8, 16);
        const strand = new THREE.Mesh(strandGeo, hairMat);
        strand.position.set(Math.sin(angle) * 0.08, -0.05, Math.cos(angle) * 0.08 - 0.02);
        strand.rotation.x = 0.2;
        strand.rotation.z = Math.sin(angle) * 0.15;
        headGroup.add(strand);
      }

      if (appearance.gender === 'female') {
        for (let i = -3; i <= 3; i++) {
          const bangGeo = new THREE.CapsuleGeometry(0.015, 0.04, 6, 12);
          const bang = new THREE.Mesh(bangGeo, hairMat);
          bang.position.set(i * 0.02, 0.06, 0.08);
          bang.rotation.x = 0.5;
          bang.rotation.z = i * 0.05;
          headGroup.add(bang);
        }
      }
    } else {
      const shortHairGeo = new THREE.SphereGeometry(0.125, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const shortHair = new THREE.Mesh(shortHairGeo, hairMat);
      shortHair.position.set(0, 0.02, 0);
      shortHair.scale.set(0.88, 0.9, 0.9);
      headGroup.add(shortHair);
    }
  }

  // CHIN
  const chinGeo = new THREE.SphereGeometry(0.05, 16, 16);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.position.set(0, -0.09, 0.04);
  chin.scale.set(1, 0.6, 0.8);
  headGroup.add(chin);

  headGroup.position.y = 0.42 * bodyScale;
  human.add(headGroup);

  // NECK
  const neckGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.06, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.28 * bodyScale;
  human.add(neck);

  // TORSO
  const torsoGroup = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });

  const chestGeo = new THREE.BoxGeometry(0.22, 0.18, 0.12);
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.y = 0.09;
  torsoGroup.add(chest);

  // Shoulders
  [-0.12, 0.12].forEach(x => {
    const shoulderGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const shoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    shoulder.position.set(x, 0.16, 0);
    shoulder.scale.set(1, 0.8, 0.9);
    torsoGroup.add(shoulder);
  });

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 16, Math.PI);
  const collarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.17, 0.04);
  collar.rotation.x = -0.3;
  torsoGroup.add(collar);

  // Buttons
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
  [0.12, 0.06, 0].forEach(y => {
    const buttonGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12);
    const button = new THREE.Mesh(buttonGeo, buttonMat);
    button.position.set(0, y, 0.065);
    button.rotation.x = Math.PI / 2;
    torsoGroup.add(button);
  });

  // Lower torso
  const abdomenGeo = new THREE.BoxGeometry(0.2, 0.1, 0.1);
  const abdomen = new THREE.Mesh(abdomenGeo, shirtMat);
  abdomen.position.y = -0.02;
  torsoGroup.add(abdomen);

  torsoGroup.position.y = 0.08 * bodyScale;
  human.add(torsoGroup);

  // ARMS
  [-1, 1].forEach(side => {
    const armGroup = new THREE.Group();

    const upperArmGeo = new THREE.CapsuleGeometry(0.032, 0.1, 8, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    upperArm.position.y = -0.02;
    armGroup.add(upperArm);

    const forearmGeo = new THREE.CapsuleGeometry(0.025, 0.08, 8, 16);
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.15;
    armGroup.add(forearm);

    const handGeo = new THREE.BoxGeometry(0.04, 0.05, 0.02);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.235;
    armGroup.add(hand);

    for (let f = 0; f < 4; f++) {
      const fingerGeo = new THREE.CapsuleGeometry(0.005, 0.02, 4, 8);
      const finger = new THREE.Mesh(fingerGeo, skinMat);
      finger.position.set(-0.012 + f * 0.008, -0.27, 0);
      armGroup.add(finger);
    }

    const thumbGeo = new THREE.CapsuleGeometry(0.006, 0.018, 4, 8);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(side * 0.025, -0.24, 0.01);
    thumb.rotation.z = side * 0.5;
    armGroup.add(thumb);

    armGroup.position.set(side * 0.14 * bodyScale, 0.22 * bodyScale, 0);
    armGroup.rotation.z = side * 0.1;
    human.add(armGroup);
  });

  // BELT
  const beltGeo = new THREE.CylinderGeometry(0.08, 0.075, 0.025, 16);
  const beltMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = -0.02 * bodyScale;
  human.add(belt);

  const buckleGeo = new THREE.BoxGeometry(0.03, 0.02, 0.008);
  const buckleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
  const buckle = new THREE.Mesh(buckleGeo, buckleMat);
  buckle.position.set(0, -0.02 * bodyScale, 0.075);
  human.add(buckle);

  // PANTS / LEGS
  const pantsMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.8 });

  const hipsGeo = new THREE.BoxGeometry(0.18, 0.08, 0.1);
  const hips = new THREE.Mesh(hipsGeo, pantsMat);
  hips.position.y = -0.07 * bodyScale;
  human.add(hips);

  [-0.045, 0.045].forEach(x => {
    const legGroup = new THREE.Group();

    const thighGeo = new THREE.CapsuleGeometry(0.04, 0.12, 8, 16);
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.position.y = -0.02;
    legGroup.add(thigh);

    const kneeGeo = new THREE.SphereGeometry(0.038, 12, 12);
    const knee = new THREE.Mesh(kneeGeo, pantsMat);
    knee.position.y = -0.1;
    legGroup.add(knee);

    const calfGeo = new THREE.CapsuleGeometry(0.032, 0.12, 8, 16);
    const calf = new THREE.Mesh(calfGeo, pantsMat);
    calf.position.y = -0.2;
    legGroup.add(calf);

    legGroup.position.set(x * bodyScale, -0.12 * bodyScale, 0);
    human.add(legGroup);
  });

  // SHOES
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.9 });

  [-0.045, 0.045].forEach(x => {
    const shoeGroup = new THREE.Group();

    const shoeBodyGeo = new THREE.BoxGeometry(0.05, 0.025, 0.08);
    const shoeBody = new THREE.Mesh(shoeBodyGeo, shoeMat);
    shoeGroup.add(shoeBody);

    const toeGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const toe = new THREE.Mesh(toeGeo, shoeMat);
    toe.position.set(0, -0.005, 0.03);
    toe.scale.set(1, 0.6, 0.8);
    shoeGroup.add(toe);

    const soleGeo = new THREE.BoxGeometry(0.052, 0.008, 0.085);
    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.y = -0.016;
    shoeGroup.add(sole);

    shoeGroup.position.set(x * bodyScale, -0.42 * bodyScale, 0.01);
    human.add(shoeGroup);
  });

  // NAME TAG
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 256;
  nameCanvas.height = 64;
  const nctx = nameCanvas.getContext('2d')!;

  if (isHighlighted) {
    nctx.fillStyle = '#ffff00';
  } else {
    nctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  }
  nctx.beginPath();
  nctx.roundRect(10, 8, 236, 48, 12);
  nctx.fill();

  nctx.fillStyle = isHighlighted ? '#000000' : '#ffffff';
  nctx.font = 'bold 28px Arial';
  nctx.textAlign = 'center';
  nctx.fillText(name, 128, 42);

  const nameTex = new THREE.CanvasTexture(nameCanvas);
  const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true }));
  nameSprite.position.y = 0.6 * bodyScale;
  nameSprite.scale.set(0.4, 0.1, 1);
  human.add(nameSprite);

  // HIGHLIGHT
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.12, 0.18, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.43 * bodyScale;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);

    const arrowGeo = new THREE.ConeGeometry(0.05, 0.1, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffff00' });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.y = 0.72 * bodyScale;
    arrowMesh.rotation.z = Math.PI;
    human.add(arrowMesh);
  }

  human.rotation.y = facingDirection;
  return human;
}

// ==================== CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  
  const seatMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#404040', roughness: 0.3, metalness: 0.8 });

  const seatGeo = new THREE.BoxGeometry(0.28, 0.035, 0.28);
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.y = -0.15;
  chair.add(seat);

  const backGeo = new THREE.BoxGeometry(0.26, 0.22, 0.025);
  const back = new THREE.Mesh(backGeo, seatMat);
  back.position.set(0, 0.0, -0.12);
  chair.add(back);

  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8);
  [[-0.1, -0.29, 0.1], [0.1, -0.29, 0.1], [-0.1, -0.29, -0.1], [0.1, -0.29, -0.1]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  chair.position.x = x;
  return chair;
}

// ==================== GROCERY BOX ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.32;
  const boxHeight = 0.5;
  const boxDepth = 0.2;

  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = boxHeight / 2;
  product.add(body);

  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 160;
  frontCanvas.height = 250;
  const fctx = frontCanvas.getContext('2d')!;

  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, 160, 250);

  fctx.fillStyle = color;
  fctx.fillRect(0, 0, 160, 60);

  fctx.fillStyle = '#ffffff';
  fctx.font = 'bold 14px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('FRESH', 80, 25);
  fctx.font = 'bold 18px Arial';
  fctx.fillText('MARKET', 80, 48);

  const icons: Record<string, string> = {
    'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚',
    'Apple': '🍎', 'Juice': '🧃', 'New': '🆕'
  };
  fctx.font = '50px Arial';
  fctx.fillText(icons[label] || '📦', 80, 130);

  fctx.fillStyle = '#2c3e50';
  fctx.font = 'bold 22px Arial';
  fctx.fillText(label, 80, 170);

  fctx.fillStyle = '#666';
  fctx.font = '10px Arial';
  fctx.fillText('Premium Quality', 80, 190);

  fctx.fillStyle = '#000';
  for (let i = 25; i < 135; i += 3) {
    const h = 15 + Math.random() * 8;
    fctx.fillRect(i, 220, 1.5, h);
  }

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(boxWidth - 0.02, boxHeight - 0.02),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontLabel.position.set(0, boxHeight / 2, boxDepth / 2 + 0.001);
  product.add(frontLabel);

  const priceCanvas = document.createElement('canvas');
  priceCanvas.width = 80;
  priceCanvas.height = 40;
  const pctx = priceCanvas.getContext('2d')!;
  pctx.fillStyle = '#ffeb3b';
  pctx.fillRect(0, 0, 80, 40);
  pctx.strokeStyle = '#f57f17';
  pctx.lineWidth = 3;
  pctx.strokeRect(2, 2, 76, 36);
  pctx.fillStyle = '#c62828';
  pctx.font = 'bold 18px Arial';
  pctx.textAlign = 'center';
  const prices: Record<string, string> = {
    'Milk': '$3.99', 'Bread': '$2.49', 'Eggs': '$4.99',
    'Apple': '$1.29', 'Juice': '$5.49', 'New': '$0.99'
  };
  pctx.fillText(prices[label] || '$2.99', 40, 28);

  const priceTex = new THREE.CanvasTexture(priceCanvas);
  const priceTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.08),
    new THREE.MeshBasicMaterial({ map: priceTex, transparent: true })
  );
  priceTag.position.set(0, 0.02, boxDepth / 2 + 0.04);
  product.add(priceTag);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.08, boxHeight + 0.08, boxDepth + 0.08);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = boxHeight / 2;
    product.add(glow);
  }

  return product;
}

// ==================== ANIMATION HELPER ====================

function applyItemAnimation(
  obj: THREE.Object3D,
  itemIndex: number,
  animPhase: string,
  animData: Record<string, unknown>,
  structure: DataStructure
): void {
  if (!animPhase) return;

  const isTarget = animData.index === itemIndex;
  const isTarget1 = animData.index1 === itemIndex;
  const isTarget2 = animData.index2 === itemIndex;
  const time = Date.now() * 0.001;

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) {
      obj.position.y += 0.3 + Math.sin(time * 8) * 0.05;
      obj.rotation.z = Math.sin(time * 6) * 0.1;
    } else if (animPhase === 'access-bounce' && isTarget) {
      obj.position.y += 0.25 + Math.sin(time * 10) * 0.08;
      obj.scale.multiplyScalar(1.15);
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.1;
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.6 + Math.sin(time * 15) * 0.1;
      obj.scale.multiplyScalar(0.5);
      obj.rotation.z = Math.sin(time * 8) * 0.2;
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.12;
      obj.scale.multiplyScalar(1.08);
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = 0.3;
      obj.scale.multiplyScalar(1.1);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 5;
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.4;
      obj.rotation.z = isTarget1 ? 0.15 : -0.15;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.15;
      obj.scale.multiplyScalar(1.1);
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.4 + Math.sin(time * 10) * 0.08;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.4;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = 0.3;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 4;
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.15;
      obj.scale.multiplyScalar(1.12);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.5;
      obj.scale.multiplyScalar(0.7);
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.06);
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.35;
      obj.rotation.z = -0.25;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.8;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 5;
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.2;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.25;
      obj.scale.multiplyScalar(1.12);
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.08;
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 0.8;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.15;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 0.6;
      obj.scale.multiplyScalar(0.85);
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.2;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.15;
      obj.scale.multiplyScalar(1.1);
    }
  }
}

// ==================== END OF PART 1 ====================
// ==================== PART 2: MORE 3D OBJECTS ====================

// ==================== TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  // Main body
  const bodyGeo = new THREE.BoxGeometry(0.75, 0.35, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.35 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.14;
  train.add(body);

  // Stripe
  const stripeGeo = new THREE.BoxGeometry(0.76, 0.03, 0.33);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.2;
  train.add(stripe);

  // Roof
  const roofGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.7, 16, 1, false, 0, Math.PI);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', metalness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 0.32;
  train.add(roof);

  // Undercarriage
  const underGeo = new THREE.BoxGeometry(0.7, 0.05, 0.26);
  const underMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.06;
  train.add(under);

  // Wheels
  const wheelPositions: [number, number, number][] = [
    [-0.24, -0.06, 0.16], [0.24, -0.06, 0.16],
    [-0.24, -0.06, -0.16], [0.24, -0.06, -0.16],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.025, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7 });
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    train.add(wheel);

    const hubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx, wy, wz);
    train.add(hub);
  });

  // Windows (for passenger cars)
  if (!isEngine) {
    const windowGeo = new THREE.PlaneGeometry(0.1, 0.1);
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#87ceeb',
      metalness: 0.5,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    [-0.22, 0, 0.22].forEach(wx => {
      const windowF = new THREE.Mesh(windowGeo, windowMat);
      windowF.position.set(wx, 0.18, 0.162);
      train.add(windowF);

      const windowB = new THREE.Mesh(windowGeo, windowMat);
      windowB.position.set(wx, 0.18, -0.162);
      train.add(windowB);
    });
  }

  // Engine parts
  if (isEngine) {
    // Boiler
    const boilerGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.35, 24);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.5 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.55, 0.14, 0);
    train.add(boiler);

    // Boiler bands
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
    [0.42, 0.52, 0.62].forEach(bx => {
      const bandGeo = new THREE.TorusGeometry(0.15, 0.01, 8, 24);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(bx, 0.14, 0);
      band.rotation.y = Math.PI / 2;
      train.add(band);
    });

    // Headlight
    const headlightGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.06, 16);
    const headlightMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.7 });
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.rotation.z = Math.PI / 2;
    headlight.position.set(0.75, 0.26, 0);
    train.add(headlight);

    const lensGeo = new THREE.CircleGeometry(0.035, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0.78, 0.26, 0);
    lens.rotation.y = Math.PI / 2;
    train.add(lens);

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.18, 12);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.25, 0.42, 0);
    train.add(chimney);

    // Smoke puffs
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.4 });
    [0.55, 0.65, 0.75, 0.88].forEach((sy, i) => {
      const smokeGeo = new THREE.SphereGeometry(0.05 + i * 0.02, 12, 12);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.25 - i * 0.03, sy, (Math.random() - 0.5) * 0.1);
      train.add(smoke);
    });

    // Cow catcher
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.6 });
    const catcherGeo = new THREE.BoxGeometry(0.08, 0.12, 0.25);
    const catcher = new THREE.Mesh(catcherGeo, catcherMat);
    catcher.position.set(0.78, -0.02, 0);
    train.add(catcher);

    // Cab
    const cabGeo = new THREE.BoxGeometry(0.2, 0.25, 0.3);
    const cab = new THREE.Mesh(cabGeo, bodyMat);
    cab.position.set(-0.25, 0.2, 0);
    train.add(cab);
  }

  // Coupling hooks
  const hookMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8 });
  [-0.4, 0.4].forEach(hx => {
    const hookGeo = new THREE.BoxGeometry(0.05, 0.03, 0.04);
    const hook = new THREE.Mesh(hookGeo, hookMat);
    hook.position.set(hx, 0.02, 0);
    train.add(hook);
  });

  // Label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 56;
  const lctx = labelCanvas.getContext('2d')!;
  
  lctx.fillStyle = isHighlighted ? 'rgba(255, 255, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)';
  lctx.beginPath();
  lctx.roundRect(4, 4, 172, 48, 12);
  lctx.fill();
  
  lctx.fillStyle = isHighlighted ? '#000' : '#fff';
  lctx.font = 'bold 28px Arial';
  lctx.textAlign = 'center';
  lctx.fillText(label, 90, 38);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
  labelSprite.position.y = 0.55;
  labelSprite.scale.set(0.5, 0.16, 1);
  train.add(labelSprite);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.8, 0.45, 0.38);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.14;
    train.add(glow);
  }

  return train;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  const tileGeo = new THREE.BoxGeometry(0.26, 0.52, 0.08);
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f5f0e8',
    roughness: 0.35,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  const tile = new THREE.Mesh(tileGeo, tileMat);
  domino.add(tile);

  // Center groove
  const grooveGeo = new THREE.BoxGeometry(0.22, 0.015, 0.02);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.032;
  domino.add(groove);

  // Dots
  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.015, 16);
  const dotMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#ffffff' : '#1a1a1a',
    roughness: 0.3,
  });

  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.055, 0.065], [0.055, -0.065]],
    3: [[-0.055, 0.065], [0, 0], [0.055, -0.065]],
    4: [[-0.055, 0.065], [0.055, 0.065], [-0.055, -0.065], [0.055, -0.065]],
  };

  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];

  topDots.forEach(([dx, dy]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(dx, dy + 0.15, 0.032);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);

    const dotB = new THREE.Mesh(dotGeo, dotMat);
    dotB.position.set(-dx, -dy - 0.15, 0.032);
    dotB.rotation.x = Math.PI / 2;
    domino.add(dotB);
  });

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.3, 0.56, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  const bookWidth = 0.6;
  const bookHeight = 0.08;
  const bookDepth = 0.42;

  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  // Top cover
  const coverGeo = new THREE.BoxGeometry(bookWidth, 0.008, bookDepth);
  const topCover = new THREE.Mesh(coverGeo, coverMat);
  topCover.position.y = bookHeight / 2;
  book.add(topCover);

  // Bottom cover
  const bottomCover = new THREE.Mesh(coverGeo, coverMat);
  bottomCover.position.y = -bookHeight / 2;
  book.add(bottomCover);

  // Pages
  const pagesGeo = new THREE.BoxGeometry(bookWidth - 0.04, bookHeight - 0.016, bookDepth - 0.02);
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  book.add(pages);

  // Spine
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.75),
    roughness: 0.4,
  });
  const spineGeo = new THREE.BoxGeometry(0.025, bookHeight + 0.004, bookDepth);
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -bookWidth / 2 + 0.01;
  book.add(spine);

  // Spine ridges
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.7 });
  const ridgeGeo = new THREE.BoxGeometry(0.004, bookHeight + 0.006, 0.015);
  [-0.16, -0.08, 0, 0.08, 0.16].forEach(rz => {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(-bookWidth / 2, 0, rz);
    book.add(ridge);
  });

  // Cover title
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 240;
  coverCanvas.height = 180;
  const cctx = coverCanvas.getContext('2d')!;

  cctx.strokeStyle = '#ffd700';
  cctx.lineWidth = 6;
  cctx.strokeRect(12, 12, 216, 156);

  cctx.lineWidth = 2;
  cctx.strokeRect(22, 22, 196, 136);

  cctx.fillStyle = '#ffd700';
  cctx.font = 'bold 32px serif';
  cctx.textAlign = 'center';
  cctx.fillText(label, 120, 85);

  cctx.font = '16px serif';
  cctx.fillText('TEXTBOOK', 120, 115);

  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(bookWidth - 0.08, bookDepth - 0.06),
    new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
  );
  coverLabel.position.y = bookHeight / 2 + 0.001;
  coverLabel.rotation.x = -Math.PI / 2;
  book.add(coverLabel);

  // Bookmark
  const ribbonGeo = new THREE.PlaneGeometry(0.02, 0.14);
  const ribbonMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0.15, bookHeight / 2 + 0.02, bookDepth / 2 - 0.02);
  ribbon.rotation.x = 0.15;
  book.add(ribbon);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(bookWidth + 0.06, bookHeight + 0.04, bookDepth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    book.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return book;
}

// ==================== PLATE WITH FOOD ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  // Main plate
  const plateGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.025, 36);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#fefefe',
    roughness: 0.2,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.15 : 0,
  });
  plate.add(new THREE.Mesh(plateGeo, plateMat));

  // Plate rim
  const rimGeo = new THREE.TorusGeometry(0.3, 0.018, 12, 48);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.25 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  plate.add(rim);

  // Blue band
  const bandGeo = new THREE.TorusGeometry(0.22, 0.01, 8, 48);
  const bandMat = new THREE.MeshStandardMaterial({ color: '#2980b9' });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.014;
  plate.add(band);

  // FOOD based on plate number
  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;

  if (plateNum % 3 === 1) {
    // Rice
    const riceGeo = new THREE.SphereGeometry(0.07, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const riceMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.9 });
    const rice = new THREE.Mesh(riceGeo, riceMat);
    rice.scale.set(1.2, 0.6, 1);
    rice.position.set(-0.08, 0.02, 0);
    plate.add(rice);

    // Chicken
    const chickenGeo = new THREE.CapsuleGeometry(0.035, 0.08, 8, 16);
    const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.6 });
    const chicken = new THREE.Mesh(chickenGeo, chickenMat);
    chicken.position.set(0.08, 0.045, 0.02);
    chicken.rotation.z = 0.4;
    plate.add(chicken);

    // Peas
    const peaMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.5 });
    for (let i = 0; i < 10; i++) {
      const peaGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const pea = new THREE.Mesh(peaGeo, peaMat);
      pea.position.set(
        0.02 + Math.random() * 0.08 - 0.04,
        0.02,
        -0.08 + Math.random() * 0.06
      );
      plate.add(pea);
    }

  } else if (plateNum % 3 === 2) {
    // Spaghetti
    const spaghettiMat = new THREE.MeshStandardMaterial({ color: '#f0d58c', roughness: 0.7 });
    
    for (let layer = 0; layer < 3; layer++) {
      for (let strand = 0; strand < 6; strand++) {
        const noodleGeo = new THREE.TorusGeometry(0.05 + Math.random() * 0.03, 0.004, 6, 16);
        const noodle = new THREE.Mesh(noodleGeo, spaghettiMat);
        noodle.position.set(
          (Math.random() - 0.5) * 0.06,
          0.02 + layer * 0.01,
          (Math.random() - 0.5) * 0.06
        );
        noodle.rotation.x = Math.random() * 0.5;
        noodle.rotation.y = Math.random() * Math.PI;
        plate.add(noodle);
      }
    }

    // Sauce
    const sauceGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4 });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.05, 0);
    sauce.scale.set(1.5, 0.5, 1.5);
    plate.add(sauce);

    // Meatballs
    const meatballMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.6 });
    [[-0.04, 0.05, 0.04], [0.05, 0.055, -0.02]].forEach(([mx, my, mz]) => {
      const meatballGeo = new THREE.SphereGeometry(0.028, 12, 12);
      const meatball = new THREE.Mesh(meatballGeo, meatballMat);
      meatball.position.set(mx, my, mz);
      plate.add(meatball);
    });

  } else {
    // Salad
    const lettuceMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.7, side: THREE.DoubleSide });
    
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const leaf = new THREE.Mesh(leafGeo, lettuceMat);
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.06, 0.025, Math.sin(angle) * 0.06);
      leaf.scale.set(1.3, 0.3, 1);
      leaf.rotation.y = angle;
      plate.add(leaf);
    }

    // Tomatoes
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const tomatoGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(-0.06 + i * 0.035, 0.04, -0.02 + i * 0.01);
      plate.add(tomato);
    }

    // Cheese
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const cheeseGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018);
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set((Math.random() - 0.5) * 0.1, 0.045, (Math.random() - 0.5) * 0.1);
      plate.add(cheese);
    }
  }

  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.04, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean): THREE.Group {
  const box = new THREE.Group();

  const boxWidth = 0.55;
  const boxHeight = 0.4;
  const boxDepth = 0.45;

  const cardboardMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  // Main body
  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const body = new THREE.Mesh(bodyGeo, cardboardMat);
  box.add(body);

  // Flaps
  const flapHeight = 0.12;
  const flapAngle = isOpen ? -1.3 : 0;

  const frontFlapGeo = new THREE.BoxGeometry(boxWidth, flapHeight, 0.012);
  const frontFlap = new THREE.Mesh(frontFlapGeo, cardboardMat);
  frontFlap.position.set(0, boxHeight / 2 + (isOpen ? 0.04 : flapHeight / 2 - 0.01), boxDepth / 2 - 0.006);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);

  const backFlap = new THREE.Mesh(frontFlapGeo, cardboardMat);
  backFlap.position.set(0, boxHeight / 2 + (isOpen ? 0.04 : flapHeight / 2 - 0.01), -boxDepth / 2 + 0.006);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  const sideFlapGeo = new THREE.BoxGeometry(0.012, flapHeight, boxDepth * 0.4);
  
  const leftFlap = new THREE.Mesh(sideFlapGeo, cardboardMat);
  leftFlap.position.set(-boxWidth / 2 + 0.006, boxHeight / 2 + (isOpen ? 0.03 : flapHeight / 2 - 0.01), 0);
  leftFlap.rotation.z = isOpen ? 0.9 : 0;
  box.add(leftFlap);

  const rightFlap = new THREE.Mesh(sideFlapGeo, cardboardMat);
  rightFlap.position.set(boxWidth / 2 - 0.006, boxHeight / 2 + (isOpen ? 0.03 : flapHeight / 2 - 0.01), 0);
  rightFlap.rotation.z = isOpen ? -0.9 : 0;
  box.add(rightFlap);

  // Inside when open
  if (isOpen) {
    const insideMat = new THREE.MeshStandardMaterial({ color: '#a0734a', roughness: 0.9 });
    const insideGeo = new THREE.PlaneGeometry(boxWidth - 0.02, boxDepth - 0.02);
    const inside = new THREE.Mesh(insideGeo, insideMat);
    inside.rotation.x = -Math.PI / 2;
    inside.position.y = -boxHeight / 2 + 0.01;
    box.add(inside);

    // Items
    const itemGeo1 = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    const itemMat1 = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.5 });
    const item1 = new THREE.Mesh(itemGeo1, itemMat1);
    item1.position.set(-0.1, -boxHeight / 2 + 0.06, 0.05);
    box.add(item1);

    const itemGeo2 = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16);
    const itemMat2 = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    const item2 = new THREE.Mesh(itemGeo2, itemMat2);
    item2.position.set(0.08, -boxHeight / 2 + 0.07, -0.05);
    box.add(item2);
  }

  // Tape when closed
  if (!isOpen) {
    const tapeGeo = new THREE.BoxGeometry(0.1, 0.008, boxDepth + 0.02);
    const tapeMat = new THREE.MeshStandardMaterial({ color: '#d4a574', transparent: true, opacity: 0.75 });
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = boxHeight / 2 + flapHeight - 0.01;
    box.add(tape);
  }

  // Label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 120;
  const lctx = labelCanvas.getContext('2d')!;

  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, 180, 120);
  
  lctx.strokeStyle = '#333333';
  lctx.lineWidth = 3;
  lctx.strokeRect(3, 3, 174, 114);

  lctx.fillStyle = '#e74c3c';
  lctx.fillRect(5, 5, 170, 28);
  lctx.fillStyle = '#ffffff';
  lctx.font = 'bold 16px Arial';
  lctx.textAlign = 'center';
  lctx.fillText('⚠ FRAGILE ⚠', 90, 25);

  lctx.fillStyle = '#2c3e50';
  lctx.font = 'bold 28px Arial';
  lctx.fillText(label, 90, 65);

  lctx.fillStyle = '#666666';
  lctx.font = '11px Arial';
  lctx.fillText('HANDLE WITH CARE', 90, 85);

  lctx.font = '14px Arial';
  lctx.fillText('↑ THIS SIDE UP ↑', 90, 105);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.26),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0.02, boxDepth / 2 + 0.001);
  box.add(labelMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.08, boxHeight + 0.08, boxDepth + 0.08);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return box;
}

// ==================== REALISTIC CAR ====================

function createCar(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const car = new THREE.Group();

  // Lower body
  const bodyGeo = new THREE.BoxGeometry(0.65, 0.18, 0.32);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.7,
    roughness: 0.3,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.12;
  car.add(body);

  // Hood
  const hoodGeo = new THREE.BoxGeometry(0.18, 0.05, 0.3);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(0.24, 0.22, 0);
  hood.rotation.z = -0.12;
  car.add(hood);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(0.3, 0.14, 0.28);
  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.position.set(-0.04, 0.27, 0);
  car.add(cabin);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.28, 0.018, 0.26);
  const roofMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(-0.04, 0.35, 0);
  car.add(roof);

  // Windshield
  const windshieldGeo = new THREE.PlaneGeometry(0.26, 0.12);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#87ceeb',
    metalness: 0.5,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0.12, 0.27, 0);
  windshield.rotation.y = Math.PI / 2;
  windshield.rotation.z = 0.25;
  car.add(windshield);

  // Rear window
  const rearWindow = new THREE.Mesh(windshieldGeo, glassMat);
  rearWindow.position.set(-0.2, 0.27, 0);
  rearWindow.rotation.y = Math.PI / 2;
  rearWindow.rotation.z = -0.25;
  car.add(rearWindow);

  // Side windows
  const sideWinGeo = new THREE.PlaneGeometry(0.12, 0.09);
  [-1, 1].forEach(side => {
    const sw = new THREE.Mesh(sideWinGeo, glassMat);
    sw.position.set(-0.04, 0.28, side * 0.141);
    car.add(sw);
  });

  // Wheels
  const tireGeo = new THREE.TorusGeometry(0.055, 0.022, 12, 24);
  const tireMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
  const rimGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.028, 16);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9 });

  const wheelPos: [number, number, number][] = [
    [-0.2, 0.0, 0.16], [0.2, 0.0, 0.16],
    [-0.2, 0.0, -0.16], [0.2, 0.0, -0.16],
  ];
  
  wheelPos.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, wy, wz);
    car.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    car.add(rim);
  });

  // Headlights
  const headlightGeo = new THREE.BoxGeometry(0.012, 0.045, 0.065);
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  [-0.1, 0.1].forEach(hz => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(0.325, 0.12, hz);
    car.add(hl);
  });

  // Tail lights
  const tailGeo = new THREE.BoxGeometry(0.012, 0.04, 0.055);
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.1, 0.1].forEach(tz => {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(-0.325, 0.12, tz);
    car.add(tl);
  });

  // Grille
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.7 });
  for (let gz = -0.08; gz <= 0.08; gz += 0.02) {
    const grilleGeo = new THREE.PlaneGeometry(0.01, 0.06);
    const bar = new THREE.Mesh(grilleGeo, grilleMat);
    bar.position.set(0.326, 0.1, gz);
    bar.rotation.y = Math.PI / 2;
    car.add(bar);
  }

  // Side mirrors
  [-0.15, 0.15].forEach(mz => {
    const mirrorGeo = new THREE.BoxGeometry(0.025, 0.018, 0.028);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: '#333' });
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirror.position.set(0.08, 0.22, mz);
    car.add(mirror);
  });

  // License plate
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 96;
  plateCanvas.height = 36;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 96, 36);
  pctx.strokeStyle = '#333';
  pctx.lineWidth = 2;
  pctx.strokeRect(1, 1, 94, 34);
  pctx.fillStyle = '#2c3e50';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 48, 25);
  
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.05),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  plateMesh.position.set(-0.326, 0.06, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.7, 0.38, 0.38);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.18;
    car.add(glow);
  }

  return car;
}

// ==================== TICKET ====================

function createTicket(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const ticket = new THREE.Group();

  // Main ticket body
  const ticketGeo = new THREE.BoxGeometry(0.45, 0.26, 0.018);
  const ticketMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  ticket.add(new THREE.Mesh(ticketGeo, ticketMat));

  // Stub
  const stubGeo = new THREE.BoxGeometry(0.1, 0.26, 0.018);
  const stubMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const stub = new THREE.Mesh(stubGeo, stubMat);
  stub.position.x = 0.275;
  ticket.add(stub);

  // Perforation dots
  const dotGeo = new THREE.CircleGeometry(0.006, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide });
  for (let dy = -0.1; dy <= 0.1; dy += 0.015) {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0.22, dy, 0.01);
    ticket.add(dot);
  }

  // Front design
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 220;
  frontCanvas.height = 130;
  const fctx = frontCanvas.getContext('2d')!;

  // Stripes pattern
  fctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -120; i < 340; i += 12) {
    fctx.beginPath();
    fctx.moveTo(i, 0);
    fctx.lineTo(i + 60, 130);
    fctx.lineTo(i + 66, 130);
    fctx.lineTo(i + 6, 0);
    fctx.closePath();
    fctx.fill();
  }

  // Top banner
  fctx.fillStyle = 'rgba(0,0,0,0.3)';
  fctx.fillRect(0, 0, 220, 28);

  fctx.fillStyle = '#fff';
  fctx.font = 'bold 14px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('★ ADMIT ONE ★', 95, 20);

  // Ticket number
  fctx.font = 'bold 38px Arial';
  fctx.fillText(label, 95, 72);

  // VIP
  fctx.font = 'bold 12px Arial';
  fctx.fillText('⭐ VIP ACCESS ⭐', 95, 100);

  // Valid date
  fctx.font = '9px Arial';
  fctx.fillStyle = 'rgba(255,255,255,0.6)';
  fctx.fillText('VALID TODAY ONLY', 95, 118);

  const frontTex = new THREE.CanvasTexture(frontCanvas);
  const frontFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.24),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontFace.position.z = 0.01;
  ticket.add(frontFace);

  // Gold border
  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const hBorderGeo = new THREE.BoxGeometry(0.46, 0.006, 0.02);
  
  const topBorder = new THREE.Mesh(hBorderGeo, borderMat);
  topBorder.position.y = 0.13;
  ticket.add(topBorder);
  
  const bottomBorder = new THREE.Mesh(hBorderGeo, borderMat);
  bottomBorder.position.y = -0.13;
  ticket.add(bottomBorder);

  const vBorderGeo = new THREE.BoxGeometry(0.006, 0.26, 0.02);
  
  const leftBorder = new THREE.Mesh(vBorderGeo, borderMat);
  leftBorder.position.x = -0.225;
  ticket.add(leftBorder);
  
  const rightBorder = new THREE.Mesh(vBorderGeo, borderMat);
  rightBorder.position.x = 0.325;
  ticket.add(rightBorder);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.5, 0.3, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    ticket.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return ticket;
}

// ==================== CLIPBOARD (TODO) ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  // Wooden board
  const boardGeo = new THREE.BoxGeometry(0.42, 0.55, 0.02);
  const boardMat = new THREE.MeshStandardMaterial({
    color: '#6d4c2a',
    roughness: 0.65,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  clipboard.add(new THREE.Mesh(boardGeo, boardMat));

  // Metal clip
  const clipGeo = new THREE.BoxGeometry(0.14, 0.04, 0.025);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9, roughness: 0.2 });
  const clipBase = new THREE.Mesh(clipGeo, clipMat);
  clipBase.position.set(0, 0.29, 0.015);
  clipboard.add(clipBase);

  const clipLeverGeo = new THREE.BoxGeometry(0.08, 0.015, 0.03);
  const clipLever = new THREE.Mesh(clipLeverGeo, clipMat);
  clipLever.position.set(0, 0.31, 0.03);
  clipLever.rotation.x = -0.3;
  clipboard.add(clipLever);

  // Paper
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 200;
  paperCanvas.height = 280;
  const pctx = paperCanvas.getContext('2d')!;

  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 200, 280);

  // Color header
  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 200, 40);

  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 100, 28);

  // Task lines
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
    pctx.moveTo(12, y + 18);
    pctx.lineTo(188, y + 18);
    pctx.stroke();

    // Checkbox
    pctx.strokeStyle = '#666';
    pctx.lineWidth = 2;
    pctx.strokeRect(14, y, 16, 16);

    if (task.done) {
      // Checkmark
      pctx.strokeStyle = '#27ae60';
      pctx.lineWidth = 3;
      pctx.beginPath();
      pctx.moveTo(17, y + 8);
      pctx.lineTo(21, y + 13);
      pctx.lineTo(28, y + 4);
      pctx.stroke();

      // Strikethrough text
      pctx.fillStyle = '#999';
      pctx.font = '13px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 36, y + 13);
      
      const textWidth = pctx.measureText(task.text).width;
      pctx.strokeStyle = '#999';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.moveTo(36, y + 9);
      pctx.lineTo(36 + textWidth, y + 9);
      pctx.stroke();
    } else {
      pctx.fillStyle = '#2c3e50';
      pctx.font = '13px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 36, y + 13);
    }
  });

  // Red margin line
  pctx.strokeStyle = '#e74c3c';
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.moveTo(10, 42);
  pctx.lineTo(10, 270);
  pctx.stroke();

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.5),
    new THREE.MeshBasicMaterial({ map: paperTex })
  );
  paper.position.z = 0.012;
  clipboard.add(paper);

  // Pencil
  const pencilGroup = new THREE.Group();
  const pencilBodyGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6);
  const pencilMat = new THREE.MeshStandardMaterial({ color: '#f4d03f' });
  const pencilBody = new THREE.Mesh(pencilBodyGeo, pencilMat);
  pencilGroup.add(pencilBody);

  const pencilTipGeo = new THREE.ConeGeometry(0.007, 0.025, 6);
  const pencilTipMat = new THREE.MeshStandardMaterial({ color: '#f5deb3' });
  const pencilTip = new THREE.Mesh(pencilTipGeo, pencilTipMat);
  pencilTip.position.y = -0.11;
  pencilGroup.add(pencilTip);

  const eraserGeo = new THREE.CylinderGeometry(0.008, 0.007, 0.018, 6);
  const eraserMat = new THREE.MeshStandardMaterial({ color: '#e88b8b' });
  const eraser = new THREE.Mesh(eraserGeo, eraserMat);
  eraser.position.y = 0.11;
  pencilGroup.add(eraser);

  pencilGroup.position.set(0.14, -0.05, 0.025);
  pencilGroup.rotation.z = 0.8;
  clipboard.add(pencilGroup);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.46, 0.58, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    clipboard.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return clipboard;
}

// ==================== REALISTIC TOLL GATE ====================

function createTollGate(): THREE.Group {
  const gate = new THREE.Group();

  // Main booth structure
  const boothMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.6 });
  const boothGeo = new THREE.BoxGeometry(0.5, 0.6, 0.4);
  const booth = new THREE.Mesh(boothGeo, boothMat);
  booth.position.y = 0.3;
  gate.add(booth);

  // Booth roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.5 });
  const roofGeo = new THREE.BoxGeometry(0.6, 0.05, 0.5);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = 0.62;
  gate.add(roofMesh);

  // Roof overhang
  const overhangGeo = new THREE.BoxGeometry(0.65, 0.02, 0.55);
  const overhang = new THREE.Mesh(overhangGeo, roofMat);
  overhang.position.y = 0.66;
  gate.add(overhang);

  // Window
  const windowGeo = new THREE.PlaneGeometry(0.25, 0.2);
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: '#87ceeb', 
    transparent: true, 
    opacity: 0.7,
    side: THREE.DoubleSide 
  });
  const boothWindow = new THREE.Mesh(windowGeo, windowMat);
  boothWindow.position.set(0, 0.4, 0.201);
  gate.add(boothWindow);

  // Window frame
  const frameMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.5 });
  const hFrameGeo = new THREE.BoxGeometry(0.28, 0.015, 0.02);
  const topFrame = new THREE.Mesh(hFrameGeo, frameMat);
  topFrame.position.set(0, 0.51, 0.2);
  gate.add(topFrame);
  
  const botFrame = new THREE.Mesh(hFrameGeo, frameMat);
  botFrame.position.set(0, 0.29, 0.2);
  gate.add(botFrame);

  const vFrameGeo = new THREE.BoxGeometry(0.015, 0.22, 0.02);
  [-0.13, 0.13].forEach(fx => {
    const vFrame = new THREE.Mesh(vFrameGeo, frameMat);
    vFrame.position.set(fx, 0.4, 0.2);
    gate.add(vFrame);
  });

  // Barrier pole (left)
  const poleMat = new THREE.MeshStandardMaterial({ color: '#f39c12', metalness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 16);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(-0.35, 0.35, 0.3);
  gate.add(pole);

  // Barrier arm
  const barrierArmGeo = new THREE.BoxGeometry(0.7, 0.05, 0.05);
  const barrierMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
  const barrierArm = new THREE.Mesh(barrierArmGeo, barrierMat);
  barrierArm.position.set(-0.7, 0.68, 0.3);
  barrierArm.rotation.z = 0.15;
  gate.add(barrierArm);

  // Barrier stripes
  const stripeMatW = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  for (let sx = -0.3; sx <= 0.25; sx += 0.1) {
    const stripeGeo = new THREE.BoxGeometry(0.04, 0.055, 0.055);
    const stripeBox = new THREE.Mesh(stripeGeo, stripeMatW);
    stripeBox.position.set(-0.7 + sx, 0.68, 0.3);
    stripeBox.rotation.z = 0.15;
    gate.add(stripeBox);
  }

  // Counter / payment machine
  const machineGeo = new THREE.BoxGeometry(0.15, 0.25, 0.1);
  const machineMat = new THREE.MeshStandardMaterial({ color: '#333', metalness: 0.4 });
  const machine = new THREE.Mesh(machineGeo, machineMat);
  machine.position.set(0.2, 0.12, 0.25);
  gate.add(machine);

  // Card slot
  const slotGeo = new THREE.BoxGeometry(0.08, 0.01, 0.02);
  const slotMat = new THREE.MeshBasicMaterial({ color: '#111' });
  const slot = new THREE.Mesh(slotGeo, slotMat);
  slot.position.set(0.2, 0.2, 0.3);
  gate.add(slot);

  // Screen
  const screenGeo = new THREE.PlaneGeometry(0.1, 0.08);
  const screenMat = new THREE.MeshBasicMaterial({ color: '#00ff00' });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0.2, 0.08, 0.301);
  gate.add(screen);

  // TOLL sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 160;
  signCanvas.height = 64;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = '#2c3e50';
  sctx.fillRect(0, 0, 160, 64);
  sctx.strokeStyle = '#ffd700';
  sctx.lineWidth = 4;
  sctx.strokeRect(4, 4, 152, 56);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 32px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('TOLL', 80, 45);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
  signSprite.position.set(0, 0.82, 0);
  signSprite.scale.set(0.5, 0.2, 1);
  gate.add(signSprite);

  // Lights on top
  const lightGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const greenLightMat = new THREE.MeshBasicMaterial({ color: '#00ff00' });
  const greenLight = new THREE.Mesh(lightGeo, greenLightMat);
  greenLight.position.set(-0.15, 0.7, 0.2);
  gate.add(greenLight);

  const redLightMat = new THREE.MeshBasicMaterial({ color: '#333' });
  const redLight = new THREE.Mesh(lightGeo, redLightMat);
  redLight.position.set(0.15, 0.7, 0.2);
  gate.add(redLight);

  return gate;
}

// ==================== REALISTIC SCHOOL BUILDING ====================

function createSchoolBuilding(): THREE.Group {
  const building = new THREE.Group();

  // Main wall
  const wallMat = new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.8 });
  const mainWallGeo = new THREE.BoxGeometry(0.1, 0.9, 1.0);
  const mainWall = new THREE.Mesh(mainWallGeo, wallMat);
  mainWall.position.y = 0.45;
  building.add(mainWall);

  // Side walls
  const sideWallGeo = new THREE.BoxGeometry(0.4, 0.9, 0.08);
  [-0.46, 0.46].forEach(sz => {
    const sideWall = new THREE.Mesh(sideWallGeo, wallMat);
    sideWall.position.set(0.15, 0.45, sz);
    building.add(sideWall);
  });

  // Roof
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8b0000', roughness: 0.6 });
  const roofGeo = new THREE.BoxGeometry(0.15, 0.06, 1.1);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 0.93, 0);
  building.add(roof);

  // Roof peak
  const peakGeo = new THREE.BoxGeometry(0.5, 0.1, 0.3);
  const peak = new THREE.Mesh(peakGeo, roofMat);
  peak.position.set(0.15, 0.98, 0);
  building.add(peak);

  // Door frame
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.6 });
  const doorFrameGeo = new THREE.BoxGeometry(0.12, 0.6, 0.4);
  const doorFrame = new THREE.Mesh(doorFrameGeo, doorFrameMat);
  doorFrame.position.set(0.02, 0.3, 0);
  building.add(doorFrame);

  // Door (open)
  const doorMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.7 });
  const doorGeo = new THREE.BoxGeometry(0.02, 0.55, 0.17);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0.08, 0.28, 0.14);
  door.rotation.y = -0.9;
  building.add(door);

  // Door handle
  const handleGeo = new THREE.SphereGeometry(0.015, 8, 8);
  const handleMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0.09, 0.28, 0.08);
  building.add(handle);

  // Windows
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: '#87ceeb', 
    transparent: true, 
    opacity: 0.7,
    metalness: 0.3
  });
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.4 });

  [-0.3, 0.3].forEach(wz => {
    // Window glass
    const windowGeo = new THREE.PlaneGeometry(0.15, 0.2);
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(0.051, 0.6, wz);
    windowMesh.rotation.y = Math.PI / 2;
    building.add(windowMesh);

    // Window frame
    const wfTopGeo = new THREE.BoxGeometry(0.02, 0.02, 0.17);
    const wfTop = new THREE.Mesh(wfTopGeo, windowFrameMat);
    wfTop.position.set(0.05, 0.71, wz);
    building.add(wfTop);

    const wfBot = new THREE.Mesh(wfTopGeo, windowFrameMat);
    wfBot.position.set(0.05, 0.49, wz);
    building.add(wfBot);

    const wfSideGeo = new THREE.BoxGeometry(0.02, 0.22, 0.02);
    [-0.075, 0.075].forEach(wsz => {
      const wfSide = new THREE.Mesh(wfSideGeo, windowFrameMat);
      wfSide.position.set(0.05, 0.6, wz + wsz);
      building.add(wfSide);
    });
  });

  // School sign
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 240;
  signCanvas.height = 64;
  const sctx = signCanvas.getContext('2d')!;
  sctx.fillStyle = '#1a5276';
  sctx.fillRect(0, 0, 240, 64);
  sctx.strokeStyle = '#ffd700';
  sctx.lineWidth = 4;
  sctx.strokeRect(4, 4, 232, 56);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 20px Arial';
  sctx.textAlign = 'center';
  sctx.fillText('📚 DS ACADEMY 📚', 120, 42);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
  signSprite.position.set(0.06, 0.85, 0);
  signSprite.scale.set(0.55, 0.14, 1);
  building.add(signSprite);

  // Steps
  const stepMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', roughness: 0.7 });
  [0, 1, 2].forEach((s, i) => {
    const stepGeo = new THREE.BoxGeometry(0.08 - i * 0.015, 0.04, 0.5 - i * 0.05);
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(0.1 + i * 0.04, 0.02 + i * 0.04, 0);
    building.add(step);
  });

  // Flag pole
  const poleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
  const flagPole = new THREE.Mesh(poleGeo, poleMat);
  flagPole.position.set(0.35, 0.7, -0.35);
  building.add(flagPole);

  // Flag
  const flagGeo = new THREE.PlaneGeometry(0.15, 0.1);
  const flagMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', side: THREE.DoubleSide });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.35 + 0.08, 0.88, -0.35);
  building.add(flag);

  return building;
}

// ==================== END OF PART 2 ====================
// ==================== PART 3: BUILD SCENE + HOME COMPONENT ====================

// ==================== BUILD SCENE CONTENT ====================

function buildSceneContent(
  group: THREE.Group,
  data: DataItem[],
  highlightIndex: number | null,
  highlightIndex2: number | null,
  structure: DataStructure,
  environment: string,
  animPhase?: string,
  animData?: Record<string, unknown>
): void {
  // Clear existing
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  const spacing = structure === 'linkedlist' ? 1.1 : structure === 'queue' ? 0.95 : 0.85;
  const startX = -((data.length - 1) * spacing) / 2;

  // ==================== ARRAY ====================
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

      // Shelf
      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      const mainShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.03, 0.35), shelfMat);
      mainShelf.position.y = 0.06;
      group.add(mainShelf);

      const lip = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.04, 0.015), shelfMat);
      lip.position.set(0, 0.08, 0.175);
      group.add(lip);

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 0.5, 0.8),
        new THREE.MeshStandardMaterial({ color: '#e8dcc8', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.56;
      group.add(floor);

    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.5;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl, 0);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.8);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array');
          group.add(human);

          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.8);
          group.add(chair);

          // Desk
          const deskGeo = new THREE.BoxGeometry(0.3, 0.02, 0.2);
          const deskMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
          const desk = new THREE.Mesh(deskGeo, deskMat);
          desk.position.set(startX + i * spacing, -0.1, 0.2);
          desk.scale.setScalar(0.8);
          group.add(desk);
        }

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.42, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.5),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.35;
      group.add(floor);

      // Back wall
      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.0), wallMat);
      backWall.position.set(0, 0.1, -0.5);
      group.add(backWall);

      // Whiteboard
      const boardGeo = new THREE.BoxGeometry(roomWidth * 0.6, 0.45, 0.02);
      const boardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(0, 0.25, -0.48);
      group.add(board);

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

      // Desk
      const deskWidth = data.length * spacing + 0.5;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(deskWidth, 0.04, 0.5),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.3;
      group.add(desk);
    }
  }

  // ==================== LINKED LIST ====================
  if (structure === 'linkedlist') {
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
        }
      });

      // HEAD / TAIL labels
      const headSprite = createTextSprite('HEAD', '#ff0000', 22);
      headSprite.position.set(startX, 0.6, 0);
      headSprite.scale.set(0.35, 0.14, 1);
      group.add(headSprite);

      const tailSprite = createTextSprite('TAIL', '#0066ff', 22);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.6, 0);
      tailSprite.scale.set(0.35, 0.14, 1);
      group.add(tailSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 24);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.35, 0.25, 1);
      group.add(nullSprite);

      // Rails
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.5, 0.02, 0.03);
      [-0.12, 0.12].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.12, z);
        group.add(rail);
      });

      // Ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2, 1),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.14;
      group.add(ground);

    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl, 0);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.75);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist');
          group.add(human);
        }

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = 0.1;
          group.add(arrow);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 20);
      headSprite.position.set(startX, 0.55, 0);
      headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 22);
      nullSprite.position.set(startX + data.length * spacing, 0.1, 0);
      nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1, 0.6),
        new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.17;
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
      headSprite.position.set(startX, 0.4, 0);
      headSprite.scale.set(0.3, 0.12, 1);
      group.add(headSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 20);
      nullSprite.position.set(startX + data.length * spacing, -0.35, 0);
      nullSprite.scale.set(0.3, 0.2, 1);
      group.add(nullSprite);

      // Green felt table
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.8, 0.04, 0.6),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.3;
      group.add(table);
    }
  }

  // ==================== STACK ====================
  if (structure === 'stack') {
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
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.06;
      group.add(counter);

      // Cafeteria sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 256;
      signCanvas.height = 48;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#e74c3c';
      sctx.fillRect(0, 0, 256, 48);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 28px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🍽️ CAFETERIA 🍽️', 128, 35);
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

      // Pallet
      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.06, 0.65),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.24;
      group.add(pallet);
    }
  }

  // ==================== QUEUE ====================
  if (structure === 'queue') {
    if (environment === 'tollgate') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        car.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        car.scale.setScalar(0.82);
        applyItemAnimation(car, i, animPhase || '', animData || {}, 'queue');
        group.add(car);
      });

      // FRONT / REAR labels
      const frontSprite = createTextSprite('FRONT', '#00ff00', 20);
      frontSprite.position.set(startX, -0.22, 0);
      frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 20);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0);
      rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      // Toll gate
      const tollGate = createTollGate();
      tollGate.position.set(startX - 1.2, 0, 0);
      tollGate.scale.setScalar(0.7);
      group.add(tollGate);

      // Road
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.7),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.08;
      group.add(road);

      // Road lines
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let dx = startX - 1; dx <= startX + data.length * spacing + 0.5; dx += 0.25) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.025), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, -0.075, 0);
        group.add(dash);
      }

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
      frontSprite.position.set(startX, -0.22, 0);
      frontSprite.scale.set(0.3, 0.12, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 20);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.22, 0);
      rearSprite.scale.set(0.3, 0.12, 1);
      group.add(rearSprite);

      // Counter
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.6, 0.04, 0.4),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.15;
      group.add(counter);

      // NOW SERVING sign
      const servingCanvas = document.createElement('canvas');
      servingCanvas.width = 200;
      servingCanvas.height = 64;
      const svctx = servingCanvas.getContext('2d')!;
      svctx.fillStyle = '#1a1a2e';
      svctx.fillRect(0, 0, 200, 64);
      svctx.strokeStyle = '#ffd700';
      svctx.lineWidth = 2;
      svctx.strokeRect(3, 3, 194, 58);
      svctx.fillStyle = '#00ff00';
      svctx.font = 'bold 14px Arial';
      svctx.textAlign = 'center';
      svctx.fillText('NOW SERVING', 100, 22);
      svctx.font = 'bold 28px Arial';
      svctx.fillStyle = '#ff0';
      svctx.fillText(data.length > 0 ? data[0].label : '---', 100, 52);
      const servingSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(servingCanvas), transparent: true })
      );
      servingSprite.position.set(startX - 0.6, 0.2, 0);
      servingSprite.scale.set(0.45, 0.15, 1);
      group.add(servingSprite);

    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          // Face toward the building (left side) using -Math.PI / 2
          const human = createHuman3D(item.appearance, item.label, isHl, -Math.PI / 2);
          human.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
          human.scale.setScalar(0.68);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue');
          group.add(human);
        }
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 18);
      frontSprite.position.set(startX, -0.2, 0);
      frontSprite.scale.set(0.28, 0.1, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 18);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.2, 0);
      rearSprite.scale.set(0.28, 0.1, 1);
      group.add(rearSprite);

      // School building
      const schoolBuilding = createSchoolBuilding();
      schoolBuilding.position.set(startX - 1.0, 0, 0);
      schoolBuilding.scale.setScalar(0.6);
      group.add(schoolBuilding);

      // Pathway
      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.8, 0.5),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.y = -0.14;
      group.add(pathway);
    }
  }
}

// ==================== MAIN HOME COMPONENT ====================

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
  const [animData, setAnimData] = useState<Record<string, unknown>>({});

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

  // ==================== DATA ====================

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

  const zoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.25, 3)), []);
  const zoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.25, 0.25)), []);
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
          if (videoRef.current) videoRef.current.onloadedmetadata = () => { videoRef.current?.play(); resolve(); };
        });
      }
      setStream(newStream);
    } catch {
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
    xrSessionRef.current = null;
    xrRendererRef.current = null;
    xrSceneRef.current = null;
    xrCameraRef.current = null;
    xrGroupRef.current = null;
    xrReticleRef.current = null;
    xrHitTestSourceRef.current = null;
    setWebxrActive(false);
    setWebxrPlaced(false);
    setAppMode('surface');
  }, []);

  const stopWebXR = useCallback(() => {
    if (xrSessionRef.current) {
      try { xrSessionRef.current.end(); } catch { cleanupWebXR(); }
    } else cleanupWebXR();
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
            } else if (xrReticleRef.current) xrReticleRef.current.visible = false;
          }
        }
        renderer.render(scene, camera);
      });
      
      setWebxrActive(true);
      setWebxrPlaced(false);
      setAppMode('webxr');
    } catch (err: any) {
      console.error(err);
      alert('WebXR failed. Using Surface mode.');
      setAppMode('surface');
    }
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
      setIsDraggingSurface(true);
      dragOffsetRef.current = { x: clientX - v.x, y: clientY - v.y };
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
    if (isAnimating) return;
    setIsAnimating(true);
    const data = getArrayData();
    const index = Math.floor(Math.random() * data.length);
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
    if (isAnimating || getArrayData().length >= 6) return;
    setIsAnimating(true);
    const data = getArrayData();
    const insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);
    for (let i = data.length - 1; i >= insertIndex; i--) { setHighlightIndex(i); await delay(250); }
    (setArrayData as any)((prev: DataItem[]) => {
      const arr = [...prev];
      arr.splice(insertIndex, 0, { id: Date.now(), label: 'New', color: '#1abc9c' });
      return arr;
    });
    setHighlightIndex(insertIndex);
    setAnimPhase('insert-drop'); setAnimData({ index: insertIndex }); await delay(500);
    setAnimPhase('insert-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setOperationMessage('Inserted!'); await delay(800);
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return;
    setIsAnimating(true);
    const data = getArrayData();
    const deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]: "${data[deleteIndex].label}"`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    setAnimPhase('delete-lift'); setAnimData({ index: deleteIndex }); await delay(500);
    setAnimPhase('delete-shrink'); await delay(500);
    setHighlightIndex(null);
    (setArrayData as any)((prev: DataItem[]) => prev.filter((_: any, i: number) => i !== deleteIndex));
    await delay(500);
    setAnimPhase(''); setAnimData({});
    setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
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
    if (isAnimating || getLinkedListData().length >= 5) return;
    setIsAnimating(true);
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
    if (isAnimating || getLinkedListData().length >= 5) return;
    setIsAnimating(true);
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
    if (isAnimating || getLinkedListData().length <= 2) return;
    setIsAnimating(true);
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
    if (isAnimating) return;
    setIsAnimating(true);
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
    if (isAnimating || getStackData().length >= 5) return;
    setIsAnimating(true);
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
    if (isAnimating || getStackData().length <= 1) return;
    setIsAnimating(true);
    const data = getStackData();
    const topItem = data[data.length - 1];
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
    if (isAnimating || getStackData().length === 0) return;
    setIsAnimating(true);
    const data = getStackData();
    const topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage('Peeking TOP...');
    setCodeDisplay('// O(1)\nstack.peek()');
    setAnimPhase('stack-peek-lift'); setAnimData({ index: data.length - 1 }); await delay(400);
    setAnimPhase('stack-peek-open');
    setOperationMessage(`TOP: "${topItem.label}"`); await delay(1200);
    setAnimPhase('stack-peek-settle'); await delay(400);
    setAnimPhase(''); setAnimData({});
    setHighlightIndex(null); setOperationMessage(''); setCodeDisplay(''); setIsAnimating(false);
  };

  // ==================== QUEUE OPERATIONS ====================

  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return;
    setIsAnimating(true);
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
    if (isAnimating || getQueueData().length <= 1) return;
    setIsAnimating(true);
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
    if (isAnimating || getQueueData().length === 0) return;
    setIsAnimating(true);
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
          animPhase={animPhase} animData={animData} />
      )}

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
          </div>
        </div>
      )}

      {appMode === 'person' && !detectedPerson && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🧑</div>
          <div style={{ marginTop: 8 }}>Point camera at a person</div>
        </div>
      )}
      {appMode === 'surface' && !surfacePlaced && !webxrActive && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>👆</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div>
        </div>
      )}
      {appMode === 'webxr' && webxrActive && !webxrPlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🌐</div>
          <div style={{ marginTop: 8, fontWeight: 'bold', color: '#00ff00' }}>Scanning for surfaces...</div>
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
      background: disabled ? '#555' : color, color: 'white', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer'
    }}>{label}</button>
  );
}

// ==================== VISUALIZATION 3D ====================

function Visualization3D({ position, data, highlightIndex, highlightIndex2, structure, environment, zoomLevel, setZoomLevel, animPhase, animData }: {
  position: Position; data: DataItem[]; highlightIndex: number | null; highlightIndex2: number | null;
  structure: DataStructure; environment: string; zoomLevel: number; setZoomLevel: (z: number) => void;
  animPhase: string; animData: Record<string, unknown>;
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
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    let isDragging = false, lastX = 0, lastY = 0, pinchDist: number | null = null, pinchZoom = 1;
    
    const getDist = (t: TouchList): number | null => {
      if (t.length < 2) return null;
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
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
        if (d) setZoomLevel(Math.max(0.25, Math.min(3, pinchZoom * (d / pinchDist))));
      } else if (e.touches.length === 1 && isDragging) {
        rotationRef.current.y += (e.touches[0].clientX - lastX) * 0.01;
        rotationRef.current.x += (e.touches[0].clientY - lastY) * 0.008;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
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
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMU = () => { isDragging = false; };
    const onWH = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(Math.max(0.25, Math.min(3, zoomRef.current + (e.deltaY > 0 ? -0.15 : 0.15))));
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
  }, [structure, renderWidth, renderHeight, setZoomLevel]);

  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(groupRef.current, data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData);
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData]);

  return <div ref={containerRef} style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 50, touchAction: 'none', pointerEvents: 'auto' }} />;
}

// ==================== END OF COMPLETE CODE ====================