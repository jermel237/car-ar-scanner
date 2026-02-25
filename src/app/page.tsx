// ==================== FIXED DOMINO (Original Simple Style) ====================

function createDomino(value: string, isHighlighted: boolean): THREE.Group {
  const domino = new THREE.Group();

  // Main tile (simple white/cream)
  const tileGeo = new THREE.BoxGeometry(0.24, 0.48, 0.07);
  const tileMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#1abc9c' : '#f5f0e8',
    roughness: 0.4,
    metalness: 0.05,
    emissive: isHighlighted ? '#1abc9c' : '#000',
    emissiveIntensity: isHighlighted ? 0.25 : 0,
  });
  domino.add(new THREE.Mesh(tileGeo, tileMat));

  // Border edge
  const borderGeo = new THREE.BoxGeometry(0.25, 0.49, 0.06);
  const borderMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.z = -0.01;
  domino.add(border);

  // Center dividing line
  const grooveGeo = new THREE.BoxGeometry(0.2, 0.012, 0.015);
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3 });
  const groove = new THREE.Mesh(grooveGeo, grooveMat);
  groove.position.z = 0.03;
  domino.add(groove);

  // Dots based on value
  const val = parseInt(value) || 1;
  const dotGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.015, 16);
  const dotMat = new THREE.MeshStandardMaterial({
    color: isHighlighted ? '#fff' : '#1a1a1a',
    roughness: 0.3,
    metalness: 0.1,
  });

  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0.14]],
    2: [[-0.05, 0.2], [0.05, 0.08]],
    3: [[-0.05, 0.2], [0, 0.14], [0.05, 0.08]],
    4: [[-0.05, 0.2], [0.05, 0.2], [-0.05, 0.08], [0.05, 0.08]],
  };

  const topDots = dotPositions[Math.min(val, 4)] || dotPositions[1];

  // Top half dots
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(x, y, 0.028);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);
  });

  // Bottom half dots (mirrored)
  topDots.forEach(([x, y]) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-x, -y, 0.028);
    dot.rotation.x = Math.PI / 2;
    domino.add(dot);
  });

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.28, 0.52, 0.03);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 });
    domino.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return domino;
}

// ==================== FIXED CAR (Facing Forward) ====================

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

  // Hood (FRONT of car - positive X)
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

  // Windshield (FRONT)
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

  // Headlights (FRONT - positive X)
  const headlightGeo = new THREE.BoxGeometry(0.012, 0.045, 0.065);
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#ffffee' });
  [-0.1, 0.1].forEach(hz => {
    const hl = new THREE.Mesh(headlightGeo, headlightMat);
    hl.position.set(0.325, 0.12, hz);
    car.add(hl);
  });

  // Tail lights (BACK - negative X)
  const tailGeo = new THREE.BoxGeometry(0.012, 0.04, 0.055);
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2222' });
  [-0.1, 0.1].forEach(tz => {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(-0.325, 0.12, tz);
    car.add(tl);
  });

  // Grille (FRONT)
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

  // License plate (FRONT)
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
  
  // Front plate
  const frontPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.05),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  frontPlate.position.set(0.326, 0.06, 0);
  frontPlate.rotation.y = Math.PI / 2;
  car.add(frontPlate);

  // Back plate
  const backPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.05),
    new THREE.MeshBasicMaterial({ map: plateTex })
  );
  backPlate.position.set(-0.326, 0.06, 0);
  backPlate.rotation.y = -Math.PI / 2;
  car.add(backPlate);

  if (isHighlighted) {
    const glowGeo = new THREE.BoxGeometry(0.7, 0.38, 0.38);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.18;
    car.add(glow);
  }

  return car;
}

// ==================== FIXED TRAIN CAR (Engine Facing Forward) ====================

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

  // Engine parts (FRONT is NEGATIVE X - left side, so train moves right to left visually, but displays left to right)
  // Actually, for linked list, HEAD is on LEFT, so engine should face RIGHT (positive X)
  if (isEngine) {
    // Boiler (front of engine - positive X)
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

    // Headlight (FRONT)
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
    chimney.position.set(0.5, 0.42, 0);
    train.add(chimney);

    // Smoke puffs
    const smokeMat = new THREE.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.4 });
    [0.55, 0.65, 0.75, 0.88].forEach((sy, i) => {
      const smokeGeo = new THREE.SphereGeometry(0.05 + i * 0.02, 12, 12);
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(0.5 - i * 0.03, sy, (Math.random() - 0.5) * 0.1);
      train.add(smoke);
    });

    // Cow catcher (FRONT)
    const catcherMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.6 });
    const catcherGeo = new THREE.BoxGeometry(0.08, 0.12, 0.25);
    const catcher = new THREE.Mesh(catcherGeo, catcherMat);
    catcher.position.set(0.78, -0.02, 0);
    train.add(catcher);

    // Cab (BACK of engine)
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
// ==================== FIXED PLATE WITH BETTER FOOD ====================

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

  // Blue decorative band
  const bandGeo = new THREE.TorusGeometry(0.22, 0.01, 8, 48);
  const bandMat = new THREE.MeshStandardMaterial({ color: '#2980b9' });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.014;
  plate.add(band);

  // REALISTIC FOOD based on plate number
  const plateNum = parseInt(label.replace(/\D/g, '')) || 1;

  if (plateNum % 3 === 1) {
    // === STEAK WITH VEGETABLES ===
    
    // Steak (realistic oval shape with grill marks)
    const steakGeo = new THREE.CylinderGeometry(0.08, 0.075, 0.025, 16);
    const steakMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.7 });
    const steak = new THREE.Mesh(steakGeo, steakMat);
    steak.position.set(-0.02, 0.025, 0.02);
    steak.scale.set(1.3, 1, 0.9);
    plate.add(steak);

    // Grill marks on steak
    const grillMarkMat = new THREE.MeshStandardMaterial({ color: '#3d2817', roughness: 0.8 });
    for (let i = -2; i <= 2; i++) {
      const markGeo = new THREE.BoxGeometry(0.15, 0.003, 0.008);
      const mark = new THREE.Mesh(markGeo, grillMarkMat);
      mark.position.set(-0.02, 0.039, 0.02 + i * 0.02);
      mark.rotation.y = 0.3;
      plate.add(mark);
    }

    // Mashed potatoes
    const mashedGeo = new THREE.SphereGeometry(0.055, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const mashedMat = new THREE.MeshStandardMaterial({ color: '#F5DEB3', roughness: 0.9 });
    const mashed = new THREE.Mesh(mashedGeo, mashedMat);
    mashed.position.set(0.1, 0.015, -0.06);
    plate.add(mashed);

    // Butter on mashed potatoes
    const butterGeo = new THREE.BoxGeometry(0.02, 0.008, 0.02);
    const butterMat = new THREE.MeshStandardMaterial({ color: '#FFD700', roughness: 0.4 });
    const butter = new THREE.Mesh(butterGeo, butterMat);
    butter.position.set(0.1, 0.055, -0.06);
    plate.add(butter);

    // Broccoli
    const broccoliMat = new THREE.MeshStandardMaterial({ color: '#228B22', roughness: 0.8 });
    const broccoliStemMat = new THREE.MeshStandardMaterial({ color: '#556B2F', roughness: 0.7 });
    
    [[-0.08, 0.02, -0.08], [-0.05, 0.02, -0.1], [-0.1, 0.02, -0.06]].forEach(([bx, by, bz]) => {
      // Floret top
      const floretGeo = new THREE.SphereGeometry(0.02, 8, 8);
      const floret = new THREE.Mesh(floretGeo, broccoliMat);
      floret.position.set(bx, by + 0.015, bz);
      floret.scale.set(1, 0.7, 1);
      plate.add(floret);
      
      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.02, 6);
      const stem = new THREE.Mesh(stemGeo, broccoliStemMat);
      stem.position.set(bx, by, bz);
      plate.add(stem);
    });

    // Carrot slices
    const carrotMat = new THREE.MeshStandardMaterial({ color: '#FF8C00', roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const carrotGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.008, 12);
      const carrot = new THREE.Mesh(carrotGeo, carrotMat);
      carrot.position.set(0.08 + i * 0.02, 0.018, 0.06);
      plate.add(carrot);
    }

  } else if (plateNum % 3 === 2) {
    // === PASTA WITH SAUCE ===
    
    // Spaghetti noodles (curved tubes)
    const spaghettiMat = new THREE.MeshStandardMaterial({ color: '#F4D03F', roughness: 0.6 });
    
    for (let layer = 0; layer < 4; layer++) {
      for (let n = 0; n < 8; n++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.08 + Math.random() * 0.04, 0.015 + layer * 0.012, -0.06 + Math.random() * 0.04),
          new THREE.Vector3(-0.02 + Math.random() * 0.04, 0.02 + layer * 0.012, -0.02 + Math.random() * 0.04),
          new THREE.Vector3(0.04 + Math.random() * 0.04, 0.015 + layer * 0.012, 0.02 + Math.random() * 0.04),
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.004, 6, false);
        const noodle = new THREE.Mesh(tubeGeo, spaghettiMat);
        plate.add(noodle);
      }
    }

    // Tomato sauce on top
    const sauceGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const sauceMat = new THREE.MeshStandardMaterial({ color: '#C0392B', roughness: 0.5 });
    const sauce = new THREE.Mesh(sauceGeo, sauceMat);
    sauce.position.set(0, 0.055, 0);
    sauce.scale.set(1.2, 0.4, 1.2);
    plate.add(sauce);

    // Sauce drips
    for (let i = 0; i < 6; i++) {
      const dripGeo = new THREE.SphereGeometry(0.012 + Math.random() * 0.008, 8, 8);
      const drip = new THREE.Mesh(dripGeo, sauceMat);
      const angle = (i / 6) * Math.PI * 2;
      drip.position.set(Math.cos(angle) * 0.07, 0.04, Math.sin(angle) * 0.07);
      drip.scale.set(1, 0.5, 1);
      plate.add(drip);
    }

    // Meatballs
    const meatballMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.6 });
    [[-0.03, 0.06, 0.03], [0.04, 0.065, -0.02], [0, 0.07, 0.05]].forEach(([mx, my, mz]) => {
      const meatballGeo = new THREE.SphereGeometry(0.03, 12, 12);
      const meatball = new THREE.Mesh(meatballGeo, meatballMat);
      meatball.position.set(mx, my, mz);
      plate.add(meatball);
    });

    // Basil leaves
    const basilMat = new THREE.MeshStandardMaterial({ color: '#2ECC71', roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const basilGeo = new THREE.CircleGeometry(0.012, 8);
      const basil = new THREE.Mesh(basilGeo, basilMat);
      basil.position.set(-0.02 + i * 0.02, 0.08, 0.01 + i * 0.01);
      basil.rotation.x = -Math.PI / 3;
      basil.rotation.z = Math.random() * 0.5;
      plate.add(basil);
    }

    // Parmesan cheese sprinkle
    const cheeseMat = new THREE.MeshStandardMaterial({ color: '#FFFACD', roughness: 0.8 });
    for (let i = 0; i < 15; i++) {
      const cheeseGeo = new THREE.BoxGeometry(0.004, 0.002, 0.004);
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      cheese.position.set(
        (Math.random() - 0.5) * 0.12,
        0.075 + Math.random() * 0.01,
        (Math.random() - 0.5) * 0.12
      );
      cheese.rotation.y = Math.random() * Math.PI;
      plate.add(cheese);
    }

  } else {
    // === FRESH SALAD ===
    
    // Lettuce leaves
    const lettuceMat = new THREE.MeshStandardMaterial({ color: '#90EE90', roughness: 0.7, side: THREE.DoubleSide });
    const lettuceDarkMat = new THREE.MeshStandardMaterial({ color: '#228B22', roughness: 0.7, side: THREE.DoubleSide });
    
    for (let i = 0; i < 8; i++) {
      const leafGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const leafMat = i % 2 === 0 ? lettuceMat : lettuceDarkMat;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / 8) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.06, 0.02 + Math.random() * 0.01, Math.sin(angle) * 0.06);
      leaf.scale.set(1.2, 0.25, 1);
      leaf.rotation.y = angle;
      leaf.rotation.x = Math.random() * 0.3;
      plate.add(leaf);
    }

    // Center lettuce
    const centerLettuceGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const centerLettuce = new THREE.Mesh(centerLettuceGeo, lettuceMat);
    centerLettuce.position.set(0, 0.03, 0);
    centerLettuce.scale.set(1, 0.4, 1);
    plate.add(centerLettuce);

    // Cherry tomatoes
    const tomatoMat = new THREE.MeshStandardMaterial({ color: '#FF6347', roughness: 0.4 });
    const tomatoStemMat = new THREE.MeshStandardMaterial({ color: '#228B22' });
    
    [[-0.06, 0.04, 0.04], [0.05, 0.045, -0.03], [0.02, 0.04, 0.07], [-0.04, 0.04, -0.06]].forEach(([tx, ty, tz]) => {
      const tomatoGeo = new THREE.SphereGeometry(0.02, 12, 12);
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(tx, ty, tz);
      plate.add(tomato);
      
      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.008, 6);
      const stem = new THREE.Mesh(stemGeo, tomatoStemMat);
      stem.position.set(tx, ty + 0.022, tz);
      plate.add(stem);
    });

    // Cucumber slices
    const cucumberSkinMat = new THREE.MeshStandardMaterial({ color: '#228B22', roughness: 0.5 });
    const cucumberInnerMat = new THREE.MeshStandardMaterial({ color: '#98FB98', roughness: 0.6 });
    
    for (let i = 0; i < 4; i++) {
      // Outer (skin)
      const outerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16);
      const outer = new THREE.Mesh(outerGeo, cucumberSkinMat);
      outer.position.set(0.08 - i * 0.015, 0.035, -0.05 + i * 0.02);
      plate.add(outer);

      // Inner
      const innerGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.009, 16);
      const inner = new THREE.Mesh(innerGeo, cucumberInnerMat);
      inner.position.set(0.08 - i * 0.015, 0.035, -0.05 + i * 0.02);
      plate.add(inner);
    }

    // Feta cheese cubes
    const fetaMat = new THREE.MeshStandardMaterial({ color: '#FFFAFA', roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const fetaGeo = new THREE.BoxGeometry(0.018, 0.015, 0.018);
      const feta = new THREE.Mesh(fetaGeo, fetaMat);
      feta.position.set(
        (Math.random() - 0.5) * 0.1,
        0.045,
        (Math.random() - 0.5) * 0.1
      );
      feta.rotation.y = Math.random() * 0.5;
      plate.add(feta);
    }

    // Red onion rings
    const onionMat = new THREE.MeshStandardMaterial({ color: '#8B008B', roughness: 0.5, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 3; i++) {
      const onionGeo = new THREE.TorusGeometry(0.018, 0.004, 8, 16);
      const onion = new THREE.Mesh(onionGeo, onionMat);
      onion.position.set(
        (Math.random() - 0.5) * 0.1,
        0.05,
        (Math.random() - 0.5) * 0.1
      );
      onion.rotation.x = Math.PI / 2 + Math.random() * 0.3;
      plate.add(onion);
    }

    // Olive oil drizzle (shiny spots)
    const oilMat = new THREE.MeshStandardMaterial({ color: '#DAA520', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 8; i++) {
      const oilGeo = new THREE.CircleGeometry(0.005 + Math.random() * 0.005, 8);
      const oil = new THREE.Mesh(oilGeo, oilMat);
      oil.position.set(
        (Math.random() - 0.5) * 0.12,
        0.055,
        (Math.random() - 0.5) * 0.12
      );
      oil.rotation.x = -Math.PI / 2;
      plate.add(oil);
    }
  }

  // Highlight glow
  if (isHighlighted) {
    const glowGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.04, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.15 });
    plate.add(new THREE.Mesh(glowGeo, glowMat));
  }

  return plate;
}

// ==================== FIXED BUILD SCENE CONTENT ====================

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
          // Students face forward (toward camera)
          const human = createHuman3D(item.appearance, item.label, isHl, 0);
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
        }

        const idx = createTextSprite(`[${i}]`, isHl ? '#ffff00' : '#ffffff', 22);
        idx.position.set(startX + i * spacing, -0.42, 0);
        idx.scale.set(0.25, 0.12, 1);
        group.add(idx);
      });

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, 1.5),
        new THREE.MeshStandardMaterial({ color: '#c4a882', side: THREE.DoubleSide })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.35;
      group.add(floor);

      const wallMat = new THREE.MeshStandardMaterial({ color: '#f0e6d2', roughness: 0.9 });
      const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 1.0), wallMat);
      backWall.position.set(0, 0.1, -0.5);
      group.add(backWall);

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
      // Train: Engine is at HEAD (left side), facing RIGHT (positive X direction)
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const trainCar = createTrainCar(i === 0, item.color, item.label, isHl);
        trainCar.position.set(startX + i * spacing, isHl ? 0.12 : 0, 0);
        trainCar.scale.setScalar(0.85);
        // NO rotation needed - engine already faces right (positive X)
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

      // Ties
      const tieMat = new THREE.MeshStandardMaterial({ color: '#5d4037' });
      const tieGeo = new THREE.BoxGeometry(0.04, 0.015, 0.35);
      for (let tx = startX - 0.5; tx <= startX + data.length * spacing + 0.5; tx += 0.2) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(tx, -0.13, 0);
        group.add(tie);
      }

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
          // People face forward (toward camera)
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
      // Cars should face LEFT (toward the toll gate at negative X)
      data.forEach((item, i) => {
        const isHl = highlightIndex === i;
        const car = createCar(item.color, item.label, isHl);
        car.position.set(startX + i * spacing, isHl ? 0.08 : 0, 0);
        car.scale.setScalar(0.82);
        // Rotate car 180 degrees so front faces LEFT (toward toll gate)
        car.rotation.y = Math.PI;
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

      // Toll gate (positioned at FRONT, to the LEFT of the queue)
      const tollGate = createTollGate();
      tollGate.position.set(startX - 1.0, 0, 0);
      tollGate.scale.setScalar(0.65);
      // Rotate toll gate to face the cars
      tollGate.rotation.y = Math.PI / 2;
      group.add(tollGate);

      // Road
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(data.length * spacing + 2.5, 0.7),
        new THREE.MeshStandardMaterial({ color: '#34495e', side: THREE.DoubleSide })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.y = -0.08;
      group.add(road);

      // Road dashed lines
      const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      for (let dx = startX - 1; dx <= startX + data.length * spacing + 0.5; dx += 0.25) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.025), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, -0.075, 0);
        group.add(dash);
      }

      // EXIT arrow
      const exitSprite = createTextSprite('← EXIT', '#00ff00', 18);
      exitSprite.position.set(startX - 1.5, 0.3, 0);
      exitSprite.scale.set(0.35, 0.12, 1);
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
          // Students face LEFT toward the school building
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
