# Setup Instructions

## Step-by-Step Installation

### 1. Install Shared Package Dependencies

```bash
cd neon-dominion/shared
npm install
```

### 2. Install Server Dependencies

```bash
cd ../server
npm install
cp .env.example .env  # Or create .env manually with PORT=3000
```

### 3. Install Client Dependencies

```bash
cd ../client
npm install
```

### 4. Initialize Tailwind CSS (Already configured, but for reference)

The Tailwind CSS configuration is already set up. If you need to reinitialize:

```bash
cd neon-dominion/client
npx tailwindcss init -p
```

The configuration files (`tailwind.config.js` and `postcss.config.js`) are already created.

### 5. Running the Application

**Terminal 1 - Server:**
```bash
cd neon-dominion/server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd neon-dominion/client
npm run dev
```

## Quick Setup Script (All-in-One)

You can run these commands sequentially:

```bash
# Navigate to project root
cd neon-dominion

# Install shared
cd shared && npm install && cd ..

# Install server
cd server && npm install && cp .env.example .env && cd ..

# Install client
cd client && npm install && cd ..
```

## Verification

After installation, verify everything works:

1. **Type Check:**
   ```bash
   cd neon-dominion/shared && npm run typecheck
   cd ../server && npm run typecheck
   cd ../client && npm run typecheck
   ```

2. **Start Server** (should see "🚀 Neon Dominion Server running on port 3000")
3. **Start Client** (should open at http://localhost:5173)

## Troubleshooting

### TypeScript Path Aliases

If you see import errors, make sure:
- Server uses relative imports: `../../shared/types`
- Client uses path aliases configured in `vite.config.ts`

### Socket.io Connection Issues

- Ensure server is running on port 3000
- Check CORS settings in `server/src/index.ts`
- Verify client `.env` has `VITE_SERVER_URL=http://localhost:3000`

### Tailwind Not Working

- Ensure `postcss.config.js` exists
- Check `tailwind.config.js` content paths
- Verify `index.css` has Tailwind directives
