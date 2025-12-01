// ==UserScript==
// @name         Alan的抢课神器 (Liquid Glass版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动抢课脚本，液态玻璃UI，支持拖拽与参数保存
// @author       Alan
// @match        http://zhjw.scu.edu.cn/student/courseSelect/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================
    // 🚀 动态抢课控制台 (Liquid Glass 终极版 - Author: Alan)
    // =========================================================

    // --- 1. 初始化界面与状态 ---
    if (window.courseMonitorInterval) clearInterval(window.courseMonitorInterval);
    window.isSelecting = false;
    window.monitorStatus = false;

    // 清理旧资源
    ["courseMonitorFloatBox", "courseMonitorLiquidStyle"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    // --- 注入 Liquid Glass 专用 CSS ---
    const style = document.createElement('style');
    style.id = "courseMonitorLiquidStyle";
    style.innerHTML = `
        /* 全局盒模型 */
        #courseMonitorFloatBox * { box-sizing: border-box; }

        /* 标题栏 */
        #drag_header {
            text-align: center; color: #1a1a1a; cursor: move; user-select: none;
            font-size: 15px; font-weight: 700;
            padding-bottom: 12px; margin-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.4);
            box-shadow: 0 2px 4px rgba(255,255,255,0.3);
            text-shadow: 0 1px 2px rgba(255,255,255,0.8);
        }
        #drag_header span { font-size: 11px; opacity: 0.6; font-weight: 400; }

        /* 标签 */
        #courseMonitorFloatBox label {
            font-weight: 600; color: #333; font-size: 12px; text-align: right; padding-right: 10px;
            text-shadow: 0 1px 1px rgba(255,255,255,0.5);
        }

        /* 液态输入框 */
        #courseMonitorFloatBox .liquid-input {
            width: 100%; padding: 10px 12px;
            background: rgba(255, 255, 255, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.5) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.05), 0 1px 1px rgba(255,255,255,0.3) !important;
            border-radius: 14px;
            font-family: -apple-system, BlinkMacSystemFont, monospace;
            font-size: 13px; color: #222; outline: none;
            transition: all 0.3s ease;
        }
        #courseMonitorFloatBox .liquid-input:focus {
            background: rgba(255, 255, 255, 0.3) !important;
            border-color: rgba(255, 255, 255, 0.8) !important;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.02), 0 0 15px rgba(255,255,255,0.6), 0 0 5px rgba(100, 200, 255, 0.3) !important;
        }

        /* 日志区域 */
        #log_area {
            width: 100%;
            height: 150px; 
            overflow-y: auto; 
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 14px;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
            font-family: monospace;
            font-size: 12px;
            color: #222;
        }

        /* 液态按钮 */
        #courseMonitorFloatBox .c-btn {
            padding: 12px; border: none; border-radius: 16px; 
            cursor: pointer; font-weight: 700; color: white; font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 10px 20px -10px rgba(0,0,0,0.3), inset 0 3px 5px rgba(255,255,255,0.7), inset 0 -3px 5px rgba(0,0,0,0.1);
            backdrop-filter: blur(5px);
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        #courseMonitorFloatBox .c-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 25px -10px rgba(0,0,0,0.4), inset 0 3px 5px rgba(255,255,255,0.8), inset 0 -3px 5px rgba(0,0,0,0.1); }
        #courseMonitorFloatBox .c-btn:active { transform: scale(0.98) translateY(0px); }
        
        .btn-start { background-image: linear-gradient(145deg, #00d2ff 0%, #3a7bd5 100%); }
        .btn-stop { background-image: linear-gradient(145deg, #ff512f 0%, #dd2476 100%); }
        .btn-clear { background-image: linear-gradient(145deg, #8e9eab 0%, #eef2f3 100%); color: #555 !important; text-shadow: none !important; }

        /* 滚动条 */
        #log_area::-webkit-scrollbar { width: 6px; }
        #log_area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 3px; }
        #log_area::-webkit-scrollbar-track { background: transparent; }

        /* 底部版权栏 */
        #footer_info {
            margin-top: 5px; padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.3);
            font-size: 10px; color: rgba(0, 0, 0, 0.5);
            display: flex; justify-content: space-between; align-items: center;
            transition: opacity 0.3s;
        }
        #footer_info:hover { color: rgba(0, 0, 0, 0.9); }
        .footer-left { font-weight: bold; display: flex; align-items: center; gap: 4px; }
        .footer-right { font-size: 9px; transform: scale(0.95); transform-origin: right center; cursor: help; }
    `;
    document.head.appendChild(style);

    // --- 创建主浮窗 ---
    const floatBox = document.createElement("div");
    floatBox.id = "courseMonitorFloatBox";

    // ✨✨✨ Liquid Glass 容器 ✨✨✨
    Object.assign(floatBox.style, {
        position: "fixed", top: "30px", right: "30px", width: "360px",
        background: "linear-gradient(125deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 100%)",
        backdropFilter: "blur(40px) saturate(200%)",
        webkitBackdropFilter: "blur(40px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow: `0 25px 45px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.2), 0 0 0 1px rgba(255,255,255,0.3)`,
        borderRadius: "24px",
        padding: "20px", zIndex: 99999,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex", flexDirection: "column", gap: "14px"
    });
    document.body.appendChild(floatBox);

    // --- 渲染 HTML 结构 ---
    floatBox.innerHTML = `
        <div id="drag_header">
            控制台 <span>(拖动)</span>
        </div>
        
        <div style="display:grid;grid-template-columns: 65px 1fr;gap:12px 10px;align-items:center;">
            <label>课程号</label> <input id="inp_kch" type="text" value="" placeholder="课程号" class="liquid-input">
            <label>教师名</label> <input id="inp_teacher" type="text" value="" placeholder="教师名" class="liquid-input">
            <label>星期 / 节</label> 
            <div style="display:flex;gap:8px;">
                <input id="inp_xq" type="text" value="" placeholder="星期" class="liquid-input" style="text-align:center">
                <input id="inp_jc" type="text" value="" placeholder="节" class="liquid-input" style="text-align:center">
            </div>
            <label>刷新ms</label> <input id="inp_interval" type="number" value="1000" class="liquid-input">
        </div>
        
        <div style="display:flex;gap:12px;margin-top:10px;">
            <button id="btn_toggle" class="c-btn btn-start" style="flex:2;">▶ 开始抢课</button>
            <button id="btn_clear" class="c-btn btn-clear" style="flex:1;">清空</button>
        </div>
        
        <div id="log_area"></div>
        <div id="status_bar" style="font-size:11px;color:#444;text-align:center;font-weight:600;text-shadow:0 1px 1px rgba(255,255,255,0.5)">Ready</div>

        <div id="footer_info">
            <div class="footer-left">
                <span>🛠️ Dev:</span>
                <span style="color:#0056b3;">Alan</span> 
            </div>
            <div class="footer-right">⚠️ 仅供学习交流</div>
        </div>
    `;

    // 获取 DOM 引用
    const el = {
        kch: document.getElementById('inp_kch'), teacher: document.getElementById('inp_teacher'),
        xq: document.getElementById('inp_xq'), jc: document.getElementById('inp_jc'),
        interval: document.getElementById('inp_interval'), btn: document.getElementById('btn_toggle'),
        log: document.getElementById('log_area'), clear: document.getElementById('btn_clear'),
        status: document.getElementById('status_bar'), header: document.getElementById('drag_header')
    };

    // --- 0. 拖拽逻辑 ---
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

    // --- 2. 核心功能函数 ---
    function log(msg, color = "#222") {
        const div = document.createElement("div");
        div.innerHTML = `<span style="color:#555;font-size:10px;font-weight:500">[${new Date().toLocaleTimeString()}]</span> <span style="color:${color};font-weight:600;text-shadow:0 1px 1px rgba(255,255,255,0.3)">${msg}</span>`;
        div.style.marginBottom = "4px"; div.style.lineHeight = "1.4";
        el.log.prepend(div);
    }

    function findFajhhAutomagically(){try{const a=document.getElementById("zyxk");if(a){const c=a.getAttribute("onclick").match(/fajhh=([0-9]+)/);if(c&&c[1])return c[1]}const b=document.querySelector('input[name="fajhh"]')||document.querySelector("#fajhh_hdd");if(b&&b.value)return b.value}catch(d){}return null}
    async function verifySuccess(a){try{const b=await fetch("/student/courseSelect/selectCourse/yxkcList",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"}});return(await b.text()).includes(a)}catch(c){log("⚠️ 核实接口异常","#d63384");return!1}}
    async function selectCourse(a){const b=document.getElementById("tokenValue")?.value,c=findFajhhAutomagically();if(!b||!c){log("❌ 缺少关键参数(token/fajhh)","#dc3545");stopMonitor();return}log(`🚀 发现名额! 提交中: ${a.kcm}`,"#007aff");try{let d="";const e=`${a.kcm}_${a.kxh}`;for(let f=0;f<e.length;f++)d+=e.charCodeAt(f)+",";const g=new URLSearchParams({dealType:"5",kcIds:`${a.kch}_${a.kxh}_${a.zxjxjhh}`,kcms:d,fajhh:c,fj:"0",sj:`${a.skxq}_${a.skjc.split("-")[0]}`,kkxsh:a.kkxsh||"",kclbdm:a.kclbdm||"",inputCode:"undefined",tokenValue:b});await fetch("/student/courseSelect/selectCourse/checkInputCodeAndSubmit",{method:"POST",body:g,headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"}});await new Promise(h=>setTimeout(h,1500));if(await verifySuccess(a.kch)){log(`🎉 抢课成功! [${a.kcm}]`,"#28a745");try{new Audio("https://xp.liujason.com/img/win.mp3").play()}catch(i){}stopMonitor();alert(`🎉 恭喜！抢到课了：${a.kcm}\n已自动暂停。`)}else{log(`⚠️ 未在课表中发现，重试中...`,"#ff6b6b");window.isSelecting=!1}}catch(j){log(`❌ 请求错误: ${j.message}`,"#ff3b30");window.isSelecting=!1}}
    async function checkCourses(){if(!window.monitorStatus)return;const a=el.kch.value.trim(),b=el.teacher.value.trim();el.status.innerText=`Monitoring: ${a||"Any"} | ${b||"Any"}`;try{const c=new URLSearchParams({kkxsh:"",kch:a,kcm:"",skjs:b,xq:"0"===el.xq.value.trim()?"":el.xq.value.trim(),jc:"0"===el.jc.value.trim()?"":el.jc.value.trim(),kclbdm:"",vt:"",fj:"0"}),d=await fetch("/student/courseSelect/freeCourse/courseList",{method:"POST",body:c,headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","X-Requested-With":"XMLHttpRequest"}}),e=(await d.json()).rwRxkZlList||[];let f=!1;0===e.length&&(el.status.innerText+=" (空列表)");for(const g of e){const h=g.bkskyl;h>0&&(log(`!!! 有名额: ${g.kcm}(余${h})`,"#ff3b30"),f=!0,window.isSelecting||(window.isSelecting=!0,selectCourse(g)))}!f&&e.length>0&&(el.status.innerText+=" (暂无)")}catch(i){log(`监控异常: ${i.message}`,"#ff3b30")}}

    // --- 3. 交互控制 ---
    function startMonitor() {
        if (window.monitorStatus) return;
        if (!el.kch.value && !el.teacher.value) { alert("请至少输入课程号或教师名！"); return; }
        window.monitorStatus = true; window.isSelecting = false;
        el.btn.innerHTML = "⏹ 停止监控";
        el.btn.classList.remove('btn-start'); el.btn.classList.add('btn-stop');
        log("=== 🟢 监控已启动 ===", "#007aff");
        checkCourses();
        window.courseMonitorInterval = setInterval(checkCourses, parseInt(el.interval.value) || 3000);
    }

    function stopMonitor() {
        window.monitorStatus = false; clearInterval(window.courseMonitorInterval);
        el.btn.innerHTML = "▶ 开始抢课";
        el.btn.classList.remove('btn-stop'); el.btn.classList.add('btn-start');
        el.status.innerText = "已暂停"; log("=== 🔴 监控已停止 ===", "#888");
    }
    el.btn.onclick = () => { if (window.monitorStatus) stopMonitor(); else startMonitor(); };
    el.clear.onclick = () => { el.log.innerHTML = ""; };
    console.log("Liquid Glass UI (Alan) loaded.");

})();