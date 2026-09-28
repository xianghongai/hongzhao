import type { TFunction } from 'i18next';

import type { OtpProblem } from '@/lib/otp/entries';
import type { EnvelopeError } from '@/lib/share/envelope';

/** Puts an envelope or key error into words; the library itself stays free of interface text. */
export function envelopeErrorText(t: TFunction, error: EnvelopeError): string {
  const { alg = '', keyKind } = error.detail;
  return t(`errors.envelope.${error.reason}`, {
    alg,
    keyKind: keyKind ? t(`errors.keyKind.${keyKind}`) : '',
  });
}

export function otpProblemText(t: TFunction, result: OtpProblem): string {
  return t(`errors.otp.${result.problem}`, { algorithm: 'algorithm' in result ? result.algorithm : '' });
}
