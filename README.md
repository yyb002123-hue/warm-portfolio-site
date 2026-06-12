# 温室影像档案

这是一个本地运行的中文作品集网站，适合展示影像作品和文章/随笔。内容可以在后台用表格编辑，不需要先学习数据库。

## 启动网站

优先使用 Node.js：

```powershell
npm start
```

如果 Node.js 暂时不可用，也可以用 Windows PowerShell 脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Site.ps1
```

启动后打开：

- 前台：http://localhost:3000/
- 后台：http://localhost:3000/admin.html

## 准备上线版本

上线静态网站前，先同步一次内容数据：

```powershell
npm run sync:data
```

线上版本会读取：

```text
public/data/site-data.json
```

## 免费上线到 GitHub Pages

这个项目已经准备好 GitHub Pages 自动发布流程。推送到 GitHub 的 `main` 分支后，GitHub Actions 会把 `public/` 文件夹发布成在线网站。

基本步骤：

1. 在 GitHub 创建一个新仓库。
2. 把本项目推送到新仓库的 `main` 分支。
3. 进入仓库 `Settings` -> `Pages`。
4. Source 选择 `GitHub Actions`。
5. 等待 Actions 运行完成，Pages 页面会显示在线网址。

之后如果本地后台改了内容，先运行：

```powershell
npm run sync:data
```

再提交并推送到 GitHub，线上页面就会更新。

## 修改内容

推荐进入后台页面修改首页文字、作品、文章和图片。点击“保存修改”后，内容会写入：

```text
data/site-data.json
```

每次保存前，服务器会自动把上一版内容备份到：

```text
data/site-data.backup.json
```

这个备份文件不会提交到 Git，主要用于本地误操作后找回上一版。

上传的图片会保存在：

```text
public/uploads/
```

后台表格里会自动填入类似 `/uploads/文件名.png` 的地址。
