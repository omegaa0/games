import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice5, User, DollarSign, LogOut, PlayCircle, Wallet, Map, Eye, Send, Repeat, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BOARD_TILES, CHANCE_CARDS, COMMUNITY_CHEST } from './data/boardData';
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
        <div className="scene scale-75">
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

const Character3D = ({ color, name, isCurrent }) => (
    <div className="character-3d" style={{ '--char-color': color }}>
        <div className="char-head" style={{ backgroundColor: color }}></div>
        <div className="char-body" style={{ backgroundColor: color }}></div>
        {isCurrent && <div className="absolute -top-14 left-1/2 -translate-x-1/2 text-white font-bold text-xs bg-indigo-600 px-3 py-1 rounded-full whitespace-nowrap animate-bounce z-50 border border-white/30 shadow-lg">BEN</div>}
    </div>
);

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
    const [roomList, setRoomList] = useState([]);
    const [playerName, setPlayerName] = useState('');
    const [diceRolling, setDiceRolling] = useState(false);
    const [lastDice, setLastDice] = useState([1, 1]);
    const [message, setMessage] = useState('');
    const [turnPhase, setTurnPhase] = useState('roll');
    const [rolledDoubles, setRolledDoubles] = useState(false);
    const [canBuy, setCanBuy] = useState(false);
    const [canBuild, setCanBuild] = useState(false);
    const [viewMode, setViewMode] = useState('3d');

    // Trade State
    const [tradeProposal, setTradeProposal] = useState(null);
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [tradeStep, setTradeStep] = useState(1);
    const [tradeTarget, setTradeTarget] = useState(null);
    const [offerMoney, setOfferMoney] = useState(0);
    const [requestMoney, setRequestMoney] = useState(0);
    const [offerProps, setOfferProps] = useState([]);
    const [requestProps, setRequestProps] = useState([]);

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
                // 'payall' logic omitted for brevity in this step, requires complex flow

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

    // --- TRADE LOGIC ---

    const openTradeModal = () => {
        setTradeStep(1);
        setTradeTarget(null);
        setOfferMoney(0);
        setRequestMoney(0);
        setOfferProps([]);
        setRequestProps([]);
        setShowTradeModal(true);
    };

    const toggleOfferProp = (id) => {
        setOfferProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleRequestProp = (id) => {
        setRequestProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const submitTrade = () => {
        if (!tradeTarget) return;
        socket.emit('proposeTrade', {
            roomId: room.id,
            tradeData: {
                fromPlayerId: socket.id,
                toPlayerId: tradeTarget.id,
                offer: { money: offerMoney, properties: offerProps },
                request: { money: requestMoney, properties: requestProps }
            }
        });
        setShowTradeModal(false);
        setMessage("Takas teklifi gönderildi.");
    };

    // --- RENDER ---
    if (gameState === 'lobby' || gameState === 'waiting') {
        return (
            <div className="scene-container overflow-auto lobby-bg flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="lobby-card p-12 w-full max-w-5xl text-center"
                >
                    <div className="logo-container">
                        <div className="logo-emblem text-9xl mb-4">👑</div>
                        <h1 className="lobby-title">EMLAK KRALI</h1>
                        <p className="text-2xl text-indigo-300 font-light tracking-[0.5em] mt-2">TÜRKİYE EDİSYONU</p>
                    </div>

                    {gameState === 'lobby' && (
                        <div className="flex flex-col items-center gap-8 w-full">
                            <div className="modern-input-group">
                                <User className="input-icon" size={24} />
                                <input
                                    type="text"
                                    placeholder="Oyuncu İsminiz..."
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    className="modern-input"
                                />
                            </div>

                            {!showCreateModal ? (
                                <div className="w-full bg-black/20 p-8 rounded-3xl border border-white/5">
                                    <div className="flex justify-between w-full items-center mb-6">
                                        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                                            Açık Odalar
                                        </h2>
                                        <button onClick={() => setShowCreateModal(true)} className="action-btn create-room-btn flex items-center gap-2">
                                            <span>+</span> YENİ MASAYA OTUR
                                        </button>
                                    </div>

                                    <div className="room-grid max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {roomList.length === 0 && (
                                            <div className="col-span-full py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl">
                                                <p className="text-xl">Henüz oyun kurulu değil.</p>
                                                <p className="text-sm mt-2">İlk masayı sen kur!</p>
                                            </div>
                                        )}
                                        {roomList.map(r => (
                                            <div key={r.id} onClick={() => joinRoom(r.id)} className="room-card group">
                                                <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">{r.name}</h3>
                                                <div className="flex justify-between w-full mt-4 items-end">
                                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                                        <User size={14} />
                                                        {r.hostName}
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${r.playerCount >= r.maxPlayers ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                        {r.playerCount}/{r.maxPlayers} Oyuncu
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-slate-900 to-indigo-950 p-10 rounded-3xl w-full max-w-lg border border-indigo-500/30 shadow-2xl">
                                    <h2 className="text-3xl font-bold mb-8 text-white">Yeni Masa Kur</h2>
                                    <div className="modern-input-group w-full mb-8">
                                        <Map className="input-icon" size={24} />
                                        <input
                                            type="text"
                                            placeholder="Masa Adı (Örn: İstanbul Keyfi)"
                                            value={newRoomName}
                                            onChange={(e) => setNewRoomName(e.target.value)}
                                            className="modern-input"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => setShowCreateModal(false)} className="action-btn bg-slate-700 hover:bg-slate-600 flex-1 !bg-none bg-slate-700">İptal</button>
                                        <button onClick={createRoom} className="action-btn flex-1">MASAYI KUR</button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {gameState === 'waiting' && <div className="w-full mt-8">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <h2 className="text-5xl font-black text-white">{room?.name}</h2>
                            <span className="bg-indigo-600 px-3 py-1 rounded text-sm font-bold text-white/80 tracking-widest">BEKLEME SALONU</span>
                        </div>
                        <p className="text-indigo-300 mb-12 text-xl">Oyuncular toplanıyor... ({room?.players.length}/{room?.maxPlayers})</p>

                        <div className="flex flex-wrap justify-center gap-8 mb-12">
                            {room?.players.map((p, i) => (
                                <motion.div key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 relative group">
                                    {i === 0 && <div className="absolute -top-6 bg-amber-500 text-black text-xs px-3 py-1 rounded-full font-black shadow-lg shadow-amber-500/50 z-20">KURUCU</div>}
                                    <div className="wait-avatar relative" style={{ backgroundColor: p.color }}>
                                        {p.name[0]}
                                        <div className="absolute inset-0 border-2 border-white/20 rounded-[18px]"></div>
                                    </div>
                                    <span className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">{p.name}</span>
                                </motion.div>
                            ))}
                        </div>

                        {room?.hostId === socket.id ? (
                            <button onClick={startGame} className="action-btn text-2xl px-12 py-4 animate-pulse shadow-[0_0_50px_rgba(79,70,229,0.5)]">
                                OYUNU BAŞLAT 🚀
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-2 p-6 bg-white/5 rounded-2xl border border-white/5 animate-pulse">
                                <div className="text-2xl font-bold text-white">Kurucu Bekleniyor...</div>
                                <p className="text-slate-400">Oyun kurucu oyunu başlattığında otomatik olarak masaya alınacaksınız.</p>
                            </div>
                        )}
                    </div>}
                </motion.div>
            </div>
        );
    }

    const currentPlayer = room?.players.find(p => p.id === socket.id);
    const availablePlayers = room?.players.filter(p => p.id !== socket.id && !p.bankrupt);

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

            {currentPlayer?.bankrupt && (
                <div className="bankruptcy-overlay">İFLAS ETTİNİZ</div>
            )}

            <button key="viewToggle" onClick={toggleView} className="view-toggle-btn">
                {viewMode === '3d' ? <><Map size={20} /> KUŞ BAKIŞI</> : <><Eye size={20} /> 3D GÖRÜNÜM</>}
            </button>

            {message && !winner && <div className="absolute top-8 right-8 glass p-4 rounded-2xl max-w-xs border-l-4 border-indigo-500 z-[2000] text-white font-bold text-center shadow-2xl">{message}</div>}

            <ChatSystem room={room} socket={socket} playerId={socket.id} />

            {/* --- TRADE PROPOSAL RECEIVED MODAL --- */}
            {tradeProposal && (
                <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-8 rounded-[40px] max-w-4xl w-full text-center border border-white/10 shadow-2xl bg-[#0f172a]/80">
                        <div className="flex items-center justify-center gap-4 mb-8">
                            <h3 className="text-4xl text-white font-black tracking-tight">🤝 YENİ TAKAS TEKLİFİ</h3>
                            <span className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold text-white">BEKLİYOR</span>
                        </div>

                        <p className="text-slate-300 mb-8 text-xl font-light">
                            <span className="font-bold text-white text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">{room.players.find(p => p.id === tradeProposal.fromPlayerId)?.name}</span> seninle bir anlaşma yapmak istiyor:
                        </p>

                        <div className="flex flex-col md:flex-row gap-8 mb-10">
                            {/* ALACAKLARIN */}
                            <div className="flex-1 bg-gradient-to-b from-emerald-900/40 to-emerald-900/10 p-6 rounded-3xl border border-emerald-500/30 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                                <h4 className="text-emerald-400 font-black text-2xl mb-6 flex items-center justify-center gap-2">
                                    <span className="text-3xl">📥</span> KAZANCIN
                                </h4>
                                <div className="space-y-4 min-h-[150px] flex flex-col justify-center">
                                    {tradeProposal.offer.money > 0 && (
                                        <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                                            <span className="text-emerald-300 font-bold">NAKİT PARA</span>
                                            <span className="font-mono text-2xl font-black text-white">{tradeProposal.offer.money.toLocaleString()}₺</span>
                                        </div>
                                    )}
                                    {tradeProposal.offer.properties.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {tradeProposal.offer.properties.map(pid => {
                                                const t = BOARD_TILES.find(x => x.id === pid);
                                                return <div key={pid} className="bg-white/5 p-2 rounded-lg text-white font-bold text-sm border-l-4" style={{ borderLeftColor: t.color }}>{t.name}</div>
                                            })}
                                        </div>
                                    ) : (tradeProposal.offer.money === 0 && <p className="text-slate-500 italic">Mülk veya para teklif edilmedi.</p>)}
                                </div>
                            </div>

                            {/* VERECEKLERİN */}
                            <div className="flex-1 bg-gradient-to-b from-red-900/40 to-red-900/10 p-6 rounded-3xl border border-red-500/30 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                                <h4 className="text-red-400 font-black text-2xl mb-6 flex items-center justify-center gap-2">
                                    <span className="text-3xl">📤</span> KAYBIN
                                </h4>
                                <div className="space-y-4 min-h-[150px] flex flex-col justify-center">
                                    {tradeProposal.request.money > 0 && (
                                        <div className="bg-red-500/20 p-4 rounded-xl border border-red-500/20 flex items-center justify-between">
                                            <span className="text-red-300 font-bold">ÖDEYECEĞİN</span>
                                            <span className="font-mono text-2xl font-black text-white">{tradeProposal.request.money.toLocaleString()}₺</span>
                                        </div>
                                    )}
                                    {tradeProposal.request.properties.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {tradeProposal.request.properties.map(pid => {
                                                const t = BOARD_TILES.find(x => x.id === pid);
                                                return <div key={pid} className="bg-white/5 p-2 rounded-lg text-white font-bold text-sm border-l-4" style={{ borderLeftColor: t.color }}>{t.name}</div>
                                            })}
                                        </div>
                                    ) : (tradeProposal.request.money === 0 && <p className="text-slate-500 italic">Hiçbir şey talep edilmedi (Hediyelik).</p>)}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-6 justify-center">
                            <button onClick={() => { socket.emit('respondTrade', { roomId: room.id, accepted: true, tradeData: tradeProposal }); setTradeProposal(null); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-black text-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✓</div> KABUL ET
                            </button>
                            <button onClick={() => { socket.emit('respondTrade', { roomId: room.id, accepted: false, tradeData: tradeProposal }); setTradeProposal(null); }} className="bg-rose-600 hover:bg-rose-500 text-white px-12 py-4 rounded-2xl font-black text-xl shadow-lg shadow-rose-600/20 transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-3">
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">✕</div> REDDET
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* --- CREATE TRADE MODAL --- */}
            {showTradeModal && (
                <div className="absolute inset-0 z-[4000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-[32px] w-full max-w-6xl h-[90vh] flex flex-col relative shadow-2xl border border-white/5 bg-[#0f172a] overflow-hidden">

                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
                            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <span className="bg-gradient-to-r from-indigo-500 to-purple-600 w-10 h-10 rounded-xl flex items-center justify-center text-xl">🤝</span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">TAKAS</span> MERKEZİ
                            </h2>
                            <button onClick={() => setShowTradeModal(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"><X size={20} /></button>
                        </div>

                        {tradeStep === 1 && (
                            <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8">
                                <div className="text-center space-y-2">
                                    <h3 className="text-4xl font-bold text-white">Ticaret Ortağını Seç</h3>
                                    <p className="text-slate-400 text-lg">Müzakere masasına kimi davet etmek istiyorsun?</p>
                                </div>
                                <div className="flex gap-8 flex-wrap justify-center w-full max-w-4xl">
                                    {availablePlayers?.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { setTradeTarget(p); setTradeStep(2); }}
                                            className="group relative flex flex-col items-center gap-4 p-8 bg-slate-800/50 hover:bg-slate-800 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all hover:scale-105 active:scale-95 w-48"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity" />
                                            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white shadow-2xl transition-transform group-hover:-translate-y-2" style={{ backgroundColor: p.color, boxShadow: `0 10px 30px -10px ${p.color}` }}>
                                                {p.name[0]}
                                            </div>
                                            <div className="text-center z-10">
                                                <span className="block font-bold text-white text-xl mb-1 group-hover:text-indigo-300">{p.name}</span>
                                                <span className="text-xs text-slate-400 font-mono">{(p.money / 1000000).toFixed(2)}M ₺</span>
                                            </div>
                                        </button>
                                    ))}
                                    {availablePlayers?.length === 0 && (
                                        <div className="p-12 border-2 border-dashed border-slate-700 rounded-3xl text-slate-500 flex flex-col items-center gap-4">
                                            <User size={48} className="opacity-50" />
                                            <span>Takas yapılabilecek başka oyuncu yok.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {tradeStep === 2 && tradeTarget && (
                            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
                                {/* LEFT: YOU */}
                                <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 bg-gradient-to-b from-slate-900/50 to-slate-900/30">
                                    <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg" style={{ backgroundColor: currentPlayer.color }}>{currentPlayer.name[0]}</div>
                                        <div className="flex-1">
                                            <h4 className="text-emerald-400 font-bold text-lg tracking-wide">TEKLİFİN</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Wallet size={12} /> Bakiye: <span className="text-white font-mono">{(currentPlayer.money).toLocaleString()}₺</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <label className="text-[10px] font-bold text-emerald-500 uppercase block mb-1">Eklenecek Tutar</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0" max={currentPlayer.money} step="50000"
                                                    value={offerMoney}
                                                    onChange={(e) => setOfferMoney(Math.min(currentPlayer.money, Math.max(0, Number(e.target.value))))}
                                                    className="w-40 bg-slate-950 border border-slate-700 rounded-lg py-2 pl-3 pr-8 text-right text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-500 pointer-events-none">₺</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 sticky top-0 bg-slate-900/95 py-2 z-10 w-full backdrop-blur">Mülk Portföyü</h5>
                                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                            {currentPlayer.properties.length === 0 && <div className="col-span-full py-12 text-center text-slate-600 italic">Mülk bulunmuyor.</div>}
                                            {currentPlayer.properties.map(pid => {
                                                const tile = BOARD_TILES.find(t => t.id === pid);
                                                const selected = offerProps.includes(pid);
                                                return (
                                                    <div
                                                        key={pid}
                                                        onClick={() => toggleOfferProp(pid)}
                                                        className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 group overflow-hidden ${selected ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-500'}`}
                                                    >
                                                        <div className="h-2 w-8 rounded-full mb-3" style={{ backgroundColor: tile.color }} />
                                                        <div className="font-bold text-white text-sm mb-1 line-clamp-1">{tile.name}</div>
                                                        <div className="text-xs text-emerald-400 font-mono">{tile.price.toLocaleString()}₺</div>
                                                        {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"><span className="text-black text-[10px] font-bold">✓</span></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: THEM */}
                                <div className="flex flex-col bg-gradient-to-b from-slate-900/50 to-slate-900/30">
                                    <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg grayscale opacity-80" style={{ backgroundColor: tradeTarget.color }}>{tradeTarget.name[0]}</div>
                                        <div className="flex-1">
                                            <h4 className="text-amber-400 font-bold text-lg tracking-wide">TALEBİN</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Wallet size={12} /> Bakiye: <span className="text-white font-mono">{(tradeTarget.money).toLocaleString()}₺</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <label className="text-[10px] font-bold text-amber-500 uppercase block mb-1">İstenecek Tutar</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0" max={tradeTarget.money} step="50000"
                                                    value={requestMoney}
                                                    onChange={(e) => setRequestMoney(Math.min(tradeTarget.money, Math.max(0, Number(e.target.value))))}
                                                    className="w-40 bg-slate-950 border border-slate-700 rounded-lg py-2 pl-3 pr-8 text-right text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
                                                />
                                                <span className="absolute right-3 top-2 text-slate-500 pointer-events-none">₺</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 sticky top-0 bg-slate-900/95 py-2 z-10 w-full backdrop-blur">Hedef Mülkler</h5>
                                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                            {tradeTarget.properties.length === 0 && <div className="col-span-full py-12 text-center text-slate-600 italic">Mülk bulunmuyor.</div>}
                                            {tradeTarget.properties.map(pid => {
                                                const tile = BOARD_TILES.find(t => t.id === pid);
                                                const selected = requestProps.includes(pid);
                                                return (
                                                    <div
                                                        key={pid}
                                                        onClick={() => toggleRequestProp(pid)}
                                                        className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 group overflow-hidden ${selected ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-500'}`}
                                                    >
                                                        <div className="h-2 w-8 rounded-full mb-3" style={{ backgroundColor: tile.color }} />
                                                        <div className="font-bold text-white text-sm mb-1 line-clamp-1">{tile.name}</div>
                                                        <div className="text-xs text-amber-400 font-mono">{tile.price.toLocaleString()}₺</div>
                                                        {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg"><span className="text-black text-[10px] font-bold">✓</span></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tradeStep === 2 && (
                            <div className="p-6 border-t border-white/10 bg-slate-900/80 backdrop-blur flex justify-between items-center">
                                <button onClick={() => setTradeStep(1)} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                                    ← Oyuncu Seçimi
                                </button>
                                <div className="flex gap-4">
                                    <div className="text-right mr-4 hidden md:block">
                                        <div className="text-xs text-slate-400">Özet</div>
                                        <div className="text-sm font-bold text-white">
                                            {offerProps.length} Mülk + {offerMoney > 0 ? 'Para' : ''}  ➡  {requestProps.length} Mülk + {requestMoney > 0 ? 'Para' : ''}
                                        </div>
                                    </div>
                                    <button onClick={submitTrade} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-10 py-4 rounded-xl font-black text-lg shadow-xl shadow-indigo-600/30 transition-transform hover:scale-105 active:scale-95 flex items-center gap-3">
                                        TEKLİFİ GÖNDER <Send size={20} className="stroke-[3]" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
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
                    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="fixed z-[9999]" style={{ right: '40px', top: '50%', transform: 'translateY(-50%)' }}>
                        <div className="glass px-6 py-6 rounded-2xl border border-white/20 text-center text-white pointer-events-none min-w-[350px] backdrop-blur-xl bg-slate-900/95 shadow-2xl">
                            <h3 className="font-black text-3xl mb-4 text-indigo-300 border-b border-white/10 pb-2 tracking-wide drop-shadow-md">{hoveredTile.name}</h3>
                            {hoveredTile.type === 'property' && (
                                <div className="space-y-3 text-base font-medium">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>Arsa Değeri</span>
                                        <span className="text-emerald-400 font-mono text-lg">{hoveredTile.price?.toLocaleString()}₺</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 bg-white/5 p-2 rounded-lg">
                                        <span>KİRA GELİRİ</span>
                                        <span className="text-amber-400 font-mono text-xl font-bold">{hoveredTile.rent?.toLocaleString()}₺</span>
                                    </div>
                                    {hoveredTile.housePrice && (
                                        <div className="flex justify-between items-center text-slate-400 text-sm mt-2 pt-2 border-t border-white/10">
                                            <span>Ev Maliyeti</span>
                                            <span className="text-blue-400 font-mono">{hoveredTile.housePrice?.toLocaleString()}₺</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {(tile => {
                                if (tile.type === 'start') return <p className="text-green-400 font-bold">Buradan her geçişte 2M₺ alırsın.</p>;
                                if (tile.type === 'jail') return <p className="text-orange-400 font-bold">Sadece ziyaretçisin.</p>;
                                if (tile.type === 'parking') return <p className="text-blue-400 font-bold">Güvenli bölge.</p>;
                                if (tile.type === 'gotojail') return <p className="text-red-400 font-black">Doğrudan hapse!</p>;
                                if (tile.type === 'station') return <p className="text-purple-400 font-bold">TCDD İstasyonu.</p>;
                                if (tile.type === 'tax') return <p className="text-red-500 font-black text-lg">Ödenecek: {tile.price?.toLocaleString()}₺</p>;
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
                                    {![0, 14, 28, 42].includes(i) && <span className="tile-name">{tile.name}</span>}
                                    {tile.price && <span className="tile-price">{(tile.price / 1000000).toFixed(1)}M</span>}
                                    {tile.type === 'tax' && <span className="tile-price text-red-500 font-bold">{tile.price ? (tile.price / 1000000).toFixed(1) + 'M' : '0'}</span>}
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
                                                <Character3D color={p.color} name={p.name} isCurrent={room.players[room.currentTurn].id === p.id} />
                                            </div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        );
                    })}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group hover:scale-105 transition-transform" onClick={toggleView}>
                        <div className="flex gap-4 items-center scale-150">
                            <Dice3D value={lastDice[0]} rolling={diceRolling} />
                            <Dice3D value={lastDice[1]} rolling={diceRolling} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="controls-bottom">
                {!winner && room?.players[room?.currentTurn].id === socket.id && turnPhase === 'roll' && (
                    <div className="flex gap-4 items-center">
                        <button onClick={openTradeModal} className="btn-luxury bg-indigo-600 px-6 py-4 text-xl border-b-4 border-indigo-900 hover:border-indigo-800 flex items-center gap-2">
                            <Repeat size={24} /> TAKAS YAP
                        </button>
                        <button onClick={rollDice} disabled={diceRolling} className="btn-luxury px-8 py-4 text-xl flex-1 justify-center">
                            {rolledDoubles ? "ÇİFT! TEKRAR AT" : "ZARI AT"}
                        </button>
                    </div>
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

                {/* ALWAYS SHOWS TARGETED TRADE BUTTON WHEN NOT YOUR TURN (Spectator Trade) */}
                {!winner && room?.players[room?.currentTurn].id !== socket.id && (
                    <button onClick={openTradeModal} className="btn-luxury bg-indigo-600/50 hover:bg-indigo-600/80 px-4 py-2 text-sm border-b-0 absolute bottom-32 right-8 rounded-xl backdrop-blur-md">
                        🤝 TAKAS TEKLİF ET
                    </button>
                )}
            </div>
        </div>
    );
};

export default App;
