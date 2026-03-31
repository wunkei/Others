<div align="center">

# SCU 选课助手

**四川大学教务系统选课辅助脚本 · Tampermonkey**

![version](https://img.shields.io/badge/version-11.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox-lightgrey)

</div>

---

## 这是什么

一个运行在浏览器里的油猴脚本，在选课开放时自动监控余量、识别验证码、提交选课请求。

**核心特性：**

- **独立并发探针**：每个待抢课程启动一个独立轮询任务，互不阻塞
- **全局互斥锁**：发现余量时协调多探针，避免重复提交
- **动态验证码识别**：平时极速无感运行，服务器开启防刷时自动唤醒 OCR
- **Token 滚动更新**：自动跟踪服务端一次性 Token，无需手动刷新
- **熔断保护**：遇到课程冲突、院系限制等不可恢复错误时自动停机

---

## 使用前提

| 条件 | 说明 |
|------|------|
| 浏览器扩展 | 安装 [Tampermonkey](https://www.tampermonkey.net/) |
| 验证码识别（可选） | 部署 [scu-ocr-service](https://github.com/yourname/scu-ocr-service)，并在脚本顶部填入你的接口地址 |

> 不部署 OCR 服务也可以使用，手动输入验证码即可。教务系统不总是开启验证码，大多数情况下无需 OCR。

---

## 安装

1. 安装 Tampermonkey 扩展
2. 点击 [此处安装脚本](https://github.com/yourname/scu-course-helper/raw/main/script.user.js)（或手动复制 `script.user.js` 内容新建脚本）
3. 打开教务系统选课页面，右上角会出现控制面板

---

## 使用说明

**添加任务**

在控制面板输入课程号或课程名关键词，点击「智能入队」或「深度查询」后双击搜索结果卡片即可添加。

**开始抢课**

点击「开始全速抢课」，每个任务会独立启动一个探针持续监控余量，抢到后自动从列表移除。

**验证码模式**

默认关闭，服务器拦截时自动切换。也可手动勾选「强制 OCR 打码」提前开启。

**任务优先级**

任务列表支持拖拽排序，靠前的任务会优先触发（当余量竞争激烈时有意义）。

---

## 技术实现

> 这部分写给想了解原理的同学，使用不需要看这里。

**并发探针架构**

每个任务通过递归 `setTimeout` 维持独立的轮询循环，间隔 800ms ± 随机抖动。相比 `setInterval`，这种方式保证上一轮网络请求完成后才发起下一轮，不会造成请求堆积。

```
Task A ──► probe ──► [等待网络] ──► 检查余量 ──► setTimeout 800ms ──► probe ...
Task B ──► probe ──► [等待网络] ──► 检查余量 ──► setTimeout 900ms ──► probe ...
Task C ──► probe ──► [等待网络] ──► 检查余量 ──► setTimeout 850ms ──► probe ...
```

**互斥锁设计**

```js
if (发现余量 && !globalFireLock) {
    globalFireLock = true   // 上锁，阻止其他探针同时触发
    try {
        await selectCourse()
    } finally {
        globalFireLock = false  // 无论成败，释放锁
    }
}
```

**验证码动态唤醒**

平时不携带验证码（极速模式），一旦服务器返回"验证码校验失败"，自动标记并在后续请求中调用 OCR 服务识别，对性能影响最小。

**跨域请求**

OCR 服务部署在外部域名，普通 `fetch` 受 CORS 限制无法访问。脚本通过 `GM_xmlhttpRequest` 在扩展权限层面发起请求，绕过浏览器同源策略。

---

## 免责声明

本项目仅供学习浏览器自动化、异步编程、网络请求相关技术使用。使用前请确认符合学校相关规定，作者不对使用后果负责。

---

<div align="center">
  <sub>dev: WynnKai · 如果对你有帮助，欢迎 star ⭐</sub>
</div>
