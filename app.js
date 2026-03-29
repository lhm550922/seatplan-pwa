/* SeatPlan App (v0.91) */
/* SeatPlan PWA - app.js v0.83
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
  const undoBtn = $("undoBtn");
  const redoBtn = $("redoBtn");
  const downloadPngBtn = $("downloadPngBtn");
  const printBtn = $("printBtn");

  const openLayoutBtn = $("openLayoutBtn");
  const openStudentsBtn = $("openStudentsBtn");
  const openOptionsBtn = $("openOptionsBtn");
  const openSaveBtn = $("openSaveBtn");
  const openGuideBtn = $("openGuideBtn");
  const demoBtn = $("demoBtn");

  const layoutModal = $("layoutModal");
  const studentsModal = $("studentsModal");
  const optionsModal = $("optionsModal");
  const applyOptionsBtn = $("applyOptionsBtn");
  const saveModal = $("saveModal");
  const shareBtn = $("shareBtn");
  const shareBox = $("shareBox");
  const shareCloseBtn = $("shareCloseBtn");
  const shareApplyBtn = $("shareApplyBtn");
  const shareCopyBtn = $("shareCopyBtn");
  const shareLinkInput = $("shareLinkInput");
  const sharePreview = $("sharePreview");
  const shareWarnToggle = $("shareWarnToggle");
  const shareWarnText = $("shareWarnText");

  const incomingShareModal = $("incomingShareModal");
  const incomingApplyBtn = $("incomingApplyBtn");
  const incomingSharePreview = $("incomingSharePreview");
  const incomingWarnToggle = $("incomingWarnToggle");
  const incomingWarnText = $("incomingWarnText");

  const studentsInput = $("studentsInput");
  const applyStudentsBtn = $("applyStudentsBtn");

  // 학생 명단 영구 보존(v0.92 patch): "학생 입력 > 저장"을 누른 명단을 로컬에 저장해 업데이트/새로고침 후에도 복원
  const LS_STUDENTS_KEY = "seatplan_students_v1";

  // 임시 작업 자동 복원(페이지 이동 후 돌아와도 유지)
  const AUTOSAVE_KEY = "seatplan_autosave_v1_4";
  const AUTOSAVE_RESTORE_SESSION_KEY = "seatplan_allow_autosave_restore_v1";
  function getNavigationType() {
    try {
      const navEntries = (typeof performance !== "undefined" && performance.getEntriesByType)
        ? performance.getEntriesByType("navigation")
        : [];
      if (navEntries && navEntries[0] && navEntries[0].type) return navEntries[0].type;
      if (typeof performance !== "undefined" && performance.navigation) {
        const t = performance.navigation.type;
        if (t === 1) return "reload";
        if (t === 2) return "back_forward";
      }
    } catch (e) {}
    return "navigate";
  }
  function isBrowserReloadNavigation() {
    return getNavigationType() === "reload";
  }
  function cameFromInternalAuxPage() {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const here = location;
      if (!ref) return false;
      if (ref.origin !== here.origin) return false;
      const refPath = (ref.pathname || "").split("/").pop() || "index.html";
      const herePath = (here.pathname || "").split("/").pop() || "index.html";
      if (refPath === herePath) return false;
      return true;
    } catch (e) { return false; }
  }
  function saveAutosaveSnapshot() {
    try {
      // ✅ 학생 입력(표 UI)이 켜져 있을 때도 최신 입력값을 textarea에 반영해서 저장
      try {
        if (studentsInput && studentsTbody) {
          studentsInput.value = tableToStudentsText();
          if (typeof normalizeStudentsInput === 'function') normalizeStudentsInput();
        }
      } catch (e) {}

      // ✅ Autosave는 '현재 상태'를 저장해야 함(Undo용 스냅샷은 변경 '이전' 상태)
      const snap = (typeof currentSnapshot === "function")
        ? currentSnapshot()
        : (snapshotForHistory ? snapshotForHistory() : null);
      if (!snap) return;

      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ snap, t: Date.now() }));
    } catch (e) {}
  }
  function loadAutosaveSnapshot() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && obj.snap) return obj.snap;
      return null;
    } catch (e) { return null; }
  }
  function clearAutosaveSnapshot() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
  }
  function markAutosaveRestoreAllowed() {
    try { sessionStorage.setItem(AUTOSAVE_RESTORE_SESSION_KEY, "1"); } catch (e) {}
  }
  function clearAutosaveRestoreAllowed() {
    try { sessionStorage.removeItem(AUTOSAVE_RESTORE_SESSION_KEY); } catch (e) {}
  }
  function canRestoreAutosaveThisSession() {
    try { return sessionStorage.getItem(AUTOSAVE_RESTORE_SESSION_KEY) === "1"; } catch (e) { return false; }
  }

  // autosave는 너무 자주 쓰면 부담이 되므로 간단히 디바운스 처리
  let _autosaveTimer = null;
  function scheduleAutosave() {
    try {
      if (_autosaveTimer) clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => {
        _autosaveTimer = null;
        saveAutosaveSnapshot();
      }, 180);
    } catch (e) {}
  }

  function loadPersistedStudentsIfEmpty(){
    try{
      if(!studentsInput) return;
      if((studentsInput.value||"").trim()) return;
      const raw = localStorage.getItem(LS_STUDENTS_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      if(data && typeof data.text === "string" && data.text.trim()){
        studentsInput.value = data.text;
      }
    }catch(e){
      // ignore (private mode / storage blocked)
    }
  }
  loadPersistedStudentsIfEmpty();
  // 학생 입력(표 UI)
  const studentsTable = $("studentsTable");
  const studentsTbody = $("studentsTbody");
  const useGenderToggle = $("useGenderToggle");
  const useLevelToggle = $("useLevelToggle");
  const genderBulkRow = $("genderBulkRow");
  const applyGenderBulkBtn = $("applyGenderBulkBtn");
  const addStudentRowBtn = $("addStudentRowBtn");
  const clearStudentsBtn = $("clearStudentsBtn");
  const studentsNormalizeBtn = $("studentsNormalizeBtn");
  const studentsNamesOnlyBtn = $("studentsNamesOnlyBtn");
  const forbiddenInput = $("forbiddenInput");
  const useForbidden = $("useForbidden");
  const includeDiagonal = $("includeDiagonal");
  const includeSameGroup = $("includeSameGroup");

  // ✅ "같은 모둠도 금지"를 켜면 홈 화면에서 모둠 번호 표시도 자동 ON
  if (includeSameGroup) {
    includeSameGroup.addEventListener("change", () => {
      if (includeSameGroup.checked && showGroups) {
        showGroups.checked = true;
        saveBool("showGroups", true);
        try { renderStage(); } catch {}
      }
    });
  }
  // 세부 옵션: 금지쌍(그룹 UI)
  const forbiddenGroupsContainer = $("forbiddenGroupsContainer");
  const addForbiddenGroupBtn = $("addForbiddenGroupBtn");

  const showSeatNo = $("showSeatNo");
  const showGroups = $("showGroups");
  const showGender = $("showGender");

  const rotateFront = $("rotateFront");
  const rotateBack = $("rotateBack");

  const useRotation = $("useRotation");
  const resetHistoryBtn = $("resetHistoryBtn");
  const viewHistoryBtn = $("viewHistoryBtn");

  const groupMode = $("groupMode");
  const groupModeManual = $("groupModeManual");
  const balanceLevels = $("balanceLevels");

  const toggleOrientationBtn = $("toggleOrientationBtn");
  const stageEl = $("stage");
  const restoreVoidsBtn = $("restoreVoidsBtn");

  const modeGenderBtn = $("modeGenderBtn");
  const modePinBtn = $("modePinBtn");
  const modeBanner = $("modeBanner");

  // ✅ 버튼 툴팁(설명 풍선)
  if (modeGenderBtn) modeGenderBtn.dataset.tip = "성별에 따른 자리 배치";
  if (modePinBtn) modePinBtn.dataset.tip = "학생을 이 자리에 고정";

  const hintBar = $("hintBar");
  const hintCloseBtn = $("hintCloseBtn");

  const slotSelect = $("slotSelect");
  const slotList = $("slotList");
  const slotEmpty = $("slotEmpty");
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
  let centerToastEl = null;
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

  
  // ===== Undo (1-step+) =====
  // - PC/모바일 공통 '이전' 버튼
  // - 변경 작업 전에 스냅샷을 쌓고, 버튼 클릭 시 이전 상태로 복원
  let undoStack = [];
  let redoStack = [];
  const APP_VERSION = "1.9";
const UNDO_MAX = 30;

  function updateHistoryButtons(){
    try{
      if (undoBtn) undoBtn.disabled = (undoStack.length === 0);
      if (redoBtn) redoBtn.disabled = (redoStack.length === 0);
      if (clearBtn) clearBtn.disabled = (undoStack.length === 0 && redoStack.length === 0);
    }catch(e){}
  }

  function pushUndo(reason) {
    try {
      // Any new action invalidates redo history
      redoStack = [];
      const snap = snapshotForHistory();
      // deep copy via JSON to detach references
      const raw = JSON.stringify(snap);
      undoStack.push(raw);
      if (undoStack.length > UNDO_MAX) undoStack.shift();
      updateHistoryButtons();
    } catch (e) {
      // ignore
    }
  }

  function doUndo() {
    if (!undoStack.length) { toast("되돌릴 내용이 없어요."); return; }
    // Save current state for redo
    try {
      const cur = JSON.stringify(snapshotForHistory());
      redoStack.push(cur);
      if (redoStack.length > UNDO_MAX) redoStack.shift();
    } catch (e) {}

    let raw = undoStack.pop();
    try {
      const snap = JSON.parse(raw);
      applySnapshot(snap);
      uiMode = "none";
      selectedSeatId = null;
      moveFromSeatId = null;
      closeGroupMenu();
      computeViolations();
      renderGrid();
      toast("한 단계 이전으로 되돌렸어요.");
    } catch (e) {
      toast("되돌리기에 실패했어요.");
    }
    updateHistoryButtons();
  }

  function doRedo() {
    if (!redoStack.length) { toast("다시 실행할 내용이 없어요."); return; }
    // Save current state for undo
    try {
      const cur = JSON.stringify(snapshotForHistory());
      undoStack.push(cur);
      if (undoStack.length > UNDO_MAX) undoStack.shift();
    } catch (e) {}

    let raw = redoStack.pop();
    try {
      const snap = JSON.parse(raw);
      applySnapshot(snap);
      uiMode = "none";
      selectedSeatId = null;
      moveFromSeatId = null;
      closeGroupMenu();
      computeViolations();
      renderGrid();
      toast("한 단계 앞으로 되돌렸어요.");
    } catch (e) {
      toast("다시 실행에 실패했어요.");
    }
    updateHistoryButtons();
  }

function centerToast(msg) {
    if (!centerToastEl) {
      centerToastEl = document.createElement("div");
      centerToastEl.className = "centerToast";
      centerToastEl.setAttribute("role", "status");
      centerToastEl.setAttribute("aria-live", "polite");

      // ✅ 캐시/스타일 누락에도 항상 보이도록 인라인 스타일을 강제
      Object.assign(centerToastEl.style, {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%) scale(0.99)",
        background: "rgba(0,0,0,0.82)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "rgba(229,231,235,0.99)",
        padding: "14px 18px",
        borderRadius: "16px",
        fontSize: "16px",
        fontWeight: "900",
        zIndex: "2147483647",
        opacity: "0",
        pointerEvents: "none",
        transition: "opacity .15s ease, transform .15s ease",
        maxWidth: "min(520px, calc(100vw - 40px))",
        textAlign: "center",
        boxShadow: "0 16px 44px rgba(0,0,0,.45)",
        display: "block",
      });

      document.body.appendChild(centerToastEl);
    }

    centerToastEl.textContent = msg;

    // 항상 다시 보이도록(연속 클릭/상태 꼬임 방지)
    centerToastEl.classList.remove("show");
    // reflow
    void centerToastEl.offsetWidth;

    // show (class + inline 둘 다)
    requestAnimationFrame(() => {
      centerToastEl.classList.add("show");
      centerToastEl.style.opacity = "1";
      centerToastEl.style.transform = "translate(-50%, -50%) scale(1)";
    });

    clearTimeout(centerToastEl._t);
    clearTimeout(centerToastEl._t2);

    // hide
    centerToastEl._t = setTimeout(() => {
      centerToastEl.classList.remove("show");
      centerToastEl.style.opacity = "0";
      centerToastEl.style.transform = "translate(-50%, -50%) scale(0.99)";
      // transition 이후 완전 투명 상태 유지(요소는 남겨둠)
    }, 1800);
  }

  // 터치(모바일) UI 판정: 데스크탑 오탐을 피하기 위해 'ontouchstart'는 사용하지 않음
  // - pointer: coarse 가 가장 확실
  // - iPadOS 등에서 hover:none + maxTouchPoints 조합으로 보조
  const isTouchLike = () =>
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    ((window.matchMedia && window.matchMedia("(hover: none)").matches) && (navigator.maxTouchPoints || 0) > 0);

  
  // ===== Share link (v0.79) =====
  // Lightweight LZ-based compression (LZ-String compatible subset)
  // Source idea: https://pieroxy.net/blog/pages/lz-string/index.html (public domain-like / MIT)
  const LZ = (() => {
    const f = String.fromCharCode;
    const keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
    const getBaseValue = (alphabet, character) => alphabet.indexOf(character);

    function compressToEncodedURIComponent(input) {
      if (input == null) return "";
      return _compress(input, 6, (a) => keyStrUriSafe.charAt(a));
    }
    function decompressFromEncodedURIComponent(input) {
      if (input == null) return "";
      if (input === "") return null;
      input = input.replace(/ /g, "+");
      return _decompress(input.length, 32, (index) => getBaseValue(keyStrUriSafe, input.charAt(index)));
    }

    function _compress(uncompressed, bitsPerChar, getCharFromInt) {
      if (uncompressed == null) return "";
      let i, value;
      const context_dictionary = {};
      const context_dictionaryToCreate = {};
      let context_c = "";
      let context_wc = "";
      let context_w = "";
      let context_enlargeIn = 2; // Compensate for the first entry which should not count
      let context_dictSize = 3;
      let context_numBits = 2;
      let context_data = [];
      let context_data_val = 0;
      let context_data_position = 0;

      for (let ii = 0; ii < uncompressed.length; ii += 1) {
        context_c = uncompressed.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
          context_dictionary[context_c] = context_dictSize++;
          context_dictionaryToCreate[context_c] = true;
        }

        context_wc = context_w + context_c;
        if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
          context_w = context_wc;
        } else {
          if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
            if (context_w.charCodeAt(0) < 256) {
              for (i = 0; i < context_numBits; i++) {
                context_data_val = (context_data_val << 1);
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
              }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 8; i++) {
                context_data_val = (context_data_val << 1) | (value & 1);
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = value >> 1;
              }
            } else {
              value = 1;
              for (i = 0; i < context_numBits; i++) {
                context_data_val = (context_data_val << 1) | value;
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = 0;
              }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 16; i++) {
                context_data_val = (context_data_val << 1) | (value & 1);
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = value >> 1;
              }
            }
            context_enlargeIn--;
            if (context_enlargeIn == 0) {
              context_enlargeIn = Math.pow(2, context_numBits);
              context_numBits++;
            }
            delete context_dictionaryToCreate[context_w];
          } else {
            value = context_dictionary[context_w];
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          context_dictionary[context_wc] = context_dictSize++;
          context_w = String(context_c);
        }
      }

      if (context_w !== "") {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }

        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
      }

      value = 2;
      for (i = 0; i < context_numBits; i++) {
        context_data_val = (context_data_val << 1) | (value & 1);
        if (context_data_position == bitsPerChar - 1) {
          context_data_position = 0;
          context_data.push(getCharFromInt(context_data_val));
          context_data_val = 0;
        } else {
          context_data_position++;
        }
        value = value >> 1;
      }

      while (true) {
        context_data_val = (context_data_val << 1);
        if (context_data_position == bitsPerChar - 1) {
          context_data.push(getCharFromInt(context_data_val));
          break;
        } else context_data_position++;
      }
      return context_data.join("");
    }

    function _decompress(length, resetValue, getNextValue) {
      const dictionary = [];
      let next;
      let enlargeIn = 4;
      let dictSize = 4;
      let numBits = 3;
      let entry = "";
      let result = [];
      let i;
      let w;
      let bits, resb, maxpower, power;
      const data = { val: getNextValue(0), position: resetValue, index: 1 };

      for (i = 0; i < 3; i += 1) {
        dictionary[i] = i;
      }

      bits = 0;
      maxpower = Math.pow(2, 2);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (next = bits) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          w = f(bits);
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          w = f(bits);
          break;
        case 2:
          return "";
      }
      dictionary[3] = w;
      result.push(w);

      while (true) {
        if (data.index > length) return "";

        bits = 0;
        maxpower = Math.pow(2, numBits);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }

        switch (next = bits) {
          case 0:
            bits = 0;
            maxpower = Math.pow(2, 8);
            power = 1;
            while (power != maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            next = dictSize - 1;
            enlargeIn--;
            break;
          case 1:
            bits = 0;
            maxpower = Math.pow(2, 16);
            power = 1;
            while (power != maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            next = dictSize - 1;
            enlargeIn--;
            break;
          case 2:
            return result.join("");
        }

        if (enlargeIn == 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }

        if (dictionary[next]) {
          entry = dictionary[next];
        } else {
          if (next === dictSize) entry = w + w.charAt(0);
          else return null;
        }
        result.push(entry);

        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;

        w = entry;

        if (enlargeIn == 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }
      }
    }

    return { compressToEncodedURIComponent, decompressFromEncodedURIComponent };
  })();

  const encodeShareState = (snap) => {
    try {
      return LZ.compressToEncodedURIComponent(JSON.stringify(snap));
    } catch (e) {
      return "";
    }
  };
  const decodeShareState = (s) => {
    try {
      const raw = LZ.decompressFromEncodedURIComponent(s);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  function renderSharePreview(hostEl, snap) {
    if (!hostEl) return;
    if (!snap) { hostEl.innerHTML = "<div class='pvRow'><div class='pvK'>상태</div><div class='pvV'>미리보기를 불러올 수 없어요.</div></div>"; return; }

    const seatCount = Array.isArray(snap.seats) ? snap.seats.filter((x)=>x && !x.void).length : 0;
    const voidCount = Array.isArray(snap.seats) ? snap.seats.filter((x)=>x && x.void).length : 0;
    const studentText = snap.text?.students || "";
    const studentCount = studentText ? studentText.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).length : 0;

    const rows = [
      ["버전", snap.version || "-"],
      ["격자", `${snap.rows ?? "?"} × ${snap.cols ?? "?"}`],
      ["좌석", `${seatCount}개`],
      ["통로", `${voidCount}개`],
      ["학생 입력", `${studentCount}명(대략)`],
      ["표시", `${(snap.ui?.showSeatNo ? "번호 " : "")}${(snap.ui?.showGroups ? "모둠 " : "")}${(snap.ui?.showGender ? "성별" : "")}`.trim() || "없음"],
    ];

    hostEl.innerHTML = rows.map(([k,v]) =>
      `<div class="pvRow"><div class="pvK">${k}</div><div class="pvV">${String(v)}</div></div>`
    ).join("");
  }


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
  let forbidColorMap = new Map();


  let boardAtTop = true;
  let uiMode = "none";       // none | gender | pin
  let selectedSeatId = null; // 터치 환경에서 아이콘 표시용
  let moveFromSeatId = null; // 모바일 이동(A안)
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
      // ✅ v0.79: 수동으로 선택한 모둠 번호는 자동 모둠표기(groupMode)로 덮어쓰지 않음
      groupManual: false,
      seatGender: "A" // A/M/F
    }));
  }

  function mapDisplayRowToDataRow(displayRow) {
    return boardAtTop ? displayRow : rows - 1 - displayRow;
  }
  function mapDisplayColToDataCol(displayCol) {
    return boardAtTop ? displayCol : cols - 1 - displayCol;
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
      ? "교사 시점으로<br>바꾸기"
      : "학생 시점으로<br>바꾸기";
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
    if (!tok) return "";
const t = tok.trim();
    if (t === "상") return "상";
    if (t === "하") return "하";
    return "중";
  }
  // 학생 입력 편의 기능(v0.79)
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

  // ===== 학생 입력(표 UI) v0.79 =====
  // 학생 입력 UI: 성별/학습수준 사용 토글 (표 헤더 체크박스)
let studentsInitPhase = false;

function studentsSetVisibility(){
  if(!studentsModal) return;

  const genderOn = !!(useGenderToggle && useGenderToggle.checked);
  const levelOn  = !!(useLevelToggle && useLevelToggle.checked);

  // 스타일(회색/비활성)용 클래스
  studentsModal.classList.toggle("genderDisabled", !genderOn);
  studentsModal.classList.toggle("levelDisabled", !levelOn);

  const prevGenderOn = (studentsModal.dataset.genderOn === "1");
  const prevLevelOn  = (studentsModal.dataset.levelOn === "1");

  const rows = getStudentsTableRows();

  // ✅ 토글을 켜는 순간(초기화 단계 제외) 기본값으로 전원 세팅
  if(!studentsInitPhase){
    if(genderOn && !prevGenderOn){
      for(const tr of rows) setRowRadioValue(tr, "g", "남");
    }
    if(levelOn && !prevLevelOn){
      for(const tr of rows) setRowRadioValue(tr, "l", "중");
    }
  }

  // ✅ 비활성 시 선택 불가(disabled)
  for(const tr of rows){
    tr.querySelectorAll('input[type="radio"][name^="g_"]').forEach((r)=>{
      if(r instanceof HTMLInputElement) r.disabled = !genderOn;
    });
    tr.querySelectorAll('input[type="radio"][name^="l_"]').forEach((r)=>{
      if(r instanceof HTMLInputElement) r.disabled = !levelOn;
    });
  }

  studentsModal.dataset.genderOn = genderOn ? "1" : "0";
  studentsModal.dataset.levelOn  = levelOn  ? "1" : "0";
}

  function buildStudentsRows(count){
    if(!studentsTbody) return;
    studentsTbody.innerHTML = "";
    for(let i=0;i<count;i++){
      const idx = i+1;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="rowNo">${idx}.</td>
        <td><input type="text" class="stuName" placeholder="이름" autocomplete="off" autocapitalize="off" spellcheck="false"/></td>
        <td class="genderCell">
          <div class="radioGroup" role="radiogroup" aria-label="성별">
            <label class="radioItem"><input type="radio" name="g_${idx}" value="남" checked/> 남</label>
            <label class="radioItem"><input type="radio" name="g_${idx}" value="여"/> 여</label>
          </div>
        </td>
        <td class="levelCell">
          <div class="radioGroup" role="radiogroup" aria-label="학습 수준">
            <label class="radioItem"><input type="radio" name="l_${idx}" value="상"/> 상</label>
            <label class="radioItem"><input type="radio" name="l_${idx}" value="중" checked/> 중</label>
            <label class="radioItem"><input type="radio" name="l_${idx}" value="하"/> 하</label>
          </div>
        </td>
    `;
    studentsTbody.appendChild(tr);
    }
  }

  function getStudentsTableRows(){
    if(!studentsTbody) return [];
    return Array.from(studentsTbody.querySelectorAll("tr"));
  }

  function renumberStudentsRows(){
    const rows = getStudentsTableRows();
    rows.forEach((tr, i) => {
      const idx = i+1;
      const noCell = tr.querySelector(".rowNo");
      if(noCell) noCell.textContent = `${idx}.`;

      // 라디오 name도 재번호(행 추가/삭제 대비)
      tr.querySelectorAll('input[type="radio"]').forEach((r) => {
        const el = r;
        if(!(el instanceof HTMLInputElement)) return;
        if(el.name && el.name.startsWith("g_")) el.name = `g_${idx}`;
        if(el.name && el.name.startsWith("l_")) el.name = `l_${idx}`;
      });
    });
  }

  function addOneStudentRow(){
    if(!studentsTbody) return;
    const rows = getStudentsTableRows();
    const idx = rows.length + 1;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="rowNo">${idx}.</td>
      <td><input type="text" class="stuName" placeholder="이름" autocomplete="off" autocapitalize="off" spellcheck="false"/></td>
      <td class="genderCell">
        <div class="radioGroup" role="radiogroup" aria-label="성별">
          <label class="radioItem"><input type="radio" name="g_${idx}" value="남" checked/> 남</label>
          <label class="radioItem"><input type="radio" name="g_${idx}" value="여"/> 여</label>
        </div>
      </td>
      <td class="levelCell">
        <div class="radioGroup" role="radiogroup" aria-label="학습 수준">
          <label class="radioItem"><input type="radio" name="l_${idx}" value="상"/> 상</label>
          <label class="radioItem"><input type="radio" name="l_${idx}" value="중" checked/> 중</label>
          <label class="radioItem"><input type="radio" name="l_${idx}" value="하"/> 하</label>
        </div>
      </td>
    `;
    studentsTbody.appendChild(tr);
    studentsSetVisibility();
    const inp = tr.querySelector(".stuName");
    inp && inp.focus();
  }

  function rowSelectedValue(tr, namePrefix){
    const el = tr.querySelector(`input[type="radio"][name^="${namePrefix}_"]:checked`);
    if(el && el instanceof HTMLInputElement) return (el.value||"").trim();
    return "";
  }
  function setRowRadioValue(tr, namePrefix, value){
    const radios = tr.querySelectorAll(`input[type="radio"][name^="${namePrefix}_"]`);
    radios.forEach((r)=>{
      const el = r;
      if(el instanceof HTMLInputElement){
        el.checked = (el.value === value);
      }
    });
  }

  function tableToStudentsText(){
    const rows = getStudentsTableRows();
    const useGender = !!(useGenderToggle && useGenderToggle.checked);
    const useLevel = !!(useLevelToggle && useLevelToggle.checked);
    const out = [];
    for(const tr of rows){
      const name = (tr.querySelector(".stuName")?.value || "").trim();
      if(!name) continue;

      const parts = [name];
      if(useGender){
        const g = rowSelectedValue(tr, "g") || "남";
        parts.push(g);
      }
      if(useLevel){
        const lv = rowSelectedValue(tr, "l") || "중";
        parts.push(lv);
      }
      out.push(parts.join(" "));
    }
    return out.join("\n");
  }

  function studentsTextToTable(){
    studentsInitPhase = true;
    const students = parseStudents(studentsInput ? studentsInput.value : "");
    const showGender = students.some(s => s.gender && s.gender !== "A");
    const showLevel = students.some(s => !!s.level);
    if(useGenderToggle) useGenderToggle.checked = showGender;
    if(useLevelToggle) useLevelToggle.checked = showLevel;
    studentsSetVisibility();

    const rowCount = Math.max(20, students.length || 0);
    buildStudentsRows(rowCount);

    const rows = getStudentsTableRows();
    students.forEach((s, i) => {
      const tr = rows[i];
      if(!tr) return;
      const nameEl = tr.querySelector(".stuName");
      if(nameEl) nameEl.value = s.name || "";

      if(s.gender === "M") setRowRadioValue(tr, "g", "남");
      else if(s.gender === "F") setRowRadioValue(tr, "g", "여");
      else setRowRadioValue(tr, "g", "남"); // 기본

      if(s.level === "상") setRowRadioValue(tr, "l", "상");
      else if(s.level === "하") setRowRadioValue(tr, "l", "하");
      else setRowRadioValue(tr, "l", "중"); // 기본
    });
    studentsInitPhase = false;
  }

  function initStudentsModalUI(){
    if(!studentsInput || !studentsTbody) return;

    if((studentsInput.value || "").trim()){
      studentsTextToTable();
    }else{
      if(useGenderToggle) useGenderToggle.checked = false;
      if(useLevelToggle) useLevelToggle.checked = false;
      studentsSetVisibility();
      buildStudentsRows(20);
    }

    studentsSetVisibility();

    // IME(한글) 입력 안전: 조합 중 Enter는 건드리지 않기
    let composing = false;
    studentsTbody.oncompositionstart = () => { composing = true; };
    studentsTbody.oncompositionend = () => { composing = false; };

    studentsTbody.onkeydown = (e) => {
      if(e.key === "Enter"){
        if(e.isComposing || composing) return;
        const target = e.target;
        if(!(target instanceof HTMLElement)) return;
        if(target.classList.contains("stuName")){
          e.preventDefault();
          const tr = target.closest("tr");
          const rows = getStudentsTableRows();
          const idx = rows.indexOf(tr);
          // 조합 완료 이후 이동(마지막 글자 복제 버그 방지)
          setTimeout(() => {
            const next = rows[idx+1]?.querySelector(".stuName");
            if(next) next.focus();
            else addOneStudentRow();
          }, 0);
        }
      }
    };
  }

  function applyGenderBulk(){
    if(!useGenderToggle || !useGenderToggle.checked) return;
    const checked = studentsModal?.querySelector('input[type="radio"][name="bulkGender"]:checked');
    const val = (checked && checked instanceof HTMLInputElement) ? checked.value : "남";
    const rows = getStudentsTableRows();
    for(const tr of rows){
      const name = (tr.querySelector(".stuName")?.value || "").trim();
      if(!name) continue;
      setRowRadioValue(tr, "g", val);
    }
    toast("성별을 일괄 적용했어요!");
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

    // 수동 모둠 변경 이후에는 자동 그룹핑으로 다른 좌석이 움직이지 않도록 함
    if (autoGroupFrozen) return;

    const size = Number(mode);
    if (!size) return;

    // ✅ void 제외 + 수동 지정된 좌석은 자동 그룹핑으로 덮어쓰지 않음
// v0.82: 세로줄(열 우선) 기준으로 모둠 자동 지정
// - 좌석을 (열 -> 행) 순서로 훑어서, 같은 열의 위/아래가 먼저 같은 모둠이 되도록 한다.
const activeSet = new Set(
  seats
    .filter((s) => !s.void && !s.groupManual)
    .map((s) => s.id)
);

const orderedIds = [];
for (let c = 0; c < cols; c++) {
  for (let r = 0; r < rows; r++) {
    const id = r * cols + c;
    if (activeSet.has(id)) orderedIds.push(id);
  }
}

let gidCounter = 1;
for (let i = 0; i < orderedIds.length; i += size) {
  const gid = clamp(gidCounter, 1, 8);
  const chunk = orderedIds.slice(i, i + size);
  for (const id of chunk) {
    const s = getSeat(id);
    if (s) s.groupId = gid;
  }
  gidCounter = gidCounter % 8 + 1;
}
  }

  function setAccordionVisibility(kind) {
    if (accSingle) accSingle.classList.toggle("hidden", kind !== "single");
    if (accPair) accPair.classList.toggle("hidden", kind !== "pair");
    if (accGroup) accGroup.classList.toggle("hidden", kind !== "group");
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


  function applyPreviewAutoScale(wrap){
    if (!layoutPreviewEl || !wrap) return;
    // 미리보기는 모달 폭을 넘기면 자동 축소
    requestAnimationFrame(() => {
      const avail = (layoutPreviewEl.clientWidth || 0) - 4;
      const w = wrap.offsetWidth || 0;
      if (!avail || !w) return;
      if (w > avail) {
        const s = Math.max(0.2, Math.min(1, avail / w));
        wrap.style.transformOrigin = 'top left';
        wrap.style.transform = `scale(${s})`;
      } else {
        wrap.style.transform = '';
      }
    });
  }

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
      applyPreviewAutoScale(wrap);
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
      applyPreviewAutoScale(wrap);
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
    applyPreviewAutoScale(wrap);
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
      // 1인 책상 배열: 열 최대 12까지 지원(가로 스크롤로 대응)
      cols = clamp(Number(params.singleCols), 1, 12);
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

  function setMoveFromOnSeat(id, on) {
    if (!gridEl) return;
    const seatDiv = gridEl.querySelector(`.seat[data-seat-id="${id}"]`);
    if (!seatDiv) return;
    seatDiv.classList.toggle("moveFrom", !!on);
  }
  function clearMoveFromAll() {
    if (!gridEl) return;
    gridEl.querySelectorAll(".seat.moveFrom").forEach((el) => el.classList.remove("moveFrom"));
  }



  // ✅ 좌석 교체(이동) 시 짧은 시각 효과
  function flashSeats(ids) {
    if (!gridEl) return;
    for (const sid of (ids || [])) {
      const el = gridEl.querySelector(`.seat[data-seat-id="${sid}"]`);
      if (!el) continue;
      el.classList.add("swapFlash");
      clearTimeout(el._flashT);
      el._flashT = setTimeout(() => el.classList.remove("swapFlash"), 420);
    }
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

    const vioSet = new Set(); // Export: do not mark forbidden violations

    forbidColorMap = buildForbiddenGroupColorMap();

    gridEl.innerHTML = "";

    for (let displayR = 0; displayR < rows; displayR++) {
      const dataRow = mapDisplayRowToDataRow(displayR);

      if (!isPair) {
        for (let c = 0; c < cols; c++) {
          const dataCol = mapDisplayColToDataCol(c);
          const seatId = dataRow * cols + dataCol;
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
          const dataCol = mapDisplayColToDataCol(c);
          const seatId = dataRow * cols + dataCol;
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
      clearMoveFromAll();
      if (selectedSeatId != null) setShowActionsOnSeat(selectedSeatId, true);
      if (moveFromSeatId != null) setMoveFromOnSeat(moveFromSeatId, true);
    }

    // 모둠 메뉴가 열린 상태면 위치 재계산(스크롤/리렌더 대응)
    if (groupMenuState.open) {
      const seatId = groupMenuState.seatId;
      const tag = gridEl.querySelector(`.seat[data-seat-id="${seatId}"] .groupTag`);
      if (tag) positionGroupMenu(tag);
      else closeGroupMenu();
    }

    // ✅ 화면이 갱신된 후 현재 작업 상태를 autosave(페이지 이동 후 복원용)
    scheduleAutosave();
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

      // 모바일(터치)에서는 드래그가 스크롤과 충돌하기 쉬워서 최소지원: 드래그 비활성화
      div.draggable = (uiMode === "none" && !isTouchLike());

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

    // ✅ 모바일 자리 이동(A안) 아이콘(삭제 아이콘 왼쪽)
    // 데스크탑(PC)에는 노출/삽입하지 않아서 PC에서 ↔ 표시가 생기지 않게 함
    if (isTouchLike()) {
      const move = document.createElement("div");
      move.className = "moveBadge";
      move.dataset.action = "moveStart";
      move.textContent = "↔️";
      move.title = "자리 이동(교체)";
      if (seat.void) move.classList.add("hidden");
      div.appendChild(move);
    }

    // ✅ 모둠 태그: showGroups 체크면 항상 표시(통로 제외)
    if (showGroups && showGroups.checked && !seat.void && uiMode !== "gender" && uiMode !== "pin") {
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
      const len = seat.name.length;
      let f = baseFont;
      if (len >= 6) f = baseFont - 1;
      if (len >= 9) f = baseFont - 2;
      if (len >= 12) f = baseFont - 3;
      name.style.fontSize = `${Math.max(11, f)}px`;

      // 금지쌍 그룹 표시: 이름 옆 색 점(복수 가능)
      if (forbidColorMap && forbidColorMap.has(seat.name)) {
        const info = forbidColorMap.get(seat.name);
        const colors = (info && info.colors && info.colors.length) ? info.colors : [];

        name.classList.add('withDots');
        const label = document.createElement('span');
        label.className = 'nameLabel';
        label.textContent = seat.name;

        const dots = document.createElement('span');
        dots.className = 'forbidDots';
        for (const c of colors) {
          const d = document.createElement('span');
          d.className = 'forbidDot';
          d.style.setProperty('--dotColor', c);
          dots.appendChild(d);
        }

        name.appendChild(label);
        name.appendChild(dots);
      } else {
        name.textContent = seat.name;
      }

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

    // --- Rotation overlaps (front/back) ---
    // Show them in the same warning bar as forbidden-pair violations.
    // NOTE: Rotation avoidance can become impossible as history accumulates.
    const rotationLines = [];
    let rotationCount = 0;
    try {
      const rotOn = (!useRotation) || useRotation.checked;
      const wantFront = !!(rotOn && rotateFront && rotateFront.checked);
      const wantBack  = !!(rotOn && rotateBack && rotateBack.checked);
      if (wantFront || wantBack) {
        const rotationLedger = loadRotationLedger();
        const slotIndexList = loadSlotIndex ? loadSlotIndex() : [];
        const slotNameById = new Map();
        try { for (const s of slotIndexList) slotNameById.set(String(s.id), s.name); } catch(e) {}

        const rotationDetail = new Map(); // name -> { front:[{slot,t}], back:[{slot,t}] }
        const bannedFrontNames = new Set();
        const bannedBackNames = new Set();
        for (const slotId of Object.keys(rotationLedger || {})) {
          const e = rotationLedger[slotId];
          if (!e) continue;
          const slotName = slotNameById.get(String(slotId)) || String(slotId);
          const t = Number(e.t || 0);
          const fr = Array.isArray(e.front) ? e.front : [];
          const bk = Array.isArray(e.back) ? e.back : [];
          for (const n of fr) {
            if (!n) continue;
            const nm = String(n);
            bannedFrontNames.add(nm);
            if (!rotationDetail.has(nm)) rotationDetail.set(nm, { front: [], back: [] });
            rotationDetail.get(nm).front.push({ slot: slotName, t });
          }
          for (const n of bk) {
            if (!n) continue;
            const nm = String(n);
            bannedBackNames.add(nm);
            if (!rotationDetail.has(nm)) rotationDetail.set(nm, { front: [], back: [] });
            rotationDetail.get(nm).back.push({ slot: slotName, t });
          }
        }
        for (const v of rotationDetail.values()) {
          v.front.sort((a,b)=> (b.t||0)-(a.t||0));
          v.back.sort((a,b)=> (b.t||0)-(a.t||0));
        }

        // Front/back row seat sets based on current orientation (boardAtTop)
        const displayFrontRow = boardAtTop ? 0 : (rows - 1);
        const displayBackRow  = boardAtTop ? (rows - 1) : 0;
        const toDataRow = (displayRow) => boardAtTop ? displayRow : (rows - 1 - displayRow);
        const frontRowIndex = toDataRow(displayFrontRow);
        const backRowIndex  = toDataRow(displayBackRow);
        const frontSeatSet = new Set();
        const backSeatSet = new Set();
        for (let cc=0; cc<cols; cc++){
          frontSeatSet.add(frontRowIndex*cols + cc);
          backSeatSet.add(backRowIndex*cols + cc);
        }

        const fmtDate = (t) => {
          try {
            if (!t) return "";
            const d = new Date(t);
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2,"0");
            const dd = String(d.getDate()).padStart(2,"0");
            return `${y}-${m}-${dd}`;
          } catch { return ""; }
        };

        const uniq = new Set();
        for (const s of seats) {
          if (!s || s.void || !s.name) continue;
          const nm = String(s.name);
          if (wantFront && frontSeatSet.has(s.id) && bannedFrontNames.has(nm)) {
            const key = nm + "|front";
            if (!uniq.has(key)) {
              uniq.add(key);
              rotationCount += 1;
              const det = rotationDetail.get(nm);
              const d0 = det && det.front && det.front[0];
              const when = d0 ? `${d0.slot}(${fmtDate(d0.t)})` : "";
              rotationLines.push(`- ${nm}(이전 맨 앞줄: ${when || "기록 있음"})`);
            }
          }
          if (wantBack && backSeatSet.has(s.id) && bannedBackNames.has(nm)) {
            const key = nm + "|back";
            if (!uniq.has(key)) {
              uniq.add(key);
              rotationCount += 1;
              const det = rotationDetail.get(nm);
              const d0 = det && det.back && det.back[0];
              const when = d0 ? `${d0.slot}(${fmtDate(d0.t)})` : "";
              rotationLines.push(`- ${nm}(이전 맨 뒷줄: ${when || "기록 있음"})`);
            }
          }
        }

        if (rotationCount > 0) {
          rotationLines.unshift("※ 저장된 배치도 전체 기록 기준으로 회피하면, 좌석 수에 따라 100% 회피가 불가능할 수 있어요.");
        }
      }
    } catch(e) {
      // ignore
    }

    if (useForbidden && !useForbidden.checked) {
      // forbidden off — still show rotation warnings if any
      if (violationsBar) {
        if (rotationCount > 0) {
          violationsBar.textContent = `로테이션 중복 ${rotationCount}명:\n` + rotationLines.join("\n");
          violationsBar.style.display = "block";
        } else {
          violationsBar.style.display = "none"; violationsBar.textContent = "";
        }
      }
      return;
    }

    const pairs = parseForbidden(forbiddenInput ? forbiddenInput.value : "");
    const forbid = buildForbiddenSet(pairs);


    if (forbid.size === 0) {
      if (violationsBar) {
        if (rotationCount > 0) {
          violationsBar.textContent = `로테이션 중복 ${rotationCount}명:\n` + rotationLines.join("\n");
          violationsBar.style.display = "block";
        } else {
          violationsBar.style.display = "none"; violationsBar.textContent = "";
        }
      }
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
      const sameGroupOn = !!(includeSameGroup && includeSameGroup.checked && groupMode && groupMode.value !== "none");
      const aSeat = getSeat(aId);
      const bSeat = getSeat(bId);
      const sameGroup = sameGroupOn && aSeat && bSeat && !aSeat.void && !bSeat.void && (aSeat.groupId != null) && (bSeat.groupId != null) && (aSeat.groupId === bSeat.groupId);
      if (neigh.has(bId) || sameGroup) {
        violations.push({ aName, bName, aId, bId, sameGroup });
      }
    }

    if (!violationsBar) return;
    const hasForbidden = (violations.length > 0);
    const hasRotation = (rotationCount > 0);

    if (!hasForbidden && !hasRotation) {
      violationsBar.style.display = "none";
      violationsBar.textContent = "";
      return;
    }

    const out = [];
    if (hasForbidden) {
      const lines = violations.map(
        (v) => {
          const tag = v.sameGroup ? " (같은 모둠)" : "";
          return `- ${v.aName}(좌석 ${v.aId + 1}) ↔ ${v.bName}(좌석 ${v.bId + 1})${tag}`;
        }
      );
      out.push(`금지쌍 위반 ${violations.length}건:`);
      out.push(...lines);
    }
    if (hasRotation) {
      if (hasForbidden) out.push("");
      out.push(`로테이션 중복 ${rotationCount}명:`);
      out.push(...rotationLines);
    }
    violationsBar.textContent = out.join("\n");
    violationsBar.style.display = "block";
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
    // 같은 모둠도 인접으로 판단(모둠 설정 시)
    if (includeSameGroup) {
      const groupOn = (groupMode && groupMode.value !== "none");
      includeSameGroup.disabled = !forbidOn;
    }

    // 금지쌍 그룹 UI 비활성 처리
    if (optionsModal) {
      optionsModal.classList.toggle("forbidDisabled", !forbidOn);
    }

    const rotOn = (!useRotation) || useRotation.checked;
    if (rotateFront) rotateFront.disabled = !rotOn;
    if (rotateBack) rotateBack.disabled = !rotOn;

    const balanceEl = document.getElementById("balanceLevels");
    const groupModeEl = document.getElementById("groupMode");
    const balanceOn = !!(balanceEl && balanceEl.checked);
    if (groupModeEl) groupModeEl.disabled = !balanceOn;
    if (optionsModal) {
      optionsModal.classList.toggle("balanceDisabled", !balanceOn);
    }

  }

  // ===== 세부 옵션: 금지쌍 그룹 UI =====
  let forbidGroupCount = 0;

  function parseForbiddenLine(line) {
    return String(line || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function createForbidNameInput(value = "") {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "이름";
    input.value = value;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.addEventListener("input", () => {
      // 입력 중에도 즉시 반영
      syncForbiddenTextareaFromGroups(true);
    });
    return input;
  }

  function createForbidGroupRow(initialNames = []) {
    forbidGroupCount += 1;
    const idx = forbidGroupCount;

    const row = document.createElement("div");
    row.className = "forbidGroupRow";
    row.dataset.groupIndex = String(idx);

    const label = document.createElement("span");
    label.className = "forbidGroupLabel";
    label.textContent = `그룹 ${idx} :`;

    const inputs = document.createElement("div");
    inputs.className = "forbidInputs";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ghost smallBtn addForbidMemberBtn";
    addBtn.textContent = "+";
    addBtn.title = "이름 입력칸 추가";
    addBtn.addEventListener("click", () => {
      const inp = createForbidNameInput("");
      inputs.appendChild(inp);
      inp.focus();
      syncForbiddenTextareaFromGroups(true);
    });

    const baseCount = Math.max(3, initialNames.length || 0);
    for (let i = 0; i < baseCount; i++) {
      const v = initialNames[i] || "";
      inputs.appendChild(createForbidNameInput(v));
    }

    row.appendChild(label);
    row.appendChild(inputs);
    row.appendChild(addBtn);
    return row;
  }

  function readGroupsFromTextarea() {
    const raw = forbiddenInput ? forbiddenInput.value : "";
    const lines = String(raw || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map(parseForbiddenLine).filter((arr) => arr.length > 0);
  }

  
function readForbiddenLineGroups(text){
  const lines = (text || "").replace(/\r/g, "\n").split("\n").map(x=>x.trim()).filter(Boolean);
  const groups = [];
  for (const line of lines) {
    const parts = line.split(/[,-]/).map(x=>x.trim()).filter(Boolean);
    if (parts.length >= 2) groups.push(parts);
  }
  return groups;
}

const FORBID_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#a855f7","#ec4899","#0ea5e9","#84cc16"];
function buildForbiddenGroupColorMap(){
  // 이름 -> 포함된 금지쌍 그룹 색상들(복수)
  const map = new Map();
  const text = forbiddenInput ? forbiddenInput.value : "";
  const groups = readForbiddenLineGroups(text);
  groups.forEach((names, idx) => {
    const color = FORBID_COLORS[idx % FORBID_COLORS.length];
    for (const n of names) {
      if (!n) continue;
      const prev = map.get(n);
      if (!prev) {
        map.set(n, { idxs: [idx], colors: [color] });
      } else {
        if (!prev.idxs.includes(idx)) prev.idxs.push(idx);
        if (!prev.colors.includes(color)) prev.colors.push(color);
      }
    }
  });
  return map;
}

function renderForbiddenGroupsFromTextarea() {
    if (!forbiddenGroupsContainer) return;
    forbiddenGroupsContainer.innerHTML = "";
    forbidGroupCount = 0;

    const groups = readGroupsFromTextarea();
    // 기본은 그룹1, 그룹2
    const want = Math.max(2, groups.length);
    for (let i = 0; i < want; i++) {
      const names = groups[i] || [];
      forbiddenGroupsContainer.appendChild(createForbidGroupRow(names));
    }
  }

  function collectGroupsFromUI() {
    if (!forbiddenGroupsContainer) return [];
    const rows = Array.from(forbiddenGroupsContainer.querySelectorAll(".forbidGroupRow"));
    const out = [];
    for (const r of rows) {
      const inputs = Array.from(r.querySelectorAll("input"));
      const names = inputs.map((i) => String(i.value || "").trim()).filter(Boolean);
      out.push(names);
    }
    return out;
  }

  function syncForbiddenTextareaFromGroups(recompute = false) {
    if (!forbiddenInput) return;
    const groups = collectGroupsFromUI();
    const lines = groups
      .map((names) => names.filter(Boolean))
      .filter((names) => names.length >= 2)
      .map((names) => names.join(", "));
    forbiddenInput.value = lines.join("\n");
    if (recompute) {
      syncOptionEnables();
      computeViolations();
      renderGrid();
    }
  }

  function ensureShowGroupsForBalance(){
    if (!balanceLevels || !showGroups) return;
    if (balanceLevels.checked && !showGroups.checked) {
      showGroups.checked = true;
    }
  }

  // ===== Actions =====
  function promptFixedSeatName(seat) {
    if (!seat || seat.void) return;

    const currentName = String(seat.name || "").trim();
    const input = prompt(
      "이 좌석에 고정할 학생 이름을 입력하세요.\n(빈칸으로 두면 고정이 해제돼요.)",
      currentName
    );
    if (input === null) return;

    const name = String(input || "").trim();

    if (!name) {
      if (seat.locked) {
        seat.locked = false;
        renderGrid();
        log(`좌석 고정 해제: 좌석 ${seat.id + 1}`);
      }
      return;
    }

    const dup = seats.some((s) => s && s.id !== seat.id && !s.void && String(s.name || "").trim() === name);
    if (dup) {
      toast("이미 다른 좌석에 같은 이름이 있어요. 이름을 확인해 주세요.");
      return;
    }

    seat.name = name;
    seat.locked = true;
    renderGrid();
    log(`좌석 고정(직접입력): ${seat.name} (좌석 ${seat.id + 1})`);
  }

  function togglePin(seat, source = "icon") {
    if (!seat || seat.void) return;

    if (uiMode === "pin") {
      if (source === "icon" && seat.locked) {
        seat.locked = false;
        renderGrid();
        log(`좌석 고정 해제: 좌석 ${seat.id + 1}`);
        return;
      }
      promptFixedSeatName(seat);
      return;
    }

    if (seat.locked) {
      seat.locked = false;
      renderGrid();
      log(`좌석 고정 해제: 좌석 ${seat.id + 1}`);
      return;
    }

    if (!seat.name) {
      promptFixedSeatName(seat);
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
			if (isTouchLike()) { e.preventDefault(); return; }
      if (uiMode !== "none") return;
      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;
      const id = Number(seatDiv.dataset.seatId);
      if (Number.isNaN(id)) return;

      const seat = getSeat(id);
      if (seat && seat.void) return; // 통로는 드래그 이동 의미 없음

      seatDiv.classList.add("dragging");
      dragSrcId = id;
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", String(id));
        e.dataTransfer.effectAllowed = "move";
      }
    });

    gridEl.addEventListener("dragend", (e) => {
      const seatDiv = e.target.closest(".seat");
      if (seatDiv) {
        seatDiv.classList.remove("dragging");
        seatDiv.classList.remove("dragOver");
      }
    });

    gridEl.addEventListener("dragover", (e) => {
			if (isTouchLike()) return;
      if (uiMode !== "none") return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const overSeat = e.target.closest(".seat");
      if (overSeat) {
        gridEl.querySelectorAll(".seat.dragOver").forEach((x)=>x.classList.remove("dragOver"));
        overSeat.classList.add("dragOver");
      }
    });

    gridEl.addEventListener("drop", (e) => {
			if (isTouchLike()) return;
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

      gridEl.querySelectorAll(".seat.dragOver").forEach((x)=>x.classList.remove("dragOver"));

      pushUndo("swap");
      if (!swapSeatState(srcId, dstId)) { undoStack.pop(); if (undoBtn) undoBtn.disabled = (undoStack.length===0); return; }

      selectedSeatId = null;
      computeViolations();
      renderGrid();
      log(`이동/교체: 좌석 ${srcId + 1} ↔ 좌석 ${dstId + 1}`);
    });


    // ===== Mobile pointer drag (move/swap) =====
    // ✅ 스크롤을 막지 않도록: 실제 드래그로 판정되기 전에는 preventDefault / pointerCapture를 하지 않음
    let touchDrag = null; // { id, seatDiv, pointerId, startX, startY, moved, dx, dy, overId }
    const DRAG_THRESHOLD = 8;

    const resetTouchDragVisual = () => {
      if (!touchDrag) return;
      if (touchDrag._armT) { try { clearTimeout(touchDrag._armT); } catch {} }
      const el = touchDrag.seatDiv;
      if (el) {
        el.classList.remove("dragging");
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.transition = "";
        el.style.pointerEvents = "";
      }
      gridEl.querySelectorAll(".seat.dragOver").forEach((x)=>x.classList.remove("dragOver"));
      touchDrag = null;
    };

    const getSeatIdFromEl = (el) => {
      const d = el?.closest?.(".seat");
      if (!d) return null;
      const id = Number(d.dataset.seatId);
      return Number.isNaN(id) ? null : id;
    };

    let _suppressNextClickUntil = 0;
    gridEl.addEventListener("pointerdown", (e) => {
      if (!isTouchLike()) return;
      if (uiMode !== "none") return;

      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;

      // ✅ 모바일에서 아이콘 탭도 pointerup에서 처리해야 함.
      // (터치는 click을 무시하므로, 여기서 return하면 아이콘이 절대 실행되지 않음)
      const actionHit = e.target.closest("[data-action]");

      const id = Number(seatDiv.dataset.seatId);
      if (Number.isNaN(id)) return;
      const seat = getSeat(id);
      // 통로(삭제) 좌석도 탭으로 선택해서 복구 아이콘을 띄울 수 있도록 허용
      const isVoidSeat = !!(seat && seat.void);

      // ✅ 드래그 후보만 설정(스크롤 가능) + 롱프레스 후에만 자유 드래그
      // 아이콘 탭(actionHit)인 경우: 드래그/스와프는 하지 않고 pointerup에서 액션만 처리
      touchDrag = {
        id,
        seatDiv,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        dx: 0,
        dy: 0,
        overId: null,
        armed: false,
        _armT: null,
        noSwap: isVoidSeat || !!actionHit,
        noDrag: !!actionHit,
      };

      // 손가락이 살짝 움직이며 스크롤하려는 경우를 우선: 롱프레스 후에만 자유 드래그
      if (!touchDrag.noDrag) {
        touchDrag._armT = setTimeout(() => {
          if (touchDrag && touchDrag.pointerId === e.pointerId) touchDrag.armed = true;
        }, 220);
      }
    });

    gridEl.addEventListener("pointermove", (e) => {
      if (!isTouchLike()) return;
      if (!touchDrag) return;

      // ✅ 아이콘 탭은 드래그 로직을 타지 않음
      if (touchDrag.noDrag) return;

      const el = touchDrag.seatDiv;
      const dx = e.clientX - touchDrag.startX;
      const dy = e.clientY - touchDrag.startY;
      touchDrag.dx = dx; touchDrag.dy = dy;

      // 통로(삭제) 좌석은 드래그/교체는 하지 않고, 탭으로만 복구 아이콘을 띄웁니다.
      // (스크롤 제스처는 방해하지 않도록, 일정 이상 움직이면 드래그를 취소)
      if (touchDrag.noSwap) {
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          resetTouchDragVisual(); // 스크롤 의도
        }
        return;
      }


      if (!touchDrag.moved) {
        // ✅ 롱프레스 전에는 드래그 시작 금지 (스크롤/탭 의도 보호)
        if (!touchDrag.armed && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          resetTouchDragVisual();
          return;
        }
        // ✅ 아직 드래그로 확정 전이면 스크롤을 방해하지 않음
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        // ✅ 세로 스와이프는 스크롤로 해석(롱프레스 전에는 드래그 시작 안 함)
        const adx = Math.abs(dx), ady = Math.abs(dy);
        if (!touchDrag.armed && ady > adx * 1.2) {
          // 스크롤 의도: 드래그 취소하고 기본 스크롤 허용
          resetTouchDragVisual();
          return;
        }

        touchDrag.moved = true;
        // 드래그 확정: 이제부터만 캡처/비주얼/기본동작 차단
        try { el?.setPointerCapture?.(touchDrag.pointerId); } catch {}
        if (el) {
          el.classList.add("dragging");
          el.style.transition = "none";
          el.style.zIndex = "60";
          // 드래그 중에는 아래 요소를 찾기 위해 포인터 이벤트를 잠시 끔
          el.style.pointerEvents = "none";
        }
      }

      if (el) {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      }

      // 드롭 대상 하이라이트
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const overId = getSeatIdFromEl(under);
      gridEl.querySelectorAll(".seat.dragOver").forEach((x)=>x.classList.remove("dragOver"));
      if (overId != null && overId !== touchDrag.id) {
        const overEl = gridEl.querySelector(`.seat[data-seat-id="${overId}"]`);
        if (overEl) overEl.classList.add("dragOver");
        touchDrag.overId = overId;
      } else {
        touchDrag.overId = null;
      }

      // ✅ 드래그 중에만 기본 스크롤/줌을 막음
      if (touchDrag.moved) e.preventDefault();
    });

    const finishTouchDrag = (e) => {
      if (!isTouchLike()) return;
      if (!touchDrag) return;

      const { id, moved, overId } = touchDrag;
      const el = touchDrag.seatDiv;

      // 복원
      if (el) el.style.pointerEvents = "";
      const didMove = moved && (Math.abs(touchDrag.dx) > DRAG_THRESHOLD || Math.abs(touchDrag.dy) > DRAG_THRESHOLD);

      if (didMove && overId != null && overId !== id) {
        pushUndo("swap");
        swapSeatState(id, overId);
        selectedSeatId = null;
        closeGroupMenu();
        computeViolations();
        renderGrid();
        log(`드래그 교체: 좌석 ${id + 1} ↔ 좌석 ${overId + 1}`);
        resetTouchDragVisual();
        return;
      }

      // ===== 터치 탭 처리 (모바일 전용) =====
      // 1) 아이콘 탭: '선택된 자리'에서만 실행
      // 2) ↔ 이동 모드: 목적지 탭 시 즉시 교체
      // 3) 일반 탭: 선택(아이콘 표시)
      if (!didMove) {
        const seatDiv = e.target.closest?.(".seat");
        const actionEl = e.target.closest?.("[data-action]");
        const seat = getSeat(id);

        // (A안) 이동 모드: 목적지 선택
        if (!actionEl && moveFromSeatId != null) {
          const fromId = moveFromSeatId;
          if (fromId === id) {
            // 같은 자리 탭: 이동 취소
            moveFromSeatId = null;
            selectedSeatId = null;
            closeGroupMenu();
            renderGrid();
          } else {
            pushUndo("swap");
            swapSeatState(fromId, id);
            moveFromSeatId = null;
            selectedSeatId = null;
            closeGroupMenu();
            computeViolations();
            renderGrid();
            try { flashSeats([fromId, id]); } catch {}
            log(`좌석 교체(이동): 좌석 ${fromId + 1} ↔ 좌석 ${id + 1}`);
          }

          resetTouchDragVisual();
          _suppressNextClickUntil = Date.now() + 650;
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // 아이콘을 눌렀다면
        if (actionEl) {
          const act = actionEl.dataset.action;

          // '첫 탭'으로 아이콘이 실행되는 현상 방지:
          // 선택되지 않은 자리에서 아이콘 영역을 눌렀다면 실행하지 말고 '선택'만
          if (selectedSeatId !== id) {
            selectedSeatId = id;
            closeGroupMenu();
            renderGrid();
            resetTouchDragVisual();
            _suppressNextClickUntil = Date.now() + 650;
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          // 선택된 자리에서만 실제 실행
          if (act === "moveStart") {
            if (seat && !seat.void) {
              moveFromSeatId = id;
              selectedSeatId = null;
              closeGroupMenu();
              renderGrid();
              toast("이동한 위치를 선택하세요.");
            }
            resetTouchDragVisual();
            _suppressNextClickUntil = Date.now() + 650;
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (act === "delete") {
            if (seat && seat.locked) { toast("고정된 좌석은 삭제할 수 없어요. 먼저 고정을 해제하세요."); }
            else if (seat) {
              pushUndo("deleteSeat");
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
            }
            resetTouchDragVisual();
            _suppressNextClickUntil = Date.now() + 650;
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (act === "restore") {
            if (seat) {
              pushUndo("restoreSeat");
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
            }
            resetTouchDragVisual();
            _suppressNextClickUntil = Date.now() + 650;
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (act === "pinToggle") {
            if (seat) togglePin(seat, "icon");
            resetTouchDragVisual();
            _suppressNextClickUntil = Date.now() + 650;
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          // 그 외 액션은 기존 click 핸들러로 넘김(현재는 touch에서 click 무시하므로 실행 안 됨)
        }

        if (uiMode === "pin" && seat && !seat.void) {
          promptFixedSeatName(seat);
          resetTouchDragVisual();
          _suppressNextClickUntil = Date.now() + 650;
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // 일반 탭: 선택/해제(아이콘 표시)
        selectedSeatId = (selectedSeatId === id) ? null : id;
        closeGroupMenu();
        renderGrid();
      }

      resetTouchDragVisual();
      // ✅ 탭/드래그 처리 후 click 중복 방지
      _suppressNextClickUntil = Date.now() + 650;
      e.preventDefault();
      e.stopPropagation();
    };

    gridEl.addEventListener("pointerup", finishTouchDrag);
    gridEl.addEventListener("pointercancel", finishTouchDrag);

    // 클릭 처리(모드/아이콘/모둠 메뉴)
    gridEl.addEventListener("click", (e) => {
      // ✅ 터치(모바일)는 pointerup에서만 처리 (첫 탭 즉시 실행/중복 클릭 방지)
      if (isTouchLike()) return;

      const seatDiv = e.target.closest(".seat");
      if (!seatDiv) return;

      const id = Number(seatDiv.dataset.seatId);
      const seat = getSeat(id);
      if (!seat) return;

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl && uiMode === "pin" && !seat.void) {
        promptFixedSeatName(seat);
        return;
      }
      if (actionEl) {
        const act = actionEl.dataset.action;

        // (데스크탑 전용) 이동 아이콘은 생성되지 않지만, 혹시 남아도 무시
        if (act === "moveStart") return;

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
          togglePin(seat, "icon");
          return;
        }

        // 삭제/복구
        if (act === "delete") {
          if (isTouchLike() && selectedSeatId !== id) { selectedSeatId = id; renderGrid(); return; }
          if (seat.locked) { toast("고정된 좌석은 삭제할 수 없어요. 먼저 고정을 해제하세요."); return; }
          pushUndo("deleteSeat");
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
          if (isTouchLike() && selectedSeatId !== id) { selectedSeatId = id; renderGrid(); return; }
          pushUndo("restoreSeat");
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

      // 터치 환경:
      // - 탭 1회: 해당 좌석의 아이콘(삭제/복구 등) 표시
      // - 이동 모드(↔): '이동한 위치' 탭 시 즉시 교체
      if (isTouchLike()) {
        // ✅ 이동 모드: 목적지 선택
        if (moveFromSeatId != null) {
          const fromId = moveFromSeatId;
          if (fromId === id) {
            // 같은 자리 탭: 이동 취소
            moveFromSeatId = null;
            renderGrid();
            return;
          }
          swapSeatState(fromId, id);
          moveFromSeatId = null;
          selectedSeatId = null;
          closeGroupMenu();
          computeViolations();
          renderGrid();
          try { flashSeats([fromId, id]); } catch {}
          log(`좌석 교체(이동): 좌석 ${fromId + 1} ↔ 좌석 ${id + 1}`);
          return;
        }

        // ✅ 기본: 선택/해제(아이콘 표시)
        selectedSeatId = (selectedSeatId === id) ? null : id;
        closeGroupMenu();
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

  // 모바일: 좌석 밖을 탭하면(스크롤 시작 포함) 액션 아이콘을 즉시 숨김
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!isTouchLike()) return;
      const insideGrid = e.target.closest("#grid");
      const insideMenu = e.target.closest("#groupMenu");
      const insideModal = e.target.closest(".modal");
      if (!insideGrid && !insideMenu && !insideModal) {
        if (selectedSeatId != null) {
          selectedSeatId = null;
          renderGrid();
        }
      }
    },
    { passive: true }
  );

  // ===== Group Menu (fixed, not clipped) =====
  const groupMenuState = { open: false, seatId: null };
  // 사용자가 모둠을 수동으로 변경한 이후에는 자동 모둠 재계산으로 다른 좌석이 변하지 않도록 동결
  let autoGroupFrozen = false;

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
        autoGroupFrozen = true;
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


    // ✅ 자동 배치 시점에 학생 명단이 비어 보이는 문제 방지
    // - 다른 페이지(푸터) 다녀온 뒤에는 학생 입력 표는 보이지만 숨김 텍스트(studentsInput)가 비어 있을 수 있어,
    //   우선 localStorage 저장본을 불러오고, 그 다음 표(UI)가 있으면 표→텍스트를 다시 동기화합니다.
    try {
      if (studentsInput && !(studentsInput.value || "").trim()) {
        loadPersistedStudentsIfEmpty();
      }
    } catch(e) {}

    // 학생 입력 표(UI)가 존재하면, 저장 버튼을 누르지 않았더라도 최신 입력값을 반영
    try {
      if (studentsInput && studentsTbody) {
        studentsInput.value = tableToStudentsText();
        normalizeStudentsInput();
      }

      // 로컬 저장(안전망): 자동 배치 직전 최신 학생 명단을 저장해 둠
      // - 사용자가 [저장]을 눌렀을 때 저장되는 것이 기본이지만,
      //   자동 배치까지 진행했다면 최신 입력을 보존하는 편이 안전(업데이트/새로고침 대비)
      try {
        if (studentsInput) {
          const text = studentsInput.value || "";
          if (text.trim()) {
            localStorage.setItem(LS_STUDENTS_KEY, JSON.stringify({ text, savedAt: Date.now(), schema: 1 }));
          }
        }
      } catch (e) {
        // ignore
      }
    } catch(e) {}

    const students = parseStudents(studentsInput ? studentsInput.value : "");
    if (students.length === 0) {
      toast("학생 명단이 비어 있어요.");
      return;
    }

    students.forEach((s) => ensureHistoryFor(s.name));

    const nameToGender = new Map(students.map((s) => [s.name, s.gender]));
    const nameToLevel  = new Map(students.map((s) => [s.name, s.level]));

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


    // --- 로테이션(앞/뒤줄) 회피: 저장된 배치도 전체 기록 기준 ---
    const rotOn = !!(useRotation && useRotation.checked);
    const avoidFrontRotation = !!(rotOn && rotateFront && rotateFront.checked);
    const avoidBackRotation = !!(rotOn && rotateBack && rotateBack.checked);

    const rotationLedger = loadRotationLedger();
    const slotIndexList = loadSlotIndex ? loadSlotIndex() : [];
    const slotNameById = new Map();
    try { for (const s of slotIndexList) slotNameById.set(String(s.id), s.name); } catch(e) {}

    const rotationDetail = new Map(); // name -> { front:[{slot,t}], back:[{slot,t}] }
    const bannedFrontNames = new Set();
    const bannedBackNames = new Set();
    try {
      for (const slotId of Object.keys(rotationLedger || {})) {
        const e = rotationLedger[slotId];
        if (!e) continue;
        const slotName = slotNameById.get(String(slotId)) || String(slotId);
        const t = Number(e.t || 0);
        const fr = Array.isArray(e.front) ? e.front : [];
        const bk = Array.isArray(e.back) ? e.back : [];
        for (const n of fr) {
          if (!n) continue;
          if (avoidFrontRotation) bannedFrontNames.add(String(n));
          if (!rotationDetail.has(String(n))) rotationDetail.set(String(n), { front: [], back: [] });
          rotationDetail.get(String(n)).front.push({ slot: slotName, t });
        }
        for (const n of bk) {
          if (!n) continue;
          if (avoidBackRotation) bannedBackNames.add(String(n));
          if (!rotationDetail.has(String(n))) rotationDetail.set(String(n), { front: [], back: [] });
          rotationDetail.get(String(n)).back.push({ slot: slotName, t });
        }
      }
      // 최신순 정렬(안내문구용)
      for (const v of rotationDetail.values()) {
        v.front.sort((a,b)=> (b.t||0)-(a.t||0));
        v.back.sort((a,b)=> (b.t||0)-(a.t||0));
      }
    } catch(e) {}

    // ✅ 로테이션(앞/뒷줄) 판단도 '화면에서 칠판과 가까운 줄' 기준으로
    const displayFrontRow = boardAtTop ? 0 : (rows - 1);
    const displayBackRow  = boardAtTop ? (rows - 1) : 0;
    const toDataRow = (displayRow) => boardAtTop ? displayRow : (rows - 1 - displayRow);
    const frontRowIndex = toDataRow(displayFrontRow);
    const backRowIndex  = toDataRow(displayBackRow);

    const frontSeatSet = new Set();
    const backSeatSet = new Set();
    for (let cc=0; cc<cols; cc++){
      frontSeatSet.add(frontRowIndex*cols + cc);
      backSeatSet.add(backRowIndex*cols + cc);
    }

    const allowedForSeat = (name, seatId) => {
      const seat = getSeat(seatId);
      if (!seat || seat.void) return false;

      // 로테이션 하드 제약(저장된 배치도 전체 기록 기준)
      const nm = String(name || "");
      if (frontSeatSet.has(seatId) && bannedFrontNames.has(nm)) return false;
      if (backSeatSet.has(seatId) && bannedBackNames.has(nm)) return false;

      const req = seat.seatGender ?? "A";
      if (req === "A") return true;
      const g = nameToGender.get(nm) || "A";
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
        // 같은 모둠도 인접으로 판단(모둠 설정 시)
        const sameGroupOn = !!(includeSameGroup && includeSameGroup.checked && groupMode && groupMode.value !== "none");
        if (sameGroupOn) {
          const aSeat = getSeat(aId);
          const bSeat = getSeat(bId);
          if (aSeat && bSeat && !aSeat.void && !bSeat.void && (aSeat.groupId != null) && (bSeat.groupId != null) && (aSeat.groupId === bSeat.groupId)) cost += 3;
        }
      }
      return cost;
    };

    const genderCost = (seatToName) => {
      let c = 0;
      for (const id of activeSeatIds) {
        const seat = getSeat(id);
        if (!seat || seat.void) continue;
        const req = seat.seatGender ?? "A";
        if (req === "A") continue;
        const nm = seatToName[id];
        if (!nm) continue;
        const g = nameToGender.get(nm) || "A";
        // req(M/F)와 다른 성별이면 페널티 (미지정 A는 허용)
        if (g !== "A" && g !== req) c += 1;
      }
      return c;
    };

    const levelBalanceCost = (seatToName) => {
      if (!(balanceLevels && balanceLevels.checked)) return 0;
      // 그룹별 수준(상/하) 분산을 최대한 균등하게 맞추는 비용
      const groupIds = Array.from(new Set(activeSeatIds.map(id => (getSeat(id)?.groupId ?? 1)))).sort((a,b)=>a-b);
      const G = groupIds.length || 1;
      const total = { "상": 0, "중": 0, "하": 0 };
      const perGroup = new Map(groupIds.map(gid => [gid, { "상": 0, "중": 0, "하": 0 }]));
      for (const id of activeSeatIds) {
        const seat = getSeat(id);
        if (!seat || seat.void) continue;
        const gid = seat.groupId ?? 1;
        const nm = seatToName[id];
        if (!nm) continue;
        const lv = (nameToLevel.get(nm) || "중");
        const L = (lv === "상" || lv === "하") ? lv : "중";
        total[L] += 1;
        if (!perGroup.has(gid)) perGroup.set(gid, { "상":0,"중":0,"하":0 });
        perGroup.get(gid)[L] += 1;
      }
      const targetHigh = total["상"] / G;
      const targetLow  = total["하"] / G;

      let cost = 0;
      for (const gid of groupIds) {
        const c = perGroup.get(gid) || { "상":0,"중":0,"하":0 };
        cost += Math.abs(c["상"] - targetHigh) + Math.abs(c["하"] - targetLow);
      }
      return cost;
    };

    const rotationViolation = (seatToName) => {
      // 앞/뒷줄 로테이션 위반(저장 배치도 전체 기록 기준)
      let c = 0;
      for (const id of activeSeatIds) {
        const nm = seatToName[id];
        if (!nm) continue;
        const s = String(nm);
        if (frontSeatSet.has(id) && bannedFrontNames.has(s)) c += 1;
        if (backSeatSet.has(id) && bannedBackNames.has(s)) c += 1;
      }
      return c;
    };

    const scoreOf = (seatToName) => ({
      rotation: rotationViolation(seatToName),
      gender: genderCost(seatToName),
      forbidden: forbiddenCost(seatToName),
      level: levelBalanceCost(seatToName),
    });

    const compareScore = (a, b) => {
      if (!b) return -1;
      if ((a.rotation || 0) !== (b.rotation || 0)) return (a.rotation || 0) - (b.rotation || 0);
      if ((a.gender || 0) !== (b.gender || 0)) return (a.gender || 0) - (b.gender || 0);
      if ((a.forbidden || 0) !== (b.forbidden || 0)) return (a.forbidden || 0) - (b.forbidden || 0);
      if ((a.level || 0) !== (b.level || 0)) return (a.level || 0) - (b.level || 0);
      return 0;
    };

    const totalCost = (seatToName) => {
      const s = scoreOf(seatToName);
      return s.rotation * 1000000 + s.gender * 10000 + s.forbidden * 100 + s.level * 10;
    };

    const buildMatchingSeed = () => {
      if (pool.length !== freeSeatIds.length) return null;

      const seatToName = Array.from({ length: seatCount() }, () => null);
      for (const s of seats) {
        if (s.void) continue;
        if (s.locked && s.name) seatToName[s.id] = s.name;
      }

      const edges = new Map();
      for (const id of freeSeatIds) {
        const candidates = shuffleArr(pool.filter((nm) => allowedForSeat(nm, id)));
        edges.set(id, candidates);
      }
      for (const id of freeSeatIds) {
        if (!edges.get(id) || edges.get(id).length === 0) return null;
      }

      const orderedSeats = shuffleArr(freeSeatIds).sort((a, b) => (edges.get(a).length - edges.get(b).length) || (Math.random() - 0.5));
      const matchNameToSeat = new Map();

      const dfs = (seatId, seen) => {
        const candidates = edges.get(seatId) || [];
        for (const nm of candidates) {
          if (seen.has(nm)) continue;
          seen.add(nm);
          const prevSeat = matchNameToSeat.get(nm);
          if (prevSeat == null || dfs(prevSeat, seen)) {
            matchNameToSeat.set(nm, seatId);
            return true;
          }
        }
        return false;
      };

      for (const seatId of orderedSeats) {
        if (!dfs(seatId, new Set())) return null;
      }

      for (const [nm, sid] of matchNameToSeat.entries()) seatToName[sid] = nm;
      return seatToName;
    };

    const makeInitialAssignment = () => {
      const matched = buildMatchingSeed();
      if (matched) return matched;

      const seatToName = Array.from({ length: seatCount() }, () => null);
      for (const s of seats) {
        if (s.void) continue;
        if (s.locked && s.name) seatToName[s.id] = s.name;
      }

      let remaining = shuffleArr(pool);
      const seatOrder = shuffleArr(freeSeatIds);
      for (const id of seatOrder) {
        if (remaining.length === 0) {
          seatToName[id] = null;
          continue;
        }
        let pickIndex = -1;
        for (let k = 0; k < remaining.length; k++) {
          if (allowedForSeat(remaining[k], id)) {
            pickIndex = k;
            break;
          }
        }
        if (pickIndex === -1) pickIndex = 0;
        const picked = remaining.splice(pickIndex, 1)[0];
        seatToName[id] = picked ?? null;
      }
      return seatToName;
    };

    const improveBySwaps = (seed) => {
      let cur = seed.slice();
      let curScore = scoreOf(cur);
      let best = cur.slice();
      let bestScore = { ...curScore };

      const needOptimize = (forbiddenPairs.length > 0) || (balanceLevels && balanceLevels.checked) || (activeSeatIds.some(id => (getSeat(id)?.seatGender ?? 'A') !== 'A')) || rotOn;
      const steps = needOptimize ? (rotOn ? 2600 : 1400) : 0;

      for (let step = 0; step < steps; step++) {
        if (bestScore.rotation === 0 && bestScore.gender === 0 && bestScore.forbidden === 0 && bestScore.level === 0) break;

        const a = freeSeatIds[Math.floor(Math.random() * freeSeatIds.length)];
        const b = freeSeatIds[Math.floor(Math.random() * freeSeatIds.length)];
        if (a === b) continue;

        const nameA = cur[a];
        const nameB = cur[b];
        if (nameA && !allowedForSeat(nameA, b)) continue;
        if (nameB && !allowedForSeat(nameB, a)) continue;

        const tmp = cur[a];
        cur[a] = cur[b];
        cur[b] = tmp;

        const newScore = scoreOf(cur);
        const better = compareScore(newScore, curScore) <= 0;
        const accept = better || Math.random() < 0.015;

        if (accept) {
          curScore = newScore;
          if (compareScore(newScore, bestScore) < 0) {
            bestScore = { ...newScore };
            best = cur.slice();
          }
        } else {
          const tmp2 = cur[a];
          cur[a] = cur[b];
          cur[b] = tmp2;
        }
      }

      return { best, bestScore };
    };

    // --- 메인 탐색 ---
    let bestGlobal = null;
    let bestGlobalScore = null;

    const hardMatchExists = !!buildMatchingSeed();
    const needManyAttempts = rotOn || (forbiddenPairs.length > 0) || (balanceLevels && balanceLevels.checked) || (activeSeatIds.some(id => (getSeat(id)?.seatGender ?? 'A') !== 'A'));
    const attempts = hardMatchExists ? (rotOn ? 180 : 90) : (needManyAttempts ? 90 : 1);

    for (let t = 0; t < attempts; t++) {
      const seed = makeInitialAssignment();
      const { best, bestScore } = improveBySwaps(seed);

      if (compareScore(bestScore, bestGlobalScore) < 0) {
        bestGlobal = best;
        bestGlobalScore = { ...bestScore };
        if (bestGlobalScore.rotation === 0 && bestGlobalScore.gender === 0 && bestGlobalScore.forbidden === 0 && bestGlobalScore.level === 0) break;
      }
    }

    // 적용
    if (!bestGlobal) bestGlobal = makeInitialAssignment();
    if (!bestGlobalScore) bestGlobalScore = scoreOf(bestGlobal);
    const bestGlobalForbidden = bestGlobalScore.forbidden;
    const bestGlobalGender = bestGlobalScore.gender;

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

    // 로테이션 위반 안내(불가피한 경우에만)
    try {
      const viol = [];
      for (const s of seats) {
        if (!s || s.void || !s.name) continue;
        const nm = String(s.name);
        if (frontSeatSet.has(s.id) && bannedFrontNames.has(nm)) viol.push({ name: nm, side: "앞줄" });
        if (backSeatSet.has(s.id) && bannedBackNames.has(nm)) viol.push({ name: nm, side: "뒷줄" });
      }
      if (viol.length) {
        const uniq = new Map();
        for (const v of viol) {
          const key = v.name + "|" + v.side;
          if (!uniq.has(key)) uniq.set(key, v);
        }
        const list = Array.from(uniq.values());
        const fmt = (t) => {
          try {
            if (!t) return "";
            const d = new Date(t);
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2,"0");
            const dd = String(d.getDate()).padStart(2,"0");
            return `${y}-${m}-${dd}`;
          } catch { return ""; }
        };
        const parts = [];
        for (const v of list.slice(0, 4)) {
          const det = rotationDetail.get(v.name);
          const arr = v.side === "앞줄" ? (det?.front || []) : (det?.back || []);
          const d0 = arr[0];
          const when = d0 ? `${d0.slot}(${fmt(d0.t)})` : "";
          parts.push(`${v.name}(${when} ${v.side})`);
        }
        const extra = list.length - parts.length;
        const msg = `로테이션 조건을 모두 만족시키기 어려워요: ${parts.join(", ")}${extra>0?` 외 ${extra}명`: ""}`;
        toast(msg);
      }
    } catch(e) {}

    /* rotation 기록은 이제 '배치도 저장' 시에만 반영됩니다. */

    if (forbiddenPairs.length > 0 && bestGlobalForbidden > 0) {
      toast(`금지 조건을 모두 만족시키기 어려워요(남은 위반 ${bestGlobalForbidden}건).`);
    }
    if (bestGlobalGender > 0) {
      // 왜 못 맞췄는지(좌석 성별 지정 vs 학생 성별 구성) 간단 안내
      let reason = "";
      try {
        const active = seats.filter(s => s && !s.void);
        const maleSeats = active.filter(s => (s.seatGender ?? "A") === "M").length;
        const femaleSeats = active.filter(s => (s.seatGender ?? "A") === "F").length;
        const anySeats = active.filter(s => (s.seatGender ?? "A") === "A").length;

        const maleStudents = students.filter(s => s.gender === "M").length;
        const femaleStudents = students.filter(s => s.gender === "F").length;
        const unknownStudents = Math.max(0, students.length - maleStudents - femaleStudents);

        if (maleStudents > maleSeats + anySeats) reason = `남학생(${maleStudents})이 남좌석(${maleSeats})보다 많아요.`;
        else if (femaleStudents > femaleSeats + anySeats) reason = `여학생(${femaleStudents})이 여좌석(${femaleSeats})보다 많아요.`;
        else if (maleSeats > maleStudents + unknownStudents) reason = `남좌석(${maleSeats})이 남학생(${maleStudents})보다 많아요.`;
        else if (femaleSeats > femaleStudents + unknownStudents) reason = `여좌석(${femaleSeats})이 여학생(${femaleStudents})보다 많아요.`;
        else reason = "지정된 성별 좌석과 학생 성별 구성이 정확히 맞지 않아요.";
      } catch(e) {}

      toast(`성별 지정 조건을 모두 만족시키기 어려워요(불일치 ${bestGlobalGender}명).${reason ? " " + reason : ""}`);
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

  if (autoFillBtn) autoFillBtn.addEventListener("click", () => { pushUndo("autoFill"); autoFill(); });
  if (clearBtn) { clearBtn.disabled = true; clearBtn.addEventListener("click", () => {
    const ok = window.confirm("정말 초기화할까요?\n배치도/학생/옵션이 초기화됩니다.");
    if (!ok) return;
    pushUndo("clearAll");
    clearAll();
    clearAutosaveSnapshot();
    toast("초기화되었습니다.");
  }); }
  if (restoreVoidsBtn) restoreVoidsBtn.addEventListener("click", () => { pushUndo("restoreVoids"); restoreVoids(); });
  if (undoBtn) { undoBtn.disabled = true; undoBtn.addEventListener("click", doUndo); }
  if (redoBtn) { redoBtn.disabled = true; redoBtn.addEventListener("click", doRedo); }
  updateHistoryButtons();

  if (showSeatNo) showSeatNo.addEventListener("change", renderGrid);
  if (showGroups) showGroups.addEventListener("change", () => { closeGroupMenu(); renderGrid(); });
  if (showGender) showGender.addEventListener("change", renderGrid);

  if (groupMode) groupMode.addEventListener("change", () => {
    // manual size input toggle
    try {
      if (groupModeManual) groupModeManual.style.display = (groupMode.value === "manual") ? "inline-block" : "none";
    } catch {}
    // 사용자가 드롭다운으로 모둠 크기를 다시 선택하면 자동 그룹핑을 다시 허용
    autoGroupFrozen = false;
    // ✅ 자동 모둠표기 모드를 바꾸면(=재계산 의도) 기존 수동 지정은 초기화
    if (groupMode.value !== "none") {
      seats.forEach((s) => { if (s && !s.void) s.groupManual = false; });
    }
    syncOptionEnables();
    renderGrid();
    log("모둠 크기 변경");
  });
  if (balanceLevels) balanceLevels.addEventListener("change", () => {
    // 모둠 인원(select) 활성/비활성 상태를 체크박스와 항상 동기화
    syncOptionEnables();
    ensureShowGroupsForBalance();
    renderGrid();
    log("모둠별 수준 분산 옵션 변경");
  });

  if (viewHistoryBtn) viewHistoryBtn.addEventListener("click", () => {
    try {
      const txt = buildRotationHistoryText();
      window.alert(txt);
    } catch {
      toast("기록을 불러오지 못했어요.");
    }
  });

  if (resetHistoryBtn) resetHistoryBtn.addEventListener("click", () => {
    const ok = window.confirm("정말 저장된 모든 배치도의 로테이션 기록을 초기화할까요?\n(이 작업은 되돌릴 수 없어요.)");
    if (!ok) return;

    try { localStorage.removeItem(ROTATION_LEDGER_KEY); } catch {}
    history = {};
    log("로테이션 기록(저장 배치도 기준) 초기화 완료.");
    toast("로테이션 기록이 초기화되었습니다.");
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

  // ✅ PC: 배치도 영역 위에 마우스가 있어도 페이지 위/아래 스크롤이 되도록
  // - .stage가 overflow:auto + overscroll-behavior로 스크롤 체이닝이 막히는 경우가 있어,
  //   wheel(세로) 입력은 페이지 스크롤로 우선 처리한다.
  if (stageEl) {
    stageEl.addEventListener(
      "wheel",
      (e) => {
        const dy = e.deltaY || 0;
        const dx = e.deltaX || 0;
        const vertical = Math.abs(dy) >= Math.abs(dx);
        if (vertical && !e.shiftKey) {
          // 세로 휠은 페이지 스크롤로 넘김(배치도 내부 세로 스크롤 방지)
          e.preventDefault();
          window.scrollBy({ top: dy, left: 0, behavior: "auto" });
        }
      },
      { passive: false }
    );
  }

  if (openStudentsBtn) openStudentsBtn.addEventListener("click", () => { loadPersistedStudentsIfEmpty(); openModal(studentsModal); initStudentsModalUI(); });

  // 학생 입력 저장: 클릭 이벤트가 누락되거나 초기화 중 에러가 나도 동작하도록(직접 바인딩 + 위임 바인딩)
  
  // 학생 입력 저장 직전 라인 정리(스코프 안전)
  function normalizeStudentsInput(){
    if (!studentsInput) return;
    studentsInput.value = normalizeLines(studentsInput.value);
  }

let _savingStudentsNow = false;
  function handleStudentsSave(btnEl){
    if (_savingStudentsNow) return;
    _savingStudentsNow = true;

    // Identify the actual button element that triggered save (important for reliable feedback)
    const btn = btnEl || applyStudentsBtn;

    try {
      // 표 → 텍스트로 직렬화(기존 로직/저장/공유/자동배치 호환)
      if (studentsInput && studentsTbody) {
        studentsInput.value = tableToStudentsText();
        normalizeStudentsInput();
      }

      // ✅ 영구 저장(저장 버튼 기반): 업데이트/파일 교체/새로고침 이후에도 최신 명단 복원
      // - 내용이 비어 있으면 저장값 삭제(예전 명단이 되살아나는 문제 방지)
      try {
        const text = (studentsInput && typeof studentsInput.value === "string") ? studentsInput.value : "";
        if (text.trim()) {
          localStorage.setItem(LS_STUDENTS_KEY, JSON.stringify({ text, savedAt: Date.now() }));
        } else {
          localStorage.removeItem(LS_STUDENTS_KEY);
        }
      } catch (e) {
        // ignore
      }

      // Reliable, non-overlay feedback (do NOT auto-close; user closes manually)
      if (btn) {
        const prevText = btn.textContent;
        btn.textContent = "저장됨 ✓";
        btn.classList.add("btn-success-flash");
        btn.disabled = true;

        // Ensure paint happens, then restore state (keep modal open)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              btn.textContent = prevText;
              btn.classList.remove("btn-success-flash");
              btn.disabled = false;
              _savingStudentsNow = false;
            }, 900);
          });
        });
      } else {
        _savingStudentsNow = false;
      }

      log("학생 명단 저장");
    } catch (err) {
      _savingStudentsNow = false;
      throw err;
    }
  }
  if (applyStudentsBtn) applyStudentsBtn.addEventListener("click", (e) => handleStudentsSave(e.currentTarget));
  document.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("#applyStudentsBtn") : null;
    if (t) handleStudentsSave(t);
  });
  // 학생 입력 UI 이벤트(v0.79)
  if (useGenderToggle) useGenderToggle.addEventListener("change", () => {
    studentsSetVisibility();
  });
  if (useLevelToggle) useLevelToggle.addEventListener("change", () => {
    studentsSetVisibility();
  });
  if (applyGenderBulkBtn) applyGenderBulkBtn.addEventListener("click", applyGenderBulk);
  if (addStudentRowBtn) addStudentRowBtn.addEventListener("click", () => { addOneStudentRow(); renumberStudentsRows(); });
  if (clearStudentsBtn) {
    clearStudentsBtn.addEventListener("click", () => {
      const ok = window.confirm("학생 명단을 전부 삭제할까요?\n(이 작업은 되돌릴 수 없어요)");
      if (!ok) return;
      // 입력값만 초기화(행은 유지)
      const rows = getStudentsTableRows();
      for (const tr of rows) {
        const name = tr.querySelector(".stuName");
        if (name) name.value = "";
      }
      // 토글은 끔(필요할 때 다시 켜기)
      if (useGenderToggle) useGenderToggle.checked = false;
      if (useLevelToggle) useLevelToggle.checked = false;
      studentsTbody && studentsSetVisibility();
      // 숨김 텍스트도 초기화(기존 로직 호환)
      if (studentsInput) studentsInput.value = "";
      // 저장은 사용자가 [저장]을 눌렀을 때 확정
      toast("학생 명단이 모두 지워졌어요. 저장을 누르면 반영됩니다.");
    });
  }


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

  if (openOptionsBtn) openOptionsBtn.addEventListener("click", () => {
    // 옵션 모달 오픈 전, textarea → 그룹 UI로 동기화
    if (forbiddenGroupsContainer) renderForbiddenGroupsFromTextarea();
    syncOptionEnables();
    openModal(optionsModal);
    // v0.82: 모달이 열릴 때 DOM 요소가 확실히 존재한 뒤 다시 동기화
    syncOptionEnables();
    const _balanceEl = document.getElementById("balanceLevels");
    if (_balanceEl && !_balanceEl.dataset.bound) {
      _balanceEl.addEventListener("change", syncOptionEnables);
      _balanceEl.dataset.bound = "1";
    }
  });
  if (applyOptionsBtn) applyOptionsBtn.addEventListener("click", (e) => {
    // Apply options
    ensureShowGroupsForBalance();
    computeViolations();
    renderGrid();
    toast("옵션이 적용됐어요!");
    // 책상 배열과 동일하게: 적용 시 자동으로 닫기
    closeModal(optionsModal);
  });
  if (openSaveBtn) openSaveBtn.addEventListener("click", () => { if (shareBox) shareBox.classList.add("hidden"); openModal(saveModal); });

  if (openGuideBtn) openGuideBtn.addEventListener("click", () => { window.location.href = "./guide.html"; });

  if (demoBtn) demoBtn.addEventListener("click", () => {
    try {
      pushUndo("demo");
    } catch {}
    // 1) 기본 레이아웃(예: 6x5=30자리) 생성
    applyLayout("single", { singleCols: 6, singleRows: 5 });

    // 2) 샘플 학생(24명) 입력 + 자동 배치
    const demoNames = [
      "김하늘","이준","박서연","최민준","정지우","한예린",
      "윤서준","강민서","오지훈","임수아","신도윤","조은우",
      "장하린","송지안","배현우","문서윤","권도하","백지민",
      "서지후","홍예나","유하준","나은서","전민호","고서아"
    ];
    if (studentsInput) {
      studentsInput.value = demoNames.join("\n");
      try { normalizeStudentsInput(); } catch {}
      try { studentsTextToTable(); } catch {}
    }
    // 바로 자동 배치
    autoFill();
    log("샘플 학급 불러오기");
  });

  // ===== Share UI (inside 저장/불러오기) =====
  let lastShareSnap = null;
  const setWarnVisible = (toggleEl, textEl) => {
    const on = toggleEl ? !!toggleEl.checked : true;
    if (textEl) textEl.style.display = on ? "block" : "none";
  };

  function openShareBox() {
    if (!shareBox) return;
    shareBox.classList.remove("hidden");
    lastShareSnap = currentSnapshot();
    setWarnVisible(shareWarnToggle, shareWarnText);

    const encoded = encodeShareState(lastShareSnap);
    if (!encoded) { toast("공유 링크 생성에 실패했어요."); return; }

    const u = new URL(location.href);
    u.hash = "";
    u.search = "";
    u.searchParams.set("s", encoded);

    const link = u.toString();
    if (shareLinkInput) shareLinkInput.value = link;
    if (shareCopyBtn) shareCopyBtn.disabled = false;
  }
  function closeShareBox() {
    if (!shareBox) return;
    shareBox.classList.add("hidden");
  }

  if (shareBtn) shareBtn.addEventListener("click", () => {
    if (!shareBox) return;
    if (shareBox.classList.contains("hidden")) openShareBox();
    else closeShareBox();
  });
  if (shareCloseBtn) shareCloseBtn.addEventListener("click", closeShareBox);
  if (shareWarnToggle) shareWarnToggle.addEventListener("change", () => setWarnVisible(shareWarnToggle, shareWarnText));

  if (shareApplyBtn) shareApplyBtn.addEventListener("click", () => {
    lastShareSnap = currentSnapshot();
    const encoded = encodeShareState(lastShareSnap);
    if (!encoded) { toast("공유 링크 생성에 실패했어요."); return; }

    const u = new URL(location.href);
    u.hash = "";
    // 기존 파라미터는 정리하고, s만 포함
    u.search = "";
    u.searchParams.set("s", encoded);

    const link = u.toString();
    if (shareLinkInput) shareLinkInput.value = link;
    if (shareCopyBtn) shareCopyBtn.disabled = false;
    toast("공유 링크가 준비됐어요. 링크 복사를 눌러주세요.");
  });

  if (shareCopyBtn) shareCopyBtn.addEventListener("click", async () => {
    const v = shareLinkInput ? shareLinkInput.value : "";
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast("링크를 복사했어요!");
    } catch (e) {
      try {
        shareLinkInput?.focus();
        shareLinkInput?.select();
        document.execCommand("copy");
        toast("링크를 복사했어요!");
      } catch {
        toast("복사에 실패했어요. 링크를 길게 눌러 복사해 주세요.");
      }
    }
  });

  // ===== Incoming share link (preview → apply) =====
  let pendingShareSnap = null;

  function clearShareParam() {
    try {
      const u = new URL(location.href);
      if (!u.searchParams.has("s")) return;
      u.searchParams.delete("s");
      history.replaceState({}, "", u.toString());
    } catch {}
  }

  function openIncomingShareModalFromUrl() {
    try {
      const u = new URL(location.href);
      const s = u.searchParams.get("s");
      if (!s) return;
      pendingShareSnap = decodeShareState(s);
      renderSharePreview(incomingSharePreview, pendingShareSnap);
      setWarnVisible(incomingWarnToggle, incomingWarnText);
      openModal(incomingShareModal);
    } catch {}
  }

  if (incomingWarnToggle) incomingWarnToggle.addEventListener("change", () => setWarnVisible(incomingWarnToggle, incomingWarnText));

  if (incomingShareModal) {
    // overlay click close도 파라미터 정리
    incomingShareModal.addEventListener("click", (e) => {
      if (e.target === incomingShareModal) clearShareParam();
    });
    // X/닫기 버튼으로 닫아도 정리
    document.querySelectorAll('[data-close="incomingShareModal"]').forEach((btn) => {
      btn.addEventListener("click", clearShareParam);
    });
  }

  if (incomingApplyBtn) incomingApplyBtn.addEventListener("click", () => {
    if (!pendingShareSnap) {
      toast("공유 배치도를 불러올 수 없어요.");
      closeModal(incomingShareModal);
      clearShareParam();
      return;
    }
    applySnapshot(pendingShareSnap);
    computeViolations();
    renderGrid();
    /* rotation 기록은 이제 '배치도 저장' 시에만 반영됩니다. */
    closeModal(incomingShareModal);
    clearShareParam();
    toast("공유 배치도를 적용했어요!");
  });

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

    // 내보내기(이미지/인쇄) 자동 맞춤: 너무 넓어지면 축소해서 한 장에 들어오게
    const maxW = 1200;
    const maxH = 1700;
    const scale = Math.min(1, maxW / totalW, maxH / totalH);

    canvas.width = Math.max(900, Math.ceil(totalW * scale));
    canvas.height = Math.max(650, Math.ceil(totalH * scale));

    const ctx = canvas.getContext("2d");

    // scale 적용 후에도 좌표 계산은 원래(totalW/totalH) 기준으로 그립니다.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);

    ctx.fillStyle = "#111827";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("자리 배치도", pad, pad + 16);

    const boardYTop = pad + titleH;
    const boardYBottom = pad + titleH + gridH + 12;
    const boardY = boardAtTop ? boardYTop : boardYBottom;

    const gridY = boardAtTop ? boardY + boardH + 12 : pad + titleH;

    ctx.fillStyle = "rgba(17,24,39,0.06)";
    ctx.strokeStyle = "rgba(17,24,39,0.85)";
    ctx.lineWidth = 2;
    roundRect(ctx, pad, boardY, gridW, boardH, 16, true, true);

    ctx.fillStyle = "#111827";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("칠판", pad + gridW / 2, boardY + boardH / 2);

    const vioSet = new Set();
    for (const v of violations) { vioSet.add(v.aId); vioSet.add(v.bId); }

    forbidColorMap = buildForbiddenGroupColorMap();

    for (let displayR = 0; displayR < rows; displayR++) {
      const dataRow = mapDisplayRowToDataRow(displayR);

      for (let c = 0; c < cols; c++) {
        const dataCol = mapDisplayColToDataCol(c);
          const seatId = dataRow * cols + dataCol;
        const seat = getSeat(seatId);
        if (!seat) continue;

        const extraX = isPair ? Math.floor(c / 2) * pairGapExtraExport : 0;

        const x = pad + c * (seatW + gap) + extraX;
        const y = gridY + displayR * (seatH + gap);

        if (seat.void) {
          ctx.fillStyle = "rgba(0,0,0,0)";
          ctx.strokeStyle = "rgba(17,24,39,0.28)";
          ctx.lineWidth = 2;
          dashedRoundRect(ctx, x, y, seatW, seatH, 14);
          continue;
        }

        ctx.fillStyle = "rgba(17,24,39,0.04)";
        ctx.strokeStyle = "rgba(17,24,39,0.35)";
        if (seat.seatGender === "M") ctx.strokeStyle = "rgba(59,130,246,0.85)";
        if (seat.seatGender === "F") ctx.strokeStyle = "rgba(239,68,68,0.85)";
        ctx.lineWidth = 2;  

        roundRect(ctx, x, y, seatW, seatH, 14, true, true);

        if (showSeatNo && showSeatNo.checked) {
          ctx.fillStyle = "rgba(17,24,39,0.70)";
          ctx.font = "800 12px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(String(seat.id + 1), x + 10, y + 8);
        }

        // 좌상단 핀(고정 표시) - ✅ 출력에서는 표시하지 않음
        if (false && seat.locked) {
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

        // Export (image/print): render names in solid black for readability
        if (seat.name) {
          ctx.fillStyle = "#000000";
          ctx.font = "900 18px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(seat.name, x + seatW / 2, y + seatH / 2);
        }

        // 모둠 표시(텍스트만)
        if (showGroups && showGroups.checked) {
          const gid = clamp(Number(seat.groupId ?? 1), 1, 8);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.strokeStyle = "rgba(17,24,39,0.22)";
          ctx.lineWidth = 1;
          roundRect(ctx, x + 8, y + seatH - 26, 64, 18, 9, true, true);
          ctx.fillStyle = "rgba(17,24,39,0.92)";
          ctx.font = "800 11px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`모둠 ${gid}`, x + 16, y + seatH - 17);
        }

        if (showGender && showGender.checked) {
          const g = seat.seatGender === "A" ? "무관" : seat.seatGender === "M" ? "남" : "여";
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.strokeStyle = "rgba(17,24,39,0.22)";
          ctx.lineWidth = 1;
          roundRect(ctx, x + seatW - 54, y + seatH - 26, 46, 18, 9, true, true);
          ctx.fillStyle = "rgba(17,24,39,0.75)";
          ctx.font = "900 11px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(g, x + seatW - 31, y + seatH - 17);
        }
      }
    }

    ctx.fillStyle = "rgba(17,24,39,0.65)";
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
  const ROTATION_LEDGER_KEY = "seatplan_rotation_ledger_v1";
  function slotKey(id) { return `seatplan_slot_${id}_v015`; }

  function loadRotationLedger() {
    try {
      const raw = localStorage.getItem(ROTATION_LEDGER_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch { return {}; }
  }
  function saveRotationLedger(ledger) {
    try { localStorage.setItem(ROTATION_LEDGER_KEY, JSON.stringify(ledger || {})); } catch {}
  }

  function computeFrontBackNamesFromState(state) {
    // state: { cols, rows, boardAtTop, seats: [{id, name, void}] }
    const c = Number(state.cols ?? cols);
    const r = Number(state.rows ?? rows);
    const bat = (state.boardAtTop ?? boardAtTop) ? true : false;
    const seatArr = Array.isArray(state.seats) ? state.seats : seats;

    const byId = new Map();
    for (const s of seatArr) byId.set(Number(s.id), s);

    // ✅ '앞/뒷줄'은 **화면에서 칠판과 가까운 줄** 기준으로 판단합니다.
    // - boardAtTop=true  : 칠판이 위 → 화면 1행(위)이 '앞줄'
    // - boardAtTop=false : 칠판이 아래 → 화면 마지막 행(아래)이 '앞줄'
    // 좌석 데이터(seats)는 boardAtTop=false일 때 화면과 반대로 매핑되므로,
    // 화면 행(displayRow)을 데이터 행(dataRow)으로 변환해 계산합니다.
    const displayFrontRow = bat ? 0 : (r - 1);
    const displayBackRow  = bat ? (r - 1) : 0;
    const toDataRow = (displayRow) => bat ? displayRow : (r - 1 - displayRow);
    const frontRow = toDataRow(displayFrontRow);
    const backRow  = toDataRow(displayBackRow);

    const frontIds = [];
    const backIds = [];
    for (let cc = 0; cc < c; cc++) {
      frontIds.push(frontRow * c + cc);
      backIds.push(backRow * c + cc);
    }

    const front = [];
    const back = [];
    for (const id of frontIds) {
      const s = byId.get(id);
      if (!s || s.void) continue;
      if (s.name) front.push(String(s.name));
    }
    for (const id of backIds) {
      const s = byId.get(id);
      if (!s || s.void) continue;
      if (s.name) back.push(String(s.name));
    }
    return { front, back };
  }

  function buildHistoryFromLedger(ledger) {
    const h = {};
    const ensure = (name) => { if (!h[name]) h[name] = { front: 0, back: 0 }; };

    try {
      for (const slotId of Object.keys(ledger || {})) {
        const entry = ledger[slotId];
        if (!entry) continue;
        const fr = Array.isArray(entry.front) ? entry.front : [];
        const bk = Array.isArray(entry.back) ? entry.back : [];
        for (const n of fr) { if (!n) continue; ensure(n); h[n].front += 1; }
        for (const n of bk) { if (!n) continue; ensure(n); h[n].back += 1; }
      }
    } catch {}
    return h;
  }

  function initRotationLedgerFromSavedSlotsIfMissing() {
    const existing = loadRotationLedger();
    const hasAny = existing && Object.keys(existing).length > 0;
    if (hasAny) {
      history = buildHistoryFromLedger(existing);
      return;
    }

    // 🔁 최초 1회: 저장된 배치도(각 슬롯의 최신 저장본)로부터 레저를 구성
    const ledger = {};
    const list = loadSlotIndex();
    for (const s of list) {
      const id = s && s.id ? String(s.id) : "";
      if (!id) continue;
      const raw = localStorage.getItem(slotKey(id));
      if (!raw) continue;
      try {
        const snap = JSON.parse(raw);
        const fb = computeFrontBackNamesFromState(snap);
        ledger[id] = { front: fb.front, back: fb.back, t: Date.now() };
      } catch {}
    }
    saveRotationLedger(ledger);
    history = buildHistoryFromLedger(ledger);
  }

  

function buildRotationHistoryText() {
  const ledger = loadRotationLedger();
  const list = loadSlotIndex();
  const idToName = new Map(list.map(s => [String(s.id), String(s.name || "")]));
  const rows = Object.keys(ledger || {}).map(id => String(id));
  const ordered = list.map(s => String(s.id)).filter(id => ledger[id]);
  const rest = rows.filter(id => !ordered.includes(id));
  const all = [...ordered, ...rest];

  const fmt = (arr) => (arr && arr.length ? arr.join(", ") : "-");
  const lines = [];
  lines.push("로테이션 기록 보기");
  lines.push("");
  if (!all.length) {
    lines.push("(기록 없음)");
  } else {
    for (const id of all) {
      const it = ledger[id] || { front: [], back: [], t: 0 };
      const name = idToName.get(id) || `(삭제됨) ${id}`;
      const t = it.t ? new Date(it.t).toLocaleString() : "-";
      lines.push(`■ ${name} (${t})`);
      lines.push(`  - 맨 앞줄: ${fmt(it.front)}`);
      lines.push(`  - 맨 뒷줄: ${fmt(it.back)}`);
      lines.push("");
    }
  }
  lines.push("※ 배치도를 ‘저장(덮어쓰기)’ 하면, 해당 배치도의 로테이션 기록도 함께 덮어써집니다.");
  return lines.join("\n");
}

function openRotationHistoryModal() {
  const ledger = loadRotationLedger();
  const list = loadSlotIndex();

  const idToName = new Map(list.map(s => [String(s.id), String(s.name || "")]));
  const rows = Object.keys(ledger || {}).map(id => String(id));
  const ordered = list.map(s => String(s.id)).filter(id => ledger[id]);
  const rest = rows.filter(id => !ordered.includes(id));
  const all = [...ordered, ...rest];

  const fmt = (arr) => (arr && arr.length ? arr.join(", ") : "-");
  const tr = all.map(id => {
    const it = ledger[id] || { front: [], back: [], t: 0 };
    const name = idToName.get(id) || `(삭제됨) ${id}`;
    const t = it.t ? new Date(it.t).toLocaleString() : "-";
    return `<tr><td><b>${escapeHtml(name)}</b><div style="font-size:11px;opacity:.7;margin-top:2px;">${t}</div></td>` +
           `<td>${escapeHtml(fmt(it.front))}</td><td>${escapeHtml(fmt(it.back))}</td></tr>`;
  }).join("");

  const overlay = document.createElement("div");
  overlay.className = "simpleModalOverlay";
  overlay.innerHTML = `
    <div class="simpleModal" role="dialog" aria-modal="true">
      <div class="simpleModalHead">
        <h3>로테이션 기록 보기</h3>
        <button class="ghost smallBtn" type="button" id="closeRotModal">닫기</button>
      </div>
      <div class="simpleModalBody">
        <table>
          <thead><tr><th style="width:26%;">배치도</th><th>맨 앞줄</th><th>맨 뒷줄</th></tr></thead>
          <tbody>${tr || ""}</tbody>
        </table>
        <div style="margin-top:10px;font-size:12px;opacity:.8;line-height:1.6;">
          ※ 배치도를 ‘저장(덮어쓰기)’ 하면, 해당 배치도의 로테이션 기록도 함께 덮어써집니다.
        </div>
      </div>
      <div class="simpleModalFoot">
        <button class="ghost smallBtn" type="button" id="closeRotModal2">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { try { overlay.remove(); } catch {} };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector("#closeRotModal")?.addEventListener("click", close);
  overlay.querySelector("#closeRotModal2")?.addEventListener("click", close);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function updateRotationLedgerForSlot(slotId) {
    const id = String(slotId || "");
    if (!id) return;

    const ledger = loadRotationLedger();

    // 옵션에 따라 기록할 항목을 결정(덮어쓰기)
    const rotOn = (useRotation ? !!useRotation.checked : true);
    const frOn = rotOn && (rotateFront ? !!rotateFront.checked : false);
    const bkOn = rotOn && (rotateBack ? !!rotateBack.checked : false);

    const fb = computeFrontBackNamesFromState({ cols, rows, boardAtTop, seats });

    ledger[id] = {
      front: frOn ? fb.front : [],
      back:  bkOn ? fb.back : [],
      t: Date.now()
    };

    saveRotationLedger(ledger);
    history = buildHistoryFromLedger(ledger);
  }

  function removeRotationLedgerForSlot(slotId) {
    const id = String(slotId || "");
    if (!id) return;
    const ledger = loadRotationLedger();
    if (ledger && Object.prototype.hasOwnProperty.call(ledger, id)) {
      delete ledger[id];
      saveRotationLedger(ledger);
      history = buildHistoryFromLedger(ledger);
    }
  }


  function loadSlotIndex() {
    try {
      const raw = localStorage.getItem(SLOT_INDEX_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];

      // ✅ v0.79: 저장된 목록을 "오래된 → 최신"(위→아래 최신) 순서로 정규화
      // 과거 버전에서는 unshift로 "최신 → 오래된"이 저장되었을 수 있어, 숫자형 id(Date.now) 기준으로 1회 역전
      if (list.length > 1) {
        const first = Number(list[0]?.id);
        const last = Number(list[list.length - 1]?.id);
        if (Number.isFinite(first) && Number.isFinite(last) && first > last) {
          list.reverse();
          // 저장 순서도 같이 정리
          localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(list));
        }
      }
      return list;
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
      opt.textContent = "";
      slotSelect.appendChild(opt);
      slotSelect.disabled = true;
    } else {
      slotSelect.disabled = false;
      for (const s of list) {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        slotSelect.appendChild(opt);
      }
      // 선택값이 없으면 마지막(최신)으로
      if (!slotSelect.value && list[list.length - 1]) slotSelect.value = list[list.length - 1].id;
    }
    renderSlotList();
    updateSlotActionEnables();
  }

  function updateSlotActionEnables() {
    const id = slotSelect ? slotSelect.value : "";
    const hasSel = !!id;
    if (saveBtn) saveBtn.disabled = !hasSel;
    if (loadBtn) loadBtn.disabled = !hasSel;
    if (deleteSlotBtn) deleteSlotBtn.disabled = !hasSel;
  }

  function renderSlotList() {
    if (!slotList) return;
    const list = loadSlotIndex();
    slotList.innerHTML = "";
    const selId = slotSelect ? slotSelect.value : "";

    if (slotEmpty) slotEmpty.style.display = list.length === 0 ? "block" : "none";
    if (list.length === 0) {
      return;
    }

    for (const s of list) {
      const item = document.createElement("div");
      item.className = "slotItem" + (s.id === selId ? " sel" : "");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", s.id === selId ? "true" : "false");
      item.textContent = s.name;
      item.addEventListener("click", () => {
        if (slotSelect) slotSelect.value = s.id;
        renderSlotList();
        updateSlotActionEnables();
      });
      slotList.appendChild(item);
    }

    // 최신 항목이 아래로 쌓이므로, 목록이 길어지면 기본적으로 아래쪽(최신)으로 보이게
    try { slotList.scrollTop = slotList.scrollHeight; } catch {}
  }

  if (slotSelect) {
    slotSelect.addEventListener("change", () => {
      renderSlotList();
      updateSlotActionEnables();
    });
  }


  function initSlots() {
    refreshSlotSelect();
    const l = loadSlotIndex();
    if (slotSelect && l[l.length - 1]) slotSelect.value = l[l.length - 1].id;
    renderSlotList();
    updateSlotActionEnables();
  }

  function snapshotForHistory() {
    // ✅ Undo/Redo에서 사용할 스냅샷은 반드시 JSON 직렬화 가능한 값만 포함해야 함
    // (순환 참조/Map/DOM 참조 등이 섞이면 redo 저장이 실패할 수 있어요.)
    return {
      version: APP_VERSION,
      cols, rows,
      seatType: seatTypeSel ? seatTypeSel.value : "single",
      boardAtTop,
      layout: { layoutKind, layoutParams },
      ui: {
        useForbidden: useForbidden?.checked ?? true,
        useRotation: useRotation?.checked ?? false,
        showSeatNo: !!(showSeatNo && showSeatNo.checked),
        showGroups: !!(showGroups && showGroups.checked),
        showGender: !!(showGender && showGender.checked),
        includeDiagonal: !!(includeDiagonal && includeDiagonal.checked),
        includeSameGroup: !!(includeSameGroup && includeSameGroup.checked),
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
    };
  }

function currentSnapshot() {
    return {
  version: APP_VERSION,
      cols, rows,
      seatType: seatTypeSel ? seatTypeSel.value : "single",
      boardAtTop,
      layout: { layoutKind, layoutParams },
      ui: {
      useForbidden: useForbidden?.checked ?? true,
      useRotation: useRotation?.checked ?? false,
        showSeatNo: !!(showSeatNo && showSeatNo.checked),
        showGroups: !!(showGroups && showGroups.checked),
        showGender: !!(showGender && showGender.checked),
        includeDiagonal: !!(includeDiagonal && includeDiagonal.checked),
        includeSameGroup: !!(includeSameGroup && includeSameGroup.checked),
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
    if (includeSameGroup) includeSameGroup.checked = !!ui.includeSameGroup;
    if (groupMode) groupMode.value = ui.groupMode ?? "none";
    if (balanceLevels) balanceLevels.checked = !!ui.balanceLevels;
    if (rotateFront) rotateFront.checked = !!ui.rotateFront;
    if (rotateBack) rotateBack.checked = !!ui.rotateBack;
    if (useForbidden) useForbidden.checked = ui.useForbidden ?? true;
    if (useRotation) useRotation.checked = ui.useRotation ?? false;

    const text = snap.text || {};
    if (studentsInput) studentsInput.value = text.students ?? "";
    if (forbiddenInput) forbiddenInput.value = text.forbidden ?? "";

    // 금지쌍(그룹 UI) 갱신: textarea 값을 UI로 반영
    if (forbiddenGroupsContainer) {
      renderForbiddenGroupsFromTextarea();
    }
    // 로테이션 기록(history)은 저장된 배치도 레저에서 재구성되므로 스냅샷의 history로 덮어쓰지 않음

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
    const name = prompt("새로 저장할 배치도 이름(예: 3-2반 3월)");
    if (!name) return;
    const list = loadSlotIndex();
    const id = String(Date.now());
    // ✅ v0.79: 최신이 아래로 쌓이도록 push
    list.push({ id, name });
    saveSlotIndex(list);
    refreshSlotSelect();
    if (slotSelect) slotSelect.value = id;

    // 새로 저장: 즉시 스냅샷 저장
    try {
      localStorage.setItem(slotKey(id), JSON.stringify(currentSnapshot()));
      try { updateRotationLedgerForSlot(id); } catch {}
    } catch {}

    renderSlotList();
    updateSlotActionEnables();
    toast("새로 저장 완료!");
    log(`배치도 새로 저장: ${name}`);
  });

  if (saveBtn) saveBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("덮어쓸 배치도를 선택하세요."); return; }

    // ✅ 먼저 스냅샷 저장
    localStorage.setItem(slotKey(id), JSON.stringify(currentSnapshot()));

    // ✅ 로테이션 기록은 '배치도 저장' 시에만 기록하며, 같은 배치도를 다시 저장하면 덮어쓰기
    try { updateRotationLedgerForSlot(id); } catch {}

    toast("저장(덮어쓰기) 완료!");
    log("배치도 저장 완료");
  });

  if (loadBtn) loadBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("불러올 배치도을 선택하세요."); return; }
    const raw = localStorage.getItem(slotKey(id));
    if (!raw) { toast("저장 데이터가 없어요."); return; }
    try {
      applySnapshot(JSON.parse(raw));
      toast("불러오기 완료!");
      log("배치도 불러오기 완료");
    } catch { toast("불러오기 실패(데이터 손상)."); }
  });

  if (deleteSlotBtn) deleteSlotBtn.addEventListener("click", () => {
    const id = slotSelect ? slotSelect.value : "";
    if (!id) { toast("삭제할 배치도이 없어요."); return; }
    if (!confirm("이 배치도을 삭제할까요?")) return;

    localStorage.removeItem(slotKey(id));

    // ✅ 해당 배치도의 로테이션 기록(레저)도 함께 제거
    try { removeRotationLedgerForSlot(id); } catch {}
    let list = loadSlotIndex();
    list = list.filter((x) => x.id !== id);
    saveSlotIndex(list);
    refreshSlotSelect();
    toast("배치도 삭제 완료");
    log("배치도 삭제 완료");
  });

  if (forbiddenInput) forbiddenInput.addEventListener("input", () => {
    syncOptionEnables();
    computeViolations();
    renderGrid();
  });

  // 금지쌍: 그룹 추가
  if (addForbiddenGroupBtn) addForbiddenGroupBtn.addEventListener("click", () => {
    if (!forbiddenGroupsContainer) return;
    forbiddenGroupsContainer.appendChild(createForbidGroupRow([]));
    syncForbiddenTextareaFromGroups(true);
  });

  if (includeDiagonal) includeDiagonal.addEventListener("change", () => {
    computeViolations();
    renderGrid();
  });

  if (includeSameGroup) includeSameGroup.addEventListener("change", () => {
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
    initRotationLedgerFromSavedSlotsIfMissing();
    updateOrientationButtonLabel();
    applyHintVisibility();
    openIncomingShareModalFromUrl();

    // ✅ 푸터(다른 페이지)로 이동하기 직전에 현재 작업을 즉시 저장
    try {
      const links = document.querySelectorAll('footer a');
      links.forEach(a => {
        a.addEventListener('click', () => {
          try {
            saveAutosaveSnapshot();
            markAutosaveRestoreAllowed();
          } catch (e) {}
        });
      });
    } catch (e) {}

    // 페이지 이동 후 같은 탭으로 돌아온 경우에만 작업 복원
    // - footer 링크 페이지에서 다시 index로 돌아온 경우: 복원
    // - 브라우저 새로고침(reload): 복원 안 함
    // - 창/탭을 닫았다가 다시 연 경우: 복원 안 함
    const navType = getNavigationType();
    const shouldRestoreAutosave = !isBrowserReloadNavigation() && (
      (canRestoreAutosaveThisSession() && (navType === "back_forward" || cameFromInternalAuxPage())) ||
      cameFromInternalAuxPage()
    );
    if (shouldRestoreAutosave) {
      const autosnap = loadAutosaveSnapshot();
      if (autosnap) {
        try {
          applySnapshot(autosnap);
          toast("작업을 복원했어요.");
          return;
        } catch (e) {
          // 손상된 임시 저장본은 제거하고 기본값으로 시작
          clearAutosaveSnapshot();
        } finally {
          clearAutosaveRestoreAllowed();
        }
      } else {
        clearAutosaveRestoreAllowed();
      }
    } else {
      clearAutosaveRestoreAllowed();
    }

    layoutKind = "single";
    layoutParams.singleCols = 5;
    layoutParams.singleRows = 6;
    applyLayout("single", layoutParams);

    syncLayoutModalUIFromState();
    log("v0.79 시작: 학생 입력(표 UI/라디오) + 공유 링크 + 모바일 개선");
    log("v0.79→v0.79: UI 용어(배치도) 정리 + 모바일 메뉴 순서 고정");
  }

    start();
})();


/* ===== v0.79: Fixed seat manual input (A plan) ===== */
(function(){
  const _orig = window.handleFixedSeatClick;

  window.handleFixedSeatClick = function(seat){
    try{
      if(seat && !seat.studentName){
        const name = prompt("이 좌석에 고정할 학생 이름을 입력하세요");
        if(!name) return;

        seat.studentName = name.trim();
        seat.fixed = true;
        seat.manual = true;

        if(Array.isArray(window.students)){
          window.students = window.students.filter(s => s.name !== name.trim());
        }

        if(typeof window.render === "function") window.render();
        if(typeof window.renderSeats === "function") window.renderSeats();
        return;
      }

      if(typeof _orig === "function"){
        _orig(seat);
      }
    }catch(e){
      console.error("Fixed seat manual error:", e);
    }
  };
})();
/* ===== end v0.79 ===== */



// (removed) v0.82: legacy patch that incorrectly disabled layout 'groupSize' select

