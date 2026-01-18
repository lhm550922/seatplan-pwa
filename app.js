/* SeatPlan PWA - app.js v0.39
   변경(요청 반영):
   1) 고정 좌석(📌): '고정 좌석' 버튼 클릭 시 각 좌석 좌상단에 작은 핀 아이콘 표시(삭제 아이콘과 동일 크기).
      - 핀 클릭으로 고정/해제
      - 고정된 좌석은 모드가 꺼져도 핀이 계속 보이고 파란 테두리/배경으로 표시
      - 별도의 오른쪽 위 '고정됨' 배지 제거
   2) 모둠 번호 표시: 좌석 전체 강조(노란색) 기능 사용 안 함(없음).
      - 대신 모둠 태그(좌하단)만 모둠별 색상(1~8) 적용.
   3) 모둠 드롭다운 잘림 해결:
      - seat 내부 select 대신, 화면 위에 뜨는 고정(fixed) 메뉴(#groupMenu)로 선택.
      - 삭제 아이콘보다 높은 z-index.
   4) 2인 책상 옵션 행(세로) 1~6 (index.html 반영)
   5) 최소 책상 크기 보장: 작은 크기로 과도하게 축소하지 않고, 스크롤로 대응.
*/

(() => {
  const $ = (id) => document.getElementById(id);

  // ===== DOM =====
  const swStatusEl = $("swStatus");
  const gridEl = $("grid");
  const logEl = $("log");
  const violationsBar = $("violationsBar");
  const canvas = $("exportCanvas");

  const autoFillBtn = $("autoFillBtn");
  const clearBtn = $("clearBtn");
  const downloadPngBtn = $("downloadPngBtn");
  const printBtn = $("printBtn");

  const openLayoutBtn = $("openLayoutBtn");
  const openStudentsBtn = $("openStudentsBtn");
  const openOptionsBtn = $("openOptionsBtn");
  const openSaveBtn = $("openSaveBtn");

  const layoutModal = $("layoutModal");
  const studentsModal = $("studentsModal");
  const optionsModal = $("optionsModal");
  const applyOptionsBtn = $("applyOptionsBtn");
  const saveModal = $("saveModal");

  const studentsInput = $("studentsInput");
  const applyStudentsBtn = $("applyStudentsBtn");
  const studentsNormalizeBtn = $("studentsNormalizeBtn");
  const studentsNamesOnlyBtn = $("studentsNamesOnlyBtn");
  const forbiddenInput = $("forbiddenInput");
  const useForbidden = $("useForbidden");
  const includeDiagonal = $("includeDiagonal");

  const showSeatNo = $("showSeatNo");
  const showGroups = $("showGroups");
  const showGender = $("showGender");

  const rotateFront = $("rotateFront");
  const rotateBack = $("rotateBack");

  const useRotation = $("useRotation");
  const resetHistoryBtn = $("resetHistoryBtn");

  const groupMode = $("groupMode");
  const balanceLevels = $("balanceLevels");

  const toggleOrientationBtn = $("toggleOrientationBtn");
  const stageEl = $("stage");
  const restoreVoidsBtn = $("restoreVoidsBtn");

  const modeGenderBtn = $("modeGenderBtn");
  const modePinBtn = $("modePinBtn");
  const modeBanner = $("modeBanner");

  // ✅ 버튼 툴팁(설명 풍선)
  if (modeGenderBtn) modeGenderBtn.dataset.tip = "성별에 따른 자리 배치";
  if (modePinBtn) modePinBtn.dataset.tip = "지정한 학생 자리를 고정";

  const hintBar = $("hintBar");
  const hintCloseBtn = $("hintCloseBtn");

  const slotSelect = $("slotSelect");
  const newSlotBtn = $("newSlotBtn");
  const saveBtn = $("saveBtn");
  const loadBtn = $("loadBtn");
  const deleteSlotBtn = $("deleteSlotBtn");

  const layoutKindSel = $("layoutKind");
  const colsSingleSel = $("colsSingle");
  const rowsSingleSel = $("rowsSingle");
  const pairColsSel = $("pairCols");
  const rowsPairSel = $("rowsPair");
  const groupSizeSel = $("groupSize");
  const groupCountSel = $("groupCount");

  const layoutPreviewEl = $("layoutPreview");
  const applyLayoutBtn = $("applyLayoutBtn");

  const accSingle = $("accSingle");
  const accPair = $("accPair");
  const accGroup = $("accGroup");

  const seatTypeSel = $("seatType");
  const displayPanelHost = $("displayPanelHost");

  const groupMenuEl = $("groupMenu");

  // ===== Utils =====
  function nowTime() { return new Date().toLocaleTimeString(); }
  function log(msg) {
    if (!logEl) return;
    logEl.textContent = `[${nowTime()}] ${msg}\n` + logEl.textContent;
  }
  function shuffleArr(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 1300);
  }

  const isTouchLike = () =>
    (window.matchMedia && window.matchMedia("(hover: none)").matches) ||
    ("ontouchstart" in window) ||
    (navigator.maxTouchPoints || 0) > 0;

  // ===== Hint bar =====
  const HINT_HIDE_KEY = "seatplan_hint_hidden_v026";
  function applyHintVisibility() {
    if (!hintBar) return;
    try {
      const hidden = localStorage.getItem(HINT_HIDE_KEY) === "1";
      hintBar.style.display = hidden ? "none" : "flex";
    } catch {
      hintBar.style.display = "flex";
    }
  }
  if (hintCloseBtn) {
    hintCloseBtn.addEventListener("click", () => {
      if (hintBar) hintBar.style.display = "none";
      try { localStorage.setItem(HINT_HIDE_KEY, "1"); } catch {}
    });
  }

  // ===== State =====
  let cols = 5;
  let rows = 6;
  let seats = [];
  let history = {};
  let violations = [];

  let boardAtTop = true;
  let uiMode = "none";       // none | gender | pin
  let selectedSeatId = null; // 터치 환경에서 아이콘 표시용
  let dragSrcId = null;

  let layoutKind = "single";
  let layoutParams = {
    singleCols: 5,
    singleRows: 6,
    pairCols: 2,
    pairRows: 6,
    groupSize: 4,
    groupCount: 3,
  };

  function getPairGapExtraScreen() {
    try {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--pairGapExtra")
        .trim()
        .replace("px", "");
      const n = Number(v);
      return Number.isFinite(n) ? n : 10;
    } catch {
      return 10;
    }
  }
  const pairGapExtraExport = 18;

  function seatCount() { return cols * rows; }
  function getSeat(id) { return seats.find((s) => s.id === id) || null; }

  function buildSeatModel() {
    seats = Array.from({ length: seatCount() }, (_, id) => ({
      id,
      name: null,
      locked: false,
      void: false,
      groupId: 1,     // ✅ 기본 1
      // ✅ v0.40: 수동으로 선택한 모둠 번호는 자동 모둠표기(groupMode)로 덮어쓰지 않음
      groupManual: false,
      seatGender: "A" // A/M/F
    }));
  }

  function mapDisplayRowToDataRow(displayRow) {
    return boardAtTop ? displayRow : rows - 1 - displayRow;
  }
  function frontRowIndexData() { return boardAtTop ? 0 : rows - 1; }
  function backRowIndexData() { return boardAtTop ? rows - 1 : 0; }
  function frontRowIds() {
    const r = frontRowIndexData();
    const ids = [];
    for (let c = 0; c < cols; c++) ids.push(r * cols + c);
    return ids.filter((id) => !getSeat(id)?.void);
  }
  function backRowIds() {
    const r = backRowIndexData();
    const ids = [];
    for (let c = 0; c < cols; c++) ids.push(r * cols + c);
    return ids.filter((id) => !getSeat(id)?.void);
  }

  function updateOrientationButtonLabel() {
    if (!toggleOrientationBtn) return;
    toggleOrientationBtn.innerHTML = boardAtTop
      ? "칠판을 아래로<br>(교사 시점)"
      : "칠판을 위로<br>(학생 시점)";
  }
  function renderOrientation() {
    if (!stageEl) return;
    if (boardAtTop) stageEl.classList.remove("boardBottom");
    else stageEl.classList.add("boardBottom");
  }

  function normGender(tok) {
    if (!tok) return "A";
    const t = tok.trim().toLowerCase();
    if (t === "m" || t === "남" || t === "남자" || t === "male") return "M";
    if (t === "f" || t === "여" || t === "여자" || t === "female") return "F";
    return "A";
  }
  function normLevel(tok) {
    if (!tok) return "중";
    const t = tok.trim();
    if (t === "상") return "상";
    if (t === "하") return "하";
    return "중";
  }
  // 학생 입력 편의 기능(v0.30)
  function normalizeLines(text){
    return (text||"")
      .replace(/\r/g,"\n")
      .split("\n")
      .map((x)=>x.trim())
      .filter(Boolean)
      .map((x)=>x.replace(/[\t, ]+/g," ").trim())
      .join("\n");
  }
  function namesToLines(text){
    const toks = (text||"")
      .replace(/\r/g,"\n")
      .split(/[\n,\t ]+/)
      .map((x)=>x.trim())
      .filter(Boolean);
    return toks.join("\n");
  }

function parseStudents(text) {
    const lines = (text || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const students = [];
    for (const line of lines) {
      const parts = line.split(/[,\t ]+/).filter(Boolean);
      const name = parts[0];
      const gender = normGender(parts[1]);
      const level = normLevel(parts[2]);
      students.push({ name, gender, level });
    }
    return students;
  }
  function parseForbidden(text) {
    // 한 줄에 2명 또는 여러 명을 쉼표(,)로 연결하면 모두 인접 금지로 처리합니다.
    // 예) A, B, C  => (A-B), (A-C), (B-C) 모두 금지
    // 기존 호환: A-B 형식도 지원
    const lines = (text || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const pairs = [];
    for (const line of lines) {
      const parts = line
        .split(/[,-]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length < 2) continue;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          pairs.push([parts[i], parts[j]]);
        }
      }
    }
    return pairs;
  }


  function pairKey(a, b) {
    return a < b ? `${a}||${b}` : `${b}||${a}`;
  }

  function buildForbiddenSet(pairs) {
    const set = new Set();
    for (const [a, b] of pairs) if (a && b) set.add(pairKey(a, b));
    return set;
  }

  function neighborIds(id) {
    const r = Math.floor(id / cols);
    const c = id % cols;
    const ids = [];
    const add = (rr, cc) => {
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return;
      ids.push(rr * cols + cc);
    };
    add(r - 1, c); add(r + 1, c); add(r, c - 1); add(r, c + 1);
    if (includeDiagonal && includeDiagonal.checked) {
      add(r - 1, c - 1); add(r - 1, c + 1); add(r + 1, c - 1); add(r + 1, c + 1);
    }
    return ids;
  }

  function applyAutoGroups() {
    // layoutKind === group인 경우 이미 배치에서 groupId가 지정됨
    // 여기서는 자동 그룹핑 옵션이 있으면 groupId를 채움.
    if (!groupMode) return;
    const mode = groupMode.value;
    if (mode === "none") return;

    const size = Number(mode);
    if (!size) return;

    // ✅ void 제외 + 수동 지정된 좌석은 자동 그룹핑으로 덮어쓰지 않음
    const activeIds = seats
      .filter((s) => !s.void && !s.groupManual)
      .map((s) => s.id)
      .sort((a, b) => a - b);
    for (let i = 0; i < activeIds.length; i++) {
      const gid = clamp(Math.floor(i / size) + 1, 1, 8);
      const s = getSeat(activeIds[i]);
      if (s) s.groupId = gid;
    }
  }

  function setAccordionVisibility(kind) {
    if (accSingle) accSingle.classList.toggle("hidden", kind !== "single");
    if (accPair) accPair.classList.toggle("hidden", kind !== "pair");
    if (accGroup) accGroup.classList.toggle("hidden", kind !== "group");

    const disableAutoGroup = kind === "group";
    if (groupMode) groupMode.disabled = disableAutoGroup;
    if (balanceLevels) balanceLevels.disabled = disableAutoGroup;
  }

  function computeGroupGrid(groupSize, groupCount) {
    const blockW = groupSize === 4 ? 2 : 3;
    const blockH = 2;
    const maxGroupCols = blockW === 2 ? 3 : 2;

    for (let gCols = Math.min(maxGroupCols, groupCount); gCols >= 1; gCols--) {
      const gRows = Math.ceil(groupCount / gCols);
      const totalCols = gCols * blockW + (gCols - 1);
      const totalRows = gRows * blockH + (gRows - 1);
      if (totalCols <= 8 && totalRows <= 8) {
        return { ok: true, blockW, blockH, gCols, gRows, cols: totalCols, rows: totalRows };
      }
    }
    return { ok: false };
  }

  function clearPreview() { if (layoutPreviewEl) layoutPreviewEl.innerHTML = ""; }

  function drawMiniPreview(kind) {
    if (!layoutPreviewEl) return;
    clearPreview();

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "3px";
    wrap.style.padding = "8px";
    wrap.style.border = "1px solid rgba(255,255,255,0.15)";
    wrap.style.borderRadius = "10px";
    wrap.style.background = "rgba(255,255,255,0.03)";
    wrap.style.width = "fit-content";

    const cell = (on, isAisle, isPairGap) => {
      const d = document.createElement("div");
      d.style.width = "10px";
      d.style.height = "10px";
      d.style.borderRadius = "3px";

      if (isPairGap) {
        d.style.width = "6px";
        d.style.border = "0";
        d.style.background = "transparent";
        return d;
      }

      if (isAisle) {
        d.style.border = "1px dashed rgba(255,255,255,0.22)";
        d.style.background = "transparent";
      } else {
        d.style.border = "1px solid rgba(255,255,255,0.18)";
        d.style.background = on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)";
      }
      return d;
    };

    if (kind === "single") {
      const pCols = Number(colsSingleSel.value);
      const pRows = Number(rowsSingleSel.value);
      wrap.style.gridTemplateColumns = `repeat(${pCols}, 10px)`;
      for (let i = 0; i < pCols * pRows; i++) wrap.appendChild(cell(true, false, false));
      layoutPreviewEl.appendChild(wrap);
      return;
    }

    if (kind === "pair") {
      const pc = Number(pairColsSel.value);
      const pRows = Number(rowsPairSel.value);

      const tracks = [];
      for (let g = 0; g < pc; g++) {
        tracks.push("10px", "10px");
        if (g !== pc - 1) tracks.push("6px");
      }
      wrap.style.gridTemplateColumns = tracks.join(" ");

      for (let r = 0; r < pRows; r++) {
        for (let g = 0; g < pc; g++) {
          wrap.appendChild(cell(true, false, false));
          wrap.appendChild(cell(true, false, false));
          if (g !== pc - 1) wrap.appendChild(cell(false, false, true));
        }
      }
      layoutPreviewEl.appendChild(wrap);
      return;
    }

    const size = Number(groupSizeSel.value);
    const cnt = Number(groupCountSel.value);
    const grid = computeGroupGrid(size, cnt);
    if (!grid.ok) return;

    const pCols = grid.cols;
    const pRows = grid.rows;
    wrap.style.gridTemplateColumns = `repeat(${pCols}, 10px)`;

    const blockW = grid.blockW;
    const blockH = 2;
    const gCols = grid.gCols;

    const map = Array.from({ length: pRows }, () => Array.from({ length: pCols }, () => "aisle"));

    let groupIndex = 0;
    for (let gr = 0; gr < grid.gRows; gr++) {
      for (let gc = 0; gc < gCols; gc++) {
        if (groupIndex >= cnt) break;
        const startCol = gc * (blockW + 1);
        const startRow = gr * (blockH + 1);

        for (let br = 0; br < blockH; br++) {
          for (let bc = 0; bc < blockW; bc++) {
            if (size === 5 && br === 1 && bc === 2) continue;
            map[startRow + br][startCol + bc] = "seat";
          }
        }
        groupIndex++;
      }
    }

    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        const t = map[r][c];
        wrap.appendChild(cell(t === "seat", t === "aisle", false));
      }
    }
    layoutPreviewEl.appendChild(wrap);
  }

  function updateLayoutPreview() {
    if (!layoutPreviewEl || !layoutKindSel) return;
    drawMiniPreview(layoutKindSel.value);
  }

  function syncLayoutModalUIFromState() {
    if (!layoutKindSel) return;

    layoutKindSel.value = layoutKind;
    colsSingleSel.value = String(layoutParams.singleCols);
    rowsSingleSel.value = String(layoutParams.singleRows);
    pairColsSel.value = String(layoutParams.pairCols);
    rowsPairSel.value = String(layoutParams.pairRows);
    groupSizeSel.value = String(layoutParams.groupSize);
    groupCountSel.value = String(layoutParams.groupCount);

    setAccordionVisibility(layoutKindSel.value);
    updateLayoutPreview();
  }

  function onLayoutKindChanged() {
    if (!layoutKindSel) return;
    setAccordionVisibility(layoutKindSel.value);
    updateLayoutPreview();
  }

  function applyLayout(kind, params) {
    layoutKind = kind;
    uiMode = "none";
    selectedSeatId = null;
    violations = [];
    closeGroupMenu();

    if (violationsBar) {
      violationsBar.style.display = "none";
      violationsBar.textContent = "";
    }

    if (kind === "single") {
      cols = clamp(Number(params.singleCols), 1, 8);
      rows = clamp(Number(params.singleRows), 1, 8);
      if (seatTypeSel) seatTypeSel.value = "single";
      buildSeatModel();
    }

    if (kind === "pair") {
      const pc = clamp(Number(params.pairCols), 1, 4);
      rows = clamp(Number(params.pairRows), 1, 8);
      cols = pc * 2;
      if (seatTypeSel) seatTypeSel.value = "single";
      buildSeatModel();
    }

    if (kind === "group") {
      const size = clamp(Number(params.groupSize), 4, 6);
      const cnt = clamp(Number(params.groupCount), 1, 6);

      const grid = computeGroupGrid(size, cnt);
      if (!grid.ok) {
        toast("이 조합은 8×8 안에 배치하기 어려워요. 모둠 개수를 줄여보세요.");
        return false;
      }

      cols = grid.cols;
      rows = grid.rows;
      if (seatTypeSel) seatTypeSel.value = "single";
      buildSeatModel();

      const blockW = grid.blockW;
      const blockH = grid.blockH;
      const gCols = grid.gCols;

      let groupIndex = 0;

      for (let gr = 0; gr < grid.gRows; gr++) {
        for (let gc = 0; gc < gCols; gc++) {
          if (groupIndex >= cnt) break;

          const startCol = gc * (blockW + 1);
          const startRow = gr * (blockH + 1);
          const gid = groupIndex + 1;

          for (let br = 0; br < blockH; br++) {
            for (let bc = 0; bc < blockW; bc++) {
              const rr = startRow + br;
              const cc = startCol + bc;
              const id = rr * cols + cc;
              const seat = getSeat(id);
              if (!seat) continue;

              if (size === 5 && br === 1 && bc === 2) {
                seat.void = true;
                seat.groupId = 1;
                seat.groupManual = false;
                seat.name = null;
                seat.locked = false;
                seat.seatGender = "A";
                continue;
              }
              seat.groupId = gid;
              seat.groupManual = false;
            }
          }
          groupIndex++;
        }
      }

      // 통로(세로)
      for (let gc = 1; gc < gCols; gc++) {
        const aisleCol = gc * (blockW + 1) - 1;
        for (let r = 0; r < rows; r++) {
          const id = r * cols + aisleCol;
          const s = getSeat(id);
          if (s) {
            s.void = true; s.groupId = 1; s.groupManual = false; s.name = null; s.locked = false; s.seatGender = "A";
          }
        }
      }
      // 통로(가로)
      for (let gr = 1; gr < grid.gRows; gr++) {
        const aisleRow = gr * (blockH + 1) - 1;
        for (let c = 0; c < cols; c++) {
          const id = aisleRow * cols + c;
          const s = getSeat(id);
          if (s) {
            s.void = true; s.groupId = 1; s.groupManual = false; s.name = null; s.locked = false; s.seatGender = "A";
          }
        }
      }

      if (groupMode) groupMode.value = "none";
      if (balanceLevels) balanceLevels.checked = false;
      if (showGroups) showGroups.checked = true;
    }

    syncOptionEnables();
    computeViolations();
    renderGrid();
    log(`책상 배열 적용: ${layoutKind} / ${cols}×${rows}`);
    return true;
  }

  // ✅ 최소 책상 크기 보장: 축소 거의 하지 않고, 스크롤로 대응
  function applySeatSizing() {
    const seatW = 130;
    const seatH = 70;
    const gap = 10;
    const font = 16;

    if (gridEl) {
      gridEl.style.setProperty("--seatW", `${seatW}px`);
      gridEl.style.setProperty("--seatH", `${seatH}px`);
      gridEl.style.setProperty("--gap", `${gap}px`);
      gridEl.dataset.font = String(font);
    }
  }

  function genderClass(seat) {
    if (seat.void) return "";
    if (seat.seatGender === "M") return "genderM";
    if (seat.seatGender === "F") return "genderF";
    return "genderA";
  }

  function renderModeUI() {
    if (!stageEl) return;

    stageEl.classList.remove("mode-gender", "mode-pin");
    if (modeGenderBtn) modeGenderBtn.classList.remove("activeMode");
    if (modePinBtn) modePinBtn.classList.remove("activeMode");

    if (uiMode === "gender") {
      stageEl.classList.add("mode-gender");
      if (modeGenderBtn) modeGenderBtn.classList.add("activeMode");
      if (modeBanner) {
        modeBanner.textContent =
          "성별 지정 모드: 좌석의 [무관/남/여]를 눌러 좌석 성별을 지정하세요. (다시 누르면 종료)";
        modeBanner.style.display = "block";
      }
    } else if (uiMode === "pin") {
      stageEl.classList.add("mode-pin");
      if (modePinBtn) modePinBtn.classList.add("activeMode");
      if (modeBanner) {
        modeBanner.textContent =
          "고정 좌석 모드: 좌석 왼쪽 위 📌을 눌러 학생을 고정/해제하세요.";
        modeBanner.style.display = "block";
      }
    } else {
      if (modeBanner) modeBanner.style.display = "none";
    }
  }

  function moveDisplayPanelToToolBar() {
    if (!displayPanelHost) return;
    const panel = document.querySelector(".displayPanel");
    if (panel && panel.parentElement !== displayPanelHost) {
      displayPanelHost.appendChild(panel);
    }
  }

  function setShowActionsOnSeat(id, on) {
    if (!gridEl) return;
    const seatDiv = gridEl.querySelector(`.seat[data-seat-id="${id}"]`);
    if (!seatDiv) return;
    seatDiv.classList.toggle("showActions", !!on);
  }

  function clearShowActionsAll() {
    if (!gridEl) return;
    gridEl.querySelectorAll(".seat.showActions").forEach((el) => el.classList.remove("showActions"));
  }

  function applyGridTemplateForPair(seatW, gap, extra) {
    const pc = Math.max(1, Math.floor(cols / 2));
    const tracks = [];
    for (let g = 0; g < pc; g++) {
      tracks.push(`${seatW}px`, `${seatW}px`);
      if (g !== pc - 1) tracks.push(`${gap + extra}px`);
    }
    gridEl.style.gridTemplateColumns = tracks.join(" ");
  }

  function renderGrid() {
    if (!gridEl) return;

    applySeatSizing();
    renderOrientation();
    renderModeUI();
    moveDisplayPanelToToolBar();

    // groupMode가 켜져있으면 groupId 채움(사용자가 직접 바꾼 건 유지)
    applyAutoGroups();

    const seatW = parseInt(getComputedStyle(gridEl).getPropertyValue("--seatW")) || 130;
    const seatH = parseInt(getComputedStyle(gridEl).getPropertyValue("--seatH")) || 70;
    const gap = parseInt(getComputedStyle(gridEl).getPropertyValue("--gap")) || 10;

    const isPair = layoutKind === "pair";
    if (isPair) {
      const extra = getPairGapExtraScreen();
      applyGridTemplateForPair(seatW, gap, extra);
    } else {
      gridEl.style.gridTemplateColumns = `repeat(${cols}, ${seatW}px)`;
    }

    const vioSet = new Set();
    for (const v of violations) { vioSet.add(v.aId); vioSet.add(v.bId); }

    gridEl.innerHTML = "";

    for (let displayR = 0; displayR < rows; displayR++) {
      const dataRow = mapDisplayRowToDataRow(displayR);

      if (!isPair) {
        for (let c = 0; c < cols; c++) {
          const seatId = dataRow * cols + c;
          const seat = getSeat(seatId);
          if (!seat) continue;
          gridEl.appendChild(makeSeatDiv(seat, vioSet));
        }
        continue;
      }

      const pc = Math.max(1, Math.floor(cols / 2));
      for (let g = 0; g < pc; g++) {
        for (let k = 0; k < 2; k++) {
          const c = g * 2 + k;
          const seatId = dataRow * cols + c;
          const seat = getSeat(seatId);
          if (!seat) continue;
          gridEl.appendChild(makeSeatDiv(seat, vioSet));
        }
        if (g !== pc - 1) {
          const gapDiv = document.createElement("div");
          gapDiv.className = "gridGap";
          gapDiv.style.height = `${seatH}px`;
          gridEl.appendChild(gapDiv);
        }
      }
    }

    // 터치: selectedSeatId만 showActions
    if (isTouchLike()) {
      clearShowActionsAll();
      if (selectedSeatId != null) setShowActionsOnSeat(selectedSeatId, true);
    }

    // 모둠 메뉴가 열린 상태면 위치 재계산(스크롤/리렌더 대응)
    if (groupMenuState.open) {
      const seatId = groupMenuState.seatId;
      const tag = gridEl.querySelector(`.seat[data-seat-id="${seatId}"] .groupTag`);
      if (tag) positionGroupMenu(tag);
      else closeGroupMenu();
    }
  }

  // ===== Seat rendering =====
  function makeGroupTag(seat) {
    const wrap = document.createElement("div");
    wrap.className = "groupTag";
    const gid = clamp(Number(seat.groupId ?? 1), 1, 8);
    wrap.dataset.group = String(gid);
    wrap.dataset.action = "groupMenu";
    wrap.dataset.seatId = String(seat.id);
    wrap.title = "모둠 번호 선택";

    const label = document.createElement("span");
    label.className = "groupLabel";
    label.textContent = `모둠 ${gid}`;
    const caret = document.createElement("span");
    caret.className = "groupCaret";
    caret.textContent = "▾";

    wrap.appendChild(label);
    wrap.appendChild(caret);
    return wrap;
  }

  function makeSeatDiv(seat, vioSet) {
    const div = document.createElement("div");
    div.className = "seat";
    div.dataset.seatId = String(seat.id);

    if (seat.locked) div.classList.add("locked");
    if (seat.void) div.classList.add("void");
    if (vioSet.has(seat.id)) div.classList.add("violation");
    div.classList.add(...genderClass(seat).split(" ").filter(Boolean));

    div.draggable = uiMode === "none";

    if (showSeatNo && showSeatNo.checked) {
      const no = document.createElement("div");
      no.className = "no";
      no.textContent = String(seat.id + 1);
      div.appendChild(no);
    }

    // ✅ 좌상단 핀(고정)
    const pin = document.createElement("div");
    pin.className = "pinBadge";
    pin.dataset.action = "pinToggle";
    pin.title = "고정 좌석(학생 고정)";
    pin.textContent = "📌";
    div.appendChild(pin);

    // ✅ 우상단 삭제/복구
    const action = document.createElement("div");
    action.className = "actionBadge";
    action.dataset.action = seat.void ? "restore" : "delete";
    action.textContent = seat.void ? "↩" : "🗑";
    action.title = seat.void ? "통로(삭제) 자리 복구" : "좌석 삭제(통로 만들기)";
    div.appendChild(action);

    // ✅ 모둠 태그: showGroups 체크면 항상 표시(통로 제외)
    if (showGroups && showGroups.checked && !seat.void) {
      div.appendChild(makeGroupTag(seat));
    }

    if (showGender && showGender.checked && !seat.void) {
      const g = document.createElement("div");
      g.className = "genderTag";
      g.textContent = seat.seatGender === "A" ? "무관" : seat.seatGender === "M" ? "남" : "여";
      div.appendChild(g);
    }

    const name = document.createElement("div");
    name.className = "name";
    const baseFont = Number(gridEl.dataset.font || 16);

    if (seat.void) {
      name.textContent = "통로";
      name.style.fontSize = `${Math.max(11, baseFont)}px`;
    } else if (seat.name) {
      name.textContent = seat.name;
      const len = seat.name.length;
      let f = baseFont;
      if (len >= 6) f = baseFont - 1;
      if (len >= 9) f = baseFont - 2;
      if (len >= 12) f = baseFont - 3;
      name.style.fontSize = `${Math.max(11, f)}px`;
    } else {
      name.textContent = "빈자리";
      name.classList.add("empty");
      name.style.fontSize = `${Math.max(11, baseFont)}px`;
    }
    div.appendChild(name);

    // 성별 지정 overlay
    div.appendChild(makeGenderOverlay(seat));

    return div;
  }

  function makeGenderOverlay(seat) {
    const ov = document.createElement("div");
    ov.className = "overlayIcon gender";

    const pad = document.createElement("div");
    pad.className = "genderPad";

    const makeBtn = (label, code, cls) => {
      const b = document.createElement("div");
      b.className = `gbtn ${cls}` + (seat.seatGender === code ? " active" : "");
      b.textContent = label;
      b.dataset.action = "genderSet";
      b.dataset.gender = code;
      return b;
    };

    pad.appendChild(makeBtn("무관", "A", "any"));
    pad.appendChild(makeBtn("남", "M", "male"));
    pad.appendChild(makeBtn("여", "F", "female"));

    ov.appendChild(pad);
    return ov;
  }

  // ===== Violations =====
  function computeViolations() {
    violations = [];

    if (useForbidden && !useForbidden.checked) {
      if (violationsBar) { violationsBar.style.display = "none"; violationsBar.textContent = ""; }
      return;
    }

    const pairs = parseForbidden(forbiddenInput ? forbiddenInput.value : "");
    const forbid = buildForbiddenSet(pairs);


    if (forbid.size === 0) {
      if (violationsBar) { violationsBar.style.display = "none"; violationsBar.textContent = ""; }
      return;
    }

    const nameToSeat = new Map();
    for (const s of seats) {
      if (s.void) continue;
      if (s.name) nameToSeat.set(s.name, s.id);
    }

    for (const [aName, bName] of pairs) {
      const aId = nameToSeat.get(aName);
      const bId = nameToSeat.get(bName);
      if (aId == null || bId == null) continue;

      const neigh = new Set(neighborIds(aId));
      if (neigh.has(bId)) {
        violations.push({ aName, bName, aId, bId });
      }
    }

    if (!violationsBar) return;
    if (violations.length === 0) {
      violationsBar.style.display = "none";
      violationsBar.textContent = "";
    } else {
      const lines = violations.map(
        (v) => `- ${v.aName}(좌석 ${v.aId + 1}) ↔ ${v.bName}(좌석 ${v.bId + 1})`
      );
      violationsBar.textContent = `금지쌍 위반 ${violations.length}건:\n` + lines.join("\n");
      violationsBar.style.display = "block";
    }
  }

  function ensureHistoryFor(name) { if (!history[name]) history[name] = { front: 0, back: 0 }; }
  function updateRotationCounts() {
    if (useRotation && !useRotation.checked) return;

    const f = frontRowIds();
    const b = backRowIds();

    if (rotateFront && rotateFront.checked) {
      for (const id of f) {
        const s = getSeat(id);
        if (!s || s.void || !s.name) continue;
        ensureHistoryFor(s.name);
        history[s.name].front += 1;
      }
    }

    if (rotateBack && rotateBack.checked) {
      for (const id of b) {
        const s = getSeat(id);
        if (!s || s.void || !s.name) continue;
        ensureHistoryFor(s.name);
        history[s.name].back += 1;
      }
    }
    log("로테이션 기록 업데이트 완료(앞/뒤줄 누적).");
  }

  function syncOptionEnables(){
    const forbidOn = (!useForbidden) || useForbidden.checked;
    if (forbiddenInput) forbiddenInput.disabled = !forbidOn;
    if (includeDiagonal) includeDiagonal.disabled = !forbidOn;

    const rotOn = (!useRotation) || useRotation.checked;
    if (rotateFront) rotateFront.disabled = !rotOn;
    if (rotateBack) rotateBack.disabled = !rotOn;
  }

  function ensureShowGroupsForBalance(){
    if (!balanceLevels || !showGroups) return;
    if (balanceLevels.checked && !showGroups.checked) {
      showGroups.checked = true;
    }
  }


  // ===== Actions =====
  function togglePin(seat) {
    if (!seat || seat.void) return;

    // 해제는 언제든 가능
    if (seat.locked) {
      seat.locked = false;
      renderGrid();
      log(`좌석 고정 해제: 좌석 ${seat.id + 1}`);
      return;
    }

    // 고정은 학생이 있는 자리만
    if (!seat.name) {
      toast("학생이 지정된 자리만 고정할 수 있어요.");
      return;
    }
    seat.locked = true;
    renderGrid();
    log(`좌석 고정: ${seat.name} (좌석 ${seat.id + 1})`);
  }

  function clearAll() {
    uiMode = "none";
    selectedSeatId = null;
    closeGroupMenu();

    if (layoutKind === "group") {
      applyLayout("group", layoutParams);
      log("초기화 완료(모둠대형 패턴 재적용)");
      return;
    }

    for (const s of seats) {
      s.name = null;
      s.locked = false;
      s.void = false;
      s.groupId = 1;
      s.groupManual = false;
      s.seatGender = "A";
    }

    violations = [];
    if (violationsBar) { violationsBar.style.display = "none"; violationsBar.textContent = ""; }

    renderGrid();
    log("초기화 완료");
  }

  function restoreVoids() {
    uiMode = "none";
    selectedSeatId = null;
    closeGroupMenu();

    let cnt = 0;
    for (const s of seats) {
      if (s.void) {
        s.void = false;
        s.name = null;
        s.locked = false;
        s.groupId = 1;
        s.groupManual = false;
        s.seatGender = "A";
        cnt++;
      }
    }

    syncOptionEnables();
    computeViolations();
    renderGrid();
    log(`통로(빈칸) 복구: ${cnt}칸`);
  }

  function copySeatState(s) {
    return { name: s.name, locked: s.locked, void: s.void, groupId: s.groupId, seatGender: s.seatGender };
  }
  function applySeatState(s, st) {
    s.name = st.name ?? null;
    s.locked = !!st.locked;
    s.void = !!st.void;
    s.groupId = clamp(Number(st.groupId ?? 1), 1, 8);
    s.seatGender = st.seatGender ?? "A";
  }
  function swapSeatState(aId, bId) {
    const a = getSeat(aId);
    const b = getSeat(bId);
    if (!a || !b) return false;
    const aSt = copySeatState(a);
    const bSt = copySeatState(b);
    applySeatState(a, bSt);
    applySeatState(b, aSt);
    return true;
  }

  // ===== Drag & Drop (move/swap) =====
  if (gridEl) {
    gridEl.addEventListener("dragstart", (e) => {
      if (uiMode !== "none") return;
      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;
      const id = Number(seatDiv.dataset.seatId);
      if (Number.isNaN(id)) return;

      const seat = getSeat(id);
      if (seat && seat.void) return; // 통로는 드래그 이동 의미 없음

      dragSrcId = id;
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", String(id));
        e.dataTransfer.effectAllowed = "move";
      }
    });

    gridEl.addEventListener("dragover", (e) => {
      if (uiMode !== "none") return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    });

    gridEl.addEventListener("drop", (e) => {
      if (uiMode !== "none") return;
      e.preventDefault();

      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;

      const dstId = Number(seatDiv.dataset.seatId);

      let srcId = NaN;
      if (e.dataTransfer) srcId = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(srcId)) srcId = dragSrcId;
      dragSrcId = null;

      if (Number.isNaN(srcId) || Number.isNaN(dstId) || srcId === dstId) return;

      if (!swapSeatState(srcId, dstId)) return;

      selectedSeatId = null;
      computeViolations();
      renderGrid();
      log(`이동/교체: 좌석 ${srcId + 1} ↔ 좌석 ${dstId + 1}`);
    });

    // 클릭 처리(모드/아이콘/모둠 메뉴)
    gridEl.addEventListener("click", (e) => {
      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;

      const id = Number(seatDiv.dataset.seatId);
      const seat = getSeat(id);
      if (!seat) return;

      const actionEl = e.target.closest("[data-action]");
      if (actionEl) {
        const act = actionEl.dataset.action;

        // 성별 지정 모드 버튼
        if (act === "genderSet") {
          if (uiMode !== "gender") return;
          seat.seatGender = actionEl.dataset.gender || "A";
          computeViolations();
          renderGrid();
          log(`성별 지정: 좌석 ${id + 1}`);
          return;
        }

        // 고정핀 (모드 상관없이: 고정된 핀은 항상 클릭으로 해제 가능)
        if (act === "pinToggle") {
          togglePin(seat);
          return;
        }

        // 삭제/복구
        if (act === "delete") {
          if (seat.locked) { toast("고정된 좌석은 삭제할 수 없어요. 먼저 고정을 해제하세요."); return; }
          seat.name = null;
          seat.void = true;
          seat.locked = false;
          seat.groupId = 1;
          seat.groupManual = false;
          seat.seatGender = "A";
          selectedSeatId = null;
          closeGroupMenu();
          computeViolations();
          renderGrid();
          log(`좌석 삭제(통로): 좌석 ${id + 1}`);
          return;
        }
        if (act === "restore") {
          seat.void = false;
          seat.name = null;
          seat.locked = false;
          seat.groupId = 1;
          seat.groupManual = false;
          seat.seatGender = "A";
          selectedSeatId = null;
          closeGroupMenu();
          computeViolations();
          renderGrid();
          log(`좌석 복구: 좌석 ${id + 1}`);
          return;
        }

        // 모둠 메뉴 열기
        if (act === "groupMenu") {
          if (!(showGroups && showGroups.checked)) return;
          openGroupMenuForSeat(id, actionEl);
          return;
        }
      }

      // 모드가 켜져 있으면(성별/핀) 일반 클릭 선택은 안 함
      if (uiMode !== "none") return;

      // 터치 환경: 탭하면 아이콘 표시 토글
      if (isTouchLike()) {
        if (selectedSeatId === id) selectedSeatId = null;
        else selectedSeatId = id;
        renderGrid();
        return;
      }

      // 데스크탑: 기본은 아무 동작 없음 (hover로 삭제 노출)
    });
  }

  // 그리드 밖 클릭: 터치 선택 해제 + 모둠 메뉴 닫기
  document.addEventListener("click", (e) => {
    const insideGrid = e.target.closest("#grid");
    const insideMenu = e.target.closest("#groupMenu");
    if (!insideGrid && !insideMenu) {
      if (isTouchLike() && selectedSeatId != null) {
        selectedSeatId = null;
        renderGrid();
      }
      closeGroupMenu();
    }
  });

  // ===== Group Menu (fixed, not clipped) =====
  const groupMenuState = { open: false, seatId: null };

  function buildGroupMenuItems(currentGid) {
    if (!groupMenuEl) return;
    groupMenuEl.innerHTML = "";
    for (let i = 1; i <= 8; i++) {
      const item = document.createElement("div");
      item.className = "gmItem" + (i === currentGid ? " active" : "");
      item.dataset.group = String(i);
      item.setAttribute("role", "option");
      item.dataset.action = "pickGroup";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "10px";

      const sw = document.createElement("span");
      sw.className = "gmSwatch";
      const txt = document.createElement("span");
      txt.textContent = `모둠 ${i}`;

      left.appendChild(sw);
      left.appendChild(txt);
      item.appendChild(left);

      item.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const seat = getSeat(groupMenuState.seatId);
        if (!seat) return;
        seat.groupId = i;
        seat.groupManual = true;
        closeGroupMenu();
        renderGrid();
        log(`모둠 변경: 좌석 ${seat.id + 1} → 모둠 ${i}`);
      });

      groupMenuEl.appendChild(item);
    }
  }

  function positionGroupMenu(anchorEl) {
    if (!groupMenuEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuRect = groupMenuEl.getBoundingClientRect();

    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 기본: 아래로
    let left = rect.left;
    let top = rect.bottom + margin;

    // 오른쪽 넘침 방지
    if (left + menuRect.width > vw - margin) {
      left = vw - margin - menuRect.width;
    }
    if (left < margin) left = margin;

    // 아래 공간 부족하면 위로
    if (top + menuRect.height > vh - margin) {
      top = rect.top - margin - menuRect.height;
    }
    if (top < margin) top = margin;

    groupMenuEl.style.left = `${Math.round(left)}px`;
    groupMenuEl.style.top = `${Math.round(top)}px`;
  }

  function openGroupMenuForSeat(seatId, anchorEl) {
    if (!groupMenuEl) return;
    const seat = getSeat(seatId);
    if (!seat || seat.void) return;

    const gid = clamp(Number(seat.groupId ?? 1), 1, 8);
    groupMenuState.open = true;
    groupMenuState.seatId = seatId;

    buildGroupMenuItems(gid);
    groupMenuEl.classList.remove("hidden");
    groupMenuEl.style.display = "block";
    positionGroupMenu(anchorEl);
  }

  function closeGroupMenu() {
    if (!groupMenuEl) return;
    groupMenuState.open = false;
    groupMenuState.seatId = null;
    groupMenuEl.classList.add("hidden");
    groupMenuEl.style.display = "none";
  }

  // 스크롤/리사이즈 시 메뉴 위치 유지
  window.addEventListener("resize", () => {
    if (!groupMenuState.open) return;
    const seatId = groupMenuState.seatId;
    const tag = gridEl?.querySelector(`.seat[data-seat-id="${seatId}"] .groupTag`);
    if (tag) positionGroupMenu(tag);
  });
  stageEl?.addEventListener("scroll", () => {
    if (!groupMenuState.open) return;
    const seatId = groupMenuState.seatId;
    const tag = gridEl?.querySelector(`.seat[data-seat-id="${seatId}"] .groupTag`);
    if (tag) positionGroupMenu(tag);
  }, { passive: true });

  // ===== Modes =====
  function toggleMode(next) {
    selectedSeatId = null;
    closeGroupMenu();
    uiMode = uiMode === next ? "none" : next;
    renderGrid();
  }
  if (modeGenderBtn) modeGenderBtn.addEventListener("click", () => toggleMode("gender"));
  if (modePinBtn) modePinBtn.addEventListener("click", () => toggleMode("pin"));

  // ===== Auto fill =====
  function autoFill() {
    uiMode = "none";
    selectedSeatId = null;

    const students = parseStudents(studentsInput ? studentsInput.value : "");
    if (students.length === 0) {
      toast("학생 명단이 비어 있어요.");
      return;
    }

    students.forEach((s) => ensureHistoryFor(s.name));

    const nameToGender = new Map(students.map((s) => [s.name, s.gender]));

    // 고정된 학생(이름)은 항상 유지
    const lockedNames = new Set();
    for (const s of seats) {
      if (s.void) continue;
      if (s.locked && s.name) lockedNames.add(s.name);
    }

    const activeSeatIds = seats.filter((s) => !s.void).map((s) => s.id);
    const freeSeatIds = activeSeatIds.filter((id) => !getSeat(id)?.locked);

    // 남은 학생 풀(자리 수만큼만)
    let pool = students.map((s) => s.name).filter((n) => !lockedNames.has(n));
    pool = pool.slice(0, freeSeatIds.length);

    // 인접 금지(한 줄에 여러 명이면 모든 조합 금지)
    const forbiddenPairs = (useForbidden && !useForbidden.checked) ? [] : parseForbidden(forbiddenInput ? forbiddenInput.value : "");

    const allowedForSeat = (name, seatId) => {
      const seat = getSeat(seatId);
      if (!seat || seat.void) return false;
      const req = seat.seatGender ?? "A";
      if (req === "A") return true;
      const g = nameToGender.get(name) || "A";
      return g === req || g === "A";
    };

    // --- (금지쌍 만족) 탐색 유틸 ---
    const neighborSet = new Map();
    if (forbiddenPairs.length > 0) {
      for (const id of activeSeatIds) neighborSet.set(id, new Set(neighborIds(id)));
    }

    const forbiddenCost = (seatToName) => {
      if (forbiddenPairs.length === 0) return 0;
      const nameToSeat = new Map();
      for (const id of activeSeatIds) {
        const nm = seatToName[id];
        if (nm) nameToSeat.set(nm, id);
      }
      let cost = 0;
      for (const [a, b] of forbiddenPairs) {
        const aId = nameToSeat.get(a);
        const bId = nameToSeat.get(b);
        if (aId == null || bId == null) continue;
        const ns = neighborSet.get(aId);
        if (ns && ns.has(bId)) cost += 1;
      }
      return cost;
    };

    const makeInitialAssignment = () => {
      const seatToName = Array.from({ length: seatCount() }, () => null);

      // locked seed
      for (const s of seats) {
        if (s.void) continue;
        if (s.locked && s.name) seatToName[s.id] = s.name;
      }

      let remaining = shuffleArr(pool);

      // seat order shuffle helps
      const seatOrder = shuffleArr(freeSeatIds);
      for (const id of seatOrder) {
        if (remaining.length === 0) {
          seatToName[id] = null;
          continue;
        }

        const req = getSeat(id)?.seatGender ?? "A";
        let pickIndex = 0;

        if (req !== "A") {
          pickIndex = -1;
          for (let k = 0; k < remaining.length; k++) {
            if (allowedForSeat(remaining[k], id)) {
              pickIndex = k;
              break;
            }
          }
          if (pickIndex === -1) pickIndex = 0;
        }

        const picked = remaining.splice(pickIndex, 1)[0];
        seatToName[id] = picked ?? null;
      }

      return seatToName;
    };

    const improveBySwaps = (seed) => {
      // 랜덤 스왑 힐클라임(빠르고 안정적)
      let cur = seed.slice();
      let curCost = forbiddenCost(cur);
      let best = cur.slice();
      let bestCost = curCost;

      const steps = forbiddenPairs.length > 0 ? 900 : 0;
      for (let step = 0; step < steps; step++) {
        if (curCost === 0) break;

        const a = freeSeatIds[Math.floor(Math.random() * freeSeatIds.length)];
        const b = freeSeatIds[Math.floor(Math.random() * freeSeatIds.length)];
        if (a === b) continue;

        // swap
        const tmp = cur[a];
        cur[a] = cur[b];
        cur[b] = tmp;

        const newCost = forbiddenCost(cur);
        const accept = newCost <= curCost || Math.random() < 0.02;

        if (accept) {
          curCost = newCost;
          if (newCost < bestCost) {
            bestCost = newCost;
            best = cur.slice();
            if (bestCost === 0) break;
          }
        } else {
          // revert
          const tmp2 = cur[a];
          cur[a] = cur[b];
          cur[b] = tmp2;
        }
      }

      return { best, bestCost };
    };

    // --- 메인 탐색 ---
    let bestGlobal = null;
    let bestGlobalCost = Infinity;

    const attempts = forbiddenPairs.length > 0 ? 50 : 1;
    for (let t = 0; t < attempts; t++) {
      const seed = makeInitialAssignment();
      const { best, bestCost } = improveBySwaps(seed);
      if (bestCost < bestGlobalCost) {
        bestGlobalCost = bestCost;
        bestGlobal = best;
        if (bestGlobalCost === 0) break;
      }
    }

    // 적용
    if (!bestGlobal) bestGlobal = makeInitialAssignment();

    for (const id of freeSeatIds) {
      const seat = getSeat(id);
      if (!seat || seat.void) continue;
      // 고정 좌석은 건드리지 않음
      if (seat.locked) continue;
      const nm = bestGlobal[id];
      seat.name = nm ?? null;
    }

    syncOptionEnables();
    computeViolations();
    renderGrid();
    updateRotationCounts();

    if (forbiddenPairs.length > 0 && bestGlobalCost > 0) {
      toast(`금지 조건을 모두 만족시키기 어려워요(남은 위반 ${bestGlobalCost}건).`);
    }
    log("자동 배치 완료 ✅");
  }

  // ===== Modals =====
  function openModal(el) {
    if (!el) return;
    closeGroupMenu();
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll(".modalOverlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeModal(ov);
    });
  });
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      const el = $(id);
      if (el) closeModal(el);
    });
  });

  if (autoFillBtn) autoFillBtn.addEventListener("click", autoFill);
  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  if (restoreVoidsBtn) restoreVoidsBtn.addEventListener("click", restoreVoids);

  if (showSeatNo) showSeatNo.addEventListener("change", renderGrid);
  if (showGroups) showGroups.addEventListener("change", () => { closeGroupMenu(); renderGrid(); });
  if (showGender) showGender.addEventListener("change", renderGrid);

  if (groupMode) groupMode.addEventListener("change", () => {
    // ✅ 자동 모둠표기 모드를 바꾸면(=재계산 의도) 기존 수동 지정은 초기화
    if (groupMode.value !== "none") {
      seats.forEach((s) => { if (s && !s.void) s.groupManual = false; });
    }
    renderGrid();
    log("모둠 크기 변경");
  });
  if (balanceLevels) balanceLevels.addEventListener("change", () => {
    ensureShowGroupsForBalance();
    renderGrid();
    log("모둠별 수준 분산 옵션 변경");
  });

  if (resetHistoryBtn) resetHistoryBtn.addEventListener("click", () => {
    history = {};
    log("로테이션 기록 초기화 완료.");
  });

  if (toggleOrientationBtn) toggleOrientationBtn.addEventListener("click", () => {
    uiMode = "none";
    selectedSeatId = null;
    closeGroupMenu();
    boardAtTop = !boardAtTop;
    updateOrientationButtonLabel();
    renderGrid();
    log(boardAtTop ? "방향 변경: 칠판 위" : "방향 변경: 칠판 아래 — 좌석 상하 반전 + 칠판 위치 이동");
  });

  if (openStudentsBtn) openStudentsBtn.addEventListener("click", () => openModal(studentsModal));
  if (applyStudentsBtn) applyStudentsBtn.addEventListener("click", () => {
    normalizeStudentsInput();
    closeModal(studentsModal);
    toast("적용됐어요!");
    log("학생 명단 적용");
  });

  // 학생 입력 편의 버튼
  if (studentsNormalizeBtn && studentsInput) {
    studentsNormalizeBtn.addEventListener("click", () => {
      studentsInput.value = normalizeLines(studentsInput.value);
      toast("줄을 정리했어요!");
    });
  }
  if (studentsNamesOnlyBtn && studentsInput) {
    studentsNamesOnlyBtn.addEventListener("click", () => {
      studentsInput.value = namesToLines(studentsInput.value);
      toast("이름만 한 줄씩 정리했어요!");
    });
  }

  if (openOptionsBtn) openOptionsBtn.addEventListener("click", () => openModal(optionsModal));
  if (applyOptionsBtn) applyOptionsBtn.addEventListener("click", () => {
    ensureShowGroupsForBalance();
    computeViolations();
    renderGrid();
    closeModal(optionsModal);
    toast("옵션이 적용됐어요!");
  });
  if (openSaveBtn) openSaveBtn.addEventListener("click", () => openModal(saveModal));

  if (openLayoutBtn) openLayoutBtn.addEventListener("click", () => {
    syncLayoutModalUIFromState();
    openModal(layoutModal);
  });

  if (layoutKindSel) layoutKindSel.addEventListener("change", () => onLayoutKindChanged());
  [colsSingleSel, rowsSingleSel, pairColsSel, rowsPairSel, groupSizeSel, groupCountSel].forEach((el) => {
    if (el) el.addEventListener("change", updateLayoutPreview);
  });

  if (applyLayoutBtn) applyLayoutBtn.addEventListener("click", () => {
    const kind = layoutKindSel ? layoutKindSel.value : "single";

    if (kind === "single") {
      layoutParams.singleCols = Number(colsSingleSel.value);
      layoutParams.singleRows = Number(rowsSingleSel.value);
    } else if (kind === "pair") {
      layoutParams.pairCols = Number(pairColsSel.value);
      layoutParams.pairRows = Number(rowsPairSel.value);
    } else {
      layoutParams.groupSize = Number(groupSizeSel.value);
      layoutParams.groupCount = Number(groupCountSel.value);
    }

    const ok = applyLayout(kind, layoutParams);
    if (ok) { closeModal(layoutModal); toast("책상 배열이 적용됐어요!"); }
  });

  // ===== Export (PNG/Print) =====
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
  function dashedRoundRect(ctx, x, y, w, h, r) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    roundRect(ctx, x, y, w, h, r, false, true);
    ctx.restore();
  }

  function renderToCanvas() {
    const seatW = Number(getComputedStyle(gridEl).getPropertyValue("--seatW").replace("px", "")) || 130;
    const seatH = Number(getComputedStyle(gridEl).getPropertyValue("--seatH").replace("px", "")) || 70;
    const gap = Number(getComputedStyle(gridEl).getPropertyValue("--gap").replace("px", "")) || 10;

    const pad = 30;
    const boardH = 80;
    const titleH = 30;

    const isPair = layoutKind === "pair";
    const pc = isPair ? Math.max(1, Math.floor(cols / 2)) : 0;
    const extraTotal = isPair ? (pc - 1) * pairGapExtraExport : 0;

    const gridW = cols * seatW + (cols - 1) * gap + extraTotal;
    const gridH = rows * seatH + (rows - 1) * gap;

    const totalW = pad * 2 + gridW;
    const totalH = pad * 2 + titleH + boardH + 12 + gridH;

    canvas.width = Math.max(900, Math.ceil(totalW));
    canvas.height = Math.max(650, Math.ceil(totalH));

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("자리 배치도", pad, pad + 16);

    const boardYTop = pad + titleH;
    const boardYBottom = pad + titleH + gridH + 12;
    const boardY = boardAtTop ? boardYTop : boardYBottom;

    const gridY = boardAtTop ? boardY + boardH + 12 : pad + titleH;

    ctx.fillStyle = "rgba(34,197,94,0.10)";
    ctx.strokeStyle = "rgba(34,197,94,0.45)";
    ctx.lineWidth = 2;
    roundRect(ctx, pad, boardY, gridW, boardH, 16, true, true);

    ctx.fillStyle = "#bbf7d0";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("칠판", pad + gridW / 2, boardY + boardH / 2);

    const vioSet = new Set();
    for (const v of violations) { vioSet.add(v.aId); vioSet.add(v.bId); }

    for (let displayR = 0; displayR < rows; displayR++) {
      const dataRow = mapDisplayRowToDataRow(displayR);

      for (let c = 0; c < cols; c++) {
        const seatId = dataRow * cols + c;
        const seat = getSeat(seatId);
        if (!seat) continue;

        const extraX = isPair ? Math.floor(c / 2) * pairGapExtraExport : 0;

        const x = pad + c * (seatW + gap) + extraX;
        const y = gridY + displayR * (seatH + gap);

        if (seat.void) {
          ctx.fillStyle = "rgba(0,0,0,0)";
          ctx.strokeStyle = "rgba(255,255,255,0.20)";
          ctx.lineWidth = 2;
          dashedRoundRect(ctx, x, y, seatW, seatH, 14);
          ctx.fillStyle = "rgba(156,163,175,0.65)";
          ctx.font = "800 16px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("통로", x + seatW / 2, y + seatH / 2);
          continue;
        }

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.strokeStyle = "rgba(229,231,235,0.35)";
        if (seat.seatGender === "M") ctx.strokeStyle = "rgba(59,130,246,0.85)";
        if (seat.seatGender === "F") ctx.strokeStyle = "rgba(239,68,68,0.85)";
        ctx.lineWidth = 2;

        // 고정 좌석: 파란 테두리 약간 강조
        if (seat.locked) {
          ctx.strokeStyle = "rgba(59,130,246,0.85)";
          ctx.lineWidth = 2.5;
        }

        if (vioSet.has(seat.id)) { ctx.strokeStyle = "rgba(239,68,68,0.95)"; ctx.lineWidth = 3; }

        roundRect(ctx, x, y, seatW, seatH, 14, true, true);

        if (showSeatNo && showSeatNo.checked) {
          ctx.fillStyle = "rgba(156,163,175,0.9)";
          ctx.font = "800 12px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(String(seat.id + 1), x + 10, y + 8);
        }

        // 좌상단 핀(고정 표시) - 고정인 경우만
        if (seat.locked) {
          ctx.fillStyle = "rgba(59,130,246,0.22)";
          ctx.strokeStyle = "rgba(59,130,246,0.55)";
          ctx.lineWidth = 1.5;
          roundRect(ctx, x + 8, y + 8, 28, 20, 8, true, true);
          ctx.fillStyle = "rgba(219,234,254,1)";
          ctx.font = "900 12px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("📌", x + 22, y + 18);
        }

        const nm = seat.name ? seat.name : "빈자리";
        ctx.fillStyle = seat.name ? "#e5e7eb" : "rgba(156,163,175,0.85)";
        ctx.font = seat.name ? "900 18px system-ui" : "800 16px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nm, x + seatW / 2, y + seatH / 2);

        // 모둠 표시(텍스트만)
        if (showGroups && showGroups.checked) {
          const gid = clamp(Number(seat.groupId ?? 1), 1, 8);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          roundRect(ctx, x + 8, y + seatH - 26, 64, 18, 9, true, true);
          ctx.fillStyle = "rgba(229,231,235,0.9)";
          ctx.font = "800 11px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`모둠 ${gid}`, x + 16, y + seatH - 17);
        }

        if (showGender && showGender.checked) {
          const g = seat.seatGender === "A" ? "무관" : seat.seatGender === "M" ? "남" : "여";
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          roundRect(ctx, x + seatW - 54, y + seatH - 26, 46, 18, 9, true, true);
          ctx.fillStyle = "rgba(156,163,175,0.95)";
          ctx.font = "900 11px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(g, x + seatW - 31, y + seatH - 17);
        }
      }
    }

    ctx.fillStyle = "rgba(156,163,175,0.85)";
    ctx.font = "800 12px system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(new Date().toLocaleString(), pad + gridW, canvas.height - 10);

    return canvas.toDataURL("image/png");
  }

  function downloadPng() {
    const dataUrl = renderToCanvas();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `seatplan_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    log("이미지 다운로드 완료!");
  }

  function printPlan() {
    const dataUrl = renderToCanvas();
    const w = window.open("", "_blank");
    if (!w) { toast("팝업이 막혀서 인쇄창을 열 수 없어요."); return; }
    w.document.write(`
      <html><head><title>Print</title></head>
      <body style="margin:0;padding:12px;background:#111;">
        <img src="${dataUrl}" style="width:100%;max-width:1100px;display:block;margin:0 auto;" />
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
    log("인쇄창을 열었어요.");
  }

  if (downloadPngBtn) downloadPngBtn.addEventListener("click", downloadPng);
  if (printBtn) printBtn.addEventListener("click", printPlan);

  // ===== Service Worker =====
  async function registerSW() {
    if (!swStatusEl) return;

    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      swStatusEl.textContent = "개발모드(비활성)";
      return;
    }
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

  // ===== Save Slots =====
  const SLOT_INDEX_KEY = "seatplan_slots_v015";
  function slotKey(id) { return `seatplan_slot_${id}_v015`; }

  function loadSlotIndex() {
    try {
      const raw = localStorage.getItem(SLOT_INDEX_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }
  function saveSlotIndex(list) { localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(list)); }

  function refreshSlotSelect() {
    if (!slotSelect) return;
    const list = loadSlotIndex();
    slotSelect.innerHTML = "";
    if (list.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "슬롯 없음";
      slotSelect.appendChild(opt);
      slotSelect.disabled = true;
      return;
    }
    slotSelect.disabled = false;
    for (const s of list) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      slotSelect.appendChild(opt);
    }
  }

  function initSlots() {
    const list = loadSlotIndex();
    if (list.length === 0) {
      const id = String(Date.now());
      saveSlotIndex([{ id, name: "기본 슬롯" }]);
    }
    refreshSlotSelect();
    const l = loadSlotIndex();
    if (slotSelect && l[0]) slotSelect.value = l[0].id;
  }

  function currentSnapshot() {
    return {
      version: "0.40",
      cols, rows,
      seatType: seatTypeSel ? seatTypeSel.value : "single",
      boardAtTop,
      layout: { layoutKind, layoutParams },
      ui: {
      useForbidden: useForbidden?.checked ?? true,
      useRotation: useRotation?.checked ?? true,
        showSeatNo: !!(showSeatNo && showSeatNo.checked),
        showGroups: !!(showGroups && showGroups.checked),
        showGender: !!(showGender && showGender.checked),
        includeDiagonal: !!(includeDiagonal && includeDiagonal.checked),
        groupMode: groupMode ? groupMode.value : "none",
        balanceLevels: !!(balanceLevels && balanceLevels.checked),
        rotateFront: !!(rotateFront && rotateFront.checked),
        rotateBack: !!(rotateBack && rotateBack.checked),
      },
      text: {
        students: studentsInput ? studentsInput.value : "",
        forbidden: forbiddenInput ? forbiddenInput.value : "",
      },
      seats,
      history,
    };
  }

  function applySnapshot(snap) {
    if (!snap) return;

    if (snap.layout && snap.layout.layoutKind) {
      layoutKind = snap.layout.layoutKind;
      layoutParams = snap.layout.layoutParams || layoutParams;
      const ok = applyLayout(layoutKind, layoutParams);
      if (!ok) {
        cols = Number(snap.cols ?? 5);
        rows = Number(snap.rows ?? 6);
        if (seatTypeSel) seatTypeSel.value = "single";
        buildSeatModel();
      }
    } else {
      cols = Number(snap.cols ?? 5);
      rows = Number(snap.rows ?? 6);
      if (seatTypeSel) seatTypeSel.value = "single";
      layoutKind = "single";
      buildSeatModel();
    }

    boardAtTop = !!snap.boardAtTop;

    const ui = snap.ui || {};
    if (showSeatNo) showSeatNo.checked = !!ui.showSeatNo;
    if (showGroups) showGroups.checked = !!ui.showGroups;
    if (showGender) showGender.checked = !!ui.showGender;
    if (includeDiagonal) includeDiagonal.checked = !!ui.includeDiagonal;
    if (groupMode) groupMode.value = ui.groupMode ?? "none";
    if (balanceLevels) balanceLevels.checked = !!ui.balanceLevels;
    if (rotateFront) rotateFront.checked = !!ui.rotateFront;
    if (rotateBack) rotateBack.checked = !!ui.rotateBack;
    if (useForbidden) useForbidden.checked = ui.useForbidden ?? true;
    if (useRotation) useRotation.checked = ui.useRotation ?? true;

    const text = snap.text || {};
    if (studentsInput) studentsInput.value = text.students ?? "";
    if (forbiddenInput) forbiddenInput.value = text.forbidden ?? "";

    history = snap.history || {};

    if (Array.isArray(snap.seats)) {
      for (const src of snap.seats) {
        const dst = getSeat(src.id);
        if (!dst) continue;
        dst.name = src.name ?? null;
        dst.locked = !!src.locked;
        dst.void = !!src.void;
        dst.groupId = clamp(Number(src.groupId ?? 1), 1, 8);
        dst.groupManual = !!src.groupManual;
        dst.seatGender = src.seatGender ?? "A";
      }
    }

    uiMode = "none";
    selectedSeatId = null;
    closeGroupMenu();
    updateOrientationButtonLabel();
    syncOptionEnables();
    computeViolations();
    renderGrid();
  }

  if (newSlotBtn) newSlotBtn.addEventListener("click", () => {
    const name = prompt("새 슬롯 이름(예: 3-2반 3월)");
    if (!name) return;
    const list = loadSlotIndex();
    const id = String(Date.now());
    list.unshift({ id, name });
    saveSlotIndex(list);
    refreshSlotSelect();
    if (slotSelect) slotSelect.value = id;
    log(`슬롯 생성: ${name}`);
  });

  if (saveBtn) saveBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("저장할 슬롯을 선택하세요."); return; }
    localStorage.setItem(slotKey(id), JSON.stringify(currentSnapshot()));
    toast("저장 완료!");
    log("슬롯 저장 완료");
  });

  if (loadBtn) loadBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("불러올 슬롯을 선택하세요."); return; }
    const raw = localStorage.getItem(slotKey(id));
    if (!raw) { toast("저장 데이터가 없어요."); return; }
    try {
      applySnapshot(JSON.parse(raw));
      toast("불러오기 완료!");
      log("슬롯 불러오기 완료");
    } catch { toast("불러오기 실패(데이터 손상)."); }
  });

  if (deleteSlotBtn) deleteSlotBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("삭제할 슬롯이 없어요."); return; }
    if (!confirm("이 슬롯을 삭제할까요?")) return;

    localStorage.removeItem(slotKey(id));
    let list = loadSlotIndex();
    list = list.filter((x) => x.id !== id);
    saveSlotIndex(list);
    refreshSlotSelect();
    toast("슬롯 삭제 완료");
    log("슬롯 삭제 완료");
  });

  if (forbiddenInput) forbiddenInput.addEventListener("input", () => {
    syncOptionEnables();
    computeViolations();
    renderGrid();
  });

  if (includeDiagonal) includeDiagonal.addEventListener("change", () => {
    computeViolations();
    renderGrid();
  });

  if (useForbidden) useForbidden.addEventListener("change", () => {
    syncOptionEnables();
    computeViolations();
    renderGrid();
  });

  if (useRotation) useRotation.addEventListener("change", () => {
    syncOptionEnables();
  });

  // ===== Start =====
  function start() {
    registerSW();
    initSlots();
    updateOrientationButtonLabel();
    applyHintVisibility();

    layoutKind = "single";
    layoutParams.singleCols = 5;
    layoutParams.singleRows = 6;
    applyLayout("single", layoutParams);

    syncLayoutModalUIFromState();
    log("v0.31 시작: 금지쌍/그룹(쉼표) 인접 금지 자동배치 반영");
    log("v0.30 변경: 고정좌석 핀(좌상단) + 모둠태그 색상 + 잘림없는 모둠 메뉴 + 최소 책상 크기");
  }

  start();
})()
  function normalizeStudentsInput() {
    if (!studentsInput) return;
    const lines = (studentsInput.value || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => x.replace(/\s+/g, " "));
    studentsInput.value = lines.join("\n");
  }

;