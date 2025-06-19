const style = document.createElement('style');
style.textContent = `
  .aimetadataviewer-modal {
    position: absolute;
    top: 0;
    left: 0;
    flex-direction: column;
    width: 100%;
    min-height: 60px;
    background-color: rgba(0, 0, 0, 0.25);
    color: white;
    padding: 0px;
    border-radius: 4px;
    z-index: 999999;
    display: none;
    font-size: 1rem;
  }
  .aimetadataviewer-modal-content {
    position: relative;
    font-size: 0.8rem;
    overflow: auto;
  }
  .aimetadataviewer-modal-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .aimetadataviewer-modal-buttons {
    display: flex;
    padding: 4px;
    gap: 4px;
  }
  .aimetadataviewer-modal-buttons>* {
    border: 1px solid white;
    border-radius: 4px;
    padding: 2px;
    font-size: 1rem;    
    cursor: pointer;
    text-decoration: none !important;
  }
  .aimetadataviewer-modal-text {
    margin-top: 20px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .aimetadataviewer-modal-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    color: white;
    background-color: rgba(0,0,0,0.2);
  }
  .aimetadataviewer-modal-table th, .aimetadataviewer-modal-table td {
    border: 1px solid rgba(255,255,255,0.2);
    padding: 6px 8px;
    text-align: left;
    word-break: break-all;
    min-width: 200px;
  }
  .aimetadataviewer-modal-table th {
    background-color: rgba(0,0,0,0.3);
  }
  .aimetadataviewer-modal-table tr:nth-child(even) {
    background-color: rgba(0,0,0,0.1);
  }

  .aimetadataviewer-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 1000000;
    font-size: 1rem;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  .aimetadataviewer-toast.show {
    opacity: 1;
  }
`;
document.head.appendChild(style);

let modal = document.getElementById('aimetadataviewer-modal');
if (!modal) {
  modal = document.createElement('div');
  modal.id = 'aimetadataviewer-modal';
  modal.className = 'aimetadataviewer-modal';
  modal.innerHTML = `
    <div class="aimetadataviewer-modal-title">
      aimetadataviewer
      <div class="aimetadataviewer-modal-type"></div>
      <div class="aimetadataviewer-modal-buttons">
        <div class="aimetadataviewer-modal-copy-workflow">Copy workflow</div>
        <a class="aimetadataviewer-modal-download">💾</a>
        <div class="aimetadataviewer-modal-close">❌</div>
      </div>
    </div>
    <div class="aimetadataviewer-modal-content">
      <!-- content -->
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.aimetadataviewer-modal-close').onclick = () => modal.style.display = 'none';
}

function showToast(message, duration = 1000) {
  let toast = document.querySelector('.aimetadataviewer-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'aimetadataviewer-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function jsonToTable(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('no object found');
  }
  const keys = Object.keys(json);
  let html = '<table class="aimetadataviewer-modal-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>';
  keys.forEach(key => {
    let value = json[key];
    if (value === null || value === undefined) {
      value = '';
    } else if (typeof value === 'object') {
      value = JSON.stringify(value, null, 2);
    } else {
      value = String(value).replace(/\n/g, '<br>');
    }
    html += `<tr><td>${key}</td><td>${value}</td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

function mergeCommentToMetadata(metadata) {
  try {
    const commentObj = JSON.parse(metadata.Comment);
    const { Comment, ...rest } = metadata;
    return { ...rest, ...commentObj };
  } catch (e) {
    return metadata;
  }
}

function showModal(img, metadata, type, imageObject) {
  if (!metadata) {
    showToast("No metadata found.");
    return;
  }
  const rect = img.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const absoluteLeft = rect.left + window.scrollX;

  if (rect.width > 800) {
    modal.style.top = `${absoluteTop}px`;
    modal.style.left = `${absoluteLeft}px`;
    modal.style.width = `${rect.width}px`;
    modal.style.height = `${rect.height}px`;
  } else {
    modal.style.top = `20%`;
    modal.style.left = `20%`;
    modal.style.width = `60%`;
    modal.style.height = `60%`;
    modal.style.position = 'fixed';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  }

  modal.style.display = 'flex';
  modal.querySelector('.aimetadataviewer-modal-type').textContent = type;

  const copyBtn = modal.querySelector('.aimetadataviewer-modal-copy-workflow');
  copyBtn.style.display = 'none';

  const downloadBtn = modal.querySelector('.aimetadataviewer-modal-download');
  downloadBtn.href = imageObject.src;
  downloadBtn.download = imageObject.name;
  downloadBtn.setAttribute('target', '_blank');

  const content = modal.querySelector('.aimetadataviewer-modal-content');
  content.innerHTML = '';

  if (typeof metadata === 'object') {
    // show 'copy workflow' button if ComfyUI workflow.
    if (type.includes('ComfyUI')) {
      const workflow = metadata["workflow"];
      const prompt = metadata["prompt"];

      if (workflow) {
        copyBtn.style.display = '';
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(workflow);
            showToast("Workflow Copied!");
          } catch (err) { /* do nothing */  }
        };
      }

      metadata = JSON.parse(prompt || workflow);
    }

    // flatten "Comment" on base metadata json.
    metadata = mergeCommentToMetadata(metadata);
    content.innerHTML = jsonToTable(metadata);
  } else {
    const pre = document.createElement('pre');
    pre.className = 'aimetadataviewer-modal-text';
    pre.textContent = JSON.stringify(metadata);
    content.appendChild(pre);
  }
}