# 🪣 Marble Typing Battle

A free, no-backend, two-player typing game you play with a friend in the browser.

Type the words shown to you — each normal word flings a **marble** into your
opponent's bucket. Type a **⚡ power-up word** to clear marbles out of your *own*
bucket. The first bucket to overflow **loses**.

## How it works

- **Frontend only** — Vite + React, deployed as a static site (free on Vercel forever).
- **Networking** — WebRTC peer-to-peer via [PeerJS](https://peerjs.com). One player
  creates a game and gets a room code; the other joins with it. The two browsers
  connect *directly* — game data never touches a server we pay for. PeerJS's free
  public broker is only used to introduce the two browsers.
- **No backend, no database, no accounts, no cost.**

## Play

1. Player 1 clicks **Create Game** and shares the room code.
2. Player 2 enters the code and clicks **Join Game**.
3. Player 1 clicks **Start Game** → 3-2-1 → type!

## Develop

```bash
npm install
npm run dev
```

Open two browser windows (or two devices) to test both sides.

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Tuning

Gameplay knobs live in [`src/game/constants.js`](src/game/constants.js):
bucket capacity, marbles per word, power-up clear amount, power-up frequency,
and countdown length.

## Notes / limitations

- WebRTC needs HTTPS — Vercel provides this automatically (`localhost` is exempt for dev).
- The free public PeerJS broker occasionally has brief downtime, and a few very
  strict corporate/mobile networks may block direct peer-to-peer connections.
  For casual play with friends this is rarely an issue.
