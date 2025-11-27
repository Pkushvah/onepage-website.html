/* Simple Express backend that proxies image generation to Hugging Face Inference API.
   Requires environment variable HF_API_TOKEN.
*/
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const HF_TOKEN = process.env.HF_API_TOKEN;
const USE_CRAIYON = (process.env.USE_CRAIYON === 'true');
if (!HF_TOKEN) console.warn('Warning: HF_API_TOKEN not set. Set it in environment before starting the server.');
if (USE_CRAIYON) console.log('Using Craiyon public API for generation (no API token required)');

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  try {
    if (USE_CRAIYON) {
      // Craiyon public API (free-ish). It accepts { prompt } and returns { images: [base64,...] }
      const resp = await fetch('https://api.craiyon.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ error: txt });
      }
      const json = await resp.json();
      // Craiyon typically returns an array of base64 PNGs in `images`
      if (!json || !json.images || !json.images.length) return res.status(502).json({ error: 'Invalid response from Craiyon' });
      const b64 = json.images[0];
      const dataUrl = b64.startsWith('data:') ? b64 : ('data:image/png;base64,' + b64);
      return res.json({ image: dataUrl });
    }

    const resp = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        Accept: 'image/png',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const arr = await resp.arrayBuffer();
    const b64 = Buffer.from(arr).toString('base64');
    const dataUrl = 'data:image/png;base64,' + b64;
    res.json({ image: dataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// simple health endpoint used by CI or to check server
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Edit an uploaded image with a prompt (image editing / inpainting demo)
// Expects JSON: { prompt: string, image: dataUrl }
app.post('/api/edit', async (req, res) => {
  const { prompt, image } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  if (!image) return res.status(400).json({ error: 'Missing image' });

  try {
    // The Hugging Face Inference API accepts binary image input for some models.
    // We'll send the prompt and the base64 image as part of the JSON body. Depending on
    // the model and API expectations this may need to be a multipart/form-data POST.
    const body = { inputs: prompt, options: { wait_for_model: true }, image };

    const resp = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        Accept: 'image/png',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const arr = await resp.arrayBuffer();
    const b64 = Buffer.from(arr).toString('base64');
    const dataUrl = 'data:image/png;base64,' + b64;
    res.json({ image: dataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI backend listening on http://localhost:${PORT}`));
