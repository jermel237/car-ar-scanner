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

// ==================== HELPER: ROUND RECT ====================

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ==================== TEXT SPRITE ====================

function createTextSprite(
  text: string,
  color: string,
  fontSize: number = 20,
  withBackground: boolean = false
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  if (withBackground) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    drawRoundRect(ctx, 10, 20, 492, 88, 20);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    drawRoundRect(ctx, 10, 20, 492, 88, 20);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize * 2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  return new THREE.Sprite(material);
}

// ==================== ARROW ====================

function createArrow(fromX: number, toX: number, isHighlighted: boolean): THREE.Group {
  const arrow = new THREE.Group();
  const color = isHighlighted ? 0xffff00 : 0x00ff00;

  const points = [
    new THREE.Vector3(fromX + 0.35, 0, 0),
    new THREE.Vector3(toX - 0.35, 0, 0)
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  arrow.add(new THREE.Line(lineGeo, lineMat));

  const coneGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
  const coneMat = new THREE.MeshBasicMaterial({ color });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.set(toX - 0.4, 0, 0);
  cone.rotation.z = -Math.PI / 2;
  arrow.add(cone);

  return arrow;
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

  const time = Date.now() * 0.003;
  const bounce = Math.sin(time * 5) * 0.02;
  const wobble = Math.sin(time * 3) * 0.05;

  if (structure === 'array') {
    if (animPhase === 'access-lift' && isTarget) {
      obj.position.y += 0.35 + bounce;
      obj.rotation.z = wobble;
    } else if (animPhase === 'access-bounce' && isTarget) {
      obj.position.y += 0.25 + Math.abs(bounce) * 2;
      obj.scale.multiplyScalar(1.15);
    } else if (animPhase === 'access-settle' && isTarget) {
      obj.position.y += 0.08;
    } else if (animPhase === 'insert-drop' && isTarget) {
      obj.position.y += 0.6;
      obj.scale.multiplyScalar(0.6);
      obj.rotation.z = wobble * 2;
    } else if (animPhase === 'insert-settle' && isTarget) {
      obj.position.y += 0.12 + bounce;
      obj.scale.multiplyScalar(1.08);
    } else if (animPhase === 'delete-lift' && isTarget) {
      obj.position.y += 0.4;
      obj.rotation.z = 0.35 + wobble;
      obj.scale.multiplyScalar(1.15);
    } else if (animPhase === 'delete-shrink' && isTarget) {
      obj.position.y += 0.7;
      obj.scale.multiplyScalar(0.01);
      obj.rotation.z = 2.5;
    } else if (animPhase === 'swap-lift' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.4 + bounce;
      obj.rotation.z = isTarget1 ? 0.12 + wobble : -0.12 - wobble;
    } else if (animPhase === 'swap-cross' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.45;
    } else if (animPhase === 'swap-drop' && (isTarget1 || isTarget2)) {
      obj.position.y += 0.1 + bounce;
      obj.scale.multiplyScalar(1.1);
    }
  }

  if (structure === 'linkedlist') {
    if (animPhase === 'll-insert-head' && isTarget) {
      obj.position.y += 0.45 + bounce;
      obj.scale.multiplyScalar(0.65);
    } else if (animPhase === 'll-insert-head-settle' && isTarget) {
      obj.position.y += 0.1 + bounce;
    } else if (animPhase === 'll-insert-tail' && isTarget) {
      obj.position.y += 0.45 + bounce;
      obj.scale.multiplyScalar(0.65);
    } else if (animPhase === 'll-insert-tail-settle' && isTarget) {
      obj.position.y += 0.1 + bounce;
    } else if (animPhase === 'll-delete-lift' && isTarget) {
      obj.position.y += 0.45;
      obj.rotation.z = 0.25 + wobble;
    } else if (animPhase === 'll-delete-shrink' && isTarget) {
      obj.position.y += 0.75;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'll-traverse' && isTarget) {
      obj.position.y += 0.18 + bounce;
      obj.scale.multiplyScalar(1.12);
    }
  }

  if (structure === 'stack') {
    if (animPhase === 'stack-push-drop' && isTarget) {
      obj.position.y += 0.55 + bounce;
      obj.scale.multiplyScalar(0.75);
    } else if (animPhase === 'stack-push-settle' && isTarget) {
      obj.position.y += 0.08 + bounce;
      obj.scale.multiplyScalar(1.06);
    } else if (animPhase === 'stack-pop-lift' && isTarget) {
      obj.position.y += 0.35;
      obj.rotation.z = -0.25 + wobble;
    } else if (animPhase === 'stack-pop-fly' && isTarget) {
      obj.position.y += 0.85;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'stack-peek-lift' && isTarget) {
      obj.position.y += 0.22 + bounce;
    } else if (animPhase === 'stack-peek-open' && isTarget) {
      obj.position.y += 0.28 + bounce;
      obj.scale.multiplyScalar(1.12);
    } else if (animPhase === 'stack-peek-settle' && isTarget) {
      obj.position.y += 0.06;
    }
  }

  if (structure === 'queue') {
    if (animPhase === 'queue-enqueue-enter' && isTarget) {
      obj.position.x += 0.9;
      obj.scale.multiplyScalar(0.65);
    } else if (animPhase === 'queue-enqueue-settle' && isTarget) {
      obj.position.x += 0.18;
    } else if (animPhase === 'queue-dequeue-exit' && isTarget) {
      obj.position.x -= 0.75;
      obj.scale.multiplyScalar(0.82);
    } else if (animPhase === 'queue-dequeue-gone' && isTarget) {
      obj.position.x -= 1.4;
      obj.scale.multiplyScalar(0.01);
    } else if (animPhase === 'queue-front-peek' && isTarget) {
      obj.position.y += 0.18 + bounce;
      obj.scale.multiplyScalar(1.12);
    }
  }
}

// ==================== SIMPLE HUMAN ====================

function createHuman3D(
  appearance: HumanAppearance,
  name: string,
  isHighlighted: boolean
): THREE.Group {
  const human = new THREE.Group();
  const hlEmit = isHighlighted ? 0.4 : 0;

  // HEAD
  const headGeo = new THREE.SphereGeometry(0.09, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: appearance.skinTone,
    roughness: 0.7,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit * 0.3,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.32;
  head.castShadow = true;
  human.add(head);

  // HAIR
  if (appearance.hairStyle !== 'bald') {
    const hairGeo = new THREE.SphereGeometry(0.095, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hairMat = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.9 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.34;
    human.add(hair);
  }

  // TORSO
  const torsoGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.16, 12);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: appearance.shirtColor,
    roughness: 0.6,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: hlEmit,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.12;
  torso.castShadow = true;
  human.add(torso);

  // ARMS
  [-1, 1].forEach(side => {
    const armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.13, 8);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.set(side * 0.085, 0.1, 0);
    arm.rotation.z = side * 0.2;
    human.add(arm);
  });

  // LEGS
  const legMat = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.7 });
  [-0.025, 0.025].forEach(x => {
    const legGeo = new THREE.CylinderGeometry(0.02, 0.018, 0.12, 8);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -0.04, 0);
    human.add(leg);
  });

  // SHOES
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  [-0.025, 0.025].forEach(x => {
    const shoeGeo = new THREE.BoxGeometry(0.03, 0.015, 0.04);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(x, -0.11, 0.008);
    human.add(shoe);
  });

  // NAME LABEL
  const labelSprite = createTextSprite(name, isHighlighted ? '#ffff00' : '#ffffff', 16, true);
  labelSprite.position.y = 0.48;
  labelSprite.scale.set(0.35, 0.09, 1);
  human.add(labelSprite);

  // HIGHLIGHT
  if (isHighlighted) {
    const ringGeo = new THREE.RingGeometry(0.08, 0.12, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.12;
    ring.rotation.x = -Math.PI / 2;
    human.add(ring);
  }

  return human;
}

// ==================== GROCERY BOX ====================

function createGroceryBox(color: string, label: string, isHighlighted: boolean): THREE.Group {
  const product = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.28, 0.42, 0.16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.21;
  body.castShadow = true;
  product.add(body);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 260;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fefef6';
  ctx.fillRect(0, 0, 180, 260);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 180, 35);

  const icons: Record<string, string> = {
    'Milk': '🥛', 'Bread': '🍞', 'Eggs': '🥚',
    'Apple': '🍎', 'Juice': '🧃', 'New': '🆕'
  };
  ctx.font = '45px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(icons[label] || '📦', 90, 110);

  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(label, 90, 160);

  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 18px Arial';
  const prices: Record<string, string> = {
    'Milk': '$3.99', 'Bread': '$2.49', 'Eggs': '$4.99',
    'Apple': '$1.29', 'Juice': '$5.49', 'New': '$0.99'
  };
  ctx.fillText(prices[label] || '$2.99', 90, 200);

  const labelTex = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.38),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0.21, 0.081);
  product.add(labelMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.32, 0.46, 0.2);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.21;
    product.add(glow);
  }

  return product;
}

// ==================== BOOK ====================

function createBook(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const book = new THREE.Group();

  const coverMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  const coverGeo = new THREE.BoxGeometry(0.5, 0.07, 0.35);
  const cover = new THREE.Mesh(coverGeo, coverMat);
  cover.castShadow = true;
  book.add(cover);

  const pagesGeo = new THREE.BoxGeometry(0.46, 0.055, 0.32);
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f5f0e0', roughness: 0.9 });
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  pages.position.x = 0.01;
  book.add(pages);

  // Spine
  const spineGeo = new THREE.BoxGeometry(0.025, 0.075, 0.35);
  const spineMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.7),
    roughness: 0.3,
  });
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.x = -0.26;
  book.add(spine);

  // Title label
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 180, 140);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 100, 90);

  const titleTex = new THREE.CanvasTexture(canvas);
  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.28),
    new THREE.MeshBasicMaterial({ map: titleTex, transparent: true })
  );
  titleMesh.position.y = 0.036;
  titleMesh.rotation.x = -Math.PI / 2;
  book.add(titleMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.54, 0.1, 0.39);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    book.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return book;
}

// ==================== PLATE ====================

function createPlate(label: string, isHighlighted: boolean): THREE.Group {
  const plate = new THREE.Group();

  const plateGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.02, 24);
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#fefefa',
    roughness: 0.2,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.2 : 0,
  });
  const plateMain = new THREE.Mesh(plateGeo, plateMat);
  plateMain.castShadow = true;
  plate.add(plateMain);

  const rimGeo = new THREE.TorusGeometry(0.24, 0.012, 8, 24);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e8e8e0' });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  plate.add(rim);

  // Food
  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;

  if (plateNum % 3 === 1) {
    // Rice
    const riceGeo = new THREE.SphereGeometry(0.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const riceMat = new THREE.MeshStandardMaterial({ color: '#f5f5dc' });
    const rice = new THREE.Mesh(riceGeo, riceMat);
    rice.position.set(-0.06, 0.015, 0);
    plate.add(rice);

    // Chicken
    const chickenGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const chickenMat = new THREE.MeshStandardMaterial({ color: '#d4a054' });
    const chicken = new THREE.Mesh(chickenGeo, chickenMat);
    chicken.position.set(0.06, 0.035, 0);
    chicken.scale.set(1, 0.7, 1.3);
    plate.add(chicken);
  } else if (plateNum % 3 === 2) {
    // Spaghetti
    const spaghettiMat = new THREE.MeshStandardMaterial({ color: '#f0d58c' });
    for (let i = 0; i < 6; i++) {
      const noodleGeo = new THREE.TorusGeometry(0.035 + Math.random() * 0.02, 0.004, 6, 12);
      const noodle = new THREE.Mesh(noodleGeo, spaghettiMat);
      noodle.position.set(
        (Math.random() - 0.5) * 0.06,
        0.02 + i * 0.004,
        (Math.random() - 0.5) * 0.06
      );
      noodle.rotation.y = Math.random() * Math.PI;
      plate.add(noodle);
    }

    // Sauce
    const sauceGeo = new THREE.SphereGeometry(0.04, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#c0392b' });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.04, 0);
    plate.add(sauce);
  } else {
    // Salad
    const lettuceMat = new THREE.MeshStandardMaterial({ color: '#2ecc71' });
    for (let i = 0; i < 4; i++) {
      const leafGeo = new THREE.SphereGeometry(0.03, 6, 5);
      const leaf = new THREE.Mesh(leafGeo, lettuceMat);
      leaf.position.set(
        (Math.random() - 0.5) * 0.1,
        0.02,
        (Math.random() - 0.5) * 0.1
      );
      leaf.scale.set(1.2, 0.4, 1);
      plate.add(leaf);
    }

    // Tomatoes
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
    for (let i = 0; i < 3; i++) {
      const tomatoGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 10);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(-0.04 + i * 0.04, 0.03, -0.02);
      plate.add(tomato);
    }
  }

  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== CARDBOARD BOX ====================

function createCardboardBox(
  label: string,
  color: string,
  isHighlighted: boolean,
  isOpen: boolean = false
): THREE.Group {
  const box = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.45, 0.32, 0.36);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  box.add(body);

  // Flaps
  const flapAngle = isOpen ? -1.1 : 0;
  const flapMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });

  const frontFlapGeo = new THREE.BoxGeometry(0.45, 0.1, 0.01);
  const frontFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  frontFlap.position.set(0, 0.16 + (isOpen ? 0.03 : 0), 0.18);
  frontFlap.rotation.x = flapAngle;
  box.add(frontFlap);

  const backFlap = new THREE.Mesh(frontFlapGeo, flapMat);
  backFlap.position.set(0, 0.16 + (isOpen ? 0.03 : 0), -0.18);
  backFlap.rotation.x = -flapAngle;
  box.add(backFlap);

  // Label
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 180, 100);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 176, 96);

  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(5, 5, 170, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ FRAGILE ⚠', 90, 22);

  ctx.fillStyle = '#000';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(label, 90, 60);

  ctx.fillStyle = '#666';
  ctx.font = '10px Arial';
  ctx.fillText('HANDLE WITH CARE', 90, 85);

  const labelTex = new THREE.CanvasTexture(canvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.18),
    new THREE.MeshBasicMaterial({ map: labelTex })
  );
  labelMesh.position.set(0, 0.02, 0.181);
  box.add(labelMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.49, 0.36, 0.4);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    box.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return box;
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

  // Lower body
  const lowerGeo = new THREE.BoxGeometry(0.55, 0.12, 0.26);
  const lower = new THREE.Mesh(lowerGeo, bodyMat);
  lower.position.y = 0.07;
  lower.castShadow = true;
  car.add(lower);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(0.26, 0.1, 0.22);
  const cabin = new THREE.Mesh(cabinGeo, bodyMat);
  cabin.position.set(-0.04, 0.18, 0);
  cabin.castShadow = true;
  car.add(cabin);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });

  [[-0.16, 0, 0.13], [0.16, 0, 0.13], [-0.16, 0, -0.13], [0.16, 0, -0.13]].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    car.add(wheel);

    const rimGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.022, 12);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    car.add(rim);
  });

  // Headlights
  const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  const hlGeo = new THREE.BoxGeometry(0.008, 0.03, 0.04);
  [-0.08, 0.08].forEach(z => {
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(0.275, 0.07, z);
    car.add(hl);
  });

  // Tail lights
  const tlMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.08, 0.08].forEach(z => {
    const tl = new THREE.Mesh(hlGeo, tlMat);
    tl.position.set(-0.275, 0.07, z);
    car.add(tl);
  });

  // License plate
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 100;
  plateCanvas.height = 35;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 100, 35);
  pctx.strokeStyle = '#333';
  pctx.lineWidth = 2;
  pctx.strokeRect(1, 1, 98, 33);
  pctx.fillStyle = '#2c3e50';
  pctx.font = 'bold 16px Arial';
  pctx.textAlign = 'center';
  pctx.fillText(label, 50, 25);

  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.1, 0.035),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  plateMesh.position.set(-0.276, 0.04, 0);
  plateMesh.rotation.y = -Math.PI / 2;
  car.add(plateMesh);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.6, 0.28, 0.3);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.12;
    car.add(glow);
  }

  return car;
}

// ==================== TRAIN CAR ====================

function createTrainCar(
  isEngine: boolean,
  color: string,
  label: string,
  isHighlighted: boolean
): THREE.Group {
  const train = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.5,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.4 : 0,
  });

  const bodyGeo = new THREE.BoxGeometry(0.6, 0.26, 0.25);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.1;
  body.castShadow = true;
  train.add(body);

  // Roof
  const roofGeo = new THREE.BoxGeometry(0.55, 0.03, 0.22);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.4 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 0.25;
  train.add(roof);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.7 });

  [[-0.18, -0.05, 0.12], [0.18, -0.05, 0.12], [-0.18, -0.05, -0.12], [0.18, -0.05, -0.12]].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    train.add(wheel);
  });

  if (isEngine) {
    // Boiler
    const boilerGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.22, 16);
    const boilerMat = new THREE.MeshStandardMaterial({ color: '#b71c1c', metalness: 0.45 });
    const boiler = new THREE.Mesh(boilerGeo, boilerMat);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0.45, 0.1, 0);
    train.add(boiler);

    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.12, 10);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0.18, 0.35, 0);
    train.add(chimney);

    // Smoke
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#bdc3c7', transparent: true, opacity: 0.3 });
    [0.4, 0.48, 0.58].forEach((y, i) => {
      const smokeGeo = new THREE.SphereGeometry(0.03 + i * 0.01, 8, 8);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.18 + i * 0.05, y, 0);
      train.add(smoke);
    });
  } else {
    // Windows
    const windowMat = new THREE.MeshStandardMaterial({ color: '#87ceeb', metalness: 0.4 });
    const windowGeo = new THREE.PlaneGeometry(0.07, 0.06);
    [-0.16, 0, 0.16].forEach(x => {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(x, 0.14, 0.126);
      train.add(win);
    });
  }

  // Label
  const labelSprite = createTextSprite(label, isHighlighted ? '#000' : '#fff', 18, true);
  labelSprite.position.y = 0.42;
  labelSprite.scale.set(0.4, 0.1, 1);
  train.add(labelSprite);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.65, 0.32, 0.29);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.1;
    train.add(glow);
  }

  return train;
}

// ==================== DOMINO ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f5f0e8',
    roughness: 0.4,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });

  const tileGeo = new THREE.BoxGeometry(0.2, 0.4, 0.05);
  const tile = new THREE.Mesh(tileGeo, tileMat);
  tile.castShadow = true;
  domino.add(tile);

  // Border
  const borderGeo = new THREE.BoxGeometry(0.21, 0.41, 0.045);
  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.005;
  domino.add(border);

  // Groove
  const grooveGeo = new THREE.BoxGeometry(0.16, 0.008, 0.01);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50' });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.024;
  domino.add(groove);

  // Dots
  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.01, 10);
  const dotMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#fff' : '#1a1a1a',
  });

  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0.12]],
    2: [[-0.04, 0.16], [0.04, 0.08]],
    3: [[-0.04, 0.16], [0, 0.12], [0.04, 0.08]],
    4: [[-0.04, 0.16], [0.04, 0.16], [-0.04, 0.08], [0.04, 0.08]],
  };

  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];

  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, 0.022);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);

    const dot2 = new THREE.Mesh(dotGeo, dotMat);
    dot2.position.set(-x, -y, 0.022);
    dot2.rotation.x = Math.PI / 2;
    domino.add(dot2);
  });

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.24, 0.44, 0.025);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== CLIPBOARD ====================

function createClipboard(label: string, color: string, isHighlighted: boolean): THREE.Group {
  const clipboard = new THREE.Group();

  const boardGeo = new THREE.BoxGeometry(0.34, 0.45, 0.014);
  const boardMat = new THREE.MeshStandardMaterial({
    color: '#6d4c2a',
    roughness: 0.65,
    emissive: isHighlighted ? '#ffff00' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.castShadow = true;
  clipboard.add(board);

  // Clip
  const clipGeo = new THREE.BoxGeometry(0.1, 0.03, 0.018);
  const clipMat = new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.9 });
  const clip = new THREE.Mesh(clipGeo, clipMat);
  clip.position.set(0, 0.24, 0.01);
  clipboard.add(clip);

  // Paper
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 180;
  paperCanvas.height = 250;
  const pctx = paperCanvas.getContext('2d')!;

  pctx.fillStyle = '#fefef6';
  pctx.fillRect(0, 0, 180, 250);

  pctx.fillStyle = color;
  pctx.fillRect(0, 0, 180, 30);

  pctx.fillStyle = '#fff';
  pctx.font = 'bold 14px Arial';
  pctx.textAlign = 'center';
  pctx.fillText('TO-DO: ' + label, 90, 22);

  const tasks = [
    { text: 'Review notes', done: true },
    { text: 'Complete homework', done: true },
    { text: 'Practice coding', done: isHighlighted },
    { text: 'Read chapter 5', done: false },
    { text: 'Submit project', done: false },
  ];

  tasks.forEach((task, i) => {
    const y = 50 + i * 35;

    pctx.strokeStyle = '#d4d0c8';
    pctx.lineWidth = 0.8;
    pctx.beginPath();
    pctx.moveTo(15, y + 16);
    pctx.lineTo(165, y + 16);
    pctx.stroke();

    pctx.strokeStyle = '#666';
    pctx.lineWidth = 1.5;
    pctx.strokeRect(18, y, 12, 12);

    if (task.done) {
      pctx.strokeStyle = '#27ae60';
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.moveTo(20, y + 6);
      pctx.lineTo(23, y + 10);
      pctx.lineTo(29, y + 3);
      pctx.stroke();

      pctx.fillStyle = '#999';
      pctx.font = '11px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 36, y + 10);
    } else {
      pctx.fillStyle = '#2c3e50';
      pctx.font = '11px Arial';
      pctx.textAlign = 'left';
      pctx.fillText(task.text, 36, y + 10);
    }
  });

  pctx.strokeStyle = '#e74c3c';
  pctx.lineWidth = 1;
  pctx.beginPath();
  pctx.moveTo(12, 35);
  pctx.lineTo(12, 240);
  pctx.stroke();

  const paperTex = new THREE.CanvasTexture(paperCanvas);
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    new THREE.MeshBasicMaterial({ map: paperTex })
  );
  paper.position.z = 0.008;
  clipboard.add(paper);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.38, 0.49, 0.035);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.12 });
    clipboard.add(new THREE.Mesh(glowGeo, glowMat));
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
    emissiveIntensity: isHighlighted ? 0.3 : 0,
  });

  const ticketGeo = new THREE.BoxGeometry(0.36, 0.2, 0.01);
  const ticketBody = new THREE.Mesh(ticketGeo, ticketMat);
  ticketBody.castShadow = true;
  ticket.add(ticketBody);

  // Front design
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, 240, 25);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('★ ADMIT ONE ★', 100, 18);

  ctx.font = 'bold 36px Arial';
  ctx.fillText(label, 100, 72);

  ctx.font = 'bold 12px Arial';
  ctx.fillText('⭐ VIP ACCESS ⭐', 100, 100);

  const frontTex = new THREE.CanvasTexture(canvas);
  const frontMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.18),
    new THREE.MeshBasicMaterial({ map: frontTex, transparent: true })
  );
  frontMesh.position.z = 0.006;
  ticket.add(frontMesh);

  // Gold border
  const borderMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.6 });

  const hBorderGeo = new THREE.BoxGeometry(0.38, 0.005, 0.012);
  const topBorder = new THREE.Mesh(hBorderGeo, borderMat);
  topBorder.position.y = 0.1;
  ticket.add(topBorder);

  const bottomBorder = new THREE.Mesh(hBorderGeo, borderMat);
  bottomBorder.position.y = -0.1;
  ticket.add(bottomBorder);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.4, 0.24, 0.025);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    ticket.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return ticket;
}

// ==================== CHAIR ====================

function createChair(x: number): THREE.Group {
  const chair = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });

  const seatGeo = new THREE.BoxGeometry(0.18, 0.018, 0.18);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = -0.14;
  chair.add(seat);

  const backGeo = new THREE.BoxGeometry(0.18, 0.14, 0.012);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, -0.06, -0.08);
  chair.add(back);

  const legGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6);
  [[-0.07, -0.2, 0.07], [0.07, -0.2, 0.07], [-0.07, -0.2, -0.07], [0.07, -0.2, -0.07]].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, ly, lz);
    chair.add(leg);
  });

  chair.position.x = x;
  return chair;
}
// ==================== PART 2/2: BUILD SCENE + MAIN COMPONENT ====================
// Place this DIRECTLY after Part 1 (in the same file)

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
  // Clear existing children
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
  }

  const spacing = structure === 'linkedlist' ? 1.0
    : structure === 'queue' ? 0.85
    : 0.75;
  const startX = -((data.length - 1) * spacing) / 2;

  // ==================== ARRAY ====================
  if (structure === 'array') {
    if (environment === 'grocery') {
      const shelfWidth = data.length * spacing + 0.6;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const product = createGroceryBox(item.color, item.label, isHl);
        product.position.set(startX + i * spacing, 0.08, 0);
        if (isHl) product.position.y += 0.08;
        applyItemAnimation(product, i, animPhase || '', animData || {}, 'array');
        group.add(product);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 16);
        idx.position.set(startX + i * spacing, -0.1, 0);
        idx.scale.set(0.22, 0.1, 1);
        group.add(idx);
      });

      // Shelf
      const shelfMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.7, roughness: 0.3 });
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.02, 0.28), shelfMat);
      shelf.position.y = 0.06;
      shelf.receiveShadow = true;
      group.add(shelf);

      const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth, 0.02, 0.28), shelfMat);
      lowerShelf.position.y = -0.28;
      group.add(lowerShelf);

      // Poles
      const poleMat = new THREE.MeshStandardMaterial({ color: '#a0a0a0', metalness: 0.8 });
      const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 10);
      [-shelfWidth / 2 + 0.03, shelfWidth / 2 - 0.03].forEach(x => {
        [0.12, -0.1].forEach(z => {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(x, -0.06, z);
          group.add(pole);
        });
      });

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(shelfWidth + 0.3, 0.65),
        new THREE.MeshStandardMaterial({ color: '#e8dcc8', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.45;
      group.add(floor);

    } else if (environment === 'classroom') {
      const roomWidth = data.length * spacing + 1.2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.05 : 0, 0);
          human.scale.setScalar(0.7);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'array');
          group.add(human);

          const chair = createChair(startX + i * spacing);
          chair.scale.setScalar(0.7);
          group.add(chair);

          // Desk
          const deskGeo = new THREE.BoxGeometry(0.25, 0.015, 0.16);
          const deskMat = new THREE.MeshStandardMaterial({ color: '#a0855b', roughness: 0.7 });
          const desk = new THREE.Mesh(deskGeo, deskMat);
          desk.position.set(startX + i * spacing, -0.07, 0.16);
          desk.scale.setScalar(0.7);
          group.add(desk);
        }

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 16);
        idx.position.set(startX + i * spacing, -0.34, 0);
        idx.scale.set(0.2, 0.09, 1);
        group.add(idx);
      });

      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.2),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.28;
      group.add(floor);

      // Back wall
      const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 0.85),
        new THREE.MeshStandardMaterial({ color: '#f0e6d2' })
      );
      backWall.position.set(0, 0.1, -0.4);
      group.add(backWall);

      // Whiteboard
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth * 0.5, 0.38, 0.015),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
      );
      board.position.set(0, 0.22, -0.38);
      group.add(board);

    } else if (environment === 'todo') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i || highlightIndex2 === i;
        const clipboard = createClipboard(item.label, item.color, isHl);
        clipboard.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        clipboard.scale.setScalar(0.65);
        applyItemAnimation(clipboard, i, animPhase || '', animData || {}, 'array');
        group.add(clipboard);

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 16);
        idx.position.set(startX + i * spacing, -0.38, 0);
        idx.scale.set(0.2, 0.09, 1);
        group.add(idx);
      });

      // Desk
      const deskWidth = data.length * spacing + 0.4;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(deskWidth, 0.03, 0.4),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = -0.25;
      group.add(desk);
    }

  // ==================== LINKED LIST ====================
  } else if (structure === 'linkedlist') {
    if (environment === 'train') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        trainCar.scale.setScalar(0.75);
        applyItemAnimation(trainCar, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(trainCar);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, highlightIndex === i || highlightIndex === i + 1);
          arrow.position.y = -0.12;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 10);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.22, 0);
          ptrLabel.scale.set(0.24, 0.07, 1);
          group.add(ptrLabel);
        }
      });

      // HEAD label
      const headSprite = createTextSprite('HEAD', '#ff0000', 16, true);
      headSprite.position.set(startX, 0.52, 0);
      headSprite.scale.set(0.28, 0.1, 1);
      group.add(headSprite);

      // TAIL label
      const tailSprite = createTextSprite('TAIL', '#0066ff', 16, true);
      tailSprite.position.set(startX + (data.length - 1) * spacing, 0.52, 0);
      tailSprite.scale.set(0.28, 0.1, 1);
      group.add(tailSprite);

      // NULL
      const nullSprite = createTextSprite('NULL', '#ff0000', 18);
      nullSprite.position.set(startX + data.length * spacing, 0, 0);
      nullSprite.scale.set(0.28, 0.18, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.1, false);
      nullArrow.position.y = -0.12;
      group.add(nullArrow);

      // Rails
      const railMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.6 });
      const railGeo = new THREE.BoxGeometry(data.length * spacing + 1.2, 0.015, 0.02);
      [-0.1, 0.1].forEach(z => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(0, -0.1, z);
        group.add(rail);
      });

      // Ties
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.03, 0.01, 0.28);
      for (let x = startX - 0.4; x <= startX + data.length * spacing + 0.4; x += 0.14) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(x, -0.11, 0);
        group.add(tie);
      }

      // Ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.6, 0.85),
        new THREE.MeshStandardMaterial({ color: '#8b7355', side: THREE.DoubleSide })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.12;
      group.add(ground);

    } else if (environment === 'people') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.05 : 0, 0);
          human.scale.setScalar(0.65);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'linkedlist');
          group.add(human);
        }

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = 0.06;
          group.add(arrow);

          const ptrLabel = createTextSprite('next →', '#00ff00', 10);
          ptrLabel.position.set((startX + i * spacing + startX + (i + 1) * spacing) / 2, -0.03, 0);
          ptrLabel.scale.set(0.22, 0.06, 1);
          group.add(ptrLabel);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 14, true);
      headSprite.position.set(startX, 0.48, 0);
      headSprite.scale.set(0.25, 0.09, 1);
      group.add(headSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 16);
      nullSprite.position.set(startX + data.length * spacing, 0.06, 0);
      nullSprite.scale.set(0.25, 0.16, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.08, false);
      nullArrow.position.y = 0.06;
      group.add(nullArrow);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 0.8, 0.5),
        new THREE.MeshStandardMaterial({ color: '#95a5a6', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.13;
      group.add(floor);

    } else if (environment === 'domino') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const domino = createDomino(item.label, isHl);
        domino.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
        domino.scale.setScalar(0.75);
        applyItemAnimation(domino, i, animPhase || '', animData || {}, 'linkedlist');
        group.add(domino);

        if (i < data.length - 1) {
          const arrow = createArrow(startX + i * spacing, startX + (i + 1) * spacing, false);
          arrow.position.y = -0.28;
          group.add(arrow);
        }
      });

      const headSprite = createTextSprite('HEAD', '#ff0000', 14, true);
      headSprite.position.set(startX, 0.34, 0);
      headSprite.scale.set(0.25, 0.09, 1);
      group.add(headSprite);

      const nullSprite = createTextSprite('NULL', '#ff0000', 14);
      nullSprite.position.set(startX + data.length * spacing, -0.28, 0);
      nullSprite.scale.set(0.25, 0.16, 1);
      group.add(nullSprite);

      const nullArrow = createArrow(startX + (data.length - 1) * spacing, startX + data.length * spacing - 0.08, false);
      nullArrow.position.y = -0.28;
      group.add(nullArrow);

      // Table
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.6, 0.03, 0.5),
        new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 })
      );
      table.position.y = -0.24;
      group.add(table);
    }

  // ==================== STACK ====================
  } else if (structure === 'stack') {
    if (environment === 'books') {
      const stackSpacing = 0.1;
      const baseY = -data.length * stackSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const book = createBook(item.label, item.color, isHl);
        book.position.set(isHl ? 0.15 : 0, baseY + i * stackSpacing, 0);
        book.rotation.y = (i % 2 === 0) ? 0 : 0.03;
        applyItemAnimation(book, i, animPhase || '', animData || {}, 'stack');
        group.add(book);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 18, true);
          topSprite.position.set(0.58, baseY + i * stackSpacing, 0);
          topSprite.scale.set(0.34, 0.1, 1);
          group.add(topSprite);
        }
      });

      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.03, 0.6),
        new THREE.MeshStandardMaterial({ color: '#5d4037', roughness: 0.7 })
      );
      desk.position.y = baseY - 0.07;
      group.add(desk);

    } else if (environment === 'plates') {
      const plateSpacing = 0.04;
      const plateBaseY = -data.length * plateSpacing / 2;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const plate = createPlate(item.label, isHl);
        plate.position.set(isHl ? 0.1 : 0, plateBaseY + i * plateSpacing, 0);
        plate.scale.setScalar(0.55);
        applyItemAnimation(plate, i, animPhase || '', animData || {}, 'stack');
        group.add(plate);

        if (i === data.length - 1) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 18, true);
          topSprite.position.set(0.42, plateBaseY + i * plateSpacing, 0);
          topSprite.scale.set(0.3, 0.09, 1);
          group.add(topSprite);
        }
      });

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.05, 0.5),
        new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.4 })
      );
      counter.position.y = plateBaseY - 0.05;
      group.add(counter);

      // Cafeteria sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 240;
      signCanvas.height = 45;
      const sctx = signCanvas.getContext('2d')!;
      sctx.fillStyle = '#e74c3c';
      sctx.fillRect(0, 0, 240, 45);
      sctx.fillStyle = '#fff';
      sctx.font = 'bold 24px Arial';
      sctx.textAlign = 'center';
      sctx.fillText('🍽️ CAFETERIA 🍽️', 120, 32);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: signTex, transparent: true })
      );
      signSprite.position.set(0, plateBaseY + data.length * plateSpacing + 0.25, 0);
      signSprite.scale.set(0.65, 0.12, 1);
      group.add(signSprite);

    } else if (environment === 'boxes') {
      const boxSpacing = 0.36;
      const boxBaseY = -data.length * boxSpacing / 2 + 0.15;

      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const isTop = i === data.length - 1;
        const isPeeking = animPhase === 'stack-peek-open' && isTop && isHl;
        const box = createCardboardBox(item.label, item.color, isHl, isPeeking);
        box.position.set(isHl ? 0.15 : 0, boxBaseY + i * boxSpacing, 0);
        box.rotation.y = (i % 2 === 0) ? 0 : 0.04;
        box.scale.setScalar(0.72);
        applyItemAnimation(box, i, animPhase || '', animData || {}, 'stack');
        group.add(box);

        if (isTop) {
          const topSprite = createTextSprite('← TOP', '#ff0000', 18, true);
          topSprite.position.set(0.52, boxBaseY + i * boxSpacing, 0);
          topSprite.scale.set(0.3, 0.09, 1);
          group.add(topSprite);
        }
      });

      // Pallet
      const pallet = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.05, 0.55),
        new THREE.MeshStandardMaterial({ color: '#a0522d', roughness: 0.9 })
      );
      pallet.position.y = boxBaseY - 0.2;
      group.add(pallet);
    }

  // ==================== QUEUE ====================
  } else if (structure === 'queue') {
    if (environment === 'tollgate') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        car.position.set(startX + i * spacing, isHl ? 0.05 : 0, 0);
        car.scale.setScalar(0.72);
        applyItemAnimation(car, i, animPhase || '', animData || {}, 'queue');
        group.add(car);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 14, true);
      frontSprite.position.set(startX, -0.18, 0);
      frontSprite.scale.set(0.25, 0.09, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 14, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.18, 0);
      rearSprite.scale.set(0.25, 0.09, 1);
      group.add(rearSprite);

      // Toll gate
      const gateX = startX - 0.68;
      const poleMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.5 });
      const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.58, 10);

      [0.2, -0.2].forEach(z => {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(gateX, 0.2, z);
        group.add(pole);
      });

      const topBarGeo = new THREE.BoxGeometry(0.05, 0.05, 0.45);
      const topBar = new THREE.Mesh(topBarGeo, poleMat);
      topBar.position.set(gateX, 0.5, 0);
      group.add(topBar);

      // Barrier
      const barrierGeo = new THREE.BoxGeometry(0.4, 0.03, 0.03);
      const barrierMat = new THREE.MeshStandardMaterial({ color: '#e74c3c' });
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(gateX - 0.2, 0.42, 0);
      barrier.rotation.z = 0.25;
      group.add(barrier);

      // TOLL sign
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 120;
      signCanvas.height = 45;
      const signCtx = signCanvas.getContext('2d')!;
      signCtx.fillStyle = '#2c3e50';
      signCtx.fillRect(0, 0, 120, 45);
      signCtx.fillStyle = '#fff';
      signCtx.font = 'bold 24px Arial';
      signCtx.textAlign = 'center';
      signCtx.fillText('TOLL', 60, 32);

      const signTex = new THREE.CanvasTexture(signCanvas);
      const signSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: signTex, transparent: true })
      );
      signSprite.position.set(gateX, 0.6, 0);
      signSprite.scale.set(0.28, 0.1, 1);
      group.add(signSprite);

      // Road
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2, 0.58),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.06;
      group.add(road);

      // Dashed lines
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let x = startX - 0.8; x <= startX + data.length * spacing + 0.4; x += 0.2) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.018), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, -0.055, 0);
        group.add(dash);
      }

    } else if (environment === 'tickets') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const ticket = createTicket(item.label, item.color, isHl);
        ticket.position.set(startX + i * spacing, isHl ? 0.06 : 0, 0);
        ticket.scale.setScalar(0.72);
        applyItemAnimation(ticket, i, animPhase || '', animData || {}, 'queue');
        group.add(ticket);
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 14, true);
      frontSprite.position.set(startX, -0.18, 0);
      frontSprite.scale.set(0.25, 0.09, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 14, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.18, 0);
      rearSprite.scale.set(0.25, 0.09, 1);
      group.add(rearSprite);

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(data.length * spacing + 0.5, 0.03, 0.34),
        new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.3 })
      );
      counter.position.y = -0.12;
      group.add(counter);

      // NOW SERVING sign
      const servingCanvas = document.createElement('canvas');
      servingCanvas.width = 200;
      servingCanvas.height = 65;
      const svctx = servingCanvas.getContext('2d')!;
      svctx.fillStyle = '#1a1a2e';
      svctx.fillRect(0, 0, 200, 65);
      svctx.strokeStyle = '#ffd700';
      svctx.lineWidth = 2;
      svctx.strokeRect(3, 3, 194, 59);
      svctx.fillStyle = '#00ff00';
      svctx.font = 'bold 12px Arial';
      svctx.textAlign = 'center';
      svctx.fillText('NOW SERVING', 100, 22);
      svctx.font = 'bold 26px Arial';
      svctx.fillStyle = '#ff0';
      svctx.fillText(data.length > 0 ? data[0].label : '---', 100, 52);

      const servingTex = new THREE.CanvasTexture(servingCanvas);
      const servingSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: servingTex, transparent: true })
      );
      servingSprite.position.set(startX - 0.5, 0.15, 0);
      servingSprite.scale.set(0.38, 0.12, 1);
      group.add(servingSprite);

    } else if (environment === 'students') {
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        if (item.appearance) {
          const human = createHuman3D(item.appearance, item.label, isHl);
          human.position.set(startX + i * spacing, isHl ? 0.05 : 0, 0);
          human.scale.setScalar(0.6);
          applyItemAnimation(human, i, animPhase || '', animData || {}, 'queue');
          group.add(human);
        }
      });

      const frontSprite = createTextSprite('FRONT', '#00ff00', 12, true);
      frontSprite.position.set(startX, -0.16, 0);
      frontSprite.scale.set(0.22, 0.07, 1);
      group.add(frontSprite);

      const rearSprite = createTextSprite('REAR', '#ff6600', 12, true);
      rearSprite.position.set(startX + (data.length - 1) * spacing, -0.16, 0);
      rearSprite.scale.set(0.22, 0.07, 1);
      group.add(rearSprite);

      // School entrance
      const buildingX = startX - 0.78;
      const wallMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.8 });

      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.68), wallMat);
      frontWall.position.set(buildingX, 0.15, 0);
      group.add(frontWall);

      const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.42, 0.28), doorFrameMat);
      doorFrame.position.set(buildingX + 0.015, 0.05, 0);
      group.add(doorFrame);

      const doorMat = new THREE.MeshStandardMaterial({ color: '#6d4c2a' });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.38, 0.12), doorMat);
      door.position.set(buildingX + 0.04, 0.04, 0.1);
      door.rotation.y = -0.7;
      group.add(door);

      // School sign
      const schoolCanvas = document.createElement('canvas');
      schoolCanvas.width = 200;
      schoolCanvas.height = 45;
      const schCtx = schoolCanvas.getContext('2d')!;
      schCtx.fillStyle = '#1a5276';
      schCtx.fillRect(0, 0, 200, 45);
      schCtx.strokeStyle = '#ffd700';
      schCtx.lineWidth = 2;
      schCtx.strokeRect(2, 2, 196, 41);
      schCtx.fillStyle = '#fff';
      schCtx.font = 'bold 15px Arial';
      schCtx.textAlign = 'center';
      schCtx.fillText('📚 DS ACADEMY 📚', 100, 30);

      const schoolTex = new THREE.CanvasTexture(schoolCanvas);
      const schoolSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: schoolTex, transparent: true })
      );
      schoolSprite.position.set(buildingX, 0.52, 0);
      schoolSprite.scale.set(0.42, 0.1, 1);
      group.add(schoolSprite);

      // Roof
      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.03, 0.72),
        new THREE.MeshStandardMaterial({ color: '#c0392b' })
      );
      roofMesh.position.set(buildingX, 0.46, 0);
      group.add(roofMesh);

      // Pathway
      const pathway = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 1.5, 0.42),
        new THREE.MeshStandardMaterial({ color: '#bdc3c7', side: THREE.DoubleSide })
      );
      pathway.rotation.x = -Math.PI / 2;
      pathway.position.y = -0.11;
      group.add(pathway);
    }
  }
}

// ==================== OPERATION BUTTON ====================

function OpBtn({ onClick, disabled, color, label }: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 18px',
        fontSize: 13,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 25,
        background: disabled ? '#555' : color,
        color: 'white',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'transform 0.1s, opacity 0.2s',
      }}
    >
      {label}
    </button>
  );
}

// ==================== VISUALIZATION 3D ====================

function Visualization3D({
  position,
  data,
  highlightIndex,
  highlightIndex2,
  structure,
  environment,
  zoomLevel,
  setZoomLevel,
  animPhase,
  animData,
}: {
  position: Position;
  data: DataItem[];
  highlightIndex: number | null;
  highlightIndex2: number | null;
  structure: DataStructure;
  environment: string;
  zoomLevel: number;
  setZoomLevel: (z: number) => void;
  animPhase: string;
  animData: Record<string, unknown>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0.15, y: 0, targetX: 0.15, targetY: 0 });
  const zoomRef = useRef(zoomLevel);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  const renderWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const renderHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, structure === 'stack' ? 1.0 : 0.4, structure === 'stack' ? 4.5 : 4.0);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(renderWidth, renderHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    const fillLight = new THREE.PointLight(0xffffff, 0.3);
    fillLight.position.set(0, -3, 3);
    scene.add(fillLight);

    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // Interaction
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchDist: number | null = null;
    let pinchZoom = 1;

    const getDist = (t: TouchList): number | null => {
      if (t.length < 2) return null;
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        pinchDist = getDist(e.touches);
        pinchZoom = zoomRef.current;
      } else if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchDist !== null) {
        const d = getDist(e.touches);
        if (d) setZoomLevel(Math.max(0.1, Math.min(3, pinchZoom * (d / pinchDist))));
      } else if (e.touches.length === 1 && isDragging) {
        rotationRef.current.targetY += (e.touches[0].clientX - lastX) * 0.008;
        rotationRef.current.targetX += (e.touches[0].clientY - lastY) * 0.006;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length < 2) pinchDist = null;
      if (e.touches.length === 0) isDragging = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      rotationRef.current.targetY += (e.clientX - lastX) * 0.008;
      rotationRef.current.targetX += (e.clientY - lastY) * 0.006;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel(Math.max(0.1, Math.min(3, zoomRef.current + (e.deltaY > 0 ? -0.12 : 0.12))));
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Animation loop
    let animationId: number;
    const DAMPING = 0.1;

    const animate = () => {
      if (groupRef.current) {
        // Smooth damping
        rotationRef.current.x += (rotationRef.current.targetX - rotationRef.current.x) * DAMPING;
        rotationRef.current.y += (rotationRef.current.targetY - rotationRef.current.y) * DAMPING;

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
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [structure, renderWidth, renderHeight, setZoomLevel]);

  useEffect(() => {
    if (!groupRef.current) return;
    buildSceneContent(
      groupRef.current,
      data,
      highlightIndex,
      highlightIndex2,
      structure,
      environment,
      animPhase,
      animData
    );
  }, [data, highlightIndex, highlightIndex2, structure, environment, animPhase, animData]);

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
      }}
    />
  );
}

// ==================== MAIN COMPONENT ====================

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

  const [appMode, setAppMode] = useState<AppMode>('surface');
  const [surfacePosition, setSurfacePosition] = useState<Position | null>(null);
  const [surfacePlaced, setSurfacePlaced] = useState(false);

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

  const getCurrentData = () => {
    if (currentStructure === 'array') return getArrayData();
    if (currentStructure === 'linkedlist') return getLinkedListData();
    if (currentStructure === 'stack') return getStackData();
    return getQueueData();
  };

  const currentEnvId = currentStructure === 'array' ? arrayEnv
    : currentStructure === 'linkedlist' ? linkedListEnv
    : currentStructure === 'stack' ? stackEnv
    : queueEnv;

  const setCurrentEnv = currentStructure === 'array' ? setArrayEnv
    : currentStructure === 'linkedlist' ? setLinkedListEnv
    : currentStructure === 'stack' ? setStackEnv
    : setQueueEnv;

  const currentData = getCurrentData();

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
        await new Promise<void>(resolve => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
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
    try {
      await startCamera(newFacing);
    } catch (err) {
      console.error(err);
    }
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
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
        setIsLoading(false);
      }
    };
    init();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== PERSON DETECTION ====================

  useEffect(() => {
    if (!model || !videoRef.current || !canvasRef.current || appMode !== 'person') return;

    let animationId: number;
    let running = true;
    let lastDetection = 0;

    const detect = async () => {
      if (!running || !videoRef.current || !canvasRef.current) return;

      const now = Date.now();
      if (now - lastDetection < 100) {
        animationId = requestAnimationFrame(detect);
        return;
      }
      lastDetection = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== 4) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        const predictions = await model.detect(video);
        const humans = predictions.filter((p: Detection) => p.class === 'person' && p.score > 0.5);

        if (humans.length > 0) {
          const [x, y, width, height] = humans[0].bbox;
          const scaleX = window.innerWidth / canvas.width;
          const scaleY = window.innerHeight / canvas.height;

          setDetectedPerson({
            bbox: humans[0].bbox,
            class: humans[0].class,
            score: humans[0].score
          });
          setPersonPosition({
            x: x * scaleX,
            y: y * scaleY,
            width: width * scaleX,
            height: height * scaleY
          });
        } else {
          setDetectedPerson(null);
          setPersonPosition(null);
        }
      } catch (e) {
        console.error(e);
      }

      if (running) animationId = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      running = false;
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [model, appMode]);

  // ==================== SURFACE MODE ====================

  const handleSurfaceTap = useCallback((e: React.MouseEvent) => {
    if (appMode !== 'surface' || surfacePlaced) return;

    const { clientX, clientY } = e;
    if (clientY < 140 || clientY > window.innerHeight - 160) return;

    const vizWidth = Math.min(window.innerWidth - 20, 360);
    const vizHeight = currentStructure === 'stack' ? 280 : 200;

    setSurfacePosition({
      x: clientX - vizWidth / 2,
      y: clientY - vizHeight / 2,
      width: vizWidth,
      height: vizHeight
    });
    setSurfacePlaced(true);
  }, [appMode, surfacePlaced, currentStructure]);

  const resetSurfacePlacement = useCallback(() => {
    setSurfacePlaced(false);
    setSurfacePosition(null);
  }, []);

  const switchToMode = useCallback((mode: AppMode) => {
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
  }, []);

  const activePosition = appMode === 'person' ? personPosition : surfacePosition;
  const showVisualization = appMode === 'person' ? !!detectedPerson : surfacePlaced;

  // ==================== ARRAY OPERATIONS ====================

  const arrayAccess = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const data = getArrayData();
    const index = Math.floor(Math.random() * data.length);
    setHighlightIndex(index);
    setOperationMessage(`Accessing [${index}]...`);
    setCodeDisplay(`// O(1) Access\narray[${index}]`);
    setAnimPhase('access-lift');
    setAnimData({ index });
    await delay(400);
    setAnimPhase('access-bounce');
    setOperationMessage(`Found: "${data[index].label}"`);
    await delay(900);
    setAnimPhase('access-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arrayInsert = async () => {
    if (isAnimating || getArrayData().length >= 6) return;
    setIsAnimating(true);
    const data = getArrayData();
    const insertIndex = Math.floor(Math.random() * (data.length + 1));
    setOperationMessage(`Inserting at [${insertIndex}]...`);
    setCodeDisplay(`// O(n) Insert\narray.splice(${insertIndex}, 0, item)`);

    for (let i = data.length - 1; i >= insertIndex; i--) {
      setHighlightIndex(i);
      await delay(200);
    }

    const newItem: DataItem = arrayEnv === 'classroom'
      ? { id: Date.now(), label: 'New', color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#1abc9c' };

    (setArrayData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => {
      const arr = [...prev];
      arr.splice(insertIndex, 0, newItem);
      return arr;
    });

    setHighlightIndex(insertIndex);
    setAnimPhase('insert-drop');
    setAnimData({ index: insertIndex });
    await delay(500);
    setAnimPhase('insert-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setOperationMessage('Inserted!');
    await delay(800);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arrayDelete = async () => {
    if (isAnimating || getArrayData().length <= 2) return;
    setIsAnimating(true);
    const data = getArrayData();
    const deleteIndex = Math.floor(Math.random() * data.length);
    setHighlightIndex(deleteIndex);
    setOperationMessage(`Deleting [${deleteIndex}]: "${data[deleteIndex].label}"`);
    setCodeDisplay(`// O(n) Delete\narray.splice(${deleteIndex}, 1)`);
    setAnimPhase('delete-lift');
    setAnimData({ index: deleteIndex });
    await delay(500);
    setAnimPhase('delete-shrink');
    await delay(500);
    setHighlightIndex(null);
    (setArrayData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => prev.filter((_, i) => i !== deleteIndex));
    setAnimPhase('');
    setAnimData({});
    await delay(500);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const arraySwap = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const data = getArrayData();
    const idx1 = Math.floor(Math.random() * data.length);
    let idx2 = Math.floor(Math.random() * data.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * data.length);
    setHighlightIndex(idx1);
    setHighlightIndex2(idx2);
    setOperationMessage(`Swapping [${idx1}] ↔ [${idx2}]`);
    setCodeDisplay('// O(1) Swap');
    setAnimPhase('swap-lift');
    setAnimData({ index1: idx1, index2: idx2 });
    await delay(500);
    setAnimPhase('swap-cross');
    await delay(400);
    (setArrayData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => {
      const a = [...prev];
      [a[idx1], a[idx2]] = [a[idx2], a[idx1]];
      return a;
    });
    setAnimPhase('swap-drop');
    await delay(500);
    setAnimPhase('');
    setAnimData({});
    setHighlightIndex(null);
    setHighlightIndex2(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
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

    (setLinkedListData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => [newItem, ...prev]);
    setHighlightIndex(0);
    setAnimPhase('ll-insert-head');
    setAnimData({ index: 0 });
    await delay(500);
    setAnimPhase('ll-insert-head-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setOperationMessage('Inserted at HEAD!');
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListInsertTail = async () => {
    if (isAnimating || getLinkedListData().length >= 5) return;
    setIsAnimating(true);
    const data = getLinkedListData();
    setOperationMessage('Traversing to TAIL...');
    setCodeDisplay('// O(n) Traverse');

    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setAnimPhase('ll-traverse');
      setAnimData({ index: i });
      await delay(300);
    }

    setAnimPhase('');
    setAnimData({});

    const newItem: DataItem = linkedListEnv === 'people'
      ? { id: Date.now(), label: 'Last', color: '#e74c3c', appearance: { skinTone: '#8d5524', shirtColor: '#e74c3c', pantsColor: '#2c3e50', hairColor: '#1a1a1a', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: 'New', color: '#e74c3c' };

    (setLinkedListData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('ll-insert-tail');
    setAnimData({ index: data.length });
    await delay(500);
    setAnimPhase('ll-insert-tail-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setOperationMessage('Inserted at TAIL!');
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListDeleteHead = async () => {
    if (isAnimating || getLinkedListData().length <= 2) return;
    setIsAnimating(true);
    setHighlightIndex(0);
    setOperationMessage('Deleting HEAD...');
    setCodeDisplay('// O(1)\nhead = head.next');
    setAnimPhase('ll-delete-lift');
    setAnimData({ index: 0 });
    await delay(500);
    setAnimPhase('ll-delete-shrink');
    await delay(500);
    (setLinkedListData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => prev.slice(1));
    setAnimPhase('');
    setAnimData({});
    await delay(500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const linkedListTraverse = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const data = getLinkedListData();

    for (let i = 0; i < data.length; i++) {
      setHighlightIndex(i);
      setOperationMessage(`Visiting: ${data[i].label}`);
      setCodeDisplay(`// Node ${i}\ncurr = curr.next`);
      setAnimPhase('ll-traverse');
      setAnimData({ index: i });
      await delay(500);
    }

    setAnimPhase('');
    setAnimData({});
    setOperationMessage(`Done! ${data.length} nodes`);
    await delay(1000);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
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
    (setStackData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('stack-push-drop');
    setAnimData({ index: data.length });
    await delay(500);
    setAnimPhase('stack-push-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setOperationMessage('Pushed!');
    await delay(800);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const stackPop = async () => {
    if (isAnimating || getStackData().length <= 1) return;
    setIsAnimating(true);
    const data = getStackData();
    const topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Popping "${topItem.label}"...`);
    setCodeDisplay(`// O(1) LIFO\nstack.pop() → "${topItem.label}"`);
    setAnimPhase('stack-pop-lift');
    setAnimData({ index: data.length - 1 });
    await delay(500);
    setAnimPhase('stack-pop-fly');
    await delay(500);
    (setStackData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => prev.slice(0, -1));
    setAnimPhase('');
    setAnimData({});
    await delay(500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const stackPeek = async () => {
    if (isAnimating || getStackData().length === 0) return;
    setIsAnimating(true);
    const data = getStackData();
    const topItem = data[data.length - 1];
    setHighlightIndex(data.length - 1);
    setOperationMessage(`Peeking TOP...`);
    setCodeDisplay(`// O(1)\nstack.peek()`);
    setAnimPhase('stack-peek-lift');
    setAnimData({ index: data.length - 1 });
    await delay(400);
    setAnimPhase('stack-peek-open');
    setOperationMessage(`TOP: "${topItem.label}"`);
    await delay(1200);
    setAnimPhase('stack-peek-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== QUEUE OPERATIONS ====================

  const queueEnqueue = async () => {
    if (isAnimating || getQueueData().length >= 5) return;
    setIsAnimating(true);
    const data = getQueueData();

    const newItem: DataItem = queueEnv === 'students'
      ? { id: Date.now(), label: `Stu ${data.length + 1}`, color: '#1abc9c', appearance: { skinTone: '#ffdbac', shirtColor: '#1abc9c', pantsColor: '#2c3e50', hairColor: '#4a3728', hairStyle: 'short', gender: 'male' } }
      : { id: Date.now(), label: queueEnv === 'tollgate' ? 'New' : `T-00${data.length + 1}`, color: '#1abc9c' };

    setOperationMessage(`Enqueue: "${newItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.enqueue("${newItem.label}")`);
    (setQueueData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => [...prev, newItem]);
    setHighlightIndex(data.length);
    setAnimPhase('queue-enqueue-enter');
    setAnimData({ index: data.length });
    await delay(500);
    setAnimPhase('queue-enqueue-settle');
    await delay(400);
    setAnimPhase('');
    setAnimData({});
    setOperationMessage('Enqueued!');
    await delay(800);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const queueDequeue = async () => {
    if (isAnimating || getQueueData().length <= 1) return;
    setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`Dequeue: "${frontItem.label}"...`);
    setCodeDisplay(`// O(1) FIFO\nqueue.dequeue() → "${frontItem.label}"`);
    setAnimPhase('queue-dequeue-exit');
    setAnimData({ index: 0 });
    await delay(600);
    setAnimPhase('queue-dequeue-gone');
    await delay(400);
    (setQueueData as React.Dispatch<React.SetStateAction<DataItem[]>>)(prev => prev.slice(1));
    setAnimPhase('');
    setAnimData({});
    await delay(500);
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  const queueFront = async () => {
    if (isAnimating || getQueueData().length === 0) return;
    setIsAnimating(true);
    const frontItem = getQueueData()[0];
    setHighlightIndex(0);
    setOperationMessage(`FRONT: "${frontItem.label}"`);
    setCodeDisplay(`// O(1)\nqueue.front() → "${frontItem.label}"`);
    setAnimPhase('queue-front-peek');
    setAnimData({ index: 0 });
    await delay(1500);
    setAnimPhase('');
    setAnimData({});
    setHighlightIndex(null);
    setOperationMessage('');
    setCodeDisplay('');
    setIsAnimating(false);
  };

  // ==================== RENDER ====================

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ fontSize: 80 }}>📷</div>
        <h2>Camera Access Needed</h2>
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
    ? [{ id: 'grocery', icon: '🛒', label: 'Shelf' }, { id: 'classroom', icon: '🧑‍🤝‍🧑', label: 'Seats' }, { id: 'todo', icon: '📝', label: 'Tasks' }]
    : currentStructure === 'linkedlist'
      ? [{ id: 'train', icon: '🚂', label: 'Train' }, { id: 'people', icon: '👥', label: 'Line' }, { id: 'domino', icon: '🁡', label: 'Domino' }]
      : currentStructure === 'stack'
        ? [{ id: 'books', icon: '📚', label: 'Books' }, { id: 'plates', icon: '🍽️', label: 'Plates' }, { id: 'boxes', icon: '📦', label: 'Boxes' }]
        : [{ id: 'tollgate', icon: '🚗', label: 'Toll' }, { id: 'tickets', icon: '🎫', label: 'Tickets' }, { id: 'students', icon: '🧑‍🎓', label: 'Students' }];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}
      onClick={appMode === 'surface' && !surfacePlaced ? handleSurfaceTap : undefined}
    >
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showVisualization && activePosition && (
        <Visualization3D
          position={activePosition}
          data={currentData}
          highlightIndex={highlightIndex}
          highlightIndex2={highlightIndex2}
          structure={currentStructure}
          environment={currentEnvId}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          animPhase={animPhase}
          animData={animData}
        />
      )}

      {/* TOP CONTROLS */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 10, zIndex: 100 }}>
        <button onClick={switchCamera} style={{ position: 'absolute', top: 10, right: 10, width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 22 }}>🔄</button>

        {/* Mode switcher */}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(0,0,0,0.8)', borderRadius: 25, padding: 3, border: '1px solid rgba(255,255,255,0.2)' }}>
          <button onClick={() => switchToMode('person')} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'person' ? '#667eea' : 'transparent', color: 'white', opacity: appMode === 'person' ? 1 : 0.5 }}>🧑 Person</button>
          <button onClick={() => switchToMode('surface')} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 'bold', border: 'none', borderRadius: 20, background: appMode === 'surface' ? '#00b894' : 'transparent', color: 'white', opacity: appMode === 'surface' ? 1 : 0.5 }}>📱 Surface</button>
        </div>

        {/* Zoom controls */}
        {showVisualization && (
          <div style={{ position: 'absolute', top: 50, left: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setZoomLevel(z => Math.min(z + 0.2, 3))} style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #fff', background: '#667eea', color: 'white', fontSize: 26, fontWeight: 'bold' }}>+</button>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#000', border: '3px solid #0f0', color: '#0f0', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(zoomLevel * 100)}%</div>
            <button onClick={() => setZoomLevel(z => Math.max(z - 0.2, 0.2))} style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #fff', background: '#f5576c', color: 'white', fontSize: 30, fontWeight: 'bold' }}>−</button>
            <button onClick={() => setZoomLevel(1)} style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #fff', background: '#4facfe', color: 'white', fontSize: 18 }}>⟲</button>
          </div>
        )}

        {/* Data structure tabs */}
        <div style={{ position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 4, borderRadius: 25 }}>
          {(['array', 'linkedlist', 'stack', 'queue'] as DataStructure[]).map(s => (
            <button key={s} onClick={() => { if (!isAnimating) { setCurrentStructure(s); if (appMode === 'surface') resetSurfacePlacement(); } }}
              style={{ padding: '8px 12px', fontSize: 11, border: 'none', borderRadius: 20, background: currentStructure === s ? '#667eea' : 'transparent', color: 'white', opacity: currentStructure === s ? 1 : 0.6 }}>
              {{ array: '📊', linkedlist: '🔗', stack: '📚', queue: '🚗' }[s]}{currentStructure === s && ' ' + { array: 'Array', linkedlist: 'List', stack: 'Stack', queue: 'Queue' }[s]}
            </button>
          ))}
        </div>

        {/* Environment tabs */}
        {showVisualization && (
          <div style={{ position: 'absolute', top: 88, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 20 }}>
            {envTabs.map(e => (
              <button key={e.id} onClick={() => !isAnimating && (setCurrentEnv as (val: string) => void)(e.id)}
                style={{ padding: '6px 12px', fontSize: 11, border: 'none', borderRadius: 15, background: currentEnvId === e.id ? '#00b894' : 'transparent', color: 'white', opacity: currentEnvId === e.id ? 1 : 0.6 }}>
                {e.icon} {e.label}
              </button>
            ))}
          </div>
        )}

        {/* Operation message */}
        {operationMessage && (
          <div style={{ position: 'absolute', top: 126, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '10px 20px', borderRadius: 15, fontSize: 14, border: '1px solid #0f0', whiteSpace: 'nowrap' }}>
            ⚡ {operationMessage}
          </div>
        )}

        {/* Code display */}
        {codeDisplay && (
          <div style={{ position: 'absolute', top: 166, left: '50%', transform: 'translateX(-50%)', background: '#1e1e1e', color: '#0f0', padding: '10px 15px', borderRadius: 10, fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid #444' }}>
            {codeDisplay}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      {showVisualization && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 10px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 100 }}>
          {appMode === 'surface' && surfacePlaced && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <button onClick={resetSurfacePlacement} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'white' }}>📍 Reposition</button>
            </div>
          )}

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

          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            Size: {currentData.length}
            {appMode === 'surface' && <span style={{ marginLeft: 10, color: '#00b894' }}>📱 Surface</span>}
          </div>
        </div>
      )}

      {/* INSTRUCTIONS */}
      {appMode === 'person' && !detectedPerson && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🧑</div>
          <div style={{ marginTop: 8 }}>Point camera at a person</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 5 }}>or switch to Surface mode →</div>
        </div>
      )}

      {appMode === 'surface' && !surfacePlaced && (
        <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: 'white', padding: '20px 30px', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'tapBounce 1.5s ease infinite' }}>👆</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>Tap to Place</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 5 }}>Tap anywhere to place visualization</div>
          <style>{`@keyframes tapBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        </div>
      )}
    </div>
  );
}
