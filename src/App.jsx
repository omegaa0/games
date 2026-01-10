import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, User, DollarSign, ShoppingCart, LogOut, Users, History, PlayCircle, Star, Zap, Droplet, Wallet, Map, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES } from './data/boardData';
import './index.css';

const socket = io();

const Dice3D = ({ value, rolling }) => {
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

const Character3D = ({ color, name, isCurrent }) => {
    return (
        <motion.div
            className="character-3d"
            style={{ color }}
            animate={isCurrent ? { y: [0, -20, 0] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
        >
            <div className="char-head" />
            <div className="char-body" />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap border border-white/20 text-white shadow-xl z-50">
                {name}
            </div>
        </motion.div>
    );
};

const App = () => {
    const [gameState, setGameState] = useState('lobby');
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId] = useState('turkiye-mega-large');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Emlak Kralı: Türkiye Dev Harita!');

    // Game Flow
    const [canBuy, setCanBuy] = useState(false);
    const [turnPhase, setTurnPhase] = useState('roll');
    const [rolledDoubles, setRolledDoubles] = useState(false);

    // Viewing State
    const [viewMode, setViewMode] = useState('3d'); // '3d' or 'top'

    useEffect(() => {
        socket.on('roomUpdate', (updatedRoom) => setRoom(updatedRoom));
        socket.on('gameStarted', (updatedRoom) => {
            setRoom(updatedRoom);
            setGameState('game');
            confetti({ particleCount: 300, spread: 180, origin: { y: 0.5 } });
        });
        socket.on('gameStateUpdate', (action) => handleAction(action));

        return () => {
            socket.off('roomUpdate');
            socket.off('gameStarted');
            socket.off('gameStateUpdate');
        };
    }, [room]);

    useEffect(() => {
        if (room && room.players[room.currentTurn].id === socket.id) {
            if (turnPhase === 'end') { }
        } else {
            setTurnPhase('roll');
            setCanBuy(false);
            setRolledDoubles(false);
        }
    }, [room?.currentTurn]);

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
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;

        setTimeout(() => {
            setLastDice([d1, d2]);
            setDiceRolling(false);
            const isDoubles = d1 === d2;
            setRolledDoubles(isDoubles);
            const total = d1 + d2;
            const player = room.players[room.currentTurn];
            const newPos = (player.position + total) % 56; // 56 Tiles now

            socket.emit('makeMove', {
                roomId, action: {
                    type: 'MOVE_PLAYER', playerId: player.id, newPosition: newPos, passedStart: newPos < player.position, dice: [d1, d2]
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

                if (player.id === socket.id) {
                    const tile = BOARD_TILES[action.newPosition];
                    const owner = prevRoom.players.find(p => p.properties.includes(tile.id));

                    if ((tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') && !owner) {
                        if (player.money >= tile.price) {
                            setCanBuy(true);
                            setTurnPhase('decision');
                        } else {
                            setTurnPhase('decision');
                            setCanBuy(false);
                        }
                    } else {
                        handleTileEffects(player, tile, newRoom, action.dice);
                    }
                } else {
                    const tile = BOARD_TILES[action.newPosition];
                    handleSimpleTileMessage(player, tile, newRoom);
                }
            }

            if (action.type === 'BUY_PROPERTY') {
                const tile = BOARD_TILES[player.position];
                player.money -= tile.price;
                player.properties.push(tile.id);
                setMessage(`${player.name}, ${tile.name} mülkünü satın aldı!`);
                if (socket.id === action.playerId) handlePostMove(rolledDoubles);
            }

            if (action.type === 'END_TURN') {
                newRoom.currentTurn = (newRoom.currentTurn + 1) % newRoom.players.length;
            }
            return newRoom;
        });
    };

    const handleTileEffects = (player, tile, roomState, dice) => {
        const owner = roomState.players.find(p => p.properties.includes(tile.id));
        if (owner && owner.id !== player.id) {
            const rent = tile.rent || 200000;
            player.money -= rent;
            owner.money += rent;
            setMessage(`${player.name} -> ${owner.name} kira ödedi: ${rent.toLocaleString()}₺`);
        } else if (tile.type === 'tax') {
            player.money -= tile.price;
            setMessage(`${player.name} vergi ödedi: ${tile.price.toLocaleString()}₺`);
        } else if (tile.type === 'gotojail') {
            player.position = 14; // Jail index for 56 tile board (14th tile)
            setMessage(`${player.name} nezarethaneye gönderildi!`);
        }

        const isDoubles = dice && dice[0] === dice[1];
        if (isDoubles) {
            setTurnPhase('roll');
            setRolledDoubles(true);
        } else {
            setTimeout(() => endTurn(), 2000);
        }
    };

    const handleSimpleTileMessage = (player, tile, roomState) => {
        setMessage(`${player.name} ${tile.name} karesine geldi.`);
    };

    const handlePostMove = (doubles) => {
        if (doubles) {
            setTurnPhase('roll');
            setCanBuy(false);
            setMessage("Çift attın! Tekrar zar at.");
        } else {
            endTurn();
        }
    };

    const buyProperty = () => {
        const player = room.players[room.currentTurn];
        socket.emit('makeMove', { roomId, action: { type: 'BUY_PROPERTY', playerId: player.id } });
        setCanBuy(false);
    };

    const passTurn = () => handlePostMove(rolledDoubles);

    const endTurn = () => {
        socket.emit('makeMove', { roomId, action: { type: 'END_TURN', playerId: socket.id } });
        setTurnPhase('roll');
        setCanBuy(false);
        setRolledDoubles(false);
    };

    const toggleView = () => {
        setViewMode(prev => prev === '3d' ? 'top' : '3d');
    };

    if (gameState === 'lobby') {
        return (
            <div className="scene-container overflow-auto lobby-bg">
                <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=2800&auto=format&fit=crop)' }}></div>
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="glass p-16 w-full max-w-3xl text-center rounded-[60px] border border-white/10 shadow-2xl relative z-10 backdrop-blur-xl">
                    <h1 className="text-8xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-lg">
                        EMLAK KRALI <span className="text-white text-5xl block mt-2">TÜRKİYE</span>
                    </h1>
                    <p className="text-slate-300 text-2xl mb-12 font-medium">81 İl, 56 Dev Kare, Milyonluk İmparatorluklar.</p>
                    <div className="space-y-8 flex flex-col items-center">
                        <input type="text" placeholder="İsminizi Giriniz" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-[80%] bg-black/50 border border-indigo-500/30 rounded-3xl px-8 py-8 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 text-white text-3xl font-bold text-center transition-all placeholder:text-slate-600" />
                        <button onClick={joinRoom} className="btn-luxury w-[80%] py-8 text-3xl flex items-center justify-center gap-6 group">
                            <PlayCircle size={40} className="group-hover:scale-110 transition-transform" /> DESTANA KATIL
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (gameState === 'waiting') {
        return (
            <div className="scene-container lobby-bg">
                <div className="glass p-12 w-full max-w-2xl rounded-[50px] border border-white/10 relative z-10">
                    <h2 className="text-6xl font-black mb-12 flex items-center justify-center gap-6">
                        LOBİ <span className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-4xl">{room?.players.length}/6</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-12">
                        {room?.players.map((p, i) => (
                            <motion.div key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white text-xl font-black" style={{ backgroundColor: p.color }}>{p.name[0]}</div>
                                <span className="text-xl font-bold truncate">{p.name} {i === 0 && '👑'}</span>
                            </motion.div>
                        ))}
                    </div>
                    {room?.players.length >= 2 && room.players[0].id === socket.id ? (
                        <button onClick={startGame} className="btn-luxury w-full py-6 text-2xl">OYUNU BAŞLAT 🚀</button>
                    ) : (
                        <p className="text-center text-slate-400 font-bold text-xl animate-pulse">Diğer oyuncular bekleniyor...</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="scene-container">
            {/* HUD: Players */}
            <div className="players-3d-list">
                {room?.players.map((p, i) => (
                    <div key={p.id} className={`player-3d-card ${room.currentTurn === i ? 'active' : ''} ${room.players[room.currentTurn].id === p.id ? 'turn-pulse' : ''}`}>
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <Character3D color={p.color} name="" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-black text-lg flex items-center gap-2">
                                {p.name}
                            </span>
                            <div className="money-3d flex items-center gap-1 text-sm text-emerald-400">
                                <Wallet size={14} /> {(p.money / 1000000).toFixed(1)}M₺
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* View Toggle */}
            <button onClick={toggleView} className="absolute top-10 transform -translate-x-1/2 left-1/2 z-[2000] glass px-6 py-3 rounded-full flex items-center gap-3 hover:bg-white/10 transition-all font-bold">
                {viewMode === '3d' ? <><Map size={20} /> KUŞ BAKIŞI</> : <><Eye size={20} /> 3D GÖRÜNÜM</>}
            </button>

            {/* Game Info */}
            <div className="absolute top-10 right-10 glass p-6 rounded-3xl max-w-sm border-l-[6px] border-indigo-500 z-[2000]">
                <p className="text-md font-bold leading-tight text-white mb-2">{message}</p>
            </div>

            {/* 3D Scene Root */}
            <div className={`board-3d-system ${viewMode === 'top' ? 'top-down-mode' : ''}`}>
                <div className="board expanded-board">
                    {/* 56 Tiles Logic: 15x15 Grid. 0-14, 14-28, 28-42, 42-56 */}
                    {BOARD_TILES.map((tile, i) => {
                        let row, col;
                        // 15x15 grid indices are 1-15
                        // Bottom row: i=0 (Start) at 15,15. i=14 (Corner) at 15,1.
                        if (i <= 14) { row = 15; col = 15 - i; }
                        // Left row: i=14 is 15,1. i=28 is 1,1.
                        else if (i <= 28) { row = 29 - i; col = 1; } // Check math: i=15->row=14. i=28->row=1.
                        // Top row: i=28 is 1,1. i=42 is 1,15.
                        else if (i <= 42) { row = 1; col = i - 27; } // i=29->col=2. i=42->col=15.
                        // Right row: i=42 is 1,15. i=56 would be 15,15.
                        else { row = i - 41; col = 15; } // i=43->row=2. i=55->row=14.

                        const owner = room?.players.find(p => p.properties.includes(tile.id));
                        return (
                            <div
                                key={i}
                                className={`tile ${owner ? 'owned-tile' : ''}`}
                                style={{
                                    gridRow: row,
                                    gridColumn: col,
                                    boxShadow: owner ? `inset 0 0 20px ${owner.color}80` : undefined,
                                    borderColor: owner ? owner.color : undefined
                                }}
                            >
                                {tile.color && <div className="tile-header" style={{ backgroundColor: tile.color }} />}
                                <div className="tile-content">
                                    <span className="tile-name">{tile.name}</span>
                                    {tile.price && <span className="tile-price">{(tile.price / 1000000).toFixed(1)}M</span>}
                                    {owner && (
                                        <div className="absolute top-1 right-1 w-3 h-3 rounded-full shadow-lg border border-white" style={{ backgroundColor: owner.color }} />
                                    )}
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center z-20">
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
                    <div className="board-center expanded-center">
                        <div className="center-logo">EMLAK KRALI TR</div>
                        <div className="flex gap-16 items-center scale-150">
                            <Dice3D value={lastDice[0]} rolling={diceRolling} />
                            <Dice3D value={lastDice[1]} rolling={diceRolling} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="controls-bottom">
                {room?.players[room?.currentTurn].id === socket.id && turnPhase === 'roll' && (
                    <button onClick={rollDice} disabled={diceRolling} className="btn-luxury text-2xl px-12 py-6">
                        {rolledDoubles ? "ÇİFT! TEKRAR" : "ZARI FIRLAT 🎲"}
                    </button>
                )}

                {room?.players[room?.currentTurn].id === socket.id && turnPhase === 'decision' && (
                    <div className="flex gap-4">
                        {canBuy ? (
                            <button onClick={buyProperty} className="btn-luxury bg-emerald-600 text-xl px-10 py-5 border-b-8 border-emerald-800 hover:border-emerald-700">
                                SATIN AL 💸
                            </button>
                        ) : (
                            <div className="bg-red-600/90 px-8 py-5 rounded-2xl text-white font-black border-2 border-red-400">YETERSİZ BAKİYE</div>
                        )}
                        <button onClick={passTurn} className="btn-luxury bg-slate-800 text-xl px-10 py-5 border-b-8 border-slate-950">
                            {rolledDoubles ? "TURU BİTİR (TEKRAR AT)" : "PAS GEÇ ⏭️"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
