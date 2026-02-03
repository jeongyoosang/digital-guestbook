import http from 'http';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/decrypt') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { data, uid, action } = JSON.parse(body);

                if (!data || !uid || !action) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing data, uid, or action' }));
                    return;
                }

                console.log(`[LocalDecrypt] Request received. Data len: ${data.length}`);

                // Classpath: Current dir + jar
                const classpath = [
                    '.', // Current dir (for Decrypt.class if compiled there)
                    'public/coocon', // If compiled into public/coocon
                    'public/coocon/WEB-INF/lib/isas1.0.jar'
                ].join(':'); // Mac/Linux separator

                // Ensure Decrypt.class is compiled. We assume user ran `javac ...` previously.
                // But we can check or try to compile? 
                // We'll run `java` assuming it's compiled.

                const args = [
                    '-cp', classpath,
                    'Decrypt', // Run 'Decrypt' class (default package)
                    data,
                    uid,
                    action
                ];

                console.log(`[LocalDecrypt] Running java command...`);

                execFile('java', args, { encoding: 'utf8' }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[LocalDecrypt] Java Error:`, error);
                        console.error(`[LocalDecrypt] Stderr:`, stderr);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: error.message, stderr }));
                        return;
                    }

                    // Parse stdout to find the Result line
                    // Our Decrypt.java prints: "Result: { ... }" or "Result 2: ..."
                    const lines = stdout.split('\n');
                    let jsonResult = null;

                    for (const line of lines) {
                        if (line.startsWith('Result: ')) {
                            const jsonStr = line.substring('Result: '.length).trim();
                            try {
                                jsonResult = JSON.parse(jsonStr);
                                break;
                            } catch (e) {
                                console.warn('[LocalDecrypt] Failed to parse JSON from line:', line);
                            }
                        }
                    }

                    if (jsonResult) {
                        console.log(`[LocalDecrypt] Decryption Success!`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(jsonResult));
                    } else {
                        console.error('[LocalDecrypt] Could not find JSON in stdout');
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Decryption failed to produce JSON', stdout }));
                    }
                });

            } catch (e) {
                console.error('[LocalDecrypt] Request Error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Local Decryption Server running at http://localhost:${PORT}/decrypt`);
    console.log(`Make sure you have compiled Decrypt.java:`);
    console.log(`javac -encoding UTF-8 -cp "public/coocon/WEB-INF/lib/isas1.0.jar" public/coocon/Decrypt.java`);
});
