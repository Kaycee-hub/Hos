# DocCheck - Railway-ready fullstack project

This project is packaged for Railway deployment (no code required).

How to deploy on Railway (easy):
1. Create a free account at https://railway.app
2. On the Railway dashboard click 'New Project' -> 'Deploy from GitHub or ZIP'
3. Upload this ZIP file.
4. Railway will detect the Node app and install dependencies. Once it finishes, it will run `npm start` and give you a public URL.

Environment variables (set these in Railway project settings):
- GMAIL_USER: your Gmail address (for sending verification/reset emails)
- GMAIL_PASS: an App Password from Google (do NOT use your main Gmail password)
- JWT_SECRET: (recommended) a long random string
- BASE_URL: optional, set to your deployed URL (e.g. https://yourapp.up.railway.app)

Admin credentials (pre-seeded):
- Email: billie@doccheck.com
- Password: Jajaja606

Notes:
- The server uses SQLite (data.sqlite) which Railway preserves per deployment by default.
- If you need to re-seed data, in Railway console run: `node migrate.js && node seed.js`
