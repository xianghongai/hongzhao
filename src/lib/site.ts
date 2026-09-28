// Su Shi: 泥上偶然留指爪，鸿飞那复计东西. The name and the tagline read on as one line of the poem.
export const SITE_NAME = '泥上';
export const SITE_TAGLINE = '偶然留指爪，鸿飞那复计东西';

/**
 * The source repository, inferred from a GitHub Pages project address (`<owner>.github.io/<repo>/`),
 * so no account name is hard-coded. Returns null anywhere else.
 */
export function repositoryUrl(location: Pick<Location, 'hostname' | 'pathname'> = window.location): string | null {
  const owner = /^([a-z\d-]+)\.github\.io$/i.exec(location.hostname)?.[1];
  const repo = location.pathname.split('/').find((segment) => segment !== '');
  return owner && repo ? `https://github.com/${owner}/${repo}` : null;
}
