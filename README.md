# pjlink-emu

A PJLink Class 1 projector emulator for Windows. Useful for testing AV control software without a physical projector.

## Requirements

- [Node.js](https://nodejs.org/) (v18+)
- npm

## Run

```
npm install
npm start
```

## Features

- **TCP server** on port 4352 (configurable) speaking the PJLink Class 1 protocol
- **Power state machine** — Standby → Warming (10 s) → On → Cooling (10 s) → Standby
- **Lamp hour simulation** — accumulates hours while powered on; fast-tick mode increments 1 hour per real minute for demos
- **Persistent state** — lamp hours, port, and projector info survive restarts (`%APPDATA%\pjlink-emu\state.json`)
- **Error emulation** — toggle fan, lamp, temperature, cover, filter, and other faults to drive the PJLink `ERST` error-status response
- **Connection log** — shows the last 50 commands received with client IP, raw command, and response

## Supported PJLink Commands

| Command | Description |
|---------|-------------|
| `POWR` | Power on/off query and control |
| `LAMP` | Lamp hours and on/off status (read-only) |
| `CLSS` | PJLink class (always `1`) |
| `NAME` | Projector name |
| `ERST` | Error status — fan/lamp/temperature/cover/filter/other, toggleable from the UI |
| `AVMT` | AV mute on/off |
| `INPT` | Input query (RGB1) |
| `INST` | Available inputs |
| `INF1` | Manufacturer name |
| `INF2` | Product name |

## Quick Protocol Test

Connect with any TCP client on port 4352 (e.g. `ncat localhost 4352`):

```
← PJLINK 0
→ %1POWR ?
← %1POWR=0
→ %1POWR 1
← %1POWR=OK
→ %1POWR ?
← %1POWR=3      (warming)
→ %1LAMP ?
← %1LAMP=1500 0
```
