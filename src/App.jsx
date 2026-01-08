import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, User, DollarSign, ShoppingCart, LogOut, Users, History, PlayCircle, Star, Zap, Droplet, Wallet } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES } from './data/boardData';
import './index.css';

const socket = io();

// 3D Dice Component
const Dice3D = ({ value, rolling }) => {
    // Basic rotation mapping for dice faces
    const rotations = {
        1: 'rotateX(0deg) rotateY(0deg)',
        2: 'rotateX(-90deg) rotateY(0deg)',
        3: 'rotateY(-90deg) rotateX(0deg)',
        4: 'rotateY(90deg) rotateX(0deg)',
        5: 'rotateX(90deg) rotateY(0deg)',
        6: 'rotateX(180deg) rotateY(0deg)'
    };

    return (
        <div className="dice-cube" style={{
            transform: rolling ? 'rotateX(720deg) rotateY(720deg) rotateZ(720deg)' : rotations[value] || rotations[1]
        }}>
            <div className="dice-face front">1</div>
            <div className="dice-face back">6</div>
            <div className="dice-face right">3</div>
            <div className="dice-face left">4</div>
            <div className="dice-face top">2</div>
            <div className="dice-face bottom">5</div>
        </div>
    );
};

// 3D Player Character Component
const Character3D = ({ color, name, isCurrent }) => {
    return (
        <motion.div
            className="character-3d"
            style={{ color }}
            animate={isCurrent ? { y: [0, -15, 0] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
        >
            <div className="char-head" />
            <div className="char-body" />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] whitespace-nowrap border border-white/20">
                {name}
            </div>
        </motion.div>
    );
};

const App = () => {
    const [gameState, setGameState] = useState('lobby'); // lobby, waiting, game
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId] = useState('turkiye-mega-v2');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Hoş geldiniz, Emlak Kralı! İmparatorluğunu kurmaya hazır ol.');

    useEffect(() => {
        socket.on('roomUpdate', (updatedRoom) => setRoom(updatedRoom));
        socket.on('gameStarted', (updatedRoom) => {
            setRoom(updatedRoom);
            setGameState('game');
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
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
        }, 1200);
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
                    player.money += 2000000;
                    setMessage(`${player.name} başlangıçtan geçti +2.000.000₺`);
                }
                const tile = BOARD_TILES[action.newPosition];
                handleTileLanding(player, tile, newRoom);
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
            if (!owner) setMessage(`${tile.name} boşta! (Fiyat: ${tile.price.toLocaleString()}₺)`);
            else if (owner.id !== player.id) {
                const rent = tile.rent || 200000;
                player.money -= rent;
                owner.money += rent;
                setMessage(`${player.name} -> ${owner.name} kullanıcısına ${rent.toLocaleString()}₺ kira ödedi`);
            }
        } else if (tile.type === 'tax') {
            player.money -= tile.price;
            setMessage(`${player.name} ${tile.price.toLocaleString()}₺ lüks vergisi ödedi`);
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
            <div className="scene-container overflow-auto">
                <div className="bg-orbit" style={{ left: '-20%', top: '-20%' }} />
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="glass p-16 w-full max-w-2xl text-center rounded-[50px] border-b-[10px] border-indigo-500 shadow-2xl relative">
                    <h1 className="text-7xl font-black mb-4 tracking-tighter text-white">EMLAK KRALI <span className="text-indigo-500">TR</span></h1>
                    <p className="text-slate-400 text-2xl mb-12 font-medium">Milyonerler kulübüne katılmaya hazır mısın?</p>
                    <div className="space-y-8">
                        <input type="text" placeholder="İsminizi yazın..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded-3xl px-8 py-6 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 text-white text-2xl transition-all" />
                        <button onClick={joinRoom} className="btn-luxury w-full flex items-center justify-center gap-6"><PlayCircle size={32} /> Oyuna Katıl</button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="scene-container">
                <div className="glass p-16 w-full max-w-xl rounded-[50px] border-l-[10px] border-indigo-500">
                    <h2 className="text-5xl font-black mb-12 flex items-center justify-between">Oda <span className="text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-2xl">{room?.players.length}/6</span></h2>
                    <div className="space-y-6 mb-12">
                        {room?.players.map((p, i) => (
                            <motion.div key={p.id} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center text-white text-2xl font-black" style={{ backgroundColor: p.color }}>{p.name[0]}</div>
                                    <span className="text-2xl font-bold">{p.name}</span>
                                </div>
                                {i === 0 && <Star size={32} className="text-amber-400 fill-amber-400" />}
                            </motion.div>
                        ))}
                    </div>
                    {room?.players.length >= 2 && room.players[0].id === socket.id ? (
                        <button onClick={startGame} className="btn-luxury w-full">Zarları Dağıt!</button>
                    ) : (
                        <p className="text-center text-indigo-400 font-black text-xl animate-pulse">Kurucu bekleniyor...</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="scene-container">
            {/* 3D Player List */}
            <div className="players-3d-list">
                {room?.players.map((p, i) => (
                    <div key={p.id} className={`player-3d-card ${room.currentTurn === i ? 'active' : ''}`}>
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            <Character3D color={p.color} name="" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-black text-xl flex items-center gap-2">
                                {p.name} {p.id === socket.id && <span className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded">SİZ</span>}
                            </span>
                            <div className="money-3d flex items-center gap-2">
                                <Wallet size={16} /> {p.money.toLocaleString()}₺
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Game Info Bubble */}
            <div className="absolute top-10 right-10 glass p-6 rounded-3xl max-w-sm border-r-[8px] border-emerald-500">
                <h4 className="text-slate-500 text-xs font-black uppercase mb-2 tracking-widest flex items-center gap-2"><History size={14} /> Son Durum</h4>
                <p className="text-lg font-bold leading-tight">{message}</p>
            </div>

            {/* 3D Scene Root */}
            <div className="board-3d-system">
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
                                    {tile.price && <span className="tile-price">{(tile.price / 1000000).toFixed(1)}M₺</span>}
                                    {owner && <div className="mt-2 w-4 h-4 rounded-full border-2 border-white shadow-xl" style={{ backgroundColor: owner.color }} />}
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <AnimatePresence>
                                        {room?.players.filter(p => p.position === i).map(p => (
                                            <div key={p.id} className="relative w-full h-full flex items-center justify-center">
                                                <Character3D color={p.color} name={p.name} isCurrent={room.players[room.currentTurn].id === p.id} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                    <div className="board-center">
                        <div className="center-logo">EMLAK KRALI</div>
                        <div className="flex gap-12 items-center">
                            <Dice3D value={lastDice[0]} rolling={diceRolling} />
                            <Dice3D value={lastDice[1]} rolling={diceRolling} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Controls */}
            <div className="controls-bottom">
                <button onClick={rollDice} disabled={room?.players[room?.currentTurn]?.id !== socket.id || diceRolling} className="btn-luxury">ZAR AT</button>
                <button onClick={buyProperty} disabled={room?.players[room?.currentTurn]?.id !== socket.id} className="btn-luxury bg-emerald-600" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderBottom: '4px solid #065f46' }}>SATIN AL</button>
                <button onClick={endTurn} disabled={room?.players[room?.currentTurn]?.id !== socket.id} className="btn-luxury bg-slate-700" style={{ background: 'linear-gradient(135deg, #334155, #1e293b)', borderBottom: '4px solid #0f172a' }}>TURU BİTİR</button>
            </div>
        </div>
    );
};

export default App;
