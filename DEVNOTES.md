# UMO Archive - Dev Notes

## Session: Feb 2, 2026

### Changes Made

**1. Admin Delete Moments** (`src/components/Moment/MomentDetailModal.jsx`)
- Trash icon button in moment detail modal, visible only to admins
- Calls `DELETE /admin/moments/:id` (backend endpoint already existed)
- Confirmation dialog, loading state, closes modal on success
- Admin check: `user.role === 'admin' || user.email === 'solo@solo.solo' || user.email === 'solo2@solo.solo'`

**2. Auto-open Upload on Song Select** (`src/components/Performance/panels/UploadPanel.jsx`)
- Selecting a song from the setlist picker immediately fires `onUploadSong` — no extra "Upload Song" button click needed
- One-line addition in the song picker's onClick handler

**3. Auto-minimize Video Hero** (`src/components/UI/VideoHero.jsx`)
- Auto-minimizes 500ms after playback starts (`hasAutoMinimized` ref)
- Minimized bar = frosted glass overlay (`bg-black/30 backdrop-blur-sm`) over the still-playing video
- Full-size player stays in DOM, clipped to 56px with `overflow: hidden` (not unmounted)
- Video shifted up `marginTop: -40%` so center of video shows through glass
- All media types (video, YouTube, audio) keep playing when minimized
- Play/pause, volume, skip, maximize controls all work in minimized bar
- Persistent `<audio>` element rendered before the minimized/full ternary

**4. Clickable "UMO Archive" Title on Desktop** (`src/components/UI/DesktopSidebar.jsx`, `src/App.js`)
- Title changed from static `<h2>` to `<button>` that opens How-to Guide
- `onToggleHowToGuide` prop passed from App.js to DesktopSidebar

**5. Leaderboard (Top Contributors) Access Everywhere**
- Desktop horizontal bar: Trophy icon with dropdown (`DesktopSidebar.jsx`)
- Mobile hamburger menu: Top Contributors section added (`App.js`)
- `Trophy` added to lucide-react imports in App.js

**6. DesktopSidebar Cleanup** (`src/components/UI/DesktopSidebar.jsx`)
- 673 lines -> 295 lines
- Removed entire vertical sidebar layout (left/right, collapsed/expanded, queue preview, docked media control, account section)
- Removed: `getTogglePosition()`, `getToggleIcon()`, `ChevronLeft`, `ChevronRight`, `ChevronUp`, `Trash2` imports
- Removed props: `isCollapsed`, `onToggleCollapse`
- Default position: `'left'` -> `'top'`

### Known Issues / TODO

- **Seeker bar styling** — "ugly black on black seeker bars" for uploaded clips. Need to style the `<input type="range">` in WaveformPlayer or similar. Come back to this.
- **TheaterQueue.jsx** — has ~1000 lines of pre-existing uncommitted changes (not from this session). Was stashed during debugging, now popped back. Needs review.
- **Chunk 133 Web3 error** — `(0, g.default) is not a function` in chunk 133. Pre-existing Web3/wallet library issue, NOT caused by any session changes. Site still loads fine.

### Architecture Notes

**VideoHero minimized player pattern:**
The minimized bar and full-size player are wrapped in a shared container `<div>`. When minimized, the container clips to `height: 56px; overflow: hidden`. The minimized overlay sits on top with `position: absolute; inset: 0; z-index: 40`. The full-size player renders behind it (shifted up with negative margin). This keeps all media elements in the DOM so playback continues and refs stay valid.

**DesktopSidebar:**
Now horizontal-only (top/bottom bar). No more vertical left/right sidebar support. Position stored in localStorage as `umo-sidebar-position`, defaults to `'top'`.

---

## Session: Feb 3, 2026

### Mobile Experience Fixes

**1. Hide TheaterQueue on Mobile** (`src/components/UI/TheaterQueue.jsx`)
- Added `hidden lg:block` to the main container
- The 320px-wide floating queue widget was unusable on mobile (overlapped bottom nav, too wide)
- Users now use the mobile mini player queue view instead

**2. Mobile Mini Player Queue Indicator** (`src/App.js` - MobileBottomNav)
- Added queue position indicator (e.g., "1/5") next to the song title
- Shows `ListMusic` icon + current position when playing from queue
- Changed song info from `<div>` to `<button>` for better accessibility

**3. Mobile Queue View in Expanded Player** (`src/App.js` - MobileBottomNav)
- When user expands the mobile mini player, they now see a queue section
- Shows up to 5 queued tracks with tap-to-play
- Includes clear queue button (Trash2 icon)
- Shows current playing track highlighted with yellow border
- "+X more" text if queue has more than 5 items

**4. Audio/Video Playback Sync Fix** (`src/components/UI/VideoHero.jsx`)
- Added `onPlay` and `onPause` handlers to both `<audio>` and `<video>` elements
- These sync React state (`isPlaying`) with actual browser playback state
- Fixes issue where iOS Safari pauses audio (e.g., phone call, notification) but React state remains `isPlaying: true`
- Added `onTimeUpdate` handler to update TheaterQueue context with current position
- This ensures mobile controls (play/pause buttons) always reflect actual state

### Technical Details

**Mobile playback sync issue:**
On iOS Safari, audio/video can pause unexpectedly (phone calls, notifications, system interruptions). Without `onPlay`/`onPause` handlers, React state becomes desynced from actual playback. User taps play, but `togglePlayPause()` sees `isPlaying: true` and calls `pause()` on already-paused audio = nothing happens. The fix: native event handlers that sync state bidirectionally.
