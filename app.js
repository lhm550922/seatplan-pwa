const logEl = document.getElementById("log");
const swStatusEl = document.getElementById("swStatus");

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
}

document.getElementById("testBtn").addEventListener("click", () => {
  log("버튼 클릭 OK!");
});

document.getElementById("installHintBtn").addEventListener("click", () => {
  log("맥/윈도우(크롬/엣지): 주소창 오른쪽의 설치 아이콘 또는 메뉴 > 앱 설치를 찾으세요.");
});

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    swStatusEl.textContent = "미지원 브라우저";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    swStatusEl.textContent = "등록 완료 ✅";
    log("서비스워커 등록 완료");

    reg.addEventListener("updatefound", () => {
      log("서비스워커 업데이트 감지(새 버전)");
    });
  } catch (e) {
    swStatusEl.textContent = "등록 실패 ❌";
    log("서비스워커 등록 실패: " + e.message);
  }
}

registerSW();