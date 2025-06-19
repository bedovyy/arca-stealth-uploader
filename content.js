function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function extractImageMetadataFromBuffer(buffer, contentType, img) {
  let metadata = null;
  let type = "unknown";
  if (contentType === "image/png") {
    type = "PNG";
    metadata = await extractPngMetadata(buffer);
  } else if (contentType === "image/webp") {
    type = "WEBP";
    metadata = await extractWebpMetadata(buffer);
  }

  if (!metadata || metadata == "{}") {
    metadata = await extractAlphaData(img);
    if (metadata) {
      type = "Alpha";
    }
  }

  if (metadata) {
    try {
      metadata = JSON.parse(metadata);
      if (metadata["Software"]) {           // NAI
        type = `NovelAI (${type})`;
      } else if (metadata["prompt"]) {      // ComfyUI
        type = `ComfyUI (${type})`;
      }
    } catch (e) {
      try {                                 // WebUI
        metadata = parseWebUIToJSON(metadata);
        type = `SDWebUI (${type})`
      } catch (e) { /* do nothing */ }
    }
  }
  return { metadata, type };
}

let imageObject = null;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractMetadata") {
    (async () => {
      try {
        const buffer = base64ToArrayBuffer(request.base64);
        const blob = new Blob([buffer], { type: request.contentType });
        if (imageObject) {
          URL.revokeObjectURL(imageObject.src);
          imageObject.remove();
        }
        imageObject = new Image();
        imageObject.src = URL.createObjectURL(blob);
        imageObject.name = request.imageUrl.split('/').pop().split('?')[0];
        await new Promise((resolve, reject) => {
          imageObject.onload = resolve;
          imageObject.onerror = reject;
        });
        let { metadata, type } = await extractImageMetadataFromBuffer(buffer, request.contentType, imageObject);

        const imgs = Array.from(document.querySelectorAll('img'));
        const targetImg = imgs.find(img => img.src === request.imageUrl);
        if (!metadata && !request.retryUrl && targetImg) {
          const closestAnchor = targetImg.closest('a');
          if (closestAnchor) {
            const href = closestAnchor.href;
            if (href !== request.imageUrl && /\.(png|webp)/i.test(href)) {
              sendResponse({ retryUrl: href });
              showToast("Check original image...");
              return;
            }
          }
        }
        showModal(targetImg, metadata, type, imageObject);
        sendResponse({ metadata });
      } catch (e) {
        console.error(e);
        sendResponse({ e });
      }
    })();
    return true;
  }
});


function injectScript(url) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(url);
    script.onload = () => resolve();
    (document.head || document.documentElement).appendChild(script);
  });
}

// only on arcalive write page.
if (new RegExp('^https://arca\\.live/b/[^/]+/write').test(window.location.href)) {
  (async () => {
    await injectScript('lib/pako.min.js');
    await injectScript('lib/exif-reader.js');
    await injectScript('stealth-pnginfo.js');
    await injectScript('image-metadata.js');
    await injectScript('injected-script.js');
  })();
}