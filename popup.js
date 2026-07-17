window.addEventListener("DOMContentLoaded", async () => {
  let debugInfo = {
    step: "Start",
    tabs: null,
    messageList: null,
    rawDate: null
  };

  // 「コピー中...」を初期表示
  document.getElementById("status").textContent = messenger.i18n.getMessage("popupCopying");

  try {
    // 1. アクティブなタブを取得
    debugInfo.step = "Getting active tab";
    let tabs = await messenger.tabs.query({ active: true, lastFocusedWindow: true });
    debugInfo.tabs = tabs;

    if (!tabs || tabs.length === 0) {
      showError(new Error("Active tab not found"), debugInfo);
      return;
    }

    // 2. 表示中のメッセージリストを取得
    debugInfo.step = "Getting message list";
    let messageList = await messenger.messageDisplay.getDisplayedMessages(tabs[0].id);
    debugInfo.messageList = messageList;

    // 3. メッセージの存在チェック
    debugInfo.step = "Validating message data";
    if (!messageList || !messageList.messages || messageList.messages.length === 0) {
      showError(new Error("Cannot identify the displayed email. Please try again with an email open."), debugInfo);
      return;
    }

    let message = messageList.messages[0];
    
    // 4. 各種メールデータの抽出
    debugInfo.step = "Extracting mail data";
    let subject = message.subject || messenger.i18n.getMessage("noSubject");
    let fromText = message.author || "";
    let toText = (message.recipients && message.recipients.length > 0) ? message.recipients.join(", ") : "";
    let ccText = (message.ccList && message.ccList.length > 0) ? message.ccList.join(", ") : "";
    let bccText = (message.bccList && message.bccList.length > 0) ? message.bccList.join(", ") : "";
    debugInfo.rawDate = message.date;

    // 5. 送信日時の整形（システムのデフォルトロケールを使用）
    debugInfo.step = "Formatting date";
    let dateText = messenger.i18n.getMessage("noDate");
    if (message.date) {
      try {
        dateText = new Date(message.date).toLocaleString([], {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
      } catch (e) {
        dateText = String(message.date);
      }
    }

    // 6. メッセージ本文の解析
    debugInfo.step = "Parsing message body";
    let fullMessage = await messenger.messages.getFull(message.id);
    let body = extractTextBody(fullMessage);

    if (!body) {
      body = messenger.i18n.getMessage("noBody");
    }

    // 7. 設定画面からユーザーのカスタムテンプレートを読み込んで置換
    debugInfo.step = "Applying template";
    const defaultTemplate = "件名: {{subject}}\nDate: {{date}}\nFrom: {{from}}\n\n{{body}}";
    const storageData = await messenger.storage.local.get({ template: defaultTemplate });
    let template = storageData.template;

    let textToCopy = template
      .replace(/{{subject}}/g, subject)
      .replace(/{{date}}/g, dateText)
      .replace(/{{from}}/g, fromText)
      .replace(/{{to}}/g, toText)
      .replace(/{{cc}}/g, ccText)
      .replace(/{{bcc}}/g, bccText)
      .replace(/{{id}}/g, String(message.id))
      .replace(/{{body}}/g, body);

    // 8. クリップボードへの書き込み
    debugInfo.step = "Writing to clipboard";
    await navigator.clipboard.writeText(textToCopy);

    // 9. 成功UI
    document.getElementById("status").style.color = "#2b8a3e";
    document.getElementById("status").innerText = messenger.i18n.getMessage("popupSuccess");
    setTimeout(() => {
      window.close();
    }, 800);

  } catch (err) {
    showError(err, debugInfo);
  }
});

function extractTextBody(part) {
  if (!part) return null;

  if (part.contentType && part.contentType.toLowerCase().startsWith("text/plain")) {
    let body = part.body || "";
    
    let charset = "utf-8";
    const match = part.contentType.match(/charset=["']?([^"';\s]+)["']?/i);
    if (match) {
      charset = match[1].toLowerCase();
    }

    if (body) {
      try {
        let hasExtendedAscii = false;
        let isRawBytes = true;
        const bytes = new Uint8Array(body.length);
        
        for (let i = 0; i < body.length; i++) {
          const code = body.charCodeAt(i);
          if (code > 255) {
            isRawBytes = false;
            break;
          }
          if (code >= 128) {
            hasExtendedAscii = true;
          }
          bytes[i] = code & 0xff;
        }

        if (isRawBytes && hasExtendedAscii) {
          try {
            const decoder = new TextDecoder(charset, { fatal: true });
            body = decoder.decode(bytes);
          } catch (e) {
            const utf8Decoder = new TextDecoder("utf-8");
            body = utf8Decoder.decode(bytes);
          }
        }
      } catch (err) {
        console.error("【Error in Charset Decode】:", err);
      }
    }
    
    return body;
  }

  if (part.parts && part.parts.length > 0) {
    for (let subPart of part.parts) {
      let body = extractTextBody(subPart);
      if (body !== null) return body;
    }
  }
  return null;
}

function showError(err, debugInfo) {
  document.body.style.width = "450px";
  document.body.style.textAlign = "left";
  document.body.style.padding = "15px";
  
  let statusDiv = document.getElementById("status");
  statusDiv.style.color = "#e03131";
  statusDiv.textContent = "";

  let titleDiv = document.createElement("div");
  titleDiv.style.fontWeight = "bold";
  titleDiv.style.fontSize = "14px";
  titleDiv.style.marginBottom = "8px";
  titleDiv.textContent = messenger.i18n.getMessage("errorTitle");
  statusDiv.appendChild(titleDiv);
  
  let errMessage = err instanceof Error ? `${err.name}: ${err.message}\n\n[${messenger.i18n.getMessage("errorLocation")}]\n${err.stack}` : String(err);
  let errPre = document.createElement("pre");
  errPre.style.background = "#fff5f5";
  errPre.style.padding = "8px";
  errPre.style.border = "1px solid #ffe3e3";
  errPre.style.fontSize = "11px";
  errPre.style.fontFamily = "monospace";
  errPre.style.overflowX = "auto";
  errPre.style.whiteSpace = "pre-wrap";
  errPre.style.wordBreak = "break-all";
  errPre.textContent = errMessage;
  statusDiv.appendChild(errPre);
  
  let debugTitle = document.createElement("div");
  debugTitle.style.fontWeight = "bold";
  debugTitle.style.fontSize = "12px";
  debugTitle.style.marginTop = "15px";
  debugTitle.style.marginBottom = "5px";
  debugTitle.style.color = "#495057";
  debugTitle.textContent = messenger.i18n.getMessage("errorDebugTitle");
  statusDiv.appendChild(debugTitle);
  
  let debugPre = document.createElement("pre");
  debugPre.style.background = "#f8f9fa";
  debugPre.style.padding = "8px";
  debugPre.style.border = "1px solid #e9ecef";
  debugPre.style.fontSize = "11px";
  debugPre.style.fontFamily = "monospace";
  debugPre.style.overflowX = "auto";
  debugPre.textContent = JSON.stringify(debugInfo, null, 2);
  statusDiv.appendChild(debugPre);
}