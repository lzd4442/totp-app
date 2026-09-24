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
  await Preferences.set({ key: STORE_KEY, value: JSON.stringify(accounts) });
}

// ===================== UI 状态 =====================
let accounts: Account[] = [];
let editingId: string | null = null;

// ===================== TOTP 生成 =====================
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

// ===================== 渲染 =====================
function render() {
  const app = document.getElementById('app')!;
  const timeLeft = getTimeLeft();

  if (editingId !== null) {
    renderEdit(app);
    return;
  }

  const progress = timeLeft / 30;
  const ringColor = timeLeft <= 5 ? '#b3261e' : timeLeft <= 10 ? '#c78100' : '#2e7d32';

  let html = `
    <div class="header">
      <h1>🔐 TOTP 验证器</h1>
    </div>
    <div class="account-list">
  `;

  if (accounts.length === 0) {
    html += `
      <div class="empty">
        <p>暂无账号</p>
        <p>点击下方添加按钮开始</p>
      </div>
    `;
  } else {
    for (const acc of accounts) {
      const code = generateTOTP(acc);
      const formatted = code.replace(/(.{3})/g, '$1 ').trim();
      html += `
        <div class="card" id="card-${acc.id}">
          <div class="card-left">
            <div class="issuer">${escapeHtml(acc.issuer || 'Unknown')}</div>
            <div class="label">${escapeHtml(acc.label)}</div>
          </div>
          <div class="code-block">
            <div class="code" id="code-${acc.id}">${formatted}</div>
            <div class="copy-hint">点击复制</div>
          </div>
          <button class="delete-btn" id="del-${acc.id}">✕</button>
        </div>
      `;
    }
  }

  html += `
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="pbar" style="width:${(progress * 100).toFixed(1)}%;background:${ringColor}"></div>
      </div>
      <div class="time-left" id="timeleft" style="color:${ringColor}">${timeLeft}s</div>
    </div>
    <button class="add-btn" id="addbtn">+ 添加账号</button>
  `;

  app.innerHTML = html;

  // 绑定事件
  for (const acc of accounts) {
    document.getElementById(`card-${acc.id}`)!.onclick = () => copyCode(acc.id);
    document.getElementById(`del-${acc.id}`)!.onclick = (e) => {
      e.stopPropagation();
      deleteAccount(acc.id);
    };
  }
  document.getElementById('addbtn')!.onclick = () => showAdd();
}

function copyCode(id: string) {
  const acc = accounts.find(a => a.id === id);
  if (!acc) return;
  const code = generateTOTP(acc);
  navigator.clipboard.writeText(code).then(() => showToast('已复制: ' + code));
}

function deleteAccount(id: string) {
  if (confirm('确定删除这个账号？')) {
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts(accounts);
    render();
  }
}

function showAdd() {
  editingId = 'new';
  render();
}

// ===================== 编辑/添加表单 =====================
function renderEdit(app: HTMLElement) {
  const isNew = editingId === 'new';
  const existing = isNew ? null : accounts.find(a => a.id === editingId);

  const html = `
    <div class="header">
      <h1>${isNew ? '➕ 添加账号' : '✏️ 编辑账号'}</h1>
      <button class="back-btn" id="backbtn">← 返回</button>
    </div>
    <div class="form">
      <div class="form-group">
        <label>名称</label>
        <input id="f-label" type="text" placeholder="如：GitHub" value="${escapeHtml(existing?.label || '')}" />
      </div>
      <div class="form-group">
        <label>颁发者</label>
        <input id="f-issuer" type="text" placeholder="如：GitHub.com" value="${escapeHtml(existing?.issuer || '')}" />
      </div>
      <div class="form-group">
        <label>密钥 (Secret)</label>
        <input id="f-secret" type="text" placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP" />
      </div>
      <div class="form-group">
        <label>位数</label>
        <select id="f-digits">
          <option value="6" ${(existing?.digits || 6) === 6 ? 'selected' : ''}>6 位</option>
          <option value="8" ${existing?.digits === 8 ? 'selected' : ''}>8 位</option>
        </select>
      </div>
      <div class="form-group">
        <label>周期（秒）</label>
        <select id="f-period">
          <option value="30" ${(existing?.period || 30) === 30 ? 'selected' : ''}>30 秒</option>
          <option value="60" ${existing?.period === 60 ? 'selected' : ''}>60 秒</option>
        </select>
      </div>
      <div class="form-group">
        <label>算法</label>
        <select id="f-algo">
          <option value="SHA1" ${(existing?.algorithm || 'SHA1') === 'SHA1' ? 'selected' : ''}>SHA1（常用）</option>
          <option value="SHA256" ${existing?.algorithm === 'SHA256' ? 'selected' : ''}>SHA256</option>
          <option value="SHA512" ${existing?.algorithm === 'SHA512' ? 'selected' : ''}>SHA512</option>
        </select>
      </div>
      <div class="form-tips">
        💡 支持粘贴 otpauth:// URI，会自动解析填充所有字段
      </div>
      <div class="form-group">
        <label>或粘贴 otpauth:// URI</label>
        <textarea id="f-uri" rows="2" placeholder="otpauth://totp/GitHub:user@example.com?secret=...&issuer=GitHub"></textarea>
      </div>
      <button class="save-btn" id="savebtn">保存</button>
    </div>
  `;

  app.innerHTML = html;

  document.getElementById('backbtn')!.onclick = () => {
    editingId = null;
    render();
  };

  const uriInput = document.getElementById('f-uri') as HTMLTextAreaElement;
  const labelInput = document.getElementById('f-label') as HTMLInputElement;
  const issuerInput = document.getElementById('f-issuer') as HTMLInputElement;
  const secretInput = document.getElementById('f-secret') as HTMLInputElement;
  const digitsInput = document.getElementById('f-digits') as HTMLSelectElement;
  const periodInput = document.getElementById('f-period') as HTMLSelectElement;
  const algoInput = document.getElementById('f-algo') as HTMLSelectElement;

  // otpauth URI 自动解析
  uriInput.addEventListener('input', () => {
    const uri = uriInput.value.trim();
    if (!uri.startsWith('otpauth://')) return;
    try {
      const t = OTP.URI.parse(uri) as OTP.TOTP;
      labelInput.value = t.label;
      issuerInput.value = t.issuer || '';
      secretInput.value = t.secret.base32;
      digitsInput.value = String(t.digits);
      periodInput.value = String(t.period);
      if (t.algorithm) algoInput.value = t.algorithm;
    } catch (e) {
      console.error('URI 解析失败', e);
    }
  });

  document.getElementById('savebtn')!.onclick = () => {
    const label = labelInput.value.trim();
    const issuer = issuerInput.value.trim();
    const secret = secretInput.value.trim().toUpperCase().replace(/[^A-Z2-7]/g, '');

    if (!label || !secret) {
      showToast('请填写名称和密钥');
      return;
    }

    const account: Account = {
      id: isNew ? Date.now().toString() : (editingId as string),
      label,
      issuer,
      secret,
      digits: parseInt(digitsInput.value),
      period: parseInt(periodInput.value),
      algorithm: algoInput.value,
    };

    if (isNew) {
      accounts.push(account);
    } else {
      const idx = accounts.findIndex(a => a.id === editingId);
      if (idx >= 0) accounts[idx] = account;
    }

    saveAccounts(accounts).then(() => {
      editingId = null;
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

  // 每秒更新时间
  setInterval(() => {
    const tl = getTimeLeft();
    const progress = tl / 30;
    const color = tl <= 5 ? '#b3261e' : tl <= 10 ? '#c78100' : '#2e7d32';
    const tlEl = document.getElementById('timeleft');
    const pbEl = document.getElementById('pbar');
    if (tlEl) { tlEl.style.color = color; tlEl.textContent = tl + 's'; }
    if (pbEl) { pbEl.style.width = (progress * 100) + '%'; pbEl.style.background = color; }

    // 每30秒刷新验证码
    if (tl === 30) refreshCodes();
  }, 1000);
}

function refreshCodes() {
  for (const acc of accounts) {
    const codeEl = document.getElementById(`code-${acc.id}`);
    if (codeEl) {
      codeEl.textContent = generateTOTP(acc).replace(/(.{3})/g, '$1 ').trim();
    }
  }
}

main();
