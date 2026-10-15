INANDA BUSINESS WEB - installable web app (PWA)
Kubamba ezingelayo
Live at: https://inandabusiness.co.za

Owned by Inanda Business Enterprise Services (PTY) LTD.


WHAT THIS IS
  A web app for Inanda: food, transport, construction and beauty.
  People open it in the phone browser and can install it on the home screen.
  It is live. Orders, logins, chat, rides and payments use a real database.


FILES (keep them together, exactly like this)
  index.html            the app: every screen and feature
  manifest.webmanifest  name, colours and icons for installing
  sw.js                 helper that makes the app work offline, installable,
                        and able to send alerts when the app is closed
  icons/                app icons (icon-192, icon-512, icon-maskable-512,
                        apple-touch-icon)
  CNAME                 tells GitHub the address is inandabusiness.co.za
                        (never delete this file, or the domain stops working)
  README.txt            this note (the app does not use it)


HOW IT IS BUILT AND WHERE THINGS LIVE
  Website files ......... GitHub Pages (this repository)
  Database and logins ... Supabase (region eu-west-1)
  Sign-up and reset mail  Brevo (sender noreply@inandabusiness.co.za)
  Robot check at login .. Cloudflare Turnstile
  Uptime watching ....... Better Stack (emails when the site goes down)
  Domain name ........... bought at domains.co.za


HOW TO INSTALL THE APP ON A PHONE
  Chrome on Android: tap the "Install app" card, or menu (three dots) > Install app.
  Safari on iPhone/iPad: tap Share > Add to Home Screen > Add.
  Chrome on computer: click the install icon at the right of the address bar.


HOW TO UPDATE THE APP (do these steps every time)
  1. Make your change in index.html (or any other file).
  2. Open sw.js and change VERSION to the next number,
     for example "inanda-v65" becomes "inanda-v66".
     If you skip this, phones keep showing the old saved copy.
  3. On GitHub: Add file > Upload files. Drag in the changed files together
     (index.html and sw.js) and click Commit changes.
  4. Wait about a minute, then open the app on a phone and refresh.

  Database changes (SQL files) are run separately in Supabase.
  They do not go on GitHub Pages.


KEEP SAFE
  - Never put passwords, secret keys or the Supabase service key in any file here.
    Everything in this repository is public.
  - Keep a copy of every file on your own computer as a backup.


CURRENT VERSION NOTE
  Service worker version: inanda-v65
