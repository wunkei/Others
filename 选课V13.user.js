// ==UserScript==
// @name         Alan的选课实验 (V11.0 自建OCR内网直连版)
// @namespace    http://tampermonkey.net/
// @version      11.0
// @description  独立并发探针 | 动态AI唤醒机制 | 双模式控制面板 | 彻底防诈尸 | 整合自建内网穿透OCR
// @author       Wynn
// @match        http://zhjw.scu.edu.cn/student/courseSelect/courseSelect/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      ocr.wynn.dpdns.org
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 替换为你的专属内网穿透 OCR 接口
    const OCR_API_URL = 'https://ocr.wynn.dpdns.org/ocr';

    window.monitorStatus = false;
    window.globalFireLock = false;
    window.probeTimers = {};

    window.forceOcr = false;     
    window.isCaptchaRequired = false;

    window.taskList = JSON.parse(localStorage.getItem('alan_course_tasks') || '[]');
    let draggedItemIndex = null;

    window.isKxhMatch = (a, b) => {
        const clean = (v) => {
            let str = String(v || '').trim();
            return /^0+\d+$/.test(str) ? str.replace(/^0+/, '') : (str || '0');
        };
        return clean(a) === clean(b);
    };

    const clearUI = () => {
        ["courseMonitorFloatBox", "courseMonitorLiquidStyle"].forEach(id => {
            const el = document.getElementById(id); if (el) el.remove();
        });
    };
    clearUI();

    const style = document.createElement('style');
    style.id = "courseMonitorLiquidStyle";
    style.innerHTML = `
        #courseMonitorFloatBox { backdrop-filter: blur(30px); position: fixed; top: 20px; right: 20px; width: 440px; max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; box-shadow: 0 25px 80px rgba(0,0,0,0.4); background: rgba(255, 255, 255, 0.22); border-radius: 30px; padding: 24px; z-index: 999999; border: 1px solid rgba(255,255,255,0.4); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; box-sizing: border-box; color: #1d1d1f; }
        #courseMonitorFloatBox * { box-sizing: border-box; }
        .drag-header { cursor: move; font-weight: 900; text-align: center; margin-bottom: 18px; font-size: 18px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; color: #333; }
        .input-row { display: flex; gap: 10px; margin-bottom: 12px; }
        .liquid-input { background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 10px 14px; font-size: 13px; outline: none; flex: 1; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .liquid-input:focus { background: #fff; border-color: #007aff; box-shadow: 0 0 0 4px rgba(0,122,255,0.15); }
        .flex-kxh { flex: 0.35; text-align: center; font-weight: bold; color: #007aff; }
        .btn-group { display: flex; gap: 10px; margin-top: 5px; }
        .c-btn { flex: 1; padding: 12px; border: none; border-radius: 14px; cursor: pointer; font-weight: 800; color: white; font-size: 12px; transition: 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .c-btn:active { transform: scale(0.96); opacity: 0.9; }
        .btn-add { background: linear-gradient(135deg, #34c759, #28cd41); box-shadow: 0 4px 12px rgba(52,199,89,0.25); }
        .btn-search { background: linear-gradient(135deg, #5856d6, #5e5ce6); box-shadow: 0 4px 12px rgba(88,86,214,0.25); }
        .btn-start { background: #007aff; width: 100%; margin-top: 15px; font-size: 15px; font-weight: 900; height: 48px; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,122,255,0.3); }
        .btn-stop { background: #ff3b30; width: 100%; margin-top: 15px; font-size: 15px; font-weight: 900; height: 48px; border-radius: 16px; }
        #search_result_panel { margin-top: 20px; padding: 14px; background: rgba(255, 255, 255, 0.92); border-radius: 20px; display: none; border: 2px solid #5856d6; max-height: 320px; overflow-y: auto; width: 100%; }
        .res-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 14px; padding: 12px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; }
        .res-card:hover { border-color: #5856d6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .res-card b { color: #111; font-size: 14px; }
        .capacity-badge { display: inline-block; background: #f2f2f7; color: #1d1d1f; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; margin-top: 5px; }
        .cap-highlight { color: #ff3b30; font-weight: 900; }
        .time-tag { display: block; background: #f9f9fb; color: #444; padding: 8px 10px; border-radius: 10px; margin-top: 6px; font-size: 11px; line-height: 1.4; border-left: 4px solid #5856d6; }
        #task_list_container { max-height: 200px; overflow-y: auto; margin-top: 15px; background: rgba(0,0,0,0.04); border-radius: 20px; padding: 12px; }
        .task-item { display: flex; justify-content: space-between; padding: 14px 18px; margin-bottom: 10px; background: #fff; border-radius: 16px; font-size: 14px; align-items: center; cursor: grab; box-shadow: 0 4px 10px rgba(0,0,0,0.03); border: 1px solid transparent; }
        .task-item:hover { border-color: #007aff; }
        .task-item.dragging { opacity: 0.3; transform: scale(0.98); }
        #log_area { height: 95px; overflow-y: auto; margin-top: 15px; font-size: 11px; color: #333; background: rgba(255,255,255,0.45); border-radius: 14px; padding: 10px; line-height: 1.5; }
        .grinding { border: 2px solid #34c759; animation: breathe 1.5s infinite linear; }
        @keyframes breathe { 0% { box-shadow: 0 0 0px #34c759; } 50% { box-shadow: 0 0 15px #34c759; } 100% { box-shadow: 0 0 0px #34c759; } }
        .alan-footer { margin-top: 22px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 15px; text-align: center; }
        .dev-tag { font-size: 13px; color: #5856d6; font-weight: 800; text-decoration: none; }
        .disclaimer { font-size: 10px; color: #999; margin-top: 8px; line-height: 1.4; padding: 0 10px; }
    `;
    document.head.appendChild(style);

    // 核心更新：对接自建内网穿透 OCR
    async function getAutoVcode() {
        try {
            // 获取 SCU 的验证码图片
            const vcodeUrl = `/student/courseSelect/selectCourse/getYzmPic?time=${new Date().getTime()}`;
            const imgRes = await fetch(vcodeUrl, { credentials: "include" });
            const blob = await imgRes.blob();

            // 转换为 Base64 (包含 data URI prefix)
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            // 向本地 Cloudflare 隧道服务器发送请求
            return await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: OCR_API_URL,
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify({ image: base64 }),
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data.code === 200 && data.result) {
                                // 清理非字母数字字符
                                let code = data.result.replace(/[^a-zA-Z0-9]/g, '');

                                if (code.length === 4) {
                                    log(`自建 OCR 破译成功：[${code}]`, "success");
                                    resolve(code);
                                } else {
                                    log(`自建 OCR 识别位数异常 [${code}]，丢弃重试...`, "error");
                                    resolve("undefined");
                                }
                            } else {
                                log("自建 OCR 接口返回失败状态", "error");
                                resolve("undefined");
                            }
                        } catch (e) {
                            log("自建 OCR 数据解析失败", "error");
                            resolve("undefined");
                        }
                    },
                    onerror: () => {
                        log("服务器请求失败，请检查自建服务及隧道连接", "error");
                        resolve("undefined");
                    }
                });
            });
        } catch (e) {
            log(" 自建 OCR 抓取链路异常: " + e.message, "error");
            return "undefined";
        }
    }

    async function pollForResult(redisKey, taskName) {
        await new Promise(r => setTimeout(r, 600));
        const maxAttempts = 12;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const res = await fetch("/student/courseSelect/selectResult/query", {
                    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
                    body: `kcNum=1&redisKey=${redisKey}`
                });
                const data = await res.json();
                const serverMsg = (data.result && data.result[1]) ? data.result[1] : (data.message || "");
                const errorContent = serverMsg.includes(":") ? serverMsg.split(":")[1] : serverMsg;
                if (serverMsg.includes("选课成功") || data.success === true) return { status: 'SUCCESS' };
                if (data.isFinish === true || (data.success === false && !serverMsg.includes("处理中"))) {
                    const fatalKeywords = ["冲突", "对不起", "院系", "限制", "不满足"];
                    if (fatalKeywords.some(k => errorContent.includes(k))) return { status: 'FATAL', msg: errorContent };
                    return { status: 'FAIL', msg: errorContent || "名额已满" };
                }
                log(`[${taskName}] 等待队列反馈 (${i+1})...`, "dim");
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 300));
        }
        return { status: 'TIMEOUT', msg: '确认超时' };
    }

    async function selectCourse(task, courseData, isRetry = false) {
        const tokenEl = document.getElementById("tokenValue");
        const fajhh = findFajhhAutomagically();
        if (!tokenEl || !fajhh) return false;

        try {
            let needOcrNow = window.forceOcr || window.isCaptchaRequired;
            let finalVcode = document.getElementById('inp_vcode').value.trim() || "undefined";

            if (needOcrNow) {
                finalVcode = await getAutoVcode();

                if (finalVcode === "undefined" || finalVcode.length !== 4) {
                    log(`[${task.name}] 验证码残缺，放弃`, "dim");
                    return false;
                }
            }

            const kcmsSrc = `${courseData.kcm}_${courseData.kxh}`;
            let kcmsValue = ""; for (let i = 0; i < kcmsSrc.length; i++) kcmsValue += kcmsSrc.charCodeAt(i) + ",";

            const safeZxjxjhh = courseData.zxjxjhh || "";
            const safeSkxq = courseData.skxq || "";
            const safeSkjc = courseData.skjc ? String(courseData.skjc).split('-')[0] : "";

            const params = new URLSearchParams({
                dealType: "5",
                kcIds: `${courseData.kch}_${courseData.kxh}_${safeZxjxjhh}`,
                kcms: kcmsValue,
                fajhh: fajhh,
                fj: "0",
                sj: `${safeSkxq}_${safeSkjc}`,
                kkxsh: courseData.kkxsh || "",
                kclbdm: courseData.kclbdm || "",
                inputCode: finalVcode,
                tokenValue: tokenEl.value
            });

            const res = await fetch("/student/courseSelect/selectCourse/checkInputCodeAndSubmit", { method: "POST", body: params, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" } });
            const submitJson = await res.json();

            if (submitJson.token) tokenEl.value = submitJson.token;

            if (submitJson.result && submitJson.result.includes("验证码校验失败")) {
                if (!window.forceOcr && !window.isCaptchaRequired) {
                    window.isCaptchaRequired = true; // 标记系统已开启防刷
                    log(`系统拦截验证码，唤醒自建 OCR`, "error");
                    if (!isRetry) return await selectCourse(task, courseData, true); // 原地重发
                }

                log(`自建 OCR 识别出错，准备下一轮`, "error");
                return false;
            }

            if (submitJson.result === "ok" && submitJson.redisKey) {
                const result = await pollForResult(submitJson.redisKey, task.name);
                if (result.status === 'SUCCESS') {
                    log(` 拿下: ${task.name}`, "success");
                    window.taskList = window.taskList.filter(t => t.id !== task.id);
                    saveTasks(); renderList(); return true;
                } else if (result.status === 'FATAL') {
                    log(` 熔断停止：${result.msg}`, "error"); stopMonitor(); return false;
                } else {
                    log(`[${task.name}] 抢夺失败: ${result.msg}`, "error");

                    if (result.msg.includes("已经选择") || result.msg.includes("已选")) {
                        log(`[${task.name}] 目标已在课表中，自动移除！`, "success");
                        window.taskList = window.taskList.filter(t => t.id !== task.id);
                        saveTasks(); renderList();
                    }
                    return false;
                }
            } else {
                const errMsg = submitJson.message || "未知错误";
                log(`[${task.name}] 提交失败: ${errMsg}`, "error");

                if (errMsg.includes("已经选择") || errMsg.includes("已选")) {
                    log(`[${task.name}] 目标已在课表中，任务圆满完成并自动移除！`, "success");
                    window.taskList = window.taskList.filter(t => t.id !== task.id);
                    saveTasks(); renderList();
                }
            }
        } catch (err) {
            log(`代码或网络崩溃: ${err.message}`, "error");
        }
        return false;
    }

    function renderSearchResults(rawList) {
        const panel = document.getElementById('search_result_panel');
        if (!panel) return;
        panel.style.display = "block";
        if (rawList.length === 0) { panel.innerHTML = "<div style='color:#ff3b30; text-align:center;'>❌ 无匹配班级</div>"; return; }

        const classMap = new Map();
        rawList.forEach(item => {
            const classKey = `${item.kch}-${item.kxh}`;
            if (!classMap.has(classKey)) classMap.set(classKey, { ...item, scheduleGroups: new Map() });
            const currentClass = classMap.get(classKey);
            const timePlaceKey = `${item.skxq}-${item.skjc}-${item.jxlm || ''}${item.jasm || ''}`;
            if (!currentClass.scheduleGroups.has(timePlaceKey)) {
                currentClass.scheduleGroups.set(timePlaceKey, { day: item.skxq, period: item.skjc, place: `${item.jxlm || ''} ${item.jasm || '待定'}`, weeks: [] });
            }
            const group = currentClass.scheduleGroups.get(timePlaceKey);
            if (item.zcsm && !group.weeks.includes(item.zcsm)) group.weeks.push(item.zcsm);
        });

        const list = Array.from(classMap.values());
        panel.innerHTML = `<div style="font-weight:bold;margin-bottom:12px;color:#5856d6;font-size:12px;display:flex;align-items:center;gap:6px;"><span>💡 双击卡片直接添加抢课:</span></div>` +
            list.map(c => {
                const scheduleHTML = Array.from(c.scheduleGroups.values()).map(g => `<div class="time-tag"><b>周${g.day} ${g.period}节</b> | ${g.weeks.join(", ") || "全部周"}<br>📍 ${g.place}</div>`).join('');

                const teacherName = c.skjs ? c.skjs.split('*')[0] : "待定";

                return `
                    <div class="res-card" ondblclick="window.addTaskFromSearch('${c.kch}', '${c.kxh}', '${c.kcm}')">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b>${c.kcm}</b>
                            <span style="color:#007aff; font-weight:900; font-size:14px;">序:${c.kxh}</span>
                        </div>
                        <div style="font-size:11px; color:#666; margin-top:6px;">编号: ${c.kch} | 讲师: ${teacherName}</div>
                        <div class="capacity-badge">余量: <span class="cap-highlight">${c.bkskyl}</span> / 总容量: ${c.bkskrl}</div>
                        <div style="margin-top:4px;">${scheduleHTML}</div>
                    </div>
                `;
            }).join("");
        panel.scrollTop = 0;
    }

    unsafeWindow.addTaskFromSearch = (kch, kxh, kcm) => {
        const isDuplicate = window.taskList.some(t => t.kch === kch && window.isKxhMatch(t.kxh, kxh));
        if (isDuplicate) { log(`⚠️ 列表已有: ${kcm}`, "error"); return; }

        let finalKxh = String(kxh).trim();
        if (/^\d+$/.test(finalKxh) && finalKxh.length < 2) finalKxh = finalKxh.padStart(2, '0');

        window.taskList.push({ id: Date.now(), name: kcm, kch: kch, kxh: finalKxh });
        log(`✅ 快速添加: ${kcm}`, "success");
        saveTasks(); renderList();
    };

    async function addTaskWithLogic() {
        const kch = document.getElementById('inp_kch').value.trim();
        const kcm_input = document.getElementById('inp_name').value.trim();
        const kxh = document.getElementById('inp_kxh').value.trim();
        if (!kch && !kcm_input) { alert("填个名或号吧"); return; }
        log(`正在校验唯一性...`, "dim");
        try {
            const bodyParams = new URLSearchParams({ kkxsh: "", kch: kch, kcm: kcm_input, skjs: "", xq: "0", jc: "0", kclbdm: "", vt: "", fj: "0" });
            const res = await fetch("/student/courseSelect/freeCourse/courseList", { method: "POST", body: bodyParams, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" } });
            const data = await res.json();
            let rawList = data.rwRxkZlList || [];

            if (kxh) rawList = rawList.filter(x => window.isKxhMatch(x.kxh, kxh));
            renderSearchResults(rawList);

            const uniqueKeys = new Set();
            const uniqueResults = [];
            rawList.forEach(x => {
                let cleanKxh = /^0+\d+$/.test(String(x.kxh).trim()) ? String(x.kxh).trim().replace(/^0+/, '') : String(x.kxh).trim();
                let key = `${x.kch}-${cleanKxh}`;
                if(!uniqueKeys.has(key)){
                    uniqueKeys.add(key);
                    uniqueResults.push(x);
                }
            });

            if (uniqueResults.length === 1) {
                unsafeWindow.addTaskFromSearch(uniqueResults[0].kch, uniqueResults[0].kxh, kcm_input || uniqueResults[0].kcm);
            } else if (uniqueResults.length > 1) log(`⚠️ 匹配多项，请双击选择`, "error");
        } catch (e) { log("搜索失败", "error"); }
    }

    async function runStandaloneQuery() {
        const kch = document.getElementById('inp_kch').value.trim();
        const kcm = document.getElementById('inp_name').value.trim();
        const kxh = document.getElementById('inp_kxh').value.trim();

        if (!kch && !kcm) return;

        try {
            const bodyParams = new URLSearchParams({ kkxsh: "", kch: kch, kcm: kcm, skjs: "", xq: "0", jc: "0", kclbdm: "", vt: "", fj: "0" });
            const res = await fetch("/student/courseSelect/freeCourse/courseList", { method: "POST", body: bodyParams, headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" } });
            const data = await res.json();
            let rawList = data.rwRxkZlList || [];

            if (kxh) {
                rawList = rawList.filter(x => window.isKxhMatch(x.kxh, kxh));
            }
            renderSearchResults(rawList);
        } catch (e) {
            log("查询失败，请检查网络", "error");
        }
    }

    async function independentProbe(task) {
        if (!window.monitorStatus) return;
        if (!window.taskList.some(t => t.id === task.id)) return;

        if (window.globalFireLock) {
            window.probeTimers[task.id] = setTimeout(() => independentProbe(task), 500);
            return;
        }

        try {
            const fd = new URLSearchParams({ kkxsh: "", kch: task.kch, kcm: "", skjs: "", xq: "0", jc: "0", kclbdm: "", vt: "", fj: "0" });
            const res = await fetch("/student/courseSelect/freeCourse/courseList", {
                method: "POST", body: fd,
                headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }
            });
            const data = await res.json();

            const tar = (data.rwRxkZlList || []).find(x => window.isKxhMatch(x.kxh, task.kxh) && x.bkskyl > 0);

            if (tar) {
                if (!window.globalFireLock) {
                    window.globalFireLock = true;
                    log(`[${task.name}] 💥 发现余量！全军火力锁定，发射！`, "success");

                    try {
                        await selectCourse(task, tar);
                    } catch (err) {
                        log(`[${task.name}] ❌ 抢课异常: ${err.message}`, "error");
                    } finally {
                        window.globalFireLock = false;
                        log(`[System] 🔄 熔断解除，全军恢复侦察！`, "dim");
                    }
                }
            }
        } catch (e) {}

        if (window.monitorStatus && window.taskList.some(t => t.id === task.id)) {
            if (window.globalFireLock) {
                window.probeTimers[task.id] = setTimeout(() => independentProbe(task), 500);
            } else {
                window.probeTimers[task.id] = setTimeout(() => independentProbe(task), 800 + Math.random() * 400);
            }
        } else if (!window.taskList.some(t => t.id === task.id)) {
            log(`[System] 探针 [${task.name}] 确认任务已完成，退役。`, "dim");
        }
    }

    function startMonitor() {
        if (window.taskList.length === 0) { alert("请先添加任务！"); return; }
        window.monitorStatus = true;
        window.globalFireLock = false;
        // 每次启动默认先重置为不强制验证码
        window.isCaptchaRequired = false;

        const btn = document.getElementById('btn_toggle');
        btn.innerText = "⏹ 停止硬磕 (双擎智控中)";
        btn.className = "c-btn btn-stop";
        renderList();

        log("🚀 启动独立并发引擎，各单位自由开火！", "success");

        window.taskList.forEach(task => { independentProbe(task); });
    }

    function stopMonitor() {
        window.monitorStatus = false;
        window.globalFireLock = true;

        for (let id in window.probeTimers) { clearTimeout(window.probeTimers[id]); }
        window.probeTimers = {};

        const btn = document.getElementById('btn_toggle');
        btn.innerText = "▶ 开始全速抢课";
        btn.className = "c-btn btn-start";
        renderList();

        log("⏹ 引擎已安全停机。", "dim");
    }

    function saveTasks() { localStorage.setItem('alan_course_tasks', JSON.stringify(window.taskList)); }
    function findFajhhAutomagically(){ try { const a = document.getElementById("zyxk"); return a ? a.getAttribute("onclick").match(/fajhh=([0-9]+)/)[1] : (document.querySelector('input[name="fajhh"]')?.value || document.querySelector("#fajhh_hdd")?.value); } catch(e){return null;} }

    const initUI = () => {
        const box = document.createElement("div"); box.id = "courseMonitorFloatBox"; document.body.appendChild(box);
        box.innerHTML = `
            <div class="drag-header" id="alan_drag">SCU 选课 V11.0 (内网直连版)</div>
            <div class="input-row"><input id="inp_kch" class="liquid-input" placeholder="课程号 (KCH)"><input id="inp_kxh" class="liquid-input flex-kxh" placeholder="课序"></div>
            <div class="input-row">
                <input id="inp_name" class="liquid-input" placeholder="课程关键词 / 任务名">
                <input id="inp_vcode" class="liquid-input" placeholder="验证码(AI模式无需)" style="color:#ff3b30">
            </div>

            <div class="input-row" style="align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 12px; color: #666; padding-left: 5px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="chk_force_ocr" style="margin-right: 6px; width: 14px; height: 14px;">
                    <span style="font-weight: 600;">强制内网 OCR 视觉打码 (关=默认极速)</span>
                </label>
            </div>

            <div class="btn-group">
                <button id="btn_add" class="c-btn btn-add">🚀 智能入队</button>
                <button id="btn_search_only" class="c-btn btn-search">🔍 深度查询</button>
            </div>
            <div id="search_result_panel"></div>
            <div id="task_list_container"></div>
            <div id="log_area"></div>
            <button id="btn_toggle" class="c-btn btn-start">▶ 开始全速抢课</button>
            <div class="alan-footer">
                <a href="https://github.com/wunkei" target="_blank" class="dev-tag">dev: WynnKai</a>
                <div class="disclaimer">本脚本仅供学习交流使用。严禁非法用途。</div>
            </div>
        `;

        // 绑定复选框事件
        const chkOcr = document.getElementById('chk_force_ocr');
        chkOcr.checked = window.forceOcr;
        chkOcr.onchange = (e) => {
            window.forceOcr = e.target.checked;
            if (window.forceOcr) {
                log("战术切换：已开启强制内网 OCR 视觉打码", "dim");
            } else {
                log("战术切换：已恢复极速无感模式", "dim");
            }
        };

        document.getElementById('btn_add').onclick = addTaskWithLogic;
        document.getElementById('btn_search_only').onclick = runStandaloneQuery;
        document.getElementById('btn_toggle').onclick = () => window.monitorStatus ? stopMonitor() : startMonitor();

        const dh = document.getElementById('alan_drag');
        let isD = false, o = [0,0];
        dh.onmousedown = (e) => { isD = true; o = [box.offsetLeft - e.clientX, box.offsetTop - e.clientY]; };
        document.onmousemove = (e) => { if(isD) { box.style.left = (e.clientX + o[0])+'px'; box.style.top = (e.clientY + o[1])+'px'; box.style.right = 'auto'; } };
        document.onmouseup = () => isD = false;
    };

    function renderList() {
        const c = document.getElementById('task_list_container');
        c.innerHTML = window.taskList.length === 0 ? '<div style="text-align:center; padding:30px; color:#999; font-size:12px;">待抢任务列表 (空)</div>' : '';
        window.taskList.forEach((t, i) => {
            const d = document.createElement('div'); d.className = `task-item ${window.monitorStatus ? 'grinding' : ''}`;
            d.innerHTML = `<div><b>${t.name}</b><br><small>${t.kch} | 课序:${t.kxh}</small></div><button style="border:none;background:none;color:#ff3b30;cursor:pointer;font-size:18px;" onclick="window.removeTask('${t.id}')">✖</button>`;
            d.draggable = true; d.ondragstart = (e) => { draggedItemIndex = i; d.classList.add('dragging'); };
            d.ondragover = (e) => e.preventDefault();
            d.ondrop = (e) => {
                e.preventDefault();
                const movedItem = window.taskList.splice(draggedItemIndex, 1)[0];
                window.taskList.splice(i, 0, movedItem); saveTasks(); renderList();
            };
            d.ondragend = () => d.classList.remove('dragging');
            c.appendChild(d);
        });
    }

    function log(m, t="normal") {
        const c = { success: "#28cd41", error: "#ff3b30", dim: "#888", normal: "#1d1d1f" };
        const d = document.createElement("div"); d.innerHTML = `<span style="color:#aaa;font-size:10px;">${new Date().toLocaleTimeString()}</span> <span style="color:${c[t]};font-weight:bold">${m}</span>`;
        const a = document.getElementById('log_area'); if(a){ a.appendChild(d); a.scrollTop = a.scrollHeight; }
    }

    unsafeWindow.removeTask = (id) => {
        window.taskList = window.taskList.filter(x => String(x.id) !== String(id));
        saveTasks();
        renderList();
    };

    initUI(); renderList();
})();
