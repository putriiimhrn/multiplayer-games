// Mendapatkan elemen kanvas dan konteks untuk rendering
const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

// Menghubungkan ke socket.io server
const socket = io();

// Mengambil elemen untuk menampilkan skor
const scoreEl = document.querySelector("#scoreEl");

// Mendapatkan rasio piksel perangkat untuk penyesuaian grafis
const devicePixelRatio = window.devicePixelRatio || 1;

// Menyesuaikan ukuran kanvas berdasarkan ukuran jendela dan rasio piksel
canvas.width = innerWidth * devicePixelRatio;
canvas.height = innerHeight * devicePixelRatio;

// Inisialisasi posisi tengah kanvas
const x = canvas.width / 2;
const y = canvas.height / 2;

// Objek untuk menyimpan data pemain dan proyektil di frontend
const frontEndPlayers = {};
const frontEndProjectiles = {};

// Event listener untuk pembaruan proyektil dari server
socket.on("updateProjectiles", (backEndProjectiles) => {
  for (const id in backEndProjectiles) {
    const backEndProjectile = backEndProjectiles[id];

    // Membuat proyektil baru atau memperbarui posisi proyektil yang ada
    if (!frontEndProjectiles[id]) {
      frontEndProjectiles[id] = new Projectile({
        x: backEndProjectile.x,
        y: backEndProjectile.y,
        radius: 5,
        color: frontEndPlayers[backEndProjectile.playerId]?.color,
        velocity: backEndProjectile.velocity,
      });
    } else {
      frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x;
      frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y;
    }
  }

  // Menghapus proyektil yang tidak ada lagi di server
  for (const frontEndProjectileId in frontEndProjectiles) {
    if (!backEndProjectiles[frontEndProjectileId]) {
      delete frontEndProjectiles[frontEndProjectileId];
    }
  }
});

// Event listener untuk pembaruan data pemain dari server
socket.on("updatePlayers", (backEndPlayers) => {
  for (const id in backEndPlayers) {
    const backEndPlayer = backEndPlayers[id];

    // Membuat pemain baru atau memperbarui data pemain yang ada
    if (!frontEndPlayers[id]) {
      frontEndPlayers[id] = new Player({
        x: backEndPlayer.x,
        y: backEndPlayer.y,
        radius: 10,
        color: backEndPlayer.color,
      });

      // Menambahkan label pemain ke dalam DOM
      document.querySelector(
        "#playerLabels"
      ).innerHTML += `<div data-id="${id}" data-score="${backEndPlayer.score}">${backEndPlayer.username}: ${backEndPlayer.score}</div>`;
    } else {
      // Memperbarui skor dan posisi pemain
      document.querySelector(
        `div[data-id="${id}"]`
      ).innerHTML = `${backEndPlayer.username}: ${backEndPlayer.score}`;

      document
        .querySelector(`div[data-id="${id}"]`)
        .setAttribute("data-score", backEndPlayer.score);

      // Mengurutkan label pemain berdasarkan skor
      const parentDiv = document.querySelector("#playerLabels");
      const childDivs = Array.from(parentDiv.querySelectorAll("div"));

      childDivs.sort((a, b) => {
        const scoreA = Number(a.getAttribute("data-score"));
        const scoreB = Number(b.getAttribute("data-score"));

        return scoreB - scoreA;
      });

      // Menghapus dan menambahkan kembali elemen yang sudah diurutkan
      childDivs.forEach((div) => {
        parentDiv.removeChild(div);
      });
      childDivs.forEach((div) => {
        parentDiv.appendChild(div);
      });

      if (id === socket.id) {
        // Memperbarui posisi pemain berdasarkan input lokal
        frontEndPlayers[id].x = backEndPlayer.x;
        frontEndPlayers[id].y = backEndPlayer.y;

        const lastBackendInputIndex = playerInputs.findIndex((input) => {
          return backEndPlayer.sequenceNumber === input.sequenceNumber;
        });

        if (lastBackendInputIndex > -1)
          playerInputs.splice(0, lastBackendInputIndex + 1);

        playerInputs.forEach((input) => {
          frontEndPlayers[id].x += input.dx;
          frontEndPlayers[id].y += input.dy;
        });
      } else {
        // Memperbarui posisi pemain lain dengan animasi
        gsap.to(frontEndPlayers[id], {
          x: backEndPlayer.x,
          y: backEndPlayer.y,
          duration: 0.015,
          ease: "linear",
        });
      }
    }
  }

  // Menghapus pemain yang tidak ada lagi di server
  for (const id in frontEndPlayers) {
    if (!backEndPlayers[id]) {
      const divToDelete = document.querySelector(`div[data-id="${id}"]`);
      divToDelete.parentNode.removeChild(divToDelete);

      if(id === socket.id) {
        document.querySelector("#usernameForm").style.display = "block";
      }

      delete frontEndPlayers[id];
    }
  }
});

// Fungsi untuk menganimasikan kanvas
let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);
  c.fillStyle = "rgba(0, 0, 0, 0.1)";
  c.fillRect(0, 0, canvas.width, canvas.height);

  // Menggambar pemain dan proyektil pada kanvas
  for (const id in frontEndPlayers) {
    const frontEndPlayer = frontEndPlayers[id];
    frontEndPlayer.draw();
  }

  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id];
    frontEndProjectile.draw();
  }
}

animate();

// Objek untuk menangani status tombol yang ditekan
const keys = {
  w: {
    pressed: false,
  },
  a: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
};

// Konstanta dan variabel untuk input pemain
const SPEED = 5;
const playerInputs = [];
let sequenceNumber = 0;

// Mengatur interval untuk pemrosesan input pemain
setInterval(() => {
  if (keys.w.pressed) {
    sequenceNumber++;
    playerInputs.push({ sequenceNumber, dx: 0, dy: -SPEED });
    frontEndPlayers[socket.id].y -= SPEED;
    socket.emit("keydown", { keycode: "KeyW", sequenceNumber });
  }
  if (keys.a.pressed) {
    sequenceNumber++;
    playerInputs.push({ sequenceNumber, dx: -SPEED, dy: 0 });
    frontEndPlayers[socket.id].x -= SPEED;
    socket.emit("keydown", { keycode: "KeyA", sequenceNumber });
  }
  if (keys.s.pressed) {
    sequenceNumber++;
    playerInputs.push({ sequenceNumber, dx: 0, dy: SPEED });
    frontEndPlayers[socket.id].y += SPEED;
    socket.emit("keydown", { keycode: "KeyS", sequenceNumber });
  }
  if (keys.d.pressed) {
    sequenceNumber++;
    playerInputs.push({ sequenceNumber, dx: SPEED, dy: 0 });
    frontEndPlayers[socket.id].x += SPEED;
    socket.emit("keydown", { keycode: "KeyD", sequenceNumber });
  }
}, 15);

// Event listener untuk menangani tekanan tombol
window.addEventListener("keydown", (event) => {
  if (!frontEndPlayers[socket.id]) return;
  switch (event.code) {
    case "KeyW":
      keys.w.pressed = true;
      break;
    case "KeyA":
      keys.a.pressed = true;
      break;
    case "KeyS":
      keys.s.pressed = true;
      break;
    case "KeyD":
      keys.d.pressed = true;
      break;
  }
});

// Event listener untuk menangani pelepasan tombol
window.addEventListener("keyup", (event) => {
  if (!frontEndPlayers[socket.id]) return;
  switch (event.code) {
    case "KeyW":
      keys.w.pressed = false;
      break;
    case "KeyA":
      keys.a.pressed = false;
      break;
    case "KeyS":
      keys.s.pressed = false;
      break;
    case "KeyD":
      keys.d.pressed = false;
      break;
  }
});

// Mengelola formulir untuk mengirimkan nama pengguna ke server
document.querySelector("#usernameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#usernameForm").style.display = "none";
  socket.emit("initGame", {
    width: canvas.width,
    height: canvas.height,
    devicePixelRatio,
    username: document.querySelector("#usernameInput").value,
  });
});
