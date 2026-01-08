import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, Home, User, DollarSign, Trophy, ShoppingCart, LogOut, MessageSquare, Users, History, PlayCircle, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES } from './data/boardData';
import './index.css';

const socket = io();

const App = () => {
    const [gameState, setGameState] = useState('lobby'); // lobby, waiting, game, end
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('turkiye-1');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Emlak Kralı Türkiye d dünyasına hoş geldiniz!');

    useEffect(() => {
        socket.on('roomUpdate', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        socket.on('gameStarted', (updatedRoom) => {
            setRoom(updatedRoom);
            setGameState('game');
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        });

        socket.on('gameStateUpdate', (action) => {
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
            if (!prevRoom) return prevRoom;
            const newRoom = JSON.parse(JSON.stringify(prevRoom));
            const playerIndex = newRoom.players.findIndex(p => p.id === action.playerId);
            const player = newRoom.players[playerIndex];

            if (action.type === 'MOVE_PLAYER') {
                player.position = action.newPosition;
                if (action.passedStart) {
                    player.money += 200;
                    setMessage(`${player.name} başlangıçtan geçti +200₺`);
                }
                handleTileLanding(player, BOARD_TILES[action.newPosition], newRoom);
            }

            if (action.type === 'BUY_PROPERTY') {
                const tile = BOARD_TILES[player.position];
                player.money -= tile.price;
                player.properties.push(tile.id);
                // Update the property in all places or just rely on IDs
                // For this UI, we just need to know it's bought
                setMessage(`${player.name}, ${tile.name} mülkünü satın aldı!`);
            }

            if (action.type === 'END_TURN') {
                newRoom.currentTurn = (newRoom.currentTurn + 1) % newRoom.players.length;
            }

            return newRoom;
        });
    };

    const handleTileLanding = (player, tile, roomState) => {
        if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
            const owner = roomState.players.find(p => p.properties.includes(tile.id));
            if (!owner) {
                setMessage(`${tile.name} boşta! Satın alabilirsin (Fiyat: ${tile.price}₺)`);
            } else if (owner.id !== player.id) {
                const rent = tile.rent || 20;
                player.money -= rent;
                owner.money += rent;
                setMessage(`${player.name} -> ${owner.name} kullanıcısına ${rent}₺ kira ödedi`);
            }
        } else if (tile.type === 'tax') {
            player.money -= tile.price;
            setMessage(`${player.name} ${tile.price}₺ vergi ödedi`);
        } else if (tile.type === 'gotojail') {
            player.position = 10;
            setMessage(`${player.name} hapse girdi! 🚓`);
        }
    };

    const buyProperty = () => {
        const player = room.players[room.currentTurn];
        const tile = BOARD_TILES[player.position];
        // Check if property is already owned
        const isOwned = room.players.some(p => p.properties.includes(tile.id));

        if (player.id === socket.id && (tile.type === 'property' || tile.type === 'station') && !isOwned && player.money >= tile.price) {
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
            <div className="flex items-center justify-center min-h-screen w-full px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass p-10 w-full max-w-xl text-center rounded-[32px] relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <div className="flex justify-center mb-8">
                        <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 4 }}
                            className="p-6 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 shadow-2xl shadow-indigo-500/20"
                        >
                            <Dice5 size={64} className="text-indigo-400" />
                        </motion.div>
                    </div>

                    <h1 className="text-5xl font-black mb-2 tracking-tight text-white">
                        EMLAK KRALI <span className="text-indigo-500">TR</span>
                    </h1>
                    <p className="text-slate-400 text-lg mb-10 font-medium">Türkiye'nin en büyük emlak imparatorluğunu kur.</p>

                    <div className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                placeholder="Oyuncu adın nedir?"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white text-lg transition-all"
                            />
                        </div>

                        <button
                            onClick={joinRoom}
                            className="btn-primary w-full py-5 text-xl flex items-center justify-center gap-3"
                        >
                            <PlayCircle size={24} /> Oyuna Katıl
                        </button>
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-6 text-slate-500 text-sm font-semibold uppercase tracking-widest">
                        <span className="flex items-center gap-2"><Users size={16} /> 6 Oyuncu</span>
                        <span className="w-1 h-1 bg-slate-700 rounded-full" />
                        <span className="flex items-center gap-2"><Trophy size={16} /> Online</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="flex items-center justify-center min-h-screen w-full px-4">
                <div className="glass p-10 w-full max-w-lg rounded-[32px]">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-bold">Bekleme Odası</h2>
                        <div className="px-3 py-1 bg-indigo-500/20 rounded-full text-indigo-400 text-sm font-bold border border-indigo-500/20">
                            {room?.players.length}/6
                        </div>
                    </div>

                    <div className="space-y-3 mb-10">
                        {room?.players.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl shadow-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: p.color }}>
                                        {p.name[0]}
                                    </div>
                                    <span className="text-lg font-semibold">{p.name} {p.id === socket.id && <span className="text-indigo-400 ml-2">(Sen)</span>}</span>
                                </div>
                                {i === 0 && <Star size={18} className="text-amber-400 fill-amber-400" />}
                            </motion.div>
                        ))}
                    </div>

                    {room?.players.length >= 2 && room.players[0].id === socket.id ? (
                        <button onClick={startGame} className="btn-primary w-full py-4 text-lg">Macerayı Başlat!</button>
                    ) : (
                        <div className="text-center py-4">
                            <div className="flex justify-center gap-1 mb-3">
                                {[0, 1, 2].map(i => <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, delay: i * 0.2 }} className="w-2 h-2 bg-indigo-500 rounded-full" />)}
                            </div>
                            <p className="text-slate-400 font-medium">Liderin oyunu başlatması bekleniyor...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="game-container">
            {/* Sidebar */}
            <div className="sidebar">
                <div className="glass p-6 rounded-[24px]">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                        <Users size={22} className="text-indigo-400" /> Oyuncular
                    </h3>
                    <div className="space-y-3">
                        {room?.players.map((p, i) => (
                            <motion.div
                                key={p.id}
                                className={`p-4 rounded-2xl border transition-all ${room.currentTurn === i ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg ring-1 ring-indigo-500/20' : 'bg-white/5 border-transparent opacity-60'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }} />
                                        <span className={`font-bold ${room.currentTurn === i ? 'text-white' : 'text-slate-400'}`}>
                                            {p.name}
                                        </span>
                                    </div>
                                    <span className="text-emerald-400 font-black text-lg">{p.money}₺</span>
                                </div>
                                {room.currentTurn === i && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                                        <span className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter">Şu an hamle yapıyor</span>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="glass p-6 rounded-[24px] flex-1 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                        <History size={22} className="text-emerald-400" /> Log
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div className="text-sm font-medium leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5 text-slate-200">
                            ✨ {message}
                        </div>
                    </div>
                </div>
            </div>

            {/* Board Section */}
            <div className="board-wrapper">
                <div className="board">
                    {/* Render Tiles */}
                    {BOARD_TILES.map((tile, i) => {
                        let row, col;
                        if (i <= 10) { row = 11; col = 11 - i; }
                        else if (i <= 20) { row = 21 - i; col = 1; }
                        else if (i <= 30) { row = 1; col = i - 19; }
                        else { row = i - 29; col = 11; }

                        const owner = room?.players.find(p => p.properties.includes(tile.id));

                        return (
                            <div key={i} className="tile" style={{ gridRow: row, gridColumn: col }}>
                                {tile.color && <div className="tile-header" style={{ backgroundColor: tile.color }} />}
                                <div className="tile-info">
                                    <span className="tile-name">{tile.name}</span>
                                    {tile.price && <span className="tile-price">{tile.price}₺</span>}
                                    {owner && (
                                        <motion.div
                                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            className="mt-1 w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-lg"
                                            style={{ backgroundColor: owner.color }}
                                        />
                                    )}
                                </div>

                                {/* Tokens in Tile */}
                                <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2">
                                    <AnimatePresence>
                                        {room?.players.filter(p => p.position === i).map((p) => (
                                            <motion.div
                                                key={p.id}
                                                layoutId={p.id}
                                                className="player-token"
                                                style={{ backgroundColor: p.color }}
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                exit={{ scale: 0 }}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}

                    {/* Center of Board */}
                    <div className="board-center">
                        <div className="center-logo">EMLAK KRALI</div>

                        <div className="flex gap-6 items-center mb-10">
                            {[0, 1].map(index => (
                                <motion.div
                                    key={index}
                                    animate={diceRolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.2, 1] } : {}}
                                    transition={{ repeat: Infinity, duration: 0.15 }}
                                    className="w-24 h-24 bg-white rounded-[24px] shadow-2xl flex items-center justify-center text-5xl font-black text-slate-800 border-b-8 border-slate-200"
                                >
                                    {lastDice[index]}
                                </motion.div>
                            ))}
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={rollDice}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id || diceRolling}
                                className="btn-primary py-4 px-8 text-xl flex items-center gap-3"
                            >
                                <Dice5 size={24} /> Zar At
                            </button>

                            <button
                                onClick={buyProperty}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-[14px] font-bold text-lg flex items-center gap-3 shadow-xl transition-all disabled:opacity-50"
                            >
                                <ShoppingCart size={24} /> Satın Al
                            </button>

                            <button
                                onClick={endTurn}
                                disabled={room?.players[room?.currentTurn]?.id !== socket.id}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-8 py-4 rounded-[14px] font-bold text-lg flex items-center gap-3 shadow-xl transition-all disabled:opacity-50"
                            >
                                <LogOut size={24} /> Bitti
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
