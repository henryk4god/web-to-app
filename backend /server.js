const express = require('express');
const cors = require('cors');
const shell = require('shelljs');
const AdmZip = require('adm-zip');
const axios = require('axios');
const path = require('path');
const app = express();

// Use Render's environment variable for port or default to 3000 for local development
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint to generate app
app.post('/generate-app', async (req, res) => {
    const { url, appId, appName } = req.body;

    // Validate URL
    try {
        await axios.get(url);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    // Create Cordova project
    const projectDir = path.join(__dirname, 'apps', appId);
    shell.mkdir('-p', projectDir);
    shell.cd(projectDir);

    if (shell.exec(`cordova create ${appId} com.example.${appId} ${appName}`).code !== 0) {
        return res.status(500).json({ error: 'Failed to create Cordova project' });
    }

    shell.cd(appId);

    // Add platforms
    if (shell.exec('cordova platform add android').code !== 0) {
        return res.status(500).json({ error: 'Failed to add Android platform' });
    }

    // Modify index.html to embed the website
    const indexPath = path.join('www', 'index.html');
    const iframeHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${appName}</title>
        </head>
        <body>
            <iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>
        </body>
        </html>
    `;
    shell.ShellString(iframeHTML).to(indexPath);

    // Build the app
    if (shell.exec('cordova build android').code !== 0) {
        return res.status(500).json({ error: 'Failed to build Android app' });
    }

    // Zip the APK file
    const apkPath = path.join('platforms', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const zip = new AdmZip();
    zip.addLocalFile(apkPath);
    const zipPath = path.join(projectDir, `${appId}.zip`);
    zip.writeZip(zipPath);

    // Respond with download link
    res.json({ downloadLink: `https://${req.get('host')}/download/${appId}.zip` });
});

// Endpoint to download the app
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'apps', req.params.filename);
    res.download(filePath);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});