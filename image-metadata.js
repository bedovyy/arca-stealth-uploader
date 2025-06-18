async function extractPngMetadata(arrayBuffer) {
  // check PNG signature
  const signature = new Uint8Array(arrayBuffer, 0, 8);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (signature[i] !== pngSignature[i]) {
      return null;
    }
  }
  // search tEXt chunks
  const dataView = new DataView(arrayBuffer);
  let offset = 8;
  const textChunks = [];
  while (offset < arrayBuffer.byteLength) {
    const length = dataView.getUint32(offset);
    const type = String.fromCharCode(
      dataView.getUint8(offset + 4),
      dataView.getUint8(offset + 5),
      dataView.getUint8(offset + 6),
      dataView.getUint8(offset + 7)
    );
    if (type === 'tEXt') {
      const textData = new Uint8Array(arrayBuffer, offset + 8, length);
      const nullIndex = textData.indexOf(0);
      const keyword = String.fromCharCode(...textData.subarray(0, nullIndex));
      const value = String.fromCharCode(...textData.subarray(nullIndex + 1));
      textChunks.push({ keyword, value });
    }
    offset += 12 + length;
  }
  if (textChunks.length === 1 && textChunks[0].keyword === "parameters") {
    return textChunks[0].value;
  }
  return JSON.stringify(Object.fromEntries(textChunks.map(item => [item.keyword, item.value])));
}

async function extractWebpMetadata(arrayBuffer) {
  try {
    const tags = ExifReader.load(arrayBuffer);
    if (tags.Model) {
      return JSON.stringify({ prompt: tags.Model?.description.replace(/^prompt:/, '').trim() });
    } else if (tags.UserComment && "UNICODE" == String.fromCharCode(...tags.UserComment.value.slice(0, 7))) {
      return (new TextDecoder('utf-16le').decode(new Uint8Array(tags.UserComment.value.slice(7)))).slice(1).slice(0, -1);
    }
  } catch (e) {
    console.error("Failed to extract metadata from WebP", e);
  }
  return null;
}

async function extractAlphaData(img) {
  return await new Promise(resolve => {
    readStealthPnginfo(img, 'alpha', result => {
      resolve(result);
    });
  });
}