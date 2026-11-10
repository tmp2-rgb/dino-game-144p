// Chrome Dino Runner Clone
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const hiScoreDisplay = document.getElementById('hiScore');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartBtn = document.getElementById('restartBtn');

// Audio Context for Retro Sound FX & Custom Sound Effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

// Support custom audio file if provided (e.g., lal.mp3 or lal.wav)
const lalAudio = new Audio('lal.mp3');
let hasLalAudio = true;
lalAudio.addEventListener('error', () => {
  hasLalAudio = false;
});

// Monkey Audio sound effect (custom audio monkey.mp3 or monkey screech synth)
const monkeyAudio = new Audio('monkey.mp3');
let hasMonkeyAudio = true;
monkeyAudio.addEventListener('error', () => {
  hasMonkeyAudio = false;
});

function playMonkeySound() {
  if (hasMonkeyAudio) {
    try {
      monkeyAudio.currentTime = 0;
      const playPromise = monkeyAudio.play();
      if (playPromise) {
        playPromise.catch(() => playSyntheticMonkeySound());
        return;
      }
    } catch (e) {
      // Fallback below
    }
  }
  playSyntheticMonkeySound();
}

// Fun synthetic "Oo-oo aa-aa!" monkey screech effect
function playSyntheticMonkeySound() {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    const now = audioCtx.currentTime;

    // Screech burst 1 (oo-oo)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(540, now);
    osc1.frequency.exponentialRampToValueAtTime(1180, now + 0.08);
    osc1.frequency.exponentialRampToValueAtTime(450, now + 0.16);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Screech burst 2 (aa-aa)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(680, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1450, now + 0.22);
    osc2.frequency.exponentialRampToValueAtTime(750, now + 0.32);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.32);
  } catch (e) {
    // Audio context may require user click/key first
  }
}

function playLalSound() {
  if (hasLalAudio) {
    try {
      lalAudio.currentTime = 0;
      lalAudio.play().catch(() => playSyntheticLalSound());
      return;
    } catch (e) {
      // Fallback to synthesized sound
    }
  }
  playSyntheticLalSound();
}

function playSyntheticLalSound() {
  // Speech synthesis fallback saying "Lal"
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Lal');
    utterance.pitch = 0.9;
    utterance.rate = 1.3;
    window.speechSynthesis.speak(utterance);
  }
  // Audio chime tone complement
  playSound(350, 0.1, 'sine');
  setTimeout(() => playSound(440, 0.15, 'triangle'), 60);
}

function playSound(freq, duration, type = 'square') {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context may require prior user interaction
  }
}

function playJumpSound() {
  playMonkeySound();
}

function playScoreSound() {
  playSound(850, 0.15, 'triangle');
  playLalSound();
}

function playDeathSound() {
  playMonkeySound();
  playSound(160, 0.35, 'sawtooth');
  setTimeout(() => playLalSound(), 180);
}

// Game Dimensions
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 250;
const GROUND_Y = 210;

// Game State
let isPlaying = false;
let isGameOver = false;
let score = 0;
let hiScore = localStorage.getItem('dino_hi_score') ? parseInt(localStorage.getItem('dino_hi_score'), 10) : 0;
let speed = 6;
const INITIAL_SPEED = 6;
const MAX_SPEED = 14;
let frameCount = 0;
let nightMode = false;

// Update UI High Score
function updateHiScoreText() {
  hiScoreDisplay.textContent = 'HI ' + String(hiScore).padStart(5, '0');
}
updateHiScoreText();

// Dinosaur Object
const dino = {
  x: 50,
  y: GROUND_Y - 45,
  width: 44,
  height: 45,
  velocityY: 0,
  gravity: 0.7,
  jumpStrength: -12.5,
  isGrounded: true,
  isDucking: false,
  legToggle: false,

  reset() {
    this.x = 50;
    this.y = GROUND_Y - 45;
    this.width = 44;
    this.height = 45;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isDucking = false;
  },

  jump() {
    if (this.isGrounded && !this.isDucking) {
      this.velocityY = this.jumpStrength;
      this.isGrounded = false;
      playJumpSound();
    }
  },

  duck(state) {
    if (this.isGrounded) {
      this.isDucking = state;
      if (state) {
        this.height = 28;
        this.width = 56;
        this.y = GROUND_Y - 28;
      } else {
        this.height = 45;
        this.width = 44;
        this.y = GROUND_Y - 45;
      }
    }
  },

  update() {
    if (!this.isGrounded) {
      this.velocityY += this.gravity;
      this.y += this.velocityY;

      const baseHeight = this.isDucking ? 28 : 45;
      if (this.y >= GROUND_Y - baseHeight) {
        this.y = GROUND_Y - baseHeight;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }

    if (frameCount % 6 === 0) {
      this.legToggle = !this.legToggle;
    }
  },

  draw() {
    // Vibrant Character: Monkey Runner
    const furColor = nightMode ? '#f4a261' : '#8d4925';
    const faceColor = nightMode ? '#ffe8d6' : '#ffd199';
    const earInner = nightMode ? '#ffb4a2' : '#f4a261';

    if (this.isDucking) {
      // Ducking Monkey pose
      // Body (brown fur)
      ctx.fillStyle = furColor;
      ctx.fillRect(this.x + 4, this.y + 12, 44, 16);
      
      // Curly monkey tail
      ctx.fillRect(this.x, this.y + 8, 4, 8);
      ctx.fillRect(this.x - 4, this.y + 4, 4, 6);
      ctx.fillRect(this.x, this.y + 2, 4, 3);

      // Low head & ear
      ctx.fillRect(this.x + 36, this.y + 4, 18, 16);
      ctx.fillStyle = faceColor;
      ctx.fillRect(this.x + 44, this.y + 8, 12, 10); // muzzle
      
      // Eye
      ctx.fillStyle = '#111';
      ctx.fillRect(this.x + 46, this.y + 8, 3, 3);
      
      // Ear
      ctx.fillStyle = earInner;
      ctx.fillRect(this.x + 34, this.y + 6, 4, 6);

      // Limbs / hands sprinting forward
      ctx.fillStyle = furColor;
      if (this.legToggle) {
        ctx.fillRect(this.x + 12, this.y + 26, 8, 4);
        ctx.fillRect(this.x + 36, this.y + 26, 8, 4);
      } else {
        ctx.fillRect(this.x + 20, this.y + 26, 8, 4);
        ctx.fillRect(this.x + 44, this.y + 26, 8, 4);
      }
    } else {
      // Normal Monkey Runner
      // Curly animated tail
      ctx.fillStyle = furColor;
      ctx.fillRect(this.x, this.y + 16, 6, 6);
      ctx.fillRect(this.x - 4, this.y + 8, 5, 10);
      ctx.fillRect(this.x, this.y + 4, 7, 5);

      // Body (warm furry monkey)
      ctx.fillStyle = furColor;
      ctx.fillRect(this.x + 8, this.y + 14, 24, 20);

      // Peach/tan belly
      ctx.fillStyle = faceColor;
      ctx.fillRect(this.x + 14, this.y + 17, 12, 14);

      // Head
      ctx.fillStyle = furColor;
      ctx.fillRect(this.x + 18, this.y + 2, 22, 16);

      // Cute Big Ears
      ctx.fillStyle = furColor;
      ctx.fillRect(this.x + 14, this.y + 4, 5, 8);
      ctx.fillStyle = earInner;
      ctx.fillRect(this.x + 15, this.y + 5, 3, 6);

      // Monkey Muzzle & Face
      ctx.fillStyle = faceColor;
      ctx.fillRect(this.x + 26, this.y + 6, 16, 12);

      // Big expressive eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 28, this.y + 5, 6, 6);
      ctx.fillStyle = '#111111';
      ctx.fillRect(this.x + 31, this.y + 6, 3, 4); // Pupil

      // Cute nose & smile
      ctx.fillStyle = '#b05a2b';
      ctx.fillRect(this.x + 37, this.y + 10, 3, 2);
      ctx.fillStyle = '#d62828';
      ctx.fillRect(this.x + 35, this.y + 14, 4, 2); // mouth

      // Arms (running or jumping)
      ctx.fillStyle = furColor;
      if (!this.isGrounded) {
        // Joyful arms up when jumping
        ctx.fillRect(this.x + 24, this.y + 8, 14, 5);
        ctx.fillRect(this.x + 36, this.y + 3, 5, 6);
      } else {
        ctx.fillRect(this.x + 24, this.y + 20, 10, 5);
      }

      // Animated Running Legs
      ctx.fillStyle = furColor;
      if (!this.isGrounded) {
        ctx.fillRect(this.x + 10, this.y + 34, 7, 10);
        ctx.fillRect(this.x + 24, this.y + 34, 7, 10);
      } else if (this.legToggle) {
        ctx.fillRect(this.x + 10, this.y + 34, 7, 11);
        ctx.fillRect(this.x + 25, this.y + 34, 7, 6);
      } else {
        ctx.fillRect(this.x + 10, this.y + 34, 7, 6);
        ctx.fillRect(this.x + 25, this.y + 34, 7, 11);
      }
    }
  }
};

// Ground bump lines
let groundBumps = [];
function initGround() {
  groundBumps = [];
  for (let i = 0; i < 40; i++) {
    groundBumps.push({
      x: Math.random() * CANVAS_WIDTH,
      w: Math.random() * 8 + 2
    });
  }
}
initGround();

function updateAndDrawGround() {
  ctx.fillStyle = nightMode ? '#4cc9f0' : '#2b9348';
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 4);

  // Grass / stone dots
  ctx.fillStyle = nightMode ? '#7209b7' : '#55a630';
  for (let bump of groundBumps) {
    bump.x -= speed;
    if (bump.x + bump.w < 0) {
      bump.x = CANVAS_WIDTH + Math.random() * 40;
    }
    ctx.fillRect(bump.x, GROUND_Y + 4, bump.w, 2);
    if (bump.w > 5) {
      ctx.fillRect(bump.x + 8, GROUND_Y + 8, bump.w - 3, 2);
    }
  }
}

// Clouds
let clouds = [
  { x: 200, y: 50, speed: 0.8 },
  { x: 550, y: 80, speed: 0.6 },
  { x: 750, y: 35, speed: 0.9 }
];

function updateAndDrawClouds() {
  ctx.fillStyle = nightMode ? 'rgba(114, 9, 183, 0.45)' : 'rgba(255, 255, 255, 0.85)';
  for (let c of clouds) {
    c.x -= c.speed;
    if (c.x < -80) {
      c.x = CANVAS_WIDTH + Math.random() * 80;
      c.y = 30 + Math.random() * 70;
    }
    // Pixelated cloud shape
    ctx.fillRect(c.x + 10, c.y, 30, 10);
    ctx.fillRect(c.x, c.y + 8, 50, 10);
    ctx.fillRect(c.x + 15, c.y - 6, 20, 8);
  }
}

// Obstacles (Cactus & Pterodactyl Birds)
let obstacles = [];
let spawnTimer = 0;
let nextSpawnInterval = 85;

class Cactus {
  constructor(type = 1) {
    this.type = type;
    this.x = CANVAS_WIDTH + 20;
    if (type === 1) {
      // Small cactus
      this.width = 16;
      this.height = 36;
    } else if (type === 2) {
      // Triple small cacti
      this.width = 40;
      this.height = 36;
    } else {
      // Big cactus
      this.width = 24;
      this.height = 48;
    }
    this.y = GROUND_Y - this.height;
  }

  update() {
    this.x -= speed;
  }

  draw() {
    ctx.fillStyle = nightMode ? '#00f5d4' : '#058c42';
    const flowerColor = nightMode ? '#f72585' : '#ff007f';

    if (this.type === 1) {
      // Main trunk
      ctx.fillRect(this.x + 5, this.y, 6, this.height);
      // Blossom topper
      ctx.fillStyle = flowerColor;
      ctx.fillRect(this.x + 6, this.y - 4, 4, 4);
      ctx.fillStyle = nightMode ? '#00f5d4' : '#058c42';
      // Left arm
      ctx.fillRect(this.x, this.y + 10, 5, 4);
      ctx.fillRect(this.x, this.y + 4, 4, 8);
      // Right arm
      ctx.fillRect(this.x + 11, this.y + 14, 5, 4);
      ctx.fillRect(this.x + 12, this.y + 8, 4, 8);
    } else if (this.type === 2) {
      // Group of cacti with blossoms
      for (let offset of [0, 14, 27]) {
        ctx.fillStyle = nightMode ? '#00f5d4' : '#058c42';
        ctx.fillRect(this.x + offset + 3, this.y, 5, this.height);
        ctx.fillRect(this.x + offset, this.y + 10, 4, 4);
        ctx.fillRect(this.x + offset + 7, this.y + 12, 4, 4);
        ctx.fillStyle = flowerColor;
        ctx.fillRect(this.x + offset + 4, this.y - 3, 3, 3);
      }
    } else {
      // Big tall cactus with flower
      ctx.fillRect(this.x + 8, this.y, 8, this.height);
      ctx.fillStyle = flowerColor;
      ctx.fillRect(this.x + 9, this.y - 5, 6, 5);
      ctx.fillStyle = nightMode ? '#00f5d4' : '#058c42';
      // Left branch
      ctx.fillRect(this.x, this.y + 14, 8, 6);
      ctx.fillRect(this.x, this.y + 6, 6, 12);
      // Right branch
      ctx.fillRect(this.x + 16, this.y + 18, 8, 6);
      ctx.fillRect(this.x + 18, this.y + 8, 6, 14);
    }
  }
}

class Bird {
  constructor() {
    this.x = CANVAS_WIDTH + 20;
    this.width = 40;
    this.height = 28;
    // 3 possible heights: jump over, duck under, or run under
    const altitudes = [GROUND_Y - 32, GROUND_Y - 55, GROUND_Y - 78];
    this.y = altitudes[Math.floor(Math.random() * altitudes.length)];
    this.wingUp = false;
  }

  update() {
    this.x -= speed * 1.15;
    if (frameCount % 12 === 0) {
      this.wingUp = !this.wingUp;
    }
  }

  draw() {
    // Vibrant tropical parrot / bird
    const featherColor = nightMode ? '#ff007f' : '#ff5400';
    const wingColor = nightMode ? '#4cc9f0' : '#ffd166';
    const beakColor = '#ffbe0b';

    ctx.fillStyle = featherColor;
    // Body & head
    ctx.fillRect(this.x + 12, this.y + 10, 18, 8);
    ctx.fillStyle = beakColor;
    ctx.fillRect(this.x + 30, this.y + 6, 10, 6); // beak
    ctx.fillStyle = '#111';
    ctx.fillRect(this.x + 24, this.y + 8, 3, 3);  // eye
    ctx.fillStyle = featherColor;
    ctx.fillRect(this.x + 4, this.y + 12, 8, 4);  // tail

    // Wings
    ctx.fillStyle = wingColor;
    if (this.wingUp) {
      ctx.fillRect(this.x + 14, this.y - 4, 8, 14);
    } else {
      ctx.fillRect(this.x + 14, this.y + 14, 8, 14);
    }
  }
}

function spawnObstacle() {
  spawnTimer++;
  if (spawnTimer >= nextSpawnInterval) {
    spawnTimer = 0;
    // Bird appears only after score reaches 200
    const allowBirds = score > 200;
    if (allowBirds && Math.random() < 0.35) {
      obstacles.push(new Bird());
    } else {
      const type = Math.floor(Math.random() * 3) + 1;
      obstacles.push(new Cactus(type));
    }
    // Randomize next spawn interval based on current speed
    nextSpawnInterval = Math.floor(Math.random() * 45) + Math.max(55, Math.floor(110 - speed * 4));
  }
}

function checkCollision(r1, r2) {
  // Padding for more forgiving hitbox
  const padX = 5;
  const padY = 5;
  return (
    r1.x + padX < r2.x + r2.width - padX &&
    r1.x + r1.width - padX > r2.x + padX &&
    r1.y + padY < r2.y + r2.height - padY &&
    r1.y + r1.height - padY > r2.y + padY
  );
}

function triggerGameOver() {
  isGameOver = true;
  isPlaying = false;
  playDeathSound();

  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('dino_hi_score', hiScore);
    updateHiScoreText();
  }

  gameOverScreen.style.display = 'block';
}

function restartGame() {
  score = 0;
  speed = INITIAL_SPEED;
  obstacles = [];
  spawnTimer = 0;
  frameCount = 0;
  isGameOver = false;
  isPlaying = true;
  nightMode = false;
  document.body.classList.remove('night-mode');

  dino.reset();
  initGround();
  gameOverScreen.style.display = 'none';
  scoreDisplay.textContent = '00000';
  requestAnimationFrame(gameLoop);
}

// User Input Handling
const keys = {};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (isGameOver) {
      restartGame();
    } else if (!isPlaying) {
      isPlaying = true;
      requestAnimationFrame(gameLoop);
    } else {
      dino.jump();
    }
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (isPlaying && !isGameOver) {
      dino.duck(true);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    dino.duck(false);
  }
});

// Canvas touch / click support for mobile and quick play
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (isGameOver) {
    restartGame();
  } else if (!isPlaying) {
    isPlaying = true;
    requestAnimationFrame(gameLoop);
  } else {
    dino.jump();
  }
});

restartBtn.addEventListener('click', () => {
  restartGame();
});

// Main Loop
function gameLoop() {
  frameCount++;

  // Clear canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Update Score & Speed
  if (frameCount % 4 === 0) {
    score++;
    scoreDisplay.textContent = String(score).padStart(5, '0');

    // Milestones beep every 100 points
    if (score % 100 === 0) {
      playScoreSound();
    }

    // Toggle day/night every 500 points
    const shouldBeNight = Math.floor(score / 500) % 2 === 1;
    if (shouldBeNight !== nightMode) {
      nightMode = shouldBeNight;
      if (nightMode) {
        document.body.classList.add('night-mode');
      } else {
        document.body.classList.remove('night-mode');
      }
    }

    // Gradually ramp up speed
    if (speed < MAX_SPEED && score % 100 === 0) {
      speed += 0.4;
    }
  }

  // Draw background elements
  updateAndDrawClouds();
  updateAndDrawGround();

  // Update & Draw Dino
  dino.update();
  dino.draw();

  // Obstacles
  spawnObstacle();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.update();
    obs.draw();

    // Collision check
    if (checkCollision(dino, obs)) {
      triggerGameOver();
      // Draw death frame
      dino.draw();
      return;
    }

    // Remove off-screen obstacles
    if (obs.x + obs.width < -10) {
      obstacles.splice(i, 1);
    }
  }

  if (isPlaying && !isGameOver) {
    requestAnimationFrame(gameLoop);
  }
}

// Initial screen render
function renderIntro() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  updateAndDrawClouds();
  updateAndDrawGround();
  dino.draw();

  // Prompt to start
  ctx.fillStyle = '#ff0055';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Press SPACE or UP Arrow to Run (Monkey Mode 🐵)', CANVAS_WIDTH / 2, 120);
  ctx.textAlign = 'start';
}

renderIntro();

