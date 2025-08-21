const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve content files with proper MIME type
app.get('/content/*.md', (req, res) => {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.sendFile(path.join(__dirname, req.path));
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 AI Evals Course server running on http://localhost:${PORT}`);
    console.log(`📚 Course website is ready!`);
    console.log(`💡 Open your browser and go to: http://localhost:${PORT}`);
});
