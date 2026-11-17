# Marisol Nights

A top-down open-world crime game built for the make.fun bounty **Make GTA 6** (gta6-01).
Play it in a desktop browser from the static files in `game/` — no network, no build step.

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/fathirdwi757-maker/marisol-nights/rank.svg)
![reward](https://make.fun/badge/gta6-01/fathirdwi757-maker/marisol-nights/reward.svg)

Entry on [make.fun](https://make.fun/bounty/gta6-01).

## The game

You are Nilo, a courier in the bay city of Marisol Bay — 12 blocks, 6 named districts
(Aurora Downtown, Pasar Lama, Pelabuhan Timur, Pantai Marisol, Kencana Heights, Taman Melati).
Walk or drive, steal cars, run a 6-mission story chain for Sinta and the harbour crews,
rob the warungs, find 10 hidden packages — and watch the stars: the Marisol police
answer heat with patrol cars and, at 4 stars, roadblocks.

- WASD / arrows — move & drive
- Mouse — aim, click — shoot (also drive-by)
- E — enter / exit car
- F (hold) — rob a warung
- Esc / P — pause

Progress (money, missions, packages, position) saves to localStorage.

## Layout

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to the output and writes `dossier.json`
- `vendor/makefun-game.ts` — make.fun game library (from the bounty kit, unchanged)
- `game/` — the playable game (index.html + src/*.js, one responsibility per file)
- `screenshots/` — staged renders of real gameplay scenes

## License

MIT
