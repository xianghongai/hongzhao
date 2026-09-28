import type { TFunction } from 'i18next';
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

export type FormatId = 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms' | 'tel' | 'geo' | 'event' | 'otp';

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
  id: FormatId;
  label: string;
  icon: LucideIcon;
  /** What a phone does after scanning, shown under the format switcher. */
  summary: string;
  fields: FieldDef[];
  /** Whether the "do not open automatically" relay makes sense for this format. */
  relay: boolean;
  build: (values: Values) => BuildResult;
}

/** What each format's fields start with. Kept apart from the labels, which follow the interface language. */
export const INITIAL_VALUES: Record<FormatId, Values> = {
  text: { text: '' },
  url: { url: '' },
  wifi: { ssid: '', password: '', security: 'WPA', hidden: 'false' },
  contact: { name: '', phone: '', email: '', org: '', title: '', url: '', address: '', note: '' },
  email: { to: '', subject: '', body: '' },
  sms: { phone: '', message: '' },
  tel: { phone: '' },
  geo: { latitude: '', longitude: '', label: '' },
  event: { title: '', start: '', end: '', location: '', description: '' },
  otp: { issuer: '', account: '', secret: '', algorithm: 'SHA1', digits: '6', period: '30' },
};

export const FORMAT_IDS = Object.keys(INITIAL_VALUES) as FormatId[];

const v = (values: Values, name: string) => values[name] ?? '';

const required = (value: string, message: string): BuildResult | null =>
  value.trim() === '' ? { error: message } : null;

/** The formats with their text in the current language; rebuilt when the language changes. */
export function buildFormats(t: TFunction): readonly FormatDef[] {
  const format = (id: FormatId) => ({
    id,
    label: t(`qr.formats.${id}.label`),
    summary: t(`qr.formats.${id}.summary`),
  });
  const wifiSecurity: ReadonlyArray<Option<WifiSecurity>> = [
    { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
    { value: 'WEP', label: 'WEP' },
    { value: 'nopass', label: t('qr.fields.noPassword') },
  ];

  return [
    {
      ...format('text'),
      icon: TypeIcon,
      relay: true,
      fields: [
        {
          name: 'text',
          label: t('qr.fields.text'),
          kind: 'textarea',
          placeholder: t('qr.fields.textPlaceholder'),
          wide: true,
        },
      ],
      build: (values) => required(v(values, 'text'), '') ?? { text: v(values, 'text') },
    },
    {
      ...format('url'),
      icon: LinkIcon,
      relay: true,
      fields: [
        {
          name: 'url',
          label: t('qr.fields.url'),
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
      ...format('wifi'),
      icon: WifiIcon,
      relay: false,
      fields: [
        { name: 'ssid', label: t('qr.fields.ssid'), kind: 'text' },
        { name: 'password', label: t('qr.fields.password'), kind: 'password' },
        { name: 'security', label: t('qr.fields.security'), kind: 'select', options: wifiSecurity },
        { name: 'hidden', label: t('qr.fields.hidden'), kind: 'switch' },
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
      ...format('contact'),
      icon: ContactIcon,
      relay: false,
      fields: [
        { name: 'name', label: t('qr.fields.name'), kind: 'text' },
        { name: 'phone', label: t('qr.fields.phone'), kind: 'text', inputMode: 'tel' },
        { name: 'email', label: t('qr.fields.email'), kind: 'text', inputMode: 'email' },
        { name: 'org', label: t('qr.fields.org'), kind: 'text' },
        { name: 'title', label: t('qr.fields.jobTitle'), kind: 'text' },
        { name: 'url', label: t('qr.fields.website'), kind: 'text', inputMode: 'url' },
        { name: 'address', label: t('qr.fields.address'), kind: 'text', wide: true },
        { name: 'note', label: t('qr.fields.note'), kind: 'textarea', wide: true },
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
      ...format('email'),
      icon: MailIcon,
      relay: false,
      fields: [
        { name: 'to', label: t('qr.fields.to'), kind: 'text', inputMode: 'email', wide: true },
        { name: 'subject', label: t('qr.fields.subject'), kind: 'text', wide: true },
        { name: 'body', label: t('qr.fields.body'), kind: 'textarea', wide: true },
      ],
      build: (values) =>
        required(v(values, 'to'), '') ?? {
          text: emailPayload({ to: v(values, 'to'), subject: v(values, 'subject'), body: v(values, 'body') }),
        },
    },
    {
      ...format('sms'),
      icon: MessageSquareIcon,
      relay: false,
      fields: [
        { name: 'phone', label: t('qr.fields.number'), kind: 'text', inputMode: 'tel', wide: true },
        { name: 'message', label: t('qr.fields.message'), kind: 'textarea', wide: true },
      ],
      build: (values) =>
        required(v(values, 'phone'), '') ?? {
          text: smsPayload({ phone: v(values, 'phone'), message: v(values, 'message') }),
        },
    },
    {
      ...format('tel'),
      icon: PhoneIcon,
      relay: false,
      fields: [
        {
          name: 'phone',
          label: t('qr.fields.number'),
          kind: 'text',
          inputMode: 'tel',
          placeholder: '+86 138 0000 0000',
          wide: true,
        },
      ],
      build: (values) => required(v(values, 'phone'), '') ?? { text: telPayload(v(values, 'phone')) },
    },
    {
      ...format('geo'),
      icon: MapPinIcon,
      relay: false,
      fields: [
        {
          name: 'latitude',
          label: t('qr.fields.latitude'),
          kind: 'text',
          inputMode: 'decimal',
          placeholder: '39.9087',
        },
        {
          name: 'longitude',
          label: t('qr.fields.longitude'),
          kind: 'text',
          inputMode: 'decimal',
          placeholder: '116.3975',
        },
        { name: 'label', label: t('qr.fields.place'), kind: 'text', wide: true },
      ],
      build: (values) => {
        const latitude = v(values, 'latitude');
        const longitude = v(values, 'longitude');
        if (latitude.trim() === '' || longitude.trim() === '') {
          return { error: '' };
        }
        if (!isValidCoordinate(latitude, 90) || !isValidCoordinate(longitude, 180)) {
          return { error: t('qr.errors.geoRange') };
        }
        return { text: geoPayload({ latitude, longitude, label: v(values, 'label') }) };
      },
    },
    {
      ...format('event'),
      icon: CalendarIcon,
      relay: false,
      fields: [
        { name: 'title', label: t('qr.fields.eventTitle'), kind: 'text', wide: true },
        { name: 'start', label: t('qr.fields.start'), kind: 'datetime' },
        { name: 'end', label: t('qr.fields.end'), kind: 'datetime' },
        { name: 'location', label: t('qr.fields.location'), kind: 'text', wide: true },
        { name: 'description', label: t('qr.fields.description'), kind: 'textarea', wide: true },
      ],
      build: (values) => {
        const missing = required(v(values, 'title'), '') ?? required(v(values, 'start'), t('qr.errors.startRequired'));
        if (missing) {
          return missing;
        }
        if (v(values, 'end') !== '' && v(values, 'end') < v(values, 'start')) {
          return { error: t('qr.errors.endBeforeStart') };
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
      ...format('otp'),
      icon: KeyRoundIcon,
      relay: false,
      fields: [
        { name: 'issuer', label: t('qr.fields.issuer'), kind: 'text', placeholder: 'GitHub' },
        { name: 'account', label: t('qr.fields.account'), kind: 'text', placeholder: 'name@example.com' },
        { name: 'secret', label: t('qr.fields.secret'), kind: 'password', wide: true },
        {
          name: 'algorithm',
          label: t('qr.fields.algorithm'),
          kind: 'select',
          options: ALGORITHMS.map((value) => ({ value, label: value })),
        },
        {
          name: 'digits',
          label: t('qr.fields.digits'),
          kind: 'select',
          options: ['6', '7', '8'].map((value) => ({ value, label: t('common.digits', { count: Number(value) }) })),
        },
        {
          name: 'period',
          label: t('qr.fields.period'),
          kind: 'select',
          options: ['30', '60'].map((value) => ({ value, label: t('common.seconds', { count: Number(value) }) })),
        },
      ],
      build: (values) => {
        if (v(values, 'secret').trim() === '') {
          return { error: '' };
        }
        const secret = normalizeSecret(v(values, 'secret'));
        if (secret === null) {
          return { error: t('qr.errors.base32') };
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
}
