# LabelPhone UI Guidelines

A short reference for LabelPhone's visual language — the goal is a single, coherent
design system so every screen (Settings, the Quick Register modal, Contacts, Calls)
reads as one native app rather than a collection of separately-built components.

Source of truth for every token below is the `:root` block in `css/styles.css`
(lines 10-57). When adding a new screen or component, reuse these tokens and the
component classes described here before introducing anything new.

## 1. Design tokens

### Colors (OLED-first dark palette)
| Token | Value | Use |
|---|---|---|
| `--oled` | `#000000` | App background |
| `--s1` … `--s5` | `#0a0a0a` → `#3a3a3c` | Surface elevation ladder — higher number = more elevated/lighter surface (cards, modals use `--s2`) |
| `--border` / `--border2` | `rgba(255,255,255,.08)` / `.14` | Hairline dividers, input borders |
| `--t1` … `--t4` | white at 100% → 15% opacity | Text hierarchy: `--t1` primary, `--t2` secondary, `--t3` tertiary/placeholder, `--t4` disabled |
| `--blue` / `--blue-light` / `--blue-dim` | `#007AFF` family | Primary action color, focus rings, links |
| `--green` / `--green-dim` | `#34C759` family | Success / "registered" / connected states |
| `--red` / `--red-dim` | `#FF3B30` family | Errors, destructive actions, "failed" state |
| `--amber` / `--amber-dim` | `#FF9F0A` family | "In progress" / registering / warnings |
| `--purple`, `--gray`, `--teal` | — | Secondary accents (presence, misc badges) |

### Easing
- `--spring: cubic-bezier(.16,1,.3,1)` — modal/sheet entrances, anything that should feel like it settles into place.
- `--snap: cubic-bezier(.34,1.56,.64,1)` — small bouncy confirmations (toggle, badge pop).

### Scale factors
- `--desktop-scale` (0.5) / `--compact-scale` (0.72) — physical size of the phone "card" in each layout mode.
- `--desktop-type-scale` — derived (`compact-scale / desktop-scale`), the single multiplier used everywhere text/icons need to render at the same *visual* size in Desktop mode as they do in Compact mode. Pattern: `body.layout-desktop .some-class { font-size: calc(Npx * var(--desktop-type-scale)); }`. **Any new component with text must add this override**, or it will look wrong-sized only in Desktop mode.

## 2. Typography

No separate type-scale system — components pick from a small, consistent set of
sizes already in use: **11px** (field labels), **13px** (secondary/meta text, error banners), **14px** (buttons, toggle labels), **15px** (inputs, body text), **17px** (modal/dialog titles). Don't introduce a new size without a good reason; pick the closest existing one.

Font weights: 500 (labels, medium emphasis), 600 (buttons), 700 (titles).

## 3. Buttons

All buttons in login/modal contexts share one base class, `.settings-login-btn`,
with color-only modifiers — this is the pattern to extend for any new button, not a
one-off:

```css
.settings-login-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--green); border: none; border-radius: 10px;
  padding: 11px 10px; font-size: 14px; font-weight: 600; color: #fff;
  cursor: pointer; transition: opacity .15s ease;
}
.settings-login-btn:hover  { opacity: .88; }
.settings-login-btn:active { opacity: .72; }
```

Modifiers (same shape/radius/padding/typography — only the fill and text color change):
- **Primary** (default) — green fill, white text. Main/confirming positive action (Register, Save, Confirm).
- **`--secondary`** — `rgba(255,255,255,.08)` fill, `var(--t2)` text. Neutral, non-destructive secondary action (Cancel).
- **`--logout`** — `rgba(255,69,58,.18)` fill, `var(--red)` text. Destructive/sign-out actions.

The home card's own Register/Unregister button (`.reg-card-btn`, `#btnHomeRegister`) follows the
same recipe with its own class since it isn't part of the `.settings-login-btn` family: green fill
by default (Register role), and a `.reg-card-btn--danger` modifier — identical fill/text color to
`--logout` above — applied only while it represents Unregister (i.e. once actually registered).

Disabled state (used while a request is in flight): `opacity: .55; cursor: default;`
applied via `:disabled` — never remove/hide the button, just disable it.

A button that can take time (Register, Dial) shows a spinner instead of a bare
text swap: a `<span class="btn-spinner hidden">` sits before the label `<span>`,
and the busy-toggle function does `spinner.classList.toggle("hidden", !busy)`
alongside swapping the label text and setting `disabled`. See `#btnHomeDial` /
`#btnRegisterModalSave` for the reference markup.

### Action color semantics

Every action button in the app, whatever component it belongs to, follows one semantic
mapping — pick the color by what the action *does*, not by which screen it's on:
- **Green** (`var(--green)`) — positive actions: Register, Call, Answer, Save, Confirm.
- **Blue** (`var(--blue)`) — secondary actions: Edit, Settings, Advanced Settings, Details.
- **Grey** (`var(--t2)` / translucent white fill) — neutral actions: Cancel, Close, Back.
- **Red** (`var(--red)`) — destructive/disconnect actions: Unregister, Hang Up, Delete, Disconnect, Remove.

A single element can change semantic role across states (e.g. `#btnHomeRegister` is Register
while disconnected and Unregister once registered) — when that happens, its color must switch
with it, never stay fixed to the element's original role.

## 4. Inputs

```css
.settings-login-input {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 15px;
  color: var(--t1);
}
.settings-login-input:focus { border-color: var(--blue); background: rgba(255,255,255,.09); }
```
Label above the field: `.settings-login-label` (11px/500 weight, `var(--t3)`).
Placeholder color: `var(--t3)`.

## 5. Modals

Every dialog (Quick Register, Contact create/edit, delete confirmation) shares one
shell: a blurred backdrop plus a centered card that scales in with `--spring`.

```css
.register-modal-backdrop { background: rgba(0,0,0,.5); backdrop-filter: blur(4px); }
.register-modal {
  background: var(--s2); border-radius: 20px; padding: 20px 18px 16px;
  max-width: 300px; width: calc(100% - 48px);
  transform: translate(-50%, -50%) scale(.94); opacity: 0;
  transition: transform .28s var(--spring), opacity .2s ease;
}
.register-modal.active { transform: translate(-50%, -50%) scale(1); opacity: 1; }
```

Internal layout order — keep to this hierarchy unless a field genuinely can't be
deferred to a follow-up screen: **Title → primary fields → primary/secondary
action buttons → (optional) a single low-weight disclosure link for anything
non-essential.** The disclosure link (`.register-modal-advanced`) is 13px, `var(--t3)`,
no border/fill, so it never competes visually with the two real actions above it.

Error banner (never a browser `alert()`): `.register-modal-error`, `role="alert"`,
red-tinted background (`rgba(255,69,58,.14)`), `var(--red)` text, 13px, `hidden`
attribute toggled by JS — always shown *inside* the dialog it belongs to, with the
dialog staying open so the user can immediately retry.

## 6. Icons

Inline SVG only (no icon font/sprite sheet), consistently:
`fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`
— so icon color always follows the surrounding text/button color for free.

## 7. Loading, error, and success states

- **Loading**: disable the trigger control, swap its label to a "-ing…" verb
  (`Registrando…`), and show `.btn-spinner` (16px ring spinner, `@keyframes btn-spin`,
  respects `prefers-reduced-motion`). Never allow a second submit while busy.
- **Error**: inline banner inside the same dialog/screen the action was triggered
  from (see Modals above) — not a toast, not a native alert, since the user needs
  to see it while still being able to correct the input right there.
- **Success**: a toast (`UI.toast(message)`) for actions that close their dialog
  (login succeeded, contact saved) — confirms without blocking further interaction.

## 8. Disabled states

Buttons: `opacity: .55; cursor: default` via `:disabled` (see §3). Icon buttons
elsewhere in the app (e.g. contact call button while unregistered) follow the same
dimmed + non-interactive treatment via a `.disabled` class (`pointer-events: none`,
reduced opacity) rather than removing the element.

## 9. Registration states

Single state machine, five values, each with one color and one icon-dot treatment
(`.reg-dot`, shared by the header pill and the home card):

| State | Dot color | Meaning |
|---|---|---|
| `not-registered` | `var(--gray)` | No active SIP session |
| `registering` | `var(--amber)` | Login in flight |
| `registered` | `var(--green)`, pulsing | Live SIP session |
| `failed` | `var(--red)` | Last attempt was rejected |
| `disconnected` | `var(--gray)` | Lost the underlying connection |

Every screen that shows registration state (header pill, home card, dial button)
reads from this same state — never introduce a second, parallel status source.

The home background follows the same rule: a 5th CSS-only wallpaper preset
(`.home-wallpaper[data-wallpaper="not-registered"]`) sits as an overlay sibling of
the real `#homeWallpaper` element, toggled via a single `.active` class from
`BackgroundStateService.getBackgroundForState(status)` inside `UI.setRegistrationStatus()`
— the same funnel that already drives the dots/labels above. To add a background for a
future state (incoming call, on hold, etc.), extend that one `switch` statement; never
add a second place that reads registration/call state to decide a background.

## 10. Call states

Follows the same dot + label pattern as registration (`call.status.calling` /
`.connected` / `.onhold`), reusing the same amber/green semantic mapping: in
progress → amber-adjacent, connected → green, on hold → amber/paused treatment.
Call controls (mute, speaker, hold, etc.) use the same button base as any other
icon button in the app — circular, 32-44px depending on context, `currentColor` icon.

## 11. Known convergence gaps (not yet fixed)

The Contact create/edit modal and the generic delete-confirmation modal currently
still use `.incall-sheet-cancel` (borrowed from the in-call action sheet — 14px
radius, bordered, own margin) for their Cancel button, instead of the
`.settings-login-btn--secondary` variant introduced for the Quick Register modal.
Bringing those two in line with §3 is the next natural step toward one shared
button vocabulary app-wide.
