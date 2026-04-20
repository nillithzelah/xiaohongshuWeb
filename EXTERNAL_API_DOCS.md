# 外部 API 接口文档

**基础URL**: `https://www.wubug.cc/xiaohongshu/api`

---

## 1. 获取搜索关键词列表

**接口**: `GET /client/discovery/keywords`

**说明**: 获取所有活跃的搜索关键词列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "keywords": [
      { "keyword": "减肥被骗", "category": "减肥诈骗" },
      { "keyword": "护肤被骗", "category": "护肤诈骗" },
      { "keyword": "祛斑被骗", "category": "祛斑诈骗" }
    ],
    "count": 275
  }
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词 |
| category | string | 关键词分类 |

**测试命令**:
```bash
curl https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords
```

---

## 2. 分配单个搜索关键词（多设备协同）

**接口**: `GET /client/discovery/keywords/allocate`

**说明**: 分配一个未被其他设备使用的关键词，支持多设备协同搜索。每次调用返回一个不同的关键词，避免多设备重复搜索同一关键词。

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | string | 是 | 客户端唯一标识，用于锁定关键词 |

**响应示例**（成功）:
```json
{
  "success": true,
  "data": {
    "keyword": "减肥被骗",
    "category": "减肥诈骗",
    "lockedUntil": "2026-01-21T12:30:00.000Z"
  }
}
```

**响应示例**（无可用关键词）:
```json
{
  "success": true,
  "data": null,
  "message": "没有可用的关键词，请稍后重试"
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| keyword | string | 分配的关键词 |
| category | string | 关键词分类 |
| lockedUntil | string | 锁定过期时间（30分钟），超时自动释放 |

**测试命令**:
```bash
curl "https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords/allocate?clientId=my_client_001"
```

**Python示例**:
```python
import requests

def allocate_keyword(client_id):
    response = requests.get(
        "https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords/allocate",
        params={"clientId": client_id}
    )
    return response.json()

# 使用
result = allocate_keyword("my_app_client")
if result.get("data"):
    keyword = result["data"]["keyword"]
    print(f"分配到关键词: {keyword}")
    # ... 执行搜索逻辑 ...
```

---

## 3. 释放搜索关键词

**接口**: `POST /client/discovery/keywords/release`

**说明**: 释放已分配的关键词，搜索完成后必须调用，让其他设备可以获取该关键词。如果不调用，关键词会在30分钟后自动释放。

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | string | 是 | 客户端唯一标识（必须与 allocate 时一致） |
| keyword | string | 是 | 要释放的关键词 |

**响应示例**:
```json
{
  "success": true,
  "released": true
}
```

**测试命令**:
```bash
curl -X POST https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords/release \
  -H "Content-Type: application/json" \
  -d '{"clientId":"my_client_001","keyword":"减肥被骗"}'
```

**Python完整示例**（分配 → 搜索 → 释放）:
```python
import requests
import time

BASE_URL = "https://www.wubug.cc/xiaohongshu/api"

def search_with_keyword():
    client_id = f"client_{int(time.time())}"

    # 1. 分配关键词
    alloc_result = requests.get(
        f"{BASE_URL}/client/discovery/keywords/allocate",
        params={"clientId": client_id}
    ).json()

    if not alloc_result.get("success") or not alloc_result.get("data"):
        print("暂无可用关键词")
        return

    keyword = alloc_result["data"]["keyword"]
    print(f"分配到关键词: {keyword}")

    try:
        # 2. 执行搜索逻辑
        # ... 你的搜索代码 ...
        print(f"搜索完成: {keyword}")

    finally:
        # 3. 释放关键词（无论成功失败都要释放）
        requests.post(
            f"{BASE_URL}/client/discovery/keywords/release",
            json={"clientId": client_id, "keyword": keyword}
        )
        print(f"已释放关键词: {keyword}")
```

---

## 4. 上传短链接

**接口**: `POST /short-link-pool/add`

**说明**: 添加小红书短链接到审核池，系统会自动审核该短链接对应的笔记

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shortUrl | string | 是 | 短链接（必须包含 xhslink.com） |
| source | string | 否 | 来源标识，默认 "external" |
| remark | string | 否 | 备注信息 |

**请求示例**:
```json
{
  "shortUrl": "https://xhslink.com/abc123",
  "source": "wechat_bot",
  "remark": "用户提交"
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "短链接添加成功",
  "data": {
    "id": "67890abcdef12345",
    "shortUrl": "https://xhslink.com/abc123",
    "status": "pending"
  }
}
```

**重复短链接响应** (HTTP 409):
```json
{
  "success": false,
  "message": "该短链接已存在于池中",
  "data": {
    "id": "67890abcdef12345",
    "status": "approved"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "短链接格式错误，必须包含 xhslink.com"
}
```

**测试命令**:
```bash
curl -X POST https://www.wubug.cc/xiaohongshu/api/short-link-pool/add \
  -H "Content-Type: application/json" \
  -d '{"shortUrl":"https://xhslink.com/abc123"}'
```

**原始 HTTP 请求**:
```http
POST /xiaohongshu/api/short-link-pool/add HTTP/1.1
Host: www.wubug.cc
Content-Type: application/json
Content-Length: 56

{"shortUrl":"https://xhslink.com/abc123"}
```

---

## 3. 获取一条无短链接笔记

**接口**: `GET /client/discovery/fetch-one-without-short-url`

**说明**: 获取一条没有短链接的笔记，用于补充短链接。每次调用返回一条笔记，按发现时间排序，最早的优先。

**请求参数**: 无

**响应示例**（有数据）:
```json
{
  "success": true,
  "remaining": 428,
  "data": {
    "noteId": "696612040000000022032786",
    "noteUrl": "https://www.xiaohongshu.com/explore/696612040000000022032786",
    "title": "祛斑被骗，亲身经历",
    "author": "木木不是沐沐"
  }
}
```

**响应示例**（无数据）:
```json
{
  "success": true,
  "remaining": 0,
  "data": null,
  "message": "没有待处理的笔记"
}
```

**字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| remaining | number | 剩余待处理的笔记数量（不包括当前这条） |
| data.noteId | string | 笔记ID（24位字符） |
| data.noteUrl | string | 笔记完整长链接 |
| data.title | string | 笔记标题 |
| data.author | string | 作者昵称 |

**⚠️ 重要说明 - 锁机制**:
- 获取笔记后，该笔记会被**锁定**（30分钟内不会被再次获取）
- 必须通过更新短链接API（单个或批量）来**释放锁**
- 如果处理失败或中断，锁会在30分钟后自动释放
- **同一笔记不会重复获取**，防止多设备重复处理

**测试命令**:
```bash
curl https://www.wubug.cc/xiaohongshu/api/client/discovery/fetch-one-without-short-url
```

**原始 HTTP 请求**:
```http
GET /xiaohongshu/api/client/discovery/fetch-one-without-short-url HTTP/1.1
Host: www.wubug.cc
User-Agent: Mozilla/5.0
Accept: application/json
```

---

## 4. 更新单条短链接

**接口**: `PUT /client/discovery/:id/short-url`

**说明**: 更新单条笔记的短链接（适用于逐条处理的场景）。更新后**自动释放锁**。

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 笔记的数据库 `_id`（注意：不是 noteId） |
| shortUrl | string | 是 | 短链接（必须包含 xhslink.com） |

**⚠️ 注意**: 此接口需要的是笔记的数据库 `_id`，不是 `noteId`。外部合作方应使用批量更新API。

**请求示例**:
```json
{
  "shortUrl": "http://xhslink.com/Al86aESFGd9"
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "短链接更新成功",
  "data": {
    "shortUrl": "http://xhslink.com/Al86aESFGd9"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "笔记不存在"
}
```

---

## 5. 批量更新短链接

**接口**: `POST /client/discovery/batch-update-short-urls`

**说明**: 批量更新笔记的短链接。外部合作方获取笔记后，找到对应的短链接，通过此接口回传。更新后**自动释放锁**。

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| updates | array | 是 | 更新列表，最多100条 |
| updates[].noteId | string | 是 | 笔记ID（24位字符） |
| updates[].shortUrl | string | 是 | 短链接（必须包含 xhslink.com） |

**请求示例**:
```json
{
  "updates": [
    { "noteId": "696612040000000022032786", "shortUrl": "http://xhslink.com/Al86aESFGd9" },
    { "noteId": "696f1c3fcdb7e67569fed6a2", "shortUrl": "http://xhslink.com/3QKQCFzddFI" }
  ]
}
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "total": 2,
    "successCount": 2,
    "failedCount": 0,
    "results": [
      { "noteId": "696612040000000022032786", "shortUrl": "http://xhslink.com/Al86aESFGd9", "success": true, "title": "祛斑被骗，亲身经历" },
      { "noteId": "696f1c3fcdb7e67569fed6a2", "shortUrl": "http://xhslink.com/3QKQCFzddFI", "success": true, "title": "另一篇笔记" }
    ]
  }
}
```

**部分失败响应**:
```json
{
  "success": true,
  "data": {
    "total": 2,
    "successCount": 1,
    "failedCount": 1,
    "results": [
      { "noteId": "696612040000000022032786", "shortUrl": "http://xhslink.com/Al86aESFGd9", "success": true },
      { "noteId": "invalid_id", "shortUrl": "http://xhslink.com/xxx", "success": false, "error": "笔记不存在" }
    ]
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "单次最多更新100条记录"
}
```

**测试命令**:
```bash
curl -X POST https://www.wubug.cc/xiaohongshu/api/client/discovery/batch-update-short-urls \
  -H "Content-Type: application/json" \
  -d '{"updates": [{"noteId": "696612040000000022032786", "shortUrl": "http://xhslink.com/xxx"}]}'
```

**原始 HTTP 请求**:
```http
POST /xiaohongshu/api/client/discovery/batch-update-short-urls HTTP/1.1
Host: www.wubug.cc
Content-Type: application/json
Content-Length: 115

{"updates":[{"noteId":"696612040000000022032786","shortUrl":"http://xhslink.com/xxx"}]}
```

---

## 6. 查询笔记短链接状态

**接口**: `GET /client/discovery/note/:noteId`

**说明**: 查询指定笔记的短链接更新状态，用于确认更新是否成功。

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| noteId | string | 是 | 笔记ID（24位字符） |

**响应示例**（已更新短链接）:
```json
{
  "success": true,
  "data": {
    "noteId": "69674aab0000000022021068",
    "noteUrl": "https://www.xiaohongshu.com/explore/69674aab0000000022021068?xsec_token=xxx",
    "shortUrl": "http://xhslink.com/test-update-1769160141",
    "title": "减肥被骗了怎么追回？",
    "author": "💙香香子",
    "hasShortUrl": true,
    "shortUrlConvertedAt": "2026-01-23T09:22:24.973Z",
    "createdAt": "2026-01-17T07:09:52.673Z"
  }
}
```

**响应示例**（未更新短链接）:
```json
{
  "success": true,
  "data": {
    "noteId": "696612040000000022032786",
    "noteUrl": "https://www.xiaohongshu.com/explore/696612040000000022032786",
    "shortUrl": null,
    "title": "祛斑被骗，亲身经历",
    "author": "木木不是沐沐",
    "hasShortUrl": false,
    "shortUrlConvertedAt": null,
    "createdAt": "2026-01-20T10:00:00.000Z"
  }
}
```

**字段说明**:
| 字段 | 说明 |
|------|------|
| `hasShortUrl` | 是否已更新短链接（true/false） |
| `shortUrl` | 短链接（已更新时有值，未更新时为null） |
| `shortUrlConvertedAt` | 短链接更新时间 |

**测试命令**:
```bash
curl https://www.wubug.cc/xiaohongshu/api/client/discovery/note/69674aab0000000022021068
```

---

## 完整工作流程

```
┌─────────────────────────────────────────────────────┐
│              外部合作方调用流程                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1️⃣ 调用获取接口                                    │
│     GET /discovery/fetch-one-without-short-url     │
│     ↓ 笔记被锁定（30分钟）                           │
│     ↓ 返回: noteId + 长链接                         │
│                                                     │
│  2️⃣ 合作方根据 noteUrl 找到对应的短链接              │
│                                                     │
│  3️⃣ 回传短链接（推荐使用批量接口）                    │
│     POST /discovery/batch-update-short-urls        │
│     ↓ 自动释放锁                                     │
│     ↓ 返回: 更新成功                                │
│                                                     │
│  4️⃣ 重复步骤1-3，直到获取接口返回 data: null        │
│     （表示所有笔记都已处理完毕）                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**⚠️ 锁机制说明**:
- 获取笔记时自动加锁，防止多设备重复处理同一条
- 更新短链接后自动释放锁
- 如果处理失败或中断，锁会在30分钟后自动释放
- **重复获取同一笔记的问题已修复**

**推荐方式（批量处理）**:
```python
# 累积一批后再批量更新，减少API调用次数
batch = []
while True:
    note = fetch_note()
    if not note:
        break

    short_url = find_short_url(note['noteUrl'])
    batch.append({"noteId": note['noteId'], "shortUrl": short_url})

    # 每10条批量更新一次
    if len(batch) >= 10:
        batch_update_short_urls(batch)
        batch = []
```

---

## 6. Java 调用示例（解决 SSL 证书问题）

### 问题说明

Java 客户端调用 `https://www.wubug.cc` 时可能遇到以下 SSL 错误：

```
javax.net.ssl.SSLHandshakeException: java.security.cert.CertPathValidatorException:
Trust anchor for certification path not found.
```

这是因为 Java 默认不信任某些 SSL 证书。

### 解决方案

#### 方案一：禁用 SSL 验证（仅用于开发/测试）

```java
import javax.net.ssl.*;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.X509Certificate;
import java.time.Duration;

// 创建信任所有证书的 TrustManager
TrustManager[] trustAllCerts = new TrustManager[] {
    new X509TrustManager() {
        public X509Certificate[] getAcceptedIssuers() { return null; }
        public void checkClientTrusted(X509Certificate[] certs, String authType) { }
        public void checkServerTrusted(X509Certificate[] certs, String authType) { }
    }
};

// 创建 SSLContext（跳过证书验证）
SSLContext sslContext = SSLContext.getInstance("TLS");
sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

// 创建 HttpClient
HttpClient client = HttpClient.newBuilder()
    .sslContext(sslContext)
    .connectTimeout(Duration.ofSeconds(10))
    .build();

// 调用 API
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords"))
    .timeout(Duration.ofSeconds(10))
    .build();

HttpResponse<String> response = client.send(request,
    HttpResponse.BodyHandlers.ofString());

System.out.println(response.body());
```

#### 方案二：使用 OkHttp（推荐，生产环境）

```java
import okhttp3.*;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

// 创建不验证证书链的 OkHttpClient（仅测试用）
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .writeTimeout(10, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    // 生产环境应移除下面两行，使用有效证书
    .hostnameVerifier((hostname, session) -> true)
    .sslSocketFactory(trustAllSslSocketFactory, trustAllTrustManager)
    .build();

public String fetchKeywords() throws IOException {
    Request request = new Request.Builder()
        .url("https://www.wubug.cc/xiaohongshu/api/client/discovery/keywords")
        .get()
        .build();

    try (Response response = client.newCall(request).execute()) {
        return response.body().string();
    }
}
```

#### 方案三：导入证书到 Java TrustStore（生产环境推荐）

```bash
# 1. 下载服务器证书
openssl s_client -showcerts -connect www.wubug.cc:443 </dev/null 2>/dev/null | \
  openssl x509 -outform PEM > wubug.crt

# 2. 导入证书到 Java TrustStore
keytool -import -alias wubug -keystore $JAVA_HOME/lib/security/cacerts \
  -file wubug.crt -storepass changeit -noprompt

# 3. 验证导入
keytool -list -keystore $JAVA_HOME/lib/security/cacerts -alias wubug
```

---

## 7. 故障排查

### SSL 证书错误

**错误**: `SSLHandshakeException`, `CertPathValidatorException`

**解决**:
1. **开发环境**: 使用方案一或方案二禁用 SSL 验证
2. **生产环境**: 使用方案三导入服务器证书

### 连接超时

**错误**: `ConnectTimeoutException`

**解决**:
- 检查网络连接
- 增加超时时间
- 确认服务器地址正确: `https://www.wubug.cc`

### 404/500 错误

**错误**: HTTP 状态码非 200

**解决**:
- 确认 URL 路径正确: `/xiaohongshu/api/...`
- 检查服务端日志

---

## 短链接状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| locked | 处理中（已被客户端锁定） |
| approved | 审核通过（已转换为笔记） |
| rejected | 审核拒绝 |

---

## Python 调用示例

```python
import requests

BASE_URL = "https://www.wubug.cc/xiaohongshu/api"

# 获取关键词
def get_keywords():
    response = requests.get(f"{BASE_URL}/client/discovery/keywords")
    return response.json()

# 上传短链接
def add_short_link(short_url, source="external", remark=""):
    payload = {
        "shortUrl": short_url,
        "source": source,
        "remark": remark
    }
    response = requests.post(f"{BASE_URL}/short-link-pool/add", json=payload)
    return response.json()

# 获取一条无短链接笔记
def fetch_note_without_short_url():
    response = requests.get(f"{BASE_URL}/client/discovery/fetch-one-without-short-url")
    return response.json()

# 批量更新短链接
def batch_update_short_urls(updates):
    payload = {"updates": updates}
    response = requests.post(f"{BASE_URL}/client/discovery/batch-update-short-urls", json=payload)
    return response.json()

# 使用示例：完整流程
if __name__ == "__main__":
    # 循环获取并处理笔记
    while True:
        # 1. 获取一条待处理笔记
        result = fetch_note_without_short_url()

        remaining = result.get("remaining", 0)
        print(f"剩余待处理: {remaining} 条")

        if not result.get("success") or result.get("data") is None:
            print("没有更多待处理的笔记")
            break

        note = result["data"]
        print(f"处理笔记: {note['title']}")
        print(f"  noteId: {note['noteId']}")
        print(f"  长链接: {note['noteUrl']}")

        # 2. 这里是你的逻辑：根据长链接找到对应的短链接
        # short_url = find_short_url(note['noteUrl'])

        # 3. 模拟：假设找到了短链接
        # update_result = batch_update_short_urls([{
        #     "noteId": note['noteId'],
        #     "shortUrl": short_url
        # }])
        # print(f"  更新结果: {update_result}")

        break  # 实际使用时去掉这行，继续循环
```

---

## JavaScript 调用示例

```javascript
const BASE_URL = 'https://www.wubug.cc/xiaohongshu/api';

// 获取关键词
async function getKeywords() {
  const response = await fetch(`${BASE_URL}/client/discovery/keywords`);
  return await response.json();
}

// 上传短链接
async function addShortLink(shortUrl, source = 'external', remark = '') {
  const response = await fetch(`${BASE_URL}/short-link-pool/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shortUrl, source, remark })
  });
  return await response.json();
}

// 获取一条无短链接笔记
async function fetchNoteWithoutShortUrl() {
  const response = await fetch(`${BASE_URL}/client/discovery/fetch-one-without-short-url`);
  return await response.json();
}

// 批量更新短链接
async function batchUpdateShortUrls(updates) {
  const response = await fetch(`${BASE_URL}/client/discovery/batch-update-short-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates })
  });
  return await response.json();
}

// 使用示例：完整流程
(async () => {
  while (true) {
    // 1. 获取一条待处理笔记
    const result = await fetchNoteWithoutShortUrl();

    const remaining = result.remaining || 0;
    console.log(`剩余待处理: ${remaining} 条`);

    if (!result.success || result.data === null) {
      console.log('没有更多待处理的笔记');
      break;
    }

    const note = result.data;
    console.log(`处理笔记: ${note.title}`);
    console.log(`  noteId: ${note.noteId}`);
    console.log(`  长链接: ${note.noteUrl}`);

    // 2. 这里是你的逻辑：根据长链接找到对应的短链接
    // const shortUrl = await findShortUrl(note.noteUrl);

    // 3. 回传短链接
    // const updateResult = await batchUpdateShortUrls([{
    //   noteId: note.noteId,
    //   shortUrl: shortUrl
    // }]);
    // console.log(`  更新结果:`, updateResult);

    break;  // 实际使用时去掉这行，继续循环
  }
})();
```
