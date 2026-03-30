import ddddocr
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # 开启全局跨域支持

# 初始化 ddddocr
ocr = ddddocr.DdddOcr(show_ad=False)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"code": 400, "error": "未提供图片数据"}), 400

        img_base64 = data['image']

        # 核心优化：处理前端传来的带有 "data:image/png;base64," 前缀的数据
        if ',' in img_base64:
            img_base64 = img_base64.split(',', 1)[1]

        # 解码并识别
        img_bytes = base64.b64decode(img_base64)
        result = ocr.classification(img_bytes)

        return jsonify({
            "code": 200,
            "result": result,
            "message": "success"
        })

    except Exception as e:
        print(f"识别出错: {e}")
        return jsonify({"code": 500, "error": "服务器内部错误"}), 500

if __name__ == '__main__':
    # host='0.0.0.0' 允许外部访问
    app.run(host='0.0.0.0', port=5000)