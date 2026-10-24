/* ══════════════════════════════════════════════════════════════ */
/* GLOBAL VARIABLES | 全域變數                                    */
/* Data and settings the whole app uses                           */
/* 整個 App 共用的資料與設定                                      */
/* ══════════════════════════════════════════════════════════════ */
let currentSeason = 'all';
let currentCat = '全部';
let items = [];
let customCats = [];
let editId = null;
let tempImage = null;
let tempWear = 0;
let catEditing = false;
let customCatIdCounter = 1;
let pendingSeason = null;
let pendingCat = null;
let tempImageUploading = false;
let toastTimer = null;

const initialCategories = ['上衣', '長褲', '短褲 / 裙', '外套'];
const seasons = ['all', 'spring', 'summer', 'autumn', 'winter'];
const seasonLabels = { 'all': '全部', 'spring': '春', 'summer': '夏', 'autumn': '秋', 'winter': '冬' };

/* ══════════════════════════════════════════════════════════════ */
/* INIT & STORAGE | 初始化與儲存                                  */
/* Start the app, then load and save data in the browser          */
/* 啟動 App，並在瀏覽器中讀取與儲存資料                           */
/* ══════════════════════════════════════════════════════════════ */
function init() {
  loadFromStorage();
  render();
  checkDraftOnOpen();
  document.getElementById('loadingScreen').style.display = 'none';
}

function loadFromStorage() {
  setSyncDot('syncing');
  try {
    const itemsData = localStorage.getItem('closet-items-v1');
    items = itemsData ? JSON.parse(itemsData) : [];
    
    const catsData = localStorage.getItem('closet-categories-v1');
    customCats = catsData ? JSON.parse(catsData) : [];

    if (customCats.length > 0) {
      customCatIdCounter = Math.max(...customCats.map(c => parseInt(c.numId || 0))) + 1;
    }
    setSyncDot('ok');
  } catch (e) {
    console.error(e);
    setSyncDot('error');
    showToast('載入失敗 檢查瀏覽器儲存空間');
  }
}

function saveToStorage() {
  setSyncDot('syncing');
  try {
    localStorage.setItem('closet-items-v1', JSON.stringify(items));
    localStorage.setItem('closet-categories-v1', JSON.stringify(customCats));
    setSyncDot('ok');
  } catch (e) {
    console.error(e);
    setSyncDot('error');
    showToast('儲存失敗 空間滿了？');
  }
}

function setSyncDot(status) {
  const dot = document.getElementById('syncDot');
  dot.className = 'sync-dot' + (status === 'syncing' ? ' syncing' : status === 'error' ? ' error' : '');
}

/* ══════════════════════════════════════════════════════════════ */
/* PHOTOS | 照片處理                                              */
/* Read, shrink and preview the chosen photo                      */
/* 讀取、縮小並預覽選擇的照片                                     */
/* ══════════════════════════════════════════════════════════════ */
function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const localUrl = URL.createObjectURL(file);
  document.getElementById('photoPreview').src = localUrl;
  document.getElementById('photoPreview').style.display = 'block';
  document.getElementById('photoPlaceholder').style.display = 'none';
  document.getElementById('photoUploading').style.display = 'flex';
  document.getElementById('saveBtn').disabled = true;
  tempImageUploading = true;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      compressImage(e.target.result, (compressed) => {
        tempImage = compressed;
        document.getElementById('photoPreview').src = compressed;
        document.getElementById('photoUploading').style.display = 'none';
        document.getElementById('saveBtn').disabled = false;
        tempImageUploading = false;
      });
    } catch (err) {
      console.error(err);
      showToast('照片處理失敗 請再試一次');
      tempImage = null;
      document.getElementById('photoPreview').style.display = 'none';
      document.getElementById('photoPlaceholder').style.display = 'flex';
      document.getElementById('photoUploading').style.display = 'none';
      document.getElementById('saveBtn').disabled = false;
      tempImageUploading = false;
    }
  };
  reader.readAsDataURL(file);
}

function compressImage(base64, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let width = img.width, height = img.height;
    if (width > height) {
      if (width > 400) { height = Math.round((height * 400) / width); width = 400; }
    } else {
      if (height > 600) { width = Math.round((width * 600) / height); height = 600; }
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', 0.75));
  };
  img.src = base64;
}

/* ══════════════════════════════════════════════════════════════ */
/* DRAW THE SCREEN | 畫面渲染                                     */
/* Show the tabs, category bar and clothes list                   */
/* 顯示分頁、類別列與衣服清單                                     */
/* ══════════════════════════════════════════════════════════════ */
function render() {
  renderTopTabs();
  renderCatBar();
  renderList();
  document.getElementById('fab').className = 'fab ' + currentSeason;
}

function renderTopTabs() {
  document.getElementById('seasonTabs').innerHTML = seasons.map(s => 
    `<button class="season-tab${currentSeason === s ? ' active-' + s : ''}" onclick="setSeason('${s}')">${seasonLabels[s]}</button>`
  ).join('');
}

function renderCatBar() {
  const bar = document.getElementById('catBar');
  const addBtn = document.getElementById('addCatBtn');
  const editBtn = document.getElementById('editCatBtn');

  // Remove old custom categories | 清除舊的自訂類別
  bar.querySelectorAll('.custom-cat').forEach(el => el.remove());

  // Add custom categories | 加入自訂類別
  customCats.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'cat-item custom-cat';
    el.dataset.id = cat.id;
    el.innerHTML = `<span style="pointer-events:none">${cat.name}</span><button class="delete-btn">×</button>`;
    
    // Delete button events | 刪除按鈕事件
    const dBtn = el.querySelector('.delete-btn');
    const handleDelete = (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmRemoveCategory(cat.id);
    };
    dBtn.addEventListener('touchend', handleDelete);
    dBtn.addEventListener('click', handleDelete);

    el.addEventListener('click', () => {
      if (catEditing) return;
      setCat(cat.name);
    });

    addBtn.parentNode.insertBefore(el, addBtn);
  });

  // Update the active category | 更新目前選取的類別
  bar.querySelectorAll('.cat-item:not(.add-cat-btn):not(.edit-cat-btn)').forEach(el => {
    let name = el.classList.contains('custom-cat') 
      ? (customCats.find(c => c.id === el.dataset.id)?.name || '') 
      : el.textContent.trim();
    el.classList.toggle('cat-active', name === currentCat);
  });

  editBtn.style.display = customCats.length ? '' : 'none';
  updateCatEditingUI();
}

function renderList() {
  const el = document.getElementById('list');
  const filtered = items.filter(item => {
    const sOk = currentSeason === 'all' || item.season === currentSeason;
    const cOk = currentCat === '全部' || item.cat === currentCat;
    return sOk && cOk;
  });

  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">➘</div><p></p></div>';
    return;
  }

  el.innerHTML = filtered.map(item => `
    <div class="list-item" onclick="openEdit('${item.id}')">
      <div class="list-item-left">
        <div class="list-item-name">${item.name || '未命名'}</div>
        <div class="list-item-meta">
          <span class="season-badge badge-${item.season}">${seasonLabels[item.season] || ''}</span>${item.cat ? item.cat + ' · ' : ''}穿過 ${item.wear || 0} 次
        </div>
      </div>
      <div class="list-item-thumb">
        ${item.image ? `<img src="${item.image}" alt="" loading="lazy">` : ''}
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════════ */
/* SEASON & CATEGORY | 季節與類別                                 */
/* Switch the season tab or the category filter                   */
/* 切換季節分頁或類別篩選                                         */
/* ══════════════════════════════════════════════════════════════ */
function setSeason(season) {
  currentSeason = season;
  currentCat = '全部';
  exitCatEditing();
  render();
}

function setCat(cat) {
  if (catEditing) {
    exitCatEditing();
    return;
  }
  currentCat = cat;
  renderList();
  renderCatBar();
}

function toggleCatEditing() {
  if (!customCats.length) {
    showToast('你沒自定義瞎按啥。第一天玩手機啊？');
    return;
  }
  catEditing = !catEditing;
  updateCatEditingUI();
}

function exitCatEditing() {
  catEditing = false;
  updateCatEditingUI();
}

function updateCatEditingUI() {
  const bar = document.getElementById('catBar');
  const btn = document.getElementById('editCatBtn');
  if (catEditing) {
    bar.classList.add('cat-editing-mode');
    btn.classList.add('active');
  } else {
    bar.classList.remove('cat-editing-mode');
    btn.classList.remove('active');
  }
}

function allCats() {
  return [...initialCategories, ...customCats.map(c => c.name)];
}

/* ══════════════════════════════════════════════════════════════ */
/* ADD / EDIT FORM | 新增 / 編輯表單                              */
/* Open, close and fill the form                                  */
/* 開啟、關閉並填入表單                                           */
/* ══════════════════════════════════════════════════════════════ */
function openForm() {
  exitCatEditing();
  editId = null;
  if (!pendingSeason) {
    tempImage = null;
    tempWear = 0;
  }

  document.getElementById('sheetTitle').textContent = '新增衣服';
  document.getElementById('itemName').value = '';
  document.getElementById('itemSeason').value = pendingSeason || '';

  const catSel = document.getElementById('itemCategory');
  catSel.innerHTML = `<option value="">選擇類別</option>${allCats().map(c =>
    `<option value="${c}"${c === pendingCat ? ' selected' : ''}>${c}</option>`
  ).join('')}`;

  document.getElementById('itemNote').value = '';
  document.getElementById('wearVal').textContent = tempWear || '0';

  if (tempImage) {
    document.getElementById('photoPreview').src = tempImage;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('photoPlaceholder').style.display = 'none';
  } else {
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPlaceholder').style.display = 'flex';
  }

  document.getElementById('delBtn').style.display = 'none';
  document.getElementById('saveBtn').className = 'save-btn ' + (currentSeason === 'all' ? 'all' : currentSeason);
  document.getElementById('fileInput').value = '';

  clearValidation();
  pendingSeason = null;
  pendingCat = null;
  clearDraft();

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openEdit(id) {
  exitCatEditing();
  const item = items.find(i => i.id === id);
  if (!item) return;

  editId = id;
  tempImage = item.image || null;
  tempWear = item.wear || 0;

  document.getElementById('sheetTitle').textContent = '編輯衣服';
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemSeason').value = item.season;

  const catSel = document.getElementById('itemCategory');
  catSel.innerHTML = `<option value="">選擇類別</option>${allCats().map(c =>
    `<option value="${c}"${c === item.cat ? ' selected' : ''}>${c}</option>`
  ).join('')}`;

  document.getElementById('itemNote').value = item.note || '';
  document.getElementById('wearVal').textContent = item.wear || 0;

  if (item.image) {
    document.getElementById('photoPreview').src = item.image;
    document.getElementById('photoPreview').style.display = 'block';
    document.getElementById('photoPlaceholder').style.display = 'none';
  } else {
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPlaceholder').style.display = 'flex';
  }

  document.getElementById('delBtn').style.display = 'block';
  document.getElementById('saveBtn').className = 'save-btn ' + (item.season || 'all');
  document.getElementById('fileInput').value = '';

  clearValidation();
  clearDraft();

  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAddSheet() {
  const name = document.getElementById('itemName').value.trim();
  const season = document.getElementById('itemSeason').value;
  const category = document.getElementById('itemCategory').value;
  const note = document.getElementById('itemNote').value.trim();

  if (name || season || category || tempImage || note) {
    saveDraft({ name, season, cat: category, note, wear: tempWear, image: tempImage });
  } else {
    clearDraft();
  }

  closeSheet('overlay');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(event, id) {
  if (event.target === document.getElementById(id)) {
    if (id === 'overlay') closeAddSheet();
    else closeSheet(id);
  }
}

function changeWear(delta) {
  tempWear = Math.max(0, tempWear + delta);
  document.getElementById('wearVal').textContent = tempWear;
}

/* ══════════════════════════════════════════════════════════════ */
/* FORM CHECK | 表單驗證                                          */
/* Make sure the required fields are filled                       */
/* 確認必填欄位都已填寫                                           */
/* ══════════════════════════════════════════════════════════════ */
function validateForm() {
  let ok = true;
  const name = document.getElementById('itemName').value.trim();
  if (!name) {
    document.getElementById('itemName').classList.add('required-field');
    document.getElementById('nameError').classList.add('show');
    ok = false;
  } else {
    document.getElementById('itemName').classList.remove('required-field');
    document.getElementById('nameError').classList.remove('show');
  }

  const season = document.getElementById('itemSeason').value;
  if (!season) {
    document.getElementById('itemSeason').classList.add('required-field');
    document.getElementById('seasonError').classList.add('show');
    ok = false;
  } else {
    document.getElementById('itemSeason').classList.remove('required-field');
    document.getElementById('seasonError').classList.remove('show');
  }

  const cat = document.getElementById('itemCategory').value;
  if (!cat) {
    document.getElementById('itemCategory').classList.add('required-field');
    document.getElementById('categoryError').classList.add('show');
    ok = false;
  } else {
    document.getElementById('itemCategory').classList.remove('required-field');
    document.getElementById('categoryError').classList.remove('show');
  }
  return ok;
}

function clearValidation() {
  ['itemName', 'itemSeason', 'itemCategory'].forEach(id => document.getElementById(id).classList.remove('required-field'));
  ['nameError', 'seasonError', 'categoryError'].forEach(id => document.getElementById(id).classList.remove('show'));
}

/* ══════════════════════════════════════════════════════════════ */
/* SAVE & DELETE | 儲存與刪除                                     */
/* Save or delete one piece of clothing                           */
/* 儲存或刪除一件衣服                                             */
/* ══════════════════════════════════════════════════════════════ */
function saveItem() {
  if (tempImageUploading) {
    showToast('照片還在轉 你很急？');
    return;
  }

  if (!validateForm()) {
    showToast('沒填交個der');
    return;
  }

  const name = document.getElementById('itemName').value.trim();
  const season = document.getElementById('itemSeason').value;
  const category = document.getElementById('itemCategory').value;
  const note = document.getElementById('itemNote').value.trim();

  document.getElementById('saveBtn').disabled = true;

  try {
    if (editId) {
      const item = items.find(i => i.id === editId);
      if (item) {
        Object.assign(item, { name, season, cat: category, note, wear: tempWear, image: tempImage || null });
      }
    } else {
      items.push({
        id: Date.now().toString(),
        season, cat: category, name, note,
        wear: tempWear || 0,
        image: tempImage || null
      });
    }

    saveToStorage();
    clearDraft();
    closeSheet('overlay');
    currentCat = category || '全部';
    render();
    showToast(editId ? '已更新' : '已新增');
  } catch (e) {
    console.error(e);
    showToast('儲存失敗（那他可能壞掉了XD）');
  } finally {
    document.getElementById('saveBtn').disabled = false;
  }
}

function confirmDeleteItem() {
  showConfirmModal('確定要刪？', '懶得寫復原所以刪了就回不來了喔', () => {
    try {
      items = items.filter(i => i.id !== editId);
      saveToStorage();
      clearDraft();
      closeSheet('overlay');
      render();
      showToast('已刪除');
    } catch (e) {
      console.error(e);
      showToast('刪除失敗（那他可能壞掉了XD）');
    }
  });
}

/* ══════════════════════════════════════════════════════════════ */
/* CUSTOM CATEGORIES | 自訂類別                                   */
/* Add or remove your own categories                              */
/* 新增或刪除自己的類別                                           */
/* ══════════════════════════════════════════════════════════════ */
function openCatForm() {
  exitCatEditing();
  document.getElementById('newCatName').value = '';
  document.getElementById('catNameError').classList.remove('show');
  document.getElementById('catOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function addCustomCategory() {
  const catName = document.getElementById('newCatName').value.trim();

  if (catName.length < 2 || catName.length > 10) {
    document.getElementById('catNameError').classList.add('show');
    return;
  }

  if (allCats().includes(catName)) {
    showToast('這類有了啦');
    return;
  }

  const numId = customCatIdCounter++;
  const catId = `custom-${numId}`;
  customCats.push({ id: catId, name: catName, numId });

  try {
    saveToStorage();
    const sel = document.getElementById('itemCategory');
    if (sel) {
      const option = document.createElement('option');
      option.value = catName;
      option.textContent = catName;
      sel.appendChild(option);
    }
    renderCatBar();
    closeSheet('catOverlay');
    showToast('類別已新增');
  } catch (e) {
    console.error(e);
    customCats.pop();
    showToast('新增失敗（那他可能壞掉了XD）');
  }
}

function confirmRemoveCategory(catId) {
  const cat = customCats.find(c => c.id === catId);
  if (!cat) return;

  const related = items.filter(i => i.cat === cat.name);
  const desc = related.length > 0
    ? `有 ${related.length} 件衣服使用此類別 刪除後會改為未分類`
    : `確定要刪 ${cat.name}？懶得寫復原所以刪了就回不來了喔`;

  showConfirmModal(`刪除 ${cat.name}`, desc, () => {
    try {
      related.forEach(i => { i.cat = '全部'; });
      customCats = customCats.filter(c => c.id !== catId);
      saveToStorage();

      const sel = document.getElementById('itemCategory');
      if (sel) {
        Array.from(sel.options).filter(o => o.value === cat.name).forEach(o => o.remove());
      }

      if (currentCat === cat.name) currentCat = '全部';
      if (!customCats.length) exitCatEditing();

      render();
      showToast('類別已刪除' + (related.length > 0 ? ` ${related.length} 件已更新` : ''));
    } catch (e) {
      console.error(e);
      showToast('刪除失敗（那他可能壞掉了XD）');
    }
  });
}

/* ══════════════════════════════════════════════════════════════ */
/* DRAFTS | 草稿                                                  */
/* Keep an unsaved item so you can continue later                 */
/* 保留未儲存的內容，之後可繼續編輯                               */
/* ══════════════════════════════════════════════════════════════ */
function saveDraft(draft) {
  localStorage.setItem('closet-draft-v1', JSON.stringify(draft));
}

function loadDraft() {
  try {
    const data = localStorage.getItem('closet-draft-v1');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem('closet-draft-v1');
}

function checkDraftOnOpen() {
  const draft = loadDraft();
  if (!draft) return;

  const sl = seasonLabels[draft.season] || draft.season || '';
  document.getElementById('draftTitle').textContent = '上次沒儲存的';
  document.getElementById('draftDesc').textContent = `${sl} · ${draft.cat || '（未分類）'}`;

  document.getElementById('draftPreview').innerHTML = draft.image
    ? `<div class="unsaved-item"><div class="unsaved-thumb"><img src="${draft.image}" alt=""></div><div class="unsaved-name">${draft.name || '未命名'}</div></div>`
    : '';

  document.getElementById('draftModal').classList.add('open');
}

function continueDraft() {
  const draft = loadDraft();
  if (!draft) return;

  pendingSeason = draft.season;
  pendingCat = draft.cat || '';
  tempImage = draft.image || null;
  tempWear = draft.wear || 0;

  document.getElementById('draftModal').classList.remove('open');
  openForm();
}

function discardDraft() {
  clearDraft();
  document.getElementById('draftModal').classList.remove('open');
  openForm();
}

/* ══════════════════════════════════════════════════════════════ */
/* POPUPS & TOAST | 彈窗與提示訊息                                */
/* Confirm popup and short messages                               */
/* 確認彈窗與短暫出現的訊息                                       */
/* ══════════════════════════════════════════════════════════════ */
function showConfirmModal(title, desc, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;

  const confirmBtn = document.getElementById('confirmOkBtn');
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  document.getElementById('confirmOkBtn').onclick = () => {
    closeConfirmModal();
    if (onOk) onOk();
  };

  document.getElementById('confirmModal').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('open');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ══════════════════════════════════════════════════════════════ */
/* RUN THE APP | 啟動 App                                         */
/* Start when the page has loaded                                 */
/* 頁面載入完成後開始執行                                         */
/* ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);