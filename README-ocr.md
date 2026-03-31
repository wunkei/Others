<div align="center">

# scu-ocr-service

**验证码 OCR 识别服务 · 为 SCU 选课助手设计，也可独立使用**

![python](https://img.shields.io/badge/python-3.9+-blue)
![license](https://img.shields.io/badge/license-MIT-green)

</div>

---

## 这是什么

一个轻量的 HTTP 接口服务，接收 Base64 编码的图片，返回识别出的文字内容。

设计用于识别四川大学教务系统的 4 位字母数字验证码，但接口是通用的，可以对接任何验证码图片。

**配套项目**：[scu-course-helper](https://github.com/yourname/scu-course-helper)（油猴脚本，调用本服务实现验证码自动识别）

---

## 接口说明

### `POST /ocr`

**请求体（JSON）：**

```json
{
  "image": "data:image/png;base64,iVBORw0KGgo..."
}
```

**响应（成功）：**

```json
{
  "code": 200,
  "result": "aB3x"
}
```

**响应（失败）：**

```json
{
  "code": 500,
  "result": null,
  "message": "识别失败"
}
```

---

## 快速部署

### 本地运行

```bash
git clone https://github.com/yourname/scu-ocr-service
cd scu-ocr-service
pip install -r requirements.txt
python app.py
# 服务启动在 http://localhost:5000
```

### 通过 Cloudflare Tunnel 暴露到公网

本项目实际使用场景是：服务跑在本地或内网机器上，通过 Cloudflare Tunnel 穿透到一个固定域名，供浏览器脚本跨域调用。

```bash
# 安装 cloudflared
brew install cloudflared   # macOS
# 或下载对应平台的二进制：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# 启动隧道（无需注册，临时域名）
cloudflared tunnel --url http://localhost:5000

# 输出类似：
# https://xxx-xxx-xxx.trycloudflare.com
```

将这个域名填入油猴脚本顶部的 `OCR_API_URL` 即可。

> 如果需要固定域名，可以在 Cloudflare 控制台创建命名隧道并绑定自定义域名，详见 [官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)。

---

## 项目结构

```
scu-ocr-service/
├── app.py              # HTTP 服务入口（Flask）
├── ocr.py              # 识别逻辑
├── requirements.txt
└── README.md
```

---

## 技术说明

**为什么不直接在脚本里调用公共 OCR API？**

主流公共 OCR 服务（百度、腾讯等）不支持跨域直接在浏览器调用，必须走后端转发。与其依赖第三方，不如自建一个轻量服务，延迟更低，也不用担心 API 配额和密钥泄漏。

**为什么用 Cloudflare Tunnel 而不是直接暴露端口？**

无需公网 IP，无需路由器端口映射，适合跑在普通电脑或宿舍网络环境里。Tunnel 建立出站连接，不增加本地攻击面。

**识别准确率**

对于 SCU 教务系统的 4 位字母数字验证码，测试准确率约 85-90%。识别失败时脚本会自动丢弃并重新抓取验证码重试，不影响最终成功率。

---

## 开发与扩展

如果你想接入其他验证码类型或更换 OCR 引擎，只需修改 `ocr.py` 中的识别逻辑，接口格式保持不变，脚本侧无需任何改动。

---

## 免责声明

本项目仅供学习网络服务开发和 OCR 技术使用，请勿用于违反相关平台服务条款的场景。

---

<div align="center">
  <sub>dev: WynnKai</sub>
</div>
