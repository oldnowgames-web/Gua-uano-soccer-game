// --- PROGRESSÃO / PERSISTÊNCIA (localStorage) ---
const STORAGE_KEY = 'guacuanoProgress';

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return Object.assign({ bestStreak: 0, totalGols: 0 }, parsed);
        }
    } catch (e) { /* localStorage indisponível */ }
    return { bestStreak: 0, totalGols: 0 };
}

function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* localStorage indisponível */ }
}

let progress = loadProgress();

// --- SONS ---
// Coloque os arquivos de áudio numa pasta "sounds/" ao lado do index.html:
//   sounds/ball_kick.mp3  -> chute (toca nos dois modos)
//   sounds/trave.mp3      -> bola bateu na trave (toca nos dois modos)
//   sounds/gol.mpeg       -> gol (só no modo competitivo)
//   sounds/torcida.mp3    -> som de fundo da torcida, em loop (só no modo competitivo)
const SOUNDS_PATH = 'sounds/';

function createSound(file, { loop = false, volume = 1 } = {}) {
    const audio = new Audio(SOUNDS_PATH + file);
    audio.loop = loop;
    audio.volume = volume;
    return audio;
}

const sfxKick = createSound('ball_kick.mp3', { volume: 0.8 });
const sfxTrave = createSound('trave.mp3', { volume: 0.9 });
const sfxGol = createSound('gol.mpeg', { volume: 1.0 });
const sfxTorcida = createSound('torcida.mp3', { loop: true, volume: 0.35 });

function playSound(audio) {
    try {
        audio.currentTime = 0;
        // navegadores bloqueiam autoplay antes da 1ª interação do usuário;
        // o catch evita erro no console caso isso aconteça
        audio.play().catch(() => {});
    } catch (e) { /* ignore */ }
}

function startCrowd() {
    try {
        sfxTorcida.currentTime = 0;
        sfxTorcida.play().catch(() => {});
    } catch (e) { /* ignore */ }
}

function stopCrowd() {
    sfxTorcida.pause();
}

// Pausa a torcida (sem resetar), toca o som de gol, e quando ele terminar
// a torcida volta a tocar de onde parou — só faz sentido no modo competitivo
function playGolSound() {
    sfxTorcida.pause();
    sfxGol.onended = () => {
        if (currentMode === 'competitivo') {
            sfxTorcida.play().catch(() => {});
        }
    };
    playSound(sfxGol);
}

// --- CONFIGURAÇÃO DA CENA 3D ---
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1118);
scene.fog = new THREE.Fog(0x0a1118, 18, 40);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 1.5, 4.2);
camera.lookAt(0, 1.0, -12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// --- ILUMINAÇÃO DE ESTÁDIO ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
mainLight.position.set(8, 18, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
fillLight.position.set(-8, 15, -5);
scene.add(fillLight);

// --- TEXTURA DO CAMPO ---
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const stripeHeight = 1024 / 12;
    for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#276e2a' : '#2e8132';
        ctx.fillRect(0, i * stripeHeight, 1024, stripeHeight);
    }

    for (let i = 0; i < 80000; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;

    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(1024, 20);
    ctx.stroke();

    ctx.strokeRect(262, 20, 500, 320);
    ctx.strokeRect(387, 20, 250, 130);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(512, 260, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(512, 260, 110, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
}

const fieldGeo = new THREE.PlaneGeometry(16, 30);
const fieldMat = new THREE.MeshStandardMaterial({
    map: createGrassTexture(),
    roughness: 0.8
});
const field = new THREE.Mesh(fieldGeo, fieldMat);
field.rotation.x = -Math.PI / 2;
field.position.set(0, 0, -10);
field.receiveShadow = true;
scene.add(field);

// --- BOLA (modelo GLB) ---
const ballRadius = 0.35;
const ballZStart = 2.0;

// Esfera simples usada como fallback enquanto o modelo carrega (ou se ele falhar)
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.05
});
const ballFallbackMesh = new THREE.Mesh(ballGeo, ballMat);
ballFallbackMesh.castShadow = true;

// "ball" é um Group: mantém a mesma posição/rotação usada no resto do código,
// só troca o que aparece visualmente dentro dele (fallback ou o modelo GLB)
const ball = new THREE.Group();
ball.position.set(0, ballRadius, ballZStart);
ball.add(ballFallbackMesh);
scene.add(ball);

// Caminho do modelo .glb da bola — coloque o arquivo em "models/bola.glb"
// (na mesma pasta do index.html, dentro de uma pasta "models")
const BALL_MODEL_PATH = 'models/bola.glb';

const gltfLoader = new THREE.GLTFLoader();
gltfLoader.load(
    BALL_MODEL_PATH,
    (gltf) => {
        const model = gltf.scene;

        // Normaliza escala e centraliza o modelo para caber exatamente no
        // tamanho da bola usado na física (diâmetro = ballRadius * 2)
        const wrapper = new THREE.Group();
        wrapper.add(model);

        let box = new THREE.Box3().setFromObject(wrapper);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = (ballRadius * 2) / maxDim;
        wrapper.scale.setScalar(scale);

        box = new THREE.Box3().setFromObject(wrapper);
        const center = new THREE.Vector3();
        box.getCenter(center);
        wrapper.position.sub(center);

        wrapper.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = false;
            }
        });

        ball.remove(ballFallbackMesh);
        ball.add(wrapper);
    },
    undefined,
    (error) => {
        console.warn(`Não foi possível carregar "${BALL_MODEL_PATH}". Usando a bola padrão.`, error);
    }
);

// --- GOL 3D ---
const goalWidth = 4.2;
const goalHeight = 2.0;
const goalDepth = 1.2;
const postRadius = 0.08;
const goalZ = -12;

const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });

const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16), postMat);
leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
leftPost.castShadow = true;
scene.add(leftPost);

const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 16), postMat);
rightPost.position.set(goalWidth / 2, goalHeight / 2, goalZ);
rightPost.castShadow = true;
scene.add(rightPost);

const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 16), postMat);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, goalHeight, goalZ);
crossbar.castShadow = true;
scene.add(crossbar);

function createCheckeredNetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(28, 14);
    return texture;
}

const netMaterial = new THREE.MeshStandardMaterial({
    map: createCheckeredNetTexture(),
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    roughness: 0.9
});

const netBox = new THREE.Mesh(new THREE.BoxGeometry(goalWidth, goalHeight, goalDepth), netMaterial);
netBox.position.set(0, goalHeight / 2, goalZ - goalDepth / 2);
scene.add(netBox);

// --- GOLEIRO 3D ---
const keeperGroup = new THREE.Group();

// Textura do número "1" na camisa
function createNumberTexture(num) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 64, 68);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// Torso (camiseta verde escura de goleiro)
const jerseyMat = new THREE.MeshStandardMaterial({ color: 0x0B3D26, roughness: 0.7 });
const bodyGeo = new THREE.CylinderGeometry(0.25, 0.19, 0.75, 16);
const keeperBody = new THREE.Mesh(bodyGeo, jerseyMat);
keeperBody.position.y = 1.05;
keeperBody.castShadow = true;
keeperGroup.add(keeperBody);

// Número na camisa (frente)
const numberMat = new THREE.MeshBasicMaterial({ map: createNumberTexture(1), transparent: true });
const numberPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), numberMat);
numberPlane.position.set(0, 1.1, 0.245);
keeperGroup.add(numberPlane);

// Shorts (cintura)
const shortsMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.3, 16), shortsMat);
shorts.position.y = 0.62;
shorts.castShadow = true;
keeperGroup.add(shorts);

// Cabeça
const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
const headMat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB });
const keeperHead = new THREE.Mesh(headGeo, headMat);
keeperHead.position.y = 1.58;
keeperHead.castShadow = true;
keeperGroup.add(keeperHead);

// Boné/cabelo simples
const capGeo = new THREE.SphereGeometry(0.185, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const capMat = new THREE.MeshStandardMaterial({ color: 0x0B3D26 });
const keeperCap = new THREE.Mesh(capGeo, capMat);
keeperCap.position.y = 1.6;
keeperGroup.add(keeperCap);

// Materiais reutilizados
const limbMat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB, roughness: 0.6 }); // pele (braços de manga curta)
const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }); // pernas (short/meião)
const gloveGeo = new THREE.SphereGeometry(0.11, 12, 12);
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
const shoeGeo = new THREE.BoxGeometry(0.14, 0.09, 0.24);
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

// --- BRAÇOS (pivôs no ombro para animação) ---
const armLength = 0.55;

function createArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.27, 1.32, 0);

    const armMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.06, armLength, 12),
        limbMat
    );
    armMesh.position.y = -armLength / 2;
    armMesh.castShadow = true;
    shoulder.add(armMesh);

    const glove = new THREE.Mesh(gloveGeo, gloveMat);
    glove.position.y = -armLength - 0.06;
    glove.castShadow = true;
    shoulder.add(glove);

    // pose de base: braços levemente abertos e para frente
    shoulder.rotation.z = side * 0.25;
    shoulder.rotation.x = -0.15;

    keeperGroup.add(shoulder);
    return shoulder;
}

const leftShoulder = createArm(-1);
const rightShoulder = createArm(1);

// --- PERNAS (pivôs no quadril) ---
const legLength = 0.62;

function createLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.5, 0);

    const legMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.08, legLength, 12),
        legMat
    );
    legMesh.position.y = -legLength / 2;
    legMesh.castShadow = true;
    hip.add(legMesh);

    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.position.set(0, -legLength - 0.04, 0.04);
    shoe.castShadow = true;
    hip.add(shoe);

    keeperGroup.add(hip);
    return hip;
}

const leftHip = createLeg(-1);
const rightHip = createLeg(1);

keeperGroup.position.set(0, 0, goalZ + 0.3);
keeperGroup.visible = false;
scene.add(keeperGroup);

// --- HOLOFOTES (ESTÁDIO À NOITE) ---
const floodlightGroup = new THREE.Group();

function createFloodlight(x, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), poleMat);
    pole.position.set(0, 3.5, 0);
    group.add(pole);

    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d5 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.15), headMat);
    head.position.set(0, 7, 0.15);
    group.add(head);

    const light = new THREE.PointLight(0xfff6d5, 0.7, 16);
    light.position.set(0, 7, 0.4);
    group.add(light);

    group.position.set(x, 0, z);
    return group;
}

[[-8, -22], [8, -22], [-8, 2], [8, 2]].forEach(([x, z]) => {
    floodlightGroup.add(createFloodlight(x, z));
});
floodlightGroup.visible = false;
scene.add(floodlightGroup);

// --- CHUVA (CLIMA DINÂMICO) ---
const RAIN_COUNT = 350;
const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
const rainVelocities = new Float32Array(RAIN_COUNT);

function setRainDrop(i, x, y, z) {
    const idx = i * 6;
    rainPositions[idx] = x;
    rainPositions[idx + 1] = y;
    rainPositions[idx + 2] = z;
    rainPositions[idx + 3] = x;
    rainPositions[idx + 4] = y - 0.35;
    rainPositions[idx + 5] = z;
}

for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * 20;
    const y = Math.random() * 10 + 2;
    const z = (Math.random() - 0.5) * 30 - 10;
    setRainDrop(i, x, y, z);
    rainVelocities[i] = 0.15 + Math.random() * 0.12;
}

const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xaaccee, transparent: true, opacity: 0.5 });
const rainGroup = new THREE.LineSegments(rainGeo, rainMat);
rainGroup.visible = false;
scene.add(rainGroup);

function updateRain() {
    if (!isRaining) return;
    for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 6;
        rainPositions[idx + 1] -= rainVelocities[i];
        rainPositions[idx + 4] -= rainVelocities[i];
        if (rainPositions[idx + 1] < 0) {
            const x = (Math.random() - 0.5) * 20;
            const z = (Math.random() - 0.5) * 30 - 10;
            const y = 10 + Math.random() * 2;
            rainPositions[idx] = x; rainPositions[idx + 3] = x;
            rainPositions[idx + 1] = y; rainPositions[idx + 4] = y - 0.35;
            rainPositions[idx + 2] = z; rainPositions[idx + 5] = z;
        }
    }
    rainGeo.attributes.position.needsUpdate = true;
}

// --- CONDIÇÕES DA PARTIDA (CLIMA + HORÁRIO) ---
let isRaining = false;
let isNight = false;

function applyWeather() {
    rainGroup.visible = isRaining;
    fieldMat.color.set(isRaining ? 0x9fae9f : 0xffffff);
    fieldMat.roughness = isRaining ? 0.35 : 0.8;
}

function applyTimeOfDay() {
    if (isNight) {
        scene.background = new THREE.Color(0x02050a);
        scene.fog.color.set(0x02050a);
        ambientLight.intensity = 0.35;
        mainLight.intensity = 0.25;
        fillLight.intensity = 0.15;
        floodlightGroup.visible = true;
    } else {
        scene.background = new THREE.Color(0x8fd0ff);
        scene.fog.color.set(0x8fd0ff);
        ambientLight.intensity = 0.7;
        mainLight.intensity = 0.9;
        fillLight.intensity = 0.4;
        floodlightGroup.visible = false;
    }
}

function updateConditionsUI() {
    const el = document.getElementById('conditions-icon');
    if (!el) return;
    el.textContent = `${isNight ? '🌙' : '☀️'}${isRaining ? '🌧️' : ''}`;
}

function rollMatchConditions() {
    isRaining = Math.random() < 0.3;
    isNight = Math.random() < 0.5;
    applyWeather();
    applyTimeOfDay();
    updateConditionsUI();
}

// --- ESTADO DE ANIMAÇÃO DO GOLEIRO ---
let isDiving = false;
let diveStartTime = 0;
let diveDuration = 550;
let diveFromX = 0;
let diveToX = 0;
let diveDir = 0;
const keeperBaseY = keeperGroup.position.y;

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function startKeeperDive(targetX, power, duration) {
    isDiving = true;
    diveStartTime = performance.now();
    diveFromX = keeperGroup.position.x;

    // alcance máximo que o goleiro consegue cobrir num mergulho —
    // se a bola cair além disso, ele não chega a tempo
    const maxDiveReach = 0.85;
    const desiredDelta = targetX - diveFromX;
    const reachableDelta = THREE.MathUtils.clamp(desiredDelta, -maxDiveReach, maxDiveReach);

    diveToX = THREE.MathUtils.clamp(diveFromX + reachableDelta, keeperMinX - 0.3, keeperMaxX + 0.3);
    diveDir = Math.sign(diveToX - diveFromX) || 0;
    diveDuration = duration;
}

function resetKeeperPose() {
    isDiving = false;
    keeperGroup.rotation.z = 0;
    keeperGroup.rotation.x = 0;
    keeperGroup.position.y = keeperBaseY;
    leftShoulder.rotation.set(-0.15, 0, -0.25);
    rightShoulder.rotation.set(-0.15, 0, 0.25);
}

function updateKeeperAnimation(now) {
    if (!keeperGroup.visible) return;

    if (isDiving) {
        const t = Math.min((now - diveStartTime) / diveDuration, 1);
        const e = easeOutCubic(t);
        keeperGroup.position.x = diveFromX + (diveToX - diveFromX) * e;
        keeperGroup.rotation.z = -diveDir * 0.55 * e;
        keeperGroup.rotation.x = 0.1 * e;
        keeperGroup.position.y = keeperBaseY + Math.sin(e * Math.PI) * 0.1;

        // braços se abrem e se esticam para frente, na direção da bola
        leftShoulder.rotation.z = -0.25 + (-1.0 - (-0.25)) * e;
        rightShoulder.rotation.z = 0.25 + (1.0 - 0.25) * e;
        leftShoulder.rotation.x = -0.15 + (-0.95 - (-0.15)) * e;
        rightShoulder.rotation.x = -0.15 + (-0.95 - (-0.15)) * e;
    } else if (currentMode === 'competitivo') {
        // animação de espera: leve balanço e "dança" nas pernas
        const idle = Math.sin(now * 0.004);
        keeperGroup.position.y = keeperBaseY + Math.abs(idle) * 0.025;
        leftShoulder.rotation.z = -0.25 + idle * 0.08;
        rightShoulder.rotation.z = 0.25 - idle * 0.08;
        leftHip.rotation.z = idle * 0.12;
        rightHip.rotation.z = -idle * 0.12;
    }
}

// --- VARIÁVEIS DE JOGO E CONTROLE ---
let currentMode = 'treino';
let gols = 0;
let erros = 0;
let isShooting = false;
let canShoot = false;
let ballVel = { x: 0, y: 0, z: 0 };
const gravity = 0.012;

let windX = 0;
let hitPost = false;
let evaluated = false;

let keeperDir = 1;
const keeperSpeed = 0.03;
const keeperMinX = -1.5;
const keeperMaxX = 1.5;

let startX = 0, startY = 0;

// --- SEQUÊNCIA / APROVEITAMENTO ---
let currentStreak = 0;
let competitivoGols = 0;
let competitivoChutes = 0;

function updateStreakUI() {
    const streakEl = document.getElementById('streak-count');
    const bestEl = document.getElementById('best-streak-count');
    const aproveitEl = document.getElementById('aproveitamento-count');
    if (streakEl) streakEl.textContent = currentStreak;
    if (bestEl) bestEl.textContent = progress.bestStreak;
    if (aproveitEl) {
        const pct = competitivoChutes > 0 ? Math.round((competitivoGols / competitivoChutes) * 100) : 0;
        aproveitEl.textContent = `${pct}%`;
    }
}

function registerGol() {
    currentStreak++;
    progress.totalGols++;
    if (currentMode === 'competitivo') competitivoGols++;
    if (currentStreak > progress.bestStreak) progress.bestStreak = currentStreak;
    updateStreakUI();
    saveProgress();
}

function registerFalha() {
    currentStreak = 0;
    updateStreakUI();
    saveProgress();
}

// --- VENTO (varia durante toda a partida, não só ao repor a bola) ---
let windInterval = null;

function updateWindUI(windKm) {
    const windEl = document.getElementById('wind-count');
    if (!windEl) return;
    if (windKm > 0) {
        windEl.textContent = `➔ ${windKm} km/h`;
    } else if (windKm < 0) {
        windEl.textContent = `⬅ ${Math.abs(windKm)} km/h`;
    } else {
        windEl.textContent = `0 km/h`;
    }
}

function setRandomWind() {
    const windKm = Math.floor((Math.random() - 0.5) * 40);
    windX = windKm * 0.00007;
    updateWindUI(windKm);
}

function driftWind() {
    const maxWind = 0.0014;
    const change = (Math.random() - 0.5) * 0.0006;
    windX = THREE.MathUtils.clamp(windX + change, -maxWind, maxWind);
    updateWindUI(Math.round(windX / 0.00007));
}

function startWindDrift() {
    stopWindDrift();
    windInterval = setInterval(driftWind, 2200);
}

function stopWindDrift() {
    if (windInterval) clearInterval(windInterval);
    windInterval = null;
}

// --- NAVEGAÇÃO DE TELAS ---
document.getElementById('play-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
});

document.getElementById('history-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('history-screen').style.display = 'flex';
});

document.getElementById('history-back-btn').addEventListener('click', () => {
    document.getElementById('history-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
});

function startGame(mode) {
    currentMode = mode;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'flex';
    document.getElementById('scoreboard').classList.toggle('modo-treino', mode === 'treino');

    keeperGroup.visible = (mode === 'competitivo');

    gols = 0;
    erros = 0;
    currentStreak = 0;
    competitivoGols = 0;
    competitivoChutes = 0;
    document.getElementById('gols-count').textContent = '0';
    document.getElementById('erros-count').textContent = '0';
    updateStreakUI();

    rollMatchConditions();
    startWindDrift();
    resetBall();

    if (mode === 'competitivo') {
        startCrowd();
    } else {
        stopCrowd();
    }
}

function showMenu() {
    canShoot = false;
    isShooting = false;
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'none';
    keeperGroup.visible = false;
    stopWindDrift();
    stopCrowd();
}

// --- FUNÇÃO FULL SCREEN ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
            document.documentElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

document.getElementById('start-fullscreen-btn').addEventListener('click', toggleFullscreen);
document.getElementById('game-fullscreen-btn').addEventListener('click', toggleFullscreen);

document.getElementById('menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showMenu();
});

document.getElementById('reset-ball-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    resetBall();
});

document.getElementById('reset-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    gols = 0;
    erros = 0;
    currentStreak = 0;
    competitivoGols = 0;
    competitivoChutes = 0;
    document.getElementById('gols-count').textContent = '0';
    document.getElementById('erros-count').textContent = '0';
    updateStreakUI();
    resetBall();
});

// --- CONTROLES DO CHUTE ---
function handleStart(e) {
    if (!canShoot) return;
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX;
    startY = p.clientY;
}

function handleEnd(e) {
    if (!canShoot || isShooting) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const deltaX = p.clientX - startX;
    const deltaY = p.clientY - startY;

    if (deltaY < -20) {
        shoot(deltaX, deltaY);
    }
}

window.addEventListener('touchstart', handleStart);
window.addEventListener('touchend', handleEnd);
window.addEventListener('mousedown', handleStart);
window.addEventListener('mouseup', handleEnd);

function shoot(deltaX, deltaY) {
    canShoot = false;
    isShooting = true;
    hitPost = false;

    playSound(sfxKick);

    ballVel.z = - Math.min(Math.abs(deltaY) * 0.0035 + 0.22, 0.45);
    ballVel.x = deltaX * 0.0015;
    ballVel.y = Math.min(Math.abs(deltaY) * 0.002, 0.20);

    if (currentMode === 'competitivo') {
        competitivoChutes++;
        updateStreakUI();

        // força do chute com base na velocidade real da bola (0 = chute fraco, 1 = chute forte)
        const speedPower = THREE.MathUtils.clamp(
            (Math.abs(ballVel.z) - 0.22) / (0.45 - 0.22), 0, 1
        );

        // tempo estimado (em ms) até a bola chegar na linha do gol,
        // considerando a leve perda de velocidade (fator de decaimento) por frame
        const distToGoal = ball.position.z - goalZ;
        const avgSpeedZ = Math.abs(ballVel.z) * 0.85;
        const framesToGoal = distToGoal / avgSpeedZ;
        const msToGoal = framesToGoal * (1000 / 60);

        // posição X prevista da bola quando ela chegar na linha do gol
        const predictedX = ball.position.x + ballVel.x * framesToGoal * 0.85;

        // erro de leitura: o goleiro não é perfeito, mas erra menos que antes
        // (piora um pouco em campo molhado, pela dificuldade extra de leitura do lance)
        const readError = (Math.random() - 0.5) * (0.25 + speedPower * 0.35 + (isRaining ? 0.12 : 0));
        let keeperTargetX = predictedX + readError;

        // de vez em quando o goleiro lê o lance errado e pula pro lado oposto (mais raro agora)
        if (Math.random() < 0.06) {
            keeperTargetX = keeperGroup.position.x - (predictedX - keeperGroup.position.x);
        }

        // chute forte = menos tempo de reação pro goleiro
        const reactionDelay = 220 - speedPower * 60;
        const diveDur = THREE.MathUtils.clamp(msToGoal - reactionDelay - 40, 180, 420);

        setTimeout(() => startKeeperDive(keeperTargetX, speedPower, diveDur), reactionDelay);
    }
}

// --- FÍSICA E COLISÕES ---
function checkKeeperCollision() {
    if (currentMode !== 'competitivo' || evaluated) return false;

    const dist = Math.hypot(
        ball.position.x - keeperGroup.position.x,
        ball.position.y - 1.0,
        ball.position.z - keeperGroup.position.z
    );

    if (dist < 0.62) {
        ballVel.z = -ballVel.z * 0.4;
        ballVel.x = (ball.position.x - keeperGroup.position.x) * 0.2;
        ballVel.y = 0.1;
        return true;
    }
    return false;
}

function checkPostCollision() {
    if (hitPost) return;

    const postRadiusTotal = postRadius + ballRadius;
    const goalZMin = goalZ - postRadiusTotal;
    const goalZMax = goalZ + postRadiusTotal;

    if (ball.position.z <= goalZMax && ball.position.z >= goalZMin) {
        const bx = ball.position.x;
        const by = ball.position.y;

        const distLeft = Math.hypot(bx - (-goalWidth / 2), ball.position.z - goalZ);
        const distRight = Math.hypot(bx - (goalWidth / 2), ball.position.z - goalZ);
        const distCrossbar = Math.hypot(by - goalHeight, ball.position.z - goalZ);

        let collided = false;

        if (distLeft < postRadiusTotal && by <= goalHeight) {
            ballVel.x = -Math.abs(ballVel.x) * 0.8 - 0.06;
            ballVel.z = -ballVel.z * 0.5;
            collided = true;
        } 
        else if (distRight < postRadiusTotal && by <= goalHeight) {
            ballVel.x = Math.abs(ballVel.x) * 0.8 + 0.06;
            ballVel.z = -ballVel.z * 0.5;
            collided = true;
        } 
        else if (distCrossbar < postRadiusTotal && Math.abs(bx) <= goalWidth / 2) {
            ballVel.y = -Math.abs(ballVel.y) * 0.5 - 0.03;
            ballVel.z = -ballVel.z * 0.5;
            collided = true;
        }

        if (collided) {
            hitPost = true;
            playSound(sfxTrave);
            if (!evaluated) {
                evaluated = true;
                erros++;
                document.getElementById('erros-count').textContent = erros;
                showFeedback('TRAVE! 💥', 'trave');
                registerFalha();
                setTimeout(resetBall, 1400);
            }
        }
    }
}

// --- LOOP PRINCIPAL DE ANIMAÇÃO ---
function update() {
    const now = performance.now();

    if (currentMode === 'competitivo' && !isDiving) {
        keeperGroup.position.x += keeperSpeed * keeperDir;
        if (keeperGroup.position.x >= keeperMaxX) keeperDir = -1;
        if (keeperGroup.position.x <= keeperMinX) keeperDir = 1;
    }

    updateKeeperAnimation(now);

    if (isShooting) {
        ballVel.x *= 0.993;
        ballVel.y *= 0.996;
        ballVel.z *= 0.996;

        ballVel.x += windX;

        ball.position.x += ballVel.x;
        ball.position.y += ballVel.y;
        ball.position.z += ballVel.z;

        ball.rotation.x -= 0.12;
        ball.rotation.y += ballVel.x * 0.3;

        if (ball.position.y > ballRadius) {
            ballVel.y -= gravity;
        } else {
            ball.position.y = ballRadius;
            // campo molhado: quica menos e escorrega mais (menos perda de velocidade lateral)
            ballVel.y = -ballVel.y * (isRaining ? 0.32 : 0.4);
            ballVel.x *= (isRaining ? 0.88 : 0.7);
            ballVel.z *= (isRaining ? 0.88 : 0.7);
        }

        if (checkKeeperCollision() && !evaluated) {
            evaluated = true;
            erros++;
            document.getElementById('erros-count').textContent = erros;
            showFeedback('DEFESA! 🧤', 'defesa');
            registerFalha();
            setTimeout(resetBall, 1400);
        }

        checkPostCollision();

        if (ball.position.z <= goalZ && !evaluated && !hitPost) {
            evaluated = true;

            const insideX = Math.abs(ball.position.x) <= (goalWidth / 2 - 0.15);
            const insideY = ball.position.y <= goalHeight && ball.position.y >= ballRadius;

            if (insideX && insideY) {
                gols++;
                document.getElementById('gols-count').textContent = gols;
                showFeedback('GOL!', 'gol');
                registerGol();
                if (currentMode === 'competitivo') playGolSound();
            } else {
                erros++;
                document.getElementById('erros-count').textContent = erros;
                showFeedback('ERROU!', 'erro');
                registerFalha();
            }

            setTimeout(resetBall, 1200);
        }

        if (ball.position.z < -16 || Math.abs(ball.position.x) > 8) {
            isShooting = false;
        }
    }

    updateRain();

    renderer.render(scene, camera);
    requestAnimationFrame(update);
}

function showFeedback(text, type) {
    const fb = document.getElementById('feedback');
    fb.textContent = text;
    fb.className = `show ${type}`;
    setTimeout(() => fb.className = '', 1100);
}

function resetBall() {
    ball.position.set(0, ballRadius, ballZStart);
    ball.rotation.set(0, 0, 0);
    ballVel = { x: 0, y: 0, z: 0 };
    isShooting = false;
    evaluated = false;
    hitPost = false;
    canShoot = true;
    resetKeeperPose();
    setRandomWind();
}

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

update();