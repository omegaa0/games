import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const INITIAL_MONEY = 10000000;
const PORT = process.env.PORT || 3001;

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, 'dist')));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                players: [],
                boardState: {},
                currentTurn: 0,
                gameStarted: false
            });
        }

        const room = rooms.get(roomId);

        if (room.players.length < 6 && !room.gameStarted) {
            const newPlayer = {
                id: socket.id,
                name: playerName,
                position: 0,
                money: 1500,
                properties: [],
                color: getPlayerColor(room.players.length)
            };
            room.players.push(newPlayer);
            io.to(roomId).emit('roomUpdate', room);
        } else {
            socket.emit('error', 'Room is full or game already started');
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.players.length >= 2) {
            room.gameStarted = true;
            io.to(roomId).emit('gameStarted', room);
        }
    });

    socket.on('makeMove', ({ roomId, action }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        // Handle game logic updates here
        // For simplicity, we'll let the client calculate and send the new state
        // But in a real app, logic should be on the server.
        // For this demo, we'll broadcast the action.
        io.to(roomId).emit('gameStateUpdate', action);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle player removal if needed
    });
});

function getPlayerColor(index) {
    const colors = ['#f87171', '#60a5fa', '#4ade80', '#fbbf24', '#a78bfa', '#f472b6'];
    return colors[index % colors.length];
}

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
