# Vibe Coding 日历

一个纯静态的 Vibe Coding 项目记录页，用来按日期记录项目名、链接、开销、备注和网站预览图，并按月展示在日历时间轴中。

正式站点：`https://vibe-coding-calendar.vercel.app`

## 功能

- 左侧表单录入日期、项目名、链接、开销、备注、预览图
- 右侧按月展示日历卡片
- 支持新增、编辑、删除
- 预览图支持 hover 放大和弹窗查看
- 底部展示花费走势图
- 使用 Supabase Auth 邮箱 Magic Link 登录
- 登录后仅访问当前用户自己的数据

## 技术结构

- 静态页面：`index.html`
- 样式：`styles.css`
- 逻辑：`app.js`
- 无构建步骤，可直接本地打开或用静态服务器运行

## 数据存储

- Supabase 项目：`https://lwlyefbubroohjgslsjy.supabase.co`
- 数据表：`public.entries`
- Storage Bucket：`screenshots`

当前图片策略：

- 上传后只保存 `image_path`
- 展示时按需生成 signed URL 读取私有 bucket 图片
- 不再把临时 signed URL 写入 `entries.image_url`

## 本地运行

直接打开 `index.html` 即可，或在项目目录启动一个静态文件服务，例如：

```bash
python3 -m http.server 5000
```

然后访问 `http://127.0.0.1:5000`

## 部署

- GitHub：`https://github.com/susansheng/vibe-coding-calendar`
- Vercel：`https://vibe-coding-calendar.vercel.app`

当前项目为纯静态站点，推送到 `main` 后可直接重新部署到 Vercel。

## 最近修复

- 修复新增条目失败问题：上传图片后不再把临时 signed URL 写入数据库
- 修复编辑条目时误把临时 signed URL 覆盖回数据库的问题
- 保留更完整的错误信息，便于排查 Supabase 写入失败
