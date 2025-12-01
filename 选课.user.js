// ==UserScript==
// @name         Alan的抢课神器 (拟人防封版)
// @namespace    [http://tampermonkey.net/](http://tampermonkey.net/)
// @version      3.1
// @description  自动抢课脚本，加入随机延迟(Jitter)防止被判定为机器人，Liquid Glass UI
// @author       Alan
// @match        *://*/*student/*
// @match        *://*/*jwgl*/*
// @match        *://*/*xsxk*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================
    // 🚀 动态抢课控制台 (防检测拟人版 - Author: Alan)
    // =========================================================

    // --- 1. 初始化与状态管理 ---
    if (window.courseMonitorTimer) clearTimeout(window.courseMonitorTimer);
    window.isSelecting = false;
    window.monitorStatus = false;

    // 清理旧资源
    ["courseMonitorFloatBox", "courseMonitorLiquidStyle"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // --- CSS 样式 (Liquid Glass) ---
    const style = document.createElement('style');
    style.id = "courseMonitorLiquidStyle";
    style.innerHTML = `
        #courseMonitorFloatBox * { box-sizing: border-box; }
        #drag_header {
            text-align: center; color: #1a1a1a; cursor: move; user-select: none;
            font-size: 15px; font-weight: 700; padding-bottom: 12px; margin-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.4);
            box-shadow: 0 2px 4px rgba(255,255,255,0.3);
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }
        #courseMonitorFloatBox label { font-weight: 600; color: #333; font-size: 12px; text-align: right; padding-right: 10px; text-shadow: 0 1px 1px rgba(255,255,255,0.5); }
        #courseMonitorFloatBox .liquid-input {
            width: 100%; padding: 10px 12px; background: rgba(255, 255, 255, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.5) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.05), 0 1px 1px rgba(255,255,255,0.3) !important;
            border-radius: 14px; font-family: monospace; font-size: 13px; color: #222; outline: none; transition: all 0.3s ease;
        }
        #courseMonitorFloatBox .liquid-input:focus {
            background: rgba(255, 255, 255, 0.3) !important; border-color: rgba(255, 255, 255, 0.8) !important;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.02), 0 0 15px rgba(255,255,255,0.6) !important;
        }
        #log_area {
            width: 100%; height: 150px; overflow-y: auto; padding: 10px 12px;
            background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 14px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
            font-family: monospace; font-size: 12px; color: #222;
        }
        #courseMonitorFloatBox .c-btn {
            padding: 12px; border: none; border-radius: 16px; cursor: pointer; font-weight: 700; color: white; font-size: 13px;
            transition: all 0.2s ease; box-shadow: 0 10px 20px -10px rgba(0,0,0,0.3), inset 0 3px 5px rgba(255,255,255,0.7);
            backdrop-filter: blur(5px); text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        #courseMonitorFloatBox .c-btn:hover { transform: translateY(-2px); }
        #courseMonitorFloatBox .c-btn:active { transform: scale(0.98); }
        .btn-start { background-image: linear-gradient(145deg, #00d2ff 0%, #3a7bd5 100%); }
        .btn-stop { background-image: linear-gradient(145deg, #ff512f 0%, #dd2476 100%); }
        .btn-clear { background-image: linear-gradient(145deg, #8e9eab 0%, #eef2f3 100%); color: #555 !important; text-shadow: none !important; }
        #log_area::-webkit-scrollbar { width: 6px; }
        #log_area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 3px; }
        #footer_info {
            margin-top: 5px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);
            font-size: 10px; color: rgba(0, 0, 0, 0.5); display: flex; justify-content: space-between; align-items: center;
        }
        #footer_info:hover { color: rgba(0, 0, 0, 0.9); }
    `;
    document.head.appendChild(style);

    // --- UI 构建 ---
    const floatBox = document.createElement("div");
    floatBox.id = "courseMonitorFloatBox";
    Object.assign(floatBox.style, {
        position: "fixed", top: "30px", right: "30px", width: "360px",
        background: "linear-gradient(125deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 100%)",
        backdropFilter: "blur(40px) saturate(200%)", webkitBackdropFilter: "blur(40px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow: `0 25px 45px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.2)`,
        borderRadius: "24px", padding: "20px", zIndex: 99999,
        fontFamily: "-apple-system, BlinkMacSystemFont, Roboto, sans-serif", display: "flex", flexDirection: "column", gap: "14px"
    });
    document.body.appendChild(floatBox);

    floatBox.innerHTML = `
        <div id="drag_header">拟人化抢课台 <span>(拖动)</span></div>
        <div style="display:grid;grid-template-columns: 65px 1fr;gap:12px 10px;align-items:center;">
            <label>课程号</label> <input id="inp_kch" type="text" value="" placeholder="必填" class="liquid-input">
            <label>教师名</label> <input id="inp_teacher" type="text" value="" placeholder="选填" class="liquid-input">
            <label>周 / 节</label> <div style="display:flex;gap:8px;"><input id="inp_xq" type="text" class="liquid-input" style="text-align:center"><input id="inp_jc" type="text" class="liquid-input" style="text-align:center"></div>
            <label title="基础间隔，实际会有随机波动">基准ms</label> <input id="inp_interval" type="number" value="2000" class="liquid-input">
        </div>
        <div style="display:flex;gap:12px;margin-top:10px;">
            <button id="btn_toggle" class="c-btn btn-start" style="flex:2;">▶ 启动 (随机间隔)</button>
            <button id="btn_clear" class="c-btn btn-clear" style="flex:1;">清空</button>
        </div>
        <div id="log_area"></div>
        <div id="status_bar" style="font-size:11px;color:#444;text-align:center;font-weight:600;text-shadow:0 1px 1px rgba(255,255,255,0.5)">Ready</div>
        <div id="footer_info">
            <div style="font-weight:bold;color:#0056b3;">🛠️ Dev: Alan</div>
            <div>🛡️ 随机抖动已启用</div>
        </div>
    `;

    const el = {
        kch: document.getElementById('inp_kch'), teacher: document.getElementById('inp_teacher'),
        xq: document.getElementById('inp_xq'), jc: document.getElementById('inp_jc'),
        interval: document.getElementById('inp_interval'), btn: document.getElementById('btn_toggle'),
        log: document.getElementById('log_area'), clear: document.getElementById('btn_clear'),
        status: document.getElementById('status_bar'), header: document.getElementById('drag_header')
    };

    // --- 辅助功能 ---
    function log(msg, color = "#222") {
        const div = document.createElement("div");
        div.innerHTML = `<span style="color:#666;font-size:10px;">[${new Date().toLocaleTimeString()}]</span> <span style="color:${color};font-weight:600;text-shadow:0 1px 1px rgba(255,255,255,0.3)">${msg}</span>`;
        div.style.marginBottom = "4px"; el.log.prepend(div);
    }

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    function getRandomInterval() {
        const base = parseInt(el.interval.value) || 2000;
        const jitter = base * 0.2; 
        return Math.floor(base + (Math.random() * jitter * 2 - jitter));
    }

    // --- 业务逻辑 ---
    function findFajhhAutomagically(){try{const a=document.getElementById("zyxk");if(a){const c=a.getAttribute("onclick").match(/fajhh=([0-9]+)/);if(c&&c[1])return c[1]}const b=document.querySelector('input[name="fajhh"]')||document.querySelector("#fajhh_hdd");if(b&&b.value)return b.value}catch(d){}return null}
    async function verifySuccess(targetKch){try{const b=await fetch("/student/courseSelect/selectCourse/yxkcList",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"}});return(await b.text()).includes(targetKch)}catch(c){return!1}}

    async function selectCourse(course) {
        const token = document.getElementById("tokenValue")?.value;
        const fajhh = findFajhhAutomagically();
        if (!token || !fajhh) { log("❌ 参数缺失，无法选课", "#dc3545"); return; }
        log(`🚀 发现名额！立即提交: ${course.kcm}`, "#007aff");
        try {
            let kcmsValue = ""; const kcmsSource = `${course.kcm}_${course.kxh}`;
            for (let i = 0; i < kcmsSource.length; i++) kcmsValue += kcmsSource.charCodeAt(i) + ",";
            const params = new URLSearchParams({
                dealType: "5", kcIds: `${course.kch}_${course.kxh}_${course.zxjxjhh}`,
                kcms: kcmsValue, fajhh: fajhh, fj: "0", sj: `${course.skxq}_${course.skjc.split('-')[0]}`,
                kkxsh: course.kkxsh||"", kclbdm: course.kclbdm||"", inputCode: "undefined", tokenValue: token
            });
            const res = await fetch("/student/courseSelect/selectCourse/checkInputCodeAndSubmit", {
                method: "POST", body: params, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
            });
            const resultJson = await res.json();
            if (JSON.stringify(resultJson).includes("验证码") || resultJson.msg?.includes("验证码")) {
                log("⛔ 警告：需验证码！脚本已急停！", "red");
                try { new Audio("[https://xp.liujason.com/img/error.mp3](https://xp.liujason.com/img/error.mp3)").play(); } catch(e){}
                stopMonitor(); alert("系统提示需要验证码，请手动刷新页面输入！"); return;
            }
            await sleep(1500);
            if (await verifySuccess(course.kch)) {
                log(`🎉 抢课成功！${course.kcm}`, "#28a745");
                try { new Audio("[https://xp.liujason.com/img/win.mp3](https://xp.liujason.com/img/win.mp3)").play(); } catch(e){}
                stopMonitor(); alert(`抢到啦！${course.kcm}`);
            } else {
                log(`⚠️ 提交完成但未入选，继续监控...`, "#e67e22"); window.isSelecting = false;
            }
        } catch (err) { log(`❌ 提交异常: ${err.message}`, "red"); window.isSelecting = false; }
    }

    async function checkCoursesLoop() {
        if (!window.monitorStatus) return;
        const searchKch = el.kch.value.trim(); const searchTeacher = el.teacher.value.trim();
        try {
            const formData = new URLSearchParams({
                kkxsh: "", kch: searchKch, kcm: "", skjs: searchTeacher,
                xq: el.xq.value.trim() === "0" ? "" : el.xq.value.trim(),
                jc: el.jc.value.trim() === "0" ? "" : el.jc.value.trim(),
                kclbdm: "", vt: "", fj: "0"
            });
            const res = await fetch("/student/courseSelect/freeCourse/courseList", {
                method: "POST", body: formData, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
            });
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("json")) {
                log("⚠️ 响应异常(非JSON)，避险等待...", "red");
                window.courseMonitorTimer = setTimeout(checkCoursesLoop, getRandomInterval() + 3000); return;
            }
            const data = await res.json();
            const courses = data.rwRxkZlList || [];
            let found = false;
            for (const course of courses) {
                if (course.bkskyl > 0) {
                    found = true; log(`!!! 发现: ${course.kcm} 余${course.bkskyl}`, "#dc3545");
                    if (!window.isSelecting) { window.isSelecting = true; selectCourse(course); return; }
                }
            }
            if (!found) { el.status.innerText = `监控中... 下次刷新: ${getRandomInterval()}ms后`; }
        } catch (err) { log(`请求失败: ${err.message}`, "#aaa"); }
        if (window.monitorStatus && !window.isSelecting) {
            window.courseMonitorTimer = setTimeout(checkCoursesLoop, getRandomInterval());
        }
    }

    function startMonitor() {
        if (window.monitorStatus) return;
        if (!el.kch.value && !el.teacher.value) { alert("请至少输入课程号或教师名！"); return; }
        window.monitorStatus = true; window.isSelecting = false;
        el.btn.innerHTML = "⏹ 停止监控";
        el.btn.classList.remove('btn-start'); el.btn.classList.add('btn-stop');
        log("=== 🟢 监控已启动 ===", "#007aff");
        checkCoursesLoop();
    }

    function stopMonitor() {
        window.monitorStatus = false;
        if (window.courseMonitorTimer) clearTimeout(window.courseMonitorTimer);
        el.btn.innerHTML = "▶ 启动 (随机间隔)";
        el.btn.classList.remove('btn-stop'); el.btn.classList.add('btn-start');
        el.status.innerText = "已暂停"; log("=== 🔴 监控已停止 ===", "#888");
    }

    (function makeDraggable() {
        let isDragging = false; let startX, startY;
        el.header.addEventListener('mousedown', (e) => {
            isDragging = true; const rect = floatBox.getBoundingClientRect();
            startX = e.clientX - rect.left; startY = e.clientY - rect.top;
            floatBox.style.right = 'auto'; floatBox.style.bottom = 'auto';
            floatBox.style.left = rect.left + 'px'; floatBox.style.top = rect.top + 'px';
            el.header.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return; e.preventDefault();
            floatBox.style.left = (e.clientX - startX) + 'px'; floatBox.style.top = (e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; el.header.style.cursor = 'move'; });
    })();

    el.btn.onclick = () => { if (window.monitorStatus) stopMonitor(); else startMonitor(); };
    el.clear.onclick = () => { el.log.innerHTML = ""; };
    console.log("Anti-Bot Course Monitor Loaded.");

})();