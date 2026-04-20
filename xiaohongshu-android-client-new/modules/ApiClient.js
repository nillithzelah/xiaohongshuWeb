/**
 * API 通信模块
 * 负责与服务器通信
 */

function ApiClient(config) {
    this.config = config || {
        baseUrl: "https://www.wubug.cc/xiaohongshu/api",
        timeout: 30000
    };

    // 获取客户端ID
    this.getClientId = function() {
        var storage = storages.create("xhs_client");
        var id = storage.get("client_id");
        if (!id) {
            id = "autox_" + device.serial + "_" + Date.now();
            storage.put("client_id", id);
        }
        return id;
    };

    // HTTP GET 请求
    this.httpGet = function(path, params) {
        var url = this.config.baseUrl + path;
        if (params) {
            var query = [];
            for (var key in params) {
                query.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
            }
            url += "?" + query.join("&");
        }

        try {
            var response = http.get({
                url: url,
                headers: {
                    "Content-Type": "application/json",
                    "X-Client-Type": this.config.clientType || "android-autox",
                    "X-Client-Id": this.getClientId()
                },
                timeout: this.config.timeout
            });

            if (response.statusCode === 200) {
                return response.body.json();
            } else {
                throw new Error("HTTP " + response.statusCode);
            }
        } catch (e) {
            throw new Error("请求失败: " + e.message);
        }
    };

    // HTTP POST 请求
    this.httpPost = function(path, data) {
        try {
            var response = http.post({
                url: this.config.baseUrl + path,
                headers: {
                    "Content-Type": "application/json",
                    "X-Client-Type": this.config.clientType || "android-autox",
                    "X-Client-Id": this.getClientId()
                },
                body: JSON.stringify(data),
                timeout: this.config.timeout
            });

            if (response.statusCode === 200) {
                return response.body.json();
            } else {
                throw new Error("HTTP " + response.statusCode);
            }
        } catch (e) {
            throw new Error("请求失败: " + e.message);
        }
    };

    // 发送心跳
    this.sendHeartbeat = function(data) {
        var payload = {
            clientId: this.getClientId(),
            clientType: "android-autox",
            status: "online"
        };
        // 合并额外数据
        if (data) {
            for (var key in data) {
                payload[key] = data[key];
            }
        }
        return this.httpPost("/client/heartbeat", payload);
    };

    // 上传短链接到池
    this.addShortLink = function(shortUrl, source, remark) {
        return this.httpPost("/short-link-pool/add", {
            shortUrl: shortUrl,
            source: source || "android-autox",
            remark: remark || ""
        });
    };

    // 获取搜索关键词列表
    this.getKeywords = function() {
        return this.httpGet("/client/discovery/keywords");
    };

    // 分配关键词（多设备协同）
    this.allocateKeyword = function(clientId) {
        return this.httpGet("/client/discovery/keywords/allocate", {
            clientId: clientId || this.getClientId()
        });
    };

    // 释放关键词
    this.releaseKeyword = function(keyword, clientId) {
        return this.httpPost("/client/discovery/keywords/release", {
            keyword: keyword,
            clientId: clientId || this.getClientId()
        });
    };

    // 获取一条无短链接笔记
    this.fetchOneWithoutShortUrl = function() {
        return this.httpGet("/client/discovery/fetch-one-without-short-url");
    };

    // 批量更新短链接
    this.batchUpdateShortUrls = function(updates) {
        return this.httpPost("/client/discovery/batch-update-short-urls", {
            updates: updates
        });
    };

    // 更新单条短链接
    this.updateShortUrl = function(id, shortUrl) {
        return this.httpPost("/client/discovery/" + id + "/short-url", {
            shortUrl: shortUrl
        });
    };
}

module.exports = ApiClient;
