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
  
  // Arrow line with glow effect
  const points = [new THREE.Vector3(fromX + 0.35, midY, 0), new THREE.Vector3(toX - 0.35, midY, 0)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 3 });
  arrow.add(new THREE.Line(lineGeo, lineMat));

  // Arrow head (cone)
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

  // Skin material with subsurface scattering look
  const skinMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.6,
    metalness: 0.0,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.2,
  });

  // ===== BODY PROPORTIONS (More realistic) =====
  const bodyScale = 0.9;
  
  // ===== HEAD GROUP =====
  const headGroup = new THREE.Group();

  // Head - slightly oval shaped skull
  const headGeo = new THREE.SphereGeometry(0.12, 32, 32);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.scale.set(0.85, 1.0, 0.9);
  headGroup.add(head);

  // Face structure - forehead, cheekbones, jaw
  const faceGeo = new THREE.SphereGeometry(0.11, 32, 32);
  const face = new THREE.Mesh(faceGeo, skinMat);
  face.scale.set(0.8, 0.85, 0.5);
  face.position.set(0, -0.02, 0.04);
  headGroup.add(face);

  // ===== EYES (Detailed) =====
  const eyeGroup = new THREE.Group();
  
  [-0.035, 0.035].forEach((x, idx) => {
    // Eye socket (slight indent)
    const socketGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const socketMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.7 });
    const socket = new THREE.Mesh(socketGeo, socketMat);
    socket.scale.set(1, 0.6, 0.3);
    socket.position.set(x, 0.02, 0.08);
    eyeGroup.add(socket);

    // Eyeball
    const eyeballGeo = new THREE.SphereGeometry(0.018, 24, 24);
    const eyeballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.1 });
    const eyeball = new THREE.Mesh(eyeballGeo, eyeballMat);
    eyeball.position.set(x, 0.02, 0.09);
    eyeball.scale.set(1, 0.85, 0.7);
    eyeGroup.add(eyeball);

    // Iris
    const irisGeo = new THREE.CircleGeometry(0.008, 24);
    const irisColors = ['#4a3728', '#2e5a1c', '#1e4a6d', '#3d2314'];
    const irisMat = new THREE.MeshBasicMaterial({ color: irisColors[idx % irisColors.length] });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(x, 0.02, 0.102);
    eyeGroup.add(iris);

    // Pupil
    const pupilGeo = new THREE.CircleGeometry(0.004, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(x, 0.02, 0.103);
    eyeGroup.add(pupil);

    // Eye shine/reflection
    const shineGeo = new THREE.CircleGeometry(0.002, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.position.set(x + 0.003, 0.025, 0.104);
    eyeGroup.add(shine);

    // Upper eyelid
    const upperLidGeo = new THREE.SphereGeometry(0.02, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
    const lidMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.6 });
    const upperLid = new THREE.Mesh(upperLidGeo, lidMat);
    upperLid.position.set(x, 0.028, 0.085);
    upperLid.scale.set(1, 0.5, 0.5);
    eyeGroup.add(upperLid);

    // Eyelashes (for female)
    if (appearance.gender === 'female') {
      const lashMat = new THREE.MeshBasicMaterial({ color: '#1a1a1a' });
      for (let l = -3; l <= 3; l++) {
        const lashGeo = new THREE.CylinderGeometry(0.001, 0.0005, 0.008, 4);
        const lash = new THREE.Mesh(lashGeo, lashMat);
        lash.position.set(x + l * 0.004, 0.035, 0.095);
        lash.rotation.x = -0.3;
        lash.rotation.z = l * 0.1;
        eyeGroup.add(lash);
      }
    }
  });
  headGroup.add(eyeGroup);

  // ===== EYEBROWS =====
  const browMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
  [-0.035, 0.035].forEach((x, idx) => {
    const browGeo = new THREE.BoxGeometry(0.035, 0.008, 0.01);
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(x, 0.055, 0.085);
    brow.rotation.z = idx === 0 ? -0.1 : 0.1;
    headGroup.add(brow);
  });

  // ===== NOSE (Detailed) =====
  const noseGroup = new THREE.Group();
  
  // Nose bridge
  const bridgeGeo = new THREE.BoxGeometry(0.015, 0.04, 0.02);
  const noseMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.65 });
  const bridge = new THREE.Mesh(bridgeGeo, noseMat);
  bridge.position.set(0, 0, 0.1);
  noseGroup.add(bridge);

  // Nose tip
  const tipGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const tip = new THREE.Mesh(tipGeo, noseMat);
  tip.position.set(0, -0.02, 0.11);
  tip.scale.set(1, 0.7, 0.8);
  noseGroup.add(tip);

  // Nostrils
  const nostrilMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a' });
  [-0.008, 0.008].forEach(x => {
    const nostrilGeo = new THREE.SphereGeometry(0.005, 8, 8);
    const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
    nostril.position.set(x, -0.028, 0.1);
    noseGroup.add(nostril);
  });

  headGroup.add(noseGroup);

  // ===== MOUTH (Detailed) =====
  const mouthGroup = new THREE.Group();

  // Upper lip
  const upperLipGeo = new THREE.TorusGeometry(0.02, 0.005, 8, 16, Math.PI);
  const lipColor = appearance.gender === 'female' ? '#c44569' : '#b87a6b';
  const lipMat = new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.4 });
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.05, 0.09);
  upperLip.rotation.x = Math.PI;
  upperLip.scale.set(1, 0.6, 1);
  mouthGroup.add(upperLip);

  // Lower lip
  const lowerLipGeo = new THREE.TorusGeometry(0.018, 0.006, 8, 16, Math.PI);
  const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
  lowerLip.position.set(0, -0.058, 0.088);
  lowerLip.scale.set(1, 0.7, 1);
  mouthGroup.add(lowerLip);

  // Mouth line
  const mouthLineGeo = new THREE.BoxGeometry(0.03, 0.002, 0.002);
  const mouthLineMat = new THREE.MeshBasicMaterial({ color: '#8b4a4a' });
  const mouthLine = new THREE.Mesh(mouthLineGeo, mouthLineMat);
  mouthLine.position.set(0, -0.052, 0.095);
  mouthGroup.add(mouthLine);

  headGroup.add(mouthGroup);

  // ===== EARS =====
  [-0.1, 0.1].forEach(x => {
    const earGroup = new THREE.Group();
    
    // Outer ear
    const outerEarGeo = new THREE.TorusGeometry(0.02, 0.008, 8, 16, Math.PI * 1.5);
    const earMat = new THREE.MeshStandardMaterial({ color: appearance.skinTone, roughness: 0.6 });
    const outerEar = new THREE.Mesh(outerEarGeo, earMat);
    outerEar.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    outerEar.rotation.z = Math.PI / 2;
    earGroup.add(outerEar);

    // Ear lobe
    const lobeGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const lobe = new THREE.Mesh(lobeGeo, earMat);
    lobe.position.set(0, -0.018, 0);
    lobe.scale.set(0.5, 0.8, 0.6);
    earGroup.add(lobe);

    // Inner ear
    const innerGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const innerMat = new THREE.MeshStandardMaterial({ color: '#d4a574', roughness: 0.5 });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(x > 0 ? -0.005 : 0.005, 0, 0);
    earGroup.add(inner);

    earGroup.position.set(x, 0.01, 0);
    headGroup.add(earGroup);
  });

  // ===== HAIR (Realistic) =====
  const hairMat = new THREE.MeshStandardMaterial({ 
    color: appearance.hairColor, 
    roughness: 0.8,
    metalness: 0.1
  });

  if (appearance.hairStyle !== 'bald') {
    if (appearance.hairStyle === 'long') {
      // Long hair base
      const hairBaseGeo = new THREE.SphereGeometry(0.13, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6);
      const hairBase = new THREE.Mesh(hairBaseGeo, hairMat);
      hairBase.position.set(0, 0.02, -0.01);
      hairBase.scale.set(0.9, 0.95, 0.95);
      headGroup.add(hairBase);

      // Hair flowing down (multiple strands)
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const strandGeo = new THREE.CapsuleGeometry(0.02, 0.15, 8, 16);
        const strand = new THREE.Mesh(strandGeo, hairMat);
        const radius = 0.08;
        strand.position.set(
          Math.sin(angle) * radius,
          -0.05,
          Math.cos(angle) * radius - 0.02
        );
        strand.rotation.x = 0.2;
        strand.rotation.z = Math.sin(angle) * 0.15;
        headGroup.add(strand);
      }

      // Front bangs for female
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
      // Short hair
      const shortHairGeo = new THREE.SphereGeometry(0.125, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const shortHair = new THREE.Mesh(shortHairGeo, hairMat);
      shortHair.position.set(0, 0.02, 0);
      shortHair.scale.set(0.88, 0.9, 0.9);
      headGroup.add(shortHair);

      // Hair texture bumps
      for (let i = 0; i < 30; i++) {
        const bumpGeo = new THREE.SphereGeometry(0.015, 6, 6);
        const bump = new THREE.Mesh(bumpGeo, hairMat);
        const theta = Math.random() * Math.PI * 0.4;
        const phi = Math.random() * Math.PI * 2;
        bump.position.set(
          Math.sin(theta) * Math.cos(phi) * 0.11,
          Math.cos(theta) * 0.11 + 0.02,
          Math.sin(theta) * Math.sin(phi) * 0.11
        );
        headGroup.add(bump);
      }
    }
  }

  // ===== CHIN =====
  const chinGeo = new THREE.SphereGeometry(0.05, 16, 16);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.position.set(0, -0.09, 0.04);
  chin.scale.set(1, 0.6, 0.8);
  headGroup.add(chin);

  headGroup.position.y = 0.42 * bodyScale;
  human.add(headGroup);

  // ===== NECK =====
  const neckGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.06, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.28 * bodyScale;
  human.add(neck);

  // ===== TORSO (Upper Body) =====
  const torsoGroup = new THREE.Group();

  // Shirt material
  const shirtMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.7,
    metalness: 0.0,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });

  // Main torso (chest)
  const chestGeo = new THREE.BoxGeometry(0.22, 0.18, 0.12);
  const chest = new THREE.Mesh(chestGeo, shirtMat);
  chest.position.y = 0.09;
  torsoGroup.add(chest);

  // Chest rounding
  const chestRoundGeo = new THREE.SphereGeometry(0.11, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const chestRound = new THREE.Mesh(chestRoundGeo, shirtMat);
  chestRound.position.set(0, 0.09, 0.01);
  chestRound.scale.set(1, 0.8, 0.5);
  chestRound.rotation.x = Math.PI / 2;
  torsoGroup.add(chestRound);

  // Shoulders
  [-0.12, 0.12].forEach(x => {
    const shoulderGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const shoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    shoulder.position.set(x, 0.16, 0);
    shoulder.scale.set(1, 0.8, 0.9);
    torsoGroup.add(shoulder);
  });

  // Collar (for shirt detail)
  const collarGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 16, Math.PI);
  const collarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 0.17, 0.04);
  collar.rotation.x = -0.3;
  torsoGroup.add(collar);

  // Buttons
  const buttonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.2 });
  [0.12, 0.06, 0].forEach(y => {
    const buttonGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12);
    const button = new THREE.Mesh(buttonGeo, buttonMat);
    button.position.set(0, y, 0.065);
    button.rotation.x = Math.PI / 2;
    torsoGroup.add(button);
  });

  // Lower torso (abdomen)
  const abdomenGeo = new THREE.BoxGeometry(0.2, 0.1, 0.1);
  const abdomen = new THREE.Mesh(abdomenGeo, shirtMat);
  abdomen.position.y = -0.02;
  torsoGroup.add(abdomen);

  torsoGroup.position.y = 0.08 * bodyScale;
  human.add(torsoGroup);

  // ===== ARMS =====
  [-1, 1].forEach(side => {
    const armGroup = new THREE.Group();

    // Upper arm (shirt sleeve)
    const upperArmGeo = new THREE.CapsuleGeometry(0.032, 0.1, 8, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    upperArm.position.y = -0.02;
    armGroup.add(upperArm);

    // Sleeve cuff
    const cuffGeo = new THREE.CylinderGeometry(0.035, 0.032, 0.02, 12);
    const cuff = new THREE.Mesh(cuffGeo, shirtMat);
    cuff.position.y = -0.08;
    armGroup.add(cuff);

    // Forearm (skin)
    const forearmGeo = new THREE.CapsuleGeometry(0.025, 0.08, 8, 16);
    const forearm = new THREE.Mesh(forearmGeo, skinMat);
    forearm.position.y = -0.15;
    armGroup.add(forearm);

    // Wrist
    const wristGeo = new THREE.CylinderGeometry(0.02, 0.022, 0.015, 12);
    const wrist = new THREE.Mesh(wristGeo, skinMat);
    wrist.position.y = -0.2;
    armGroup.add(wrist);

    // Hand
    const handGeo = new THREE.BoxGeometry(0.04, 0.05, 0.02);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.235;
    armGroup.add(hand);

    // Fingers (simplified)
    for (let f = 0; f < 4; f++) {
      const fingerGeo = new THREE.CapsuleGeometry(0.005, 0.02, 4, 8);
      const finger = new THREE.Mesh(fingerGeo, skinMat);
      finger.position.set(-0.012 + f * 0.008, -0.27, 0);
      armGroup.add(finger);
    }

    // Thumb
    const thumbGeo = new THREE.CapsuleGeometry(0.006, 0.018, 4, 8);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(side * 0.025, -0.24, 0.01);
    thumb.rotation.z = side * 0.5;
    armGroup.add(thumb);

    armGroup.position.set(side * 0.14 * bodyScale, 0.22 * bodyScale, 0);
    armGroup.rotation.z = side * 0.1;
    human.add(armGroup);
  });

  // ===== BELT =====
  const beltGeo = new THREE.CylinderGeometry(0.08, 0.075, 0.025, 16);
  const beltMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = -0.02 * bodyScale;
  human.add(belt);

  // Belt buckle
  const buckleGeo = new THREE.BoxGeometry(0.03, 0.02, 0.008);
  const buckleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8, roughness: 0.2 });
  const buckle = new THREE.Mesh(buckleGeo, buckleMat);
  buckle.position.set(0, -0.02 * bodyScale, 0.075);
  human.add(buckle);

  // ===== PANTS / LEGS =====
  const pantsMat = new THREE.MeshStandardMaterial({
    color: appearance.pantsColor,
    roughness: 0.8,
  });

  // Hips
  const hipsGeo = new THREE.BoxGeometry(0.18, 0.08, 0.1);
  const hips = new THREE.Mesh(hipsGeo, pantsMat);
  hips.position.y = -0.07 * bodyScale;
  human.add(hips);

  // Legs
  [-0.045, 0.045].forEach(x => {
    const legGroup = new THREE.Group();

    // Upper leg (thigh)
    const thighGeo = new THREE.CapsuleGeometry(0.04, 0.12, 8, 16);
    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.position.y = -0.02;
    legGroup.add(thigh);

    // Knee area
    const kneeGeo = new THREE.SphereGeometry(0.038, 12, 12);
    const knee = new THREE.Mesh(kneeGeo, pantsMat);
    knee.position.y = -0.1;
    legGroup.add(knee);

    // Lower leg (calf)
    const calfGeo = new THREE.CapsuleGeometry(0.032, 0.12, 8, 16);
    const calf = new THREE.Mesh(calfGeo, pantsMat);
    calf.position.y = -0.2;
    legGroup.add(calf);

    // Ankle
    const ankleGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.02, 12);
    const ankle = new THREE.Mesh(ankleGeo, pantsMat);
    ankle.position.y = -0.28;
    legGroup.add(ankle);

    legGroup.position.set(x * bodyScale, -0.12 * bodyScale, 0);
    human.add(legGroup);
  });

  // ===== SHOES =====
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6, metalness: 0.1 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.9 });

  [-0.045, 0.045].forEach(x => {
    const shoeGroup = new THREE.Group();

    // Shoe body
    const shoeBodyGeo = new THREE.BoxGeometry(0.05, 0.025, 0.08);
    const shoeBody = new THREE.Mesh(shoeBodyGeo, shoeMat);
    shoeGroup.add(shoeBody);

    // Shoe toe (rounded)
    const toeGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const toe = new THREE.Mesh(toeGeo, shoeMat);
    toe.position.set(0, -0.005, 0.03);
    toe.scale.set(1, 0.6, 0.8);
    shoeGroup.add(toe);

    // Shoe heel
    const heelGeo = new THREE.BoxGeometry(0.04, 0.015, 0.03);
    const heel = new THREE.Mesh(heelGeo, shoeMat);
    heel.position.set(0, -0.02, -0.025);
    shoeGroup.add(heel);

    // Sole
    const soleGeo = new THREE.BoxGeometry(0.052, 0.008, 0.085);
    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.y = -0.016;
    shoeGroup.add(sole);

    // Laces
    const laceMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    for (let l = 0; l < 3; l++) {
      const laceGeo = new THREE.BoxGeometry(0.03, 0.003, 0.003);
      const lace = new THREE.Mesh(laceGeo, laceMat);
      lace.position.set(0, 0.015, -0.01 + l * 0.015);
      shoeGroup.add(lace);
    }

    shoeGroup.position.set(x * bodyScale, -0.42 * bodyScale, 0.01);
    human.add(shoeGroup);
  });

  // ===== NAME TAG =====
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 256;
  nameCanvas.height = 64;
  const nctx = nameCanvas.getContext('2d')!;

  // Background
  if (isHighlighted) {
    nctx.fillStyle = '#ffff00';
    nctx.strokeStyle = '#000000';
  } else {
    nctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    nctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  }
  nctx.beginPath();
  nctx.roundRect(10, 8, 236, 48, 12);
  nctx.fill();
  nctx.lineWidth = 2;
  nctx.stroke();

  // Text
  nctx.fillStyle = isHighlighted ? '#000000' : '#ffffff';
  nctx.font = 'bold 28px Arial';
  nctx.textAlign = 'center';
  nctx.fillText(name, 128, 42);

  const nameTex = new THREE.CanvasTexture(nameCanvas);
  const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true }));
  nameSprite.position.y = 0.6 * bodyScale;
  nameSprite.scale.set(0.4, 0.1, 1);
  human.add(nameSprite);

  // ===== HIGHLIGHT EFFECTS =====
  if (isHighlighted) {
    // Ground ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.18, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.43 * bodyScale;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);

    // Arrow pointing down
    const arrowGeo = new THREE.ConeGeometry(0.05, 0.1, 8);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffff00' });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.position.y = 0.72 * bodyScale;
    arrowMesh.rotation.z = Math.PI;
    human.add(arrowMesh);
  }

  // Apply facing direction
  human.rotation.y = facingDirection;

  return human;
}

// ==================== CHAIR (Improved) ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  
  const woodMat = new THREE.MeshStandardMaterial({ 
    color: '#8b4513', 
    roughness: 0.7,
    metalness: 0.05 
  });
  const metalMat = new THREE.MeshStandardMaterial({ 
    color: '#404040', 
    roughness: 0.3, 
    metalness: 0.8 
  });

  // Seat (cushioned look)
  const seatGeo = new THREE.BoxGeometry(0.28, 0.035, 0.28);
  const seatMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.8 });
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.y = -0.15;
  chair.add(seat);

  // Seat cushion top
  const cushionGeo = new THREE.BoxGeometry(0.26, 0.02, 0.26);
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.9 });
  const cushion = new THREE.Mesh(cushionGeo, cushionMat);
  cushion.position.y = -0.125;
  chair.add(cushion);

  // Back rest
  const backGeo = new THREE.BoxGeometry(0.26, 0.22, 0.025);
  const back = new THREE.Mesh(backGeo, seatMat);
  back.position.set(0, 0.0, -0.12);
  chair.add(back);

  // Back rest cushion
  const backCushionGeo = new THREE.BoxGeometry(0.24, 0.2, 0.015);
  const backCushion = new THREE.Mesh(backCushionGeo, cushionMat);
  backCushion.position.set(0, 0.0, -0.11);
  chair.add(backCushion);

  // Metal frame legs
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8);
  const legPositions: [number, number, number][] = [
    [-0.1, -0.29, 0.1],
    [0.1, -0.29, 0.1],
    [-0.1, -0.29, -0.1],
    [0.1, -0.29, -0.1]
  ];
  
  legPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  // Cross bars
  const crossGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6);
  
  // Front cross bar
  const frontCross = new THREE.Mesh(crossGeo, metalMat);
  frontCross.rotation.z = Math.PI / 2;
  frontCross.position.set(0, -0.35, 0.1);
  chair.add(frontCross);

  // Back cross bar
  const backCross = new THREE.Mesh(crossGeo, metalMat);
  backCross.rotation.z = Math.PI / 2;
  backCross.position.set(0, -0.35, -0.1);
  chair.add(backCross);

  // Side cross bars
  const sideCrossGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6);
  [-0.1, 0.1].forEach(sx => {
    const sideCross = new THREE.Mesh(sideCrossGeo, metalMat);
    sideCross.rotation.x = Math.PI / 2;
    sideCross.position.set(sx, -0.35, 0);
    chair.add(sideCross);
  });

  chair.position.x = x;
  return chair;
}

// ==================== GROCERY BOX (Improved) ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();
  const boxWidth = 0.32;
  const boxHeight = 0.5;
  const boxDepth = 0.2;

  // Main box body with rounded edges feel
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

  // Front label (detailed product design)
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 160;
  frontCanvas.height = 250;
  const fctx = frontCanvas.getContext('2d')!;

  // White background
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, 160, 250);

  // Color header
  fctx.fillStyle = color;
  fctx.fillRect(0, 0, 160, 60);

  // Brand name
  fctx.fillStyle = '#ffffff';
  fctx.font = 'bold 14px Arial';
  fctx.textAlign = 'center';
  fctx.fillText('FRESH', 80, 25);
  fctx.font = 'bold 18px Arial';
  fctx.fillText('MARKET', 80, 48);

  // Product icon
  const icons: Record<string, string> = {
    'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚',
    'Apple': '🍎', 'Juice': '🧃', 'New': '🆕'
  };
  fctx.font = '50px Arial';
  fctx.fillText(icons[label] || '📦', 80, 130);

  // Product name
  fctx.fillStyle = '#2c3e50';
  fctx.font = 'bold 22px Arial';
  fctx.fillText(label, 80, 170);

  // Description
  fctx.fillStyle = '#666';
  fctx.font = '10px Arial';
  fctx.fillText('Premium Quality', 80, 190);
  fctx.fillText('100% Natural', 80, 205);

  // Barcode
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

  // Price tag
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

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.08, boxHeight + 0.08, boxDepth + 0.08);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15 
    });
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
  animData: Record<string, any>,
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
      obj.scale.multiplyScalar(1.15 + Math.sin(time * 12) * 0.05);
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.1;
    } else if (animPhase === 'insert-shift' && animData.insertIndex !== undefined && itemIndex >= animData.insertIndex) {
      obj.position.y += 0.08;
      obj.position.x += 0.02;
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.6 + Math.sin(time * 15) * 0.1;
      obj.scale.multiplyScalar(0.5 + Math.sin(time * 10) * 0.1);
      obj.rotation.z = Math.sin(time * 8) * 0.2;
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.12;
      obj.scale.multiplyScalar(1.08);
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.4 + Math.sin(time * 12) * 0.05;
      obj.rotation.z = 0.3 + Math.sin(time * 8) * 0.1;
      obj.scale.multiplyScalar(1.1);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 5;
    } else if (animPhase === 'delete-close' && animData.deleteIndex !== undefined && itemIndex >= animData.deleteIndex) {
      obj.position.y += 0.05;
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.4;
      obj.rotation.z = isTarget1 ? 0.15 : -0.15;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45;
      obj.rotation.z = (isTarget1 ? -0.2 : 0.2) + Math.sin(time * 10) * 0.05;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.15;
      obj.scale.multiplyScalar(1.1);
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.4 + Math.sin(time * 10) * 0.08;
      obj.scale.multiplyScalar(0.6 + Math.sin(time * 8) * 0.1);
      obj.rotation.z = Math.sin(time * 6) * 0.15;
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.4 + Math.sin(time * 10) * 0.08;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.4 + Math.sin(time * 12) * 0.06;
      obj.rotation.z = 0.3;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 4;
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.15 + Math.sin(time * 8) * 0.05;
      obj.scale.multiplyScalar(1.12 + Math.sin(time * 10) * 0.03);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.5 + Math.sin(time * 12) * 0.1;
      obj.scale.multiplyScalar(0.7);
      obj.rotation.z = Math.sin(time * 8) * 0.15;
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.1;
      obj.scale.multiplyScalar(1.06);
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.35 + Math.sin(time * 10) * 0.05;
      obj.rotation.z = -0.25;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.8;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = time * 5;
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.2 + Math.sin(time * 8) * 0.03;
      obj.rotation.z = Math.sin(time * 6) * 0.08;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.25;
      obj.scale.multiplyScalar(1.12 + Math.sin(time * 10) * 0.03);
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.08;
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 0.8 + Math.sin(time * 8) * 0.1;
      obj.scale.multiplyScalar(0.6);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.15;
      obj.scale.multiplyScalar(1.05);
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 0.6;
      obj.scale.multiplyScalar(0.85);
      obj.rotation.y = Math.sin(time * 6) * 0.15;
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.2;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.15 + Math.sin(time * 8) * 0.04;
      obj.scale.multiplyScalar(1.1 + Math.sin(time * 10) * 0.03);
    }
  }
}

// ==================== END OF PART 1 ====================
// ==================== PART 2: REALISTIC 3D OBJECTS ====================
// Place right after Part 1

// ==================== REALISTIC TRAIN CAR ====================

function createTrainCar(isEngine: boolean, color: string, label: string, isHighlighted: boolean): THREE.Group {
  const train = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({ 
    color: '#4a4a4a', 
    metalness: 0.8, 
    roughness: 0.3 
  });

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

  // Body detail stripe
  const stripeGeo = new THREE.BoxGeometry(0.76, 0.03, 0.33);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.2;
  train.add(stripe);

  // Lower stripe
  const lowerStripeGeo = new THREE.BoxGeometry(0.76, 0.02, 0.33);
  const lowerStripe = new THREE.Mesh(lowerStripeGeo, stripeMat);
  lowerStripe.position.y = 0.05;
  train.add(lowerStripe);

  // Roof (curved)
  const roofGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.7, 16, 1, false, 0, Math.PI);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2c2c2c', metalness: 0.5, roughness: 0.4 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 0.32;
  train.add(roof);

  // Roof edge trim
  const roofTrimGeo = new THREE.BoxGeometry(0.72, 0.015, 0.01);
  const roofTrimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.8 });
  [-0.16, 0.16].forEach(z => {
    const trim = new THREE.Mesh(roofTrimGeo, roofTrimMat);
    trim.position.set(0, 0.32, z);
    train.add(trim);
  });

  // Undercarriage
  const underGeo = new THREE.BoxGeometry(0.7, 0.05, 0.26);
  const underMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6, roughness: 0.5 });
  const under = new THREE.Mesh(underGeo, underMat);
  under.position.y = -0.06;
  train.add(under);

  // Wheels with realistic detail
  const wheelPositions: [number, number, number][] = [
    [-0.24, -0.06, 0.16], [0.24, -0.06, 0.16],
    [-0.24, -0.06, -0.16], [0.24, -0.06, -0.16],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();

    // Main wheel
    const wheelGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.025, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7, roughness: 0.3 });
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheelGroup.add(wheel);

    // Wheel rim
    const rimGeo = new THREE.TorusGeometry(0.055, 0.008, 8, 24);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.9, roughness: 0.1 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = wz > 0 ? 0.014 : -0.014;
    wheelGroup.add(rim);

    // Hub cap
    const hubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 16);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.1 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(hub);

    // Spokes
    const spokeMat = new THREE.MeshStandardMaterial({ color: '#999999', metalness: 0.8 });
    for (let s = 0; s < 6; s++) {
      const spokeGeo = new THREE.BoxGeometry(0.005, 0.08, 0.005);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = (s / 6) * Math.PI;
      spoke.position.z = wz > 0 ? 0.014 : -0.014;
      wheelGroup.add(spoke);
    }

    wheelGroup.position.set(wx, wy, wz);
    train.add(wheelGroup);
  });

  // Windows (for passenger cars)
  if (!isEngine) {
    const windowGeo = new THREE.PlaneGeometry(0.1, 0.1);
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#87ceeb',
      metalness: 0.5,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    [-0.22, 0, 0.22].forEach(x => {
      // Front windows
      const windowF = new THREE.Mesh(windowGeo, windowMat);
      windowF.position.set(x, 0.18, 0.162);
      train.add(windowF);

      // Window frame
      const frameMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.6 });
      const frameGeo = new THREE.BoxGeometry(0.12, 0.12, 0.008);
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(x, 0.18, 0.163);
      train.add(frame);

      // Back windows
      const windowB = new THREE.Mesh(windowGeo, windowMat);
      windowB.position.set(x, 0.18, -0.162);
      train.add(windowB);
    });

    // Door
    const doorGeo = new THREE.BoxGeometry(0.12, 0.22, 0.01);
    const doorMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.4 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(-0.32, 0.12, 0.16);
    train.add(door);

    // Door handle
    const handleGeo = new THREE.BoxGeometry(0.02, 0.008, 0.015);
    const handleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(-0.28, 0.12, 0.17);
    train.add(handle);
  }

  // Engine specific parts
  if (isEngine) {
    // Boiler (main cylinder)
    const boilerGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.35, 24);
    const boilerMat = new THREE.MeshStandardMaterial({ 
      color: '#b71c1c', 
      metalness: 0.5, 
      roughness: 0.4 
    });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.55, 0.14, 0);
    train.add(boiler);

    // Boiler bands
    const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8, roughness: 0.2 });
    [0.42, 0.52, 0.62, 0.72].forEach(x => {
      const bandGeo = new THREE.TorusGeometry(0.15, 0.01, 8, 24);
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(x, 0.14, 0);
      band.rotation.y = Math.PI / 2;
      train.add(band);
    });

    // Boiler front plate
    const frontPlateGeo = new THREE.CircleGeometry(0.14, 24);
    const frontPlateMat = new THREE.MeshStandardMaterial({ 
      color: '#222222', 
      metalness: 0.7, 
      side: THREE.DoubleSide 
    });
    const frontPlate = new THREE.Mesh(frontPlateGeo, frontPlateMat);
    frontPlate.position.set(0.73, 0.14, 0);
    frontPlate.rotation.y = Math.PI / 2;
    train.add(frontPlate);

    // Headlight
    const headlightGroup = new THREE.Group();
    const headlightBodyGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.06, 16);
    const headlightBodyMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.7 });
    const headlightBody = new THREE.Mesh(headlightBodyGeo, headlightBodyMat);
    headlightBody.rotation.z = Math.PI / 2;
    headlightGroup.add(headlightBody);

    const lensGeo = new THREE.CircleGeometry(0.035, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.x = 0.032;
    lens.rotation.y = Math.PI / 2;
    headlightGroup.add(lens);

    // Headlight glow
    const glowGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffffcc', 
      transparent: true, 
      opacity: 0.3 
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.x = 0.04;
    headlightGroup.add(glow);

    headlightGroup.position.set(0.75, 0.26, 0);
    train.add(headlightGroup);

    // Chimney (smokestack)
    const chimneyGroup = new THREE.Group();
    
    const chimneyBaseGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.04, 12);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.6 });
    const chimneyBase = new THREE.Mesh(chimneyBaseGeo, chimneyMat);
    chimneyGroup.add(chimneyBase);

    const chimneyBodyGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.15, 12);
    const chimneyBody = new THREE.Mesh(chimneyBodyGeo, chimneyMat);
    chimneyBody.position.y = 0.095;
    chimneyGroup.add(chimneyBody);

    const chimneyTopGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.03, 12);
    const chimneyTop = new THREE.Mesh(chimneyTopGeo, chimneyMat);
    chimneyTop.position.y = 0.18;
    chimneyGroup.add(chimneyTop);

    chimneyGroup.position.set(0.25, 0.3, 0);
    train.add(chimneyGroup);

    // Steam/smoke puffs
    const smokeMat = new THREE.MeshBasicMaterial({ 
      color: '#cccccc', 
      transparent: true, 
      opacity: 0.4 
    });
    [
      { y: 0.55, s: 0.05, x: 0.25 },
      { y: 0.65, s: 0.07, x: 0.22 },
      { y: 0.75, s: 0.09, x: 0.18 },
      { y: 0.88, s: 0.11, x: 0.14 },
    ].forEach(({ y, s, x }) => {
      const smokeGeo = new THREE.SphereGeometry(s, 12, 12);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(x, y, (Math.random() - 0.5) * 0.1);
      train.add(smoke);
    });

    // Cow catcher (pilot)
    const catcherGroup = new THREE.Group();
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.6 });
    
    // V-shape frame
    const vBarGeo = new THREE.BoxGeometry(0.15, 0.04, 0.02);
    [-0.12, 0.12].forEach(z => {
      const vBar = new THREE.Mesh(vBarGeo, catcherMat);
      vBar.position.set(0.05, 0, z);
      vBar.rotation.y = z > 0 ? 0.4 : -0.4;
      catcherGroup.add(vBar);
    });

    // Horizontal bars
    for (let i = 0; i < 4; i++) {
      const hBarGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.25, 8);
      const hBar = new THREE.Mesh(hBarGeo, catcherMat);
      hBar.rotation.x = Math.PI / 2;
      hBar.position.set(0.03 + i * 0.025, -0.03 + i * 0.015, 0);
      catcherGroup.add(hBar);
    }

    catcherGroup.position.set(0.78, -0.02, 0);
    train.add(catcherGroup);

    // Steam dome
    const domeGeo = new THREE.SphereGeometry(0.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.5 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0.5, 0.29, 0);
    train.add(dome);

    // Cab (driver area)
    const cabGeo = new THREE.BoxGeometry(0.2, 0.25, 0.3);
    const cab = new THREE.Mesh(cabGeo, bodyMat);
    cab.position.set(-0.25, 0.2, 0);
    train.add(cab);

    // Cab roof
    const cabRoofGeo = new THREE.BoxGeometry(0.22, 0.02, 0.32);
    const cabRoof = new THREE.Mesh(cabRoofGeo, roofMat);
    cabRoof.position.set(-0.25, 0.33, 0);
    train.add(cabRoof);

    // Cab windows
    const cabWindowMat = new THREE.MeshStandardMaterial({ 
      color: '#87ceeb', 
      metalness: 0.4, 
      transparent: true, 
      opacity: 0.7 
    });
    const cabWindowGeo = new THREE.PlaneGeometry(0.08, 0.1);
    
    // Side windows
    [-0.15, 0.15].forEach(z => {
      const cabWindow = new THREE.Mesh(cabWindowGeo, cabWindowMat);
      cabWindow.position.set(-0.25, 0.22, z);
      cabWindow.rotation.y = z > 0 ? 0 : Math.PI;
      train.add(cabWindow);
    });
  }

  // Coupling hooks
  const hookMat = new THREE.MeshStandardMaterial({ color: '#555555', metalness: 0.8, roughness: 0.3 });
  [-0.4, 0.4].forEach(x => {
    const hookGroup = new THREE.Group();
    
    const hookBaseGeo = new THREE.BoxGeometry(0.05, 0.03, 0.04);
    const hookBase = new THREE.Mesh(hookBaseGeo, hookMat);
    hookGroup.add(hookBase);

    const hookRingGeo = new THREE.TorusGeometry(0.02, 0.005, 8, 16);
    const hookRing = new THREE.Mesh(hookRingGeo, hookMat);
    hookRing.position.x = x > 0 ? 0.035 : -0.035;
    hookRing.rotation.y = Math.PI / 2;
    hookGroup.add(hookRing);

    hookGroup.position.set(x, 0.02, 0);
    train.add(hookGroup);
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
  
  lctx.strokeStyle = isHighlighted ? '#000' : 'rgba(255, 255, 255, 0.3)';
  lctx.lineWidth = 2;
  lctx.stroke();
  
  lctx.fillStyle = isHighlighted ? '#000' : '#fff';
  lctx.font = 'bold 28px Arial';
  lctx.textAlign = 'center';
  lctx.fillText(label, 90, 38);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTex, transparent: true })
  );
  labelSprite.position.y = 0.55;
  labelSprite.scale.set(0.5, 0.16, 1);
  train.add(labelSprite);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.8, 0.45, 0.38);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12 
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.y = 0.14;
    train.add(glowMesh);
  }

  return train;
}

// ==================== REALISTIC DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  // Main tile body
  const tileGeo = new THREE.BoxGeometry(0.26, 0.52, 0.08);
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f5f0e8',
    roughness: 0.35,
    metalness: 0.05,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  const tile = new THREE.Mesh(tileGeo, tileMat);
  domino.add(tile);

  // Rounded edge effect (beveled corners)
  const edgeRadius = 0.015;
  const edgeMat = new THREE.MeshStandardMaterial({ 
    color: isHighlighted ? '#16a085' : '#e0dbd0', 
    roughness: 0.4 
  });

  // Corner cylinders for rounded look
  const cornerGeo = new THREE.CylinderGeometry(edgeRadius, edgeRadius, 0.08, 8);
  [
    [-0.115, 0.245], [0.115, 0.245],
    [-0.115, -0.245], [0.115, -0.245]
  ].forEach(([x, y]) => {
    const corner = new THREE.Mesh(cornerGeo, edgeMat);
    corner.position.set(x, y, 0);
    corner.rotation.x = Math.PI / 2;
    domino.add(corner);
  });

  // Center dividing line (recessed groove)
  const grooveGeo = new THREE.BoxGeometry(0.22, 0.015, 0.02);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3 });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.032;
  domino.add(groove);

  // Dot creation function
  const createDot = (x: number, y: number) => {
    const dotGroup = new THREE.Group();
    
    // Dot recess
    const recessGeo = new THREE.CircleGeometry(0.028, 16);
    const recessMat = new THREE.MeshStandardMaterial({ 
      color: isHighlighted ? '#0d8c7a' : '#d0cbc0', 
      side: THREE.DoubleSide 
    });
    const recess = new THREE.Mesh(recessGeo, recessMat);
    recess.position.z = 0.039;
    dotGroup.add(recess);

    // Actual dot
    const dotGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.015, 16);
    const dotMat = new THREE.MeshStandardMaterial({
      color: isHighlighted ? '#ffffff' : '#1a1a1a',
      roughness: 0.3,
      metalness: 0.1,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.z = 0.032;
    dot.rotation.x = Math.PI / 2;
    dotGroup.add(dot);

    dotGroup.position.set(x, y, 0);
    return dotGroup;
  };

  // Dot patterns for top and bottom halves
  const val = parseInt(value) || 1;
  const topVal = Math.min(val, 6);
  const bottomVal = Math.min(val, 6);

  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-0.055, 0.065], [0.055, -0.065]],
    3: [[-0.055, 0.065], [0, 0], [0.055, -0.065]],
    4: [[-0.055, 0.065], [0.055, 0.065], [-0.055, -0.065], [0.055, -0.065]],
    5: [[-0.055, 0.065], [0.055, 0.065], [0, 0], [-0.055, -0.065], [0.055, -0.065]],
    6: [[-0.055, 0.065], [0.055, 0.065], [-0.055, 0], [0.055, 0], [-0.055, -0.065], [0.055, -0.065]],
  };

  const topDots = dotPositions[topVal] || dotPositions[1];
  const bottomDots = dotPositions[bottomVal] || dotPositions[1];

  // Top half dots (offset up)
  topDots.forEach(([x, y]) => {
    const dot = createDot(x, y + 0.15);
    domino.add(dot);
  });

  // Bottom half dots (offset down)
  bottomDots.forEach(([x, y]) => {
    const dot = createDot(x, y - 0.15);
    domino.add(dot);
  });

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.3, 0.56, 0.04);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.2 
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    domino.add(glow);
  }

  return domino;
}

// ==================== REALISTIC BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  const bookWidth = 0.6;
  const bookHeight = 0.08;
  const bookDepth = 0.42;

  // Cover material
  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  // Main cover (top)
  const coverGeo = new THREE.BoxGeometry(bookWidth, 0.008, bookDepth);
  const topCover = new THREE.Mesh(coverGeo, coverMat);
  topCover.position.y = bookHeight / 2;
  book.add(topCover);

  // Bottom cover
  const bottomCover = new THREE.Mesh(coverGeo, coverMat);
  bottomCover.position.y = -bookHeight / 2;
  book.add(bottomCover);

  // Pages (cream colored block)
  const pagesGeo = new THREE.BoxGeometry(bookWidth - 0.04, bookHeight - 0.016, bookDepth - 0.02);
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  book.add(pages);

  // Page lines texture (visible from side)
  const pageLineCanvas = document.createElement('canvas');
  pageLineCanvas.width = 32;
  pageLineCanvas.height = 128;
  const plctx = pageLineCanvas.getContext('2d')!;
  plctx.fillStyle = '#f5f0e0';
  plctx.fillRect(0, 0, 32, 128);
  for (let y = 0; y < 128; y += 2) {
    plctx.fillStyle = y % 4 === 0 ? '#e8e0d0' : '#f0e8d8';
    plctx.fillRect(0, y, 32, 1);
  }
  const pageLineTex = new THREE.CanvasTexture(pageLineCanvas);

  // Right side pages
  const pageSideGeo = new THREE.PlaneGeometry(bookHeight - 0.016, bookDepth - 0.02);
  const pageSideMat = new THREE.MeshBasicMaterial({ map: pageLineTex });
  const pageSide = new THREE.Mesh(pageSideGeo, pageSideMat);
  pageSide.position.set(bookWidth / 2 - 0.02, 0, 0);
  pageSide.rotation.y = Math.PI / 2;
  book.add(pageSide);

  // Spine (curved look)
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.75),
    roughness: 0.4,
  });
  const spineGeo = new THREE.BoxGeometry(0.025, bookHeight + 0.004, bookDepth);
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -bookWidth / 2 + 0.01;
  book.add(spine);

  // Spine ridges (decorative)
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.7, roughness: 0.3 });
  const ridgeGeo = new THREE.BoxGeometry(0.004, bookHeight + 0.006, 0.015);
  [-0.16, -0.08, 0, 0.08, 0.16].forEach(z => {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.set(-bookWidth / 2, 0, z);
    book.add(ridge);
  });

  // Spine text
  const spineCanvas = document.createElement('canvas');
  spineCanvas.width = 48;
  spineCanvas.height = 200;
  const sctx = spineCanvas.getContext('2d')!;
  sctx.fillStyle = '#ffd700';
  sctx.save();
  sctx.translate(24, 100);
  sctx.rotate(-Math.PI / 2);
  sctx.font = 'bold 22px serif';
  sctx.textAlign = 'center';
  sctx.fillText(label, 0, 8);
  sctx.restore();

  const spineTex = new THREE.CanvasTexture(spineCanvas);
  const spineLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(bookHeight, bookDepth * 0.8),
    new THREE.MeshBasicMaterial({ map: spineTex, transparent: true })
  );
  spineLabel.position.set(-bookWidth / 2 - 0.001, 0, 0);
  spineLabel.rotation.y = -Math.PI / 2;
  book.add(spineLabel);

  // Cover title and design
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 240;
  coverCanvas.height = 180;
  const cctx = coverCanvas.getContext('2d')!;

  // Gold border frame
  cctx.strokeStyle = '#ffd700';
  cctx.lineWidth = 6;
  cctx.strokeRect(12, 12, 216, 156);

  // Inner frame
  cctx.lineWidth = 2;
  cctx.strokeRect(22, 22, 196, 136);

  // Decorative corners
  cctx.fillStyle = '#ffd700';
  [[18, 18], [210, 18], [18, 150], [210, 150]].forEach(([cx, cy]) => {
    cctx.beginPath();
    cctx.arc(cx, cy, 6, 0, Math.PI * 2);
    cctx.fill();
  });

  // Title
  cctx.fillStyle = '#ffd700';
  cctx.font = 'bold 32px serif';
  cctx.textAlign = 'center';
  cctx.fillText(label, 120, 85);

  // Subtitle
  cctx.font = '16px serif';
  cctx.fillText('TEXTBOOK', 120, 115);

  // Decorative line
  cctx.strokeStyle = '#ffd700';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.moveTo(60, 55);
  cctx.lineTo(180, 55);
  cctx.stroke();

  cctx.beginPath();
  cctx.moveTo(60, 130);
  cctx.lineTo(180, 130);
  cctx.stroke();

  const coverTex = new THREE.CanvasTexture(coverCanvas);
  const coverLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(bookWidth - 0.08, bookDepth - 0.06),
    new THREE.MeshBasicMaterial({ map: coverTex, transparent: true })
  );
  coverLabel.position.y = bookHeight / 2 + 0.001;
  coverLabel.rotation.x = -Math.PI / 2;
  book.add(coverLabel);

  // Bookmark ribbon
  const ribbonGeo = new THREE.PlaneGeometry(0.02, 0.14);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: '#e74c3c',
    side: THREE.DoubleSide,
    roughness: 0.6,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.position.set(0.15, bookHeight / 2 + 0.02, bookDepth / 2 - 0.02);
  ribbon.rotation.x = 0.15;
  book.add(ribbon);

  // Ribbon end (notched)
  const ribbonEndGeo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.01, 0, 0,
    0.01, 0, 0,
    0, -0.03, 0,
  ]);
  ribbonEndGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const ribbonEnd = new THREE.Mesh(ribbonEndGeo, ribbonMat);
  ribbonEnd.position.set(0.15, bookHeight / 2 + 0.02 + 0.07, bookDepth / 2 + 0.02);
  book.add(ribbonEnd);

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(bookWidth + 0.06, bookHeight + 0.04, bookDepth + 0.06);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12 
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    book.add(glow);
  }

  return book;
}

// ==================== REALISTIC PLATE WITH FOOD ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  // Main plate
  const plateGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.025, 36);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#fefefe',
    roughness: 0.2,
    metalness: 0.08,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.15 : 0,
  });
  const plateBase = new THREE.Mesh(plateGeo, plateMat);
  plate.add(plateBase);

  // Plate rim (raised edge)
  const rimGeo = new THREE.TorusGeometry(0.3, 0.018, 12, 48);
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#f0f0f0',
    roughness: 0.25,
    metalness: 0.1,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.012;
  plate.add(rim);

  // Decorative blue band (like china)
  const bandGeo = new THREE.TorusGeometry(0.22, 0.01, 8, 48);
  const bandMat = new THREE.MeshStandardMaterial({ color: '#2980b9', roughness: 0.4 });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.014;
  plate.add(band);

  // Second decorative band
  const band2Geo = new THREE.TorusGeometry(0.26, 0.006, 8, 48);
  const band2 = new THREE.Mesh(band2Geo, bandMat);
  band2.rotation.x = Math.PI / 2;
  band2.position.y = 0.014;
  plate.add(band2);

  // Center decorative pattern
  const centerCanvas = document.createElement('canvas');
  centerCanvas.width = 128;
  centerCanvas.height = 128;
  const cctx = centerCanvas.getContext('2d')!;
  
  // Flower pattern
  cctx.fillStyle = '#2980b9';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    cctx.save();
    cctx.translate(64, 64);
    cctx.rotate(angle);
    cctx.beginPath();
    cctx.ellipse(20, 0, 12, 5, 0, 0, Math.PI * 2);
    cctx.fill();
    cctx.restore();
  }
  cctx.beginPath();
  cctx.arc(64, 64, 8, 0, Math.PI * 2);
  cctx.fill();

  const centerTex = new THREE.CanvasTexture(centerCanvas);
  const centerDesign = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 32),
    new THREE.MeshBasicMaterial({ map: centerTex, transparent: true, side: THREE.DoubleSide })
  );
  centerDesign.rotation.x = -Math.PI / 2;
  centerDesign.position.y = 0.014;
  plate.add(centerDesign);

  // ===== REALISTIC FOOD =====
  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;

  if (plateNum % 3 === 1) {
    // Rice with chicken and vegetables
    
    // Rice mound (realistic shape)
    const riceGroup = new THREE.Group();
    const riceMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc', roughness: 0.9 });
    
    // Main rice shape
    const riceMainGeo = new THREE.SphereGeometry(0.07, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const riceMain = new THREE.Mesh(riceMainGeo, riceMat);
    riceMain.scale.set(1.2, 0.6, 1);
    riceGroup.add(riceMain);

    // Rice grain texture bumps
    for (let i = 0; i < 25; i++) {
      const grainGeo = new THREE.SphereGeometry(0.008, 4, 4);
      const grain = new THREE.Mesh(grainGeo, riceMat);
      const theta = Math.random() * Math.PI * 0.4;
      const phi = Math.random() * Math.PI * 2;
      grain.position.set(
        Math.sin(theta) * Math.cos(phi) * 0.06,
        Math.cos(theta) * 0.035,
        Math.sin(theta) * Math.sin(phi) * 0.06
      );
      riceGroup.add(grain);
    }
    
    riceGroup.position.set(-0.08, 0.02, 0);
    plate.add(riceGroup);

    // Grilled chicken leg
    const chickenGroup = new THREE.Group();
    const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054', roughness: 0.6 });
    const grilledMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });

    // Drumstick meat
    const drumstickGeo = new THREE.CapsuleGeometry(0.035, 0.08, 8, 16);
    const drumstick = new THREE.Mesh(drumstickGeo, chickenMat);
    drumstick.rotation.z = 0.4;
    chickenGroup.add(drumstick);

    // Grill marks
    for (let i = 0; i < 4; i++) {
      const markGeo = new THREE.BoxGeometry(0.06, 0.003, 0.008);
      const mark = new THREE.Mesh(markGeo, grilledMat);
      mark.position.set(0, -0.02 + i * 0.015, 0.03);
      mark.rotation.z = 0.4;
      chickenGroup.add(mark);
    }

    // Bone
    const boneGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.06, 8);
    const boneMat = new THREE.MeshStandardMaterial({ color: '#f5e6d3', roughness: 0.5 });
    const bone = new THREE.Mesh(boneGeo, boneMat);
    bone.position.set(0.04, 0.035, 0);
    bone.rotation.z = 0.4;
    chickenGroup.add(bone);

    // Bone end knob
    const knobGeo = new THREE.SphereGeometry(0.01, 8, 8);
    const knob = new THREE.Mesh(knobGeo, boneMat);
    knob.position.set(0.06, 0.05, 0);
    chickenGroup.add(knob);

    chickenGroup.position.set(0.08, 0.045, 0.02);
    plate.add(chickenGroup);

    // Green peas
    const peaMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.5 });
    for (let i = 0; i < 10; i++) {
      const peaGeo = new THREE.SphereGeometry(0.012 + Math.random() * 0.004, 8, 8);
      const pea = new THREE.Mesh(peaGeo, peaMat);
      pea.position.set(
        0.02 + Math.random() * 0.08 - 0.04,
        0.02,
        -0.08 + Math.random() * 0.06
      );
      plate.add(pea);
    }

    // Carrot slices
    const carrotMat = new THREE.MeshStandardMaterial({ color: '#e67e22', roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const carrotGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 12);
      const carrot = new THREE.Mesh(carrotGeo, carrotMat);
      carrot.position.set(
        -0.02 + i * 0.025,
        0.02,
        -0.06
      );
      plate.add(carrot);
    }

  } else if (plateNum % 3 === 2) {
    // Spaghetti with meatballs

    // Spaghetti pile
    const spaghettiMat = new THREE.MeshStandardMaterial({ color: '#f0d58c', roughness: 0.7 });
    
    for (let layer = 0; layer < 4; layer++) {
      for (let strand = 0; strand < 8; strand++) {
        const curvePoints = [];
        const startX = (Math.random() - 0.5) * 0.12;
        const startZ = (Math.random() - 0.5) * 0.12;
        
        for (let p = 0; p <= 10; p++) {
          curvePoints.push(new THREE.Vector3(
            startX + Math.sin(p * 0.8 + strand) * 0.04,
            0.015 + layer * 0.008,
            startZ + p * 0.015 - 0.08
          ));
        }
        
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.003, 6, false);
        const noodle = new THREE.Mesh(tubeGeo, spaghettiMat);
        plate.add(noodle);
      }
    }

    // Tomato sauce (on top)
    const sauceGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4 });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.05, 0);
    sauce.scale.set(1.5, 0.5, 1.5);
    plate.add(sauce);

    // Sauce drips
    for (let i = 0; i < 5; i++) {
      const dripGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const drip = new THREE.Mesh(dripGeo, sauceMat);
      const angle = (i / 5) * Math.PI * 2;
      drip.position.set(
        Math.cos(angle) * 0.06,
        0.03,
        Math.sin(angle) * 0.06
      );
      drip.scale.set(1, 0.5, 1);
      plate.add(drip);
    }

    // Meatballs
    const meatballMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.6 });
    [[-0.04, 0.05, 0.04], [0.05, 0.055, -0.02], [0, 0.06, 0.06]].forEach(([x, y, z]) => {
      const meatballGeo = new THREE.SphereGeometry(0.028, 12, 12);
      const meatball = new THREE.Mesh(meatballGeo, meatballMat);
      meatball.position.set(x, y, z);
      plate.add(meatball);
    });

    // Parsley garnish
    const parsleyMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const parsleyGeo = new THREE.SphereGeometry(0.008, 6, 6);
      const parsley = new THREE.Mesh(parsleyGeo, parsleyMat);
      parsley.position.set(
        (Math.random() - 0.5) * 0.08,
        0.07,
        (Math.random() - 0.5) * 0.08
      );
      plate.add(parsley);
    }

  } else {
    // Fresh salad

    // Lettuce leaves
    const lettuceMat = new THREE.MeshStandardMaterial({ 
      color: '#27ae60', 
      roughness: 0.7,
      side: THREE.DoubleSide 
    });
    
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.SphereGeometry(0.045, 8, 8);
      const leaf = new THREE.Mesh(leafGeo, lettuceMat);
      const angle = (i / 6) * Math.PI * 2;
      leaf.position.set(
        Math.cos(angle) * 0.06,
        0.025 + Math.random() * 0.01,
        Math.sin(angle) * 0.06
      );
      leaf.scale.set(1.3, 0.3, 1);
      leaf.rotation.y = angle;
      leaf.rotation.x = Math.random() * 0.3;
      plate.add(leaf);
    }

    // Center lettuce mound
    const centerLettuceGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const centerLettuce = new THREE.Mesh(centerLettuceGeo, lettuceMat);
    centerLettuce.position.set(0, 0.035, 0);
    centerLettuce.scale.set(1, 0.5, 1);
    plate.add(centerLettuce);

    // Tomato slices
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.4 });
    const tomatoInnerMat = new THREE.MeshStandardMaterial({ color: '#ff6b6b', roughness: 0.5 });
    
    for (let i = 0; i < 4; i++) {
      const tomatoGroup = new THREE.Group();
      
      const tomatoGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomatoGroup.add(tomato);

      // Tomato inner circle
      const innerGeo = new THREE.CircleGeometry(0.018, 12);
      const inner = new THREE.Mesh(innerGeo, tomatoInnerMat);
      inner.position.y = 0.005;
      inner.rotation.x = -Math.PI / 2;
      tomatoGroup.add(inner);

      // Seeds
      const seedMat = new THREE.MeshBasicMaterial({ color: '#f5e6a3' });
      for (let s = 0; s < 4; s++) {
        const seedGeo = new THREE.SphereGeometry(0.003, 4, 4);
        const seed = new THREE.Mesh(seedGeo, seedMat);
        seed.position.set(
          Math.cos(s * Math.PI / 2) * 0.008,
          0.005,
          Math.sin(s * Math.PI / 2) * 0.008
        );
        seed.scale.set(1, 0.3, 0.5);
        tomatoGroup.add(seed);
      }

      tomatoGroup.position.set(
        -0.06 + i * 0.035,
        0.04 + i * 0.005,
        -0.02 + i * 0.01
      );
      plate.add(tomatoGroup);
    }

    // Cucumber slices
    const cucumberOuterMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.5 });
    const cucumberInnerMat = new THREE.MeshStandardMaterial({ color: '#a8e6cf', roughness: 0.6 });
    
    for (let i = 0; i < 3; i++) {
      const cucumberGroup = new THREE.Group();
      
      // Outer (skin)
      const outerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.006, 16);
      const outer = new THREE.Mesh(outerGeo, cucumberOuterMat);
      cucumberGroup.add(outer);

      // Inner
      const innerGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.007, 16);
      const inner = new THREE.Mesh(innerGeo, cucumberInnerMat);
      cucumberGroup.add(inner);

      cucumberGroup.position.set(
        0.06 + i * 0.02,
        0.03,
        0.04 - i * 0.02
      );
      plate.add(cucumberGroup);
    }

    // Cheese cubes
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const cheeseGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018);
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set(
        (Math.random() - 0.5) * 0.1,
        0.045,
        (Math.random() - 0.5) * 0.1
      );
      cheese.rotation.y = Math.random() * 0.5;
      plate.add(cheese);
    }

    // Red onion rings
    const onionMat = new THREE.MeshStandardMaterial({ 
      color: '#9b59b6', 
      roughness: 0.5,
      transparent: true,
      opacity: 0.8
    });
    for (let i = 0; i < 3; i++) {
      const onionGeo = new THREE.TorusGeometry(0.015, 0.003, 8, 16);
      const onion = new THREE.Mesh(onionGeo, onionMat);
      onion.position.set(
        (Math.random() - 0.5) * 0.1,
        0.05,
        (Math.random() - 0.5) * 0.1
      );
      onion.rotation.x = Math.PI / 2 + Math.random() * 0.3;
      plate.add(onion);
    }
  }

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.04, 32);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.15 
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    plate.add(glow);
  }

  return plate;
}

// ==================== REALISTIC CARDBOARD BOX ====================

function createCardboardBox(label: string, color: string, isHighlighted: boolean, isOpen?: boolean): THREE.Group {
  const box = new THREE.Group();

  const boxWidth = 0.55;
  const boxHeight = 0.4;
  const boxDepth = 0.45;

  // Cardboard texture
  const cardboardColor = color;
  const cardboardMat = new THREE.MeshStandardMaterial({
    color: cardboardColor,
    roughness: 0.85,
    metalness: 0,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  const darkCardboardMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cardboardColor).multiplyScalar(0.8),
    roughness: 0.9,
  });

  // Main body
  const bodyGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const body = new THREE.Mesh(bodyGeo, cardboardMat);
  body.castShadow = true;
  box.add(body);

  // Corrugation lines (subtle texture)
  const linesMat = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color(cardboardColor).multiplyScalar(0.9),
    transparent: true,
    opacity: 0.3
  });

  for (let y = -boxHeight / 2 + 0.03; y < boxHeight / 2; y += 0.025) {
    const lineGeo = new THREE.BoxGeometry(boxWidth + 0.001, 0.002, boxDepth + 0.001);
    const line = new THREE.Mesh(lineGeo, linesMat);
    line.position.y = y;
    box.add(line);
  }

  // Corner creases
  const creaseMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a', roughness: 0.9 });
  const vCreaseGeo = new THREE.BoxGeometry(0.015, boxHeight, 0.015);
  
  [
    [-boxWidth / 2, 0, boxDepth / 2],
    [boxWidth / 2, 0, boxDepth / 2],
    [-boxWidth / 2, 0, -boxDepth / 2],
    [boxWidth / 2, 0, -boxDepth / 2]
  ].forEach(([x, y, z]) => {
    const crease = new THREE.Mesh(vCreaseGeo, creaseMat);
    crease.position.set(x, y, z);
    box.add(crease);
  });

  // ===== BOX FLAPS =====
  const flapHeight = 0.12;
  const flapAngle = isOpen ? -1.3 : 0;

  // Front flap
  const frontFlapGeo = new THREE.BoxGeometry(boxWidth, flapHeight, 0.012);
  const frontFlap = new THREE.Mesh(frontFlapGeo, cardboardMat);
  frontFlap.position.set(0, boxHeight / 2 + (isOpen ? 0.04 : flapHeight / 2 - 0.01), boxDepth / 2 - 0.006);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);

  // Back flap
  const backFlap = new THREE.Mesh(frontFlapGeo, cardboardMat);
  backFlap.position.set(0, boxHeight / 2 + (isOpen ? 0.04 : flapHeight / 2 - 0.01), -boxDepth / 2 + 0.006);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  // Side flaps
  const sideFlapGeo = new THREE.BoxGeometry(0.012, flapHeight, boxDepth * 0.4);
  
  const leftFlap = new THREE.Mesh(sideFlapGeo, cardboardMat);
  leftFlap.position.set(-boxWidth / 2 + 0.006, boxHeight / 2 + (isOpen ? 0.03 : flapHeight / 2 - 0.01), 0);
  leftFlap.rotation.z = isOpen ? 0.9 : 0;
  box.add(leftFlap);

  const rightFlap = new THREE.Mesh(sideFlapGeo, cardboardMat);
  rightFlap.position.set(boxWidth / 2 - 0.006, boxHeight / 2 + (isOpen ? 0.03 : flapHeight / 2 - 0.01), 0);
  rightFlap.rotation.z = isOpen ? -0.9 : 0;
  box.add(rightFlap);

  // Inside (visible when open)
  if (isOpen) {
    const insideMat = new THREE.MeshStandardMaterial({ color: '#a0734a', roughness: 0.9 });
    const insideGeo = new THREE.PlaneGeometry(boxWidth - 0.02, boxDepth - 0.02);
    const inside = new THREE.Mesh(insideGeo, insideMat);
    inside.rotation.x = -Math.PI / 2;
    inside.position.y = -boxHeight / 2 + 0.01;
    box.add(inside);

    // Items inside the box
    // Blue box
    const itemGeo1 = new THREE.BoxGeometry(0.12, 0.1, 0.1);
    const itemMat1 = new THREE.MeshStandardMaterial({ color: '#3498db', roughness: 0.5 });
    const item1 = new THREE.Mesh(itemGeo1, itemMat1);
    item1.position.set(-0.1, -boxHeight / 2 + 0.06, 0.05);
    item1.rotation.y = 0.2;
    box.add(item1);

    // Red cylinder
    const itemGeo2 = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16);
    const itemMat2 = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.5 });
    const item2 = new THREE.Mesh(itemGeo2, itemMat2);
    item2.position.set(0.08, -boxHeight / 2 + 0.07, -0.05);
    box.add(item2);

    // Yellow ball
    const itemGeo3 = new THREE.SphereGeometry(0.05, 16, 16);
    const itemMat3 = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.4 });
    const item3 = new THREE.Mesh(itemGeo3, itemMat3);
    item3.position.set(0.02, -boxHeight / 2 + 0.06, 0.1);
    box.add(item3);

    // Packing paper (crumpled)
    const paperMat = new THREE.MeshStandardMaterial({ color: '#f5e6d3', roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const paperGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const paper = new THREE.Mesh(paperGeo, paperMat);
      paper.position.set(
        (Math.random() - 0.5) * 0.3,
        -boxHeight / 2 + 0.05,
        (Math.random() - 0.5) * 0.25
      );
      paper.scale.set(1.5, 0.6, 1.2);
      box.add(paper);
    }
  }

  // Packing tape (when closed)
  if (!isOpen) {
    const tapeGeo = new THREE.BoxGeometry(0.1, 0.008, boxDepth + 0.02);
    const tapeMat = new THREE.MeshStandardMaterial({
      color: '#d4a574',
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });
    const tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.y = boxHeight / 2 + flapHeight - 0.01;
    box.add(tape);

    // Tape across front
    const tapeFrontGeo = new THREE.BoxGeometry(0.08, boxHeight * 0.3, 0.008);
    const tapeFront = new THREE.Mesh(tapeFrontGeo, tapeMat);
    tapeFront.position.set(0, boxHeight / 2 - 0.02, boxDepth / 2);
    box.add(tapeFront);
  }

  // Front label/sticker
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 180;
  labelCanvas.height = 120;
  const lctx = labelCanvas.getContext('2d')!;

  // White background
  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, 180, 120);
  
  // Border
  lctx.strokeStyle = '#333333';
  lctx.lineWidth = 3;
  lctx.strokeRect(3, 3, 174, 114);

  // FRAGILE banner
  lctx.fillStyle = '#e74c3c';
  lctx.fillRect(5, 5, 170, 28);
  lctx.fillStyle = '#ffffff';
  lctx.font = 'bold 16px Arial';
  lctx.textAlign = 'center';
  lctx.fillText('⚠ FRAGILE ⚠', 90, 25);

  // Box label
  lctx.fillStyle = '#2c3e50';
  lctx.font = 'bold 28px Arial';
  lctx.fillText(label, 90, 65);

  // Handle with care
  lctx.fillStyle = '#666666';
  lctx.font = '11px Arial';
  lctx.fillText('HANDLE WITH CARE', 90, 85);

  // Up arrows
  lctx.font = '14px Arial';
  lctx.fillText('↑ THIS SIDE UP ↑', 90, 105);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.26),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0.02, boxDepth / 2 + 0.001);
  box.add(labelMesh);

  // Handle cutouts (on sides)
  const handleMat = new THREE.MeshStandardMaterial({ color: '#5d3a1a', roughness: 0.8 });
  [-boxWidth / 2 - 0.001, boxWidth / 2 + 0.001].forEach(x => {
    const handleGroup = new THREE.Group();
    
    // Handle opening (ellipse shape)
    const handleGeo = new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI;
    handleGroup.add(handle);

    // Handle hole (dark inside)
    const holeGeo = new THREE.PlaneGeometry(0.1, 0.04);
    const holeMat = new THREE.MeshBasicMaterial({ color: '#3a2515', side: THREE.DoubleSide });
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.y = -0.01;
    handleGroup.add(hole);

    handleGroup.position.set(x, 0.05, 0);
    handleGroup.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    box.add(handleGroup);
  });

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(boxWidth + 0.08, boxHeight + 0.08, boxDepth + 0.08);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: '#ffff00', 
      transparent: true, 
      opacity: 0.12 
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    box.add(glow);
  }

  return box;
}

// ==================== END OF PART 2 ====================
