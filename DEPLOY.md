# Cloudflare Workers 部署教程

> 免责声明：FastGit 是非官方 GitHub 镜像项目，与 GitHub、Cloudflare、阿里云官方无关，仅供学习、研究和技术交流。使用者应遵守当地法律法规及相关服务条款，并自行承担部署、运行、账号和数据安全风险。

Cloudflare Dashboard 中实际显示为英文的菜单和按钮保留原名。

## 准备

- 一个 Cloudflare 账号
- 本仓库的 [worker.js](worker.js)
- 如需自定义域名，该域名必须已添加到同一个 Cloudflare 账号

部署前检查 `worker.js` 开头的配置：

```js
const ALLOW_LOGIN = false;
const SOURCE_REPOSITORY = "ZhangShengFan/FastGit";
```

- 公开实例建议保持 `ALLOW_LOGIN = false`
- 派生项目应将 `SOURCE_REPOSITORY` 改为自己的 `用户名/仓库名`

## 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages**。
3. 在 **Overview** 点击 **Create application**。
4. 点击 **Create Worker**。
5. 输入 Worker 名称，例如 `fastgit`。
6. 点击 **Deploy**。

如果页面显示 **Start with Hello World!**，点击其下方的 **Get started**，输入名称后点击 **Deploy**。

不要选择 **Pages** 或 **Import a repository**。

## 部署代码

1. 在 **Workers & Pages** 的 **Overview** 中打开刚创建的 Worker。
2. 点击右上角 **Edit code**。
3. 打开入口文件，通常是 `worker.js`、`index.js` 或 `src/index.js`。
4. 全选并删除示例代码。
5. 粘贴 [worker.js](worker.js) 的全部内容。
6. 点击右上角 **Deploy**。

不要把 Markdown 代码块的三个反引号粘贴进去，也不要把新代码追加到旧代码末尾。

部署后测试 Worker 提供的 `workers.dev` 地址：

```text
https://你的-Worker.你的子域.workers.dev/
https://你的-Worker.你的子域.workers.dev/healthy
```

根路径应显示 GitHub 页面，`/healthy` 应显示 `OK`。

## 绑定自定义域名

1. 进入 **Workers & Pages**。
2. 在 **Overview** 中选择 FastGit Worker。
3. 进入 **Settings** > **Domains & Routes**。
4. 点击 **Add** > **Custom Domain**。
5. 输入域名，例如 `git.example.com`，不要填写 `https://`。
6. 点击 **Add Custom Domain**。
7. 等待 DNS 记录和证书生效。

Cloudflare 会自动创建 DNS 记录并管理证书，不需要手动添加指向 `workers.dev` 的 CNAME。

如果提示域名冲突，检查 **DNS** > **Records** 中是否存在同名 A、AAAA 或 CNAME 记录。不要删除仍在使用的记录，可以改用其他子域名。

## 功能检查

假设镜像域名是：

```text
https://git.example.com
```

### 网页

```text
https://git.example.com
https://git.example.com/cloudflare/workers-sdk
```

页面应正常显示，链接应继续使用镜像域名。

### 静态资源

按 `F12` 打开开发者工具，在 **网络** 面板刷新页面。外部资源地址应类似：

```text
https://git.example.com/_proxy/github.githubassets.com/assets/...
```

### 下载

在公开仓库中测试：

- **Raw** 原始文件
- **Code** > **Download ZIP**
- Releases 中的公开附件

这些请求应通过镜像代理，不应直接停留在 `raw.githubusercontent.com` 或 `codeload.github.com`。

### Git

```powershell
git clone https://git.example.com/owner/repository.git
```

```powershell
git remote set-url origin https://git.example.com/owner/repository.git
git fetch origin
```

公开仓库的 Clone 和 Fetch 不需要网页登录。Push 需要 GitHub 身份验证，可能受到登录和风控流程影响。

### 健康页面

```text
https://git.example.com/healthy
```

正常时显示 `OK` 和 7 位提交 SHA，HTTP 状态码为 `200`；异常时显示“暂不可用”，状态码为 `503`。

## 更新

1. 获取最新 `worker.js`。
2. 进入 Worker 的 **Edit code**。
3. 完整替换入口文件内容。
4. 点击 **Deploy**。
5. 访问 `/healthy` 确认状态。

## 常见问题

### Error 1101

通常是代码复制不完整、代码被重复追加或粘贴了反引号。重新完整复制 `worker.js`，替换编辑器中的全部代码并再次 **Deploy**。

### 页面没有样式

在浏览器 **网络** 面板检查失败请求。正常资源路径以 `/_proxy/` 开头；如果仍是旧的 `/_gh/`，说明线上部署的还是旧代码。

### 自定义域名无法访问

确认 **Settings** > **Domains & Routes** 中域名状态正常，并检查是否存在冲突的 DNS 记录。建议直接使用 **Custom Domain**，不要叠加多层 CNAME 或第三方中转。

### 返回 403 或 429

GitHub 存在请求频率限制。等待限额恢复，并减少批量请求和频繁刷新。

### 登录后跳回 GitHub 官方域名

验证码、通行密钥、设备验证和部分风控流程依赖 GitHub 官方域名，无法保证全部登录流程都在镜像域名完成。
