// stealth-pnginfo.js
// JavaScript port of https://github.com/catboxanon/comfyui_stealth_pnginfo/blob/main/scripts/stealth_pnginfo.py
// Compatible with Python implementation: data written/read here can be read/written by the Python script.

const STEALTH_SIGNATURES = {
  alpha: {
    uncompressed: "stealth_pnginfo",
    compressed: "stealth_pngcomp"
  },
  rgb: {
    uncompressed: "stealth_rgbinfo",
    compressed: "stealth_rgbcomp"
  }
};

// Helper: Convert string to binary string
function stringToBinary(str) {
  return Array.from(new TextEncoder().encode(str))
    .map(byte => byte.toString(2).padStart(8, "0"))
    .join("");
}

// Helper: Convert binary string to string
function binaryToString(bin) {
  const bytes = [];
  for (let i = 0; i < bin.length; i += 8) {
    bytes.push(parseInt(bin.slice(i, i + 8), 2));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// Helper: Gzip compress/decompress (requires pako.js)
function gzipCompress(str) {
  return pako.gzip(str);
}
function gzipDecompress(buf) {
  return new TextDecoder().decode(pako.ungzip(buf));
}

// Prepare binary data for embedding
function prepareStealthData(param, mode = "alpha", compressed = false) {
  const sig = STEALTH_SIGNATURES[mode][compressed ? "compressed" : "uncompressed"];
  const signatureBin = stringToBinary(sig);
  let paramBytes;
  if (compressed) {
    paramBytes = gzipCompress(param);
  } else {
    paramBytes = new TextEncoder().encode(param);
  }
  const paramBin = Array.from(paramBytes)
    .map(byte => byte.toString(2).padStart(8, "0"))
    .join("");
  const paramLenBin = paramBin.length.toString(2).padStart(32, "0");
  return signatureBin + paramLenBin + paramBin;
}

// Add stealth pnginfo to image (mode: 'alpha' or 'rgb')
function addStealthPnginfo(img, param, mode = "alpha", callback, compressed = false) {
  // img: HTMLImageElement, param: string, callback(canvas)
  const width = img.width;
  const height = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const binaryData = prepareStealthData(param, mode, compressed);

  let index = 0;
  let done = false;
  for (let x = 0; x < width && !done; x++) {
    for (let y = 0; y < height && !done; y++) {
      const i = (y * width + x) * 4;
      if (index >= binaryData.length) {
        done = true;
        break;
      }
      if (mode === "alpha") {
        // RGBA: set LSB of alpha
        data[i + 3] = (data[i + 3] & ~1) | parseInt(binaryData[index]);
        index += 1;
      } else {
        // RGB: set LSB of R, G, B
        data[i] = (data[i] & ~1) | parseInt(binaryData[index]);
        if (index + 1 < binaryData.length) {
          data[i + 1] = (data[i + 1] & ~1) | parseInt(binaryData[index + 1]);
        }
        if (index + 2 < binaryData.length) {
          data[i + 2] = (data[i + 2] & ~1) | parseInt(binaryData[index + 2]);
        }
        index += 3;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  callback(canvas);
}

// Read stealth pnginfo from image
function readStealthPnginfo(img, mode = "alpha", callback) {
  // img: HTMLImageElement, callback(paramString or null)
  const width = img.width;
  const height = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let hasAlpha = true;
  let sigLen = STEALTH_SIGNATURES.alpha.uncompressed.length * 8;
  let bufferA = "", bufferRGB = "";
  let indexA = 0, indexRGB = 0;
  let sigConfirmed = false, confirmingSignature = true;
  let readingParamLen = false, readingParam = false, readEnd = false;
  let paramLen = 0, binaryData = "";
  let detectedMode = null, compressed = false;

  for (let x = 0; x < width && !readEnd; x++) {
    for (let y = 0; y < height && !readEnd; y++) {
      const i = (y * width + x) * 4;
      // Always read alpha and rgb
      bufferA += (data[i + 3] & 1).toString();
      indexA += 1;
      bufferRGB += (data[i] & 1).toString();
      bufferRGB += (data[i + 1] & 1).toString();
      bufferRGB += (data[i + 2] & 1).toString();
      indexRGB += 3;

      if (confirmingSignature) {
        if (indexA === sigLen) {
          const sig = binaryToString(bufferA);
          if (sig === STEALTH_SIGNATURES.alpha.uncompressed || sig === STEALTH_SIGNATURES.alpha.compressed) {
            confirmingSignature = false;
            sigConfirmed = true;
            readingParamLen = true;
            detectedMode = "alpha";
            compressed = (sig === STEALTH_SIGNATURES.alpha.compressed);
            bufferA = "";
            indexA = 0;
          } else {
            readEnd = true;
            break;
          }
        } else if (indexRGB === sigLen) {
          const sig = binaryToString(bufferRGB);
          if (sig === STEALTH_SIGNATURES.rgb.uncompressed || sig === STEALTH_SIGNATURES.rgb.compressed) {
            confirmingSignature = false;
            sigConfirmed = true;
            readingParamLen = true;
            detectedMode = "rgb";
            compressed = (sig === STEALTH_SIGNATURES.rgb.compressed);
            bufferRGB = "";
            indexRGB = 0;
          }
        }
      } else if (readingParamLen) {
        if (detectedMode === "alpha") {
          if (indexA === 32) {
            paramLen = parseInt(bufferA, 2);
            readingParamLen = false;
            readingParam = true;
            bufferA = "";
            indexA = 0;
          }
        } else {
          if (indexRGB >= 33) {
            // The last bit is for alignment, ignore
            bufferRGB = bufferRGB.slice(0, -1);
            paramLen = parseInt(bufferRGB, 2);
            readingParamLen = false;
            readingParam = true;
            bufferRGB = "";
            indexRGB = 0;
          }
        }
      } else if (readingParam) {
        if (detectedMode === "alpha") {
          if (indexA === paramLen) {
            binaryData = bufferA;
            readEnd = true;
            break;
          }
        } else {
          if (indexRGB >= paramLen) {
            binaryData = bufferRGB.slice(0, paramLen);
            readEnd = true;
            break;
          }
        }
      }
    }
  }
  if (sigConfirmed && binaryData.length > 0) {
    // Convert binary string to Uint8Array
    const bytes = [];
    for (let i = 0; i < binaryData.length; i += 8) {
      bytes.push(parseInt(binaryData.slice(i, i + 8), 2));
    }
    let decoded;
    try {
      if (compressed) {
        decoded = gzipDecompress(new Uint8Array(bytes));
      } else {
        decoded = new TextDecoder().decode(new Uint8Array(bytes));
      }
      callback(decoded);
    } catch (e) {
      callback(null);
    }
  } else {
    callback(null);
  }
}
