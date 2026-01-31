const WebSocket = require("ws");
const express = require("express");

// ============================
// Server configuration
// ============================
const WS_HOST = "0.0.0.0";
const HTTP_HOST = "0.0.0.0";
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 4001;

// Express app
const app = express();
app.use(express.json());

// ============================
// Internal Interface (Management Dashboard)
// ============================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tally Notification Center - Internal Admin</title>
        <style>
            :root { --primary: #00427c; --secondary: #f0f4f8; --accent: #ffb703; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--secondary); margin: 0; padding: 20px; color: #333; }
            .container { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            h1 { color: var(--primary); text-align: center; border-bottom: 3px solid var(--accent); padding-bottom: 10px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; font-weight: bold; margin-bottom: 8px; color: #555; }
            input, textarea, select { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 16px; }
            textarea { height: 100px; }
            .btn { background: var(--primary); color: white; border: none; padding: 15px 25px; border-radius: 8px; font-size: 18px; cursor: pointer; width: 100%; transition: transform 0.2s, background 0.3s; }
            .btn:hover { background: #00305a; transform: translateY(-2px); }
            .btn:active { transform: translateY(0); }
            .status { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; text-align: center; font-weight: bold; }
            .success { background: #d4edda; color: #155724; display: block; }
            .error { background: #f8d7da; color: #721c24; display: block; }
            .hint { font-size: 12px; color: #777; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Create Tally Notification</h1>
            <div id="status" class="status"></div>
            
            <div class="form-group">
                <label for="title">Notification Title</label>
                <input type="text" id="title" placeholder="e.g. New Feature Alert!" value="New Feature Alert!">
            </div>

            <div class="form-group">
                <label for="body">Description / Body Content</label>
                <textarea id="body" placeholder="Describe the notification briefly...">Get the latest updates on GST reporting directly in TallyPrime.</textarea>
            </div>

            <div class="form-group">
                <label for="image_url">Image URL (Optional)</label>
                <input type="text" id="image_url" placeholder="https://example.com/promo.jpg">
                <div class="hint">Send high-quality EDMs or product banners.</div>
            </div>

            <div class="grid">
                <div class="form-group">
                    <label for="action_type">Action Type</label>
                    <select id="action_type">
                        <option value="report">Open Tally Report</option>
                        <option value="url">External Link (Web)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="action_value">Report Name or URL</label>
                    <input type="text" id="action_value" placeholder="e.g. Balance Sheet or https://tallysolutions.com/gst-update">
                </div>
            </div>

            <button class="btn" onclick="sendNotification()">🚀 Broadcast to All Tally Clients</button>
        </div>

        <script>
            async function sendNotification() {
                const btn = document.querySelector('.btn');
                const statusDiv = document.getElementById('status');
                
                const payload = {
                    title: document.getElementById('title').value,
                    body: document.getElementById('body').value,
                    image_url: document.getElementById('image_url').value,
                    action_type: document.getElementById('action_type').value,
                    action_value: document.getElementById('action_value').value
                };

                btn.disabled = true;
                btn.textContent = 'Sending...';

                try {
                    const response = await fetch('/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    
                    if (result.status === 'delivered') {
                        statusDiv.textContent = '✅ Delivered to ' + result.delivered + ' client(s)!';
                        statusDiv.className = 'status success';
                    } else if (result.status === 'message_lost') {
                        statusDiv.textContent = '⚠️ Server running, but no Tally clients are connected.';
                        statusDiv.className = 'status error';
                    } else {
                        statusDiv.textContent = '❌ Error: ' + result.message;
                        statusDiv.className = 'status error';
                    }
                } catch (err) {
                    statusDiv.textContent = '❌ Failed to connect to server.';
                    statusDiv.className = 'status error';
                } finally {
                    btn.disabled = false;
                    btn.textContent = '🚀 Broadcast to All Tally Clients';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// Start HTTP server first
const server = app.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`[START] Server running on port ${HTTP_PORT}`);
});

// Create WebSocket server by attaching it to the HTTP server
// This allows WS and HTTP to share the same port (required for Render.com)
const wss = new WebSocket.Server({ server });

console.log(`[START] WebSocket server integrated with HTTP server`);

// ============================
// WebSocket connection handling
// ============================
wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS CONNECT] Client connected from ${clientIp}`);
  console.log(`[WS STATUS] Total connected clients: ${wss.clients.size}`);

  ws.on("close", () => {
    console.log(`[WS DISCONNECT] Client disconnected: ${clientIp}`);
    console.log(`[WS STATUS] Total connected clients: ${wss.clients.size}`);
  });
});

// ============================
// Send notification to clients
// ============================
function sendNotification(payload) {
  let deliveredCount = 0;
  const message = JSON.stringify(payload);

  console.log(`[SEND] Broadcasting message`);
  console.log(`[SEND] Payload: ${message}`);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      deliveredCount++;
    }
  });

  console.log(`[SEND] Delivered to ${deliveredCount} client(s)`);
  return deliveredCount;
}

// ============================
// HTTP API (Postman & Dashboard)
// ============================
app.post("/send", (req, res) => {
  const { title, body, image_url, action_type, action_value } = req.body;

  console.log(`[HTTP] POST /send received`);
  console.log(`[HTTP] Payload:`, req.body);

  if (!title || !body) {
    console.log(`[HTTP ERROR] Invalid request`);
    return res.status(400).json({
      status: "invalid_request",
      message: "title and body are required"
    });
  }

  const connectedClients = wss.clients.size;
  console.log(`[HTTP] Connected clients: ${connectedClients}`);

  const delivered = sendNotification({
    title,
    body,
    image_url: image_url || "",
    action_type: action_type || "none",
    action_value: action_value || ""
  });

  if (connectedClients === 0) {
    console.log(`[RESULT] Message lost (no clients connected)`);
    return res.json({
      status: "message_lost",
      reason: "no active websocket clients",
      connectedClients: 0
    });
  }

  console.log(`[RESULT] Message delivered successfully`);
  res.json({
    status: "delivered",
    connectedClients,
    delivered
  });
});

