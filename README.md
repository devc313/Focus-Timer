# Focus Timer

A calm, single-page focus timer built for deep work. The app combines guided focus sessions, break modes, task tracking, ambient sound generators, and rotating nature backgrounds in a polished glassmorphism interface.

## Overview

Focus Timer is a lightweight front-end project made with plain HTML, CSS, and JavaScript. It is designed to help users stay in rhythm during work sessions with simple controls, a clean visual atmosphere, and a few thoughtful productivity features.

## Features

- Focus session presets for `25`, `50`, and `90` minutes
- Three session modes: `Focus`, `Short Break`, and `Long Break`
- Start, pause, and reset timer controls
- Visual progress bar and session status feedback
- Task input to define the current focus target
- Local persistence with `localStorage`
- Session statistics for completed focus rounds and total focus minutes
- Keyboard shortcuts:
  - `Space` to start or pause
  - `R` to reset
- Dynamic background scenes loaded from Unsplash
- Built-in ambient sounds generated with the Web Audio API:
  - Rain
  - Forest
- Responsive UI for desktop and mobile screens

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Web Audio API
- Local Storage API

## Project Structure

```text
vibe1/
|-- index.html
|-- style.css
|-- script.js
`-- README.md
```

## Getting Started

Because this is a static project, there is no build step or package installation.

### Option 1: Open directly

Open [`index.html`](./index.html) in your browser.

### Option 2: Run with a local server

If you want a smoother development workflow, serve the folder with a local server.

Examples:

```bash
# Python
python -m http.server
```

Then open `http://localhost:8000`.

## Usage

1. Choose a focus preset.
2. Select a mode: focus or break.
3. Add your current task.
4. Start the timer.
5. Optionally turn on ambient rain or forest sounds.
6. Refresh the scene for a new background image when you want a different mood.

## Notes

- App state is saved in the browser using `localStorage`.
- Ambient sounds rely on browser support for the Web Audio API.
- Background images are loaded from Unsplash, so an internet connection is needed for scene refresh.

## Author

Created by [@devc313](https://github.com/devc313)
