const tokenInput = document.querySelector('input[name="token"]');
const tokenValue = tokenInput ? tokenInput.value : null;
console.log(tokenValue); // "c735ba964480f639"

// content script 예시
function injectScript(url) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(url);
    script.onload = () => resolve();
    (document.head || document.documentElement).appendChild(script);
  });
}

(async () => {
  await injectScript('exif-reader.js');      // 먼저 유틸 함수 주입
  await injectScript('stealth-pnginfo.js');      // 먼저 유틸 함수 주입
  await injectScript('pnginfo.js');              // 먼저 유틸 함수 주입
  await injectScript('injected-script.js');      // 그 다음 메인 스크립트 주입
})();

console.log("It's log from content.js!");