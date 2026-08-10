# FastGit

FastGit 是一个可部署在 Cloudflare Workers 或阿里云 ESA Pages 上的非官方 GitHub 镜像。打开镜像域名即可访问 GitHub 官方界面，同时代理主要静态资源、原始文件、版本发布附件和仓库压缩包。

> 本项目与 GitHub、Cloudflare、阿里云官方无关，仅用于学习、研究和技术交流。请遵守当地法律法规及相关服务条款。

## 功能

- 显示 GitHub 官方网页界面
- 代理静态资源、头像、图片和原始文件
- 代理版本发布附件和仓库压缩包
- 支持 Git 智能 HTTP 路径
- 可选开启网页登录
- 只允许访问 GitHub 相关上游域名
- 默认只缓存公开静态资源
- 提供 `/healthy` HTML 状态页面

## 文件

仓库只保留实际需要的文件：

- `worker-cloudflare.js`：Cloudflare Workers 专用代码
- `worker-esa.js`：阿里云 ESA Pages 专用代码
- `esa.jsonc`：阿里云 ESA Pages 构建配置
- `README.md`：部署和使用说明
- `DEPLOY.md`：Cloudflare Workers 部署教程
- `ESA-DEPLOY.md`：阿里云 ESA Pages 部署教程
- `LICENSE`：MIT 开源协议

## Cloudflare Workers 部署

Cloudflare 会分批更新 Dashboard。以下步骤保留当前界面实际显示的英文菜单名称，不自行翻译。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages**。
3. 点击 **Create application**。
4. 点击 **Create Worker**，为 Worker 命名后点击 **Deploy**。如果当前界面显示 **Start with Hello World!**，则点击该项下的 **Get started**，命名后再点击 **Deploy**。
5. 在 **Overview** 中选择刚创建的 Worker。
6. 点击 **Edit code** 进入在线编辑器。
7. 删除编辑器里的示例代码。
8. 将 [worker-cloudflare.js](worker-cloudflare.js) 的全部内容粘贴进去。
9. 点击右上角 **Deploy**。

部署完成后打开 Worker 提供的 `workers.dev` 地址，即可访问镜像。

首次部署、绑定域名、检查功能和常见问题请查看 [Cloudflare Workers 部署教程](DEPLOY.md)。

## 阿里云 ESA Pages 部署

1. 进入阿里云 ESA 控制台的 **边缘计算和 AI** > **函数和Pages**。
2. 点击 **创建**，选择 **导入 Github 仓库**。
3. 授权 GitHub 后选择 FastGit 仓库和 `main` 分支。
4. 仓库中的 `esa.jsonc` 会自动指定 `worker-esa.js` 为函数入口，不安装依赖，构建时只检查 JavaScript 语法。
5. 点击 **开始部署**，完成后绑定自定义域名。

完整步骤请查看 [阿里云 ESA Pages 部署教程](ESA-DEPLOY.md)。

## 健康检查

访问：

```text
https://你的域名/healthy
```

页面会检查 Worker 与 GitHub 上游连接：

- 正常时显示 `OK`，HTTP 状态码为 `200`
- 异常时显示“暂不可用”，HTTP 状态码为 `503`
- 页面显示 GitHub 上游状态、提交版本、登录状态、检查耗时和检查时间

“提交版本”来自本仓库 `main` 分支最新提交的 7 位短 SHA。自行派生项目时，请修改对应部署文件顶部的 `SOURCE_REPOSITORY`。

## 绑定自定义域名

建议使用 Worker 官方 Custom Domain，不要叠加多层 CNAME 或第三方中转，否则 Git 客户端可能在 TLS 握手阶段失败。

1. 打开 Cloudflare Dashboard。
2. 进入 **Workers & Pages**。
3. 在 **Overview** 中选择 FastGit Worker。
4. 进入 **Settings** > **Domains & Routes**。
5. 点击 **Add**，选择 **Custom Domain**。
6. 输入镜像域名，例如 `git.example.com`。
7. 点击 **Add Custom Domain**，等待证书生效。

## 网页使用

假设镜像域名是：

```text
https://git.example.com
```

将 GitHub 地址中的域名替换为镜像域名：

```text
官方：https://github.com/cloudflare/workers-sdk
镜像：https://git.example.com/cloudflare/workers-sdk
```

页面中的静态资源、原始文件、版本发布附件和源码压缩包会自动改写到镜像地址。

## Git 使用

克隆公开仓库：

```powershell
git clone https://git.example.com/owner/repository.git
```

修改已有仓库的远程地址：

```powershell
git remote set-url origin https://git.example.com/owner/repository.git
git fetch origin
```

如果浏览器可以打开镜像，但 Git 提示 TLS 或 SSL 连接失败，请确认域名通过 Worker 的 **Custom Domain** 直接绑定，并移除多层 CNAME。

## 开启登录

网页登录默认关闭。登录会让 GitHub 密码、验证码和浏览器会话信息经过你的边缘函数，只应在自己控制且仅供自己使用的实例上开启。

修改正在使用的 `worker-cloudflare.js` 或 `worker-esa.js` 顶部配置：

```js
const ALLOW_LOGIN = true;
```

重新点击 **Deploy** 后，访问：

```text
https://你的域名/login
```

通行密钥、网页身份验证和部分 GitHub 风控流程依赖 `github.com` 原始域名，不保证能在镜像域名工作。

## 常见问题

### Error 1101

这表示边缘函数运行时发生异常，或线上仍部署着旧代码。重新部署对应平台的最新代码文件。

### 页面资源加载失败

打开浏览器开发者工具的 **网络** 面板检查失败地址。外部 GitHub 资源通常应改写为：

```text
https://git.example.com/_proxy/github.githubassets.com/...
```

### GitHub 接口返回 403 或 429

GitHub 接口存在请求频率限制。公共实例可能共享 Cloudflare 出口地址的限额，请等待限额恢复。

## 安全说明

- 不要公开运营开启登录功能的实例。
- 不要记录浏览器会话、身份验证请求头、令牌、登录表单或请求正文。
- 不要缓存接口响应、私有内容或下载文件。
- 边缘服务商会终止 TLS，镜像登录不是浏览器到 GitHub 的端到端直连。
- 公开实例可能被滥用，并可能消耗 Worker 请求额度和 GitHub 接口限额。

## 开源协议

本项目采用 [MIT License](LICENSE) 开源。
