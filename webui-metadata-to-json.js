function splitWebUIMetadata(input) {
  const lines = input.trim().split('\n');
  let prompt = [], negPrompt = [], meta = [];
  let mode = 'prompt';

  for (const line of lines) {
    let l = line.trim();
    if (!l) continue;

    if (l.startsWith('Negative prompt:')) {
      mode = 'negPrompt';
      l = l.slice('Negative prompt:'.length).trim();
    } else if (l.startsWith('Steps:')) {
      mode = 'meta';
    }

    if (mode === 'prompt') prompt.push(l);
    else if (mode === 'negPrompt') negPrompt.push(l);
    else if (mode === 'meta') meta.push(l);
  }

  return {
    prompt: prompt.join('\n'),
    negPrompt: negPrompt.join('\n'),
    meta: meta.join('\n')
  };
}

function parseWebUIMetaToKeyValue(metaStr) {
  const metaObj = {};
  metaStr.split('\n').forEach(line => {
    line.split(',').map(s => s.trim()).forEach(part => {
      const colon = part.indexOf(':');
      if (colon > -1) {
        metaObj[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
      }
    });
  });
  return metaObj;
}

function parseWebUIToJSON(metadata) {
  const { prompt, negPrompt, meta } = splitWebUIMetadata(metadata);
  const metas = parseWebUIMetaToKeyValue(meta);

  return { Prompt: prompt, 'Negative prompt': negPrompt, ...metas };
}