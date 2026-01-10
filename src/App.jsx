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

const Building3D = ({ level }) => {
    if (level === 5) return <div className="building-hotel" />;
    return (
        <div className="building-container">
            {Array.from({ length: level }).map((_, i) => (
                <div key={i} className="building-house" />
            ))}
        </div>
    );
};

// Spectator around the board
const Spectator3D = ({ angle, color }) => (
    <div className="spectator" style={{ transform: `rotate(${angle}deg) translate(800px) rotate(-${angle}deg)` }}>
        <Character3D color={color} name="Seyirci" />
    </div>
);

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
            {name && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap border border-white/20 text-white shadow-xl z-50">
                    {name}
                </div>
            )}
        </motion.div>
    );
};

// Decorative Statue for corners
const CornerStatue = ({ type }) => (
    <div className="corner-statue text-4xl opacity-50 filter drop-shadow-lg">
        {type === 'jail' && '🚔'}
        {type === 'parking' && '🅿️'}
        {type === 'gotojail' && '👮'}
        {type === 'start' && '🚩'}
    </div>
);

const App = () => {
    const [gameState, setGameState] = useState('lobby');
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');
    const [roomId] = useState('turkiye-mega-large-v3');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('Oyun Başladı! İyi eğlenceler.');

    // Game Flow
    const [canBuy, setCanBuy] = useState(false);
    const [canBuild, setCanBuild] = useState(false); // New state for building
    const [turnPhase, setTurnPhase] = useState('roll');
    const [rolledDoubles, setRolledDoubles] = useState(false);

    // Viewing State
    const [viewMode, setViewMode] = useState('3d');

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

    // Local turn reset
    useEffect(() => {
        if (room && room.players[room.currentTurn].id === socket.id) {
            // Logic to update local turn state if needed
        } else {
            setTurnPhase('roll');
            setCanBuy(false);
            setCanBuild(false);
            setRolledDoubles(false);
            setDiceRolling(false);
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
        socket.emit('makeMove', { roomId, action: { type: 'START_ROLL' } });

        // Local visual trigger is handled by receiving START_ROLL or just doing it
        // We will do logic locally then emit FINAL move

        setDiceRolling(true);
        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const total = d1 + d2;
            const player = room.players[room.currentTurn];
            const newPos = (player.position + total) % 56;

            // Emit the RESULT so everyone sees the same dice
            socket.emit('makeMove', {
                roomId, action: {
                    type: 'MOVE_PLAYER', playerId: player.id, newPosition: newPos, passedStart: newPos < player.position, dice: [d1, d2]
                }
            });
        }, 1200);
    };

    const handleAction = (action) => {
        // Handle Dice Sync
        if (action.type === 'START_ROLL') {
            setDiceRolling(true);
            return;
        }

        setRoom(prevRoom => {
            if (!prevRoom) return prevRoom;
            const newRoom = JSON.parse(JSON.stringify(prevRoom));

            // Sync Dice Result
            if (action.dice) {
                setLastDice(action.dice);
                setDiceRolling(false);
                setRolledDoubles(action.dice[0] === action.dice[1]);
            }

            const player = newRoom.players.find(p => p.id === action.playerId);
            if (!player) return newRoom;

            if (action.type === 'MOVE_PLAYER') {
                player.position = action.newPosition;
                if (action.passedStart) {
                    player.money += 2000000;
                    setMessage(`${player.name} başlangıçtan geçti +2.000.000₺`);
                }

                // If it's MY turn, I calculate logic, otherwise I just watch
                if (player.id === socket.id) {
                    const tile = BOARD_TILES[action.newPosition];
                    const owner = prevRoom.players.find(p => p.properties.includes(tile.id));

                    if ((tile.type === 'property' || tile.type === 'station' || tile.type === 'utility')) {
                        if (!owner) {
                            // Can Buy?
                            setCanBuy(player.money >= tile.price);
                            setCanBuild(false);
                            setTurnPhase('decision');
                        } else if (owner.id === player.id) {
                            // My own property -> Check if can build
                            // Logic: Can build if monopolized (simplified here: if I have money)
                            // Real Monopoly rules require owning color group. Let's do a simple check.
                            const groupProperties = BOARD_TILES.filter(t => t.group === tile.group);
                            const ownsAll = groupProperties.every(t => player.properties.includes(t.id));

                            const currentBuildLevel = (newRoom.buildings && newRoom.buildings[tile.id]) || 0;

                            if (ownsAll && currentBuildLevel < 5 && tile.housePrice && player.money >= tile.housePrice) {
                                setCanBuild(true);
                                setMessage("Kendi mülkün! Ev dikebilirsin.");
                            } else {
                                setCanBuild(false);
                                setMessage("Kendi mülkün.");
                            }
                            setCanBuy(false);
                            setTurnPhase('decision'); // Still give choice to end turn or build
                        } else {
                            // Someone else's
                            setCanBuy(false);
                            setCanBuild(false);
                            handleTileEffects(player, tile, newRoom, action.dice);
                        }
                    } else {
                        handleTileEffects(player, tile, newRoom, action.dice);
                    }
                } else {
                    // Update message for spectators
                    const tile = BOARD_TILES[action.newPosition];
                    if (tile.type === 'start') setMessage(`${player.name} Başlangıç noktasında.`);
                    else setMessage(`${player.name} ilerliyor...`);
                }
            }

            if (action.type === 'BUY_PROPERTY') {
                const tile = BOARD_TILES[player.position];
                player.money -= tile.price;
                player.properties.push(tile.id);
                setMessage(`${player.name}, ${tile.name} mülkünü satın aldı!`);
                if (socket.id === action.playerId) handlePostMove(false); // Don't end turn if we might want to do more? Nah standard flow.
            }

            if (action.type === 'BUILD_HOUSE') {
                // Init buildings object if not exists
                if (!newRoom.buildings) newRoom.buildings = {};
                const currentLevel = newRoom.buildings[action.tileId] || 0;
                if (currentLevel < 5) {
                    newRoom.buildings[action.tileId] = currentLevel + 1;
                    player.money -= action.cost;
                    setMessage(`${player.name}, ${BOARD_TILES.find(t => t.id === action.tileId).name} konumuna bina dikti!`);
                }
                if (socket.id === action.playerId) handlePostMove(false);
            }

            if (action.type === 'END_TURN') {
                newRoom.currentTurn = (newRoom.currentTurn + 1) % newRoom.players.length;
            }
            return newRoom;
        });
    };

    const handleTileEffects = (player, tile, roomState, dice) => {
        const owner = roomState.players.find(p => p.properties.includes(tile.id));
        const buildings = roomState.buildings || {};
        const level = buildings[tile.id] || 0;

        if (owner && owner.id !== player.id) {
            let rent = tile.rent || 200000;
            // Increase rent based on houses
            if (level > 0) rent = rent * (1 + level); // Simple multiplier

            player.money -= rent;
            owner.money += rent;
            setMessage(`${player.name} -> ${owner.name} kira: ${rent.toLocaleString()}₺ (Seviye ${level})`);
        } else if (tile.type === 'tax') {
            // Asset Tax Logic
            let taxAmount = 0;
            if (tile.price === 0) { // Dynamic tag
                // 10% of total cash + property values
                const propertyValue = player.properties.reduce((acc, pid) => {
                    const t = BOARD_TILES.find(x => x.id === pid);
                    return acc + (t ? t.price : 0);
                }, 0);
                const totalAssets = player.money + propertyValue;
                taxAmount = Math.floor(totalAssets * 0.1);
                setMessage(`${player.name} Varlık Vergisi: ${taxAmount.toLocaleString()}₺ (%10)`);
            } else {
                taxAmount = tile.price;
                setMessage(`${player.name} Vergi: ${taxAmount.toLocaleString()}₺`);
            }
            player.money -= taxAmount;

        } else if (tile.type === 'gotojail') {
            player.position = 14;
            setMessage(`${player.name} nezarethaneye gönderildi!`);
        }

        const isDoubles = dice && dice[0] === dice[1];
        if (socket.id === player.id) {
            if (isDoubles) {
                setTurnPhase('roll');
                setRolledDoubles(true);
            } else {
                setTimeout(() => endTurn(), 2500);
            }
        }
    };

    const handleSimpleTileMessage = (player, tile, roomState) => {
        // Optionally update message for others, but handleAction usually sets state messages better
        // If needed we can set a specific message here
    };

    const handlePostMove = (doubles) => {
        const dice = lastDice;
        const isDoubles = dice[0] === dice[1]; // Use current state dice
        if (isDoubles) {
            setTurnPhase('roll');
            setCanBuy(false);
            setCanBuild(false);
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

    const buildHouse = () => {
        const player = room.players[room.currentTurn];
        const tile = BOARD_TILES[player.position];
        socket.emit('makeMove', {
            roomId,
            action: {
                type: 'BUILD_HOUSE',
                playerId: player.id,
                tileId: tile.id,
                cost: tile.housePrice
            }
        });
        setCanBuild(false);
    };

    const passTurn = () => handlePostMove(false);

    const endTurn = () => {
        socket.emit('makeMove', { roomId, action: { type: 'END_TURN', playerId: socket.id } });
        setTurnPhase('roll');
        setCanBuy(false);
        setCanBuild(false);
        setRolledDoubles(false);
    };

    const toggleView = () => setViewMode(prev => prev === '3d' ? 'top' : '3d');

    // Generate random spectators
    const spectators = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => ({
        angle: deg + Math.random() * 20,
        color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][Math.floor(Math.random() * 4)]
    }));

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
                    <div key={p.id} className={`player-3d-card ${room.currentTurn === i ? 'active turn-pulse' : ''}`}>
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <Character3D color={p.color} name="" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-md leading-tight">
                                {p.name}
                            </span>
                            <div className="money-3d flex items-center gap-1 text-sm text-emerald-400 font-mono font-bold">
                                <Wallet size={12} /> {(p.money / 1000000).toFixed(1)}M
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
            <div className="absolute top-8 right-8 glass p-4 rounded-2xl max-w-xs border-l-4 border-indigo-500 z-[2000]">
                <p className="text-sm font-bold text-white text-center">{message}</p>
            </div>

            {/* 3D Scene Root */}
            <div className={`board-3d-system ${viewMode === 'top' ? 'top-down-mode' : ''}`}>

                {/* Spectators Ring */}
                <div className="spectators-ring">
                    {spectators.map((s, i) => (
                        <Spectator3D key={i} angle={s.angle} color={s.color} />
                    ))}
                    {room?.players.length > 0 && room.players.map((p, i) => (
                        <Spectator3D key={`p${i}`} angle={i * 45 + 10} color={p.color} />
                    ))}
                </div>

                <div className="board expanded-board">
                    {/* 56 Tiles Logic */}
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
                        const buildLevel = room?.buildings ? room.buildings[tile.id] : 0;

                        return (
                            <div
                                key={i}
                                className={`tile ${owner ? 'owned-tile' : ''}`}
                                style={{
                                    gridRow: row,
                                    gridColumn: col,
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

                                {/* 3D Buildings */}
                                {buildLevel > 0 && <Building3D level={buildLevel} />}

                                {/* Corner Models */}
                                {i === 0 && <CornerStatue type="start" />}
                                {i === 14 && <CornerStatue type="jail" />}
                                {i === 28 && <CornerStatue type="parking" />}
                                {i === 42 && <CornerStatue type="gotojail" />}

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

                    {/* Center of Board (Clickable for View Toggle) */}
                    <div className="board-center expanded-center cursor-pointer group hover:bg-white/5 transition-colors" onClick={toggleView}>
                        <div className="flex gap-16 items-center scale-150 pointer-events-none">
                            <Dice3D value={lastDice[0]} rolling={diceRolling} />
                            <Dice3D value={lastDice[1]} rolling={diceRolling} />
                        </div>
                        <div className="mt-12 text-slate-500 font-bold text-sm tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">
                            GÖRÜNÜMÜ DEĞİŞTİRMEK İÇİN TIKLA
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="controls-bottom">
                {room?.players[room?.currentTurn].id === socket.id && turnPhase === 'roll' && (
                    <button onClick={rollDice} disabled={diceRolling} className="btn-luxury px-8 py-4 text-xl">
                        {rolledDoubles ? "ÇİFT! TEKRAR AT" : "ZARI AT"}
                    </button>
                )}

                {room?.players[room?.currentTurn].id === socket.id && turnPhase === 'decision' && (
                    <>
                        {canBuy && !canBuild && (
                            <button onClick={buyProperty} className="btn-luxury bg-emerald-600 px-6 py-3 border-b-4 border-emerald-800 hover:border-emerald-700">
                                SATIN AL 💸
                            </button>
                        )}

                        {canBuild && (
                            <button onClick={buildHouse} className="btn-luxury bg-amber-600 px-6 py-3 border-b-4 border-amber-800 hover:border-amber-700">
                                BİNA DİK 🏠
                            </button>
                        )}

                        {!canBuy && !canBuild && (
                            <div className="insufficient-funds">
                                <LogOut size={16} /> YETERSİZ BAKİYE / İŞLEM YOK
                            </div>
                        )}

                        <button onClick={passTurn} className="btn-luxury bg-slate-800 px-6 py-3 border-b-4 border-slate-950">
                            {rolledDoubles ? "TURU BİTİR (TEKRAR AT)" : "PAS GEÇ"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default App;
