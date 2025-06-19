function sendImage(files) {
  window.editorInstance.image.upload(files)
}

function resizeImage(file, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function fileToArrayBuffer(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function handleFiles(files) {
  const fileArray = Array.from(files);
  const processedFiles = await Promise.all(
    fileArray.map(async file => {
      if (!["image/png", "image/webp"].includes(file.type)) return file;
      const arrayBuffer = await fileToArrayBuffer(file);
      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // find metadata
      let metadata = null;
      if (file.type === "image/png") {
        metadata = await extractPngMetadata(arrayBuffer);
      } else if (file.type === "image/webp") {
        metadata = await extractWebpMetadata(arrayBuffer);
      }

      // find stealth-pnginfo
      await imgLoaded;
      if (!metadata || metadata == "{}") {
        metadata = await extractAlphaData(img);
      }

      // resize image if necessary
      let width = img.width;
      let height = img.height;
      if (width > 1280) {
        height = Math.round((1280 / width) * height);
        width = 1280;
      }
      let resizedFile = file;
      if (width !== img.width || height !== img.height) {
        resizedFile = await resizeImage(file, width, height);
      }

      // put stealth-pnginfo
      if (metadata) {
        const resizedImg = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = function (e) {
            const tempImg = new Image();
            tempImg.onload = () => resolve(tempImg);
            tempImg.src = e.target.result;
          };
          reader.readAsDataURL(resizedFile);
        });

        await new Promise(resolve => {
          addStealthPnginfo(resizedImg, metadata, 'alpha', canvas => {
            canvas.toBlob(blob => {
              resizedFile = new File([blob], file.name, { type: file.type });
              resolve();
            }, true);
          });
        });
      }
      return resizedFile;
    })
  );
  sendImage(processedFiles);
}


document.addEventListener('dragover', function (e) {
  if (e.target && !!e.target.closest('.fr-view') && e.dataTransfer.files
    && Array.from(e.dataTransfer.files).every(file => ["image/png", "image/webp"].includes(file.type))) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('drop', function (e) {
  // !e.target.matches('input[type="file"]')
  if (e.target && !!e.target.closest('.fr-view') && e.dataTransfer.files
    && Array.from(e.dataTransfer.files).every(file => ["image/png", "image/webp"].includes(file.type))) {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }
}, true);