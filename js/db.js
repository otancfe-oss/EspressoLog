"use strict";

/* ══════════════════════════════════════════════════════════
   EspressoLog Data Access Layer
   - localStorage を db 経由に集約（直叩き廃止・マイグレーション基盤）
   - 写真は IndexedDB（別ストア）で管理
   BrewLog と対になる姉妹アプリ。キー名は esplog_* で分離。
   ══════════════════════════════════════════════════════════ */
const db = (() => {
  const KEYS = {
    records:  "esplog_records",
    beans:    "esplog_beans",
    equip:    "esplog_equip",
    machines: "esplog_machines",
    tampers:  "esplog_tampers",
    fontSize: "esplog_fontsize",
    grinders: "esplog_custom_grinders",
    version:  "esplog_data_version"
  };
  const CURRENT_VERSION = 1;

  /* 既定リスト（app.js の定数と同期。ここは fallback 用） */
  const DEFAULT_MACHINES = ["Flair 58","Flair Pro 2","La Pavoni","Gaggia Classic Pro","Breville Barista Express","Rancilio Silvia","De'Longhi Dedica","Cafelat Robot","9Barista","Decent DE1"];
  const DEFAULT_TAMPERS  = ["Spring Tamper（定圧）","Manual","Normcore V4","Force Tamper"];

  /* ── 低レベル読み書き ── */
  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      alert("データの保存に失敗しました。ストレージの空き容量を確認してください。");
      console.error("[EspressoLog] Save failed:", key, e);
      return false;
    }
  }

  /* ── マイグレーション ── */
  function migrate() {
    const v = _get(KEYS.version, 0);
    if (v >= CURRENT_VERSION) return;
    /* v0 → v1: 初期バージョン設定のみ。将来の変換処理はここに追加 */
    _set(KEYS.version, CURRENT_VERSION);
    console.log("[EspressoLog] Data migrated to v" + CURRENT_VERSION);
  }

  /* ══ 写真ストア（IndexedDB） ══ */
  let pDB = null;
  function _openPDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("EspressoLogPhotos", 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore("photos", { keyPath: "id" });
      r.onsuccess = e => { pDB = e.target.result; res(pDB); };
      r.onerror = rej;
    });
  }
  async function _getPDB() { return pDB || await _openPDB(); }

  /* Public API */
  return {
    init() { migrate(); return _openPDB().catch(() => {}); },

    /* ── Records ── */
    getRecords()      { return _get(KEYS.records, []); },
    saveRecords(recs) { return _set(KEYS.records, recs); },
    addRecord(rec)    { const r = this.getRecords(); r.unshift(rec); return this.saveRecords(r); },
    deleteRecord(id)  { return this.saveRecords(this.getRecords().filter(r => r.id !== id)); },
    updateRecord(rec) {
      const r = this.getRecords(); const i = r.findIndex(x => x.id === rec.id);
      if (i >= 0) { r[i] = rec; return this.saveRecords(r); } return false;
    },

    /* ── Beans ── */
    getBeans()      { return _get(KEYS.beans, []); },
    saveBeans(b)    { return _set(KEYS.beans, b); },
    addBean(bean)   { const b = this.getBeans(); b.push(bean); return this.saveBeans(b); },
    deleteBean(id)  { return this.saveBeans(this.getBeans().filter(b => b.id !== id)); },
    updateBean(bean){
      const b = this.getBeans(); const i = b.findIndex(x => x.id === bean.id);
      if (i >= 0) { b[i] = bean; return this.saveBeans(b); } return false;
    },

    /* ── Equipment（最後に使った器具の記憶） ── */
    getEquip()      { return _get(KEYS.equip, { grinderId: "fellow_opus", machine: "", tamper: "" }); },
    saveEquip(e)    { return _set(KEYS.equip, e); },

    /* ── マシン／タンパー リスト ── */
    getMachines()   { return _get(KEYS.machines, DEFAULT_MACHINES.slice()); },
    saveMachines(m) { return _set(KEYS.machines, m); },
    getTampers()    { return _get(KEYS.tampers, DEFAULT_TAMPERS.slice()); },
    saveTampers(t)  { return _set(KEYS.tampers, t); },

    /* ── フォントサイズ ── */
    getFontSize()   { return _get(KEYS.fontSize, "M"); },
    saveFontSize(s) { return _set(KEYS.fontSize, s); },

    /* ── カスタムグラインダー ── */
    getCustomGrinders()   { return _get(KEYS.grinders, []); },
    saveCustomGrinders(g) { return _set(KEYS.grinders, g); },
    addCustomGrinder(g)   { const l = this.getCustomGrinders(); l.push(g); return this.saveCustomGrinders(l); },
    deleteCustomGrinder(id){ return this.saveCustomGrinders(this.getCustomGrinders().filter(x => x.id !== id)); },

    /* ══ 写真 ══ */
    async savePhoto(id, data) {
      const idb = await _getPDB();
      return new Promise((res, rej) => {
        const tx = idb.transaction("photos", "readwrite");
        tx.objectStore("photos").put({ id, data });
        tx.oncomplete = res; tx.onerror = rej;
      });
    },
    async getPhoto(id) {
      const idb = await _getPDB();
      return new Promise((res, rej) => {
        const tx = idb.transaction("photos", "readonly");
        const r = tx.objectStore("photos").get(id);
        r.onsuccess = () => res(r.result?.data || null);
        r.onerror = rej;
      });
    },
    async deletePhoto(id) {
      const idb = await _getPDB();
      return new Promise(res => {
        const tx = idb.transaction("photos", "readwrite");
        tx.objectStore("photos").delete(id);
        tx.oncomplete = res;
      });
    },

    /* ── 全データ export/import（写真を除くメタデータ。写真は app 側で付加） ── */
    exportAll() {
      return {
        records: this.getRecords(),
        beans: this.getBeans(),
        equip: this.getEquip(),
        machines: this.getMachines(),
        tampers: this.getTampers(),
        customGrinders: this.getCustomGrinders(),
        fontSize: this.getFontSize(),
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString()
      };
    },
    importAll(data) {
      if (!data.records || !data.beans) return false;
      this.saveRecords(data.records);
      this.saveBeans(data.beans);
      if (data.equip) this.saveEquip(data.equip);
      if (data.machines) this.saveMachines(data.machines);
      if (data.tampers) this.saveTampers(data.tampers);
      if (data.customGrinders) this.saveCustomGrinders(data.customGrinders);
      if (data.fontSize) this.saveFontSize(data.fontSize);
      return true;
    }
  };
})();
db.init();
