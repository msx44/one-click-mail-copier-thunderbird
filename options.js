// 初期状態のデフォルトテンプレート
const defaultTemplate = "件名: {{subject}}\nDate: {{date}}\nFrom: {{from}}\n\n{{body}}";

// 利用可能なマクロタグの定義（説明文を多言語キーに変更）
const tags = [
  { name: "{{subject}}", descKey: "tagSubject" },
  { name: "{{date}}", descKey: "tagDate" },
  { name: "{{from}}", descKey: "tagFrom" },
  { name: "{{to}}", descKey: "tagTo" },
  { name: "{{cc}}", descKey: "tagCc" },
  { name: "{{bcc}}", descKey: "tagBcc" },
  { name: "{{id}}", descKey: "tagId" },
  { name: "{{body}}", descKey: "tagBody" }
];

document.addEventListener("DOMContentLoaded", async () => {
  const textarea = document.getElementById("templateFormat");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const tagContainer = document.getElementById("tagContainer");

  // HTML要素のテキストを多言語化
  document.getElementById("optionsTitle").textContent = messenger.i18n.getMessage("optionsTitle");
  document.getElementById("optionsDesc").textContent = messenger.i18n.getMessage("optionsDesc");
  textarea.placeholder = messenger.i18n.getMessage("optionsPlaceholder");
  saveBtn.textContent = messenger.i18n.getMessage("optionsSaveBtn");

  // タグボタンを安全に動生成
  tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    const localizedDesc = messenger.i18n.getMessage(tag.descKey);
    span.textContent = `${tag.name} [${localizedDesc}]`;
    
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
    status.textContent = messenger.i18n.getMessage("optionsSaved");
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});