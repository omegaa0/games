import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, User, DollarSign, ShoppingCart, LogOut, Users, History, PlayCircle, Star, Zap, Droplet } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES } from './data/boardData';
import './index.css';

const socket = io();

const App = () => {
    const [gameState, setGameState] = useState('lobby'); // lobby, waiting, game
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId] = useState('turkiye-mega');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Türkiye turuna hoş geldiniz! Emlak imparatorluğunuzu kurmaya başlayın.');

    useEffect(() => {
        socket.on('roomUpdate', (updatedRoom) => setRoom(updatedRoom));
        socket.on('gameStarted', (updatedRoom) => {
            setRoom(updatedRoom);
            setGameState('game');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        });
        socket.on('gameStateUpdate', (action) => handleAction(action));

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

    const startGame = () => socket.emit('startGame', roomId);

    const rollDice = () => {
        if (room.players[room.currentTurn].id !== socket.id || diceRolling) return;
        setDiceRolling(true);
        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            setLastDice([d1, d2]);
            setDiceRolling(false);
            const total = d1 + d2;
            const player = room.players[room.currentTurn];
            const newPos = (player.position + total) % 40;
            socket.emit('makeMove', {
                roomId, action: {
                    type: 'MOVE_PLAYER', playerId: player.id, newPosition: newPos, passedStart: newPos < player.position
                }
            });
        }, 1000);
    };

    const handleAction = (action) => {
        setRoom(prevRoom => {
            if (!prevRoom) return prevRoom;
            const newRoom = JSON.parse(JSON.stringify(prevRoom));
            const player = newRoom.players.find(p => p.id === action.playerId);
            if (!player) return newRoom;

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
            if (!owner) setMessage(`${tile.name} boşta! (Fiyat: ${tile.price}₺)`);
            else if (owner.id !== player.id) {
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
            <div className="scene-container">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass p-12 w-full max-w-xl text-center rounded-[40px] border-t-8 border-indigo-500">
                    <div className="flex justify-center mb-10">
                        <motion.div animate={{ rotateY: [0, 180, 360], translateZ: [0, 50, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="p-8 bg-indigo-500/10 rounded-[32px] border border-indigo-500/20 shadow-2xl">
                            <Dice5 size={80} className="text-indigo-400" />
                        </motion.div>
                    </div>
                    <h1 className="text-6xl font-black mb-4 tracking-tighter text-white">EMLAK KRALI <span className="text-indigo-500">TR</span></h1>
                    <p className="text-slate-400 text-xl mb-12 font-medium">Türkiye'nin şehirlerini fethetmeye hazır mısın?</p>
                    <div className="space-y-6">
                        <div className="relative">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                            <input type="text" placeholder="İsminiz..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-slate-900/60 border border-white/10 rounded-2xl pl-14 pr-6 py-5 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 text-white text-xl transition-all" />
                        </div>
                        <button onClick={joinRoom} className="btn-premium w-full flex items-center justify-center gap-4"><PlayCircle size={28} /> Oyunu Başlat</button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="scene-container">
                <div className="glass p-12 w-full max-w-lg rounded-[40px]">
                    <h2 className="text-4xl font-black mb-10 flex items-center justify-between">Oda <span className="text-indigo-400 text-2xl font-bold">{room?.players.length}/6</span></h2>
                    <div className="space-y-4 mb-12">
                        {room?.players.map((p, i) => (
                            <motion.div key={p.id} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center text-white text-xl font-black" style={{ backgroundColor: p.color }}>{p.name[0]}</div>
                                    <span className="text-xl font-bold">{p.name} {p.id === socket.id && <span className="text-indigo-400 text-sm">(SEN)</span>}</span>
                                </div>
                                {i === 0 && <Star size={24} className="text-amber-400 fill-amber-400" />}
                            </motion.div>
                        ))}
                    </div>
                    {room?.players.length >= 2 && room.players[0].id === socket.id ? (
                        <button onClick={startGame} className="btn-premium w-full">Tur Başlasın!</button>
                    ) : (
                        <p className="text-center text-slate-400 font-bold animate-pulse text-lg">Diğer emlakçılar bekleniyor...</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="scene-container">
            {/* Sidebar Left */}
            <div className="sidebar">
                <div className="stats-panel">
                    <h3 className="text-2xl font-black mb-6 flex items-center gap-4"><Users className="text-indigo-400" /> Emlakçılar</h3>
                    {room?.players.map((p, i) => (
                        <div key={p.id} className={`player-card ${room.currentTurn === i ? 'active' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: p.color, boxShadow: `0 0 15px ${p.color}` }} />
                                <span className="font-bold text-lg">{p.name}</span>
                            </div>
                            <span className="text-emerald-400 font-black text-xl">{p.money}₺</span>
                        </div>
                    ))}
                </div>
                <div className="stats-panel flex-1">
                    <h3 className="text-2xl font-black mb-4 flex items-center gap-4"><History className="text-emerald-400" /> Akış</h3>
                    <div className="p-5 bg-black/60 rounded-2xl border border-white/5 text-lg font-medium leading-relaxed italic text-slate-200">✨ {message}</div>
                </div>
            </div>

            {/* 3D Board Center */}
            <div className="board-3d-wrapper">
                <div className="board">
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
                                <div className="tile-content">
                                    <span className="tile-name">{tile.name}</span>
                                    {tile.type === 'utility' && (tile.icon === 'zap' ? <Zap size={14} className="my-1" /> : <Droplet size={14} className="my-1" />)}
                                    {tile.price && <span className="tile-price">{tile.price}₺</span>}
                                    {owner && <div className="mt-1 w-3 h-3 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: owner.color }} />}
                                </div>
                                <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-1">
                                    <AnimatePresence>
                                        {room?.players.filter(p => p.position === i).map(p => (
                                            <motion.div key={p.id} layoutId={p.id} className="player-token" style={{ backgroundColor: p.color }} initial={{ scale: 0, translateZ: 50 }} animate={{ scale: 1, translateZ: 20 }} exit={{ scale: 0 }} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                    <div className="board-center">
                        <div className="center-logo">EMLAK KRALI</div>
                        <div className="dice-container">
                            {lastDice.map((d, idx) => (
                                <motion.div key={idx} animate={diceRolling ? { rotateX: [0, 360, 720], rotateY: [0, 360, 720], scale: [1, 1.3, 1] } : {}} transition={{ repeat: Infinity, duration: 0.2 }} className="dice-3d">{d}</motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Controls */}
            <div className="controls-panel">
                <button onClick={rollDice} disabled={room?.players[room?.currentTurn]?.id !== socket.id || diceRolling} className="btn-premium flex items-center gap-3"><Dice5 size={24} /> Zar At</button>
                <button onClick={buyProperty} disabled={room?.players[room?.currentTurn]?.id !== socket.id} className="btn-premium bg-emerald-600 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><ShoppingCart size={24} /> Al</button>
                <button onClick={endTurn} disabled={room?.players[room?.currentTurn]?.id !== socket.id} className="btn-premium bg-slate-700 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #334155, #1e293b)' }}><LogOut size={24} /> Bitir</button>
            </div>
        </div>
    );
};

export default App;
