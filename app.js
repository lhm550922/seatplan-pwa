const logEl = document.getElementById("log");
const swStatusEl = document.getElementById("swStatus");

const studentsInput = document.getElementById("studentsInput");
const colsSel = document.getElementById("cols");
const rowsSel = document.getElementById("rows");
const seatTypeSel = document.getElementById("seatType");

const autoFillBtn = document.getElementById("autoFillBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const printBtn = document.getElementById("printBtn");

const showSeatNo = document.getElementById("showSeatNo");
const showEmpty = document.getElementById("showEmpty");

const gridEl = document.getElementById("grid");
const canvas = document.getElementById("exportCanvas");

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
}

function parseStudents(text) {
  // 줄바꿈 또는 쉼표로 입력 가능
  const raw = text
    .replace(/\r/g, "\n")
    .split(/[\n,]/g)
    .map(s => s.trim())
    .filter(Boolean);

  // 중복 제거(선택): 같은 이름 여러 명 있을 수 있으면 이 부분 제거 가능
  // 여기서는 중복을 허용하는 게 더 현실적이라 중복 제거 안 함.
  return raw;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ====== 좌석 상태 ======
let cols = 5;
let rows = 6;
let seats = []; // { id, name: string|null }

function seatCount() {
  return cols * rows;
}

function buildSeatModel() {
  seats = Array.from({ length: seatCount() }, (_, i) => ({
    id: i,
    name: null
  }));
}

function renderGrid() {
  // 좌석 타입 표시만(2인 짝상은 2칸을 1칸처럼 보이게)
  // pair 모드에서는 "각 행마다 2인 짝상 + (남는 1인)" 형태로 단순 구현
  // (진짜 짝상 로직/레이아웃 편집기는 다음 단계에서 확장)
  const seatType = seatTypeSel.value; // single | pair

  // CSS grid 설정
  const colTemplate = seatType === "pair"
    ? `repeat(${Math.floor(cols / 2)}, 270px) ${cols % 2 === 1 ? "130px" : ""}`.trim()
    : `repeat(${cols}, 130px)`;

  gridEl.style.gridTemplateColumns = colTemplate;

  gridEl.innerHTML = "";

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    const div = document.createElement("div");

    // pair 표시용: 짝상 모드에서 "짝의 왼쪽 좌석"만 렌더링하고 오른쪽은 건너뜀(시각적 간소화)
    if (seatType === "pair") {
      const isRight = (i % cols) % 2 === 1; // 같은 행 기준 짝의 오른쪽
      if (isRight) continue;
      div.className = "seat pair";
    } else {
      div.className = "seat";
    }

    div.dataset.seatId = String(seat.id);
    div.draggable = true;

    if (showSeatNo.checked) {
      const no = document.createElement("div");
      no.className = "no";
      no.textContent = String(seat.id + 1);
      div.appendChild(no);
    }

    const name = document.createElement("div");
    name.className = "name";

    if (seat.name) {
      name.textContent = seat.name;
    } else {
      if (showEmpty.checked) {
        name.textContent = "빈자리";
        name.classList.add("empty");
      } else {
        name.textContent = "";
      }
    }

    div.appendChild(name);

    // Drag & Drop
    div.addEventListener("dragstart", onDragStart);
    div.addEventListener("dragend", onDragEnd);
    div.addEventListener("dragover", onDragOver);
    div.addEventListener("dragleave", onDragLeave);
    div.addEventListener("drop", onDrop);

    gridEl.appendChild(div);
  }
}

// ====== 드래그 앤 드롭 ======
let draggingSeatId = null;

function getSeatById(id) {
  return seats.find(s => s.id === id) || null;
}

function onDragStart(e) {
  const seatId = Number(e.currentTarget.dataset.seatId);
  draggingSeatId = seatId;

  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(seatId));
  e.currentTarget.classList.add("dragging");
}

function onDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  draggingSeatId = null;

  // 모든 표시 제거
  document.querySelectorAll(".seat.dropOk,.seat.dropBad")
    .forEach(el => el.classList.remove("dropOk", "dropBad"));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("dropOk");
}

function onDragLeave(e) {
  e.currentTarget.classList.remove("dropOk", "dropBad");
}

function onDrop(e) {
  e.preventDefault();
  const fromId = Number(e.dataTransfer.getData("text/plain"));
  const toId = Number(e.currentTarget.dataset.seatId);

  if (Number.isNaN(fromId) || Number.isNaN(toId)) return;
  if (fromId === toId) return;

  const a = getSeatById(fromId);
  const b = getSeatById(toId);
  if (!a || !b) return;

  // 자리 교체(이름 swap)
  [a.name, b.name] = [b.name, a.name];

  renderGrid();
  log(`자리 교체: ${a.name ?? "빈자리"} ↔ ${b.name ?? "빈자리"}`);
}

// ====== 버튼 동작 ======
function applyGridSizeFromUI() {
  cols = Number(colsSel.value);
  rows = Number(rowsSel.value);
  buildSeatModel();
  renderGrid();
  log(`격자 크기: ${cols}×${rows} (총 ${seatCount()}자리)`);
}

function autoFill() {
  const list = parseStudents(studentsInput.value);
  if (list.length === 0) {
    log("학생 명단이 비어 있어요. 먼저 입력해줘.");
    return;
  }

  // 좌석 초기화
  seats.forEach(s => (s.name = null));

  // 앞에서부터 채우기(기본)
  const max = Math.min(list.length, seats.length);
  for (let i = 0; i < max; i++) {
    seats[i].name = list[i];
  }

  renderGrid();
  log(`자동 배치 완료: ${max}명 배치 / ${seats.length}자리`);
}

function doShuffle() {
  const currentNames = seats.map(s => s.name).filter(Boolean);
  if (currentNames.length === 0) {
    // 입력 기반 셔플도 지원
    const list = parseStudents(studentsInput.value);
    if (list.length === 0) {
      log("셔플할 학생이 없어요. 먼저 입력하거나 자동 배치를 해줘.");
      return;
    }
    const shuffled = shuffle(list);
    seats.forEach(s => (s.name = null));
    const max = Math.min(shuffled.length, seats.length);
    for (let i = 0; i < max; i++) seats[i].name = shuffled[i];
    renderGrid();
    log("입력 명단을 셔플해서 배치했어.");
    return;
  }

  const shuffled = shuffle(currentNames);
  seats.forEach(s => (s.name = null));
  for (let i = 0; i < shuffled.length; i++) seats[i].name = shuffled[i];
  renderGrid();
  log("현재 배치를 셔플했어.");
}

function clearAll() {
  seats.forEach(s => (s.name = null));
  renderGrid();
  log("모든 좌석을 비웠어.");
}

function downloadPng() {
  // 배치도를 캔버스로 그려서 PNG 저장(출력 품질 안정)
  const seatType = seatTypeSel.value;
  const showNo = showSeatNo.checked;
  const showEmptyLabel = showEmpty.checked;

  // 캔버스 크기(인쇄용 고해상도)
  const W = 2200;
  const H = 1400;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, H);

  // 타이틀
  const title = "자리배치";
  const date = new Date().toLocaleDateString();
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(title, 70, 90);
  ctx.fillStyle = "#9ca3af";
  ctx.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(date, 70, 125);

  // 칠판
  ctx.fillStyle = "rgba(34,197,94,0.10)";
  ctx.strokeStyle = "rgba(34,197,94,0.45)";
  roundRect(ctx, 70, 155, W - 140, 70, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#bbf7d0";
  ctx.font = "700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("칠판", W / 2 - 25, 203);

  // 그리드 영역 계산
  const top = 260;
  const left = 120;
  const gap = 18;

  const seatW_single = 220;
  const seatH = 110;

  // pair는 2자리 묶음 표시만 단순 적용(폭만 넓게)
  const seatW = (seatType === "pair") ? 460 : seatW_single;

  // 그려질 열 수
  const drawCols = (seatType === "pair") ? Math.ceil(cols / 2) : cols;

  // 전체 너비/높이
  const gridW = drawCols * seatW + (drawCols - 1) * gap;
  const gridH = rows * seatH + (rows - 1) * gap;

  // 가운데 정렬
  const startX = (W - gridW) / 2;
  const startY = top;

  // 좌석 렌더링
  let drawIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < drawCols; c++) {
      const x = startX + c * (seatW + gap);
      const y = startY + r * (seatH + gap);

      // seatId 매핑: pair 모드면 한 칸이 실제 좌석 2개(왼쪽 id)로 대표
      // single 모드면 그대로
      const seatId = seatType === "pair"
        ? (r * cols + c * 2)  // 왼쪽 좌석 id
        : (r * cols + c);

      const seat = getSeatById(seatId);

      // 좌석 배경
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, x, y, seatW, seatH, 18);
      ctx.fill();
      ctx.stroke();

      // 좌석번호
      if (showNo) {
        ctx.fillStyle = "rgba(156,163,175,0.95)";
        ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(String(seatId + 1), x + 14, y + 28);
      }

      // 이름
      const name = seat?.name;
      if (name) {
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawCenteredText(ctx, name, x + seatW / 2, y + 70, seatW - 30);
      } else if (showEmptyLabel) {
        ctx.fillStyle = "rgba(156,163,175,0.75)";
        ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText("빈자리", x + seatW / 2 - 30, y + 72);
      }

      drawIndex++;
      if (startY + gridH > H - 80) break;
    }
  }

  // 저장
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `seatplan_${new Date().toISOString().slice(0,10)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  log("PNG 저장 완료!");
}

function printPlan() {
  // 간단 인쇄: 새 창에 이미지 띄워 프린트
  const seatType = seatTypeSel.value;
  const showNo = showSeatNo.checked;
  const showEmptyLabel = showEmpty.checked;

  // PNG를 먼저 만들고 그 이미지를 인쇄
  const W = 2000;
  const H = 1300;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // 상단 제목
  ctx.fillStyle = "#111827";
  ctx.font = "800 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("자리배치", 70, 80);
  ctx.fillStyle = "#6b7280";
  ctx.font = "500 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(new Date().toLocaleDateString(), 70, 112);

  // 칠판
  ctx.fillStyle = "rgba(34,197,94,0.10)";
  ctx.strokeStyle = "rgba(34,197,94,0.35)";
  roundRect(ctx, 70, 140, W - 140, 60, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#166534";
  ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("칠판", W / 2 - 20, 178);

  // grid
  const top = 230;
  const gap = 16;
  const seatW_single = 210;
  const seatH = 100;
  const seatW = (seatType === "pair") ? 440 : seatW_single;
  const drawCols = (seatType === "pair") ? Math.ceil(cols / 2) : cols;

  const gridW = drawCols * seatW + (drawCols - 1) * gap;
  const startX = (W - gridW) / 2;
  const startY = top;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < drawCols; c++) {
      const x = startX + c * (seatW + gap);
      const y = startY + r * (seatH + gap);
      const seatId = seatType === "pair" ? (r * cols + c * 2) : (r * cols + c);
      const seat = getSeatById(seatId);

      ctx.fillStyle = "#f3f4f6";
      ctx.strokeStyle = "#d1d5db";
      roundRect(ctx, x, y, seatW, seatH, 14);
      ctx.fill();
      ctx.stroke();

      if (showNo) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(String(seatId + 1), x + 12, y + 24);
      }

      const name = seat?.name;
      if (name) {
        ctx.fillStyle = "#111827";
        ctx.font = "800 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        drawCenteredText(ctx, name, x + seatW / 2, y + 62, seatW - 24);
      } else if (showEmptyLabel) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText("빈자리", x + seatW / 2 - 26, y + 64);
      }
    }
  }

  const dataUrl = canvas.toDataURL("image/png");

  const w = window.open("", "_blank");
  if (!w) {
    log("팝업이 막혀서 인쇄창을 열 수 없어요. 브라우저 팝업 허용 후 다시 시도해줘.");
    return;
  }
  w.document.write(`
    <html>
      <head><title>자리배치 인쇄</title></head>
      <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:flex-start;">
        <img src="${dataUrl}" style="width:100%;max-width:1000px;" />
        <script>
          setTimeout(() => { window.print(); }, 300);
        </script>
      </body>
    </html>
  `);
  w.document.close();

  log("인쇄창을 열었어.");
}

// ====== 캔버스 유틸 ======
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCenteredText(ctx, text, cx, cy, maxWidth) {
  // 너무 길면 자동 축소(간단)
  let size = 34;
  ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  while (ctx.measureText(text).width > maxWidth && size > 16) {
    size -= 2;
    ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

// ====== 서비스워커 등록(기존 유지) ======
async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    swStatusEl.textContent = "미지원 브라우저";
    return;
  }
  try {
    await navigator.serviceWorker.register("./sw.js");
    swStatusEl.textContent = "등록 완료 ✅";
  } catch (e) {
    swStatusEl.textContent = "등록 실패 ❌";
    log("서비스워커 등록 실패: " + e.message);
  }
}

// ====== 이벤트 연결 ======
colsSel.addEventListener("change", applyGridSizeFromUI);
rowsSel.addEventListener("change", applyGridSizeFromUI);
seatTypeSel.addEventListener("change", renderGrid);

showSeatNo.addEventListener("change", renderGrid);
showEmpty.addEventListener("change", renderGrid);

autoFillBtn.addEventListener("click", autoFill);
shuffleBtn.addEventListener("click", doShuffle);
clearBtn.addEventListener("click", clearAll);

downloadPngBtn.addEventListener("click", downloadPng);
printBtn.addEventListener("click", printPlan);

// ====== 시작 ======
registerSW();
applyGridSizeFromUI();

// 예시 데이터(처음엔 빈칸이 더 친절하지만, 테스트가 쉽도록 샘플)
studentsInput.value = `1번
2번
3번
4번
5번
6번
7번
8번
9번
10번
11번
12번
13번
14번
15번
16번
17번
18번
19번
20번
21번
22번
23번
24번
25번
26번
27번
28번`;