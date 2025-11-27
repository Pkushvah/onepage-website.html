# onepage-website.html

This workspace contains a simple static landing page demo: an "AI Thumbnail Maker" that runs fully client-side.

Files added:
- `index.html` — landing page and UI
- `styles.css` — styling
- `script.js` — client-side thumbnail generator and simulated AI styles

How to use:
1. Open `index.html` in your browser (double-click or run a local server).
2. Upload an image, optionally enter a style prompt.
3. Click "Generate with AI (Simulated)" or "Generate Thumbnails".
4. Download any of the generated thumbnails.

Notes:
- This demo simulates AI-driven styling client-side (filters, overlays, text). For real AI generation, integrate a backend or an image generation API.
- No external dependencies; static files only.

Backend AI integration (added):

- A simple Express backend (`server.js`) is included which proxies requests to the Hugging Face Inference API (model `stabilityai/stable-diffusion-2`).
- To enable it:

  1. Copy the example env file:

	  ```bash
	  cp .env.example .env
	  ```

  2. Set `HF_API_TOKEN` in `.env` (your Hugging Face token).

  3. Install dependencies and start the server:

	  ```bash
	  cd /workspaces/onepage-website.html
	  npm install
	  npm start
	  ```

  4. Open `index.html` in your browser (or run a static server) and enter a prompt in the input. If no image is uploaded, clicking **Generate with AI (Simulated)** will call the backend to produce an image from the prompt and then generate thumbnails.

Notes and caveats:
- The backend requires a valid Hugging Face API token and internet access.
- The server returns a PNG data URL; downstream thumbnail generation uses that image.
- If you prefer another provider (OpenAI, Replicate, etc.) I can swap the proxy to use that service instead.

Free provider option (Craiyon):

 - You can enable a free public generator using Craiyon (no API token required). Set `USE_CRAIYON=true` in your `.env` to use Craiyon for `/api/generate`.
 - Craiyon is community-run and may be rate-limited or less reliable than paid providers; treat it as a demo/fallback.

 Example `.env` values to use Craiyon (no HF token required):

 ```env
 USE_CRAIYON=true
 PORT=3000
 ```

New features added in this update:

- **Image editing / inpainting:** A new endpoint `/api/edit` accepts an uploaded image (data URL) and a prompt, forwards the request to the configured model, and returns an edited image. Use the "Edit uploaded image with AI" checkbox in the UI.
- **Presets & templates:** The frontend now has a `Preset` dropdown with a few quick styles (Cinematic, Vibrant, Soft, Minimal). Choosing a preset applies a style when generating thumbnails.
- **Container & deploy helpers:** Added `Dockerfile`, `.dockerignore`, and `Procfile` so you can deploy the server as a container or to platforms like Heroku/Render.
- **CI workflow:** A GitHub Actions workflow (`.github/workflows/ci.yml`) installs dependencies and checks the server health endpoint on push/PR to `main`.

Security & usage notes:
- Keep your `HF_API_TOKEN` secret (do not commit it). Use environment variables on your host or deployment platform.
- The `/api/edit` implementation is a demo: depending on the model and provider you might need to adjust request format (multipart/form-data, specific model endpoint, or use a dedicated image-editing model).

# onepage-website.html