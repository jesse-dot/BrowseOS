const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies and serve static frontend files
app.use(express.json());
app.use(express.static('public'));

// Define the directory where OS files will be physically saved on disk
const STORAGE_DIR = path.join(__dirname, 'os_storage');
const USERS_DIR = path.join(STORAGE_DIR, 'users');

function sanitizeUserName(name) {
    const safeName = String(name || 'guest')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return safeName || 'guest';
}

function getUserFromRequest(req) {
    return sanitizeUserName(req.get('x-webos-user'));
}

function getUserDir(userName) {
    return path.join(USERS_DIR, sanitizeUserName(userName));
}

async function ensureUserDir(userName) {
    const dir = getUserDir(userName);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

async function listUsers() {
    await fs.mkdir(USERS_DIR, { recursive: true });
    const entries = await fs.readdir(USERS_DIR, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

// Initialize the storage directory when the server starts
async function initStorage() {
    try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        await ensureUserDir('guest');
        console.log(`[OS Storage] Initialized at: ${STORAGE_DIR}`);
    } catch (err) {
        console.error('[OS Storage] Failed to create storage directory:', err);
    }
}
initStorage();

// --- API ENDPOINTS FOR FILE MANAGER ---

app.get('/api/users', async (req, res) => {
    try {
        const users = await listUsers();
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read users' });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const user = sanitizeUserName(req.body?.username);
        await ensureUserDir(user);
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get list of all files
app.get('/api/files', async (req, res) => {
    try {
        const userDir = await ensureUserDir(getUserFromRequest(req));
        const files = await fs.readdir(userDir);
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

// Read a specific file
app.get('/api/files/:name', async (req, res) => {
    try {
        const userDir = getUserDir(getUserFromRequest(req));
        // Use path.basename to prevent directory traversal attacks (e.g. ../../)
        const safeName = path.basename(req.params.name);
        const content = await fs.readFile(path.join(userDir, safeName), 'utf8');
        res.send(content);
    } catch (err) {
        res.status(404).json({ error: 'File not found' });
    }
});

// Create or update a file
app.post('/api/files/:name', async (req, res) => {
    try {
        const userDir = await ensureUserDir(getUserFromRequest(req));
        const safeName = path.basename(req.params.name);
        const content = req.body.content || '';
        await fs.writeFile(path.join(userDir, safeName), content, 'utf8');
        res.json({ success: true, message: 'File saved to disk' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Delete a file
app.delete('/api/files/:name', async (req, res) => {
    try {
        const userDir = getUserDir(getUserFromRequest(req));
        const safeName = path.basename(req.params.name);
        await fs.unlink(path.join(userDir, safeName));
        res.json({ success: true, message: 'File deleted from disk' });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(` Node Web OS is running!`);
    console.log(` Open your browser to: http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});
