export const BOARD_TILES = [
    // BOTTOM ROW (0-14)
    { id: 0, name: "BAŞLANGIÇ", type: "start", color: "#ef4444" },
    { id: 1, name: "KİLİS", type: "property", price: 600000, rent: 30000, group: "brown", color: "#8b4513" },
    { id: 2, name: "OSMANİYE", type: "property", price: 600000, rent: 30000, group: "brown", color: "#8b4513" },
    { id: 3, name: "KAMU FONU", type: "chest" },
    { id: 4, name: "ŞANLIURFA", type: "property", price: 800000, rent: 40000, group: "brown", color: "#8b4513" },
    { id: 5, name: "GAZİANTEP", type: "property", price: 800000, rent: 40000, group: "brown", color: "#8b4513" },
    { id: 6, name: "GELİR VERGİSİ", type: "tax", price: 2000000 },
    { id: 7, name: "HAYDARPAŞA", type: "station", price: 2000000, rent: 250000 },
    { id: 8, name: "KARS", type: "property", price: 1000000, rent: 50000, group: "lightblue", color: "#87ceeb" },
    { id: 9, name: "AĞRI", type: "property", price: 1000000, rent: 50000, group: "lightblue", color: "#87ceeb" },
    { id: 10, name: "ŞANS", type: "chance" },
    { id: 11, name: "ERZİNCAN", type: "property", price: 1200000, rent: 60000, group: "lightblue", color: "#87ceeb" },
    { id: 12, name: "ERZURUM", type: "property", price: 1200000, rent: 60000, group: "lightblue", color: "#87ceeb" },
    { id: 13, name: "SİVAS", type: "property", price: 1400000, rent: 70000, group: "lightblue", color: "#87ceeb" },

    // LEFT ROW (14-28)
    { id: 14, name: "NEZARETHANE", type: "jail" },
    { id: 15, name: "ARTVİN", type: "property", price: 1400000, rent: 70000, group: "pink", color: "#ff69b4" },
    { id: 16, name: "RİZE", type: "property", price: 1500000, rent: 75000, group: "pink", color: "#ff69b4" },
    { id: 17, name: "TRABZON", type: "property", price: 1500000, rent: 75000, group: "pink", color: "#ff69b4" },
    { id: 18, name: "GİRESUN", type: "property", price: 1600000, rent: 80000, group: "pink", color: "#ff69b4" },
    { id: 19, name: "TEDAŞ", type: "utility", price: 1500000, icon: "zap" },
    { id: 20, name: "ORDU", type: "property", price: 1600000, rent: 80000, group: "pink", color: "#ff69b4" },
    { id: 21, name: "SAMSUN", type: "property", price: 1800000, rent: 90000, group: "pink", color: "#ff69b4" },
    { id: 22, name: "ANKARA GARI", type: "station", price: 2000000, rent: 250000 },
    { id: 23, name: "YOZGAT", type: "property", price: 1800000, rent: 90000, group: "orange", color: "#ffa500" },
    { id: 24, name: "ÇORUM", type: "property", price: 1900000, rent: 95000, group: "orange", color: "#ffa500" },
    { id: 25, name: "KAMU FONU", type: "chest" },
    { id: 26, name: "KIRŞEHİR", type: "property", price: 2000000, rent: 100000, group: "orange", color: "#ffa500" },
    { id: 27, name: "NEVŞEHİR", type: "property", price: 2000000, rent: 100000, group: "orange", color: "#ffa500" },

    // TOP ROW (28-42)
    { id: 28, name: "ÜCRETSİZ OTOPARK", type: "parking" },
    { id: 29, name: "KAYSERİ", type: "property", price: 2200000, rent: 110000, group: "red", color: "#ff0000" },
    { id: 30, name: "KONYA", type: "property", price: 2200000, rent: 110000, group: "red", color: "#ff0000" },
    { id: 31, name: "ADANA", type: "property", price: 2400000, rent: 120000, group: "red", color: "#ff0000" },
    { id: 32, name: "MERSİN", type: "property", price: 2400000, rent: 120000, group: "red", color: "#ff0000" },
    { id: 33, name: "ŞANS", type: "chance" },
    { id: 34, name: "ANTALYA", type: "property", price: 2600000, rent: 130000, group: "red", color: "#ff0000" },
    { id: 35, name: "MUĞLA", type: "property", price: 2600000, rent: 130000, group: "red", color: "#ff0000" },
    { id: 36, name: "ALSANCAK GARI", type: "station", price: 2000000, rent: 250000 },
    { id: 37, name: "AYDIN", type: "property", price: 2800000, rent: 140000, group: "yellow", color: "#ffff00" },
    { id: 38, name: "DENİZLİ", type: "property", price: 2800000, rent: 140000, group: "yellow", color: "#ffff00" },
    { id: 39, name: "İSKİ", type: "utility", price: 1500000, icon: "droplet" },
    { id: 40, name: "MANİSA", type: "property", price: 3000000, rent: 150000, group: "yellow", color: "#ffff00" },
    { id: 41, name: "İZMİR", type: "property", price: 3200000, rent: 160000, group: "yellow", color: "#ffff00" },

    // RIGHT ROW (42-55)
    { id: 42, name: "HAPSE GİR", type: "gotojail" },
    { id: 43, name: "ÇANAKKALE", type: "property", price: 3200000, rent: 160000, group: "green", color: "#008000" },
    { id: 44, name: "BALIKESİR", type: "property", price: 3400000, rent: 170000, group: "green", color: "#008000" },
    { id: 45, name: "KAMU FONU", type: "chest" },
    { id: 46, name: "BURSA", type: "property", price: 3400000, rent: 170000, group: "green", color: "#008000" },
    { id: 47, name: "ESKİŞEHİR", type: "property", price: 3600000, rent: 180000, group: "green", color: "#008000" },
    { id: 48, name: "SİRKECİ GARI", type: "station", price: 2000000, rent: 250000 },
    { id: 49, name: "ŞANS", type: "chance" },
    { id: 50, name: "SAKARYA", type: "property", price: 3800000, rent: 190000, housePrice: 1000000, group: "darkblue", color: "#00008b" },
    { id: 51, name: "KOCAELİ", type: "property", price: 3800000, rent: 190000, housePrice: 1000000, group: "darkblue", color: "#00008b" },
    { id: 52, name: "LÜKS VERGİSİ", type: "tax", price: 0 },
    { id: 53, name: "TEKİRDAĞ", type: "property", price: 4000000, rent: 200000, housePrice: 1200000, group: "darkblue", color: "#00008b" },
    { id: 54, name: "EDİRNE", type: "property", price: 4000000, rent: 200000, housePrice: 1200000, group: "darkblue", color: "#00008b" },
    { id: 55, name: "ARDAHAN", type: "property", price: 6000000, rent: 500000, housePrice: 2000000, group: "darkblue", color: "#00008b" }
];

export const CHANCE_CARDS = [
    { id: 1, text: "Banka sana kâr payı ödedi.", amount: 1500000, type: 'money' },
    { id: 2, text: "Hız sınırını aştın, ceza öde.", amount: -500000, type: 'money' },
    { id: 3, text: "Başlangıç noktasına git.", target: 0, type: 'move' },
    { id: 4, text: "Üç kare geri git.", amount: -3, type: 'step' },
    { id: 5, text: "Doğrudan Nezarethaneye git.", target: 14, type: 'move' }, // Using jail index
    { id: 6, text: "Tüm oyunculara 200B öde.", amount: -200000, type: 'payall' },
    { id: 7, text: "Piyangodan para kazandın!", amount: 2000000, type: 'money' },
    { id: 8, text: "En yakın istasyona git.", type: 'move_nearest', group: 'station' }
];

export const COMMUNITY_CHEST = [
    { id: 1, text: "Doktor parası öde.", amount: -500000, type: 'money' },
    { id: 2, text: "Bankadan hata ile para geldi.", amount: 1000000, type: 'money' },
    { id: 3, text: "Doğum günün kutlu olsun! Herkesten 100B Al.", amount: 100000, type: 'collectall' },
    { id: 4, text: "Hayat sigortası vadesi doldu.", amount: 1000000, type: 'money' },
    { id: 5, text: "Hastane masrafları.", amount: -1000000, type: 'money' },
    { id: 6, text: "Vergi iadesi.", amount: 500000, type: 'money' }
];
