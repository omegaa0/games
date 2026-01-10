import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, User, DollarSign, ShoppingCart, LogOut, Users, History, PlayCircle, Star, Zap, Droplet, Wallet, Map, Eye, Send, Repeat } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES, CHANCE_CARDS, COMMUNITY_CHEST } from './data/boardData';
import ThreePlayer from './components/ThreePlayer';
import './index.css';

const socket = io();

// --- 3D HELPER COMPONENTS ---
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
        <div className="scene ml-[-50px]">
            <div className={`cube ${rolling ? 'rolling' : ''}`} style={{ transform: rotations[value] || rotations[1] }}>
                <div className="cube__face cube__face--front">1</div>
                <div className="cube__face cube__face--back">6</div>
                <div className="cube__face cube__face--right">3</div>
                <div className="cube__face cube__face--left">4</div>
                <div className="cube__face cube__face--top">2</div>
                <div className="cube__face cube__face--bottom">5</div>
            </div>
        </div>
    );
};

const Building3D = ({ level }) => {
    const isHotel = level === 5;
    return (
        <div className="building-3d" style={{
            width: isHotel ? '24px' : '16px',
            height: isHotel ? '24px' : '12px',
            backgroundColor: isHotel ? '#ef4444' : '#22c55e',
            transform: `translateZ(2px) translateX(${isHotel ? '0' : '5px'})`,
            boxShadow: '2px 2px 5px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.4)'
        }}>
            <div style={{ position: 'absolute', top: -5, left: 0, width: '100%', height: '5px', backgroundColor: isHotel ? '#b91c1c' : '#15803d', transform: 'rotateX(45deg)' }} />
        </div>
    );
};

const CornerStatue = ({ type }) => {
    let icon = null;
    let label = "";
    if (type === 'start') { icon = <PlayCircle size={48} className="text-white drop-shadow-xl" />; label = "BAŞLANGIÇ"; }
    if (type === 'jail') { icon = <div className="text-5xl drop-shadow-xl">👮</div>; label = ""; }
    if (type === 'parking') { icon = <div className="text-5xl drop-shadow-xl">🚗</div>; label = "OTOPARK"; }
    if (type === 'gotojail') { icon = <div className="text-5xl drop-shadow-xl">👮➡</div>; label = "HAPİS"; }
    return (
        <div className="corner-statue flex-col gap-2 scale-125">
            {icon}
            {label && <span className="text-white font-black text-[10px] bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">{label}</span>}
        </div>
    );
};

const ChatSystem = ({ room, socket, playerId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);
    const hasJoinedRef = useRef(false);

    useEffect(() => {
        if (!room) return;
        const messageHandler = (msg) => setMessages(prev => [...prev, msg]);
        socket.off('chatUpdate');
        socket.on('chatUpdate', messageHandler);
        if (!hasJoinedRef.current) {
            setMessages(prev => [...prev, { system: true, text: "Sohbet bağlantısı kuruldu." }]);
            hasJoinedRef.current = true;
        }
        return () => socket.off('chatUpdate', messageHandler);
    }, [room, socket]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        socket.emit('chatMessage', { roomId: room.id, message: input, playerId });
        setInput("");
    };

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-line ${msg.system ? 'system-msg' : ''}`}>
                        {msg.system ? <span className="text-yellow-400 text-xs font-bold italic">{msg.text}</span> : (
                            <div className="flex gap-2 items-start"><span className="font-bold text-xs px-1 rounded" style={{ backgroundColor: msg.playerColor, color: '#fff' }}>{msg.playerName}:</span><span className="text-white text-sm shadow-black drop-shadow-md">{msg.text}</span></div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="chat-input-area">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Sohbet et..." className="chat-input" />
                <button type="submit" className="text-white hover:text-indigo-400 transition-colors"><Send size={16} /></button>
            </form>
        </div>
    );
};

const App = () => {
    // --- STATE ---
    const [gameState, setGameState] = useState('lobby');
    const [room, setRoom] = useState(null);
    const [roomList, setRoomList] = useState([]); // Lobby Room List
    const [playerName, setPlayerName] = useState('');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('');
    const [turnPhase, setTurnPhase] = useState('roll');
    const [rolledDoubles, setRolledDoubles] = useState(false);
    const [canBuy, setCanBuy] = useState(false);
    const [canBuild, setCanBuild] = useState(false);
    const [viewMode, setViewMode] = useState('3d');
    const [tradeProposal, setTradeProposal] = useState(null);
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [tradeTarget, setTradeTarget] = useState(null);
    const [winner, setWinner] = useState(null);
    const [chanceCard, setChanceCard] = useState(null);
    const [hoveredTile, setHoveredTile] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    // --- EFFECTS ---
    useEffect(() => {
        socket.on('roomListUpdate', (list) => setRoomList(list));
        socket.on('roomCreated', (newRoom) => {
            setRoom(newRoom);
            setGameState('waiting');
        });
        socket.on('roomUpdate', (updatedRoom) => setRoom(updatedRoom));
        socket.on('gameStarted', (updatedRoom) => {
            playAudio('start');
            setRoom(updatedRoom);
            setGameState('game');
            confetti({ particleCount: 300, spread: 180, origin: { y: 0.5 } });
        });
        socket.on('gameStateUpdate', (action) => handleAction(action));
        socket.on('playerBankrupt', ({ playerName }) => {
            playAudio('fail');
            setMessage(`${playerName} İFLAS ETTİ! 💸`);
        });
        socket.on('gameOver', ({ winner }) => {
            setWinner(winner);
            playAudio('win');
            confetti({ particleCount: 1000, spread: 360, startVelocity: 60 });
        });

        socket.on('tradeProposal', (data) => {
            if (data.toPlayerId === socket.id) {
                setTradeProposal(data);
                playAudio('alert');
            }
        });
        socket.on('tradeResult', ({ accepted, tradeData }) => {
            if (tradeData.fromPlayerId === socket.id) {
                setMessage(accepted ? "Takas KABUL edildi! ✅" : "Takas REDDEDİLDİ. ❌");
            }
        });

        return () => {
            socket.off('roomListUpdate');
            socket.off('roomCreated');
            socket.off('roomUpdate');
            socket.off('gameStarted');
            socket.off('gameStateUpdate');
            socket.off('playerBankrupt');
            socket.off('gameOver');
            socket.off('tradeProposal');
            socket.off('tradeResult');
        };
    }, [room]);

    useEffect(() => {
        if (room && room.players[room.currentTurn].id === socket.id) {
        } else {
            setTurnPhase('roll');
            setCanBuy(false);
            setCanBuild(false);
            setRolledDoubles(false);
            setDiceRolling(false);
            setChanceCard(null);
        }
    }, [room?.currentTurn]);

    // --- AUDIO HELPER ---
    const playAudio = (type) => {
        // Placeholder
    };

    // --- ACTIONS ---
    const createRoom = () => {
        if (!playerName.trim()) return alert("Önce ismini gir!");
        if (!newRoomName.trim()) return alert("Oda ismi gir!");
        socket.emit('createRoom', { roomName: newRoomName, playerName });
    };

    const joinRoom = (id) => {
        if (!playerName.trim()) return alert("Önce ismini gir!");
        socket.emit('joinRoom', { roomId: id, playerName });
        setGameState('waiting');
    };

    const startGame = () => socket.emit('startGame', room.id);

    const rollDice = () => {
        if (room.players[room.currentTurn].id !== socket.id || diceRolling) return;
        socket.emit('makeMove', { roomId: room.id, action: { type: 'START_ROLL' } });
        setDiceRolling(true);
        playAudio('dice');
        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const total = d1 + d2;
            const player = room.players[room.currentTurn];
            const newPos = (player.position + total) % 56;
            socket.emit('makeMove', {
                roomId: room.id, action: {
                    type: 'MOVE_PLAYER', playerId: player.id, newPosition: newPos, passedStart: newPos < player.position, dice: [d1, d2]
                }
            });
        }, 1200);
    };

    const handleAction = (action) => {
        if (action.type === 'START_ROLL') {
            setDiceRolling(true);
            return;
        }

        setRoom(prevRoom => {
            if (!prevRoom) return prevRoom;
            const newRoom = JSON.parse(JSON.stringify(prevRoom));

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
                    playAudio('cash');
                }

                // SHARED DETERMINISTIC LOGIC (Rent, Tax, GoToJail)
                const tile = BOARD_TILES[action.newPosition];
                const owner = newRoom.players.find(p => p.properties.includes(tile.id));
                const buildings = newRoom.buildings || {};
                const level = buildings[tile.id] || 0;

                setChanceCard(null); // Clear old cards

                if (owner && owner.id !== player.id) {
                    let rent = tile.rent || 200000;
                    if (level > 0) rent = rent * (1 + level);
                    player.money -= rent;
                    owner.money += rent;
                    setMessage(`${player.name} -> ${owner.name} kira: ${rent.toLocaleString()}₺`);
                    playAudio('pay');
                } else if (tile.type === 'tax') {
                    let taxAmount = tile.price === 0 ? Math.floor((player.money + 5000000) * 0.1) : tile.price;
                    player.money -= taxAmount;
                    setMessage(`${player.name} Vergi: ${taxAmount.toLocaleString()}₺`);
                    playAudio('pay');
                } else if (tile.type === 'gotojail') {
                    player.position = 14;
                    setMessage(`${player.name} nezarethaneye gönderildi!`);
                    playAudio('jail');
                }

                // NON-DETERMINISTIC LOGIC (Chance)
                // Only Active Player initiates this
                if (player.id === socket.id) {
                    if (tile.type === 'chance' || tile.type === 'chest') {
                        const deck = tile.type === 'chance' ? CHANCE_CARDS : COMMUNITY_CHEST;
                        const card = deck[Math.floor(Math.random() * deck.length)];
                        // Emit Draw Action for synchronization
                        socket.emit('makeMove', {
                            roomId: room.id,
                            action: {
                                type: 'DRAW_CHANCE',
                                playerId: player.id,
                                card,
                                deckType: tile.type
                            }
                        });
                    } else if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
                        // Buy Logic UI Trigger
                        if (!owner) {
                            setCanBuy(player.money >= tile.price);
                            setCanBuild(false);
                            setTurnPhase('decision');
                        } else if (owner.id === player.id) {
                            const currentBuildLevel = (newRoom.buildings && newRoom.buildings[tile.id]) || 0;
                            if (currentBuildLevel < 5 && tile.housePrice && player.money >= tile.housePrice) {
                                setCanBuild(true);
                            } else setCanBuild(false);
                            setCanBuy(false);
                            setTurnPhase('decision');
                        }
                    }
                } else {
                    // Spectator messages
                    if (tile.type === 'start') setMessage(`${player.name} Başlangıç noktasında.`);
                    else if (!owner && !['chance', 'chest', 'tax', 'gotojail'].includes(tile.type)) setMessage(`${player.name} ilerliyor...`);
                }
            }
            if (action.type === 'DRAW_CHANCE') {
                const card = action.card;
                // Apply Effect
                setChanceCard({ ...card, title: action.deckType === 'chance' ? "ŞANS" : "KAMU FONU" });
                playAudio('alert');

                if (card.type === 'money') player.money += card.amount;
                if (card.type === 'move') player.position = card.target;
                if (card.type === 'step') player.position = (player.position + card.amount + 56) % 56;

                // Turn End Logic for Chance
                if (socket.id === action.playerId) {
                    setTimeout(() => endTurn(), 4000);
                }
            }
            if (action.type === 'BUY_PROPERTY') {
                const tile = BOARD_TILES[player.position];
                player.money -= tile.price;
                player.properties.push(tile.id);
                setMessage(`${player.name}, ${tile.name} mülkünü satın aldı!`);
                playAudio('buy');

                if (socket.id === action.playerId) {
                    const groupProperties = BOARD_TILES.filter(t => t.group === tile.group);
                    const ownsAll = groupProperties.every(t => player.properties.includes(t.id));
                    if (ownsAll && tile.housePrice && player.money >= tile.housePrice) {
                        setCanBuild(true);
                        setTurnPhase('decision');
                        setMessage("Tüm seti topladın! Hemen bina dikmek ister misin? 🏠");
                        playAudio('alert');
                    } else {
                        handlePostMove(false);
                    }
                }
            }
            if (action.type === 'BUILD_HOUSE') {
                if (!newRoom.buildings) newRoom.buildings = {};
                const currentLevel = newRoom.buildings[action.tileId] || 0;
                newRoom.buildings[action.tileId] = currentLevel + 1;
                player.money -= action.cost;
                playAudio('build');
                if (socket.id === action.playerId) handlePostMove(false);
            }
            if (action.type === 'END_TURN') {
                let nextTurn = (newRoom.currentTurn + 1) % newRoom.players.length;
                let sanity = 0;
                while (newRoom.players[nextTurn].bankrupt && sanity < 10) {
                    nextTurn = (nextTurn + 1) % newRoom.players.length;
                    sanity++;
                }
                newRoom.currentTurn = nextTurn;
            }
            return newRoom;
        });
    };

    const handlePostMove = (doubles) => {
        const dice = lastDice;
        const isDoubles = dice[0] === dice[1];
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
        socket.emit('makeMove', { roomId: room.id, action: { type: 'BUY_PROPERTY', playerId: player.id } });
        setCanBuy(false);
    };

    const buildHouse = () => {
        const player = room.players[room.currentTurn];
        const tile = BOARD_TILES[player.position];
        socket.emit('makeMove', {
            roomId: room.id,
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
        socket.emit('makeMove', { roomId: room.id, action: { type: 'END_TURN', playerId: socket.id } });
        setTurnPhase('roll');
        setCanBuy(false);
        setCanBuild(false);
        setRolledDoubles(false);
    };

    const toggleView = () => setViewMode(prev => prev === '3d' ? 'top' : '3d');

    const handleTradeClick = (targetPlayer) => {
        if (targetPlayer.id === socket.id) return;
        setTradeTarget(targetPlayer);
        setShowTradeModal(true);
    };

    const submitTrade = (e) => {
        e.preventDefault();
        socket.emit('proposeTrade', {
            roomId: room.id,
            tradeData: {
                fromPlayerId: socket.id,
                toPlayerId: tradeTarget.id,
                offer: { money: 1000000, properties: [] },
                request: { money: 0, properties: [] }
            }
        });
        setShowTradeModal(false);
        setMessage("Takas teklifi gönderildi.");
    };

    // --- RENDER ---
    if (gameState === 'lobby' || gameState === 'waiting') {
        return (
            <div className="scene-container overflow-auto lobby-bg">
                <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=2800&auto=format&fit=crop)' }}></div>
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="glass p-16 w-full max-w-4xl text-center rounded-[60px] border border-white/10 shadow-2xl relative z-10 backdrop-blur-xl">
                    <h1 className="text-8xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-lg">
                        EMLAK KRALI <span className="text-white text-5xl block mt-2">TÜRKİYE</span>
                    </h1>

                    {gameState === 'lobby' && (
                        <div className="flex flex-col items-center gap-6 w-full">
                            <input type="text" placeholder="İsmin nedir?" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-1/2 bg-black/50 border border-indigo-500/30 rounded-2xl px-6 py-4 text-white text-2xl font-bold text-center focus:outline-none focus:ring-4 focus:ring-indigo-500/50 mb-4" />

                            {!showCreateModal ? (
                                <>
                                    <div className="flex justify-between w-full items-center mb-4">
                                        <h2 className="text-2xl font-bold text-white">Açık Odalar</h2>
                                        <button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold transition-all">
                                            + ODA OLUŞTUR
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[400px] overflow-y-auto">
                                        {roomList.length === 0 && <p className="text-slate-400 col-span-2 text-xl">Henüz açık oda yok. İlk odayı sen kur!</p>}
                                        {roomList.map(r => (
                                            <div key={r.id} onClick={() => joinRoom(r.id)} className="bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-xl cursor-pointer transition-all flex justify-between items-center group">
                                                <div className="text-left">
                                                    <h3 className="text-xl font-bold text-indigo-300 group-hover:text-white transition-colors">{r.name}</h3>
                                                    <p className="text-xs text-slate-400">Kurucu: {r.hostName}</p>
                                                </div>
                                                <span className="bg-black/40 px-3 py-1 rounded text-sm font-mono">{r.playerCount}/{r.maxPlayers}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="bg-black/40 p-8 rounded-3xl w-full max-w-md border border-white/10">
                                    <h2 className="text-3xl font-bold mb-6">Oda Oluştur</h2>
                                    <input type="text" placeholder="Oda Adı" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-6" />
                                    <div className="flex gap-4">
                                        <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold">İptal</button>
                                        <button onClick={createRoom} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold">OLUŞTUR</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {gameState === 'waiting' && <div className="w-full mt-8">
                        <h2 className="text-4xl font-bold text-white mb-2">{room?.name}</h2>
                        <p className="text-slate-400 mb-8">Oyuncular bekleniyor... ({room?.players.length}/{room?.maxPlayers})</p>

                        <div className="grid grid-cols-2 gap-4 w-full mb-8">
                            {room?.players.map((p, i) => (
                                <motion.div key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden">
                                    {i === 0 && <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] px-2 font-bold">HOST</div>}
                                    <div className="w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white text-xl font-black" style={{ backgroundColor: p.color }}>{p.name[0]}</div>
                                    <span className="text-xl font-bold truncate">{p.name}</span>
                                </motion.div>
                            ))}
                        </div>

                        {room?.hostId === socket.id ? (
                            <button onClick={startGame} className="btn-luxury w-full py-6 text-2xl bg-indigo-600 border-indigo-800 hover:bg-indigo-500">OYUNU BAŞLAT 🚀</button>
                        ) : (
                            <p className="text-center text-slate-400 font-bold text-xl animate-pulse">Kurucunun oyunu başlatması bekleniyor...</p>
                        )}
                    </div>}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="scene-container">
            {winner && (
                <div className="game-over-screen">
                    <div className="winner-crown">👑</div>
                    <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 mb-4">KAZANAN</h1>
                    <h2 className="text-6xl text-white font-bold">{winner.name}</h2>
                    <p className="mt-8 text-2xl opacity-70">Tüm Türkiye'nin Emlak Kralı!</p>
                </div>
            )}

            {room?.players.find(p => p.id === socket.id)?.bankrupt && (
                <div className="bankruptcy-overlay">
                    İFLAS ETTİNİZ
                </div>
            )}

            <button key="viewToggle" onClick={toggleView} className="view-toggle-btn">
                {viewMode === '3d' ? <><Map size={20} /> KUŞ BAKIŞI</> : <><Eye size={20} /> 3D GÖRÜNÜM</>}
            </button>

            {message && !winner && <div className="absolute top-8 right-8 glass p-4 rounded-2xl max-w-xs border-l-4 border-indigo-500 z-[2000] text-white font-bold text-center shadow-2xl">{message}</div>}

            <ChatSystem room={room} socket={socket} playerId={socket.id} />

            {tradeProposal && (
                <div className="modal-overlay">
                    <div className="glass p-8 rounded-3xl max-w-md w-full text-center border border-indigo-500">
                        <h3 className="text-2xl text-white font-bold mb-4">Takas Teklifi!</h3>
                        <p className="text-slate-300 mb-6">Bir oyuncu sana takas teklif etti.</p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => { socket.emit('respondTrade', { roomId: room.id, accepted: true, tradeData: tradeProposal }); setTradeProposal(null); }} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">Kabul Et</button>
                            <button onClick={() => { socket.emit('respondTrade', { roomId: room.id, accepted: false, tradeData: tradeProposal }); setTradeProposal(null); }} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold">Reddet</button>
                        </div>
                    </div>
                </div>
            )}

            {showTradeModal && (
                <div className="modal-overlay">
                    <div className="glass p-6 rounded-3xl text-center">
                        <h3 className="text-white text-xl mb-4">{tradeTarget?.name} ile Takas</h3>
                        <p className="text-slate-400 text-sm mb-4">(Hızlı Takas: Şuan sadece para/hediye)</p>
                        <button onClick={submitTrade} className="bg-indigo-600 px-6 py-2 rounded-xl text-white font-bold mr-2">1M Gönder (Test)</button>
                        <button onClick={() => setShowTradeModal(false)} className="bg-slate-700 px-6 py-2 rounded-xl text-white">İptal</button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {chanceCard && (
                    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="absolute inset-0 z-[2500] flex items-center justify-center pointer-events-none">
                        <div className="bg-white text-black p-8 rounded-3xl shadow-2xl max-w-sm text-center border-4 border-indigo-600 pointer-events-auto transform rotate-[-2deg]">
                            <h2 className="text-3xl font-black mb-4 tracking-tight text-indigo-700">{chanceCard.title}</h2>
                            <p className="text-xl font-bold mb-6">{chanceCard.text}</p>
                            {chanceCard.amount && <div className={`text-2xl font-black ${chanceCard.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {chanceCard.amount > 0 ? '+' : ''}{chanceCard.amount.toLocaleString()}₺
                            </div>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {hoveredTile && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute key-tooltip z-[3000]">
                        <div className="glass px-6 py-4 rounded-xl border border-white/20 text-center text-white pointer-events-none min-w-[220px] backdrop-blur-md bg-black/80 custom-tooltip">
                            <h3 className="font-black text-xl mb-2 text-indigo-300">{hoveredTile.name}</h3>
                            {hoveredTile.type === 'property' && (
                                <div className="space-y-2 text-sm font-medium">
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span className="text-slate-400">Arsa Değeri:</span>
                                        <span className="text-emerald-400 font-mono">{hoveredTile.price?.toLocaleString()}₺</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Kira Geliri:</span>
                                        <span className="text-amber-400 font-mono">{hoveredTile.rent?.toLocaleString()}₺</span>
                                    </div>
                                    {hoveredTile.housePrice && (
                                        <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                                            <span className="text-slate-400">Ev Maliyeti:</span>
                                            <span className="text-blue-400 font-mono">{hoveredTile.housePrice?.toLocaleString()}₺</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {(tile => {
                                if (tile.type === 'start') return <p className="text-green-400 text-xs">Buradan her geçişte 2M₺ alırsın.</p>;
                                if (tile.type === 'jail') return <p className="text-orange-400 text-xs">Sadece ziyaretçisin.</p>;
                                if (tile.type === 'parking') return <p className="text-blue-400 text-xs">Güvenli bölge.</p>;
                                if (tile.type === 'gotojail') return <p className="text-red-400 text-xs">Doğrudan hapse!</p>;
                                if (tile.type === 'station') return <p className="text-purple-400 text-xs">TCDD İstasyonu.</p>;
                                return null;
                            })(hoveredTile)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="players-3d-list">
                {room?.players.map((p, i) => (
                    <div key={p.id} className={`player-3d-card ${room.currentTurn === i ? 'active turn-pulse' : ''} ${p.bankrupt ? 'opacity-30 grayscale' : ''}`}>
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <div className="player-avatar" style={{ backgroundColor: p.color, color: 'white' }}>{p.name[0]}</div>
                        </div>
                        <div className="player-info">
                            <span className="player-name">{p.name} {p.bankrupt && '(İFLAS)'}</span>
                            <div className="player-money">
                                <Wallet size={14} className="text-emerald-400" /> {(p.money / 1000000).toFixed(1)}M
                            </div>
                        </div>
                        {!p.bankrupt && p.id !== socket.id && (
                            <button onClick={() => handleTradeClick(p)} className="p-2 ml-auto bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors" title="Takas Yap">
                                <Repeat size={16} color="white" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className={`board-3d-system ${viewMode === 'top' ? 'top-down-mode' : ''}`}>
                <div className="board expanded-board">
                    {BOARD_TILES.map((tile, i) => {
                        let row, col;
                        if (i <= 14) { row = 15; col = 15 - i; }
                        else if (i <= 28) { row = 29 - i; col = 1; }
                        else if (i <= 42) { row = 1; col = i - 27; }
                        else { row = i - 41; col = 15; }

                        const owner = room?.players.find(p => p.properties.includes(tile.id));
                        const buildLevel = room?.buildings ? room.buildings[tile.id] : 0;

                        return (
                            <div
                                key={i}
                                className={`tile ${owner ? 'owned-tile' : ''}`}
                                style={{ gridRow: row, gridColumn: col, borderColor: owner ? owner.color : undefined }}
                                onMouseEnter={() => setHoveredTile(tile)}
                                onMouseLeave={() => setHoveredTile(null)}
                            >
                                {tile.color && <div className="tile-header" style={{ backgroundColor: tile.color }} />}
                                <div className="tile-content">
                                    <span className="tile-name">{tile.name}</span>
                                    {tile.price && <span className="tile-price">{(tile.price / 1000000).toFixed(1)}M</span>}
                                    {owner && <div className="absolute top-1 right-1 w-3 h-3 rounded-full shadow-lg border border-white" style={{ backgroundColor: owner.color }} />}
                                </div>
                                {buildLevel > 0 && <Building3D level={buildLevel} />}
                                {i === 0 && <CornerStatue type="start" />}
                                {i === 14 && <CornerStatue type="jail" />}
                                {i === 28 && <CornerStatue type="parking" />}
                                {i === 42 && <CornerStatue type="gotojail" />}
                                <div className="absolute inset-0 flex items-center justify-center z-20">
                                    <AnimatePresence>
                                        {room?.players.filter(p => p.position === i).map(p => (
                                            <div key={p.id} className="relative w-full h-full flex items-center justify-center player-token-container">
                                                {/* Use Three.js Model */}
                                                <div style={{ transform: 'translateY(-30px) scale(1.5)', zIndex: 50 }}>
                                                    <ThreePlayer color={p.color} isCurrent={room.players[room.currentTurn].id === p.id} />
                                                </div>
                                                {/* Fallback Name Tag */}
                                                {room.players[room.currentTurn].id === p.id && (
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-white font-bold text-[10px] bg-indigo-600 px-2 py-0.5 rounded shadow-lg animate-bounce z-[100] whitespace-nowrap border border-white/20">
                                                        BEN
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                    <div className="board-center expanded-center cursor-pointer group hover:bg-white/5 transition-colors" onClick={toggleView}>
                        <div className="flex gap-16 items-center scale-150 pointer-events-none">
                            <Dice3D value={lastDice[0]} rolling={diceRolling} />
                            <Dice3D value={lastDice[1]} rolling={diceRolling} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="controls-bottom">
                {!winner && room?.players[room?.currentTurn].id === socket.id && turnPhase === 'roll' && (
                    <button onClick={rollDice} disabled={diceRolling} className="btn-luxury px-8 py-4 text-xl">
                        {rolledDoubles ? "ÇİFT! TEKRAR AT" : "ZARI AT"}
                    </button>
                )}

                {!winner && room?.players[room?.currentTurn].id === socket.id && turnPhase === 'decision' && (
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
