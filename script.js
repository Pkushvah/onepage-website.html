(function(){
  const imageInput = document.getElementById('imageInput');
  const previewArea = document.getElementById('previewArea');
  const outputs = document.getElementById('outputs');
  const aiButton = document.getElementById('aiGenerate');
  const manualButton = document.getElementById('manualGenerate');
  const promptInput = document.getElementById('promptInput');
  const aiEditCheckbox = document.getElementById('aiEditCheckbox');
  const presetSelect = document.getElementById('presetSelect');

  let loadedImage = null;

  imageInput.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = ()=>{
      loadedImage = img;
      showPreview(img);
      URL.revokeObjectURL(url);
    }
    img.src = url;
  });

  aiButton.addEventListener('click', async ()=>{
    const prompt = (promptInput.value||'').trim();
    const preset = (presetSelect && presetSelect.value) || 'default';

    // If user checked edit, send uploaded image + prompt to backend edit endpoint
    if(aiEditCheckbox && aiEditCheckbox.checked){
      if(!loadedImage){ alert('Please upload an image to edit.'); return }
      if(!prompt){ alert('Please enter a prompt describing the edit.'); return }
      aiButton.textContent = 'Editing...'; aiButton.disabled = true;
      try{
        const dataUrl = getDataUrlFromImage(loadedImage);
        const res = await fetch('/api/edit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt, image: dataUrl}) });
        if(!res.ok){ const err = await res.json().catch(()=>({error:'unknown'})); throw new Error(err.error||'AI edit failed'); }
        const json = await res.json();
        const img = new Image(); img.src = json.image; await new Promise((r,rej)=>{img.onload=r;img.onerror=rej});
        loadedImage = img; showPreview(img);
        const style = pickStyleFromPrompt(prompt);
        generateAllThumbnails(loadedImage, style, true);
      }catch(err){ alert('AI edit failed: '+err.message) }
      finally{ aiButton.textContent='Generate with AI'; aiButton.disabled=false }
      return;
    }

    // If there's no uploaded image, generate one from prompt
    if(!loadedImage){
      if(!prompt){ alert('Please enter a prompt to generate an image with AI.'); return }
      aiButton.textContent = 'Generating...'; aiButton.disabled = true;
      try{
        const img = await generateImageFromAI(prompt);
        loadedImage = img; showPreview(img);
        const style = pickStyleFromPrompt(prompt);
        generateAllThumbnails(loadedImage, style, true);
      }catch(err){ alert('AI generation failed: '+err.message) }
      finally{ aiButton.textContent='Generate with AI'; aiButton.disabled=false }
      return;
    }

    // Otherwise apply preset/style to uploaded image
    const style = pickStyleFromPreset(preset, prompt);
    generateAllThumbnails(loadedImage, style, true);
  });

  manualButton.addEventListener('click', ()=>{
    if(!loadedImage){alert('Please upload an image first.');return}
    generateAllThumbnails(loadedImage, {filter:'none',text:''}, false);
  });

  function showPreview(img){
    previewArea.innerHTML = '';
    const clone = document.createElement('img');
    clone.src = img.src; clone.style.maxWidth='100%'; clone.style.borderRadius='6px';
    previewArea.appendChild(clone);
  }

  function pickStyleFromPrompt(prompt){
    const p = prompt.toLowerCase();
    if(p.includes('cinematic')||p.includes('dramatic')) return {filter:'cinematic',text:'CINEMATIC'};
    if(p.includes('bold')||p.includes('big text')) return {filter:'vibrant',text:'BIG TITLE'};
    if(p.includes('minimal')||p.includes('clean')) return {filter:'soft',text:''};
    return {filter:'vibrant',text:'NEW VIDEO'};
  }

  function pickStyleFromPreset(preset, prompt){
    if(preset === 'cinematic') return {filter:'cinematic', text: (prompt||'CINEMATIC').toUpperCase()};
    if(preset === 'vibrant') return {filter:'vibrant', text: (prompt||'NEW VIDEO').toUpperCase()};
    if(preset === 'soft') return {filter:'soft', text: (prompt||'').toUpperCase()};
    if(preset === 'minimal') return {filter:'none', text: (prompt||'').toUpperCase()};
    return pickStyleFromPrompt(prompt||'');
  }

  function generateAllThumbnails(img, style, isAI){
    outputs.innerHTML='';
    const sizes = [
      {w:1280,h:720,label:'YouTube 1280×720'},
      {w:640,h:360,label:'Social 640×360'},
      {w:300,h:169,label:'Small 300×169'}
    ];
    sizes.forEach(s=>{
      const canvas = document.createElement('canvas');
      canvas.width = s.w; canvas.height = s.h;
      const ctx = canvas.getContext('2d');
      drawCoverImage(ctx, img, s.w, s.h);
      applyStyle(ctx, s.w, s.h, style, isAI);
      const dataUrl = canvas.toDataURL('image/jpeg',0.9);
      renderOutputCard(dataUrl, s.label, canvas);
    });
  }

  function drawCoverImage(ctx, img, w, h){
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const ir = iw/ih, cr = w/h;
    let sw, sh, sx, sy;
    if(ir > cr){
      sh = ih; sw = ih*cr; sx = (iw - sw)/2; sy = 0;
    } else {
      sw = iw; sh = iw/cr; sx = 0; sy = (ih - sh)/2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0,0,w,h);
  }

  function applyStyle(ctx, w, h, style, isAI){
    if(style.filter === 'cinematic'){
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0,0,w,h);
      colorOverlay(ctx,w,h,'#00162e',0.15);
      contrast(ctx,0.08);
      addText(ctx,w,h, style.text || 'CINEMATIC', {size:72,align:'left'});
    } else if(style.filter === 'vibrant'){
      colorOverlay(ctx,w,h,'rgba(255,100,70,0.12)',1);
      saturate(ctx,0.18);
      addText(ctx,w,h, style.text || 'NEW VIDEO', {size:64,align:'center'});
    } else if(style.filter === 'soft'){
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(0,0,w,h);
      addText(ctx,w,h, style.text || '', {size:48,align:'right'});
    } else {
      if(isAI && style.text) addText(ctx,w,h, style.text, {size:56,align:'center'});
    }
  }

  function colorOverlay(ctx,w,h,color,alpha){
    ctx.fillStyle = color; ctx.globalAlpha = alpha||1; ctx.fillRect(0,0,w,h); ctx.globalAlpha =1;
  }

  function saturate(ctx,amt){
    // quick saturation by drawing a multiply layer
    ctx.globalCompositeOperation='soft-light'; ctx.fillStyle='rgba(255,255,255,'+amt+')'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.globalCompositeOperation='source-over';
  }
  function contrast(ctx,amt){
    ctx.globalCompositeOperation='overlay'; ctx.fillStyle='rgba(255,255,255,'+amt+')'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.globalCompositeOperation='source-over';
  }

  function addText(ctx,w,h,text,opt){
    if(!text) return;
    ctx.save();
    ctx.fillStyle='white';
    ctx.textBaseline='bottom';
    const size = opt.size || Math.round(h*0.12);
    ctx.font = 'bold '+size+'px sans-serif';
    const padding = 20;
    let x = w/2; let align='center';
    if(opt.align === 'left'){x = padding; align='left'}
    if(opt.align === 'right'){x = w - padding; align='right'}
    ctx.textAlign = align;
    // text shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur=10; ctx.shadowOffsetY=4;
    ctx.fillText(text, x, h - padding);
    ctx.restore();
  }

  function renderOutputCard(dataUrl,label,canvas){
    const card = document.createElement('div'); card.className='thumb-card';
    const img = document.createElement('img'); img.src = dataUrl; card.appendChild(img);
    const meta = document.createElement('div'); meta.className='thumb-meta';
    const sizeLabel = document.createElement('div'); sizeLabel.textContent = label;
    const dl = document.createElement('button'); dl.className='button'; dl.textContent='Download';
    dl.addEventListener('click', ()=>downloadCanvas(canvas, label.replace(/\s+/g,'_')+'.jpg'));
    meta.appendChild(sizeLabel); meta.appendChild(dl);
    card.appendChild(meta);
    outputs.appendChild(card);
  }

  function downloadCanvas(canvas, filename){
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/jpeg',0.92); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  function getDataUrlFromImage(img){
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const cx = c.getContext('2d'); cx.drawImage(img,0,0); return c.toDataURL('image/png');
  }

  async function generateImageFromAI(prompt){
    const res = await fetch('/api/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({prompt})
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({error:'unknown'}));
      throw new Error(err.error || 'AI API error');
    }
    const data = await res.json();
    return await new Promise((resolve, reject)=>{
      const img = new Image(); img.onload = ()=>resolve(img); img.onerror = reject; img.src = data.image;
    });
  }

})();
