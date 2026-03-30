// ==UserScript==
// @name         Universal_CAPTCHA_Filler
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  对接远程
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==
(function() {
    'use strict';

    const OCR_API_URL = 'https://ocr.wynn.dpdns.org/ocr';

    const SITE_RULES = [
        {
            host: 'example.com',
            imgSelector: '#captcha-image',
            inputSelector: 'input[name="captchaCode"]'
        },
    ];

    let targetImg = null;
    let targetInput = null;

    function findElements() {
        const currentHost = window.location.hostname;
        const rule = SITE_RULES.find(r => currentHost.includes(r.host));

        if (rule) {
            targetImg = document.querySelector(rule.imgSelector);
            targetInput = document.querySelector(rule.inputSelector);
        } else {
            const imgs = Array.from(document.querySelectorAll('img'));
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));

            targetImg = imgs.find(img =>
                (img.src && /(captcha|verify|vcode|code)/i.test(img.src)) ||
                (img.id && /(captcha|verify|vcode|code)/i.test(img.id))
            );

            targetInput = inputs.find(input =>
                (input.name && /(captcha|verify|vcode|code)/i.test(input.name)) ||
                (input.id && /(captcha|verify|vcode|code)/i.test(input.id)) ||
                (input.placeholder && /(验证码|校验码)/.test(input.placeholder))
            );
        }

        if (targetImg && targetInput) {
            console.log("准备执行识别");
            return true;
        }
        return false;
    }

    function getBase64Image(imgElement) {
        const canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;
        const ctx = canvas.getContext("2d");
        try {
            ctx.drawImage(imgElement, 0, 0);
            return canvas.toDataURL("image/png");
        } catch (e) {
            console.error("跨域图片污染 Canvas，导致转码失败:", e);
            return null;
        }
    }

    function processCaptcha() {
        if (!targetImg || !targetImg.complete || targetImg.naturalWidth === 0) {
            setTimeout(processCaptcha, 500);
            return;
        }

        const base64Data = getBase64Image(targetImg);
        if (!base64Data) {
            targetInput.value = "跨域受限，请看控制台";
            return;
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: OCR_API_URL,
            data: JSON.stringify({ image: base64Data }),
            headers: { "Content-Type": "application/json" },
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.code === 200 && res.result) {
                        targetInput.value = res.result;

                        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                        targetInput.dispatchEvent(new Event('change', { bubbles: true }));

                        console.log("成功填入:", res.result);
                    } else {
                        console.warn("识别失败:", res.error);
                    }
                } catch (e) {
                    console.error("接口返回数据解析失败", e);
                }
            },
            onerror: function(err) {
                console.error("服务器请求失败，请检查服务是否启动及端口是否开放", err);
            }
        });
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            if (findElements()) {
                processCaptcha();
                targetImg.addEventListener('click', () => {
                    targetInput.value = "识别中";
                    setTimeout(processCaptcha, 800);
                });
            }
        }, 1000);
    });
})();