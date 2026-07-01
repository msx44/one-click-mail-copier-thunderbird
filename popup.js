window.addEventListener("DOMContentLoaded", async () => {
  let debugInfo = {
    step: "開始",
    tabs: null,
    messageList: null,
    rawDate: null
  };

  try {
    // 1. アクティブなタブを取得
    debugInfo.step = "タブの取得中";
    let tabs = await messenger.tabs.query({ active: true, lastFocusedWindow: true });
    debugInfo.tabs = tabs;

    if (!tabs || tabs.length === 0) {
      showError(new Error("アクティブなタブが見つかりません"), debugInfo);
      return;
    }

    // 2. 表示中のメッセージリストを取得
    debugInfo.step = "メッセージリストの取得中";
    let messageList = await messenger.messageDisplay.getDisplayedMessages(tabs[0].id);
    debugInfo.messageList = messageList;

    // 3. メッセージの存在チェック
    debugInfo.step = "メッセージデータの検証中";
    if (!messageList || !messageList.messages || messageList.messages.length === 0) {
      showError(new Error("表示中のメールを特定できませんでした。メールを開いた状態でもう一度お試しください。"), debugInfo);
      return;
    }

    let message = messageList.messages[0];
    
    // 4. 各種メールデータの抽出（配列のデータはカンマ区切りの文字列に変換）
    debugInfo.step = "各種メールデータの抽出中";
    let subject = message.subject || "（件名なし）";
    let fromText = message.author || "";
    let toText = (message.recipients && message.recipients.length > 0) ? message.recipients.join(", ") : "";
    let ccText = (message.ccList && message.ccList.length > 0) ? message.ccList.join(", ") : "";
    let bccText = (message.bccList && message.bccList.length > 0) ? message.bccList.join(", ") : "";
    debugInfo.rawDate = message.date;

    // 5. 送信日時の整形
    debugInfo.step = "送信日時の整形中";
    let dateText = "（日時なし）";
    if (message.date) {
      try {
        dateText = new Date(message.date).toLocaleString("ja-JP", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
      } catch (e) {
        dateText = String(message.date);
      }
    }

    // 6. メッセージ本文の解析
    debugInfo.step = "メッセージ本文の解析中";
    let fullMessage = await messenger.messages.getFull(message.id);
    let body = extractTextBody(fullMessage);

    if (!body) {
      body = "（本文の取得に失敗したか、テキスト本文がありません）";
    }

    // 7. 設定画面からユーザーのカスタムテンプレートを読み込んで置換
    debugInfo.step = "テンプレートの適用中";
    const defaultTemplate = "件名: {{subject}}\nDate: {{date}}\nFrom: {{from}}\n\n{{body}}";
    const storageData = await messenger.storage.local.get({ template: defaultTemplate });
    let template = storageData.template;

    // 各マクロタグを、抽出した実際のデータに一斉置換（正規表現で全置換）
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
    debugInfo.step = "クリップボードへの書き込み中";
    await navigator.clipboard.writeText(textToCopy);

    // 9. 成功UI
    document.getElementById("status").style.color = "#2b8a3e";
    document.getElementById("status").innerText = "コピー成功！";
    setTimeout(() => {
      window.close();
    }, 800);

  } catch (err) {
    showError(err, debugInfo);
  }
});

/**
 * 【文字化け完全撲滅版】
 * メール構造から text/plain パートを掘り出し、Thunderbirdがデコードをサボっていたら強制復元する
 */
function extractTextBody(part) {
  if (!part) return null;

  if (part.contentType && part.contentType.toLowerCase().startsWith("text/plain")) {
    let body = part.body || "";
    
    // 1. メールパートから文字コード（charset）の指定を引っ張り出す
    let charset = "utf-8";
    const match = part.contentType.match(/charset=["']?([^"';\s]+)["']?/i);
    if (match) {
      charset = match[1].toLowerCase();
    }

    // 2. 【超重要】文字化けの「状態型」自動判定と救済
    if (body) {
      try {
        let hasExtendedAscii = false;
        let isRawBytes = true;
        const bytes = new Uint8Array(body.length);
        
        for (let i = 0; i < body.length; i++) {
          const code = body.charCodeAt(i);
          if (code > 255) {
            // 256以上の通常文字（正しい日本語など）が1文字でもあれば「化けていない」と判断
            isRawBytes = false;
            break;
          }
          if (code >= 128) {
            // 128〜255の文字（ã や æ などの化け文字の種）が含まれているかチェック
            hasExtendedAscii = true;
          }
          bytes[i] = code & 0xff;
        }

        // 「256以上の漢字やカナがなく、128以上の海外特殊文字が混ざっている」＝100%文字化け状態
        if (isRawBytes && hasExtendedAscii) {
          try {
            // まずはメール指定のcharset（基本はutf-8）で、生のバイトデータから厳密にデコードし直す
            const decoder = new TextDecoder(charset, { fatal: true });
            body = decoder.decode(bytes);
          } catch (e) {
            // 万が一、メール側の表記ミスで失敗した場合は、UTF-8として強制デコードを試みる（フォールバック）
            const utf8Decoder = new TextDecoder("utf-8");
            body = utf8Decoder.decode(bytes);
          }
        }
      } catch (err) {
        console.error("【文字化け救済】デコード処理でエラーが発生しました:", err);
      }
    }
    
    return body;
  }

  // 子パートが存在する場合は再帰的に探索
  if (part.parts && part.parts.length > 0) {
    for (let subPart of part.parts) {
      let body = extractTextBody(subPart);
      if (body !== null) return body;
    }
  }
  return null;
}

/**
 * 安全なエラー表示生成
 */
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
  titleDiv.textContent = "❌ エラーが発生しました";
  statusDiv.appendChild(titleDiv);
  
  let errMessage = err instanceof Error ? `${err.name}: ${err.message}\n\n[発生場所]\n${err.stack}` : String(err);
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
  debugTitle.textContent = "🔍 クラッシュ直前のステータス:";
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