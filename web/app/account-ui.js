import { localAccount, localSyncState } from "./account-storage.js";
import {
  accountState,
  accountApi,
  refreshAccount,
  prepareLogin,
  chooseArchive,
  archiveChoice,
  leaveAccount,
  syncArchive,
} from "./account-client.js";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let dialog,
  mode = "password",
  challenge,
  cooldown = 0,
  submitting = false;
let historyVersions = [];
const archiveDate = value => escape(new Date(value).toLocaleString("zh-CN", { month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" }));
function hubMessage(text) {
  const node = document.querySelector("[data-parent-account-message]");
  if (node) node.textContent = text;
}
function cancelHistory() {
  if (accountState.conflict?.history) accountState.conflict = null;
}

const input = (name, label, type = "text", autocomplete = "") =>
  `<label class="account-field">${label}<input name="${name}" type="${type}" ${autocomplete ? `autocomplete="${autocomplete}"` : ""} required maxlength="${type === "password" ? 128 : 100}" ${name === "phone" ? 'inputmode="tel" pattern="1[3-9][0-9]{9}"' : ""}></label>`;
function homeIdentity() {
  const account = accountState.account;
  let retained = false;
  try {
    retained = !account && localAccount().owner !== "guest";
  } catch {}
  return {
    account,
    retained,
    key: account?.id || (retained ? "retained" : "guest"),
  };
}
export function parentIdentity() {
  const { account } = homeIdentity();
  return `<span data-parent-identity${account ? "" : " hidden"}>${account ? `<span class="parent-username">${escape(account.username)}</span><span class="parent-identity-dot" aria-hidden="true">·</span>` : ""}</span>`;
}
export function accountPanel() {
  const account = accountState.account;
  let restored = false;
  try {
    restored = !!account && sessionStorage.getItem("garden-restored-account") === account.id;
    if (restored) sessionStorage.removeItem("garden-restored-account");
  } catch {}
  return `<div class="account-hub" data-account-identity="${account?.id || "guest"}">
    <section class="panel parent-account-block" aria-labelledby="parent-account-title">
      <p class="account-section-kicker">账号与安全</p><h2 id="parent-account-title">家长账号</h2>
      ${account ? `<dl class="parent-account-details"><div><dt>用户名</dt><dd>${escape(account.username)}</dd></div><div><dt>绑定手机号</dt><dd>${escape(account.phone)}</dd></div></dl><div class="parent-account-actions"><button data-account-open="reset">重设密码</button><button data-account-command="logout">退出登录</button></div>` : '<p class="parent-account-description">登录后，在不同设备继续学习。</p><button class="account-primary" data-account-open="password">登录 / 注册</button>'}
    </section>
    <section class="panel parent-archive-block" aria-labelledby="parent-archive-title">
      <p class="account-section-kicker">自动同步 · 手动留存</p><h2 id="parent-archive-title">学习存档</h2>
      <p class="parent-save-status" data-account-status>${escape(accountState.status)}</p>
      <p class="parent-account-description">${account ? "最新进度自动同步。想留下某一刻，再存一份档。" : "不登录也能学习，进度先保存在这台设备。"}</p>
      ${account ? '<div class="parent-archive-actions"><button class="account-primary" data-account-command="save">保存存档</button><button class="account-outline" data-account-open="history">历史存档</button></div><p class="account-footnote">最多 3 份手动存档，不受自动同步影响。</p>' : '<p class="account-footnote">登录后可自动同步，并保留手动存档。</p>'}
      <p class="parent-account-message" role="status" data-parent-account-message>${restored ? "已恢复所选存档" : ""}</p>
    </section></div>`;
}
function paintStatus() {
  document.querySelectorAll(".account-hub").forEach((node) => {
    if (node.dataset.accountIdentity !== (accountState.account?.id || "guest"))
      node.outerHTML = accountPanel();
  });
  document.querySelectorAll("[data-parent-identity]").forEach((node) => {
    node.outerHTML = parentIdentity();
  });
  document.querySelectorAll("[data-account-status]").forEach((node) => {
    node.textContent = accountState.status;
  });
}
function error(message, success = false) {
  const node = dialog?.querySelector("[data-account-error]");
  if (node) {
    node.textContent = message;
    node.classList.toggle("is-success", success);
  }
}
function archiveSummary(snapshot) {
  if (!snapshot) return "还没有云端存档";
  const mastery = snapshot.data?.["abc-garden-mastery-v1"]?.entries || {};
  const known = Object.values(mastery).filter((entry) => entry.mastered).length;
  const words = Object.keys(
    snapshot.data?.["abc-garden-guided-words-v1"]?.entries || {},
  ).length;
  const letters = Object.keys(
    snapshot.data?.["abc-garden-guided-letters-v1"]?.entries || {},
  ).length;
  return `已掌握 ${known} 个词 · 陪学 ${words} 个词、${letters} 个字母`;
}
function formContent() {
  const choice = accountState.pending || accountState.conflict;
  if (choice?.history)
    return `<p class="account-eyebrow">历史存档</p><h2 id="account-title">恢复这份存档？</h2><section class="account-save-panel"><strong>${archiveDate(choice.historySavedAt)}</strong><p class="account-footnote">${archiveSummary(choice.local)}</p></section><p class="account-subtitle">当前学习进度和学习配置将替换为这份存档，并同步到其他设备。此存档之后的学习变化不会保留，其他手动存档不受影响。</p><div class="parent-archive-actions"><button class="account-outline" data-account-action="cancel-restore">取消</button><button class="account-primary" data-account-choice="local">恢复此存档</button></div>`;
  if (choice && ["profile", "history", "save"].includes(mode))
    return `<div class="account-restore"><p class="account-eyebrow">学习存档</p><h2 id="account-title">选择这次继续的记录</h2><p class="account-subtitle">两份记录不会自动合并，请选择要继续使用的一份。</p><div class="account-choice"><button data-account-choice="remote"><strong>使用云端记录</strong><span>${archiveSummary(choice.remote.snapshot)}</span></button><button data-account-choice="local"><strong>保存本机记录到账号</strong><span>${archiveSummary(choice.local)}</span></button></div><p class="account-footnote">确认后将更新当前学习进度。手动存档不会被自动同步覆盖。</p></div>`;
  if (mode === "history")
    return `<p class="account-eyebrow">手动留存</p><h2 id="account-title">历史存档</h2><p class="account-subtitle">最多保留 3 份，自动同步不会覆盖这些存档。</p><div class="account-choice">${historyVersions.map(row => `<button data-account-history="${row.revision}"><strong>${archiveDate(row.savedAt)}</strong><span>查看并恢复 <span aria-hidden="true">›</span></span></button>`).join("") || '<p class="account-empty">还没有手动存档。关闭后点击“保存存档”，留下一份当前进度。</p>'}</div>`;
  if (mode === "save")
    return `<p class="account-eyebrow">手动留存</p><h2 id="account-title">保存当前进度？</h2><p class="account-subtitle">将当前学习进度保存为一份独立存档，之后的自动同步不会修改它。</p>${historyVersions.length >= 3 ? `<p class="account-save-panel">已有 3 份存档，保存后将替换最早的一份：<strong>${archiveDate(historyVersions.at(-1).savedAt)}</strong>。</p>` : '<p class="account-footnote">最多保留 3 份手动存档。</p>'}<div class="parent-archive-actions"><button class="account-outline" data-account-action="cancel-save">取消</button><button class="account-primary" data-account-action="sync">保存存档</button></div>`;
  const account = accountState.account;
  const names = {
    password: "欢迎回到小花园",
    sms: "用手机号登录",
    register: "给成长一个家",
    reset: "重新设置密码",
  };
  const smsMode = ["sms", "register", "reset"].includes(mode);
  const newPassword = ["register", "reset"].includes(mode);
  return `<p class="account-eyebrow">家长账号</p><h2 id="account-title">${names[mode]}</h2><p class="account-subtitle">${mode === "register" ? "注册后自动保存学习记录，孩子照常学习就好。" : "登录后，在不同设备继续孩子的学习。"}</p>
    ${["password", "sms"].includes(mode) ? `<div class="account-tabs" role="group" aria-label="登录方式"><button data-account-mode="password" aria-pressed="${mode === "password"}">密码登录</button><button data-account-mode="sms" aria-pressed="${mode === "sms"}">短信登录</button></div>` : ""}
    <form data-account-form="${mode}">
    ${mode === "password" ? input("identifier", "用户名或手机号", "text", "username") : ""}
    ${mode === "register" ? input("username", "用户名（3–24 位，英文区分大小写）", "text", "username") : ""}
    ${smsMode ? input("phone", "手机号", "tel", "tel-national") : ""}
    ${smsMode ? `<label class="account-field">短信验证码<div class="account-code-row"><input name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"><button type="button" data-account-send>获取验证码</button></div></label>` : ""}
    ${mode === "password" || newPassword ? input("password", newPassword ? "设置密码（至少 8 位，可为纯数字）" : "密码", "password", newPassword ? "new-password" : "current-password") : ""}
    ${newPassword ? input("passwordConfirm", "确认密码", "password", "new-password") : ""}
    ${mode === "register" ? `<label class="account-consent"><input type="checkbox" name="consent" required><span>我是监护人，同意将学习配置与进度保存到云端。</span></label><details class="account-privacy"><summary>云存档说明</summary><p>账号保存手机号、用户名、密码哈希和学习配置与进度。学习录音和设备音色留在本机。登录后自动同步，未登录可继续本机学习。手机号被回收后，新持有人可能通过短信访问原账号。</p></details>` : ""}
    <button class="account-primary">${{ register: "创建账号", reset: "重设密码" }[mode] || "登录小花园"}</button></form>
    <div class="account-links">${["password", "sms"].includes(mode) ? '<button data-account-mode="register">还没有账号？去注册</button><button data-account-mode="reset">忘记密码</button>' : account ? '<button data-account-action="cancel-save">返回家长小角</button>' : '<button data-account-mode="password">返回登录</button>'}</div>`;
}
function renderDialog() {
  if (mode === "profile" && !accountState.account) mode = "password";
  if (mode === "profile" && accountState.account && !accountState.pending && !accountState.conflict) {
    dialog.close();
    paintStatus();
    return;
  }
  challenge = null;
  dialog.innerHTML = `<button class="account-close" aria-label="关闭账号窗口">×</button><div class="account-dialog-inner">${formContent()}<p class="account-error" role="alert" data-account-error></p></div>`;
  dialog.querySelector("input")?.focus();
  updateCooldown();
}
async function open(requested = "profile") {
  if (
    accountState.account &&
    requested !== "reset" &&
    localAccount().owner !== accountState.account.id
  ) {
    try {
      await prepareLogin({ account: accountState.account });
    } catch {
      accountState.status = "暂时无法读取云档，请联网后重试";
    }
  }
  mode = accountState.account ? requested : "password";
  if (mode === "profile" && accountState.account && !accountState.pending && !accountState.conflict) mode = "history";
  if (["history", "save"].includes(mode) && !accountState.pending && !accountState.conflict) {
    try {
      historyVersions = (
        await accountApi(
          `/profiles/${accountState.account.profileId}/abc/history`,
          null,
          "GET",
        )
      ).versions;
    } catch (cause) {
      hubMessage(cause.message);
      return;
    }
  }
  if (mode === "save" && !accountState.pending && !accountState.conflict) {
    const state = localSyncState();
    if (!state.dirty && historyVersions.some(row => row.revision === state.revision)) {
      hubMessage("当前进度已有存档，无需重复保存");
      return;
    }
  }
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "account-dialog";
    dialog.setAttribute("aria-labelledby", "account-title");
    document.body.append(dialog);
    dialog.addEventListener("click", handleClick);
    dialog.addEventListener("submit", handleSubmit);
    dialog.addEventListener("close", cancelHistory);
    dialog.addEventListener("cancel", event => { if (submitting) event.preventDefault(); });
  }
  renderDialog();
  dialog.showModal();
}
function updateCooldown() {
  const button = dialog?.querySelector("[data-account-send]");
  if (!button) return;
  const seconds = Math.max(0, Math.ceil((cooldown - Date.now()) / 1000));
  button.disabled = seconds > 0 || submitting;
  button.textContent = seconds ? `${seconds} 秒后重发` : "获取验证码";
}
const purpose = () =>
  ({
    sms: "login",
    register: "register",
    reset: "reset",
  })[mode];
async function sendCode() {
  const form = dialog.querySelector("form");
  const phone = form.elements.phone;
  if (phone && !phone.reportValidity()) return;
  submitting = true;
  updateCooldown();
  error("");
  try {
    const result = await accountApi("/auth/sms", {
      phone: phone?.value,
      purpose: purpose(),
    });
    challenge = {
      id: result.challengeId,
      phone: phone?.value,
      purpose: purpose(),
    };
    cooldown = Date.now() + result.retryAfter * 1000;
    error("验证码已发送，请查看手机短信");
  } catch (cause) {
    error(cause.message);
  } finally {
    submitting = false;
    updateCooldown();
  }
}
async function handleSubmit(event) {
  event.preventDefault();
  if (submitting) return;
  const form = event.target,
    fields = Object.fromEntries(new FormData(form));
  if (
    ["register", "reset"].includes(mode) &&
    fields.password !== fields.passwordConfirm
  ) {
    error("两次输入的密码不一致，请重新确认");
    form.elements.passwordConfirm.focus();
    return;
  }
  // Confirmation is a local typo check, never a second stored credential.
  delete fields.passwordConfirm;
  fields.consent = fields.consent === "on";
  if (purpose()) {
    if (
      !challenge ||
      challenge.phone !== fields.phone ||
      challenge.purpose !== purpose()
    )
      return error("请先获取此手机号对应的验证码");
    fields.challengeId = challenge.id;
  }
  submitting = true;
  form.querySelector('button[type="submit"], .account-primary').disabled = true;
  error("");
  try {
    const endpoint = {
      password: "/auth/login-password",
      sms: "/auth/login-sms",
      register: "/auth/register",
      reset: "/auth/reset",
    }[mode];
    const result = await accountApi(endpoint, fields);
    if (mode === "reset") {
      await refreshAccount();
      mode = "password";
      renderDialog();
      error("密码已重设，请重新登录");
    } else {
      await prepareLogin(result);
      mode = "profile";
      renderDialog();
    }
  } catch (cause) {
    error(cause.message);
  } finally {
    submitting = false;
    const button = dialog?.querySelector(".account-primary");
    if (button) button.disabled = false;
  }
}
async function handleClick(event) {
  const button = event.target.closest("button");
  if (!button || submitting) return;
  if (button.classList.contains("account-close")) return dialog.close();
  if (button.dataset.accountMode) {
    mode = button.dataset.accountMode;
    renderDialog();
    return;
  }
  if (button.hasAttribute("data-account-send")) return sendCode();
  try {
    if (button.dataset.accountChoice) {
      submitting = true;
      try {
        return await chooseArchive(button.dataset.accountChoice);
      } catch (cause) {
        renderDialog();
        throw cause;
      } finally {
        submitting = false;
      }
    }
    if (button.dataset.accountHistory) {
      submitting = true;
      try {
        const base = `/profiles/${accountState.account.profileId}/abc`;
        const [previous, remote] = await Promise.all([
          accountApi(
            `${base}/history/${button.dataset.accountHistory}`,
            null,
            "GET",
          ),
          accountApi(base, null, "GET"),
        ]);
        accountState.conflict = archiveChoice(previous.snapshot, remote, {
          history: true,
          historySavedAt: previous.updatedAt,
        });
        renderDialog();
      } finally { submitting = false; }
      return;
    }
    const action = button.dataset.accountAction;
    if (action === "cancel-save") return dialog.close();
    if (action === "cancel-restore") {
      cancelHistory();
      mode = "history";
      renderDialog();
      return;
    }
    if (action === "history") {
      const result = await accountApi(
        `/profiles/${accountState.account.profileId}/abc/history`,
        null,
        "GET",
      );
      historyVersions = result.versions;
      mode = "history";
      renderDialog();
    }
    if (action === "sync") {
      submitting = true;
      button.disabled = true;
      try {
        const result = await syncArchive({ checkpoint: true });
        if (accountState.pending || accountState.conflict) {
          mode = "profile";
          renderDialog();
        } else if (result) {
          dialog.close();
          hubMessage(result.checkpointCreated ? "存档已保存" : "当前进度已有存档，无需重复保存");
        } else error(accountState.status);
      } finally {
        submitting = false;
        button.disabled = false;
      }
    }
    if (action === "logout") await leaveAccount();
  } catch (cause) {
    error(cause.message);
  }
}
document.addEventListener("click", async (event) => {
  const opener = event.target.closest("[data-account-open]");
  if (opener && !submitting)
    return open(opener.dataset.accountOpen || "profile");
  const button = event.target.closest("[data-account-command]");
  if (!button || submitting) return;
  submitting = true;
  button.disabled = true;
  const message = (text) => {
    const node = document.querySelector("[data-parent-account-message]");
    if (node) node.textContent = text;
  };
  try {
    if (button.dataset.accountCommand === "logout") return await leaveAccount();
    if (
      localAccount().owner !== accountState.account?.id
    ) {
      submitting = false;
      return await open("profile");
    }
    await open("save");
  } catch (cause) {
    message(cause.message);
  } finally {
    submitting = false;
    button.disabled = false;
  }
});
globalThis.addEventListener("garden-account-status", paintStatus);
setInterval(updateCooldown, 1000);
refreshAccount();
