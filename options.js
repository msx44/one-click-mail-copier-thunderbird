// 初期状態のデフォルトテンプレート
const defaultTemplate = "件名: {{subject}}\nDate: {{date}}\nFrom: {{from}}\n\n{{body}}";

// 利用可能なマクロタグの定義
const tags = [
  { name: "{{subject}}", desc: "件名" },
  { name: "{{date}}", desc: "送信日時" },
  { name: "{{from}}", desc: "送信者(From)" },
  { name: "{{to}}", desc: "宛先(To)" },
  { name: "{{cc}}", desc: "CC" },
  { name: "{{bcc}}", desc: "BCC" },
  { name: "{{id}}", desc: "メールID" },
  { name: "{{body}}", desc: "本文(テキスト)" }
];

document.addEventListener("DOMContentLoaded", async () => {
  const textarea = document.getElementById("templateFormat");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const tagContainer = document.getElementById("tagContainer");

  // タグボタンを安全に動生成
  tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = `${tag.name} [${tag.desc}]`;
    
    // クリック時にカーソル位置にタグを挿入する親切設計
    span.addEventListener("click", () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      textarea.value = text.substring(0, start) + tag.name + text.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.name.length;
    });
    tagContainer.appendChild(span);
  });

  // 保存されている設定を読み込み（なければデフォルト）
  const data = await messenger.storage.local.get({ template: defaultTemplate });
  textarea.value = data.template;

  // 設定を保存する
  saveBtn.addEventListener("click", async () => {
    await messenger.storage.local.set({ template: textarea.value });
    status.textContent = "設定を保存しました！";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});