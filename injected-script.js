
function sendImage(files) {
  // const $popup = window.editorInstance.popups.get("imagesMultiUpload.popup").eq(0);
  // const instance = $popup.data("instance");
  // console.log(instance)
  window.editorInstance.image.upload(files)
}

function resizeImage(file, width, height) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}


async function handleFiles(files) {
  const fileArray = Array.from(files);
  const processedFiles = await Promise.all(
    fileArray.map(async file => {
      if (!["image/png", "image/webp"].includes(file.type)) return file;

      // 1. 원본 이미지 객체 생성
      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      await imgLoaded;  

      // 2. parsePNG로 tEXt 메타데이터 추출
      let metadata = null;
      let pngText = null;
      if (file.type === "image/png") {
        await new Promise(resolve => {
          readPnginfo(file, result => {
            pngText = result;
            console.log(pngText)
            if (pngText && pngText.length == 1 && pngText[0].keyword == "parameters") {  // WebUI
              metadata = pngText[0].value;
            } else {
              metadata = JSON.stringify(
                Object.fromEntries(pngText.map(item => [item.keyword, item.value]))
              );
            }
            resolve();
          });
        });
        console.log("tEXt 메타데이터:", pngText);
      } else if (file.type === "image/webp") { // WebP
        try {
          const buffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
          const tags = ExifReader.load(buffer);
          console.log("WebP 메타데이터:", tags);

          if (tags.Model) { // ComfyUI
            metadata = JSON.stringify({ prompt: tags.Model?.description.replace(/^prompt:/, '').trim() });
          } else if (tags.UserComment && "UNICODE" == String.fromCharCode(...tags.UserComment.value.slice(0, 7))) {
            metadata = (new TextDecoder('utf-16le').decode(new Uint8Array(tags.UserComment.value.slice(7)))).slice(1).slice(0, -1);
          }
          
        } catch (e) {
          console.error("WebP 메타데이터 추출 실패:", e);
        }
      }

      // 2. readStealthPnginfo로 알파 데이터 추출
      if (!metadata) {
        let alphaData = null;
        await new Promise(resolve => {
          readStealthPnginfo(img, 'alpha', result => {
            alphaData = result;
            resolve();
          });
        });
        console.log("알파데이터: ", alphaData);
        metadata = alphaData
      }

      console.log("metadata:", metadata);

      // 3. 리사이즈 필요 여부 판단 및 리사이즈
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

      // 4. 알파 데이터가 있으면 리사이즈 이미지에 복사
      if (metadata) {
        // 리사이즈된 이미지를 HTMLImageElement로 변환
        const resizedImg = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = function(e) {
            const tempImg = new Image();
            tempImg.onload = () => resolve(tempImg);
            tempImg.src = e.target.result;
          };
          reader.readAsDataURL(resizedFile);
        });

        // addStealthPnginfo로 데이터 삽입
        await new Promise(resolve => {
          addStealthPnginfo(resizedImg, metadata, 'alpha', canvas => {
            // canvas를 Blob/File로 변환
            canvas.toBlob(blob => {
              resizedFile = new File([blob], file.name, { type: file.type });
              resolve();
            }, file.type);
          });
        });
      }
      return resizedFile;
    })
  );
  sendImage(processedFiles);
}


document.addEventListener('dragover', function(e) {
  //e.target.matches('input[type="file"]')
  if (e.target && e.dataTransfer.files && Array.from(e.dataTransfer.files).every(file => ["image/png", "image/webp"].includes(file.type))) {
    e.preventDefault();
    e.stopPropagation();
  }
});

document.addEventListener('drop', function(e) {
  //e.target.matches('input[type="file"]')
  if (e.target && e.dataTransfer.files && Array.from(e.dataTransfer.files).every(file => ["image/png", "image/webp"].includes(file.type))) {
    e.preventDefault();
    e.stopPropagation();
    console.log('드롭 이벤트 발생!');
    handleFiles(e.dataTransfer.files);
    // 드롭 처리 로직
  }
}, true);

document.addEventListener('change', function(e) {
  console.log(e.target);
  if (e.target && e.target.matches('input[type="file"]')) {
    const files = e.target.files;
    console.log('체인이 이벤트 발생!')
    handleFiles(files);
    // 파일 처리 로직 (예: 워터마크 추가 등)
  }
}, true); // 캡처 단계에서 이벤트 감지