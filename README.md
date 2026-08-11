# FastGit

[![一键部署到 Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ZhangShengFan/FastGit)
[![部署到阿里云 ESA Pages](https://img.shields.io/badge/部署到阿里云_ESA_Pages-FF6A00?style=for-the-badge)](https://esa.console.aliyun.com/edge/pages/list)

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
- `wrangler.jsonc`：Cloudflare Workers 一键部署配置
- `worker-esa.js`：阿里云 ESA Pages 专用代码
- `esa.jsonc`：阿里云 ESA Pages 构建配置
- `README.md`：部署和使用说明
- `DEPLOY.md`：Cloudflare Workers 部署教程
- `ESA-DEPLOY.md`：阿里云 ESA Pages 部署教程
- `LICENSE`：MIT 开源协议

## Cloudflare Workers 部署

点击上方 **一键部署到 Cloudflare** 按钮，登录 Cloudflare 后按页面提示创建仓库并部署。部署配置由 `wrangler.jsonc` 自动读取，重新部署时会保留 Dashboard 中设置的环境变量。

也可以手动部署：

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

首次部署、绑定域名和功能检查请查看 [Cloudflare Workers 部署教程](DEPLOY.md)。

## 阿里云 ESA Pages 部署

点击上方 **部署到阿里云 ESA Pages** 按钮进入控制台，然后导入 GitHub 仓库。

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

“提交版本”来自 `SOURCE_REPOSITORY` 指定仓库的 `main` 分支最新提交。派生项目可直接在平台仪表盘修改该环境变量。

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

## 仪表盘设置

部署者需要调整的设置均使用环境变量，不需要修改代码：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ALLOW_LOGIN` | `false` | 设为 `true` 开放网页登录 |
| `SOURCE_REPOSITORY` | `ZhangShengFan/FastGit` | 健康页显示版本所使用的 `用户名/仓库名` |
| `CACHE_TTL` | `3600` | 静态资源缓存秒数，设为 `0` 关闭缓存，最大 `86400` |

- Cloudflare Workers：进入 **Settings** > **Variables and Secrets** 修改变量
- 阿里云 ESA Pages：进入项目 **基本信息** > **构建信息** > **修改**，修改环境变量

保存并重新部署后生效。网页登录默认关闭；登录会让 GitHub 密码、验证码和浏览器会话信息经过你的边缘函数，只应在自己控制且仅供自己使用的实例上开启。

开启登录后访问：

```text
https://你的域名/login
```

未设置、删除变量或设为 `false` 时，登录路径会显示“登录未开放”页面并返回 HTTP `403`。

通行密钥、网页身份验证和部分 GitHub 风控流程依赖 `github.com` 原始域名，不保证能在镜像域名工作。

## 安全说明

- 不要公开运营开启登录功能的实例。
- 不要记录浏览器会话、身份验证请求头、令牌、登录表单或请求正文。
- 不要缓存接口响应、私有内容或下载文件。
- 边缘服务商会终止 TLS，镜像登录不是浏览器到 GitHub 的端到端直连。
- 公开实例可能被滥用，并可能消耗 Worker 请求额度和 GitHub 接口限额。

## 开源协议

本项目采用 [MIT License](LICENSE) 开源。
