// ==UserScript==
// @name         本地 OCR 自动填装 + 手动刷新
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  全自动扫描 监听手动刷新 重填
// @match        http://zhjw.scu.edu.cn/login
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function fireOCR(imgElement, inputElement) {
        if (!imgElement.complete || imgElement.naturalWidth === 0) return;

        var canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(imgElement, 0, 0);
        var base64Data = canvas.toDataURL("image/png").replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

        console.log("探测到新目标");

        GM_xmlhttpRequest({
            method: "POST",
            url: "http://127.0.0.1:8888/ocr",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data: "image=" + encodeURIComponent(base64Data),
            onload: function(response) {
                try {
                    let res = JSON.parse(response.responseText);
                    if (res.status === 'success') {
                        let finalCode = res.result.replace(/[^a-zA-Z0-9]/g, '');
                        inputElement.value = finalCode;
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        console.log("同步刷新结果: " + finalCode, "color: #00FF00; font-weight: bold;");
                    }
                } catch(e) { console.error("解析失败", e); }
            }
        });
    }

    function startWatcher() {
        let img = document.querySelector('#captchaImg');
        let input = document.querySelector('#input_checkcode');

        if (!img || !input) {
            setTimeout(startWatcher, 500);
            return;
        }

        if (img.complete) {
            fireOCR(img, input);
        } else {
            img.onload = () => fireOCR(img, input);
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    console.log("侦测到验证码手动刷新，重新识别");
                    setTimeout(() => fireOCR(img, input), 50);
                }
            });
        });

        observer.observe(img, { attributes: true });
        console.log("系统已就绪");
    }

    startWatcher();
})();