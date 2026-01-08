import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, Home, User, DollarSign, Trophy, ShoppingCart, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES } from './data/boardData';
import './index.css';

const socket = io();

const App = () => {
    const [gameState, setGameState] = useState('lobby'); // lobby, game, end
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('turkiye-1');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Hoş geldiniz! Oyuna katılın.');

    useEffect(() => {
        socket.on('roomUpdate', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        socket.on('gameStarted', (updatedRoom) => {
            setRoom(updatedRoom);
            setGameState('game');
        });

        socket.on('gameStateUpdate', (action) => {
            // Handle the action to update local state
            handleAction(action);
        });

        return () => {
            socket.off('roomUpdate');
            socket.off('gameStarted');
            socket.off('gameStateUpdate');
        };
    }, [room]);

    const joinRoom = () => {
        if (playerName.trim()) {
            socket.emit('joinRoom', { roomId, playerName });
            setGameState('waiting');
        }
    };

    const startGame = () => {
        socket.emit('startGame', roomId);
    };

    const rollDice = () => {
        if (room.players[room.currentTurn].id !== socket.id) return;
        if (diceRolling) return;

        setDiceRolling(true);
        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            setLastDice([d1, d2]);
            setDiceRolling(false);

            const total = d1 + d2;
            const player = room.players[room.currentTurn];
            const newPos = (player.position + total) % 40;

            const action = {
                type: 'MOVE_PLAYER',
                playerId: player.id,
                newPosition: newPos,
                passedStart: newPos < player.position
            };

            socket.emit('makeMove', { roomId, action });
        }, 1000);
    };

    const handleAction = (action) => {
        setRoom(prevRoom => {
            const newRoom = { ...prevRoom };
            const playerIndex = newRoom.players.findIndex(p => p.id === action.playerId);
            const player = newRoom.players[playerIndex];

            if (action.type === 'MOVE_PLAYER') {
                player.position = action.newPosition;
                if (action.passedStart) {
                    player.money += 200;
                    setMessage(`${player.name} başlangıçtan geçti ve 200₺ aldı!`);
                }

                // Handle tile landing logic
                const tile = BOARD_TILES[action.newPosition];
                handleTileLanding(player, tile, newRoom);
            }

            if (action.type === 'BUY_PROPERTY') {
                const tile = BOARD_TILES[player.position];
                player.money -= tile.price;
                player.properties.push(tile.id);
                tile.owner = player.id;
                setMessage(`${player.name}, ${tile.name} mülkünü satın aldı!`);
            }

            if (action.type === 'END_TURN') {
                newRoom.currentTurn = (newRoom.currentTurn + 1) % newRoom.players.length;
            }

            return { ...newRoom };
        });
    };

    const handleTileLanding = (player, tile, roomState) => {
        if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
            if (!tile.owner) {
                setMessage(`${tile.name} boşta! Satın almak ister misin? (Fiyat: ${tile.price}₺)`);
            } else if (tile.owner !== player.id) {
                const owner = roomState.players.find(p => p.id === tile.owner);
                const rent = tile.rent || 20; // Simplified rent logic
                player.money -= rent;
                owner.money += rent;
                setMessage(`${player.name}, ${owner.name} kullanıcısına ${rent}₺ kira ödedi!`);
            }
        } else if (tile.type === 'tax') {
            player.money -= tile.price;
            setMessage(`${player.name} ${tile.price}₺ vergi ödedi!`);
        } else if (tile.type === 'gotojail') {
            player.position = 10;
            setMessage(`${player.name} hapse girdi!`);
        }
    };

    const buyProperty = () => {
        const player = room.players[room.currentTurn];
        const tile = BOARD_TILES[player.position];
        if (player.id === socket.id && (tile.type === 'property' || tile.type === 'station') && !tile.owner && player.money >= tile.price) {
            socket.emit('makeMove', { roomId, action: { type: 'BUY_PROPERTY', playerId: player.id } });
        }
    };

    const endTurn = () => {
        if (room.players[room.currentTurn].id === socket.id) {
            socket.emit('makeMove', { roomId, action: { type: 'END_TURN', playerId: socket.id } });
        }
    };

    if (gameState === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-12 w-full max-w-md text-center"
                >
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-indigo-500 rounded-2xl shadow-lg">
                            <Dice5 size={48} className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Emlak Kralı TR
                    </h1>
                    <p className="text-slate-400 mb-8">Türkiye turuna hazır mısın?</p>

                    <input
                        type="text"
                        placeholder="Adın ne?"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    />

                    <button
                        onClick={joinRoom}
                        className="btn-primary w-full text-lg"
                    >
                        Odaya Katıl
                    </button>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center min-vh-100">
                <div className="glass p-8 w-full max-w-md text-center">
                    <h2 className="text-2xl font-bold mb-6">Bekleme Odası</h2>
                    <div className="space-y-3 mb-8">
                        {room?.players.map((p, i) => (
                            <motion.div
                                key={i}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                            >
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="font-medium">{p.name} {p.id === socket.id && "(Sen)"}</span>
                            </motion.div>
                        ))}
                    </div>
                    {room?.players.length >= 2 && room.players[0].id === socket.id ? (
                        <button onClick={startGame} className="btn-primary w-full">Oyunu Başlat</button>
                    ) : (
                        <p className="text-slate-400 animate-pulse">Diğer oyuncular bekleniyor (Min 2 kişi)...</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="game-container">
            {/* Sidebar: Players Info & Log */}
            <div className="flex flex-col gap-4 w-96 h-[750px]">
                <div className="glass p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <User size={20} className="text-indigo-400" /> Oyuncular
                    </h3>
                    <div className="space-y-3">
                        {room?.players.map((p, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-4 rounded-2xl transition-all border ${room.currentTurn === i ? 'bg-indigo-500/20 border-indigo-500/50 ring-2 ring-indigo-500/20' : 'bg-white/5 border-transparent'}`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg shadow-black/20" style={{ backgroundColor: p.color }} />
                                        <span className={room.currentTurn === i ? 'text-white' : 'text-slate-400'}>{p.name} {p.id === socket.id && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded ml-1">SEN</span>}</span>
                                    </span>
                                    <span className="text-emerald-400 font-mono font-bold">{p.money}₺</span>
                                </div>
                                {room.currentTurn === i && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">SIRA SENDE</p>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="glass p-6 flex-1 flex flex-col overflow-hidden">
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <DollarSign size={20} className="text-emerald-400" /> Oyun Kaydı
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        <div className="text-sm text-slate-300 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 min-h-[100px] font-medium italic">
                            ✨ {message}
                        </div>
                    </div>
                </div>
            </div>
            {/* Main Board */}
            <div className="relative">
                <div className="board bg-[#e2e8f0]">
                    {BOARD_TILES.map((tile, i) => {
                        // Determine grid position for a 11x11 board
                        let row, col;
                        if (i <= 10) { row = 11; col = 11 - i; }
                        else if (i <= 20) { row = 21 - i; col = 1; }
                        else if (i <= 30) { row = 1; col = i - 19; }
                        else { row = i - 29; col = 11; }

                        return (
                            <div
                                key={i}
                                className="tile"
                                style={{ gridRow: row, gridColumn: col }}
                            >
                                {tile.color && <div className="tile-header" style={{ backgroundColor: tile.color }} />}
                                <div className="tile-content">
                                    <span className="title">{tile.name}</span>
                                    {tile.price && <span className="price">{tile.price}₺</span>}
                                    {tile.owner && <div className="mt-1 w-2 h-2 rounded-full mx-auto" style={{ backgroundColor: room.players.find(p => p.id === tile.owner)?.color }} />}
                                </div>

                                {/* Tokens */}
                                <div className="flex flex-wrap gap-1 justify-center absolute bottom-1 w-full">
                                    {room?.players.filter(p => p.position === i).map((p, pi) => (
                                        <motion.div
                                            key={pi}
                                            layoutId={p.id}
                                            className="player-token"
                                            style={{ backgroundColor: p.color }}
                                            animate={{ scale: [1, 1.2, 1] }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Center piece */}
                    <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center bg-slate-100 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-5 pointer-events-none">
                            <Trophy size={400} />
                        </div>

                        <h2 className="text-5xl font-black text-slate-800 rotate-[-45deg] opacity-20 mb-8">EMLAK KRALI</h2>

                        <div className="flex gap-4 items-center mb-8">
                            <motion.div
                                animate={diceRolling ? { rotate: 360 } : {}}
                                transition={{ repeat: Infinity, duration: 0.2 }}
                                className="bg-white p-4 rounded-2xl shadow-xl text-4xl font-bold text-slate-800 border-2 border-slate-200"
                            >
                                {lastDice[0]}
                            </motion.div>
                            <motion.div
                                animate={diceRolling ? { rotate: -360 } : {}}
                                transition={{ repeat: Infinity, duration: 0.2 }}
                                className="bg-white p-4 rounded-2xl shadow-xl text-4xl font-bold text-slate-800 border-2 border-slate-200"
                            >
                                {lastDice[1]}
                            </motion.div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={rollDice}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id || diceRolling}
                                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Dice5 size={20} /> Zar At
                            </button>

                            <button
                                onClick={buyProperty}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                <ShoppingCart size={20} /> Satın Al
                            </button>

                            <button
                                onClick={endTurn}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                <LogOut size={20} /> Turu Bitir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
