// Mengimpor modul express untuk membuat server HTTP
const express = require("express");
const app = express();

// Pengaturan socket.io untuk komunikasi real-time
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });

// Port yang digunakan server
const port = 3000;

// Menyediakan file statis dari folder "public"
app.use(express.static("public"));

// Mengatur route '/' untuk mengirim file index.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Inisialisasi objek untuk menyimpan data pemain dan proyektil
const backEndPlayers = {};
const backEndProjectiles = {};

// Konstanta untuk kecepatan dan ukuran
const SPEED = 5;
const RADIUS = 10;
const PROJECTILE_RADIUS = 5;
let projectileId = 0;

// Event untuk menangani koneksi socket
io.on("connection", (socket) => {
  console.log("a user connected");

  // Mengirimkan data pemain saat ada pemain baru terhubung
  io.emit("updatePlayers", backEndPlayers);

  // Menangani event 'shoot' dari pemain
  socket.on("shoot", ({ x, y, angle }) => {
    projectileId++;

    // Menghitung kecepatan proyektil berdasarkan sudut
    const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5,
    };

    // Menambahkan proyektil ke dalam objek backEndProjectiles
    backEndProjectiles[projectileId] = {
      x,
      y,
      velocity,
      playerId: socket.id,
    };
  });

  // Menangani inisialisasi game oleh pemain
  socket.on("initGame", ({ username, width, height, devicePixelRatio }) => {
    // Menambahkan pemain ke dalam objek backEndPlayers
    backEndPlayers[socket.id] = {
      x: 500 * Math.random(),
      y: 500 * Math.random(),
      color: `hsl(${Math.random() * 360}, 80%, 50%)`,
      sequenceNumber: 0,
      score: 0,
      username,
    };

    // Menyimpan informasi kanvas pemain
    backEndPlayers[socket.id].canvas = {
      width,
      height,
    };

    // Menyesuaikan radius pemain berdasarkan devicePixelRatio
    backEndPlayers[socket.id].radius = RADIUS;
    if (devicePixelRatio > 1) {
      backEndPlayers[socket.id].radius = 2 * RADIUS;
    }
  });

  // Menangani pemutusan koneksi socket
  socket.on("disconnect", (reason) => {
    delete backEndPlayers[socket.id];
    io.emit("updatePlayers", backEndPlayers);
  });

  // Menangani event tekan tombol
  socket.on("keydown", ({ keycode, sequenceNumber }) => {
    backEndPlayers[socket.id].sequenceNumber = sequenceNumber;
    switch (keycode) {
      case "KeyW":
        backEndPlayers[socket.id].y -= SPEED;
        break;
      case "KeyA":
        backEndPlayers[socket.id].x -= SPEED;
        break;
      case "KeyS":
        backEndPlayers[socket.id].y += SPEED;
        break;
      case "KeyD":
        backEndPlayers[socket.id].x += SPEED;
        break;
    }
  });

  console.log(backEndPlayers);
});

// Fungsi untuk memperbarui posisi proyektil dan pemain secara berkala
setInterval(() => {
  // Memperbarui posisi proyektil
  for (const id in backEndProjectiles) {
    backEndProjectiles[id].x += backEndProjectiles[id].velocity.x;
    backEndProjectiles[id].y += backEndProjectiles[id].velocity.y;

    // Menangani proyektil yang keluar dari batas kanvas
    if (
      backEndProjectiles[id].x - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.width ||
      backEndProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id].playerId]?.canvas?.height ||
      backEndProjectiles[id].y + PROJECTILE_RADIUS <= 0
    ) {
      delete backEndProjectiles[id];
      continue;
    }

    // Menangani deteksi tabrakan antara proyektil dan pemain
    for (const playerId in backEndPlayers) {
      const backEndPlayer = backEndPlayers[playerId];

      const DISTANCE = Math.hypot(
        backEndProjectiles[id].x - backEndPlayer.x,
        backEndProjectiles[id].y - backEndPlayer.y
      );

      if (
        DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
        backEndProjectiles[id].playerId !== playerId
      ) {
        // Menambahkan skor jika terjadi tabrakan
        if (backEndPlayers[backEndProjectiles[id].playerId])
          backEndPlayers[backEndProjectiles[id].playerId].score++;

        delete backEndProjectiles[id];
        delete backEndPlayers[playerId];
        break;
      }
    }
  }

  // Mengirimkan pembaruan posisi proyektil dan pemain ke semua klien
  io.emit("updateProjectiles", backEndProjectiles);
  io.emit("updatePlayers", backEndPlayers);
}, 15);

// Mendengarkan koneksi pada port yang ditentukan
server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

console.log("server loaded");
