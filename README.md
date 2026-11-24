# 🚌 S.ROCKET — Nepali Bus Simulator

A Nepali bus simulator game made for fun — built from scratch in one self-contained
`index.html` (vanilla JS + Canvas, no build step, no libraries, no external assets).

**▶ Just open `index.html` in a browser** (or run `python3 -m http.server` and visit it).

## The game

You drive a classic green-and-white Nepali Tata bus with **"HORN OK PLEASE"** painted on
the back, marigold garland on the bumper and a `बा २ ख ४५६७` number plate. Pick up
passengers at bus stops, honk at cows, dodge trucks on blind curves and reach your
destination before the clock runs out.

### Routes

| Route | Terrain | Stops | Difficulty |
|---|---|---|---|
| काठमाडौं → पोखरा (Kathmandu → Pokhara) | Hilly highway, curves + river views | Thankot, Naubise, Malekhu, Muglin, Dumre | ⭐⭐ |
| विराटनगर → वीरगञ्ज (Biratnagar → Birgunj) | Flat Terai, heavy trucks + cows | Itahari, Janakpur, Hetauda | ⭐ |
| बागलुङ → जोमसोम (Baglung → Jomsom) | Mountain road, hairpins, prayer flags | Beni, Tatopani, Jomsom, Muktinath | ⭐⭐⭐ |

### How to play

- **Stop fully** at a 🚏 stop, then press **E** to open the door — passengers get off, new
  ones board, and you earn the fare (रू 40–120 per passenger, 40 seats).
- **H** horn — cows on the road move aside (and it looks cool).
- **F** refuel at a ⛽ petrol pump (you must be stopped).
- Crashes cost damage; 100% damage ends the run. Time bonus + star rating at the end.

### Controls

| Key | Action |
|---|---|
| `W` / `↑` | Accelerate |
| `S` / `↓` / `Space` | Brake |
| `A` `D` / `←` `→` | Steer |
| `H` | Horn (📯) |
| `E` | Open / close door |
| `F` | Refuel at pump |
| `P` | Pause · `M` Mute · `C` Camera |

On phones, on-screen buttons appear automatically (steer, gas, brake, horn, door).

## What's inside

- **Pseudo-3D road engine** (OutRun-style): curves, hills, S-bends, centrifugal pull,
  distance fog, parallax Himalayan ranges anchored to the road horizon, and three
  per-route scenery palettes (hill / Terai / mountain).
- **Hand-drawn vector art** — bus, truck, tempo, car, bike, tractor, cows, pagoda temples,
  momo shops, tea stalls, prayer flags, bus shelters, petrol pumps, paddy terraces, cliffs.
- **Traffic & hazards** — traffic that shares the road, collisions with damage, cows that
  only move when you honk.
- **Procedural audio** (WebAudio, no files): engine hum that follows your speed, horn,
  door bell, cash register, crash.
- **HUD** in Nepali + English: speedometer with gear, fuel/damage bars, earnings,
  passenger count, live route progress with stop markers, and a floating arrow over the
  next stop you have to serve.

Made with 🚀 for fun. जय नेपाल 🇳🇵
