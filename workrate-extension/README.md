# WorkRate Chrome Extension v1.1
### Verified, Tab-Based Freelance Time Tracking

---

## 🧠 How the accountability model works

**Every other tracker:**
> Timer runs → all time counts → trust is assumed

**WorkRate v1.1:**
> You register the exact tabs for your project → only time on those tabs counts → time is *proven*

```
Register:   [Figma tab]  [GitHub repo]  [Notion doc]

Timer ──────────────────────────────────────────────────►
         On Figma         Switch to        Back on GitHub
         ✅ COUNTING       Gmail/Slack      ✅ COUNTING
                          ⏸ AUTO-PAUSED
                          (not billed)
```

**The proof report every client sees:**
- ✅ **Verified %** — time actually on registered project tabs, not idle
- → **Off-tab %** — time on other tabs (not billed)
- ⏸ **Idle %** — system idle or no mouse activity (not billed)
- 📋 **Off-tab log** — every domain visited while timer ran + duration

Disputes become impossible. The numbers are self-evident.

---

## 📁 File Structure

```
workrate-extension/
├── manifest.json           ← Manifest V3
├── background/
│   ├── worker.js           ← All tracking logic lives here
│   └── constants.js        ← Idle thresholds, WQI weights, blocked domains
├── popup/
│   ├── popup.html          ← UI shell
│   ├── popup.css           ← Styles
│   ├── popup.js            ← UI controller
│   └── blocked.html        ← Deep Work blocked-site page
├── content/
│   └── detector.js         ← Mouse/scroll frequency signals (zero content access)
└── icons/
    └── icon16/32/48/128.png
```

---

## 🚀 Install (no coding needed)

1. Download the zip → right-click → **Extract All**
2. Open Chrome → type `chrome://extensions` → Enter
3. Toggle **Developer mode** ON (top-right)
4. Click **"Load unpacked"** → select the `workrate-extension` folder
5. Click the 🧩 puzzle icon → pin **WorkRate**

---

## ▶ How to use

### Before you start — register your project tabs

Open all tabs you'll work in (Figma, GitHub, Notion, etc.), then in WorkRate:
- **"+ Add current tab"** — registers whichever tab you're on right now
- **"Browse open tabs"** — pick from the full list of open tabs

### During the session

| You do | WorkRate does |
|---|---|
| Stay on a registered tab | ✅ Verified time counts — badge **● green** |
| Switch to Gmail/Slack/etc | ⏸ Clock auto-pauses — badge **○ grey** |
| Return to project tab | ✅ Clock auto-resumes |
| Walk away from computer | ⏸ System idle — clock pauses — badge **⏸ amber** |
| Stare at screen (3 min no movement) | ⏸ Activity idle — clock pauses |

### After — stop and see the proof

**⏹ Stop & save** → session stored with full breakdown: verified / off-tab / idle split, WQI score, registered tab list, off-tab log.

---

## 🔒 Privacy rules

| Data | Stored | Detail |
|---|---|---|
| Domain name (e.g. `github.com`) | ✅ | Never the full URL |
| Tab title | ✅ | Human-readable label |
| Time on registered tabs | ✅ | The verified number |
| Time on other tabs | ✅ | Off-tab log for transparency |
| Idle periods | ✅ | Logged and deducted |
| Page content / text | ❌ Never | Zero access |
| Keystrokes | ❌ Never | Not recorded |
| Screenshots | ❌ Never | Not taken |
| Full URLs | ❌ Never | Domain only |

---

## 🏅 Badge meaning

| Badge | Means |
|---|---|
| ● Green | On registered tab — verified time counting |
| ○ Grey | Off registered tab — clock paused |
| ⏸ Amber | System or activity idle — clock paused |
| *(empty)* | Session stopped |

---

## 🔢 WQI Formula

```
WQI = (Focus × 0.45) + (Output × 0.30) + (Consistency × 0.25)

Focus       = verified time ÷ (verified + off-tab time)
Output      = 0.76 placeholder (Phase 2: GitHub commits, Jira tasks)
Consistency = 1.0 if ≤2 off-tab trips, −0.09 per trip above 2, min 0.35
```

---

## ⌨️ Keyboard shortcut

`Alt + Shift + T` — toggle timer (requires tabs already registered)

---

## 🔧 Common issues

| Problem | Fix |
|---|---|
| Badge shows ○ even though I'm working | You're on an unregistered tab — add it first |
| Tab disappeared from registered list | Tab was closed and reopened (tab IDs reset) — re-add it |
| Activity idle triggering too fast | Edit `TAB_ACTIVITY_IDLE_SEC` in `background/constants.js` |
| Can't add a `chrome://` tab | Chrome system pages can't be tracked — expected behaviour |
