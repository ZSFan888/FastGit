# 阿里云 ESA Pages 部署教程

> 免责声明：FastGit 是非官方 GitHub 镜像项目，与 GitHub、Cloudflare、阿里云官方无关，仅供学习、研究和技术交流。使用者应遵守当地法律法规及相关服务条款，并自行承担部署、运行、账号和数据安全风险。

## 准备

- 已开通阿里云边缘安全加速 ESA 的**函数和Pages**服务
- 一个 GitHub 账号
- FastGit 仓库或自己的派生仓库
- 如需自定义域名，ESA 账号下必须存在一个可用站点

仓库已包含 `esa.jsonc`：

```json
{
  "name": "fastgit",
  "entry": "./worker-esa.js",
  "installCommand": "",
  "buildCommand": "node --check worker-esa.js"
}
```

它会将 `worker-esa.js` 设为函数入口，跳过依赖安装，并在构建阶段检查 JavaScript 语法。

## 导入 GitHub 仓库

1. 登录 [ESA 控制台](https://esa.console.aliyun.com/)。
2. 在左侧进入 **边缘计算和 AI** > **函数和Pages**。
3. 点击 **创建**。
4. 选择 **导入 Github 仓库**。
5. 点击 **添加 GitHub 账号**，完成 GitHub 授权。
6. 选择 FastGit 仓库，点击 **下一步**。
7. 生产分支选择 `main`。
8. 确认函数文件路径为 `./worker-esa.js`。
9. 安装命令留空，构建命令填写 `node --check worker-esa.js`。
10. 点击 **开始部署**。

`esa.jsonc` 的配置优先级高于控制台配置。以后如需修改入口或构建方式，应直接修改该文件并推送到 GitHub。

部署完成后会生成公共预览地址。该地址需要 Token 鉴权，Token 有效期为 60 分钟，正式使用应绑定自定义域名。

## 绑定自定义域名

1. 打开已创建的 FastGit Pages 项目。
2. 进入 **域名** 页签。
3. 在 **域名绑定** 中点击 **添加域名**。
4. 选择可用站点并输入域名，例如 `git.example.com`。

如果站点使用 NS 接入，等待 DNS 生效即可。如果站点使用 CNAME 接入，点击 **查看DNS记录**，将 ESA 提供的 CNAME 添加到域名解析服务商，等待状态显示**已配置**。

使用 HTTPS 前，需要确保 ESA 站点已经配置 SSL/TLS 证书。

## 更新

向 `main` 分支推送新提交后，ESA Pages 会自动构建并部署生产版本。

如果没有自动部署，在项目的构建记录中手动重新部署，并检查 `esa.jsonc` 是否位于仓库根目录。

如果日志仍显示 `Starting build: npm run build`，说明 ESA 没有读取到最新配置。重新同步 GitHub 仓库后触发部署，并确认构建信息中的命令为 `node --check worker-esa.js`。

## 检查

绑定域名后依次测试：

```text
https://git.example.com/
https://git.example.com/healthy
```

- 首页应显示 GitHub 页面
- `/healthy` 应显示 `OK` 和 7 位提交 SHA
- 浏览器网络面板中的 GitHub 静态资源应使用 `/_proxy/` 路径
- 测试公开仓库的 Raw、Download ZIP、Clone 和 Fetch

## 注意事项

- 公开实例建议保持 `ALLOW_LOGIN = false`
- `SOURCE_REPOSITORY` 应指向实际部署使用的 GitHub 仓库
- ESA 的公共预览域名只适合临时测试
- GitHub 接口仍有请求频率限制
- Push 依赖 GitHub 身份验证，不能保证所有写入流程都能通过镜像完成
