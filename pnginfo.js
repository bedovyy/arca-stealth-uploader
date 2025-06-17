function readPnginfo(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const buffer = e.target.result;
    // PNG 시그니처 확인
    const signature = new Uint8Array(buffer, 0, 8);
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (signature[i] !== pngSignature[i]) {
        callback([]); // PNG가 아니면 빈 배열
        return;
      }
    }
    // tEXt 청크 탐색
    const dataView = new DataView(buffer);
    let offset = 8;
    const textChunks = [];
    while (offset < buffer.byteLength) {
      const length = dataView.getUint32(offset);
      const type = String.fromCharCode(
        dataView.getUint8(offset + 4),
        dataView.getUint8(offset + 5),
        dataView.getUint8(offset + 6),
        dataView.getUint8(offset + 7)
      );
      if (type === 'tEXt') {
        const textData = new Uint8Array(buffer, offset + 8, length);
        const nullIndex = textData.indexOf(0);
        const keyword = String.fromCharCode(...textData.subarray(0, nullIndex));
        const value = String.fromCharCode(...textData.subarray(nullIndex + 1));
        textChunks.push({ keyword, value });
      }
      offset += 12 + length; // length + type(4) + CRC(4)
    }
    callback(textChunks);
  };
  reader.readAsArrayBuffer(file);
}
