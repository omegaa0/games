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

    // Send initial room list to connecting users
    socket.emit('roomListUpdate', Array.from(rooms.values()).filter(r => !r.gameStarted).map(r => ({
        id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, hostName: r.hostName
    })));

    socket.on('createRoom', ({ roomName, playerName, maxPlayers = 6 }) => {
        const roomId = 'room-' + Math.random().toString(36).substr(2, 6);
        const newPlayer = {
            id: socket.id,
            name: playerName,
            money: INITIAL_MONEY,
            position: 0,
            color: getPlayerColor(0),
            properties: [],
            bankrupt: false
        };

        const newRoom = {
            id: roomId,
            name: roomName || `Oda ${roomId.substr(5)}`,
            hostId: socket.id,
            hostName: playerName,
            players: [newPlayer],
            board: [],
            currentTurn: 0,
            gameStarted: false,
            maxPlayers: maxPlayers,
            buildings: {}
        };

        rooms.set(roomId, newRoom);
        socket.join(roomId);
        socket.emit('roomCreated', newRoom);

        io.emit('roomListUpdate', Array.from(rooms.values()).filter(r => !r.gameStarted).map(r => ({
            id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, hostName: r.hostName
        })));
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);

        if (room && !room.gameStarted && room.players.length < room.maxPlayers) {
            const newPlayer = {
                id: socket.id,
                name: playerName,
                money: INITIAL_MONEY,
                position: 0,
                color: getPlayerColor(room.players.length),
                properties: [],
                bankrupt: false
            };
            room.players.push(newPlayer);
            socket.join(roomId);

            io.to(roomId).emit('roomUpdate', room);
            io.emit('roomListUpdate', Array.from(rooms.values()).filter(r => !r.gameStarted).map(r => ({
                id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, hostName: r.hostName
            })));
        } else {
            socket.emit('error', 'Oda dolu veya oyun başlamış.');
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id && room.players.length >= 2) {
            room.gameStarted = true;
            io.to(roomId).emit('gameStarted', room);
            io.emit('roomListUpdate', Array.from(rooms.values()).filter(r => !r.gameStarted).map(r => ({
                id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, hostName: r.hostName
            })));
        }
    });

    socket.on('makeMove', ({ roomId, action }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        io.to(roomId).emit('gameStateUpdate', action);
    });

    socket.on('chatMessage', ({ roomId, message, playerId }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        const chatMsg = {
            playerName: player.name,
            playerColor: player.color,
            text: message,
            system: false
        };
        io.to(roomId).emit('chatUpdate', chatMsg);
    });

    socket.on('proposeTrade', ({ roomId, tradeData }) => {
        io.to(tradeData.toPlayerId).emit('tradeProposal', tradeData);
    });

    socket.on('respondTrade', ({ roomId, accepted, tradeData }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        if (accepted) {
            const sender = room.players.find(p => p.id === tradeData.fromPlayerId);
            const receiver = room.players.find(p => p.id === tradeData.toPlayerId);

            if (sender && receiver) {
                // Money Transfer
                sender.money -= parseInt(tradeData.offer.money || 0);
                receiver.money += parseInt(tradeData.offer.money || 0);

                receiver.money -= parseInt(tradeData.request.money || 0);
                sender.money += parseInt(tradeData.request.money || 0);

                // Property Transfer - Offer (Sender -> Receiver)
                if (tradeData.offer.properties) {
                    tradeData.offer.properties.forEach(propId => {
                        const idx = sender.properties.indexOf(propId);
                        if (idx > -1) {
                            sender.properties.splice(idx, 1);
                            receiver.properties.push(propId);
                        }
                    });
                }

                // Property Transfer - Request (Receiver -> Sender)
                if (tradeData.request.properties) {
                    tradeData.request.properties.forEach(propId => {
                        const idx = receiver.properties.indexOf(propId);
                        if (idx > -1) {
                            receiver.properties.splice(idx, 1);
                            sender.properties.push(propId);
                        }
                    });
                }

                io.to(roomId).emit('roomUpdate', room);
            }
        }

        io.to(tradeData.fromPlayerId).emit('tradeResult', { accepted, tradeData });
        io.to(tradeData.toPlayerId).emit('tradeResult', { accepted, tradeData });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [id, room] of rooms.entries()) {
            if (!room.gameStarted && room.players.length === 1 && room.players[0].id === socket.id) {
                rooms.delete(id);
                io.emit('roomListUpdate', Array.from(rooms.values()).filter(r => !r.gameStarted).map(r => ({
                    id: r.id, name: r.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, hostName: r.hostName
                })));
            }
        }
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
