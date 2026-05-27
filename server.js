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

// Initialize the storage directory when the server starts
async function initStorage() {
    try {
        await fs.mkdir(STORAGE_DIR, { recursive: true });
        console.log(`[OS Storage] Initialized at: ${STORAGE_DIR}`);
    } catch (err) {
        console.error('[OS Storage] Failed to create storage directory:', err);
    }
}
initStorage();

// --- API ENDPOINTS FOR FILE MANAGER ---

// Get list of all files
app.get('/api/files', async (req, res) => {
    try {
        const files = await fs.readdir(STORAGE_DIR);
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

// Read a specific file
app.get('/api/files/:name', async (req, res) => {
    try {
        // Use path.basename to prevent directory traversal attacks (e.g. ../../)
        const safeName = path.basename(req.params.name); 
        const content = await fs.readFile(path.join(STORAGE_DIR, safeName), 'utf8');
        res.send(content);
    } catch (err) {
        res.status(404).json({ error: 'File not found' });
    }
});

// Create or update a file
app.post('/api/files/:name', async (req, res) => {
    try {
        const safeName = path.basename(req.params.name);
        const content = req.body.content || '';
        await fs.writeFile(path.join(STORAGE_DIR, safeName), content, 'utf8');
        res.json({ success: true, message: 'File saved to disk' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Delete a file
app.delete('/api/files/:name', async (req, res) => {
    try {
        const safeName = path.basename(req.params.name);
        await fs.unlink(path.join(STORAGE_DIR, safeName));
        res.json({ success: true, message: 'File deleted from disk' });
    } catch (err) {
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