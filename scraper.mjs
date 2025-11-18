/* 
  24/7 Bitcoin Tracker - Replit / Server Version
  
  -------------------------------------------------------
  HOW TO RUN ON REPLIT (No Coding Experience Required):
  -------------------------------------------------------
  1. Go to https://replit.com and create a new "Node.js" Repl.
  2. Copy ALL this code and paste it into 'index.js'.
  3. In the Tools sidebar (left), click "Secrets" (Lock icon).
  4. Add a new secret:
     - Key: API_KEY
     - Value: [Paste your Gemini API Key here]
  5. Click the big green "Run" button.
  -------------------------------------------------------
*/

import { GoogleGenAI } from "@google/genai";
import http from 'http';
import fs from 'fs';
import process from 'process';

// --- CONFIGURATION ---
// The script checks for the key in the environment variables (Replit Secrets)
const API_KEY = process.env.API_KEY; 
const INTERVAL_MS = 60 * 1000; // 1 minute
const FILE_NAME = 'bitcoin_data.json';

// --- VALIDATION ---
if (!API_KEY) {
  console.error("❌ FATAL ERROR: API_KEY is missing.");
  console.error("-> If using Replit: Go to 'Secrets' (Lock icon) and add API_KEY.");
  process.exit(1);
}

// --- AI SETUP ---
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- WEB SERVER (KEEP-ALIVE) ---
// This simple server runs to keep the cloud instance satisfied that the app is "active".
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bitcoin Tracker is RUNNING 24/7. \nCheck the console for logs.');
});

server.listen(3000, () => {
  console.log("🌐 Web Server is live on port 3000");
});

// --- TRACKER LOGIC ---
console.log("🚀 Starting Headless Bitcoin Tracker...");
console.log(`⏱️  Interval: ${INTERVAL_MS / 1000} seconds`);
console.log(`📂 Output file: ${FILE_NAME}`);

const fetchPrice = async () => {
  try {
    // We ask Gemini to search Google for the price
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "What is the current price of Bitcoin (BTC) in USD on CoinGecko? Please provide the exact numeric value. Search the web for the most recent data.",
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text || "";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    let sourceUrl = null;
    if (groundingChunks && groundingChunks.length > 0) {
        const webChunk = groundingChunks.find(c => c.web?.uri);
        if (webChunk?.web?.uri) sourceUrl = webChunk.web.uri;
    }

    // Parse Price Logic
    const cleanText = text.replace(/,/g, '');
    const priceMatch = cleanText.match(/\$?(\d+\.\d{2}|\d+)/);
    let price = 0;
    
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    } else {
       const numbers = cleanText.match(/\d+(\.\d+)?/g)?.map(Number) || [];
       const plausible = numbers.filter(n => n > 10000); 
       if (plausible.length > 0) price = plausible[0];
    }

    if (price > 0) {
      const record = {
        timestamp: new Date().toISOString(),
        price,
        sourceUrl,
        rawResponse: text
      };

      saveRecord(record);
      console.log(`[${new Date().toLocaleTimeString()}] 💰 Price: $${price.toLocaleString()} | Saved.`);
    } else {
      console.warn(`[${new Date().toLocaleTimeString()}] ⚠️ Could not parse price.`);
    }

  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Error:`, error.message);
  }
};

const saveRecord = (record) => {
  let data = [];
  try {
    if (fs.existsSync(FILE_NAME)) {
      const fileContent = fs.readFileSync(FILE_NAME, 'utf-8');
      data = JSON.parse(fileContent);
    }
  } catch (e) {
    // File doesn't exist yet, that's fine
  }

  data.push(record);
  fs.writeFileSync(FILE_NAME, JSON.stringify(data, null, 2));
};

// --- START LOOP ---
fetchPrice(); // Run once immediately
setInterval(fetchPrice, INTERVAL_MS); // Loop forever
