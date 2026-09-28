import { CloudOffIcon, EraserIcon, EyeOffIcon, ShieldCheckIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PROMISES = [
  {
    icon: CloudOffIcon,
    title: '不上传',
    body: '输入的内容只在这个页面里处理，不会发送到任何地方。内容安全策略（CSP）设置了 connect-src none，由浏览器强制执行，页面想发也发不出去。链接传送的内容放在网址的 # 之后，打开链接时也不会发给服务器。离线缓存会下载并定期检查本站自身的文件，这些请求不含任何输入内容。',
  },
  {
    icon: EraserIcon,
    title: '不留存',
    body: '不使用 Cookie、localStorage 或 IndexedDB，连主题偏好都不记。离线缓存里只有本站的代码、样式、字体和图标。关闭标签页，输入过的一切随之消失。',
  },
  {
    icon: EyeOffIcon,
    title: '不追踪',
    body: '没有统计、没有第三方脚本、没有 CDN。所有代码随站点一起发布，源码公开可查。',
  },
];

export function PrivacyDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <ShieldCheckIcon data-icon="inline-start" className="text-brand" />
        不上传 · 不留存 · 不追踪
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>这些承诺如何兑现</DialogTitle>
          <DialogDescription>每一条都可以自己验证，不需要相信我们。</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-4">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="grid gap-1">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          验证方法：打开浏览器开发者工具的“网络”面板，使用任意工具，列表中不会出现新的请求。访问过一次后，断开网络也能继续使用。
        </p>
      </DialogContent>
    </Dialog>
  );
}
