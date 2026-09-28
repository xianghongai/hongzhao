import {
  CalendarIcon,
  ContactIcon,
  KeyRoundIcon,
  LinkIcon,
  type LucideIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  TypeIcon,
  WifiIcon,
} from 'lucide-react';

import type { Option } from '@/components/option-select';
import { ALGORITHMS, normalizeSecret, toUri } from '@/lib/otp/entries';
import {
  type WifiSecurity,
  emailPayload,
  eventPayload,
  geoPayload,
  isValidCoordinate,
  smsPayload,
  telPayload,
  vcardPayload,
  wifiPayload,
} from '@/lib/qr/payloads';

export type Values = Record<string, string>;

export interface FieldDef {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'password' | 'datetime' | 'select' | 'switch';
  placeholder?: string;
  description?: string;
  options?: ReadonlyArray<Option<string>>;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Takes the full row in the two-column form grid. */
  wide?: boolean;
}

/** `text` is what goes into the code; `error` explains why nothing can be generated yet. */
export type BuildResult = { text: string } | { error: string };

export interface FormatDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** What a phone does after scanning, shown under the format switcher. */
  summary: string;
  fields: FieldDef[];
  initial: Values;
  /** Whether the "do not open automatically" relay makes sense for this format. */
  relay: boolean;
  build: (values: Values) => BuildResult;
}

const v = (values: Values, name: string) => values[name] ?? '';

const required = (value: string, message: string): BuildResult | null =>
  value.trim() === '' ? { error: message } : null;

const WIFI_SECURITY: ReadonlyArray<Option<WifiSecurity>> = [
  { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
  { value: 'WEP', label: 'WEP' },
  { value: 'nopass', label: '无密码' },
];

export const FORMATS: readonly FormatDef[] = [
  {
    id: 'text',
    label: '文本',
    summary: '扫码后显示这段文字，可以直接复制。',
    icon: TypeIcon,
    relay: true,
    initial: { text: '' },
    fields: [{ name: 'text', label: '内容', kind: 'textarea', placeholder: '任意文本，支持中文与多行', wide: true }],
    build: (values) => required(v(values, 'text'), '') ?? { text: v(values, 'text') },
  },
  {
    id: 'url',
    label: '网址',
    summary: '扫码后在浏览器中打开这个网址。',
    icon: LinkIcon,
    relay: true,
    initial: { url: '' },
    fields: [
      {
        name: 'url',
        label: '网址',
        kind: 'text',
        inputMode: 'url',
        placeholder: 'https://example.com',
        wide: true,
      },
    ],
    build: (values) => {
      const url = v(values, 'url').trim();
      if (url === '') {
        return { error: '' };
      }
      return { text: /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}` };
    },
  },
  {
    id: 'wifi',
    label: 'Wi-Fi',
    summary: '扫码后可以直接连接这个 Wi-Fi，不用手动输入密码。',
    icon: WifiIcon,
    relay: false,
    initial: { ssid: '', password: '', security: 'WPA', hidden: 'false' },
    fields: [
      { name: 'ssid', label: '网络名称（SSID）', kind: 'text' },
      { name: 'password', label: '密码', kind: 'password' },
      { name: 'security', label: '加密方式', kind: 'select', options: WIFI_SECURITY },
      { name: 'hidden', label: '隐藏网络', kind: 'switch' },
    ],
    build: (values) =>
      required(v(values, 'ssid'), '') ?? {
        text: wifiPayload({
          ssid: v(values, 'ssid'),
          password: v(values, 'password'),
          security: v(values, 'security') as WifiSecurity,
          hidden: v(values, 'hidden') === 'true',
        }),
      },
  },
  {
    id: 'contact',
    label: '联系人',
    summary: '扫码后可以一键存入手机通讯录。',
    icon: ContactIcon,
    relay: false,
    initial: { name: '', phone: '', email: '', org: '', title: '', url: '', address: '', note: '' },
    fields: [
      { name: 'name', label: '姓名', kind: 'text' },
      { name: 'phone', label: '电话', kind: 'text', inputMode: 'tel' },
      { name: 'email', label: '邮箱', kind: 'text', inputMode: 'email' },
      { name: 'org', label: '单位', kind: 'text' },
      { name: 'title', label: '职位', kind: 'text' },
      { name: 'url', label: '网站', kind: 'text', inputMode: 'url' },
      { name: 'address', label: '地址', kind: 'text', wide: true },
      { name: 'note', label: '备注', kind: 'textarea', wide: true },
    ],
    build: (values) =>
      required(v(values, 'name'), '') ?? {
        text: vcardPayload({
          name: v(values, 'name'),
          org: v(values, 'org'),
          title: v(values, 'title'),
          phone: v(values, 'phone'),
          email: v(values, 'email'),
          url: v(values, 'url'),
          address: v(values, 'address'),
          note: v(values, 'note'),
        }),
      },
  },
  {
    id: 'email',
    label: '邮件',
    summary: '扫码后打开邮件 App，收件人、主题和正文都已填好。',
    icon: MailIcon,
    relay: false,
    initial: { to: '', subject: '', body: '' },
    fields: [
      { name: 'to', label: '收件人', kind: 'text', inputMode: 'email', wide: true },
      { name: 'subject', label: '主题', kind: 'text', wide: true },
      { name: 'body', label: '正文', kind: 'textarea', wide: true },
    ],
    build: (values) =>
      required(v(values, 'to'), '') ?? {
        text: emailPayload({ to: v(values, 'to'), subject: v(values, 'subject'), body: v(values, 'body') }),
      },
  },
  {
    id: 'sms',
    label: '短信',
    summary: '扫码后打开短信 App，号码和内容都已填好，确认后即可发送。',
    icon: MessageSquareIcon,
    relay: false,
    initial: { phone: '', message: '' },
    fields: [
      { name: 'phone', label: '号码', kind: 'text', inputMode: 'tel', wide: true },
      { name: 'message', label: '短信内容', kind: 'textarea', wide: true },
    ],
    build: (values) =>
      required(v(values, 'phone'), '') ?? {
        text: smsPayload({ phone: v(values, 'phone'), message: v(values, 'message') }),
      },
  },
  {
    id: 'tel',
    label: '电话',
    summary: '扫码后打开拨号界面并填好号码，确认后即可拨出。',
    icon: PhoneIcon,
    relay: false,
    initial: { phone: '' },
    fields: [
      { name: 'phone', label: '号码', kind: 'text', inputMode: 'tel', placeholder: '+86 138 0000 0000', wide: true },
    ],
    build: (values) => required(v(values, 'phone'), '') ?? { text: telPayload(v(values, 'phone')) },
  },
  {
    id: 'geo',
    label: '位置',
    summary: '扫码后在地图 App 中打开这个位置。iPhone 相机不识别这种格式，可以用安卓手机或其他扫码 App。',
    icon: MapPinIcon,
    relay: false,
    initial: { latitude: '', longitude: '', label: '' },
    fields: [
      { name: 'latitude', label: '纬度', kind: 'text', inputMode: 'decimal', placeholder: '39.9087' },
      { name: 'longitude', label: '经度', kind: 'text', inputMode: 'decimal', placeholder: '116.3975' },
      { name: 'label', label: '地点名称（可选）', kind: 'text', wide: true },
    ],
    build: (values) => {
      const latitude = v(values, 'latitude');
      const longitude = v(values, 'longitude');
      if (latitude.trim() === '' || longitude.trim() === '') {
        return { error: '' };
      }
      if (!isValidCoordinate(latitude, 90) || !isValidCoordinate(longitude, 180)) {
        return { error: '纬度范围 -90 到 90，经度范围 -180 到 180，使用十进制小数' };
      }
      return { text: geoPayload({ latitude, longitude, label: v(values, 'label') }) };
    },
  },
  {
    id: 'event',
    label: '日程',
    summary: '扫码后可以把这个日程添加到手机日历。',
    icon: CalendarIcon,
    relay: false,
    initial: { title: '', start: '', end: '', location: '', description: '' },
    fields: [
      { name: 'title', label: '标题', kind: 'text', wide: true },
      { name: 'start', label: '开始', kind: 'datetime' },
      { name: 'end', label: '结束', kind: 'datetime' },
      { name: 'location', label: '地点', kind: 'text', wide: true },
      { name: 'description', label: '说明', kind: 'textarea', wide: true },
    ],
    build: (values) => {
      const missing = required(v(values, 'title'), '') ?? required(v(values, 'start'), '请选择开始时间');
      if (missing) {
        return missing;
      }
      if (v(values, 'end') !== '' && v(values, 'end') < v(values, 'start')) {
        return { error: '结束时间早于开始时间' };
      }
      return {
        text: eventPayload({
          title: v(values, 'title'),
          start: v(values, 'start'),
          end: v(values, 'end'),
          location: v(values, 'location'),
          description: v(values, 'description'),
        }),
      };
    },
  },
  {
    id: 'otp',
    label: '两步验证',
    summary: '用手机上的验证器 App 扫码，即可添加这个账户。',
    icon: KeyRoundIcon,
    relay: false,
    initial: { issuer: '', account: '', secret: '', algorithm: 'SHA1', digits: '6', period: '30' },
    fields: [
      { name: 'issuer', label: '服务名称', kind: 'text', placeholder: 'GitHub' },
      { name: 'account', label: '账户', kind: 'text', placeholder: 'name@example.com' },
      {
        name: 'secret',
        label: '密钥（Base32）',
        kind: 'password',
        wide: true,
      },
      {
        name: 'algorithm',
        label: '算法',
        kind: 'select',
        options: ALGORITHMS.map((value) => ({ value, label: value })),
      },
      {
        name: 'digits',
        label: '位数',
        kind: 'select',
        options: ['6', '7', '8'].map((value) => ({ value, label: `${value} 位` })),
      },
      {
        name: 'period',
        label: '周期',
        kind: 'select',
        options: ['30', '60'].map((value) => ({ value, label: `${value} 秒` })),
      },
    ],
    build: (values) => {
      if (v(values, 'secret').trim() === '') {
        return { error: '' };
      }
      const secret = normalizeSecret(v(values, 'secret'));
      if (secret === null) {
        return { error: '密钥不是有效的 Base32 编码' };
      }
      return {
        text: toUri({
          label: v(values, 'account').trim(),
          issuer: v(values, 'issuer').trim(),
          secret,
          algorithm: v(values, 'algorithm') as (typeof ALGORITHMS)[number],
          digits: Number(v(values, 'digits')),
          period: Number(v(values, 'period')),
        }),
      };
    },
  },
];
