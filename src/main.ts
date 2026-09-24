import { Preferences } from '@capacitor/preferences';
import './style.css';
import * as OTP from 'otpauth';

// ===================== 类型 =====================
interface Account {
  id: string;
  label: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  issuer: string;
  labelHint: string;
  digits: number;
  period: number;
  algorithm: string;
}

type View = 'list' | 'add' | 'edit';

// ===================== 内置模板 =====================
const TEMPLATES: Template[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    issuer: 'GitHub',
    labelHint: 'zhangsan',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    issuer: 'GitLab',
    labelHint: 'zhangsan',
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  },
];

// ===================== 存储 =====================
const STORE_KEY = 'totp_accounts';

async function loadAccounts(): Promise<Account[]> {
  try {
    const result = await Preferences.get({ key: STORE_KEY });
    return result.value ? JSON.parse(result.value) : [];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  // 注：@capacitor/preferences 在 Android 上存储于 app 私有目录，受系统沙盒保护
  // 后续可接入原生 KeyStore 插件实现更强加密
  await Preferences.set({ key: STORE_KEY, value: JSON.stringify(accounts) });
}

// ===================== UI 状态 =====================
let accounts: Account[] = [];
let currentView: View = 'list';
let currentEditId: string | null = null;

// ===================== TOTP =====================
function generateTOTP(account: Account): string {
  try {
    const totp = new OTP.TOTP({
      issuer: account.issuer || 'Unknown',
      label: account.label,
      algorithm: (account.algorithm || 'SHA1') as 'SHA1' | 'SHA256' | 'SHA512',
      digits: account.digits || 6,
      period: account.period || 30,
      secret: OTP.Secret.fromBase32(account.secret),
    });
    return totp.generate();
  } catch {
    return '------';
  }
}

function getTimeLeft(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===================== 渲染入口 =====================
function render() {
  const app = document.getElementById('app')!;
  if (currentView === 'list') renderList(app);
  else if (currentView === 'add') renderAdd(app);
  else if (currentView === 'edit') renderEdit(app);
}

// ===================== 视图：账号列表 =====================
function renderList(app: HTMLElement) {
  const timeLeft = getTimeLeft();
  const progress = timeLeft / 30;
  const ringColor = timeLeft <= 5 ? '#b3261e' : timeLeft <= 10 ? '#c78100' : '#2e7d32';

  let html = `
    <div class="header">
      <h1>TOTP</h1>
    </div>
    <div class="account-list">
  `;

  if (accounts.length === 0) {
    // 空状态
    html += `
      <div class="empty">
        <div class="empty-icon">🔐</div>
        <div class="empty-title">还没有验证码</div>
        <div class="empty-sub">选择下面的模板快速添加</div>
        <div class="template-grid">
          ${TEMPLATES.map(t => `
            <button class="template-btn" data-template="${t.id}">
              <span class="tpl-icon">${t.icon}</span>
              <span>${t.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    for (const acc of accounts) {
      const code = generateTOTP(acc);
      const formatted = code.replace(/(.{3})/g, '$1 ').trim();
      html += `
        <div class="card" data-id="${acc.id}">
          <div class="card-body">
            <div class="card-left">
              <div class="issuer">${escapeHtml(acc.issuer)}</div>
              <div class="label">${escapeHtml(acc.label)}</div>
            </div>
            <div class="code-block">
              <div class="code" id="code-${acc.id}">${formatted}</div>
              <div class="copy-hint" id="hint-${acc.id}">点击复制</div>
            </div>
          </div>
          <div class="card-edit" id="edit-${acc.id}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
        </div>
      `;
    }
  }

  html += `</div>`;

  if (accounts.length > 0) {
    html += `
      <div class="progress-bar-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="pbar" style="width:${(progress * 100).toFixed(1)}%;background:${ringColor}"></div>
        </div>
        <div class="time-left" id="timeleft" style="color:${ringColor}">${timeLeft}s</div>
      </div>
    `;
  }

  html += `<button class="add-btn" id="addbtn">+ 添加账号</button>`;

  app.innerHTML = html;

  // 事件绑定
  document.getElementById('addbtn')!.onclick = () => { currentView = 'add'; render(); };

  if (accounts.length === 0) {
    for (const t of TEMPLATES) {
      document.querySelector(`[data-template="${t.id}"]`)!.addEventListener('click', () => startAddTemplate(t));
    }
  } else {
    for (const acc of accounts) {
      document.querySelector(`[data-id="${acc.id}"]`)!.addEventListener('click', (e) => {
        (e.target as HTMLElement).closest('.card-edit')
          ? openEdit(acc.id)
          : copyCode(acc.id);
      });
    }
  }
}

function copyCode(id: string) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  const code = generateTOTP(acc);
  navigator.clipboard.writeText(code).then(() => {
    showToast('已复制');
    const hint = document.getElementById(`hint-${id}`);
    if (hint) { hint.textContent = '✓ 已复制'; setTimeout(() => { if (hint) hint.textContent = '点击复制'; }, 1500); }
  });
}

function openEdit(id: string) {
  currentEditId = id;
  currentView = 'edit';
  render();
}

function startAddTemplate(tpl: Template) {
  currentView = 'add';
  render();
  // 预填模板
  const tplInput = document.getElementById('f-template') as HTMLSelectElement;
  const labelInput = document.getElementById('f-label') as HTMLInputElement;
  if (tplInput) tplInput.value = tpl.id;
  if (labelInput) labelInput.placeholder = tpl.labelHint;
}

// ===================== 视图：添加账号 =====================
function renderAdd(app: HTMLElement) {
  const html = `
    <div class="header">
      <h1>添加账号</h1>
      <button class="back-btn" id="backbtn">取消</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>模板</label>
        <div class="template-pills">
          <button class="tpl-pill active" data-tpl="">自定义</button>
          ${TEMPLATES.map(t => `
            <button class="tpl-pill" data-tpl="${t.id}">${t.icon} ${t.name}</button>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>粘贴 otpauth:// 密钥链接</label>
        <textarea id="f-uri" rows="2" placeholder="从设置页面复制，如&#10;otpauth://totp/GitHub:username?secret=JBSWY...&issuer=GitHub"></textarea>
      </div>
      <div class="form-divider"><span>或手动填写</span></div>
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" placeholder="如：GitHub" />
      </div>
      <div class="form-group">
        <label>密钥</label>
        <input id="f-secret" type="text" placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP" />
      </div>
      <button class="save-btn" id="savebtn">保存</button>
    </div>
  `;
  app.innerHTML = html;

  let activeTemplate = '';

  document.getElementById('backbtn')!.onclick = () => { currentView = 'list'; render(); };

  // 模板切换
  for (const t of TEMPLATES) {
    document.querySelector(`[data-tpl="${t.id}"]`)!.addEventListener('click', () => {
      activeTemplate = t.id;
      document.querySelectorAll('.tpl-pill').forEach(el => el.classList.remove('active'));
      document.querySelector(`[data-tpl="${t.id}"]`)!.classList.add('active');
      const labelInput = document.getElementById('f-label') as HTMLInputElement;
      if (labelInput) labelInput.placeholder = t.labelHint;
    });
  }
  document.querySelector('[data-tpl=""]')!.addEventListener('click', () => {
    activeTemplate = '';
    document.querySelectorAll('.tpl-pill').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-tpl=""]')!.classList.add('active');
    const labelInput = document.getElementById('f-label') as HTMLInputElement;
    if (labelInput) labelInput.placeholder = '如：GitHub';
  });

  // URI 解析
  const uriInput = document.getElementById('f-uri') as HTMLTextAreaElement;
  const labelInput = document.getElementById('f-label') as HTMLInputElement;
  const secretInput = document.getElementById('f-secret') as HTMLInputElement;

  uriInput.addEventListener('input', () => {
    const uri = uriInput.value.trim();
    if (!uri.startsWith('otpauth://')) return;
    try {
      const t = OTP.URI.parse(uri) as OTP.TOTP;
      const label = t.label.includes(':') ? t.label.split(':')[1].trim() : t.label;
      labelInput.value = label;
      secretInput.value = t.secret.base32;
      showToast('已解析 ✓');
    } catch {
      showToast('解析失败');
    }
  });

  document.getElementById('savebtn')!.onclick = () => {
    const label = labelInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');

    if (!label || !secret) {
      showToast('请填写名称和密钥');
      return;
    }

    const tpl = TEMPLATES.find(t => t.id === activeTemplate);
    const issuer = tpl ? tpl.issuer : label;

    const account: Account = {
      id: Date.now().toString(),
      label,
      issuer,
      secret,
      digits: tpl?.digits ?? 6,
      period: tpl?.period ?? 30,
      algorithm: tpl?.algorithm ?? 'SHA1',
    };

    accounts.push(account);
    saveAccounts(accounts).then(() => {
      currentView = 'list';
      render();
    });
  };
}

// ===================== 视图：编辑/删除 =====================
function renderEdit(app: HTMLElement) {
  const acc = accounts.find(a => a.id === currentEditId);
  if (!acc) { currentView = 'list'; render(); return; }

  const html = `
    <div class="header">
      <h1>编辑账号</h1>
      <button class="back-btn" id="backbtn">返回</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" value="${escapeHtml(acc.label)}" />
      </div>
      <div class="form-group">
        <label>颁发者</label>
        <input id="f-issuer" type="text" value="${escapeHtml(acc.issuer)}" />
      </div>
      <div class="form-group">
        <label>密钥</label>
        <input id="f-secret" type="text" value="${escapeHtml(acc.secret)}" />
      </div>
      <button class="delete-btn-full" id="deletebtn">删除此账号</button>
      <button class="save-btn" id="savebtn">保存</button>
    </div>
  `;
  app.innerHTML = html;

  document.getElementById('backbtn')!.onclick = () => { currentView = 'list'; render(); };

  document.getElementById('deletebtn')!.onclick = () => {
    if (confirm(`确定删除「${acc.label}」？`)) {
      accounts = accounts.filter(a => a.id !== currentEditId);
      saveAccounts(accounts).then(() => { currentView = 'list'; currentEditId = null; render(); });
    }
  };

  document.getElementById('savebtn')!.onclick = () => {
    const labelInput = document.getElementById('f-label') as HTMLInputElement;
    const issuerInput = document.getElementById('f-issuer') as HTMLInputElement;
    const secretInput = document.getElementById('f-secret') as HTMLInputElement;

    const label = labelInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7=]/g, '');
    if (!label || !secret) { showToast('名称和密钥不能为空'); return; }

    const idx = accounts.findIndex(a => a.id === currentEditId);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], label, issuer: issuerInput.value.trim() || label, secret };
    }
    saveAccounts(accounts).then(() => {
      currentView = 'list';
      currentEditId = null;
      render();
    });
  };
}

// ===================== Toast =====================
function showToast(msg: string) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ===================== 启动 =====================
async function main() {
  accounts = await loadAccounts();
  render();

  setInterval(() => {
    const tl = getTimeLeft();
    const progress = tl / 30;
    const color = tl <= 5 ? '#b3261e' : tl <= 10 ? '#c78100' : '#2e7d32';
    const tlEl = document.getElementById('timeleft');
    const pbEl = document.getElementById('pbar');
    if (tlEl) { tlEl.style.color = color; tlEl.textContent = tl + 's'; }
    if (pbEl) { pbEl.style.width = (progress * 100) + '%'; pbEl.style.background = color; }
    if (tl === 30) refreshCodes();
  }, 1000);
}

function refreshCodes() {
  for (const acc of accounts) {
    const codeEl = document.getElementById(`code-${acc.id}`);
    if (codeEl) codeEl.textContent = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
  }
}

main();
