const style = document.createElement('style');
style.textContent = `
  .metadata-modal {
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
  .metadata-modal-content {
    position: relative;
    font-size: 0.8rem;
    overflow: auto;
  }
  .metadata-modal-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .metadata-modal-buttons {
    display: flex;
    padding: 4px;
    gap: 4px;
  }
  .metadata-modal-buttons>div {
    border: 1px solid white;
    border-radius: 4px;
    padding: 2px;
    font-size: 0.75rem;    
    cursor: pointer;
  }
  .metadata-modal-text {
    margin-top: 20px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .metadata-modal-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    color: white;
    background-color: rgba(0,0,0,0.2);
  }
  .metadata-modal-table th, .metadata-modal-table td {
    border: 1px solid rgba(255,255,255,0.2);
    padding: 6px 8px;
    text-align: left;
    word-break: break-all;
    min-width: 200px;
  }
  .metadata-modal-table th {
    background-color: rgba(0,0,0,0.3);
  }
  .metadata-modal-table tr:nth-child(even) {
    background-color: rgba(0,0,0,0.1);
  }

  .toast {
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
  .toast.show {
    opacity: 1;
  }
`;
document.head.appendChild(style);

let modal = document.getElementById('metadata-modal');
if (!modal) {
  modal = document.createElement('div');
  modal.id = 'metadata-modal';
  modal.className = 'metadata-modal';
  modal.innerHTML = `
    <div class="metadata-modal-title">
      Metadata
      <div class="metadata-modal-type"></div>
      <div class="metadata-modal-buttons">
        <div class="metadata-modal-copy-workflow">Copy workflow</div>
        <div class="metadata-modal-close">❌</div>
      </div>
    </div>
    <div class="metadata-modal-content">
      <!-- content -->
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.metadata-modal-close').onclick = () => modal.style.display = 'none';
}

function showToast(message, duration = 1000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
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
  let html = '<table class="metadata-modal-table"><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>';
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

function showMetadataModal(img, metadata, type) {
  const rect = img.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const absoluteLeft = rect.left + window.scrollX;

  modal.style.top = `${absoluteTop}px`;
  modal.style.left = `${absoluteLeft}px`;
  modal.style.width = `${rect.width}px`;
  modal.style.maxHeight = `${rect.height}px`;
  modal.style.display = 'flex';
  modal.querySelector('.metadata-modal-type').textContent = type;

  const copyBtn = modal.querySelector('.metadata-modal-copy-workflow');
  copyBtn.style.display = 'none';

  const content = modal.querySelector('.metadata-modal-content');
  content.innerHTML = '';

  if (typeof metadata === 'object' && metadata !== null) {
    // show 'copy workflow' button if ComfyUI workflow.
    if (type.includes('workflow')) {
      copyBtn.style.display = '';
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(metadata));
          showToast("Workflow Copied!");
        } catch (err) { /* do nothing */  }
      };
    }

    // flatten "Comment" on base metadata json.
    metadata = mergeCommentToMetadata(metadata);
    content.innerHTML = jsonToTable(metadata);
  } else {
    const pre = document.createElement('pre');
    pre.className = 'metadata-modal-text';
    pre.textContent = (metadata) ? JSON.stringify(metadata) : 'no metadata';
    content.appendChild(pre);
  }
}