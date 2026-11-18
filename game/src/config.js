// Marisol Nights — central tuning, layout metrics and palette.
// Everything else in the game reads its numbers from here so the whole
// city can be rebalanced from one file.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;

// HD rendering: the canvas backing store is RENDER_SCALE times the
// logical view size, and the frame is drawn under a matching base
// transform, so every world-unit shape and letter stays crisp on
// high-density displays instead of being stretched from 1280x720.
export const RENDER_SCALE = 2;

// City layout: a grid of blocks separated by two-lane roads.
export const ROAD_W = 96;
export const BLOCK_W = 430;
export const BLOCK_H = 430;
export const COLS = 4;
export const ROWS = 3;
export const WORLD_W = COLS * BLOCK_W + (COLS + 1) * ROAD_W;
export const WORLD_H = ROWS * BLOCK_H + (ROWS + 1) * ROAD_W;

// On-foot tuning.
export const WALK_SPEED = 178;
export const WALK_RADIUS = 12;
export const PLAYER_MAX_HP = 100;

// Car tuning (arcade, top-down).
export const CAR_ACCEL = 300;
export const CAR_MAX_SPEED = 430;
export const CAR_MAX_REVERSE = 130;
export const CAR_TURN = 2.6;
export const CAR_RADIUS = 21;

// Wanted / heat tuning.
export const HEAT_PER_STAR = 100;
export const HEAT_DECAY = 7; // per second while unseen
export const HEAT_DECAY_SEEN = 1.2; // per second while a cop watches
export const BUSTED_FILL_TIME = 1.6; // seconds of close police contact

// Combat tuning.
export const BULLET_SPEED = 760;
export const BULLET_LIFE = 0.55;
export const FIRE_COOLDOWN = 0.16;

// Sun-drenched coastal palette, all flat colours.
export const PALETTE = {
  road: '#3d4149',
  roadEdge: '#2e3238',
  lane: '#d8c56a',
  sidewalk: '#b9b3a4',
  grass: '#79b657',
  sand: '#ecd28a',
  water: '#3f9db8',
  park: '#6cab4f',
  plaza: '#cfc4a5',
  night: 'rgba(16,24,64,0.42)',
};

export const DISTRICT_INFO = {
  heights: { label: 'Kencana Heights', ground: '#a8bf7e' },
  park: { label: 'Taman Melati', ground: '#6cab4f' },
  downtown: { label: 'Aurora Downtown', ground: '#b9b3a4' },
  market: { label: 'Pasar Lama', ground: '#cbb98d' },
  harbor: { label: 'Pelabuhan Timur', ground: '#9aa0a3' },
  beach: { label: 'Pantai Marisol', ground: '#ecd28a' },
};

// Block kinds, index is row * COLS + col.
export const BLOCK_KINDS = [
  // row 0 (north)
  'heights', 'park', 'downtown', 'downtown',
  // row 1 (middle)
  'market', 'downtown', 'downtown', 'harbor',
  // row 2 (south)
  'beach', 'beach', 'harbor', 'harbor',
];

export const BUILDING_NAMES = {
  heights: ['Rumah Melati', 'Rumah Kenanga', 'Villa Cemara', 'Rumah Anggrek', 'Kost Pelangi', 'Rumah Flamboyan'],
  downtown: ['Menara Aurora', 'Kantor Lintas Data', 'Hotel Cakrawala', 'Plaza Sinar', 'Gedung Arunika', 'Menara Bayline', 'Kantor Pos Kota', 'Galeri Timur'],
  market: ['Pasar Lama Blok A', 'Pasar Lama Blok B', 'Toko Rempah Sari', 'Kedai Kopi Pagi', 'Toko Kain Warna', 'Los Daging Segar'],
  harbor: ['Gudang Nomor 3', 'Gudang Nomor 5', 'Kantor Kargo Timur', 'Bengkel Kapal Rudi', 'Gudang Pendingin', 'Depo Kontainer'],
  beach: ['Pondok Ombak', 'Kafe Tepi Pantai', 'Penyewaan Perahu', 'Warung Sunset'],
  park: [],
};

export const CAR_COLORS = ['#d95f4b', '#4b7fd9', '#f2f0e6', '#57a773', '#e9b44c', '#7d5ba6', '#e07a9a', '#4fb0ae', '#8a8d91', '#c96f2e'];
export const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#fd79a8'];
