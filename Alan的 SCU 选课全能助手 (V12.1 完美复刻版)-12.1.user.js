// ==UserScript==
// @name         Alan的 SCU 选课全能助手 (V12.1 完美复刻版)
// @namespace    http://tampermonkey.net/
// @version      12.1
// @description  独立并发探针 | 自动登录打码 | 完美复刻 V10.13 逻辑 | 统一本地 AI
// @author       Alan / WynnKai
// @match        http://zhjw.scu.edu.cn/login
// @match        http://zhjw.scu.edu.cn/student/courseSelect/courseSelect/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================
    // ⚙️ 核心配置：本地 AI 服务器
    // =========================================================
    const LOCAL_OCR_URL = "http://127.0.0.1:8888/ocr";

    // 通用 OCR 请求函数
    function callLocalAI(base64) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: LOCAL_OCR_URL,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                data: "image=" + encodeURIComponent(base64),
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.status === 'success') resolve(data.result.replace(/[^a-zA-Z0-9]/g, ''));
                        else resolve(null);
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    }

    // =========================================================
    // 🚪 登录页逻辑 (完全保留原版登录识别)
    // =========================================================
    function runLoginModule() {
        const fireLoginOCR = async (img, input) => {
            if (!img.complete || img.naturalWidth === 0) return;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            const base64 = canvas.toDataURL("image/png").replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

            const code = await callLocalAI(base64);
            if (code) {
                input.value = code;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                console.log("🎯 登录验证码已自动填充: " + code);
            }
        };

        const img = document.querySelector('#captchaImg');
        const input = document.querySelector('#input_checkcode');
        if (img && input) {
            const observer = new MutationObserver(() => setTimeout(() => fireLoginOCR(img, input), 50));
            observer.observe(img, { attributes: true, attributeFilter: ['src'] });
            if (img.complete) fireLoginOCR(img, input);
        }
    }

    // =========================================================
    // 🎯 选课页逻辑 (完全复刻 V10.13)
    // =========================================================
    function runCourseModule() {
        // --- 1. 样式注入 (原封不动) ---
        const style = document.createElement('style');
        style.innerHTML = `
            #courseMonitorFloatBox { backdrop-filter: blur(30px); position: fixed; top: 20px; right: 20px; width: 440px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; box-shadow: 0 25px 80px rgba(0,0,0,0.4); background: rgba(255, 255, 255, 0.22); border-radius: 30px; padding: 24px; z-index: 999999; border: 1px solid rgba(255,255,255,0.4); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; box-sizing: border-box; color: #1d1d1f; }
            .drag-header { cursor: move; font-weight: 900; text-align: center; margin-bottom: 18px; font-size: 18px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; color: #333; }
            .input-row { display: flex; gap: 10px; margin-bottom: 12px; }
            .liquid-input { background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 10px 14px; font-size: 13px; outline: none; flex: 1; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
            .liquid-input:focus { background: #fff; border-color: #007aff; box-shadow: 0 0 0 4px rgba(0,122,255,0.15); }
            .flex-kxh { flex: 0.35; text-align: center; font-weight: bold; color: #007aff; }
            .btn-group { display: flex; gap: 10px; margin-top: 5px; }
            .c-btn { flex: 1; padding: 12px; border: none; border-radius: 14px; cursor: pointer; font-weight: 800; color: white; font-size: 12px; transition: 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 4px; }
            .btn-add { background: linear-gradient(135deg, #34c759, #28cd41); box-shadow: 0 4px 12px rgba(52,199,89,0.25); }
            .btn-search { background: linear-gradient(135deg, #5856d6, #5e5ce6); box-shadow: 0 4px 12px rgba(88,86,214,0.25); }
            .btn-start { background: #007aff; width: 100%; margin-top: 15px; font-size: 15px; font-weight: 900; height: 48px; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,122,255,0.3); }
            .btn-stop { background: #ff3b30; width: 100%; margin-top: 15px; font-size: 15px; font-weight: 900; height: 48px; border-radius: 16px; }
            #search_result_panel { margin-top: 20px; padding: 14px; background: rgba(255, 255, 255, 0.92); border-radius: 20px; display: none; border: 2px solid #5856d6; max-height: 320px; overflow-y: auto; width: 100%; }
            .res-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 12px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; }
            .capacity-badge { display: inline-block; background: #f2f2f7; color: #1d1d1f; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; margin-top: 5px; }
            .time-tag { display: block; background: #f9f9fb; color: #444; padding: 8px 10px; border-radius: 10px; margin-top: 6px; font-size: 11px; line-height: 1.4; border-left: 4px solid #5856d6; }
            #task_list_container { max-height: 200px; overflow-y: auto; margin-top: 15px; background: rgba(0,0,0,0.04); border-radius: 20px; padding: 12px; }
            .task-item { display: flex; justify-content: space-between; padding: 14px 18px; margin-bottom: 10px; background: #fff; border-radius: 16px; font-size: 14px; align-items: center; cursor: grab; box-shadow: 0 4px 10px rgba(0,0,0,0.03); border: 2px solid transparent; transition: all 0.3s ease; }
            .grinding { border-color: #34c759; animation: AlanBreathe 1.5s infinite linear; }
            @keyframes AlanBreathe { 0% { box-shadow: 0 0 0px #34c759; } 50% { box-shadow: 0 0 15px #34c759; } 100% { box-shadow: 0 0 0px #34c759; } }
            #log_area { height: 95px; overflow-y: auto; margin-top: 15px; font-size: 11px; color: #333; background: rgba(255,255,255,0.45); border-radius: 14px; padding: 10px; line-height: 1.5; }
            .alan-footer { margin-top: 22px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 15px; text-align: center; font-size: 10px; color: #999; }
        `;
        document.head.appendChild(style);

        // --- 2. 核心状态与变量 (复刻 V10.13) ---
        window.monitorStatus = false;
        window.globalFireLock = false;
        window.probeTimers = {};
        window.forceOcr = false;
        window.isCaptchaRequired = false;
        window.taskList = JSON.parse(localStorage.getItem('alan_course_tasks') || '[]');

        const log = (m, t="normal") => {
            const colors = { success: "#28cd41", error: "#ff3b30", dim: "#888", normal: "#1d1d1f" };
            const a = document.getElementById('log_area');
            if (a) {
                const d = document.createElement("div");
                d.innerHTML = `<span style="color:#aaa;font-size:10px;">${new Date().toLocaleTimeString()}</span> <span style="color:${colors[t]};font-weight:bold">${m}</span>`;
                a.appendChild(d); a.scrollTop = a.scrollHeight;
            }
        };

        const saveTasks = () => localStorage.setItem('alan_course_tasks', JSON.stringify(window.taskList));

        window.isKxhMatch = (a, b) => {
            const clean = (v) => String(v || '').trim().replace(/^0+/, '') || '0';
            return clean(a) === clean(b);
        };

        const findFajhh = () => {
            try {
                const zyxk = document.getElementById("zyxk");
                return zyxk ? zyxk.getAttribute("onclick").match(/fajhh=([0-9]+)/)[1] : (document.querySelector('input[name="fajhh"]')?.value || document.querySelector("#fajhh_hdd")?.value);
            } catch(e) { return null; }
        };

        // --- 3. 结果轮询 (复刻 V10.13 的 12 次重试机制) ---
        async function pollForResult(redisKey, taskName) {
            await new Promise(r => setTimeout(r, 600));
            for (let i = 0; i < 12; i++) {
                try {
                    const res = await fetch("/student/courseSelect/selectResult/query", {
                        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
                        body: `kcNum=1&redisKey=${redisKey}`
                    });
                    const data = await res.json();
                    const serverMsg = (data.result && data.result[1]) ? data.result[1] : (data.message || "");
                    if (serverMsg.includes("选课成功") || data.success === true) return { status: 'SUCCESS' };
                    if (data.isFinish === true || (data.success === false && !serverMsg.includes("处理中"))) {
                        const fatalKeywords = ["冲突", "对不起", "院系", "限制", "不满足"];
                        if (fatalKeywords.some(k => serverMsg.includes(k))) return { status: 'FATAL', msg: serverMsg };
                        return { status: 'FAIL', msg: serverMsg || "名额已满" };
                    }
                } catch (e) {}
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 300));
            }
            return { status: 'TIMEOUT', msg: '确认超时' };
        }

        // --- 4. 抢课执行 (对接本地 OCR) ---
        async function getCourseVcode() {
            try {
                const vcodeUrl = `/student/courseSelect/selectCourse/getYzmPic?time=${new Date().getTime()}`;
                const imgRes = await fetch(vcodeUrl, { credentials: "include" });
                const blob = await imgRes.blob();
                const base64 = await new Promise(r => {
                    const reader = new FileReader();
                    reader.onloadend = () => r(reader.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
                return await callLocalAI(base64);
            } catch (e) { return null; }
        }

        async function selectCourse(task, courseData, isRetry = false) {
            const tokenEl = document.getElementById("tokenValue");
            const fajhhValue = findFajhh();
            if (!tokenEl || !fajhhValue) return false;

            let vcode = document.getElementById('inp_vcode').value.trim();
            if (window.forceOcr || window.isCaptchaRequired || !vcode) {
                vcode = await getCourseVcode();
                if (!vcode || vcode.length !== 4) { log(`[${task.name}] 识别异常，重试...`, "dim"); return false; }
            }

            // V10.13 特有的 kcms 字符编码逻辑
            const kcmsSrc = `${courseData.kcm}_${courseData.kxh}`;
            let kcmsValue = ""; for (let i = 0; i < kcmsSrc.length; i++) kcmsValue += kcmsSrc.charCodeAt(i) + ",";

            const params = new URLSearchParams({
                dealType: "5", kcIds: `${courseData.kch}_${courseData.kxh}_${courseData.zxjxjhh || ""}`,
                kcms: kcmsValue, fajhh: fajhhValue, fj: "0", sj: `${courseData.skxq || ""}_${courseData.skjc ? String(courseData.skjc).split('-')[0] : ""}`,
                kkxsh: courseData.kkxsh || "", kclbdm: courseData.kclbdm || "",
                inputCode: vcode, tokenValue: tokenEl.value
            });

            try {
                const res = await fetch("/student/courseSelect/selectCourse/checkInputCodeAndSubmit", {
                    method: "POST", body: params, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
                });
                const submitJson = await res.json();
                if (submitJson.token) tokenEl.value = submitJson.token;

                if (submitJson.result && submitJson.result.includes("验证码校验失败")) {
                    window.isCaptchaRequired = true;
                    log(`⚠️ 验证码错误，自动重试...`, "error");
                    return isRetry ? false : await selectCourse(task, courseData, true);
                }

                if (submitJson.result === "ok" && submitJson.redisKey) {
                    const result = await pollForResult(submitJson.redisKey, task.name);
                    let target = window.taskList.find(t => t.id === task.id);
                    if (!target) return false;

                    if (result.status === 'SUCCESS' || (result.msg && result.msg.includes("已选"))) {
                        log(`🎉 拿下: ${task.name}`, "success");
                        target.success = true; saveTasks(); renderList(); checkAutoStop(); return true;
                    } else if (result.status === 'FATAL') {
                        log(`🛑 [${task.name}] 限制: ${result.msg}`, "error");
                        target.failed = true; target.errMsg = result.msg; saveTasks(); renderList(); checkAutoStop(); return false;
                    } else {
                        log(`[${task.name}] 失败: ${result.msg}`, "error"); return false;
                    }
                } else {
                    log(`[${task.name}] 提交失败: ${submitJson.message || "未知"}`, "error");
                }
            } catch (err) { log(`❌ 网络错误`, "error"); }
            return false;
        }

        // --- 5. 探针与巡检 (复刻 V10.13 逻辑) ---
        async function independentProbe(task) {
            if (!window.monitorStatus) return;
            const currentTask = window.taskList.find(t => t.id === task.id);
            if (!currentTask || currentTask.failed || currentTask.success) return;

            if (window.globalFireLock) {
                window.probeTimers[task.id] = setTimeout(() => independentProbe(task), 500);
                return;
            }

            try {
                const fd = new URLSearchParams({ kkxsh: "", kch: task.kch, kcm: "", skjs: "", xq: "0", jc: "0", kclbdm: "", vt: "", fj: "0" });
                const res = await fetch("/student/courseSelect/freeCourse/courseList", {
                    method: "POST", body: fd, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
                });
                const data = await res.json();
                const tar = (data.rwRxkZlList || []).find(x => window.isKxhMatch(x.kxh, task.kxh) && x.bkskyl > 0);

                if (tar && !window.globalFireLock) {
                    window.globalFireLock = true;
                    log(`[${task.name}] 💥 发现余量！`, "success");
                    await selectCourse(task, tar);
                    window.globalFireLock = false;
                }
            } catch (e) {}

            if (window.monitorStatus) {
                window.probeTimers[task.id] = setTimeout(() => independentProbe(task), 800 + Math.random() * 400);
            }
        }

        function checkAutoStop() {
            if (!window.monitorStatus) return;
            const active = window.taskList.filter(t => !t.success && !t.failed);
            if (active.length === 0) { log("🏁 任务全部结束，自动关机。", "success"); stopMonitor(); }
        }

        const stopMonitor = () => {
            window.monitorStatus = false; window.globalFireLock = true;
            for (let id in window.probeTimers) { clearTimeout(window.probeTimers[id]); }
            const btn = document.getElementById('btn_toggle');
            btn.innerText = "▶ 开始全速抢课"; btn.className = "c-btn btn-start";
            renderList(); log("⏹ 已安全停机。", "dim");
        };

        const startMonitor = () => {
            const active = window.taskList.filter(t => !t.success && !t.failed);
            if (active.length === 0) { alert("没有可运行的任务！"); return; }
            window.monitorStatus = true; window.globalFireLock = false;
            const btn = document.getElementById('btn_toggle');
            btn.innerText = "⏹ 停止硬磕 (双擎智控中)"; btn.className = "c-btn btn-stop";
            renderList(); log("🚀 启动独立并发引擎...", "success");
            window.taskList.forEach(t => { if(!t.success && !t.failed) independentProbe(t); });
        };

        // --- 6. UI 构建 (复刻 V10.13) ---
        const renderList = () => {
            const c = document.getElementById('task_list_container');
            c.innerHTML = window.taskList.length === 0 ? '<div style="text-align:center; padding:30px; color:#999; font-size:12px;">待抢任务列表 (空)</div>' : '';
            window.taskList.forEach((t, i) => {
                const div = document.createElement('div');
                const isGrinding = window.monitorStatus && !t.failed && !t.success;
                div.className = `task-item ${isGrinding ? 'grinding' : ''} ${t.failed?'task-failed':''} ${t.success?'task-success':''}`;
                div.innerHTML = `
                    <div style="${t.failed?'color:#ff3b30':t.success?'color:#28cd41':''}">
                        <b>${t.name}</b><br><small>${t.kch} | 序:${t.kxh}</small>
                        ${t.failed?`<br><span style="font-size:10px;">🛑 ${t.errMsg||'阵亡'}</span>`:t.success?'<br><span style="font-size:10px;">🎉 已拿下</span>':''}
                    </div>
                    <button style="border:none;background:none;color:#ff3b30;cursor:pointer;font-size:18px;" onclick="window.removeAlanTask('${t.id}')">✖</button>
                `;
                div.draggable = true;
                div.ondragstart = (e) => { window.draggedIndex = i; div.style.opacity = '0.4'; };
                div.ondragover = (e) => e.preventDefault();
                div.ondrop = (e) => {
                    const moved = window.taskList.splice(window.draggedIndex, 1)[0];
                    window.taskList.splice(i, 0, moved); saveTasks(); renderList();
                };
                c.appendChild(div);
            });
        };

        // UI 拼接
        const box = document.createElement("div"); box.id = "courseMonitorFloatBox"; document.body.appendChild(box);
        box.innerHTML = `
            <div class="drag-header" id="alan_drag">SCU 选课 V12.1 (完美复刻版)</div>
            <div class="input-row"><input id="inp_kch" class="liquid-input" placeholder="课程号"><input id="inp_kxh" class="liquid-input flex-kxh" placeholder="课序"></div>
            <div class="input-row"><input id="inp_name" class="liquid-input" placeholder="任务备注名"><input id="inp_vcode" class="liquid-input" placeholder="手动码(可选)" style="color:#ff3b30"></div>
            <div style="font-size:12px; color:#666; margin-bottom:12px; padding-left:5px;">
                <label style="cursor:pointer;"><input type="checkbox" id="chk_force_ocr" style="margin-right:5px;"> 强制 AI 视觉打码</label>
            </div>
            <div class="btn-group">
                <button id="btn_add" class="c-btn btn-add">🚀 智能入队</button>
                <button id="btn_search" class="c-btn btn-search">🔍 深度查询</button>
            </div>
            <div id="search_result_panel"></div>
            <div id="task_list_container"></div>
            <div id="log_area"></div>
            <button id="btn_toggle" class="c-btn btn-start">▶ 开始全速抢课</button>
            <div class="alan-footer">dev: WynnKai | 本脚本仅供学习交流</div>
        `;

        // 事件绑定
        document.getElementById('chk_force_ocr').onchange = (e) => window.forceOcr = e.target.checked;
        document.getElementById('btn_toggle').onclick = () => window.monitorStatus ? stopMonitor() : startMonitor();

        // 搜索与添加逻辑
        const runSearch = async () => {
            const kch = document.getElementById('inp_kch').value.trim();
            const kcm = document.getElementById('inp_name').value.trim();
            if(!kch && !kcm) return;
            log("正在搜索课程...", "dim");
            try {
                const fd = new URLSearchParams({ kkxsh:"", kch:kch, kcm:kcm, skjs:"", xq:"0", jc:"0", kclbdm:"", vt:"", fj:"0" });
                const res = await fetch("/student/courseSelect/freeCourse/courseList", { method:"POST", body:fd, headers:{"X-Requested-With":"XMLHttpRequest"} });
                const data = await res.json();
                const list = data.rwRxkZlList || [];
                const panel = document.getElementById('search_result_panel');
                panel.style.display = "block";
                panel.innerHTML = list.length ? list.map(c => `
                    <div class="res-card" ondblclick="window.quickAdd('${c.kch}','${c.kxh}','${c.kcm}')">
                        <b>${c.kcm}</b> [${c.kxh}]<br>
                        <small>教师: ${c.skjs||'未知'} | 余量: <span style="color:red">${c.bkskyl}</span></small>
                    </div>
                `).join('') : "未找到课程";
            } catch(e) { log("搜索异常", "error"); }
        };

        document.getElementById('btn_search').onclick = runSearch;
        document.getElementById('btn_add').onclick = () => {
            const kch = document.getElementById('inp_kch').value.trim();
            const kxh = document.getElementById('inp_kxh').value.trim();
            const name = document.getElementById('inp_name').value.trim();
            if(kch && kxh) window.quickAdd(kch, kxh, name || kch);
        };

        window.quickAdd = (kch, kxh, name) => {
            let finalKxh = String(kxh).trim().padStart(2, '0');
            if(window.taskList.some(t => t.kch === kch && t.kxh === finalKxh)) return;
            window.taskList.push({ id: Date.now(), name, kch, kxh: finalKxh });
            saveTasks(); renderList(); log(`✅ 已加入: ${name}`, "success");
        };

        window.removeAlanTask = (id) => {
            window.taskList = window.taskList.filter(t => String(t.id) !== String(id));
            saveTasks(); renderList(); checkAutoStop();
        };

        // 拖拽窗口逻辑
        const dh = document.getElementById('alan_drag');
        let isD = false, offset = [0,0];
        dh.onmousedown = (e) => { isD = true; offset = [box.offsetLeft - e.clientX, box.offsetTop - e.clientY]; };
        document.onmousemove = (e) => { if(isD) { box.style.left = (e.clientX + offset[0])+'px'; box.style.top = (e.clientY + offset[1])+'px'; box.style.right = 'auto'; } };
        document.onmouseup = () => isD = false;

        renderList();
    }

    // =========================================================
    // 🚦 环境分发器
    // =========================================================
    if (location.pathname.includes("login")) runLoginModule();
    else if (location.pathname.includes("courseSelect")) setTimeout(runCourseModule, 500);

})();