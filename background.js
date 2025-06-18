chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "view-exif",
    title: "View Metadata",
    contexts: ["image"]
  });
});

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "view-exif" && info.srcUrl && tab && tab.id) {
    try {
      let fetchResponse = await fetch(info.srcUrl);
      let buffer = await fetchResponse.arrayBuffer();
      let base64 = arrayBufferToBase64(buffer);

      chrome.tabs.sendMessage(tab.id, {
        action: "extractMetadata",
        base64,
        contentType: fetchResponse.headers.get('Content-Type'),
        imageUrl: info.srcUrl
      }, async (resp) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
        }
        if (resp.retryUrl) {
          fetchResponse = await fetch(resp.retryUrl);
          buffer = await fetchResponse.arrayBuffer();
          base64 = arrayBufferToBase64(buffer);
          chrome.tabs.sendMessage(tab.id, {
            action: "extractMetadata",
            base64,
            contentType: fetchResponse.headers.get('Content-Type'),
            imageUrl: info.srcUrl,
            retryUrl: resp.retryUrl,
          });
        }
      });
    } catch (e) {
      console.error(e)
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("Failed to extract image metadata.")
      });
    }
  }
});
