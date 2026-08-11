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

// --- BOLA ---
const ballRadius = 0.35;
const ballZStart = 2.0; 
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.05
});
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.position.set(0, ballRadius, ballZStart);
ball.castShadow = true;
scene.add(ball);

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

const bodyGeo = new THREE.CylinderGeometry(0.25, 0.2, 1.1, 16);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
const keeperBody = new THREE.Mesh(bodyGeo, bodyMat);
keeperBody.position.y = 0.85;
keeperBody.castShadow = true;
keeperGroup.add(keeperBody);

const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
const headMat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB });
const keeperHead = new THREE.Mesh(headGeo, headMat);
keeperHead.position.y = 1.55;
keeperHead.castShadow = true;
keeperGroup.add(keeperHead);

const gloveGeo = new THREE.SphereGeometry(0.12, 12, 12);
const gloveMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
leftGlove.position.set(-0.35, 1.0, 0);
keeperGroup.add(leftGlove);

const rightGlove = new THREE.Mesh(gloveGeo, gloveMat);
rightGlove.position.set(0.35, 1.0, 0);
keeperGroup.add(rightGlove);

keeperGroup.position.set(0, 0, goalZ + 0.3);
keeperGroup.visible = false;
scene.add(keeperGroup);

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
const keeperSpeed = 0.045;
const keeperMinX = -1.5;
const keeperMaxX = 1.5;

let startX = 0, startY = 0;

function setRandomWind() {
    const windKm = Math.floor((Math.random() - 0.5) * 40);
    windX = windKm * 0.00007;

    const windEl = document.getElementById('wind-count');
    if (windKm > 0) {
        windEl.textContent = `➔ ${windKm} km/h`;
    } else if (windKm < 0) {
        windEl.textContent = `⬅ ${Math.abs(windKm)} km/h`;
    } else {
        windEl.textContent = `0 km/h`;
    }
}

// --- NAVEGAÇÃO DE TELAS ---
document.getElementById('play-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
});

function startGame(mode) {
    currentMode = mode;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'flex';
    
    keeperGroup.visible = (mode === 'competitivo');
    
    gols = 0;
    erros = 0;
    document.getElementById('gols-count').textContent = '0';
    document.getElementById('erros-count').textContent = '0';
    resetBall();
}

function showMenu() {
    canShoot = false;
    isShooting = false;
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('scoreboard').style.display = 'none';
    keeperGroup.visible = false;
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
    document.getElementById('gols-count').textContent = '0';
    document.getElementById('erros-count').textContent = '0';
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

    ballVel.z = - Math.min(Math.abs(deltaY) * 0.0035 + 0.22, 0.45);
    ballVel.x = deltaX * 0.0018;
    ballVel.y = Math.min(Math.abs(deltaY) * 0.002, 0.20);
}

// --- FÍSICA E COLISÕES ---
function checkKeeperCollision() {
    if (currentMode !== 'competitivo' || evaluated) return false;

    const dist = Math.hypot(
        ball.position.x - keeperGroup.position.x,
        ball.position.y - 1.0,
        ball.position.z - keeperGroup.position.z
    );

    if (dist < 0.75) {
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
            if (!evaluated) {
                evaluated = true;
                erros++;
                document.getElementById('erros-count').textContent = erros;
                showFeedback('TRAVE! 💥', 'trave');
                setTimeout(resetBall, 1400);
            }
        }
    }
}

// --- LOOP PRINCIPAL DE ANIMAÇÃO ---
function update() {
    if (currentMode === 'competitivo') {
        keeperGroup.position.x += keeperSpeed * keeperDir;
        if (keeperGroup.position.x >= keeperMaxX) keeperDir = -1;
        if (keeperGroup.position.x <= keeperMinX) keeperDir = 1;
    }

    if (isShooting) {
        ballVel.x *= 0.996;
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
            ballVel.y = -ballVel.y * 0.4;
            ballVel.x *= 0.7;
            ballVel.z *= 0.7;
        }

        if (checkKeeperCollision() && !evaluated) {
            evaluated = true;
            erros++;
            document.getElementById('erros-count').textContent = erros;
            showFeedback('DEFESA! 🧤', 'defesa');
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
            } else {
                erros++;
                document.getElementById('erros-count').textContent = erros;
                showFeedback('ERROU!', 'erro');
            }

            setTimeout(resetBall, 1200);
        }

        if (ball.position.z < -16 || Math.abs(ball.position.x) > 8) {
            isShooting = false;
        }
    }

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
    setRandomWind();
}

window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

update();