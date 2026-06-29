LabelPhone – Premium Business Softphone

You are a Senior UX Designer, Product Designer and Frontend Engineer.

Your mission is not to create another softphone.

Your mission is to design what could become the most beautiful business softphone on the market.

Think beyond traditional VoIP applications.

Imagine this question:

"What if Apple designed a softphone exclusively for business communications?"

That is the vision.

Product Vision

LabelPhone is a premium business communication application.

It combines:

Phone
Contacts
Call History
Presence
Business Calling
Future CTI integrations

The experience should feel closer to an iPhone than to a traditional desktop application.

The application must immediately communicate quality, simplicity and elegance.

Core Design Principle

The application itself IS the phone.

Do NOT create a desktop dashboard.

Do NOT create floating panels.

Do NOT create a CRM.

Instead, build a realistic smartphone experience dedicated to business telephony.

The browser should display a premium smartphone centered on the page.

Everything happens inside the phone.

Inspiration

Take inspiration from:

Apple Phone App
iPhone 16 Pro
FaceTime
Dynamic Island
Apple Music transitions
Google Pixel UI
Samsung One UI
Modern 3CX concepts (NOT its old interface)

Create an original design.

Never copy.

Visual Style

The application should look like a real flagship smartphone.

Requirements:

Premium aluminum frame
Rounded corners
Thin bezels
OLED black interface
Dynamic Island or camera cutout
Status bar
Home gesture bar
Beautiful shadows
Soft gradients
Glassmorphism where appropriate
Smooth rounded cards
Native mobile spacing

Everything should feel like a real phone.

UX Philosophy

Every interaction should feel native.

Animations must be subtle.

Elegant.

Fluid.

Nothing should feel like HTML buttons.

Everything should feel like an actual mobile operating system.

Screens
Dialer

Default screen.

Contains:

Search contact
Phone keypad
Favorite contacts shortcut
Recent calls shortcut
Beautiful green Call button

The keypad must look like a premium mobile dialer.

Active Call

After pressing Call:

Transition to a dedicated calling screen.

Display:

Large avatar
Contact name
Company
Phone number
Location
Call duration
Signal quality

Actions:

Mute
Speaker
Hold
Transfer
Keypad
Add Call

Large floating red End Call button.

Incoming Call

Beautiful full-screen incoming call.

Large avatar.

Company.

Caller name.

Swipe or animated buttons to:

Accept

Decline

Make it feel like a real smartphone call.

Contacts

Premium contact list.

Rounded avatars.

Search.

Favorites.

Alphabet navigation.

Beautiful scrolling.

Call History

Modern history screen.

Grouped by:

Today

Yesterday

Last Week

Missed

Favorites

Beautiful icons.

Professional typography.

Settings

Native-looking settings.

Business account.

Presence.

Audio devices.

Notifications.

Future SIP configuration.

Future API configuration.

Future CTI configuration.

Micro-interactions

Use animations everywhere.

Examples:

Smooth page transitions
Button ripple
Card elevation
Animated presence indicator
Soft hover effects
Animated keypad presses
Floating transitions
Fade between screens

Nothing abrupt.

Colors

OLED black background.

Primary blue.

Business green.

Professional red.

Neutral gray.

Use gradients sparingly.

Maintain excellent contrast.

Typography

Use:

SF Pro Display
or
Inter

Large titles.

Comfortable spacing.

Premium appearance.

Technical Requirements

Use only:

HTML5
CSS3
Vanilla JavaScript

No frameworks.

No Bootstrap.

No Tailwind.

No external UI libraries.

The project must run by opening index.html.

Project Structure

labelphone/

index.html

css/
styles.css

js/
app.js
ui.js
softphoneService.js

assets/
logo.svg

Architecture

The UI must never communicate directly with telephony services.

Everything must go through softphoneService.js.

Prepare the service layer for future integrations:

B2Com REST API
SIP.js
JsSIP
WebRTC
WebSocket
CTI SDK
Electron

Electron support must be considered from the beginning.

The future desktop application should simply wrap the existing web application without changing the UI architecture.

Code Quality

Write production-ready code.

Modular.

Maintainable.

Reusable.

Well organized.

Beautiful.

# Audio Experience

The application must feel like a real premium smartphone.

Implement realistic sound feedback.

Use the Web Audio API whenever possible instead of audio files.

Generate authentic DTMF tones for keypad presses.

Future sounds include:

- Keypad tone
- Ringback tone
- Incoming ringtone
- Busy tone
- Hangup click
- Call connected tone

Sound effects must be configurable from Settings.

Allow enabling/disabling keypad sounds.

Support future audio packs.

# Multiple UI Modes

The application must support multiple visual layouts without changing business logic.

Create an Appearance setting with support for:

- Mobile Phone (default)
- Desktop Softphone
- Compact

The telephony logic must remain identical.

Only the presentation layer changes.

The architecture should allow adding future layouts by simply creating new CSS themes.
Final Objective

When someone opens LabelPhone for the first time, they should think:

"This looks like an Apple-designed business phone."

Not:

"This is a web page."

The final result should be elegant enough that it could realistically become a commercial product competing with 3CX, RingCentral or Zoom Phone.
